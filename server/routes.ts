import type { Express, RequestHandler } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { gameSocket } from "./websocket";
import { insertUserSchema, insertBetSchema, gamesConfig, type GameType } from "@shared/schema";
import { z } from "zod";
import { sendPromotionalMessage, getBot, createStarsInvoiceLink, refundStarsPayment, initStarsPaymentHandlers } from "./telegramBot";
import path from "path";
import fs from "fs";
import multer from "multer";

// Configure multer for broadcast photo uploads
const broadcastStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(process.cwd(), "uploads/broadcast");
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `broadcast_${Date.now()}${ext}`);
  }
});

const broadcastUpload = multer({
  storage: broadcastStorage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Only images allowed"));
    }
  }
});

// Helper to broadcast bet to all connected clients
async function broadcastBetResult(
  odejs: string,
  gameType: string,
  amount: number,
  payout: number,
  isWin: boolean
) {
  const user = await storage.getUser(odejs);
  if (user) {
    gameSocket.broadcastBet({
      odejs: user.id,
      username: user.username || user.firstName || "Player",
      photoUrl: user.photoUrl || null,
      gameType,
      amount,
      payout,
      isWin,
    });
  }
}

// Get current win rate from settings
async function getWinRate(): Promise<number> {
  try {
    const currentSettings = await storage.getSettings();
    return currentSettings.winRatePercent / 100; // Convert to decimal (e.g., 50 -> 0.5)
  } catch {
    return 0.5; // Default 50% win rate
  }
}

// Check if player should win based on admin-controlled win rate
async function shouldPlayerWin(): Promise<boolean> {
  const winRate = await getWinRate();
  return Math.random() < winRate;
}

// Get Luxe-specific RTP from settings
async function getLuxeRtp(): Promise<number> {
  try {
    const currentSettings = await storage.getSettings();
    return (currentSettings.luxeRtpPercent ?? 45) / 100; // Convert to decimal (e.g., 45 -> 0.45)
  } catch {
    return 0.45; // Default 45% RTP for Luxe slot
  }
}

// Win Limiting System - Prevents big wins from bankrupting casino
// Applies to ALL games except poker
// AGGRESSIVE SETTINGS to prevent $0.10 -> $100 or $1000 wins
interface WinLimitSettings {
  enabled: boolean;
  maxMultiplier: number;       // Max multiplier on any single bet (default 20x)
  maxAbsoluteWin: number;      // Absolute max win per spin regardless of bet (default $25)
  lossRecoveryPercent: number; // How much of losses can be recovered (default 30%)
}

async function getWinLimitSettings(): Promise<WinLimitSettings> {
  try {
    const settings = await storage.getSettings();
    return {
      enabled: (settings as any).winLimitEnabled ?? true,
      maxMultiplier: (settings as any).maxWinMultiplier ?? 20,         // Reduced from 50x to 20x
      maxAbsoluteWin: (settings as any).maxAbsoluteWin ?? 25,          // NEW: Absolute cap $25
      lossRecoveryPercent: (settings as any).lossRecoveryPercent ?? 30, // Reduced from 50% to 30%
    };
  } catch {
    return { enabled: true, maxMultiplier: 20, maxAbsoluteWin: 25, lossRecoveryPercent: 30 };
  }
}

// Apply win limit - caps the maximum possible win
// AGGRESSIVE LIMITS to prevent big wins from small bets
async function applyWinLimit(
  odejs: string,
  bet: number,
  potentialWin: number,
  gameType: string
): Promise<number> {
  const settings = await getWinLimitSettings();
  
  if (!settings.enabled) {
    return potentialWin; // Win limiting disabled
  }
  
  // Cap 1: Maximum multiplier limit (e.g., max 20x bet)
  const maxByMultiplier = bet * settings.maxMultiplier;
  let limitedWin = Math.min(potentialWin, maxByMultiplier);
  
  // Cap 2: Absolute maximum win per spin (e.g., $25 max regardless of bet)
  limitedWin = Math.min(limitedWin, settings.maxAbsoluteWin);
  
  // Cap 3: Loss recovery limit - if user is in net loss, limit recovery even more
  try {
    const session = await storage.getUserSlotSession(odejs, gameType);
    if (session && session.sessionProfit !== null && session.sessionProfit < 0) {
      // User has net losses - strictly limit how much they can recover
      const netLoss = Math.abs(session.sessionProfit);
      const maxRecovery = netLoss * (settings.lossRecoveryPercent / 100);
      // Minimum recovery is just 20% of bet (feels fair but limits recovery)
      limitedWin = Math.min(limitedWin, Math.max(maxRecovery, bet * 0.2));
    }
  } catch {
    // No session data, just apply multiplier cap
  }
  
  // Ensure we never return negative or zero for a positive potential win
  if (potentialWin > 0 && limitedWin < bet * 0.1) {
    limitedWin = bet * 0.1; // Minimum win is 10% of bet to not feel rigged
  }
  
  return Math.round(limitedWin * 100) / 100; // Round to 2 decimal places
}

// Check if Luxe player should win based on admin-controlled RTP
async function shouldLuxePlayerWin(): Promise<boolean> {
  const rtp = await getLuxeRtp();
  return Math.random() < rtp;
}

// Game logic utilities
function generateCrashPoint(): number {
  const houseEdge = 0.97;
  const r = Math.random();
  return Math.max(1.0, Math.floor((houseEdge / (1 - r)) * 100) / 100);
}

function generateMinePositions(gridSize: number, minesCount: number): number[] {
  const positions: number[] = [];
  while (positions.length < minesCount) {
    const pos = Math.floor(Math.random() * gridSize);
    if (!positions.includes(pos)) {
      positions.push(pos);
    }
  }
  return positions;
}

function calculateMinesMultiplier(revealed: number, mines: number, gridSize: number = 25): number {
  // Base multiplier depends on mines count: each mine adds +0.12
  // 1 mine = 0.12, 2 mines = 0.24, 3 mines = 0.36, etc.
  const baseMultiplier = 0.12 * mines;
  
  if (revealed === 0) return baseMultiplier;
  
  // Progressive increase per revealed cell
  // More mines = higher growth rate per reveal
  const growthPerReveal = 0.12 + (mines * 0.05); // Growth rate increases with mines
  
  const multiplier = baseMultiplier + (revealed * growthPerReveal);
  return Math.floor(multiplier * 100) / 100; // Round to 2 decimal places
}

function calculateDiceMultiplier(target: number, isOver: boolean): number {
  const winChance = isOver ? (100 - target) / 100 : target / 100;
  if (winChance <= 0) return 0;
  return Math.floor((0.97 / winChance) * 100) / 100;
}

function rollDice(): number {
  return Math.floor(Math.random() * 100) + 1;
}

function spinSlots(): { symbols: number[]; multiplier: number } {
  const symbols = [
    Math.floor(Math.random() * 6),
    Math.floor(Math.random() * 6),
    Math.floor(Math.random() * 6),
  ];
  
  const multipliers = [2, 3, 4, 5, 10, 25];
  let multiplier = 0;
  
  if (symbols[0] === symbols[1] && symbols[1] === symbols[2]) {
    multiplier = multipliers[symbols[0]];
  } else if (symbols[0] === symbols[1] || symbols[1] === symbols[2] || symbols[0] === symbols[2]) {
    const matchSymbol = symbols[0] === symbols[1] ? symbols[0] : symbols[1] === symbols[2] ? symbols[1] : symbols[0];
    multiplier = Math.floor(multipliers[matchSymbol] / 3);
  }
  
  return { symbols, multiplier };
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Get or create user by Telegram ID
  app.post("/api/users/telegram", async (req, res) => {
    try {
      const schema = z.object({
        telegramId: z.string(),
        username: z.string().optional(),
        firstName: z.string().optional(),
        lastName: z.string().optional(),
        photoUrl: z.string().optional(),
      });
      
      const data = schema.parse(req.body);
      
      let user = await storage.getUserByTelegramId(data.telegramId);
      
      if (!user) {
        user = await storage.createUser({
          telegramId: data.telegramId,
          username: data.username || null,
          firstName: data.firstName || null,
          lastName: data.lastName || null,
          photoUrl: data.photoUrl || null,
          balance: 1,
        });
      }
      
      res.json(user);
    } catch (error) {
      res.status(400).json({ error: "Invalid request" });
    }
  });

  // Get user by ID
  app.get("/api/users/:id", async (req, res) => {
    const user = await storage.getUser(req.params.id);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    res.json(user);
  });

  // Delete user account (admin only)
  app.delete("/api/admin/users/:id", async (req, res) => {
    try {
      const adminId = req.headers["x-admin-id"] as string;
      if (!adminId) {
        return res.status(401).json({ error: "Admin authorization required" });
      }
      
      const admin = await storage.getUser(adminId);
      if (!admin || (!admin.isAdmin && admin.username !== "Nahalist")) {
        return res.status(403).json({ error: "Admin access required" });
      }
      
      const user = await storage.getUser(req.params.id);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      
      const success = await storage.deleteUser(req.params.id);
      if (success) {
        res.json({ success: true, message: "User deleted successfully" });
      } else {
        res.status(500).json({ error: "Failed to delete user" });
      }
    } catch (error) {
      res.status(500).json({ error: "Failed to delete user" });
    }
  });

  // Update user balance
  app.patch("/api/users/:id/balance", async (req, res) => {
    try {
      const schema = z.object({
        balance: z.number().min(0),
      });
      
      const data = schema.parse(req.body);
      const user = await storage.updateUserBalance(req.params.id, data.balance);
      
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      
      res.json(user);
    } catch (error) {
      res.status(400).json({ error: "Invalid request" });
    }
  });

  // Generate referral code for user
  app.post("/api/users/:id/referral-code", async (req, res) => {
    try {
      const user = await storage.getUser(req.params.id);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      
      if (user.referralCode) {
        return res.json({ referralCode: user.referralCode });
      }
      
      const code = `REF${user.telegramId.slice(-6).toUpperCase()}${Date.now().toString(36).slice(-4).toUpperCase()}`;
      const updatedUser = await storage.updateUserReferralCode(user.id, code);
      
      res.json({ referralCode: code, user: updatedUser });
    } catch (error) {
      res.status(400).json({ error: "Failed to generate referral code" });
    }
  });

  // Apply referral code
  app.post("/api/users/:id/apply-referral", async (req, res) => {
    try {
      const schema = z.object({
        referralCode: z.string(),
      });
      
      const data = schema.parse(req.body);
      const user = await storage.getUser(req.params.id);
      
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      
      if (user.referredBy) {
        return res.status(400).json({ error: "Already used a referral code" });
      }
      
      const referrer = await storage.getUserByReferralCode(data.referralCode);
      
      if (!referrer) {
        return res.status(404).json({ error: "Invalid referral code" });
      }
      
      if (referrer.id === user.id) {
        return res.status(400).json({ error: "Cannot use your own referral code" });
      }
      
      // Give bonus to new user ($5) and referrer ($5)
      const bonusAmount = 5;
      const referrerBonus = 5;
      
      await storage.updateUserBalance(user.id, user.balance + bonusAmount);
      await storage.updateUserBalance(referrer.id, referrer.balance + referrerBonus);
      await storage.incrementReferralCount(referrer.id);
      
      // Update user's referredBy field
      const updatedUser = await storage.getUser(user.id);
      
      res.json({ 
        success: true, 
        bonus: bonusAmount,
        message: `You received $${bonusAmount} bonus!`,
        user: updatedUser
      });
    } catch (error) {
      res.status(400).json({ error: "Failed to apply referral code" });
    }
  });

  // Get user referral stats
  app.get("/api/users/:id/referral-stats", async (req, res) => {
    try {
      const user = await storage.getUser(req.params.id);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      
      res.json({
        referralCode: user.referralCode,
        referralCount: user.referralCount || 0,
        referralBalance: user.referralBalance || 0, // Pending referral earnings
        totalEarned: (user.referralCount || 0) * 5,
      });
    } catch (error) {
      res.status(400).json({ error: "Failed to get referral stats" });
    }
  });

  // Withdraw referral balance to main balance (requires $50 minimum)
  app.post("/api/users/:id/withdraw-referral", async (req, res) => {
    try {
      const user = await storage.getUser(req.params.id);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      
      const result = await storage.withdrawReferralBalance(req.params.id);
      
      if (!result.success) {
        return res.status(400).json({ 
          error: result.error,
          errorRu: `Минимум $50 для вывода. Текущий баланс: $${(user.referralBalance || 0).toFixed(2)}`
        });
      }
      
      res.json({ 
        success: true, 
        newBalance: result.newBalance,
        newReferralBalance: result.newReferralBalance,
        message: "Referral balance transferred to main balance",
        messageRu: "Реферальный баланс переведён на основной счёт"
      });
    } catch (error) {
      res.status(400).json({ error: "Failed to withdraw referral balance" });
    }
  });

  // Get games config
  app.get("/api/games", (req, res) => {
    res.json(gamesConfig);
  });

  // Play Crash game - start and deduct bet
  app.post("/api/games/crash/start", async (req, res) => {
    try {
      const schema = z.object({
        odejs: z.string(),
        amount: z.number().min(0.10),
        currency: z.enum(["usd", "stars"]).optional().default("usd"),
      });
      
      const data = schema.parse(req.body);
      const currency = data.currency;
      
      // Get user and validate balance
      const user = await storage.getUser(data.odejs);
      const currentBalance = await storage.getUserBalance(data.odejs, currency);
      if (!user || currentBalance < data.amount) {
        return res.status(400).json({ error: "Insufficient balance" });
      }
      
      // Deduct bet amount immediately
      const newBalance = currentBalance - data.amount;
      await storage.setUserBalance(data.odejs, newBalance, currency);
      
      // Check admin-controlled win rate to determine crash point
      const playerShouldWin = await shouldPlayerWin();
      let crashPoint: number;
      
      if (playerShouldWin) {
        // Generate crash point between 1.5 and 10.0 for potential win
        crashPoint = Math.floor((1.5 + Math.random() * 8.5) * 100) / 100;
      } else {
        // Generate low crash point (1.0 to 1.5)
        crashPoint = Math.floor((1.0 + Math.random() * 0.5) * 100) / 100;
      }
      
      res.json({
        crashPoint,
        gameId: `crash_${Date.now()}`,
        newBalance,
      });
    } catch (error) {
      res.status(400).json({ error: "Invalid request" });
    }
  });

  // Crash game - cashout
  app.post("/api/games/crash/cashout", async (req, res) => {
    try {
      const schema = z.object({
        odejs: z.string(),
        betAmount: z.number().min(0.10),
        multiplier: z.number().min(0.01),
        currency: z.enum(["usd", "stars"]).optional().default("usd"),
      });
      
      const data = schema.parse(req.body);
      const currency = data.currency;
      
      const user = await storage.getUser(data.odejs);
      if (!user) {
        return res.status(400).json({ error: "User not found" });
      }
      
      let payout = data.betAmount * data.multiplier;
      
      // Apply win limiting to prevent big wins
      if (payout > 0) {
        payout = await applyWinLimit(data.odejs, data.betAmount, payout, "crash");
      }
      
      const currentBalance = await storage.getUserBalance(data.odejs, currency);
      const newBalance = currentBalance + payout;
      await storage.setUserBalance(data.odejs, newBalance, currency);
      
      // Record bet with actual (capped) multiplier
      const actualMultiplier = payout / data.betAmount;
      await storage.createBet({
        odejs: data.odejs,
        gameType: "crash",
        amount: data.betAmount,
        multiplier: actualMultiplier,
        payout,
        isWin: true,
        gameData: JSON.stringify({ requestedMultiplier: data.multiplier, actualMultiplier }),
      });
      
      // Broadcast to all players
      await broadcastBetResult(data.odejs, "crash", data.betAmount, payout, true);
      
      res.json({ success: true, payout, newBalance });
    } catch (error) {
      res.status(400).json({ error: "Invalid request" });
    }
  });

  // Crash game - crashed (lost)
  app.post("/api/games/crash/crashed", async (req, res) => {
    try {
      const schema = z.object({
        odejs: z.string(),
        betAmount: z.number().min(0.10),
        crashPoint: z.number(),
        currency: z.enum(["usd", "stars"]).optional().default("usd"),
      });
      
      const data = schema.parse(req.body);
      
      // Record losing bet
      await storage.createBet({
        odejs: data.odejs,
        gameType: "crash",
        amount: data.betAmount,
        multiplier: 0,
        payout: 0,
        isWin: false,
        gameData: JSON.stringify({ crashPoint: data.crashPoint }),
      });
      
      // Process 15% referral commission on loss
      await storage.processReferralCommission(data.odejs, data.betAmount);
      
      // Broadcast to all players
      await broadcastBetResult(data.odejs, "crash", data.betAmount, 0, false);
      
      res.json({ success: true });
    } catch (error) {
      res.status(400).json({ error: "Invalid request" });
    }
  });

  // In-memory storage for active AviaMasters games (for security validation)
  const activeAviaGames = new Map<string, {
    odejs: string;
    betAmount: number;
    gameId: string;
    success: boolean;
    finalMultiplier: number;
    crashPoint: number;
    collectibles: Array<{x: number; y: number; type: string; value: number}>;
    createdAt: number;
    currency: "usd" | "stars";
  }>();

  // Clean up old games (older than 5 minutes)
  setInterval(() => {
    const now = Date.now();
    Array.from(activeAviaGames.entries()).forEach(([gameId, game]) => {
      if (now - game.createdAt > 5 * 60 * 1000) {
        activeAviaGames.delete(gameId);
      }
    });
  }, 60000);

  // Play AviaMasters game - start flight (server controls all outcomes)
  // Security model: Server determines win/loss and payout at start.
  // Client animation is cosmetic - actual outcome is predetermined.
  // Rate limiting via bet cost - each attempt costs money.
  app.post("/api/games/aviamasters/start", async (req, res) => {
    try {
      const schema = z.object({
        odejs: z.string(),
        amount: z.number().min(0.10),
        currency: z.enum(["usd", "stars"]).optional().default("usd"),
      });
      
      const data = schema.parse(req.body);
      const currency = data.currency;
      
      // Prevent duplicate active games for same user (anti-exploit)
      Array.from(activeAviaGames.entries()).forEach(([gameId, game]) => {
        if (game.odejs === data.odejs) {
          activeAviaGames.delete(gameId);
        }
      });
      
      const user = await storage.getUser(data.odejs);
      const currentBalance = await storage.getUserBalance(data.odejs, currency);
      if (!user || currentBalance < data.amount) {
        return res.status(400).json({ error: "Insufficient balance" });
      }
      
      const newBalance = currentBalance - data.amount;
      await storage.setUserBalance(data.odejs, newBalance, currency);
      
      // Server-controlled outcome based on admin win rate
      const playerShouldWin = await shouldPlayerWin();
      
      // Generate collectibles (server-side RNG)
      const collectibles: Array<{x: number; y: number; type: string; value: number}> = [];
      const numCollectibles = 8 + Math.floor(Math.random() * 12);
      
      for (let i = 0; i < numCollectibles; i++) {
        const x = 0.15 + (i / numCollectibles) * 0.7;
        const y = 0.2 + Math.random() * 0.5;
        
        const typeRng = Math.random();
        let type: string;
        let value: number;
        
        if (typeRng < 0.15) {
          type = "rocket";
          value = 0.5; // Halves balance
        } else if (typeRng < 0.4) {
          type = "multiply";
          const multValues = [2, 3, 4, 5];
          value = multValues[Math.floor(Math.random() * multValues.length)];
        } else {
          type = "add";
          const addValues = [1, 2, 5, 10];
          value = addValues[Math.floor(Math.random() * addValues.length)];
        }
        
        collectibles.push({ x, y, type, value });
      }
      
      // Calculate final multiplier server-side
      let finalMult = 1.0;
      collectibles.forEach(c => {
        if (c.type === "add") finalMult += c.value * 0.1;
        else if (c.type === "multiply") finalMult *= (1 + c.value * 0.1);
        else if (c.type === "rocket") finalMult *= c.value;
      });
      
      // Cap at 250x max
      finalMult = Math.min(finalMult, 250);
      
      // If player should lose, set multiplier to 0 (crash)
      const success = playerShouldWin;
      
      // Crash point - where the plane will crash (0.0 to 1.0 of flight progress)
      // Only used if success = false
      const crashPoint = success ? 1.0 : 0.2 + Math.random() * 0.6; // Crash between 20% and 80% of flight
      
      if (!success) finalMult = 0;
      
      const gameId = `aviamasters_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // Store game state for validation on /end
      activeAviaGames.set(gameId, {
        odejs: data.odejs,
        betAmount: data.amount,
        gameId,
        success,
        finalMultiplier: Math.round(finalMult * 100) / 100,
        crashPoint,
        collectibles,
        createdAt: Date.now(),
        currency,
      });
      
      res.json({
        gameId,
        success, // Server tells client if landing will succeed
        multiplier: Math.round(finalMult * 100) / 100, // Server-calculated multiplier
        crashPoint, // Server tells client when to crash (if success=false)
        collectibles, // Server provides collectible positions
        newBalance,
      });
    } catch (error) {
      res.status(400).json({ error: "Invalid request" });
    }
  });

  // AviaMasters game - end flight (validates against server state)
  app.post("/api/games/aviamasters/end", async (req, res) => {
    try {
      const schema = z.object({
        odejs: z.string(),
        gameId: z.string(),
      });
      
      const data = schema.parse(req.body);
      
      // Validate game exists and belongs to user
      const gameState = activeAviaGames.get(data.gameId);
      if (!gameState) {
        return res.status(400).json({ error: "Invalid or expired game" });
      }
      
      if (gameState.odejs !== data.odejs) {
        return res.status(400).json({ error: "Game does not belong to user" });
      }
      
      // Remove game from active games (prevent replay)
      activeAviaGames.delete(data.gameId);
      
      const user = await storage.getUser(data.odejs);
      if (!user) {
        return res.status(400).json({ error: "User not found" });
      }
      
      // Use server-stored outcome (cannot be manipulated by client)
      const currency = gameState.currency;
      const currentBalance = await storage.getUserBalance(data.odejs, currency);
      
      if (gameState.success && gameState.finalMultiplier > 0) {
        const payout = gameState.betAmount * gameState.finalMultiplier;
        const newBalance = currentBalance + payout;
        await storage.setUserBalance(data.odejs, newBalance, currency);
        
        await storage.createBet({
          odejs: data.odejs,
          gameType: "aviamasters",
          amount: gameState.betAmount,
          multiplier: gameState.finalMultiplier,
          payout,
          isWin: true,
          gameData: JSON.stringify({ 
            multiplier: gameState.finalMultiplier,
            collectibles: gameState.collectibles.length
          }),
        });
        
        await broadcastBetResult(data.odejs, "aviamasters", gameState.betAmount, payout, true);
        
        res.json({ 
          success: true, 
          won: true,
          payout, 
          multiplier: gameState.finalMultiplier,
          newBalance 
        });
      } else {
        await storage.createBet({
          odejs: data.odejs,
          gameType: "aviamasters",
          amount: gameState.betAmount,
          multiplier: 0,
          payout: 0,
          isWin: false,
          gameData: JSON.stringify({ crashed: true }),
        });
        
        await storage.processReferralCommission(data.odejs, gameState.betAmount);
        await broadcastBetResult(data.odejs, "aviamasters", gameState.betAmount, 0, false);
        
        res.json({ 
          success: true, 
          won: false,
          payout: 0, 
          multiplier: 0,
          newBalance: currentBalance 
        });
      }
    } catch (error) {
      res.status(400).json({ error: "Invalid request" });
    }
  });

  // Play Mines game - start and deduct bet
  app.post("/api/games/mines/start", async (req, res) => {
    try {
      const schema = z.object({
        odejs: z.string(),
        amount: z.number().min(0.10),
        minesCount: z.number().min(1).max(24),
        currency: z.enum(["usd", "stars"]).optional().default("usd"),
      });
      
      const data = schema.parse(req.body);
      const currency = data.currency;
      
      // Get user and validate balance
      const user = await storage.getUser(data.odejs);
      const currentBalance = await storage.getUserBalance(data.odejs, currency);
      if (!user || currentBalance < data.amount) {
        return res.status(400).json({ error: "Insufficient balance" });
      }
      
      // Deduct bet amount immediately
      const newBalance = currentBalance - data.amount;
      await storage.setUserBalance(data.odejs, newBalance, currency);
      
      const minePositions = generateMinePositions(25, data.minesCount);
      
      res.json({
        gameId: `mines_${Date.now()}`,
        minePositions,
        newBalance,
      });
    } catch (error) {
      res.status(400).json({ error: "Invalid request" });
    }
  });

  // Mines game - cashout
  app.post("/api/games/mines/cashout", async (req, res) => {
    try {
      const schema = z.object({
        odejs: z.string(),
        betAmount: z.number().min(0.10),
        multiplier: z.number().min(0.01),
        revealedCount: z.number().min(1),
        currency: z.enum(["usd", "stars"]).optional().default("usd"),
      });
      
      const data = schema.parse(req.body);
      const currency = data.currency;
      
      const user = await storage.getUser(data.odejs);
      if (!user) {
        return res.status(400).json({ error: "User not found" });
      }
      
      let payout = data.betAmount * data.multiplier;
      
      // Apply win limiting to prevent big wins
      if (payout > 0) {
        payout = await applyWinLimit(data.odejs, data.betAmount, payout, "mines");
      }
      
      const currentBalance = await storage.getUserBalance(data.odejs, currency);
      const newBalance = currentBalance + payout;
      await storage.setUserBalance(data.odejs, newBalance, currency);
      
      // Record bet with actual (capped) multiplier
      const actualMultiplier = payout / data.betAmount;
      await storage.createBet({
        odejs: data.odejs,
        gameType: "mines",
        amount: data.betAmount,
        multiplier: actualMultiplier,
        payout,
        isWin: true,
        gameData: JSON.stringify({ revealed: data.revealedCount, requestedMultiplier: data.multiplier, actualMultiplier }),
      });
      
      // Broadcast to all players
      await broadcastBetResult(data.odejs, "mines", data.betAmount, payout, true);
      
      res.json({ success: true, payout, newBalance });
    } catch (error) {
      res.status(400).json({ error: "Invalid request" });
    }
  });

  // Mines game - hit mine (lost)
  app.post("/api/games/mines/lost", async (req, res) => {
    try {
      const schema = z.object({
        odejs: z.string(),
        betAmount: z.number().min(0.10),
        revealedCount: z.number(),
        currency: z.enum(["usd", "stars"]).optional().default("usd"),
      });
      
      const data = schema.parse(req.body);
      
      // Record losing bet
      await storage.createBet({
        odejs: data.odejs,
        gameType: "mines",
        amount: data.betAmount,
        multiplier: 0,
        payout: 0,
        isWin: false,
        gameData: JSON.stringify({ revealed: data.revealedCount }),
      });
      
      // Process 15% referral commission on loss
      await storage.processReferralCommission(data.odejs, data.betAmount);
      
      // Broadcast to all players
      await broadcastBetResult(data.odejs, "mines", data.betAmount, 0, false);
      
      res.json({ success: true });
    } catch (error) {
      res.status(400).json({ error: "Invalid request" });
    }
  });

  app.post("/api/games/mines/reveal", async (req, res) => {
    try {
      const schema = z.object({
        gameId: z.string(),
        cellIndex: z.number().min(0).max(24),
        minePositions: z.array(z.number()),
        revealedCount: z.number(),
      });
      
      const data = schema.parse(req.body);
      const isMine = data.minePositions.includes(data.cellIndex);
      const multiplier = calculateMinesMultiplier(
        data.revealedCount + (isMine ? 0 : 1),
        data.minePositions.length
      );
      
      res.json({
        isMine,
        multiplier,
      });
    } catch (error) {
      res.status(400).json({ error: "Invalid request" });
    }
  });

  // Play Dice game
  app.post("/api/games/dice/roll", async (req, res) => {
    try {
      console.log("Dice roll request body:", JSON.stringify(req.body));
      
      const schema = z.object({
        odejs: z.string(),
        amount: z.number().min(0.10),
        target: z.number().min(2).max(98),
        isOver: z.boolean(),
        currency: z.enum(["usd", "stars"]).optional().default("usd"),
      });
      
      const data = schema.parse(req.body);
      const currency = data.currency;
      console.log("Dice roll parsed data:", JSON.stringify(data));
      
      // Get user and validate balance
      const user = await storage.getUser(data.odejs);
      const currentBalance = await storage.getUserBalance(data.odejs, currency);
      console.log("User found:", user ? JSON.stringify(user) : "null");
      if (!user || currentBalance < data.amount) {
        console.log("User validation failed:", !user ? "no user" : "insufficient balance");
        return res.status(400).json({ error: "Insufficient balance" });
      }
      
      // Check admin-controlled win rate
      const playerShouldWin = await shouldPlayerWin();
      
      // Generate roll that matches the desired outcome with safe boundary handling
      let roll: number;
      const safeTarget = Math.max(2, Math.min(98, data.target)); // Ensure valid range
      
      if (playerShouldWin) {
        // Generate winning roll
        if (data.isOver) {
          const winRange = 100 - safeTarget;
          roll = winRange > 0 ? Math.floor(Math.random() * winRange) + safeTarget + 1 : safeTarget + 1;
        } else {
          const winRange = safeTarget - 1;
          roll = winRange > 0 ? Math.floor(Math.random() * winRange) + 1 : 1;
        }
      } else {
        // Generate losing roll
        if (data.isOver) {
          roll = Math.floor(Math.random() * safeTarget) + 1;
        } else {
          const loseRange = 100 - safeTarget;
          roll = loseRange > 0 ? Math.floor(Math.random() * loseRange) + safeTarget + 1 : 100;
        }
      }
      
      // Clamp roll to valid range
      roll = Math.max(1, Math.min(100, roll));
      
      const isWin = data.isOver ? roll > data.target : roll < data.target;
      const multiplier = calculateDiceMultiplier(data.target, data.isOver);
      let payout = isWin ? data.amount * multiplier : 0;
      
      // Apply win limiting to prevent big wins
      if (payout > 0) {
        payout = await applyWinLimit(data.odejs, data.amount, payout, "dice");
      }
      
      // Update balance in database
      const newBalance = currentBalance - data.amount + payout;
      await storage.setUserBalance(data.odejs, newBalance, currency);
      
      // Record bet
      await storage.createBet({
        odejs: data.odejs,
        gameType: "dice",
        amount: data.amount,
        multiplier: isWin ? multiplier : 0,
        payout,
        isWin,
        gameData: JSON.stringify({ roll, target: data.target, isOver: data.isOver }),
      });
      
      // Process 15% referral commission on loss
      if (!isWin) {
        await storage.processReferralCommission(data.odejs, data.amount);
      }
      
      // Broadcast to all players
      await broadcastBetResult(data.odejs, "dice", data.amount, payout, isWin);
      
      console.log("Dice roll complete, sending response");
      res.json({
        roll,
        isWin,
        multiplier: isWin ? multiplier : 0,
        payout,
        newBalance,
      });
    } catch (error) {
      console.error("Dice roll error:", error);
      res.status(400).json({ error: "Invalid request" });
    }
  });

  // Play Slots game
  app.post("/api/games/slots/spin", async (req, res) => {
    try {
      const schema = z.object({
        odejs: z.string(),
        amount: z.number().min(0.10),
        currency: z.enum(["usd", "stars"]).optional().default("usd"),
      });
      
      const data = schema.parse(req.body);
      const currency = data.currency;
      
      // Get user and validate balance
      const user = await storage.getUser(data.odejs);
      const currentBalance = await storage.getUserBalance(data.odejs, currency);
      if (!user || currentBalance < data.amount) {
        return res.status(400).json({ error: "Insufficient balance" });
      }
      
      // Check admin-controlled win rate
      const playerShouldWin = await shouldPlayerWin();
      
      let result;
      if (playerShouldWin) {
        // Generate winning spin (at least two matching symbols)
        const winSymbol = Math.floor(Math.random() * 6);
        const symbols = [winSymbol, winSymbol, winSymbol]; // Triple match for guaranteed win
        const multipliers = [2, 3, 4, 5, 10, 25];
        result = { symbols, multiplier: multipliers[winSymbol] };
      } else {
        // Generate losing spin (all different symbols)
        const s1 = Math.floor(Math.random() * 6);
        let s2 = (s1 + 1 + Math.floor(Math.random() * 5)) % 6;
        let s3 = (s2 + 1 + Math.floor(Math.random() * 4)) % 6;
        if (s3 === s1) s3 = (s3 + 1) % 6;
        result = { symbols: [s1, s2, s3], multiplier: 0 };
      }
      
      const isWin = result.multiplier > 0;
      let payout = isWin ? data.amount * result.multiplier : 0;
      
      // Apply win limiting to prevent big wins
      if (payout > 0) {
        payout = await applyWinLimit(data.odejs, data.amount, payout, "slots");
      }
      
      // Update balance in database
      const newBalance = currentBalance - data.amount + payout;
      await storage.setUserBalance(data.odejs, newBalance, currency);
      
      // Record bet
      await storage.createBet({
        odejs: data.odejs,
        gameType: "slots",
        amount: data.amount,
        multiplier: result.multiplier,
        payout,
        isWin,
        gameData: JSON.stringify(result),
      });
      
      // Process 15% referral commission on loss
      if (!isWin) {
        await storage.processReferralCommission(data.odejs, data.amount);
      }
      
      // Broadcast to all players
      await broadcastBetResult(data.odejs, "slots", data.amount, payout, isWin);
      
      res.json({
        symbols: result.symbols,
        isWin,
        multiplier: result.multiplier,
        payout,
        newBalance,
      });
    } catch (error) {
      res.status(400).json({ error: "Invalid request" });
    }
  });

  // The Luxe slot game - Premium 5x4 grid with golden frames and jackpots
  app.post("/api/games/luxe/spin", async (req, res) => {
    try {
      const schema = z.object({
        userId: z.string(),
        amount: z.number().min(0.10),
        isBonusSpin: z.boolean().optional().default(false),
        stickyFrames: z.array(z.any()).optional().default([]),
        currency: z.enum(["usd", "stars"]).optional().default("usd"),
      });
      
      const data = schema.parse(req.body);
      const currency = data.currency;
      
      const user = await storage.getUser(data.userId);
      if (!user) {
        return res.status(400).json({ error: "User not found" });
      }
      
      const currentBalance = await storage.getUserBalance(data.userId, currency);
      if (!data.isBonusSpin && currentBalance < data.amount) {
        return res.status(400).json({ error: "Insufficient balance" });
      }
      
      // Use Luxe-specific RTP instead of global win rate
      const playerShouldWin = await shouldLuxePlayerWin();
      
      const ROWS = 4;
      const COLS = 5;
      const REGULAR_SYMBOL_COUNT = 9;
      const WILD_INDEX = 9;
      const SCATTER_INDEX = 10;
      const MULTIPLIERS = [2, 3, 4, 5, 6, 7, 8, 9, 10, 25, 50, 100];
      const JACKPOTS = [25, 100, 500, 20000];
      // Symbol payouts as multipliers of bet amount (based on $1 bet reference)
      // Format: [1-match, 2-match, 3-match, 4-match, 5-match]
      // REDUCED BY 10x to prevent excessive wins
      const SYMBOL_PAYOUTS = [
        [0, 0, 0.02, 0.05, 0.10],      // diamond_suit
        [0, 0, 0.02, 0.05, 0.10],      // club_suit
        [0, 0, 0.02, 0.05, 0.10],      // spade_suit
        [0, 0, 0.02, 0.05, 0.10],      // heart_suit
        [0, 0, 0.05, 0.20, 0.50],      // dice
        [0, 0, 0.10, 0.50, 1.50],      // chips
        [0, 0, 0.20, 1.00, 2.50],      // cards
        [0, 0, 1.00, 3.00, 10.00],     // crown
        [0, 0, 2.00, 5.00, 20.00],     // gem
        [0, 0, 2.00, 5.00, 20.00],     // wild (same as gem)
        [0, 0, 0, 0, 0],               // scatter (no payline payout)
      ];
      
      // Get current RTP for conditional multiplier access
      const currentRtp = await getLuxeRtp();
      const allowHighMultipliers = currentRtp >= 0.80; // Only allow 40x+ when RTP >= 80%
      
      // Weighted multiplier selection - high multipliers ONLY when RTP > 80%
      const getWeightedMultiplier = (maxMultiplier: number = 100): number => {
        // Cap multiplier based on RTP setting
        let effectiveMax = maxMultiplier;
        if (!allowHighMultipliers) {
          effectiveMax = Math.min(maxMultiplier, 10); // Cap at 10x unless RTP > 80%
        }
        
        const roll = Math.random();
        
        // High multipliers only available when RTP > 80%
        if (allowHighMultipliers && effectiveMax >= 100) {
          if (roll < 0.0003) return 100;     // 0.03% - 100x (extremely rare)
          if (roll < 0.0006) return 50;      // 0.03% - 50x
          if (roll < 0.002) return 25;       // 0.14% - 25x  
        }
        
        // Normal multipliers (always available up to effectiveMax)
        if (effectiveMax >= 10 && roll < 0.015) return 10;  // 1.5% - 10x
        if (effectiveMax >= 9 && roll < 0.04) return 9;     // 2.5% - 9x
        if (effectiveMax >= 8 && roll < 0.08) return 8;     // 4% - 8x
        if (effectiveMax >= 7 && roll < 0.15) return 7;     // 7% - 7x
        if (effectiveMax >= 6 && roll < 0.25) return 6;     // 10% - 6x
        if (roll < 0.40) return 5;         // 15% - 5x
        if (roll < 0.55) return 4;         // 15% - 4x
        if (roll < 0.75) return 3;         // 20% - 3x
        return 2;                          // 25% - 2x
      };
      
      // For regular bonus: max 6x multiplier, random positions
      const getRegularBonusMultiplier = (): number => {
        const roll = Math.random();
        if (roll < 0.10) return 6;    // 10% - 6x (max)
        if (roll < 0.25) return 5;    // 15% - 5x
        if (roll < 0.45) return 4;    // 20% - 4x
        if (roll < 0.70) return 3;    // 25% - 3x
        return 2;                     // 30% - 2x
      };
      
      // Bonus mode profit control - only 1 in 3 bonuses should be profitable
      const bonusSpinShouldWin = (): boolean => {
        return Math.random() < 0.33; // 33% of bonus spins are winning
      };
      
      // FRAME_SPAWN_RATE reduced from 35% to 15%
      const FRAME_SPAWN_RATE = 0.15;
      
      const PAYLINES = [
        [[0,0],[0,1],[0,2],[0,3],[0,4]],
        [[1,0],[1,1],[1,2],[1,3],[1,4]],
        [[2,0],[2,1],[2,2],[2,3],[2,4]],
        [[3,0],[3,1],[3,2],[3,3],[3,4]],
        [[0,0],[1,1],[2,2],[1,3],[0,4]],
        [[3,0],[2,1],[1,2],[2,3],[3,4]],
        [[0,0],[0,1],[1,2],[0,3],[0,4]],
        [[3,0],[3,1],[2,2],[3,3],[3,4]],
        [[1,0],[0,1],[0,2],[0,3],[1,4]],
        [[2,0],[3,1],[3,2],[3,3],[2,4]],
        [[1,0],[2,1],[3,2],[2,3],[1,4]],
        [[2,0],[1,1],[0,2],[1,3],[2,4]],
        [[0,0],[1,1],[1,2],[1,3],[0,4]],
        [[3,0],[2,1],[2,2],[2,3],[3,4]],
      ];
      
      const grid: any[][] = [];
      let totalFrameMultiplier = 0;
      let totalJackpotValue = 0;
      const winningCells: string[] = [];
      const winningPaylines: { symbolIndex: number; matchCount: number; payout: number }[] = [];
      
      const SYMBOL_NAMES = ["diamond_suit", "club_suit", "spade_suit", "heart_suit", "dice", "chips", "cards", "crown", "gem", "wild", "scatter"];
      
      // Weighted jackpot selection - jackpots are very rare
      const getRandomJackpotIndex = (): number => {
        const roll = Math.random();
        if (roll < 0.60) return 0;      // MINI - 60% of jackpots
        if (roll < 0.90) return 1;      // MAJOR - 30% of jackpots
        if (roll < 0.99) return 2;      // MEGA - 9% of jackpots
        return 3;                        // MAXWIN - 1% of jackpots
      };
      
      // Apply sticky frames from bonus mode BEFORE generating grid
      const stickyFrameMap: Map<string, any> = new Map();
      if (data.stickyFrames && data.stickyFrames.length > 0) {
        for (const frame of data.stickyFrames) {
          stickyFrameMap.set(`${frame.row}-${frame.col}`, frame);
        }
      }
      
      const getRandomSymbol = (includeWild: boolean = false, includeScatter: boolean = false): number => {
        const rand = Math.random();
        if (includeScatter && rand < 0.02) {
          return SCATTER_INDEX;
        }
        if (includeWild && rand < 0.05) {
          return WILD_INDEX;
        }
        return Math.floor(Math.random() * REGULAR_SYMBOL_COUNT);
      };
      
      if (playerShouldWin) {
        const winSymbol = Math.floor(Math.random() * REGULAR_SYMBOL_COUNT);
        const winLength = 3 + Math.floor(Math.random() * 3);
        const winPayline = Math.floor(Math.random() * PAYLINES.length);
        
        for (let row = 0; row < ROWS; row++) {
          const rowData: any[] = [];
          for (let col = 0; col < COLS; col++) {
            const shouldBeWinSymbol = PAYLINES[winPayline].slice(0, winLength).some(([r, c]) => r === row && c === col);
            
            const symbolIndex = shouldBeWinSymbol ? winSymbol : getRandomSymbol(true, true);
            const cellKey = `${row}-${col}`;
            const stickyFrame = stickyFrameMap.get(cellKey);
            
            let hasFrame = false;
            let frameType: string | null = null;
            let frameValue = 0;
            let jackpotIndex = -1;
            
            // Apply sticky frame from bonus mode if exists
            if (stickyFrame) {
              hasFrame = true;
              frameType = stickyFrame.type;
              frameValue = stickyFrame.value;
              if (frameType === "multiplier") {
                totalFrameMultiplier += frameValue;
              } else if (frameType === "jackpot") {
                totalJackpotValue += frameValue;
                jackpotIndex = JACKPOTS.indexOf(frameValue);
              }
            } else if (Math.random() < FRAME_SPAWN_RATE) {
              hasFrame = true;
              const jackpotRoll = Math.random();
              // Jackpots only available when RTP >= 80%
              if (allowHighMultipliers && jackpotRoll < 0.005) {
                // 0.5% chance for jackpot frame (EXTREMELY rare, only with high RTP)
                frameType = "jackpot";
                const jpRoll = Math.random();
                if (jpRoll < 0.70) {
                  jackpotIndex = 0; // MINI - 70% of jackpots
                } else if (jpRoll < 0.95) {
                  jackpotIndex = 1; // MAJOR - 25% of jackpots
                } else if (jpRoll < 0.995) {
                  jackpotIndex = 2; // MEGA - 4.5% of jackpots
                } else {
                  jackpotIndex = 3; // MAXWIN - 0.5% of jackpots
                }
                frameValue = JACKPOTS[jackpotIndex];
                totalJackpotValue += frameValue;
              } else {
                frameType = "multiplier";
                frameValue = getWeightedMultiplier();
                totalFrameMultiplier += frameValue;
              }
            }
            
            rowData.push({ symbolIndex, hasFrame, frameType, frameValue, jackpotIndex });
          }
          grid.push(rowData);
        }
      } else {
        // NON-WINNING spin - add near-miss effects
        // Pick a random payline and create 2 matching symbols (looks close to win but doesn't pay)
        const nearMissPayline = Math.floor(Math.random() * PAYLINES.length);
        const nearMissSymbol = Math.floor(Math.random() * REGULAR_SYMBOL_COUNT);
        const nearMissPositions = PAYLINES[nearMissPayline].slice(0, 2); // Only first 2 positions match
        
        for (let row = 0; row < ROWS; row++) {
          const rowData: any[] = [];
          for (let col = 0; col < COLS; col++) {
            // Check if this position should have the near-miss symbol
            const isNearMiss = nearMissPositions.some(([r, c]) => r === row && c === col);
            const symbolIndex = isNearMiss ? nearMissSymbol : getRandomSymbol(true, true);
            
            const cellKey = `${row}-${col}`;
            const stickyFrame = stickyFrameMap.get(cellKey);
            
            let hasFrame = false;
            let frameType: string | null = null;
            let frameValue = 0;
            let jackpotIndex = -1;
            
            // Apply sticky frame from bonus mode if exists
            if (stickyFrame) {
              hasFrame = true;
              frameType = stickyFrame.type;
              frameValue = stickyFrame.value;
              if (frameType === "multiplier") {
                totalFrameMultiplier += frameValue;
              } else if (frameType === "jackpot") {
                totalJackpotValue += frameValue;
                jackpotIndex = JACKPOTS.indexOf(frameValue);
              }
            } else if (Math.random() < FRAME_SPAWN_RATE) {
              hasFrame = true;
              const jackpotRoll = Math.random();
              // Jackpots only available when RTP >= 80%
              if (allowHighMultipliers && jackpotRoll < 0.005) {
                // 0.5% chance for jackpot frame (EXTREMELY rare, only with high RTP)
                frameType = "jackpot";
                const jpRoll = Math.random();
                if (jpRoll < 0.70) {
                  jackpotIndex = 0; // MINI - 70% of jackpots
                } else if (jpRoll < 0.95) {
                  jackpotIndex = 1; // MAJOR - 25% of jackpots
                } else if (jpRoll < 0.995) {
                  jackpotIndex = 2; // MEGA - 4.5% of jackpots
                } else {
                  jackpotIndex = 3; // MAXWIN - 0.5% of jackpots
                }
                frameValue = JACKPOTS[jackpotIndex];
                totalJackpotValue += frameValue;
              } else {
                frameType = "multiplier";
                // For non-winning spins, show high multipliers visually but they don't play
                // Only show near-miss high multipliers if RTP allows high multipliers
                if (allowHighMultipliers && Math.random() < 0.30) {
                  // 30% chance to show 50-100x frames on losing spins (psychological near-miss)
                  frameValue = Math.random() < 0.5 ? 50 : 100;
                } else {
                  // Use weighted multiplier (respects RTP cap of 10x when RTP < 80%)
                  frameValue = getWeightedMultiplier();
                }
                totalFrameMultiplier += frameValue;
              }
            }
            
            rowData.push({ symbolIndex, hasFrame, frameType, frameValue, jackpotIndex });
          }
          grid.push(rowData);
        }
      }
      
      let scatterCount = 0;
      const scatterPositions: { row: number; col: number }[] = [];
      for (let row = 0; row < ROWS; row++) {
        for (let col = 0; col < COLS; col++) {
          if (grid[row][col].symbolIndex === SCATTER_INDEX) {
            scatterCount++;
            scatterPositions.push({ row, col });
          }
        }
      }
      
      let bonusTrigger: string | null = null;
      let freeSpinsAwarded = 0;
      let initialStickyFrames: any[] = [];
      
      if (scatterCount >= 3) {
        if (scatterCount >= 5) {
          // Velvet Nights (Super Bonus): 5 scatters = 14 spins, only 3 frames with multipliers
          // Frames double (2x) once per winning spin - handled in frontend/bonus spin logic
          bonusTrigger = "velvet_nights";
          freeSpinsAwarded = 14;
          const usedPositions = new Set<string>();
          // Super bonus: ONLY 3 frames, NOT all 20!
          for (let i = 0; i < 3; i++) {
            let r, c, posKey;
            do {
              r = Math.floor(Math.random() * ROWS);
              c = Math.floor(Math.random() * COLS);
              posKey = `${r}-${c}`;
            } while (usedPositions.has(posKey));
            usedPositions.add(posKey);
            // Super bonus frames start at 2x and can double per winning spin
            const frameValue = 2;
            initialStickyFrames.push({ row: r, col: c, type: "multiplier", value: frameValue, canDouble: true });
          }
        } else if (scatterCount >= 4) {
          // Golden Hits (Regular Bonus): 4 scatters = 10 spins, 2 random frames with max 6x
          bonusTrigger = "golden_hits";
          freeSpinsAwarded = 10;
          const usedPositions = new Set<string>();
          // Regular bonus: MAX 2 frames with max 6x multiplier
          const frameCount = 2;
          for (let i = 0; i < frameCount; i++) {
            let r, c, posKey;
            do {
              r = Math.floor(Math.random() * ROWS);
              c = Math.floor(Math.random() * COLS);
              posKey = `${r}-${c}`;
            } while (usedPositions.has(posKey));
            usedPositions.add(posKey);
            // Max 6x multiplier for regular bonus
            const frameValue = getRegularBonusMultiplier();
            initialStickyFrames.push({ row: r, col: c, type: "multiplier", value: frameValue });
          }
        } else {
          // Black and Gold (Regular Bonus): 3 scatters = 10 spins, 1 random frame with max 6x
          bonusTrigger = "black_and_gold";
          freeSpinsAwarded = 10;
          // Regular bonus: MAX 2 frames (but 3 scatters = 1 frame)
          const r = Math.floor(Math.random() * ROWS);
          const c = Math.floor(Math.random() * COLS);
          // Max 6x multiplier for regular bonus
          const frameValue = getRegularBonusMultiplier();
          initialStickyFrames.push({ row: r, col: c, type: "multiplier", value: frameValue });
        }
      }
      
      let totalPayout = 0;
      
      for (let lineIdx = 0; lineIdx < PAYLINES.length; lineIdx++) {
        const line = PAYLINES[lineIdx];
        
        // Paylines are defined as [row, col] pairs, ordered from LEFT to RIGHT
        // line[0] is always at column 0 (leftmost), line[4] is at column 4 (rightmost)
        const firstCell = grid[line[0][0]][line[0][1]];
        let baseSymbol = firstCell.symbolIndex;
        
        // Skip if first symbol is SCATTER - scatters don't form payline wins
        if (baseSymbol === SCATTER_INDEX) {
          continue;
        }
        
        // If first symbol is WILD, find the first non-wild, non-scatter symbol
        if (baseSymbol === WILD_INDEX) {
          for (let i = 1; i < line.length; i++) {
            const [row, col] = line[i];
            const sym = grid[row][col].symbolIndex;
            if (sym !== WILD_INDEX && sym !== SCATTER_INDEX) {
              baseSymbol = sym;
              break;
            }
          }
        }
        
        // If baseSymbol is still WILD (all wilds line), use WILD payout
        // If baseSymbol became SCATTER somehow, skip this line
        if (baseSymbol === SCATTER_INDEX) {
          continue;
        }
        
        let matchCount = 1;
        let lineMultiplier = 0;
        const lineWinCells: string[] = [`${line[0][0]}-${line[0][1]}`];
        
        if (firstCell.hasFrame && firstCell.frameType === "multiplier") {
          lineMultiplier += firstCell.frameValue;
        }
        
        // Count matching symbols from left to right, stopping at first non-match
        for (let i = 1; i < line.length; i++) {
          const [row, col] = line[i];
          const cell = grid[row][col];
          
          // SCATTER never matches anything in paylines
          if (cell.symbolIndex === SCATTER_INDEX) {
            break;
          }
          
          // Match conditions:
          // 1. Same symbol as base symbol
          // 2. Current symbol is WILD (wild substitutes for base)
          // 3. Base is WILD and current is also WILD (all-wild line)
          // NOTE: If base is WILD, only other WILDs continue the match!
          let isMatch = false;
          if (baseSymbol === WILD_INDEX) {
            // All-wild line: only other wilds match
            isMatch = cell.symbolIndex === WILD_INDEX;
          } else {
            // Normal line: match same symbol or wild
            isMatch = cell.symbolIndex === baseSymbol || cell.symbolIndex === WILD_INDEX;
          }
          
          if (isMatch) {
            matchCount++;
            lineWinCells.push(`${row}-${col}`);
            if (cell.hasFrame && cell.frameType === "multiplier") {
              lineMultiplier += cell.frameValue;
            }
          } else {
            break; // Stop counting at first non-matching symbol (left-to-right rule)
          }
        }
        
        // Must have 3+ matching symbols for a win
        const payoutSymbol = baseSymbol === WILD_INDEX ? WILD_INDEX : baseSymbol;
        if (matchCount >= 3 && SYMBOL_PAYOUTS[payoutSymbol]) {
          const basePay = SYMBOL_PAYOUTS[payoutSymbol][matchCount - 1] * data.amount;
          const linePay = lineMultiplier > 0 ? basePay * lineMultiplier : basePay;
          
          // Add jackpot values only for cells in winning combinations
          let lineJackpot = 0;
          for (const cellKey of lineWinCells) {
            const [r, c] = cellKey.split('-').map(Number);
            const cell = grid[r][c];
            if (cell.hasFrame && cell.frameType === "jackpot") {
              lineJackpot += cell.frameValue * data.amount;
            }
          }
          
          totalPayout += linePay + lineJackpot;
          lineWinCells.forEach(cell => {
            if (!winningCells.includes(cell)) winningCells.push(cell);
          });
          winningPaylines.push({
            symbolIndex: payoutSymbol,
            matchCount,
            payout: Math.round((linePay + lineJackpot) * 100) / 100
          });
        }
      }
      
      // Sticky frames already applied during grid generation
      
      const isWin = totalPayout > 0;
      let payout = Math.round(totalPayout * 100) / 100;
      
      // Apply win limiting to prevent big wins
      if (payout > 0) {
        payout = await applyWinLimit(data.userId, data.amount, payout, "luxe");
      }
      
      const multiplier = isWin ? payout / data.amount : 0;
      
      // Super bonus (velvet_nights): Double frame multipliers ONCE per winning spin
      // On each winning spin, ALL frames with canDouble flag double their values
      // The canDouble flag marks this as a super bonus, frames keep doubling on each win
      // IMPORTANT: Respect RTP cap - when RTP < 80%, max frame value is 10x
      const maxFrameValue = allowHighMultipliers ? 1000 : 10; // Cap at 10x when RTP < 80%
      
      let updatedStickyFrames: any[] | null = null; // null means "no change, keep existing"
      if (data.isBonusSpin && isWin && data.stickyFrames && data.stickyFrames.length > 0) {
        // Check if this is a super bonus spin (velvet_nights has canDouble flag on any frame)
        const isSuperBonus = data.stickyFrames.some((f: any) => f.canDouble !== undefined);
        if (isSuperBonus) {
          // Double all frame values on this winning spin, but respect RTP cap
          updatedStickyFrames = data.stickyFrames.map((frame: any) => {
            const doubledValue = frame.value * 2;
            return {
              ...frame,
              value: Math.min(doubledValue, maxFrameValue), // Cap at 10x when RTP < 80%
            };
          });
        }
      }
      
      const betCost = data.isBonusSpin ? 0 : data.amount;
      const newBalance = currentBalance - betCost + payout;
      await storage.setUserBalance(data.userId, newBalance, currency);
      
      if (!data.isBonusSpin) {
        await storage.createBet({
          odejs: data.userId,
          gameType: "luxe",
          amount: data.amount,
          multiplier,
          payout,
          isWin,
          gameData: JSON.stringify({ grid, totalFrameMultiplier, totalJackpotValue }),
        });
        
        if (!isWin) {
          await storage.processReferralCommission(data.userId, data.amount);
        }
        
        await broadcastBetResult(data.userId, "luxe", data.amount, payout, isWin);
      }
      
      res.json({
        grid,
        isWin,
        multiplier: totalFrameMultiplier,
        payout,
        newBalance,
        winningCells,
        winningPaylines,
        scatterCount,
        scatterPositions,
        bonusTrigger,
        freeSpinsAwarded,
        initialStickyFrames,
        updatedStickyFrames: updatedStickyFrames, // null means "no change, keep existing frames"
        betAmount: data.amount,
      });
    } catch (error) {
      console.error("Luxe spin error:", error);
      res.status(400).json({ error: "Invalid request" });
    }
  });

  // The Luxe - Bonus Buy feature
  app.post("/api/games/luxe/buy-bonus", async (req, res) => {
    try {
      const schema = z.object({
        userId: z.string(),
        betAmount: z.number().min(0.10),
        bonusType: z.enum(["regular", "super"]),
        currency: z.enum(["usd", "stars"]).optional().default("usd"),
      });
      
      const data = schema.parse(req.body);
      const currency = data.currency;
      
      const user = await storage.getUser(data.userId);
      if (!user) {
        return res.status(400).json({ error: "User not found" });
      }
      
      const currentBalance = await storage.getUserBalance(data.userId, currency);
      
      // Regular bonus: 100x bet, Super bonus: 300x bet
      const multiplier = data.bonusType === "super" ? 300 : 100;
      const bonusCost = data.betAmount * multiplier;
      
      if (currentBalance < bonusCost) {
        return res.status(400).json({ error: "Insufficient balance", required: bonusCost });
      }
      
      // Deduct bonus cost from balance
      const newBalance = currentBalance - bonusCost;
      await storage.setUserBalance(data.userId, newBalance, currency);
      
      // Determine bonus mode based on type
      let bonusTrigger: string;
      let freeSpinsAwarded: number;
      let initialStickyFrames: any[] = [];
      
      const ROWS = 4;
      const COLS = 5;
      const JACKPOTS = [25, 100, 500, 20000];
      
      // Weighted jackpot selection - jackpots even rarer in bonus buy
      const getRandomJackpotIndex = (): number => {
        const roll = Math.random();
        if (roll < 0.70) return 0;      // MINI - 70% of jackpots
        if (roll < 0.95) return 1;      // MAJOR - 25% of jackpots
        if (roll < 0.995) return 2;     // MEGA - 4.5% of jackpots
        return 3;                        // MAXWIN - 0.5% of jackpots
      };
      
      // Weighted multiplier selection - high multipliers are EXTREMELY rare
      // For regular bonus: max 6x multiplier
      const getRegularBonusMultiplier = (): number => {
        const roll = Math.random();
        if (roll < 0.10) return 6;    // 10% - 6x (max)
        if (roll < 0.25) return 5;    // 15% - 5x
        if (roll < 0.45) return 4;    // 20% - 4x
        if (roll < 0.70) return 3;    // 25% - 3x
        return 2;                     // 30% - 2x
      };
      
      if (data.bonusType === "super") {
        // Super bonus (Velvet Nights): 14 spins, ONLY 3 frames with doubling mechanic
        bonusTrigger = "velvet_nights";
        freeSpinsAwarded = 14;
        const usedPositions = new Set<string>();
        // Super bonus: ONLY 3 frames that start at 2x and can double per winning spin
        for (let i = 0; i < 3; i++) {
          let r, c, posKey;
          do {
            r = Math.floor(Math.random() * ROWS);
            c = Math.floor(Math.random() * COLS);
            posKey = `${r}-${c}`;
          } while (usedPositions.has(posKey));
          usedPositions.add(posKey);
          // Super bonus frames start at 2x and can double once per winning spin
          initialStickyFrames.push({ row: r, col: c, type: "multiplier", value: 2, canDouble: true });
        }
      } else {
        // Regular bonus: Random between Black and Gold or Golden Hits
        const isGoldenHits = Math.random() < 0.5;
        if (isGoldenHits) {
          // Golden Hits = 10 spins, 2 random frames with max 6x
          bonusTrigger = "golden_hits";
          freeSpinsAwarded = 10;
          const usedPositions = new Set<string>();
          for (let i = 0; i < 2; i++) {
            let r, c, posKey;
            do {
              r = Math.floor(Math.random() * ROWS);
              c = Math.floor(Math.random() * COLS);
              posKey = `${r}-${c}`;
            } while (usedPositions.has(posKey));
            usedPositions.add(posKey);
            const frameValue = getRegularBonusMultiplier();
            initialStickyFrames.push({ row: r, col: c, type: "multiplier", value: frameValue });
          }
        } else {
          // Black and Gold = 10 spins, 1 random frame with max 6x
          bonusTrigger = "black_and_gold";
          freeSpinsAwarded = 10;
          const r = Math.floor(Math.random() * ROWS);
          const c = Math.floor(Math.random() * COLS);
          const frameValue = getRegularBonusMultiplier();
          initialStickyFrames.push({ row: r, col: c, type: "multiplier", value: frameValue });
        }
      }
      
      // Record the bonus purchase as a bet
      await storage.createBet({
        odejs: data.userId,
        gameType: "luxe_bonus",
        amount: bonusCost,
        multiplier: 0,
        payout: 0,
        isWin: false,
        gameData: JSON.stringify({ bonusType: data.bonusType, betAmount: data.betAmount }),
      });
      
      res.json({
        success: true,
        bonusCost,
        newBalance,
        bonusTrigger,
        freeSpinsAwarded,
        initialStickyFrames,
        betAmount: data.betAmount,
      });
    } catch (error) {
      console.error("Luxe bonus buy error:", error);
      res.status(400).json({ error: "Invalid request" });
    }
  });

  // Rock Paper Scissors game
  app.post("/api/games/scissors/play", async (req, res) => {
    try {
      const { odejs, amount, choice } = req.body;
      
      const user = await storage.getUser(odejs);
      if (!user || user.balance < amount) {
        return res.status(400).json({ error: "Insufficient balance" });
      }
      
      // Check admin-controlled win rate
      const playerShouldWin = await shouldPlayerWin();
      
      // Generate computer choice based on desired outcome
      const winMap: Record<string, string> = { rock: "scissors", paper: "rock", scissors: "paper" };
      const loseMap: Record<string, string> = { rock: "paper", paper: "scissors", scissors: "rock" };
      
      let computerChoice: string;
      if (playerShouldWin) {
        computerChoice = winMap[choice]; // Computer picks losing option
      } else {
        computerChoice = loseMap[choice]; // Computer picks winning option
      }
      
      let result: "win" | "lose" | "draw";
      if (choice === computerChoice) {
        result = "draw";
      } else if (
        (choice === "rock" && computerChoice === "scissors") ||
        (choice === "paper" && computerChoice === "rock") ||
        (choice === "scissors" && computerChoice === "paper")
      ) {
        result = "win";
      } else {
        result = "lose";
      }
      
      const multiplier = result === "win" ? 2 : result === "draw" ? 1 : 0;
      let payout = amount * multiplier;
      const isWin = result === "win";
      
      // Apply win limiting to prevent big wins
      if (payout > 0 && isWin) {
        payout = await applyWinLimit(odejs, amount, payout, "scissors");
      }
      
      const newBalance = user.balance - amount + payout;
      await storage.updateUserBalance(odejs, newBalance);
      
      // Record bet
      await storage.createBet({
        odejs,
        gameType: "scissors",
        amount,
        multiplier,
        payout,
        isWin,
        gameData: JSON.stringify({ playerChoice: choice, computerChoice, result }),
      });
      
      // Process 15% referral commission on loss (not draw)
      if (result === "lose") {
        await storage.processReferralCommission(odejs, amount);
      }
      
      // Broadcast to all players
      await broadcastBetResult(odejs, "scissors", amount, payout, isWin);
      
      res.json({
        playerChoice: choice,
        computerChoice,
        result,
        multiplier,
        payout,
        isWin,
        newBalance,
      });
    } catch (error) {
      res.status(400).json({ error: "Invalid request" });
    }
  });

  // Turtle Race game
  app.post("/api/games/turtle/race", async (req, res) => {
    try {
      const { odejs, amount, selectedTurtle, currency = "usd" } = req.body;
      
      const user = await storage.getUser(odejs);
      const currentBalance = await storage.getUserBalance(odejs, currency);
      if (!user || currentBalance < amount) {
        return res.status(400).json({ error: "Insufficient balance" });
      }
      
      // Check admin-controlled win rate
      const playerShouldWin = await shouldPlayerWin();
      
      const turtles = ["red", "blue", "yellow"] as const;
      
      const raceProgress: Record<string, number> = {};
      turtles.forEach((t) => {
        raceProgress[t] = Math.random() * 30 + 70;
      });
      
      // Override winner based on admin-controlled outcome
      let winner: string;
      if (playerShouldWin) {
        winner = selectedTurtle;
        // Make sure selected turtle has highest progress
        raceProgress[selectedTurtle] = 100;
      } else {
        // Select any turtle except the player's choice
        const otherTurtles = turtles.filter(t => t !== selectedTurtle);
        winner = otherTurtles[Math.floor(Math.random() * otherTurtles.length)];
        // Make sure winner has highest progress
        raceProgress[winner] = 100;
        raceProgress[selectedTurtle] = Math.min(raceProgress[selectedTurtle], 95);
      }
      
      const isWin = winner === selectedTurtle;
      const multiplier = isWin ? 3 : 0;
      let payout = amount * multiplier;
      
      // Apply win limiting to prevent big wins
      if (payout > 0) {
        payout = await applyWinLimit(odejs, amount, payout, "turtle");
      }
      
      const newBalance = currentBalance - amount + payout;
      await storage.setUserBalance(odejs, newBalance, currency);
      
      // Record bet
      await storage.createBet({
        odejs,
        gameType: "turtle",
        amount,
        multiplier,
        payout,
        isWin,
        gameData: JSON.stringify({ selectedTurtle, winner, raceProgress }),
      });
      
      // Process 15% referral commission on loss
      if (!isWin) {
        await storage.processReferralCommission(odejs, amount);
      }
      
      // Broadcast to all players
      await broadcastBetResult(odejs, "turtle", amount, payout, isWin);
      
      res.json({
        selectedTurtle,
        winner,
        raceProgress,
        multiplier,
        payout,
        isWin,
        newBalance,
      });
    } catch (error) {
      res.status(400).json({ error: "Invalid request" });
    }
  });

  // ===== EGYPT TREASURES SLOT (Server-controlled with anti-loss) =====
  
  // Egypt slot spin - server controls outcome
  app.post("/api/games/egypt/spin", async (req, res) => {
    try {
      const { odejs, bet, isFreeSpins } = req.body;
      
      const user = await storage.getUser(odejs);
      if (!user) {
        return res.status(400).json({ error: "User not found" });
      }
      
      const actualBet = isFreeSpins ? 0 : bet;
      if (actualBet > 0 && user.balance < actualBet) {
        return res.status(400).json({ error: "Insufficient balance" });
      }
      
      // Get RTP and profit settings (with fallback for missing columns)
      let egyptRtp = 0.45;
      let maxProfit = 50;
      try {
        const settings = await storage.getSettings();
        egyptRtp = (settings.egyptRtpPercent ?? 45) / 100;
        maxProfit = settings.egyptMaxProfit ?? 50;
      } catch (settingsError) {
        console.log("Egypt using default RTP settings");
      }
      
      // Get or create user session (with fallback for missing columns)
      let session: any = null;
      let currentProfit = 0;
      try {
        session = await storage.getUserSlotSession(odejs, "egypt");
        if (!session) {
          session = await storage.createUserSlotSession(odejs, "egypt");
        }
        currentProfit = session?.sessionProfit ?? 0;
      } catch (sessionError) {
        console.log("Egypt using fallback session");
      }
      
      // Determine if player should win based on RTP and current profit
      let canWin = true;
      
      // If player has profited too much, force losses until they've given back
      if (currentProfit >= maxProfit) {
        canWin = false;
      } else {
        // Normal RTP-based win chance
        canWin = Math.random() < egyptRtp;
      }
      
      // Generate grid based on outcome
      const ROWS = 3;
      const REEL_COUNT = 5;
      const grid: number[][] = [];
      let scatterCount = 0;
      
      for (let row = 0; row < ROWS; row++) {
        const rowData: number[] = [];
        for (let col = 0; col < REEL_COUNT; col++) {
          const rand = Math.random();
          if (rand < 0.025) {
            rowData.push(1); // scatter
            scatterCount++;
          } else if (rand < 0.045) {
            rowData.push(0); // wild
          } else {
            rowData.push(Math.floor(Math.random() * 6) + 2);
          }
        }
        grid.push(rowData);
      }
      
      // Calculate wins
      const PAYLINES = [
        [[1,0],[1,1],[1,2],[1,3],[1,4]],
        [[0,0],[0,1],[0,2],[0,3],[0,4]],
        [[2,0],[2,1],[2,2],[2,3],[2,4]],
        [[0,0],[1,1],[2,2],[1,3],[0,4]],
        [[2,0],[1,1],[0,2],[1,3],[2,4]],
        [[0,0],[0,1],[1,2],[0,3],[0,4]],
        [[2,0],[2,1],[1,2],[2,3],[2,4]],
        [[1,0],[0,1],[0,2],[0,3],[1,4]],
        [[1,0],[2,1],[2,2],[2,3],[1,4]],
        [[0,0],[1,1],[1,2],[1,3],[0,4]],
      ];
      
      const SYMBOL_PAYOUTS = [
        [0, 0, 15, 50, 200], // pharaoh/wild
        [0, 0, 3, 10, 50],   // pyramids/scatter
        [0, 0, 10, 30, 100], // anubis
        [0, 0, 10, 30, 100], // sphinx
        [0, 0, 5, 20, 60],   // snake
        [0, 0, 4, 15, 40],   // cat
        [0, 0, 4, 15, 40],   // eye
        [0, 0, 3, 10, 25],   // scarab
      ];
      
      let totalWin = 0;
      const winCells: string[] = [];
      
      for (const line of PAYLINES) {
        let firstSymbol = -1;
        let count = 0;
        let wildCount = 0;
        const lineCells: string[] = [];
        
        for (const [row, col] of line) {
          const symbol = grid[row][col];
          
          if (symbol === 1) continue; // scatter - skip
          
          if (symbol === 0) {
            wildCount++;
            lineCells.push(`${row}-${col}`);
            count++;
          } else if (firstSymbol === -1) {
            firstSymbol = symbol;
            count = wildCount + 1;
            lineCells.push(`${row}-${col}`);
          } else if (symbol === firstSymbol) {
            count++;
            lineCells.push(`${row}-${col}`);
          } else {
            break;
          }
        }
        
        if (count >= 3 && firstSymbol >= 0) {
          const payout = SYMBOL_PAYOUTS[firstSymbol][count - 1];
          if (payout > 0) {
            totalWin += payout * bet;
            winCells.push(...lineCells);
          }
        }
      }
      
      // If player shouldn't win and has a winning grid, reduce/remove wins
      if (!canWin && totalWin > 0) {
        totalWin = 0;
        winCells.length = 0;
      }
      
      // Generate mini slot
      const miniSymbols: [number, number, number] = [
        Math.floor(Math.random() * 3) + 1,
        Math.floor(Math.random() * 3) + 1,
        Math.floor(Math.random() * 3) + 1,
      ];
      let multiplier = 1;
      if (canWin && miniSymbols[0] === miniSymbols[1] && miniSymbols[1] === miniSymbols[2]) {
        if (miniSymbols[0] === 1) multiplier = 2;
        else if (miniSymbols[0] === 2) multiplier = 3;
        else multiplier = 5;
      }
      
      totalWin = totalWin * multiplier;
      
      // Apply win limiting to prevent big wins
      if (totalWin > 0) {
        totalWin = await applyWinLimit(odejs, bet, totalWin, "egypt");
      }
      
      // Determine if free spins triggered (only if canWin)
      let awardedFreeSpins = 0;
      if (canWin && scatterCount >= 3) {
        awardedFreeSpins = 10;
      }
      
      // Deduct bet and add winnings
      let newBalance = user.balance;
      if (actualBet > 0) {
        newBalance = newBalance - actualBet;
      }
      newBalance = newBalance + totalWin;
      await storage.updateUserBalance(odejs, newBalance);
      
      // Update session profit tracking (with fallback for missing columns)
      const profit = totalWin - actualBet;
      try {
        await storage.updateUserSlotSession(odejs, "egypt", actualBet, totalWin, profit);
      } catch (sessionUpdateError) {
        console.log("Egypt session update skipped");
      }
      
      // Record bet
      const isWin = totalWin > 0;
      await storage.createBet({
        odejs,
        gameType: "egypt",
        amount: actualBet,
        multiplier,
        payout: totalWin,
        isWin,
        gameData: JSON.stringify({ grid, scatterCount, awardedFreeSpins }),
      });
      
      // Process referral commission on loss
      if (!isWin && actualBet > 0) {
        await storage.processReferralCommission(odejs, actualBet);
      }
      
      // Broadcast
      await broadcastBetResult(odejs, "egypt", actualBet, totalWin, isWin);
      
      res.json({
        grid,
        totalWin,
        winCells: Array.from(new Set(winCells)),
        scatterCount,
        awardedFreeSpins,
        miniSlot: { symbols: miniSymbols, multiplier },
        newBalance,
      });
    } catch (error) {
      console.error("Egypt spin error:", error);
      res.status(400).json({ error: "Spin failed" });
    }
  });

  // ===== MINEDROP GAME ENDPOINTS =====
  
  // Server-side storage for free spin grids (prevents client tampering)
  const minedropFreeSpinGrids = new Map<string, { grid: any; freeSpinsRemaining: number }>();
  
  // Minedrop spin - Minecraft-style block breaking game
  app.post("/api/games/minedrop/spin", async (req, res) => {
    try {
      const { odejs, bet, isFreeSpins, extraChance, isBonusBuy } = req.body;
      
      const user = await storage.getUser(odejs);
      if (!user) {
        return res.status(400).json({ error: "User not found" });
      }
      
      // Calculate actual bet: Extra Chance = 3x, Bonus Buy = 100x
      let actualBet = isFreeSpins ? 0 : bet;
      if (!isFreeSpins && extraChance) actualBet = bet * 3;
      if (!isFreeSpins && isBonusBuy) actualBet = bet * 100;
      
      if (actualBet > 0 && user.balance < actualBet) {
        return res.status(400).json({ error: "Insufficient balance" });
      }
      
      // Get RTP and profit settings (with fallback for missing columns)
      let minedropRtp = 0.45;
      let maxProfit = 50;
      try {
        const settings = await storage.getSettings();
        minedropRtp = (settings.minedropRtpPercent ?? 45) / 100;
        maxProfit = settings.minedropMaxProfit ?? 50;
      } catch (settingsError) {
        console.log("Minedrop using default RTP settings");
      }
      
      // Get or create user session (with fallback for missing columns)
      let session: any = null;
      let currentProfit = 0;
      try {
        session = await storage.getUserSlotSession(odejs, "minedrop");
        if (!session) {
          session = await storage.createUserSlotSession(odejs, "minedrop");
        }
        currentProfit = session?.sessionProfit ?? 0;
      } catch (sessionError) {
        console.log("Minedrop using fallback session");
      }
      
      // Determine if player should win based on RTP and current profit
      let canWin = true;
      
      if (currentProfit >= maxProfit) {
        canWin = false;
      } else {
        canWin = Math.random() < minedropRtp;
      }
      
      // Block types: 0=dirt, 1=stone, 2=ruby, 3=gold, 4=diamond, 5=obsidian
      // Block durability: dirt=1, stone=2, ruby=4, gold=5, diamond=6, obsidian=7
      // Block payouts: dirt=0, stone=0.1x, ruby=1x, gold=3x, diamond=5x, obsidian=25x
      const BLOCK_DURABILITY = [1, 2, 4, 5, 6, 7];
      const BLOCK_PAYOUTS = [0, 0.1, 1, 3, 5, 25];
      
      // Pickaxe types: 0=wooden(1hit), 1=stone(2hits), 2=gold(3hits), 3=diamond(5hits)
      const PICKAXE_HITS = [1, 2, 3, 5];
      
      // Generate or use persistent block grid (5x6)
      let blockGrid: { type: number; durability: number; broken: boolean }[][] = [];
      
      // Helper function to generate random block grid with true randomization
      const generateRandomBlockGrid = () => {
        const grid: { type: number; durability: number; broken: boolean; maxDurability: number }[][] = [];
        for (let row = 0; row < 6; row++) {
          const rowData: { type: number; durability: number; broken: boolean; maxDurability: number }[] = [];
          for (let col = 0; col < 5; col++) {
            // True random block generation with weighted chances
            const rand = Math.random();
            let blockType: number;
            // Weighted distribution: dirt 25%, stone 25%, ruby 20%, gold 15%, diamond 10%, obsidian 5%
            if (rand < 0.25) blockType = 0;      // dirt
            else if (rand < 0.50) blockType = 1; // stone  
            else if (rand < 0.70) blockType = 2; // ruby
            else if (rand < 0.85) blockType = 3; // gold
            else if (rand < 0.95) blockType = 4; // diamond
            else blockType = 5;                   // obsidian
            
            rowData.push({
              type: blockType,
              durability: BLOCK_DURABILITY[blockType],
              maxDurability: BLOCK_DURABILITY[blockType],
              broken: false,
            });
          }
          grid.push(rowData);
        }
        return grid;
      };
      
      // Check for server-side stored free spin grid (security: ignore client grid)
      const storedFreeSpinState = minedropFreeSpinGrids.get(odejs);
      
      if (isFreeSpins && storedFreeSpinState && storedFreeSpinState.freeSpinsRemaining > 0) {
        // Use server-stored grid for free spins (tamper-proof)
        blockGrid = storedFreeSpinState.grid;
      } else {
        // Generate fresh random grid
        blockGrid = generateRandomBlockGrid();
        // Clear any stale free spin state
        minedropFreeSpinGrids.delete(odejs);
      }
      
      // Generate top reel (5x3) with pickaxes and special symbols
      // Symbols: 0-3=pickaxes, 4=spellbook, 5=tnt, 6=ender_eye(scatter), 7=empty
      const topReel: number[][] = [];
      let scatterCount = 0;
      
      // Extra Chance multiplies scatter chance by 5x (2% -> 10%)
      const scatterChance = extraChance ? 0.10 : 0.02;
      
      // Bonus Buy forces 3 scatters for guaranteed free spins
      if (isBonusBuy && !isFreeSpins) {
        const scatterPositions = [[0, 0], [1, 2], [2, 4]];
        for (let row = 0; row < 3; row++) {
          const rowData: number[] = [];
          for (let col = 0; col < 5; col++) {
            if (scatterPositions.some(p => p[0] === row && p[1] === col)) {
              rowData.push(6);
              scatterCount++;
            } else {
              const pickRand = Math.random();
              if (pickRand < 0.3) rowData.push(0);
              else if (pickRand < 0.6) rowData.push(1);
              else if (pickRand < 0.85) rowData.push(2);
              else rowData.push(3);
            }
          }
          topReel.push(rowData);
        }
      } else {
        for (let row = 0; row < 3; row++) {
          const rowData: number[] = [];
          for (let col = 0; col < 5; col++) {
            const rand = Math.random();
            let symbol: number;
            
            if (rand < scatterChance) {
              symbol = 6; // Ender Eye (scatter)
              scatterCount++;
            } else if (rand < scatterChance + 0.015) {
              symbol = 5; // TNT - 1.5%
            } else if (rand < scatterChance + 0.03) {
              symbol = 4; // Spellbook - 1.5%
            } else if (rand < scatterChance + 0.50) {
              symbol = 7; // Empty - 47% (pickaxes are now rare)
            } else {
              // Pickaxes based on canWin
              if (canWin) {
                const pickRand = Math.random();
                if (pickRand < 0.3) symbol = 0; // Wooden
                else if (pickRand < 0.6) symbol = 1; // Stone
                else if (pickRand < 0.85) symbol = 2; // Gold
                else symbol = 3; // Diamond
              } else {
                // If can't win, mostly wooden pickaxes
                symbol = Math.random() < 0.7 ? 0 : 1;
              }
            }
            rowData.push(symbol);
          }
          topReel.push(rowData);
        }
      }
      
      // Process pickaxe drops and calculate wins
      let totalWin = 0;
      const brokenBlocks: { row: number; col: number; payout: number; blockType: number }[] = [];
      const chestMultipliers: { col: number; multiplier: number }[] = [];
      
      // For each column, process drops from top to bottom
      for (let col = 0; col < 5; col++) {
        let totalHits = 0;
        let hasTnt = false;
        
        // Pre-scan for spellbook - if present, ALL pickaxes become diamond (5 hits)
        let hasSpellbook = false;
        for (let row = 0; row < 3; row++) {
          if (topReel[row][col] === 4) {
            hasSpellbook = true;
            break;
          }
        }
        
        // Collect all symbols in this column
        for (let row = 0; row < 3; row++) {
          const symbol = topReel[row][col];
          if (symbol <= 3) {
            // Pickaxe - if spellbook in column, ALL pickaxes become diamond strength
            const hits = hasSpellbook ? 5 : PICKAXE_HITS[symbol];
            totalHits += hits;
          } else if (symbol === 5) {
            // TNT
            hasTnt = true;
          }
        }
        
        // Apply TNT effect (breaks block + neighbors)
        // Note: payouts use base bet, not 3x/100x adjusted bet
        if (hasTnt) {
          for (let row = 0; row < 6; row++) {
            if (!blockGrid[row][col].broken) {
              blockGrid[row][col].broken = true;
              const blockType = blockGrid[row][col].type;
              const payout = BLOCK_PAYOUTS[blockType] * bet;
              totalWin += payout;
              brokenBlocks.push({ row, col, payout, blockType });
              
              // Break neighbors too
              if (col > 0 && !blockGrid[row][col - 1].broken) {
                blockGrid[row][col - 1].broken = true;
                const leftBlockType = blockGrid[row][col - 1].type;
                const leftPayout = BLOCK_PAYOUTS[leftBlockType] * bet;
                totalWin += leftPayout;
                brokenBlocks.push({ row, col: col - 1, payout: leftPayout, blockType: leftBlockType });
              }
              if (col < 4 && !blockGrid[row][col + 1].broken) {
                blockGrid[row][col + 1].broken = true;
                const rightBlockType = blockGrid[row][col + 1].type;
                const rightPayout = BLOCK_PAYOUTS[rightBlockType] * bet;
                totalWin += rightPayout;
                brokenBlocks.push({ row, col: col + 1, payout: rightPayout, blockType: rightBlockType });
              }
              break;
            }
          }
        }
        
        // Process pickaxe hits from top to bottom
        let hitsRemaining = totalHits;
        for (let row = 0; row < 6 && hitsRemaining > 0; row++) {
          if (!blockGrid[row][col].broken) {
            const block = blockGrid[row][col];
            if (hitsRemaining >= block.durability) {
              // Break the block
              hitsRemaining -= block.durability;
              block.durability = 0;
              block.broken = true;
              const payout = BLOCK_PAYOUTS[block.type] * bet;
              totalWin += payout;
              brokenBlocks.push({ row, col, payout, blockType: block.type });
            } else {
              // Damage the block but don't break
              block.durability -= hitsRemaining;
              hitsRemaining = 0;
            }
          }
        }
        
        // Check if entire column is cleared for treasure chest
        const columnCleared = blockGrid.every(row => row[col].broken);
        if (columnCleared) {
          // Random multiplier x2-x100
          const multRand = Math.random();
          let multiplier: number;
          if (multRand < 0.5) multiplier = 2;
          else if (multRand < 0.75) multiplier = 3;
          else if (multRand < 0.9) multiplier = 5;
          else if (multRand < 0.97) multiplier = 10;
          else if (multRand < 0.995) multiplier = 50;
          else multiplier = 100;
          
          chestMultipliers.push({ col, multiplier });
        }
      }
      
      // Apply chest multipliers to total win
      let totalMultiplier = 1;
      for (const chest of chestMultipliers) {
        totalMultiplier *= chest.multiplier;
      }
      totalWin *= totalMultiplier;
      
      // If can't win, reduce winnings significantly
      if (!canWin && totalWin > bet) {
        totalWin = Math.min(totalWin * 0.1, bet * 0.5);
      }
      
      // Apply win limiting to prevent big wins
      if (totalWin > 0) {
        totalWin = await applyWinLimit(odejs, bet, totalWin, "minedrop");
      }
      
      totalWin = Math.round(totalWin * 100) / 100;
      
      // Check for free spins (3+ Ender Eyes)
      // Bonus buy ALWAYS awards free spins (user paid 100x bet for it)
      // Regular spins only award if canWin and scatterCount >= 3
      let awardedFreeSpins = 0;
      if (scatterCount >= 3 && (canWin || isBonusBuy)) {
        awardedFreeSpins = 4 + (scatterCount - 3); // 4 base + 1 per extra eye
        // Store grid server-side for upcoming free spins (tamper-proof)
        minedropFreeSpinGrids.set(odejs, { grid: blockGrid, freeSpinsRemaining: awardedFreeSpins });
      }
      
      // Update server-side free spin state after using a free spin
      if (isFreeSpins && storedFreeSpinState) {
        const newRemaining = storedFreeSpinState.freeSpinsRemaining - 1;
        if (newRemaining <= 0) {
          // Free spins exhausted, clear the stored grid
          minedropFreeSpinGrids.delete(odejs);
        } else {
          // Update grid state and decrement remaining spins
          minedropFreeSpinGrids.set(odejs, { grid: blockGrid, freeSpinsRemaining: newRemaining });
        }
      }
      
      // Update balance
      let newBalance = user.balance;
      if (actualBet > 0) {
        newBalance = newBalance - actualBet;
      }
      newBalance = newBalance + totalWin;
      await storage.updateUserBalance(odejs, newBalance);
      
      // Update session profit tracking (with fallback for missing columns)
      const profit = totalWin - actualBet;
      try {
        await storage.updateUserSlotSession(odejs, "minedrop", actualBet, totalWin, profit);
      } catch (sessionUpdateError) {
        console.log("Minedrop session update skipped");
      }
      
      // Record bet
      const isWin = totalWin > 0;
      await storage.createBet({
        odejs,
        gameType: "minedrop",
        amount: actualBet,
        multiplier: totalWin > 0 ? totalWin / Math.max(actualBet, 0.01) : 0,
        payout: totalWin,
        isWin,
        gameData: JSON.stringify({ scatterCount, awardedFreeSpins }),
      });
      
      // Process referral commission on loss
      if (!isWin && actualBet > 0) {
        await storage.processReferralCommission(odejs, actualBet);
      }
      
      // Broadcast
      await broadcastBetResult(odejs, "minedrop", actualBet, totalWin, isWin);
      
      // Generate next grid for regular spins (not during free spins and no new free spins awarded)
      const nextBlockGrid = (!isFreeSpins && awardedFreeSpins === 0) ? generateRandomBlockGrid() : null;
      
      res.json({
        topReel,
        blockGrid,
        nextBlockGrid,
        totalWin,
        brokenBlocks,
        chestMultipliers,
        scatterCount,
        awardedFreeSpins,
        newBalance,
      });
    } catch (error) {
      console.error("Minedrop spin error:", error);
      res.status(400).json({ error: "Spin failed" });
    }
  });

  // ===== BLACKJACK GAME ENDPOINTS =====
  
  // Start Blackjack game - deduct bet
  app.post("/api/games/blackjack/start", async (req, res) => {
    try {
      const { odejs, amount, currency = "usd" } = req.body;
      
      const user = await storage.getUser(odejs);
      const currentBalance = await storage.getUserBalance(odejs, currency);
      if (!user || currentBalance < amount) {
        return res.status(400).json({ error: "Insufficient balance" });
      }
      
      // Deduct bet amount
      const newBalance = currentBalance - amount;
      await storage.setUserBalance(odejs, newBalance, currency);
      
      res.json({
        success: true,
        newBalance,
      });
    } catch (error) {
      res.status(400).json({ error: "Invalid request" });
    }
  });
  
  // Finish Blackjack game - process result
  app.post("/api/games/blackjack/finish", async (req, res) => {
    try {
      const { odejs, betAmount, result, multiplier, currency = "usd" } = req.body;
      
      const user = await storage.getUser(odejs);
      if (!user) {
        return res.status(400).json({ error: "User not found" });
      }
      
      let payout = betAmount * multiplier;
      const isWin = result === "win" || result === "blackjack";
      const isPush = result === "push";
      
      // Apply win limiting to prevent big wins
      if (payout > 0 && isWin) {
        payout = await applyWinLimit(odejs, betAmount, payout, "blackjack");
      }
      
      // Add payout to balance (if any)
      const currentBalance = await storage.getUserBalance(odejs, currency);
      const newBalance = currentBalance + payout;
      await storage.setUserBalance(odejs, newBalance, currency);
      
      // Record bet with actual (capped) multiplier
      const actualMultiplier = payout / betAmount;
      await storage.createBet({
        odejs,
        gameType: "blackjack",
        amount: betAmount,
        multiplier: actualMultiplier,
        payout,
        isWin,
        gameData: JSON.stringify({ result, requestedMultiplier: multiplier, actualMultiplier }),
      });
      
      // Process 15% referral commission on loss (not push)
      if (!isWin && !isPush) {
        await storage.processReferralCommission(odejs, betAmount);
      }
      
      // Broadcast to all players
      await broadcastBetResult(odejs, "blackjack", betAmount, payout, isWin);
      
      res.json({
        success: true,
        payout,
        newBalance,
        isWin,
        isPush,
      });
    } catch (error) {
      res.status(400).json({ error: "Invalid request" });
    }
  });

  // Get user bet history
  app.get("/api/users/:userId/bets", async (req, res) => {
    const limit = parseInt(req.query.limit as string) || 10;
    const bets = await storage.getUserBets(req.params.userId, limit);
    res.json(bets);
  });

  // Get recent bets (for live feed)
  app.get("/api/bets/recent", async (req, res) => {
    const limit = parseInt(req.query.limit as string) || 20;
    const bets = await storage.getRecentBets(limit);
    res.json(bets);
  });

  // Get online stats
  app.get("/api/stats/online", (req, res) => {
    res.json(gameSocket.getStats());
  });

  // ===== WALLET & DEPOSIT ENDPOINTS =====

  // Connect wallet
  app.post("/api/wallet/connect", async (req, res) => {
    try {
      const { odejs, walletAddress } = req.body;
      
      const user = await storage.getUser(odejs);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      
      await storage.updateUserWallet(odejs, walletAddress);
      res.json({ success: true, walletAddress });
    } catch (error) {
      res.status(400).json({ error: "Failed to connect wallet" });
    }
  });

  // Deposit funds (simulated - in production would verify blockchain transaction)
  app.post("/api/wallet/deposit", async (req, res) => {
    try {
      const { odejs, amount, txHash } = req.body;
      
      const user = await storage.getUser(odejs);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      
      if (!user.walletAddress) {
        return res.status(400).json({ error: "Wallet not connected" });
      }
      
      const newBalance = user.balance + amount;
      await storage.updateUserBalance(odejs, newBalance);
      
      // Process deposit for VIP tier tracking
      const updatedUser = await storage.processDeposit(odejs, amount);
      
      res.json({ 
        success: true, 
        newBalance, 
        txHash, 
        isVip: updatedUser?.isVip || false,
        vipTier: updatedUser?.vipTier || null,
        totalDeposited: updatedUser?.totalDeposited || 0
      });
    } catch (error) {
      res.status(400).json({ error: "Failed to deposit" });
    }
  });

  // Request withdrawal
  app.post("/api/wallet/withdraw", async (req, res) => {
    try {
      const { odejs, amount, walletAddress, network } = req.body;
      
      if (!odejs || !amount || amount <= 0) {
        return res.status(400).json({ error: "Некорректный запрос" });
      }

      if (!walletAddress || !walletAddress.trim()) {
        return res.status(400).json({ error: "Укажите адрес кошелька" });
      }

      if (!network) {
        return res.status(400).json({ error: "Выберите сеть для вывода" });
      }

      if (amount < 10) {
        return res.status(400).json({ error: "Минимальная сумма вывода: 10 USDT" });
      }

      const user = await storage.getUser(odejs);
      if (!user) {
        return res.status(404).json({ error: "Пользователь не найден" });
      }
      
      if (user.balance < amount) {
        return res.status(400).json({ error: "Недостаточно средств" });
      }

      // Anti-abuse protection: require minimum wagered amount before withdrawal
      // This prevents users from just collecting bonuses and withdrawing
      const MIN_WAGER_FOR_WITHDRAWAL = 20; // Must wager at least $20 before first withdrawal
      const userBets = await storage.getUserBets(odejs, 1000); // Get last 1000 bets
      const totalWagered = userBets.reduce((sum, bet) => sum + bet.amount, 0);
      
      if (totalWagered < MIN_WAGER_FOR_WITHDRAWAL) {
        return res.status(400).json({ 
          error: `Для вывода необходимо сделать ставок на сумму минимум $${MIN_WAGER_FOR_WITHDRAWAL}. Сейчас: $${totalWagered.toFixed(2)}`
        });
      }
      
      // Deduct balance immediately
      await storage.updateUserBalance(odejs, user.balance - amount);
      
      // Create withdrawal request with network info
      const withdrawal = await storage.createWithdrawal({
        odejs,
        amount,
        walletAddress: `[${network}] ${walletAddress.trim()}`,
        status: "pending",
      });
      
      res.json({ success: true, withdrawal, newBalance: user.balance - amount });
    } catch (error) {
      console.error("Withdrawal error:", error);
      res.status(400).json({ error: "Не удалось создать запрос на вывод" });
    }
  });

  // Get user withdrawals
  app.get("/api/wallet/withdrawals/:odejs", async (req, res) => {
    try {
      const allWithdrawals = await storage.getAllWithdrawals();
      const userWithdrawals = allWithdrawals.filter(w => w.odejs === req.params.odejs);
      res.json(userWithdrawals);
    } catch (error) {
      res.status(400).json({ error: "Failed to get withdrawals" });
    }
  });

  // ===== VIP CHAT ENDPOINTS =====
  
  const CHAT_MESSAGE_LIMIT = 200; // Max characters per message
  const CHAT_RATE_LIMIT_MS = 60 * 1000; // 1 minute between messages

  // Get chat messages
  app.get("/api/chat/messages", async (req, res) => {
    try {
      const messages = await storage.getChatMessages(100);
      res.json(messages.reverse()); // Return in chronological order
    } catch (error) {
      console.error("Get chat messages error:", error);
      res.status(400).json({ error: "Failed to get messages" });
    }
  });

  // Public: Get games disabled status
  app.get("/api/games-status", async (req, res) => {
    try {
      const settings = await storage.getSettings();
      res.json({
        disabled: settings?.gamesDisabled || false,
        message: settings?.gamesDisabledMessage || null
      });
    } catch (error) {
      res.status(500).json({ disabled: false, message: null });
    }
  });

  // Public: Get deposit addresses
  app.get("/api/deposit-addresses", async (req, res) => {
    try {
      const settings = await storage.getSettings();
      res.json({
        ton: settings?.depositAddressTon || null,
        trc20: settings?.depositAddressTrc20 || null
      });
    } catch (error) {
      res.status(500).json({ ton: null, trc20: null });
    }
  });

  // ===== TELEGRAM STARS PAYMENT ENDPOINTS =====
  
  // Initialize Stars payment handlers
  initStarsPaymentHandlers(async (userId: string, amount: number, chargeId: string) => {
    try {
      const user = await storage.getUser(userId);
      if (user) {
        const newBalance = (user.starsBalance || 0) + amount;
        await storage.setUserBalance(userId, newBalance, "stars");
        console.log(`Stars payment success: User ${userId} credited ${amount} stars, new balance: ${newBalance}`);
      }
    } catch (error) {
      console.error("Failed to process Stars payment:", error);
    }
  });
  
  // Create Stars invoice link for deposit
  app.post("/api/stars/create-invoice", async (req, res) => {
    try {
      const { odejs, amount } = req.body;
      
      if (!odejs || !amount || amount <= 0) {
        return res.status(400).json({ error: "Invalid request" });
      }
      
      const invoiceLink = await createStarsInvoiceLink(amount, odejs);
      res.json({ invoiceLink });
    } catch (error: any) {
      console.error("Create Stars invoice error:", error);
      res.status(400).json({ error: error.message || "Failed to create invoice" });
    }
  });
  
  // Get user's Stars balance
  app.get("/api/stars/balance/:odejs", async (req, res) => {
    try {
      const user = await storage.getUser(req.params.odejs);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      
      res.json({ balance: user.starsBalance || 0 });
    } catch (error) {
      res.status(400).json({ error: "Failed to get balance" });
    }
  });

  // Convert Stars to USD (100 Stars = $2 USD)
  const STARS_TO_USD_RATE = 50; // 50 Stars = $1 USD (so 100 Stars = $2 USD)
  const MIN_STARS_CONVERT = 50; // Minimum Stars to convert (= $1 USD)
  
  app.post("/api/stars/convert", async (req, res) => {
    try {
      const { odejs, starsAmount } = req.body;
      
      if (!odejs || !starsAmount || starsAmount < MIN_STARS_CONVERT) {
        return res.status(400).json({ 
          error: `Минимум для конвертации: ${MIN_STARS_CONVERT} Stars ($1 USD)` 
        });
      }
      
      const user = await storage.getUser(odejs);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      
      const currentStars = user.starsBalance || 0;
      if (currentStars < starsAmount) {
        return res.status(400).json({ error: "Недостаточно Stars" });
      }
      
      // Calculate USD amount
      const usdAmount = starsAmount / STARS_TO_USD_RATE;
      
      // Deduct Stars
      const newStarsBalance = currentStars - starsAmount;
      await storage.setUserBalance(odejs, newStarsBalance, "stars");
      
      // Add USD
      const newUsdBalance = (user.balance || 0) + usdAmount;
      await storage.setUserBalance(odejs, newUsdBalance, "usd");
      
      console.log(`Stars conversion: User ${odejs} converted ${starsAmount} Stars → $${usdAmount} USD`);
      
      res.json({ 
        success: true,
        convertedStars: starsAmount,
        receivedUsd: usdAmount,
        newStarsBalance,
        newUsdBalance
      });
    } catch (error: any) {
      console.error("Stars conversion error:", error);
      res.status(400).json({ error: error.message || "Ошибка конвертации" });
    }
  });

  // Public: Get public settings (Telegram channel link, etc.)
  app.get("/api/settings/public", async (req, res) => {
    try {
      const settings = await storage.getSettings();
      res.json({
        telegramChannelLink: settings?.telegramChannelLink || null,
      });
    } catch (error) {
      res.status(500).json({ telegramChannelLink: null });
    }
  });

  // ===== DAILY WHEEL ENDPOINTS =====
  const WHEEL_PRIZES = [0, 0.5, 1, 5]; // Possible prizes

  // Get wheel status for user
  app.get("/api/wheel/status/:odejs", async (req, res) => {
    try {
      const user = await storage.getUser(req.params.odejs);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      const now = new Date();
      const lastSpin = user.lastWheelSpin;
      const twentyFourHours = 24 * 60 * 60 * 1000;

      if (!lastSpin) {
        return res.json({ canSpin: true, nextSpinAt: null });
      }

      const timeSinceLastSpin = now.getTime() - new Date(lastSpin).getTime();
      if (timeSinceLastSpin >= twentyFourHours) {
        return res.json({ canSpin: true, nextSpinAt: null });
      }

      const nextSpinAt = new Date(new Date(lastSpin).getTime() + twentyFourHours);
      res.json({ canSpin: false, nextSpinAt: nextSpinAt.toISOString() });
    } catch (error) {
      res.status(500).json({ error: "Failed to get wheel status" });
    }
  });

  // Spin the wheel
  app.post("/api/wheel/spin", async (req, res) => {
    try {
      const { odejs } = req.body;
      if (!odejs) {
        return res.status(400).json({ error: "Missing user ID" });
      }

      // Wheel segments matching frontend:
      // 0=$12.00, 1=$0.60, 2=$0.12, 3=$0 (gift), 4=$3.00, 5=$0.30, 6=$0.60, 7=$0 (gift)
      const random = Math.random();
      let selectedSegment;
      
      if (random < 0.30) {
        // 30% - $0 (gift boxes - segments 3 and 7)
        const zeroSegments = [3, 7];
        selectedSegment = { index: zeroSegments[Math.floor(Math.random() * zeroSegments.length)], prize: 0 };
      } else if (random < 0.55) {
        // 25% - $0.12 (segment 2)
        selectedSegment = { index: 2, prize: 0.12 };
      } else if (random < 0.75) {
        // 20% - $0.30 (segment 5)
        selectedSegment = { index: 5, prize: 0.30 };
      } else if (random < 0.90) {
        // 15% - $0.60 (segments 1 and 6)
        const sixtySegments = [1, 6];
        selectedSegment = { index: sixtySegments[Math.floor(Math.random() * sixtySegments.length)], prize: 0.60 };
      } else if (random < 0.97) {
        // 7% - $3.00 (segment 4)
        selectedSegment = { index: 4, prize: 3 };
      } else {
        // 3% - $12.00 (segment 0) - rare big prize
        selectedSegment = { index: 0, prize: 12 };
      }

      const result = await storage.spinWheel(odejs, selectedSegment.prize);
      
      if (!result.success) {
        return res.status(400).json({ 
          error: result.error,
          nextSpinAt: result.nextSpinAt?.toISOString()
        });
      }

      res.json({ 
        success: true, 
        prize: selectedSegment.prize,
        segmentIndex: selectedSegment.index,
        newBalance: result.user?.balance 
      });
    } catch (error) {
      console.error("Wheel spin error:", error);
      res.status(500).json({ error: "Failed to spin wheel" });
    }
  });

  // Send chat message (VIP or Admin)
  app.post("/api/chat/messages", async (req, res) => {
    try {
      const { odejs, message } = req.body;
      
      if (!odejs || !message) {
        return res.status(400).json({ error: "Missing user or message" });
      }

      const user = await storage.getUser(odejs);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      // Check if user is admin (admins can always post)
      const isAdminUser = user.isAdmin || user.username === "nahalist";

      // Check VIP status (admins bypass this check)
      if (!user.isVip && !isAdminUser) {
        return res.status(403).json({ 
          error: "VIP only",
          errorRu: "Чат доступен только для VIP игроков. Сделайте депозит, чтобы получить VIP статус!"
        });
      }

      // Check message length
      const trimmedMessage = message.trim();
      if (trimmedMessage.length === 0) {
        return res.status(400).json({ error: "Message cannot be empty" });
      }
      if (trimmedMessage.length > CHAT_MESSAGE_LIMIT) {
        return res.status(400).json({ 
          error: `Message too long`,
          errorRu: `Максимум ${CHAT_MESSAGE_LIMIT} символов`
        });
      }

      // Check rate limit (1 message per minute) - admins bypass rate limit
      if (!isAdminUser) {
        const lastMessage = await storage.getLastUserMessage(odejs);
        if (lastMessage && lastMessage.createdAt) {
          const timeSinceLastMessage = Date.now() - new Date(lastMessage.createdAt).getTime();
          if (timeSinceLastMessage < CHAT_RATE_LIMIT_MS) {
            const remainingSeconds = Math.ceil((CHAT_RATE_LIMIT_MS - timeSinceLastMessage) / 1000);
            return res.status(429).json({ 
              error: "Rate limit",
              errorRu: `Подождите ${remainingSeconds} сек.`,
              remainingSeconds
            });
          }
        }
      }

      // Create message - admin messages show "Admin" label
      const newMessage = await storage.createChatMessage({
        odejs,
        username: user.username,
        firstName: user.firstName,
        vipTier: user.vipTier,
        isAdmin: isAdminUser,
        message: trimmedMessage,
      });

      res.json(newMessage);
    } catch (error) {
      console.error("Send chat message error:", error);
      res.status(400).json({ error: "Failed to send message" });
    }
  });

  // ===== ADMIN ENDPOINTS =====

  // Middleware to check admin - verifies user exists and has admin privileges
  // Note: For production, implement Telegram initData HMAC verification
  const checkAdmin: RequestHandler = async (req, res, next) => {
    const adminId = req.headers["x-admin-id"] as string;
    if (!adminId) {
      res.status(401).json({ error: "Unauthorized - Admin ID required" });
      return;
    }
    
    const admin = await storage.getUser(adminId);
    if (!admin) {
      res.status(401).json({ error: "Unauthorized - User not found" });
      return;
    }
    
    // Check if user is admin by isAdmin flag OR by username (nahalist is always admin)
    const isAdminUser = admin.isAdmin || admin.username === "nahalist";
    if (!isAdminUser) {
      res.status(403).json({ error: "Forbidden - Admin access required" });
      return;
    }
    
    // Attach admin user to request for use in route handlers
    (req as any).adminUser = admin;
    next();
  };

  // Get admin settings
  app.get("/api/admin/settings", checkAdmin, async (req, res) => {
    try {
      const currentSettings = await storage.getSettings();
      res.json(currentSettings);
    } catch (error) {
      res.status(400).json({ error: "Failed to get settings" });
    }
  });

  // Update win rate
  app.post("/api/admin/settings/winrate", checkAdmin, async (req, res) => {
    try {
      const { winRatePercent } = req.body;
      const adminId = req.headers["x-admin-id"] as string;
      
      if (winRatePercent < 0 || winRatePercent > 100) {
        return res.status(400).json({ error: "Win rate must be between 0 and 100" });
      }
      
      const updated = await storage.updateWinRate(winRatePercent, adminId);
      res.json(updated);
    } catch (error) {
      res.status(400).json({ error: "Failed to update win rate" });
    }
  });

  // Update Luxe slot RTP
  app.post("/api/admin/settings/luxe-rtp", checkAdmin, async (req, res) => {
    try {
      const { luxeRtpPercent } = req.body;
      const adminId = req.headers["x-admin-id"] as string;
      
      if (luxeRtpPercent < 0 || luxeRtpPercent > 100) {
        return res.status(400).json({ error: "Luxe RTP must be between 0 and 100" });
      }
      
      const updated = await storage.updateLuxeRtp(luxeRtpPercent, adminId);
      res.json(updated);
    } catch (error) {
      res.status(400).json({ error: "Failed to update Luxe RTP" });
    }
  });

  // Update Minedrop RTP
  app.post("/api/admin/settings/minedrop-rtp", checkAdmin, async (req, res) => {
    try {
      const { minedropRtpPercent } = req.body;
      const adminId = req.headers["x-admin-id"] as string;
      
      if (minedropRtpPercent < 0 || minedropRtpPercent > 100) {
        return res.status(400).json({ error: "Minedrop RTP must be between 0 and 100" });
      }
      
      const updated = await storage.updateMinedropRtp(minedropRtpPercent, adminId);
      res.json(updated);
    } catch (error) {
      res.status(400).json({ error: "Failed to update Minedrop RTP" });
    }
  });

  // Update win limit settings (prevents big wins from small bets)
  app.post("/api/admin/settings/win-limits", checkAdmin, async (req, res) => {
    try {
      const adminId = req.headers["x-admin-id"] as string;
      const { winLimitEnabled, maxWinMultiplier, maxAbsoluteWin, lossRecoveryPercent } = req.body;
      
      // Validate values
      if (maxWinMultiplier !== undefined && (maxWinMultiplier < 1 || maxWinMultiplier > 1000)) {
        return res.status(400).json({ error: "Max multiplier must be between 1 and 1000" });
      }
      if (maxAbsoluteWin !== undefined && (maxAbsoluteWin < 1 || maxAbsoluteWin > 10000)) {
        return res.status(400).json({ error: "Max absolute win must be between $1 and $10,000" });
      }
      if (lossRecoveryPercent !== undefined && (lossRecoveryPercent < 0 || lossRecoveryPercent > 100)) {
        return res.status(400).json({ error: "Loss recovery percent must be between 0 and 100" });
      }
      
      const updated = await storage.updateWinLimitSettings({
        winLimitEnabled,
        maxWinMultiplier,
        maxAbsoluteWin,
        lossRecoveryPercent,
      }, adminId);
      
      res.json(updated);
    } catch (error) {
      res.status(400).json({ error: "Failed to update win limit settings" });
    }
  });

  // Update poker bot settings
  app.post("/api/admin/settings/poker-bots", checkAdmin, async (req, res) => {
    try {
      const adminId = req.headers["x-admin-id"] as string;
      const {
        pokerBotsEnabled,
        pokerBotJoinMode,
        pokerBot1Name,
        pokerBot2Name,
        pokerBot3Name,
        pokerBot1Style,
        pokerBot2Style,
        pokerBot3Style,
        pokerBot1Enabled,
        pokerBot2Enabled,
        pokerBot3Enabled,
        pokerBotWinRate,
      } = req.body;

      // Validate win rate if provided
      if (pokerBotWinRate !== undefined && (pokerBotWinRate < 0 || pokerBotWinRate > 100)) {
        return res.status(400).json({ error: "Bot win rate must be between 0 and 100" });
      }

      // Validate join mode
      if (pokerBotJoinMode && !["wait_for_player", "join_active"].includes(pokerBotJoinMode)) {
        return res.status(400).json({ error: "Invalid join mode" });
      }

      // Validate play styles
      const validStyles = ["aggressive", "tight", "balanced"];
      if (pokerBot1Style && !validStyles.includes(pokerBot1Style)) {
        return res.status(400).json({ error: "Invalid bot 1 style" });
      }
      if (pokerBot2Style && !validStyles.includes(pokerBot2Style)) {
        return res.status(400).json({ error: "Invalid bot 2 style" });
      }
      if (pokerBot3Style && !validStyles.includes(pokerBot3Style)) {
        return res.status(400).json({ error: "Invalid bot 3 style" });
      }

      const updated = await storage.updatePokerBotSettings({
        pokerBotsEnabled,
        pokerBotJoinMode,
        pokerBot1Name,
        pokerBot2Name,
        pokerBot3Name,
        pokerBot1Style,
        pokerBot2Style,
        pokerBot3Style,
        pokerBot1Enabled,
        pokerBot2Enabled,
        pokerBot3Enabled,
        pokerBotWinRate,
      }, adminId);

      res.json(updated);
    } catch (error) {
      res.status(400).json({ error: "Failed to update poker bot settings" });
    }
  });

  // Get pending withdrawals
  app.get("/api/admin/withdrawals", checkAdmin, async (req, res) => {
    try {
      const pendingWithdrawals = await storage.getPendingWithdrawals();
      
      // Enrich with user data
      const withdrawalsWithUsers = await Promise.all(
        pendingWithdrawals.map(async (w) => {
          const user = await storage.getUser(w.odejs);
          return {
            ...w,
            user: user ? {
              username: user.username,
              firstName: user.firstName,
            } : null,
          };
        })
      );
      
      res.json(withdrawalsWithUsers);
    } catch (error) {
      res.status(400).json({ error: "Failed to get withdrawals" });
    }
  });

  // Get all withdrawals
  app.get("/api/admin/withdrawals/all", checkAdmin, async (req, res) => {
    try {
      const allWithdrawals = await storage.getAllWithdrawals();
      res.json(allWithdrawals);
    } catch (error) {
      res.status(400).json({ error: "Failed to get withdrawals" });
    }
  });

  // Process withdrawal (approve/reject)
  app.post("/api/admin/withdrawals/:id/process", checkAdmin, async (req, res) => {
    try {
      const { status } = req.body; // "approved" or "rejected"
      const adminId = req.headers["x-admin-id"] as string;
      
      if (!["approved", "rejected"].includes(status)) {
        return res.status(400).json({ error: "Invalid status" });
      }
      
      const withdrawal = await storage.processWithdrawal(req.params.id, status, adminId);
      
      if (!withdrawal) {
        return res.status(404).json({ error: "Withdrawal not found" });
      }
      
      // If rejected, refund the user
      if (status === "rejected") {
        const user = await storage.getUser(withdrawal.odejs);
        if (user) {
          await storage.updateUserBalance(withdrawal.odejs, user.balance + withdrawal.amount);
        }
      }
      
      res.json(withdrawal);
    } catch (error) {
      res.status(400).json({ error: "Failed to process withdrawal" });
    }
  });

  // Get all users (admin)
  app.get("/api/admin/users", checkAdmin, async (req, res) => {
    try {
      const allUsers = await storage.getAllUsers();
      res.json(allUsers);
    } catch (error) {
      res.status(400).json({ error: "Failed to get users" });
    }
  });

  // Update user balance (admin) - also processes VIP tier on deposit
  app.post("/api/admin/users/:id/balance", checkAdmin, async (req, res) => {
    try {
      const { balance, isDeposit } = req.body;
      const existingUser = await storage.getUser(req.params.id);
      if (!existingUser) {
        return res.status(404).json({ error: "User not found" });
      }
      
      await storage.updateUserBalance(req.params.id, balance);
      
      // Process deposit for VIP tier tracking if balance increased
      const depositAmount = balance - existingUser.balance;
      if (isDeposit || depositAmount > 0) {
        await storage.processDeposit(req.params.id, depositAmount);
      }
      
      // Return updated user
      const updatedUser = await storage.getUser(req.params.id);
      res.json(updatedUser);
    } catch (error) {
      res.status(400).json({ error: "Failed to update balance" });
    }
  });

  // Update user stars balance (admin)
  app.post("/api/admin/users/:id/stars-balance", checkAdmin, async (req, res) => {
    try {
      const { starsBalance } = req.body;
      const existingUser = await storage.getUser(req.params.id);
      if (!existingUser) {
        return res.status(404).json({ error: "User not found" });
      }
      
      await storage.updateUserStarsBalance(req.params.id, starsBalance);
      
      // Return updated user
      const updatedUser = await storage.getUser(req.params.id);
      res.json(updatedUser);
    } catch (error) {
      res.status(400).json({ error: "Failed to update stars balance" });
    }
  });

  // Toggle admin status for a user
  app.post("/api/admin/users/:id/admin", checkAdmin, async (req, res) => {
    try {
      const { isAdmin } = req.body;
      const user = await storage.updateUserAdmin(req.params.id, isAdmin);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      res.json(user);
    } catch (error) {
      res.status(400).json({ error: "Failed to update admin status" });
    }
  });

  // Update user VIP tier (admin)
  app.post("/api/admin/users/:id/vip-tier", checkAdmin, async (req, res) => {
    try {
      const { vipTier } = req.body;
      const validTiers = ["none", "gold", "diamond", "godOfWin"];
      if (!validTiers.includes(vipTier)) {
        return res.status(400).json({ error: "Invalid VIP tier" });
      }
      const user = await storage.updateUserVipTier(req.params.id, vipTier);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      res.json(user);
    } catch (error) {
      res.status(400).json({ error: "Failed to update VIP tier" });
    }
  });

  // Delete all guest users (admin)
  app.delete("/api/admin/users/guests", checkAdmin, async (req, res) => {
    try {
      const allUsers = await storage.getAllUsers();
      const guestUsers = allUsers.filter(u => 
        u.username?.startsWith("guest_") || 
        u.firstName === "Guest"
      );
      
      let deletedCount = 0;
      for (const guest of guestUsers) {
        try {
          await storage.deleteUser(guest.id);
          deletedCount++;
        } catch (e) {
          console.error(`Failed to delete guest ${guest.id}:`, e);
        }
      }
      
      res.json({ 
        success: true, 
        deletedCount,
        message: `Deleted ${deletedCount} guest users`
      });
    } catch (error) {
      console.error("Failed to delete guest users:", error);
      res.status(500).json({ error: "Failed to delete guest users" });
    }
  });

  // ===== PROMO CODE ENDPOINTS =====

  // Apply promo code
  app.post("/api/promo/apply", async (req, res) => {
    try {
      const { userId, code } = req.body;
      
      if (!userId || !code) {
        return res.status(400).json({ error: "Требуется ID пользователя и промокод" });
      }

      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ error: "Пользователь не найден" });
      }

      const promo = await storage.getPromoCode(code.toUpperCase());
      if (!promo) {
        return res.status(400).json({ error: "Промокод не найден" });
      }

      if (!promo.isActive) {
        return res.status(400).json({ error: "Промокод неактивен" });
      }

      if (promo.maxUses && promo.maxUses > 0 && (promo.currentUses || 0) >= promo.maxUses) {
        return res.status(400).json({ error: "Лимит использований промокода исчерпан" });
      }

      const alreadyUsed = await storage.checkPromoCodeUsage(userId, promo.id);
      if (alreadyUsed) {
        return res.status(400).json({ error: "Вы уже использовали этот промокод" });
      }

      // Apply bonus based on reward type
      const rewardType = promo.rewardType || "usd";
      let newBalance = user.balance;
      let newStarsBalance = user.starsBalance || 0;
      
      if (rewardType === "stars") {
        newStarsBalance = newStarsBalance + promo.bonusAmount;
        await storage.updateUserStarsBalance(userId, newStarsBalance);
      } else {
        newBalance = user.balance + promo.bonusAmount;
        await storage.updateUserBalance(userId, newBalance);
      }
      
      await storage.incrementPromoCodeUsage(promo.id);
      await storage.recordPromoCodeUsage(userId, promo.id);

      res.json({ 
        success: true, 
        bonus: promo.bonusAmount,
        rewardType,
        newBalance,
        newStarsBalance
      });
    } catch (error) {
      console.error("Promo code error:", error);
      res.status(400).json({ error: "Не удалось применить промокод" });
    }
  });

  // Get all promo codes (admin)
  app.get("/api/admin/promo-codes", checkAdmin, async (req, res) => {
    try {
      const codes = await storage.getAllPromoCodes();
      res.json(codes);
    } catch (error) {
      res.status(400).json({ error: "Failed to get promo codes" });
    }
  });

  // Create promo code (admin)
  app.post("/api/admin/promo-codes", checkAdmin, async (req, res) => {
    try {
      const { code, bonusAmount, maxUses, rewardType } = req.body;
      const adminId = req.headers["x-admin-id"] as string;
      
      if (!code || !bonusAmount) {
        return res.status(400).json({ error: "Код и сумма бонуса обязательны" });
      }

      // Validate reward type
      const validRewardType = rewardType === "stars" ? "stars" : "usd";

      const existing = await storage.getPromoCode(code.toUpperCase());
      if (existing) {
        return res.status(400).json({ error: "Такой промокод уже существует" });
      }

      const promoCode = await storage.createPromoCode({
        code: code.toUpperCase(),
        bonusAmount,
        rewardType: validRewardType,
        maxUses: maxUses || 0,
        isActive: true,
        createdBy: adminId,
      });

      res.json(promoCode);
    } catch (error) {
      res.status(400).json({ error: "Failed to create promo code" });
    }
  });

  // ===== ACTIVITY & HISTORY ENDPOINTS =====

  // Update user last seen (called on every app open)
  app.post("/api/users/:id/heartbeat", async (req, res) => {
    try {
      const user = await storage.updateLastSeen(req.params.id);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      res.json({ success: true });
    } catch (error) {
      res.status(400).json({ error: "Failed to update activity" });
    }
  });

  // Update user preferred currency
  app.post("/api/users/:id/preferred-currency", async (req, res) => {
    try {
      const { currency } = req.body;
      if (!currency || !["usd", "stars"].includes(currency)) {
        return res.status(400).json({ error: "Invalid currency. Use 'usd' or 'stars'" });
      }
      const user = await storage.updateUserPreferredCurrency(req.params.id, currency);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      res.json(user);
    } catch (error) {
      res.status(400).json({ error: "Failed to update preferred currency" });
    }
  });

  // Get recently active users (admin)
  app.get("/api/admin/users/active", checkAdmin, async (req, res) => {
    try {
      const activeUsers = await storage.getRecentlyActiveUsers();
      res.json(activeUsers);
    } catch (error) {
      res.status(400).json({ error: "Failed to get active users" });
    }
  });

  // Get user game history (admin)
  app.get("/api/admin/users/:id/bets", checkAdmin, async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 50;
      const userBets = await storage.getUserBets(req.params.id, limit);
      res.json(userBets);
    } catch (error) {
      res.status(400).json({ error: "Failed to get user bets" });
    }
  });

  // Get user balance history (admin)
  app.get("/api/admin/users/:id/balance-history", checkAdmin, async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 50;
      const history = await storage.getBalanceHistory(req.params.id, limit);
      res.json(history);
    } catch (error) {
      res.status(400).json({ error: "Failed to get balance history" });
    }
  });

  // Get user withdrawals (admin)
  app.get("/api/admin/users/:id/withdrawals", checkAdmin, async (req, res) => {
    try {
      const userWithdrawals = await storage.getUserWithdrawals(req.params.id);
      res.json(userWithdrawals);
    } catch (error) {
      res.status(400).json({ error: "Failed to get user withdrawals" });
    }
  });

  // Get all recent bets (admin)
  app.get("/api/admin/bets", checkAdmin, async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 100;
      const recentBets = await storage.getRecentBets(limit);
      res.json(recentBets);
    } catch (error) {
      res.status(400).json({ error: "Failed to get bets" });
    }
  });

  // Get all balance history (admin)
  app.get("/api/admin/balance-history", checkAdmin, async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 100;
      const history = await storage.getAllBalanceHistory(limit);
      res.json(history);
    } catch (error) {
      res.status(400).json({ error: "Failed to get balance history" });
    }
  });

  // ============ POKER ENDPOINTS ============

  // Get all poker tables
  app.get("/api/poker/tables", async (req, res) => {
    try {
      const tables = await storage.getPokerTables();
      res.json(tables);
    } catch (error) {
      res.status(500).json({ error: "Failed to get poker tables" });
    }
  });

  // Get player's current seats (which tables they're sitting at)
  app.get("/api/poker/my-seats/:odejs", async (req, res) => {
    try {
      const { odejs } = req.params;
      const seats = await storage.getPlayerSeats(odejs);
      res.json(seats);
    } catch (error) {
      res.status(500).json({ error: "Failed to get player seats" });
    }
  });

  // Get specific poker table
  app.get("/api/poker/tables/:id", async (req, res) => {
    try {
      const table = await storage.getPokerTable(req.params.id);
      if (!table) {
        return res.status(404).json({ error: "Table not found" });
      }
      res.json(table);
    } catch (error) {
      res.status(500).json({ error: "Failed to get poker table" });
    }
  });

  // Sit at poker table - uses atomic acquireSeat to prevent race conditions
  app.post("/api/poker/tables/:id/sit", async (req, res) => {
    try {
      const { odejs, buyIn, seatNumber } = req.body;
      const tableId = req.params.id;

      // Validate odejs is provided
      if (!odejs) {
        return res.status(400).json({ error: "User ID required" });
      }

      const table = await storage.getPokerTable(tableId);
      if (!table) {
        return res.status(404).json({ error: "Table not found" });
      }

      // Validate buy-in
      if (buyIn < table.minBuyIn || buyIn > table.maxBuyIn) {
        return res.status(400).json({ error: "Invalid buy-in amount" });
      }

      // Check user balance
      console.log("Poker sit - odejs:", odejs, "buyIn:", buyIn);
      const user = await storage.getUser(odejs);
      console.log("User found:", user ? `id=${user.id}, balance=${user.balance}` : "null");
      if (!user || user.balance < buyIn) {
        console.log("Validation failed:", !user ? "no user" : `balance ${user.balance} < buyIn ${buyIn}`);
        return res.status(400).json({ error: "Insufficient balance" });
      }

      // Get current seats to find available seat number if not specified
      const seats = await storage.getTableSeats(tableId);
      const takenSeats = new Set(seats.map(s => s.seatNumber));
      
      // Use requested seat or find available
      let targetSeat = seatNumber;
      if (targetSeat === undefined || targetSeat === null) {
        for (let i = 0; i < table.maxSeats; i++) {
          if (!takenSeats.has(i)) {
            targetSeat = i;
            break;
          }
        }
      }

      if (targetSeat === undefined || targetSeat === null || targetSeat < 0) {
        return res.status(400).json({ error: "Table is full" });
      }

      // Use atomic acquireSeat to prevent race conditions
      const result = await storage.acquireSeat(tableId, odejs, targetSeat, buyIn);
      
      if (!result.success) {
        console.log("Acquire seat failed:", result.error);
        
        // If already seated, return existing seat info for recovery
        if (result.existingSeat) {
          return res.status(400).json({ 
            error: result.error, 
            seatNumber: result.existingSeat.seatNumber,
            chipStack: result.existingSeat.chipStack 
          });
        }
        
        return res.status(400).json({ error: result.error });
      }

      // Deduct buy-in from balance only after successful seat acquisition
      await storage.updateBalance(odejs, -buyIn, "poker_buyin", `Poker buy-in at ${table.name}`);
      
      // Recount seats from fresh data to prevent count drift
      const updatedSeats = await storage.getTableSeats(tableId);
      await storage.updateTablePlayerCount(tableId, updatedSeats.length);

      // Add player to PokerGameManager for WebSocket state broadcast
      const { getPokerManager } = await import("./poker/gameManager");
      try {
        const manager = getPokerManager();
        manager.getOrCreateTable(tableId, table.smallBlind, table.bigBlind, table.rakePercent, table.rakeCap);
        manager.addPlayer(tableId, {
          odejs,
          username: user.username || user.firstName || `Player ${targetSeat + 1}`,
          photoUrl: undefined,
          seatNumber: targetSeat,
          chipStack: buyIn,
          isSittingOut: false,
        });
        console.log(`Added player ${odejs} to manager at seat ${targetSeat}`);
      } catch (e) {
        console.error("Failed to add player to manager:", e);
      }

      res.json({ seatNumber: targetSeat, chipStack: buyIn });
    } catch (error) {
      console.error("Sit error:", error);
      res.status(500).json({ error: "Failed to sit at table" });
    }
  });

  // Leave poker table
  app.post("/api/poker/tables/:id/leave", async (req, res) => {
    try {
      const { odejs, seatNumber } = req.body;
      const tableId = req.params.id;

      // Get player's chip stack
      const seat = await storage.getPlayerSeat(tableId, odejs);
      if (!seat) {
        return res.status(400).json({ error: "Not at table" });
      }

      // Remove from PokerGameManager (this also handles chip return via onBalanceChange callback)
      const { getPokerManager } = await import("./poker/gameManager");
      let chipStackReturned = 0;
      let managerHandledReturn = false;
      
      try {
        const manager = getPokerManager();
        // Get current stack from manager (may differ from DB if mid-hand)
        const state = manager.getState(tableId, odejs);
        const playerState = state?.players.find(p => p.odejs === odejs);
        if (playerState) {
          chipStackReturned = playerState.chipStack;
          // Manager will handle balance return via onBalanceChange callback
          manager.removePlayer(tableId, seat.seatNumber);
          managerHandledReturn = true;
          console.log(`Removed player ${odejs} from manager at seat ${seat.seatNumber}, returned ${chipStackReturned}`);
        }
      } catch (e) {
        console.error("Failed to remove player from manager:", e);
      }

      // Only return chips manually if manager didn't handle it
      if (!managerHandledReturn && seat.chipStack > 0) {
        await storage.updateBalance(odejs, seat.chipStack, "poker_cashout", `Poker cashout`);
        chipStackReturned = seat.chipStack;
      }

      // Remove from DB table
      await storage.removePlayerFromTable(tableId, odejs);
      
      const seats = await storage.getTableSeats(tableId);
      await storage.updateTablePlayerCount(tableId, seats.length);

      res.json({ success: true, returned: chipStackReturned });
    } catch (error) {
      res.status(500).json({ error: "Failed to leave table" });
    }
  });

  // Rebuy - add chips when player has low stack
  app.post("/api/poker/tables/:id/rebuy", async (req, res) => {
    try {
      const { odejs, amount } = req.body;
      const tableId = req.params.id;

      // Get table info
      const table = await storage.getPokerTable(tableId);
      if (!table) {
        return res.status(404).json({ error: "Table not found" });
      }

      // Get player's seat
      const seat = await storage.getPlayerSeat(tableId, odejs);
      if (!seat) {
        return res.status(400).json({ error: "Not at table" });
      }

      // Get current chip stack from manager (source of truth during game)
      let currentStack = seat.chipStack;
      const { getPokerManager } = await import("./poker/gameManager");
      try {
        const manager = getPokerManager();
        const managerState = manager.getState(tableId, odejs);
        const playerState = managerState?.players.find(p => p.odejs === odejs);
        if (playerState) {
          currentStack = playerState.chipStack;
        }
      } catch (e) {
        // Use DB value if manager not available
      }

      // Check if player can rebuy (current stack < maxBuyIn)
      if (currentStack >= table.maxBuyIn) {
        return res.status(400).json({ error: "Stack at maximum limit" });
      }

      // Calculate maximum rebuy amount allowed
      const maxRebuyAmount = table.maxBuyIn - currentStack;
      
      // Validate rebuy amount - can't rebuy more than what's needed to reach maxBuyIn
      if (amount < table.minBuyIn) {
        return res.status(400).json({ error: "Minimum rebuy amount not met" });
      }
      if (amount > maxRebuyAmount) {
        return res.status(400).json({ error: `Maximum rebuy is $${maxRebuyAmount.toFixed(2)}` });
      }

      // Check user balance
      const user = await storage.getUser(odejs);
      if (!user || user.balance < amount) {
        return res.status(400).json({ error: "Insufficient balance" });
      }

      // Deduct from balance
      await storage.updateBalance(odejs, -amount, "poker_rebuy", `Poker rebuy at ${table.name}`);

      // Let manager calculate the new stack (in-memory is source of truth during game)
      let newStack = seat.chipStack + amount;
      
      // Use already imported manager from above
      try {
        const managerForRebuy = getPokerManager();
        const managerStack = managerForRebuy.rebuy(tableId, seat.seatNumber, amount);
        if (managerStack !== null) {
          newStack = managerStack;
        }
      } catch (e) {
        // Manager may not be initialized - use calculated stack
      }

      // Sync DB with the new stack from manager
      await storage.updateSeatChipStack(tableId, seat.seatNumber, newStack);

      res.json({ success: true, newStack });
    } catch (error) {
      console.error("Rebuy error:", error);
      res.status(500).json({ error: "Failed to rebuy" });
    }
  });

  // ============ ADMIN POKER CONTROLS ============

  // Admin: Kick player from table
  app.post("/api/admin/poker/tables/:id/kick", async (req, res) => {
    try {
      const adminId = req.headers["x-admin-id"] as string;
      if (!adminId) {
        return res.status(401).json({ error: "Admin ID required" });
      }
      const admin = await storage.getUser(adminId);
      if (!admin || (!admin.isAdmin && admin.username !== "Nahalist")) {
        return res.status(403).json({ error: "Admin access required" });
      }

      const tableId = req.params.id;
      const { seatNumber } = req.body;

      const { getPokerManager } = await import("./poker/gameManager");
      const manager = getPokerManager();
      
      const result = manager.kickPlayer(tableId, seatNumber);
      if (!result) {
        return res.status(404).json({ error: "Player not found" });
      }

      // Remove from database
      await storage.removePlayerFromTable(tableId, result.odejs);
      const seats = await storage.getTableSeats(tableId);
      await storage.updateTablePlayerCount(tableId, seats.length);

      res.json({ success: true, kicked: result });
    } catch (error) {
      console.error("Admin kick error:", error);
      res.status(500).json({ error: "Failed to kick player" });
    }
  });

  // Admin: Close table - kick all players
  app.post("/api/admin/poker/tables/:id/close", async (req, res) => {
    try {
      const adminId = req.headers["x-admin-id"] as string;
      if (!adminId) {
        return res.status(401).json({ error: "Admin ID required" });
      }
      const admin = await storage.getUser(adminId);
      if (!admin || (!admin.isAdmin && admin.username !== "Nahalist")) {
        return res.status(403).json({ error: "Admin access required" });
      }

      const tableId = req.params.id;

      const { getPokerManager } = await import("./poker/gameManager");
      const manager = getPokerManager();
      
      const result = manager.closeTable(tableId);

      // Clean up database for all kicked players
      for (const player of result.kicked) {
        await storage.removePlayerFromTable(tableId, player.odejs);
      }
      await storage.updateTablePlayerCount(tableId, 0);

      res.json({ success: true, kicked: result.kicked });
    } catch (error) {
      console.error("Admin close table error:", error);
      res.status(500).json({ error: "Failed to close table" });
    }
  });

  // Admin: Refresh table state
  app.post("/api/admin/poker/tables/:id/refresh", async (req, res) => {
    try {
      const adminId = req.headers["x-admin-id"] as string;
      if (!adminId) {
        return res.status(401).json({ error: "Admin ID required" });
      }
      const admin = await storage.getUser(adminId);
      if (!admin || (!admin.isAdmin && admin.username !== "Nahalist")) {
        return res.status(403).json({ error: "Admin access required" });
      }

      const tableId = req.params.id;

      const { getPokerManager } = await import("./poker/gameManager");
      const manager = getPokerManager();
      
      const success = manager.refreshTable(tableId);
      
      res.json({ success });
    } catch (error) {
      console.error("Admin refresh table error:", error);
      res.status(500).json({ error: "Failed to refresh table" });
    }
  });

  // Admin: Get total rake collected
  app.get("/api/admin/poker/rake", async (req, res) => {
    try {
      const adminId = req.headers["x-admin-id"] as string;
      if (!adminId) {
        return res.status(401).json({ error: "Admin ID required" });
      }
      const admin = await storage.getUser(adminId);
      if (!admin || (!admin.isAdmin && admin.username !== "Nahalist")) {
        return res.status(403).json({ error: "Admin access required" });
      }

      const { getPokerManager } = await import("./poker/gameManager");
      const manager = getPokerManager();
      
      const totalRake = manager.getTotalRake();
      
      res.json({ totalRake });
    } catch (error) {
      console.error("Get rake error:", error);
      res.status(500).json({ error: "Failed to get rake" });
    }
  });

  // ============ TOURNAMENTS ============
  
  // Get active tournaments
  app.get("/api/tournaments", async (req, res) => {
    try {
      const allTournaments = await storage.getActiveTournaments();
      res.json(allTournaments);
    } catch (error) {
      console.error("Get tournaments error:", error);
      res.status(500).json({ error: "Failed to get tournaments" });
    }
  });

  // Get tournament by ID with entries
  app.get("/api/tournaments/:id", async (req, res) => {
    try {
      const tournament = await storage.getTournament(req.params.id);
      if (!tournament) {
        return res.status(404).json({ error: "Tournament not found" });
      }
      const entries = await storage.getTournamentEntries(req.params.id);
      res.json({ tournament, entries });
    } catch (error) {
      console.error("Get tournament error:", error);
      res.status(500).json({ error: "Failed to get tournament" });
    }
  });

  // Join tournament
  app.post("/api/tournaments/:id/join", async (req, res) => {
    try {
      const { odejs } = req.body;
      const tournamentId = req.params.id;

      const tournament = await storage.getTournament(tournamentId);
      if (!tournament) {
        return res.status(404).json({ error: "Tournament not found" });
      }

      if (tournament.status !== "upcoming" && tournament.status !== "active") {
        return res.status(400).json({ error: "Tournament is not active" });
      }

      if (tournament.currentPlayers && tournament.maxPlayers && tournament.currentPlayers >= tournament.maxPlayers) {
        return res.status(400).json({ error: "Tournament is full" });
      }

      // Check if already joined
      const existing = await storage.getTournamentEntry(tournamentId, odejs);
      if (existing) {
        return res.status(400).json({ error: "Already joined this tournament" });
      }

      // Check entry fee
      if (tournament.entryFee > 0) {
        const user = await storage.getUser(odejs);
        if (!user || user.balance < tournament.entryFee) {
          return res.status(400).json({ error: "Insufficient balance for entry fee" });
        }
        // Deduct entry fee
        await storage.updateBalance(odejs, -tournament.entryFee, "tournament_entry", `Entry fee for ${tournament.name}`);
      }

      const entry = await storage.joinTournament(tournamentId, odejs);
      res.json({ success: true, entry });
    } catch (error) {
      console.error("Join tournament error:", error);
      res.status(500).json({ error: "Failed to join tournament" });
    }
  });

  // Check if user is in tournament
  app.get("/api/tournaments/:id/status/:userId", async (req, res) => {
    try {
      const entry = await storage.getTournamentEntry(req.params.id, req.params.userId);
      res.json({ joined: !!entry, entry });
    } catch (error) {
      res.status(500).json({ error: "Failed to check status" });
    }
  });

  // Admin: Create tournament
  app.post("/api/admin/tournaments", checkAdmin, async (req, res) => {
    try {
      const { name, nameRu, description, descriptionRu, gameType, entryFee, prizePool, minPlayers, maxPlayers, startAt, endAt, createdBy } = req.body;
      
      const tournament = await storage.createTournament({
        name,
        nameRu,
        description,
        descriptionRu,
        gameType,
        entryFee: entryFee || 0,
        prizePool,
        minPlayers: minPlayers || 2,
        maxPlayers: maxPlayers || 100,
        startAt: new Date(startAt),
        endAt: new Date(endAt),
        status: "upcoming",
        createdBy,
      });
      
      res.json(tournament);
    } catch (error) {
      console.error("Create tournament error:", error);
      res.status(500).json({ error: "Failed to create tournament" });
    }
  });

  // Admin: Get all tournaments
  app.get("/api/admin/tournaments", checkAdmin, async (req, res) => {
    try {
      const allTournaments = await storage.getTournaments();
      res.json(allTournaments);
    } catch (error) {
      res.status(500).json({ error: "Failed to get tournaments" });
    }
  });

  // Admin: Update tournament status
  app.post("/api/admin/tournaments/:id/status", checkAdmin, async (req, res) => {
    try {
      const { status } = req.body;
      const updated = await storage.updateTournamentStatus(req.params.id, status);
      if (!updated) {
        return res.status(404).json({ error: "Tournament not found" });
      }
      res.json(updated);
    } catch (error) {
      res.status(500).json({ error: "Failed to update tournament" });
    }
  });

  // ============ RAFFLE ROUTES (Розыгрыши) ============

  // Admin: Update deposit link
  app.post("/api/admin/deposit-link", checkAdmin, async (req, res) => {
    try {
      const { depositLink, updatedBy } = req.body;
      const updated = await storage.updateDepositLink(depositLink || "", updatedBy);
      res.json(updated);
    } catch (error) {
      console.error("Update deposit link error:", error);
      res.status(500).json({ error: "Failed to update deposit link" });
    }
  });

  // Admin: Update deposit addresses (TON and TRC20)
  app.post("/api/admin/settings/deposit-addresses", checkAdmin, async (req, res) => {
    try {
      const { ton, trc20 } = req.body;
      const adminId = req.headers["x-admin-id"] as string;
      const updated = await storage.updateDepositAddresses(ton || null, trc20 || null, adminId);
      res.json(updated);
    } catch (error) {
      console.error("Update deposit addresses error:", error);
      res.status(500).json({ error: "Failed to update deposit addresses" });
    }
  });

  // Admin: Update Telegram channel link
  app.post("/api/admin/settings/telegram-channel", checkAdmin, async (req, res) => {
    try {
      const { link } = req.body;
      const adminId = req.headers["x-admin-id"] as string;
      const updated = await storage.updateTelegramChannelLink(link || null, adminId);
      res.json(updated);
    } catch (error) {
      console.error("Update telegram channel link error:", error);
      res.status(500).json({ error: "Failed to update telegram channel link" });
    }
  });

  // Admin: Update games disabled status
  app.post("/api/admin/settings/games-disabled", checkAdmin, async (req, res) => {
    try {
      const { disabled, message } = req.body;
      const adminId = req.headers["x-admin-id"] as string;
      const updated = await storage.updateGamesDisabled(disabled, message || null, adminId);
      res.json(updated);
    } catch (error) {
      console.error("Update games disabled error:", error);
      res.status(500).json({ error: "Failed to update games disabled status" });
    }
  });

  // Admin: Delete chat message
  app.delete("/api/admin/chat/:messageId", checkAdmin, async (req, res) => {
    try {
      const { messageId } = req.params;
      const deleted = await storage.deleteChatMessage(messageId);
      if (deleted) {
        res.json({ success: true });
      } else {
        res.status(404).json({ error: "Message not found" });
      }
    } catch (error) {
      console.error("Delete chat message error:", error);
      res.status(500).json({ error: "Failed to delete message" });
    }
  });

  // Admin: Get all chat messages (for moderation)
  app.get("/api/admin/chat", checkAdmin, async (req, res) => {
    try {
      const messages = await storage.getChatMessages(100);
      res.json(messages);
    } catch (error) {
      res.status(500).json({ error: "Failed to get chat messages" });
    }
  });

  // Get active raffle (public)
  app.get("/api/raffles/active", async (req, res) => {
    try {
      const raffle = await storage.getActiveRaffle();
      res.json(raffle || null);
    } catch (error) {
      res.status(500).json({ error: "Failed to get active raffle" });
    }
  });

  // Get raffle by ID (public)
  app.get("/api/raffles/:id", async (req, res) => {
    try {
      const raffle = await storage.getRaffle(req.params.id);
      if (!raffle) {
        return res.status(404).json({ error: "Raffle not found" });
      }
      res.json(raffle);
    } catch (error) {
      res.status(500).json({ error: "Failed to get raffle" });
    }
  });

  // Get raffle winners
  app.get("/api/raffles/:id/winners", async (req, res) => {
    try {
      const winners = await storage.getRaffleWinners(req.params.id);
      res.json(winners);
    } catch (error) {
      res.status(500).json({ error: "Failed to get raffle winners" });
    }
  });

  // Get raffle entries
  app.get("/api/raffles/:id/entries", async (req, res) => {
    try {
      const entries = await storage.getRaffleEntries(req.params.id);
      res.json(entries);
    } catch (error) {
      res.status(500).json({ error: "Failed to get raffle entries" });
    }
  });

  // Join raffle
  app.post("/api/raffles/:id/join", async (req, res) => {
    try {
      const { odejs, username, firstName, vipTier } = req.body;
      const raffleId = req.params.id;
      
      // Check if raffle exists and is active
      const raffle = await storage.getRaffle(raffleId);
      if (!raffle) {
        return res.status(404).json({ error: "Raffle not found" });
      }
      if (raffle.status !== "active") {
        return res.status(400).json({ error: "Raffle is not active" });
      }

      // Check if already joined
      const existing = await storage.getRaffleEntry(raffleId, odejs);
      if (existing) {
        return res.status(400).json({ error: "Already joined this raffle" });
      }

      // Check VIP requirement
      if (raffle.requiredVipTier) {
        const user = await storage.getUser(odejs);
        if (!user) {
          return res.status(404).json({ error: "User not found" });
        }
        const tierOrder = ["", "gold", "diamond", "godOfWin"];
        const requiredIndex = tierOrder.indexOf(raffle.requiredVipTier);
        const userIndex = tierOrder.indexOf(user.vipTier || "");
        if (userIndex < requiredIndex) {
          return res.status(403).json({ error: "VIP tier requirement not met" });
        }
      }

      // Check minimum deposit requirement
      if (raffle.minDeposit && raffle.minDeposit > 0) {
        const user = await storage.getUser(odejs);
        if (!user || (user.totalDeposited || 0) < raffle.minDeposit) {
          return res.status(403).json({ error: "Minimum deposit requirement not met" });
        }
      }

      const entry = await storage.joinRaffle({
        raffleId,
        odejs,
        username: username || null,
        firstName: firstName || null,
        vipTier: vipTier || null,
      });

      res.json({ success: true, entry });
    } catch (error) {
      console.error("Join raffle error:", error);
      res.status(500).json({ error: "Failed to join raffle" });
    }
  });

  // Check user entry status
  app.get("/api/raffles/:id/status/:userId", async (req, res) => {
    try {
      const entry = await storage.getRaffleEntry(req.params.id, req.params.userId);
      res.json({ joined: !!entry, entry });
    } catch (error) {
      res.status(500).json({ error: "Failed to check status" });
    }
  });

  // Admin: Get all raffles
  app.get("/api/admin/raffles", checkAdmin, async (req, res) => {
    try {
      const allRaffles = await storage.getRaffles();
      res.json(allRaffles);
    } catch (error) {
      res.status(500).json({ error: "Failed to get raffles" });
    }
  });

  // Admin: Create raffle
  app.post("/api/admin/raffles", checkAdmin, async (req, res) => {
    try {
      const { name, nameRu, description, descriptionRu, prizeDescription, prizeDescriptionRu, maxWinners, minDeposit, requiredVipTier, createdBy } = req.body;
      
      const raffle = await storage.createRaffle({
        name,
        nameRu,
        description: description || null,
        descriptionRu: descriptionRu || null,
        prizeDescription: prizeDescription || null,
        prizeDescriptionRu: prizeDescriptionRu || null,
        maxWinners: maxWinners || 1,
        minDeposit: minDeposit || 0,
        requiredVipTier: requiredVipTier || null,
        status: "draft",
        createdBy,
      });
      
      res.json(raffle);
    } catch (error) {
      console.error("Create raffle error:", error);
      res.status(500).json({ error: "Failed to create raffle" });
    }
  });

  // Admin: Activate raffle
  app.post("/api/admin/raffles/:id/activate", checkAdmin, async (req, res) => {
    try {
      const updated = await storage.activateRaffle(req.params.id);
      if (!updated) {
        return res.status(404).json({ error: "Raffle not found" });
      }
      res.json(updated);
    } catch (error) {
      res.status(500).json({ error: "Failed to activate raffle" });
    }
  });

  // Admin: Update raffle status
  app.post("/api/admin/raffles/:id/status", checkAdmin, async (req, res) => {
    try {
      const { status } = req.body;
      const updated = await storage.updateRaffleStatus(req.params.id, status);
      if (!updated) {
        return res.status(404).json({ error: "Raffle not found" });
      }
      res.json(updated);
    } catch (error) {
      res.status(500).json({ error: "Failed to update raffle" });
    }
  });

  // Admin: Draw raffle winners (trigger wheel spin)
  app.post("/api/admin/raffles/:id/draw", checkAdmin, async (req, res) => {
    try {
      const { endedBy } = req.body;
      const raffleId = req.params.id;
      
      // First, mark as spinning
      await storage.endRaffle(raffleId, endedBy);
      
      // Then draw winners
      const winners = await storage.drawRaffleWinners(raffleId, endedBy);
      
      res.json({ success: true, winners });
    } catch (error) {
      console.error("Draw raffle error:", error);
      res.status(500).json({ error: "Failed to draw winners" });
    }
  });

  // Admin: Upload photo for broadcast
  app.post("/api/admin/broadcast/upload-photo", checkAdmin, broadcastUpload.single("photo"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No photo uploaded" });
      }
      // Return only the filename, not the full path for security
      res.json({ 
        success: true, 
        photoId: req.file.filename 
      });
    } catch (error) {
      console.error("Photo upload error:", error);
      res.status(500).json({ error: "Failed to upload photo" });
    }
  });

  // Admin: Send promotional message to users
  app.post("/api/admin/broadcast", checkAdmin, async (req, res) => {
    try {
      const { message, withPhoto, customPhotoId } = req.body;
      
      if (!message || typeof message !== "string") {
        return res.status(400).json({ error: "Message is required" });
      }
      
      // Validate message length (Telegram limit is 4096 chars, but we cap at 2000 for captions)
      if (message.length > 2000) {
        return res.status(400).json({ error: "Message too long (max 2000 chars)" });
      }
      
      const bot = getBot();
      if (!bot) {
        return res.status(503).json({ error: "Telegram bot not initialized" });
      }
      
      // Get all users with telegram IDs
      const users = await storage.getAllUsers();
      const telegramIds = users
        .filter(u => u.telegramId)
        .map(u => u.telegramId!);
      
      if (telegramIds.length === 0) {
        return res.status(400).json({ error: "No users to send to" });
      }
      
      let photoPath: string | undefined;
      if (customPhotoId && typeof customPhotoId === "string") {
        // Validate filename - only allow alphanumeric, underscores, dashes, and valid extensions
        const safeFilename = customPhotoId.replace(/[^a-zA-Z0-9_\-\.]/g, "");
        if (safeFilename !== customPhotoId || customPhotoId.includes("..")) {
          return res.status(400).json({ error: "Invalid photo ID" });
        }
        // Construct safe path within uploads directory only
        const uploadDir = path.join(process.cwd(), "uploads/broadcast");
        const candidatePath = path.join(uploadDir, safeFilename);
        // Ensure path doesn't escape uploads directory
        if (!candidatePath.startsWith(uploadDir) || !fs.existsSync(candidatePath)) {
          return res.status(400).json({ error: "Photo not found" });
        }
        photoPath = candidatePath;
      } else if (withPhoto) {
        // Use default photo
        photoPath = path.join(process.cwd(), "attached_assets/IMG_7891_1766156100514.jpeg");
        if (!fs.existsSync(photoPath)) {
          photoPath = path.join(process.cwd(), "attached_assets/generated_images/pile_of_money_casino_style.png");
          if (!fs.existsSync(photoPath)) {
            photoPath = undefined;
          }
        }
      }
      
      const results = await sendPromotionalMessage(telegramIds, message, photoPath);
      
      const successful = results.filter(r => r.success).length;
      const failed = results.filter(r => !r.success).length;
      
      res.json({ 
        success: true, 
        sent: successful, 
        failed,
        total: telegramIds.length 
      });
    } catch (error) {
      console.error("Broadcast error:", error);
      res.status(500).json({ error: "Failed to send broadcast" });
    }
  });

  // Admin: Test send single message
  app.post("/api/admin/broadcast/test", checkAdmin, async (req, res) => {
    try {
      const { telegramId, message, withPhoto } = req.body;
      
      if (!telegramId || !message) {
        return res.status(400).json({ error: "telegramId and message required" });
      }
      
      const bot = getBot();
      if (!bot) {
        return res.status(503).json({ error: "Telegram bot not initialized" });
      }
      
      let photoPath: string | undefined;
      if (withPhoto) {
        photoPath = path.join(process.cwd(), "attached_assets/IMG_7891_1766156100514.jpeg");
        if (!fs.existsSync(photoPath)) {
          photoPath = path.join(process.cwd(), "attached_assets/generated_images/pile_of_money_casino_style.png");
        }
      }
      
      const results = await sendPromotionalMessage([telegramId], message, photoPath);
      
      res.json({ success: results[0]?.success, error: results[0]?.error });
    } catch (error) {
      console.error("Test broadcast error:", error);
      res.status(500).json({ error: "Failed to send test message" });
    }
  });

  // ============ SPIN & GO ROUTES ============
  
  // Get all Spin&Go queues status
  app.get("/api/spingo/queues", async (req, res) => {
    try {
      const { getSpinGoManager } = await import("./poker/spinGoManager");
      const manager = getSpinGoManager();
      if (!manager) {
        return res.json([]);
      }
      res.json(manager.getAllQueues());
    } catch (error) {
      console.error("Get Spin&Go queues error:", error);
      res.status(500).json({ error: "Failed to get queues" });
    }
  });

  // Register for Spin&Go queue
  app.post("/api/spingo/register", async (req, res) => {
    try {
      const { configId, odejs, username, photoUrl } = req.body;
      
      if (!configId || !odejs || !username) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      // Check user balance
      const user = await storage.getUser(odejs);
      const config = (await import("@shared/schema")).spinGoConfigs.find(c => c.id === configId);
      
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      
      if (!config) {
        return res.status(400).json({ error: "Invalid Spin&Go configuration" });
      }
      
      if (user.balance < config.buyIn) {
        return res.status(400).json({ error: "Insufficient balance" });
      }

      const { getSpinGoManager } = await import("./poker/spinGoManager");
      const manager = getSpinGoManager();
      
      if (!manager) {
        return res.status(503).json({ error: "Spin&Go manager not initialized" });
      }

      const result = manager.registerPlayer(configId, odejs, username, photoUrl);
      
      if (!result.success) {
        return res.status(400).json({ error: result.error });
      }

      // Deduct buy-in
      await storage.updateBalance(odejs, -config.buyIn, "spingo_buyin", `Spin&Go $${config.buyIn} buy-in`);
      
      res.json({ 
        success: true, 
        queuePosition: result.queuePosition,
        buyIn: config.buyIn
      });
    } catch (error) {
      console.error("Spin&Go register error:", error);
      res.status(500).json({ error: "Failed to register for Spin&Go" });
    }
  });

  // Unregister from Spin&Go queue
  app.post("/api/spingo/unregister", async (req, res) => {
    try {
      const { configId, odejs } = req.body;
      
      if (!configId || !odejs) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      const { getSpinGoManager } = await import("./poker/spinGoManager");
      const manager = getSpinGoManager();
      
      if (!manager) {
        return res.status(503).json({ error: "Spin&Go manager not initialized" });
      }

      const config = (await import("@shared/schema")).spinGoConfigs.find(c => c.id === configId);
      const success = manager.unregisterPlayer(configId, odejs);
      
      if (success && config) {
        // Refund buy-in
        await storage.updateBalance(odejs, config.buyIn, "spingo_refund", `Spin&Go $${config.buyIn} refund`);
      }
      
      res.json({ success });
    } catch (error) {
      console.error("Spin&Go unregister error:", error);
      res.status(500).json({ error: "Failed to unregister from Spin&Go" });
    }
  });

  // Get player's current Spin&Go status
  app.get("/api/spingo/status/:userId", async (req, res) => {
    try {
      const { userId } = req.params;
      
      const { getSpinGoManager } = await import("./poker/spinGoManager");
      const manager = getSpinGoManager();
      
      if (!manager) {
        return res.json({ inQueue: false, inMatch: false });
      }

      const queueStatus = manager.isPlayerInQueue(userId);
      const match = manager.getPlayerMatch(userId);
      
      res.json({
        inQueue: queueStatus.inQueue,
        queueConfigId: queueStatus.configId,
        queuePosition: queueStatus.position,
        inMatch: !!match,
        match: match ? {
          matchId: match.matchId,
          multiplier: match.multiplier,
          prizePool: match.prizePool,
          status: match.status,
          tableId: match.tableId,
          players: match.players.map(p => ({ username: p.username, photoUrl: p.photoUrl }))
        } : null
      });
    } catch (error) {
      console.error("Spin&Go status error:", error);
      res.status(500).json({ error: "Failed to get status" });
    }
  });

  // Get specific match info
  app.get("/api/spingo/match/:matchId", async (req, res) => {
    try {
      const { matchId } = req.params;
      
      const { getSpinGoManager } = await import("./poker/spinGoManager");
      const manager = getSpinGoManager();
      
      if (!manager) {
        return res.status(404).json({ error: "Match not found" });
      }

      const match = manager.getMatch(matchId);
      
      if (!match) {
        return res.status(404).json({ error: "Match not found" });
      }
      
      res.json(match);
    } catch (error) {
      console.error("Get Spin&Go match error:", error);
      res.status(500).json({ error: "Failed to get match" });
    }
  });

  const httpServer = createServer(app);
  
  // Initialize WebSocket server
  gameSocket.setup(httpServer);

  return httpServer;
}
