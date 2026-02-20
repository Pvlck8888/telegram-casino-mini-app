import { type User, type InsertUser, type Bet, type InsertBet, type Withdrawal, type InsertWithdrawal, type Settings, type PromoCode, type InsertPromoCode, type PromoCodeUsage, type BalanceHistory, type PokerTable, type PokerSeat, type Tournament, type InsertTournament, type TournamentEntry, type InsertTournamentEntry, type ChatMessage, type InsertChatMessage, type Raffle, type InsertRaffle, type RaffleEntry, type InsertRaffleEntry, type RaffleWinner, type UserSlotSession, users, bets, withdrawals, settings, promoCodes, promoCodeUsage, balanceHistory, pokerTables, pokerSeats, tournaments, tournamentEntries, chatMessages, raffles, raffleEntries, raffleWinners, userSlotSessions, calculateVipTier, hasVipChatAccess } from "@shared/schema";
import { db } from "./db";
import { eq, desc, and, gte, lte, or, sql } from "drizzle-orm";
import { randomUUID } from "crypto";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByTelegramId(telegramId: string): Promise<User | undefined>;
  getUserByReferralCode(referralCode: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  deleteUser(id: string): Promise<boolean>;
  updateUserBalance(id: string, balance: number): Promise<User | undefined>;
  updateUserStarsBalance(id: string, starsBalance: number): Promise<User | undefined>;
  updateUserPreferredCurrency(id: string, currency: string): Promise<User | undefined>;
  updateUserWallet(id: string, walletAddress: string): Promise<User | undefined>;
  updateUserReferralCode(id: string, referralCode: string): Promise<User | undefined>;
  incrementReferralCount(id: string): Promise<User | undefined>;
  updateUserAdmin(id: string, isAdmin: boolean): Promise<User | undefined>;
  createBet(bet: InsertBet): Promise<Bet>;
  getUserBets(odejs: string, limit?: number): Promise<Bet[]>;
  getRecentBets(limit?: number): Promise<Bet[]>;
  createWithdrawal(withdrawal: InsertWithdrawal): Promise<Withdrawal>;
  getPendingWithdrawals(): Promise<Withdrawal[]>;
  getAllWithdrawals(): Promise<Withdrawal[]>;
  processWithdrawal(id: string, status: string, processedBy: string): Promise<Withdrawal | undefined>;
  getSettings(): Promise<Settings>;
  updateWinRate(winRatePercent: number, updatedBy: string): Promise<Settings>;
  updateLuxeRtp(luxeRtpPercent: number, updatedBy: string): Promise<Settings>;
  updateMinedropRtp(minedropRtpPercent: number, updatedBy: string): Promise<Settings>;
  updateWinLimitSettings(settings: {
    winLimitEnabled?: boolean;
    maxWinMultiplier?: number;
    maxAbsoluteWin?: number;
    lossRecoveryPercent?: number;
  }, updatedBy: string): Promise<Settings>;
  getAllUsers(): Promise<User[]>;
  // Promo codes
  getPromoCode(code: string): Promise<PromoCode | undefined>;
  getPromoCodeById(id: string): Promise<PromoCode | undefined>;
  createPromoCode(promoCode: InsertPromoCode): Promise<PromoCode>;
  getAllPromoCodes(): Promise<PromoCode[]>;
  incrementPromoCodeUsage(id: string): Promise<PromoCode | undefined>;
  checkPromoCodeUsage(odejs: string, promoCodeId: string): Promise<boolean>;
  recordPromoCodeUsage(odejs: string, promoCodeId: string): Promise<PromoCodeUsage>;
  // User activity & balance history
  updateLastSeen(id: string): Promise<User | undefined>;
  getRecentlyActiveUsers(): Promise<User[]>;
  addBalanceHistory(odejs: string, amount: number, balanceAfter: number, type: string, description?: string): Promise<BalanceHistory>;
  getBalanceHistory(odejs: string, limit?: number): Promise<BalanceHistory[]>;
  getAllBalanceHistory(limit?: number): Promise<BalanceHistory[]>;
  getUserWithdrawals(odejs: string): Promise<Withdrawal[]>;
  // Poker
  getPokerTables(): Promise<PokerTable[]>;
  getPokerTable(id: string): Promise<PokerTable | undefined>;
  getTableSeats(tableId: string): Promise<PokerSeat[]>;
  getPlayerSeat(tableId: string, odejs: string): Promise<PokerSeat | undefined>;
  getPlayerSeats(odejs: string): Promise<PokerSeat[]>;
  addPlayerToTable(tableId: string, odejs: string, seatNumber: number, chipStack: number): Promise<PokerSeat>;
  removePlayerFromTable(tableId: string, odejs: string): Promise<void>;
  updateTablePlayerCount(tableId: string, count: number): Promise<void>;
  updatePlayerChipStack(tableId: string, odejs: string, chipStack: number): Promise<void>;
  updateSeatChipStack(tableId: string, seatNumber: number, chipStack: number): Promise<void>;
  updateBalance(odejs: string, amount: number, type: string, description?: string): Promise<User | undefined>;
  updateBalanceWithCurrency(odejs: string, amount: number, currency: "usd" | "stars", type: string, description?: string): Promise<User | undefined>;
  getUserBalance(odejs: string, currency: "usd" | "stars"): Promise<number>;
  setUserBalance(odejs: string, balance: number, currency: "usd" | "stars"): Promise<User | undefined>;
  // Atomic seat acquisition to prevent race conditions
  acquireSeat(tableId: string, odejs: string, seatNumber: number, chipStack: number): Promise<{ success: boolean; seat?: PokerSeat; error?: string; existingSeat?: PokerSeat }>;
  // Referral commission
  processReferralCommission(userId: string, lostAmount: number): Promise<void>;
  withdrawReferralBalance(userId: string): Promise<{ success: boolean; error?: string; newBalance?: number; newReferralBalance?: number }>;
  // Tournaments
  getTournaments(): Promise<Tournament[]>;
  getActiveTournaments(): Promise<Tournament[]>;
  getTournament(id: string): Promise<Tournament | undefined>;
  createTournament(tournament: InsertTournament): Promise<Tournament>;
  updateTournamentStatus(id: string, status: string): Promise<Tournament | undefined>;
  updateTournamentPlayers(id: string, delta: number): Promise<Tournament | undefined>;
  getTournamentEntries(tournamentId: string): Promise<TournamentEntry[]>;
  getTournamentEntry(tournamentId: string, userId: string): Promise<TournamentEntry | undefined>;
  joinTournament(tournamentId: string, userId: string): Promise<TournamentEntry>;
  updateTournamentScore(tournamentId: string, userId: string, wagered: number, isWin: boolean): Promise<TournamentEntry | undefined>;
  // VIP Chat
  getChatMessages(limit?: number): Promise<ChatMessage[]>;
  createChatMessage(message: InsertChatMessage): Promise<ChatMessage>;
  getLastUserMessage(odejs: string): Promise<ChatMessage | undefined>;
  deleteChatMessage(id: string): Promise<boolean>;
  // Games disable
  updateGamesDisabled(disabled: boolean, message: string | null, updatedBy: string): Promise<Settings>;
  updateUserVipStatus(id: string, isVip: boolean): Promise<User | undefined>;
  updateUserVipTier(id: string, vipTier: string): Promise<User | undefined>;
  // Daily wheel
  spinWheel(id: string, prize: number): Promise<{ success: boolean; user?: User; error?: string; nextSpinAt?: Date }>;
  // VIP Tier system
  processDeposit(id: string, amount: number): Promise<User | undefined>;
  // Settings
  updateDepositLink(depositLink: string, updatedBy: string): Promise<Settings>;
  updateDepositAddresses(ton: string | null, trc20: string | null, updatedBy: string): Promise<Settings>;
  updateTelegramChannelLink(link: string | null, updatedBy: string): Promise<Settings>;
  // Poker Bot Settings
  updatePokerBotSettings(settings: {
    pokerBotsEnabled?: boolean;
    pokerBotJoinMode?: string;
    pokerBot1Name?: string;
    pokerBot2Name?: string;
    pokerBot3Name?: string;
    pokerBot1Style?: string;
    pokerBot2Style?: string;
    pokerBot3Style?: string;
    pokerBot1Enabled?: boolean;
    pokerBot2Enabled?: boolean;
    pokerBot3Enabled?: boolean;
    pokerBotWinRate?: number;
    // Budget tracking
    pokerBot1BudgetUsed?: number;
    pokerBot2BudgetUsed?: number;
    pokerBot3BudgetUsed?: number;
    pokerBotBudgetResetDate?: string;
  }, updatedBy: string): Promise<Settings>;
  // Raffles (Розыгрыши)
  getRaffles(): Promise<Raffle[]>;
  getActiveRaffle(): Promise<Raffle | undefined>;
  getRaffle(id: string): Promise<Raffle | undefined>;
  createRaffle(raffle: InsertRaffle): Promise<Raffle>;
  updateRaffleStatus(id: string, status: string): Promise<Raffle | undefined>;
  activateRaffle(id: string): Promise<Raffle | undefined>;
  endRaffle(id: string, endedBy: string): Promise<Raffle | undefined>;
  getRaffleEntries(raffleId: string): Promise<RaffleEntry[]>;
  getRaffleEntry(raffleId: string, odejs: string): Promise<RaffleEntry | undefined>;
  joinRaffle(entry: InsertRaffleEntry): Promise<RaffleEntry>;
  updateRaffleParticipants(id: string, delta: number): Promise<Raffle | undefined>;
  getRaffleWinners(raffleId: string): Promise<RaffleWinner[]>;
  addRaffleWinner(raffleId: string, odejs: string, username: string | null, firstName: string | null, rank: number, prizeNote?: string): Promise<RaffleWinner>;
  drawRaffleWinners(raffleId: string, endedBy: string): Promise<RaffleWinner[]>;
  // Slot session profit tracking
  getUserSlotSession(odejs: string, gameType: string): Promise<any | undefined>;
  createUserSlotSession(odejs: string, gameType: string): Promise<any>;
  updateUserSlotSession(odejs: string, gameType: string, wagered: number, won: number, profit: number): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByTelegramId(telegramId: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.telegramId, telegramId));
    return user;
  }

  async getUserByReferralCode(referralCode: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.referralCode, referralCode));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  async deleteUser(id: string): Promise<boolean> {
    try {
      await db.delete(users).where(eq(users.id, id));
      return true;
    } catch {
      return false;
    }
  }

  async updateUserBalance(id: string, balance: number): Promise<User | undefined> {
    const [user] = await db.update(users).set({ balance }).where(eq(users.id, id)).returning();
    return user;
  }

  async updateUserStarsBalance(id: string, starsBalance: number): Promise<User | undefined> {
    const [user] = await db.update(users).set({ starsBalance }).where(eq(users.id, id)).returning();
    return user;
  }

  async updateUserPreferredCurrency(id: string, currency: string): Promise<User | undefined> {
    const [user] = await db.update(users).set({ preferredCurrency: currency }).where(eq(users.id, id)).returning();
    return user;
  }

  async updateUserWallet(id: string, walletAddress: string): Promise<User | undefined> {
    const [user] = await db.update(users).set({ walletAddress }).where(eq(users.id, id)).returning();
    return user;
  }

  async updateUserReferralCode(id: string, referralCode: string): Promise<User | undefined> {
    const [user] = await db.update(users).set({ referralCode }).where(eq(users.id, id)).returning();
    return user;
  }

  async incrementReferralCount(id: string): Promise<User | undefined> {
    const currentUser = await this.getUser(id);
    if (!currentUser) return undefined;
    const newCount = (currentUser.referralCount || 0) + 1;
    const [user] = await db.update(users).set({ referralCount: newCount }).where(eq(users.id, id)).returning();
    return user;
  }

  async updateUserAdmin(id: string, isAdmin: boolean): Promise<User | undefined> {
    const [user] = await db.update(users).set({ isAdmin }).where(eq(users.id, id)).returning();
    return user;
  }

  async createBet(insertBet: InsertBet): Promise<Bet> {
    const [bet] = await db.insert(bets).values(insertBet).returning();
    return bet;
  }

  async getUserBets(odejs: string, limit: number = 10): Promise<Bet[]> {
    return db.select().from(bets).where(eq(bets.odejs, odejs)).orderBy(desc(bets.createdAt)).limit(limit);
  }

  async getRecentBets(limit: number = 20): Promise<Bet[]> {
    return db.select().from(bets).orderBy(desc(bets.createdAt)).limit(limit);
  }

  async createWithdrawal(insertWithdrawal: InsertWithdrawal): Promise<Withdrawal> {
    const [withdrawal] = await db.insert(withdrawals).values(insertWithdrawal).returning();
    return withdrawal;
  }

  async getPendingWithdrawals(): Promise<Withdrawal[]> {
    return db.select().from(withdrawals).where(eq(withdrawals.status, "pending")).orderBy(desc(withdrawals.createdAt));
  }

  async getAllWithdrawals(): Promise<Withdrawal[]> {
    return db.select().from(withdrawals).orderBy(desc(withdrawals.createdAt));
  }

  async processWithdrawal(id: string, status: string, processedBy: string): Promise<Withdrawal | undefined> {
    const [withdrawal] = await db.update(withdrawals)
      .set({ status, processedBy, processedAt: new Date() })
      .where(eq(withdrawals.id, id))
      .returning();
    return withdrawal;
  }

  async getSettings(): Promise<Settings> {
    const [existing] = await db.select().from(settings).where(eq(settings.id, "global"));
    if (existing) return existing;
    const [newSettings] = await db.insert(settings).values({ id: "global", winRatePercent: 50 }).returning();
    return newSettings;
  }

  async updateWinRate(winRatePercent: number, updatedBy: string): Promise<Settings> {
    const [updated] = await db.update(settings)
      .set({ winRatePercent, updatedBy, updatedAt: new Date() })
      .where(eq(settings.id, "global"))
      .returning();
    if (updated) return updated;
    const [newSettings] = await db.insert(settings).values({ id: "global", winRatePercent, updatedBy }).returning();
    return newSettings;
  }

  async updateLuxeRtp(luxeRtpPercent: number, updatedBy: string): Promise<Settings> {
    const [updated] = await db.update(settings)
      .set({ luxeRtpPercent, updatedBy, updatedAt: new Date() })
      .where(eq(settings.id, "global"))
      .returning();
    if (updated) return updated;
    const [newSettings] = await db.insert(settings).values({ id: "global", luxeRtpPercent, updatedBy, winRatePercent: 50 }).returning();
    return newSettings;
  }

  async updateMinedropRtp(minedropRtpPercent: number, updatedBy: string): Promise<Settings> {
    const [updated] = await db.update(settings)
      .set({ minedropRtpPercent, updatedBy, updatedAt: new Date() })
      .where(eq(settings.id, "global"))
      .returning();
    if (updated) return updated;
    const [newSettings] = await db.insert(settings).values({ id: "global", minedropRtpPercent, updatedBy, winRatePercent: 50 }).returning();
    return newSettings;
  }

  async updateWinLimitSettings(limitSettings: {
    winLimitEnabled?: boolean;
    maxWinMultiplier?: number;
    maxAbsoluteWin?: number;
    lossRecoveryPercent?: number;
  }, updatedBy: string): Promise<Settings> {
    const updateData: Partial<Settings> = { updatedBy, updatedAt: new Date() };
    if (limitSettings.winLimitEnabled !== undefined) updateData.winLimitEnabled = limitSettings.winLimitEnabled;
    if (limitSettings.maxWinMultiplier !== undefined) updateData.maxWinMultiplier = limitSettings.maxWinMultiplier;
    if (limitSettings.maxAbsoluteWin !== undefined) updateData.maxAbsoluteWin = limitSettings.maxAbsoluteWin;
    if (limitSettings.lossRecoveryPercent !== undefined) updateData.lossRecoveryPercent = limitSettings.lossRecoveryPercent;
    
    const [updated] = await db.update(settings)
      .set(updateData)
      .where(eq(settings.id, "global"))
      .returning();
    if (updated) return updated;
    const [newSettings] = await db.insert(settings).values({ id: "global", ...updateData, winRatePercent: 50 }).returning();
    return newSettings;
  }

  async getAllUsers(): Promise<User[]> {
    return db.select().from(users).orderBy(desc(users.balance));
  }

  // Promo codes
  async getPromoCode(code: string): Promise<PromoCode | undefined> {
    const [promo] = await db.select().from(promoCodes).where(eq(promoCodes.code, code));
    return promo;
  }

  async getPromoCodeById(id: string): Promise<PromoCode | undefined> {
    const [promo] = await db.select().from(promoCodes).where(eq(promoCodes.id, id));
    return promo;
  }

  async createPromoCode(insertPromoCode: InsertPromoCode): Promise<PromoCode> {
    const [promo] = await db.insert(promoCodes).values(insertPromoCode).returning();
    return promo;
  }

  async getAllPromoCodes(): Promise<PromoCode[]> {
    return db.select().from(promoCodes).orderBy(desc(promoCodes.createdAt));
  }

  async incrementPromoCodeUsage(id: string): Promise<PromoCode | undefined> {
    const current = await this.getPromoCodeById(id);
    if (!current) return undefined;
    const [promo] = await db.update(promoCodes)
      .set({ currentUses: (current.currentUses || 0) + 1 })
      .where(eq(promoCodes.id, id))
      .returning();
    return promo;
  }

  async checkPromoCodeUsage(odejs: string, promoCodeId: string): Promise<boolean> {
    const [usage] = await db.select().from(promoCodeUsage)
      .where(and(eq(promoCodeUsage.odejs, odejs), eq(promoCodeUsage.promoCodeId, promoCodeId)));
    return !!usage;
  }

  async recordPromoCodeUsage(odejs: string, promoCodeId: string): Promise<PromoCodeUsage> {
    const [usage] = await db.insert(promoCodeUsage).values({ odejs, promoCodeId }).returning();
    return usage;
  }

  async updateLastSeen(id: string): Promise<User | undefined> {
    const [user] = await db.update(users).set({ lastSeenAt: new Date() }).where(eq(users.id, id)).returning();
    return user;
  }

  async getRecentlyActiveUsers(): Promise<User[]> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return db.select().from(users).where(gte(users.lastSeenAt, today)).orderBy(desc(users.lastSeenAt));
  }

  async addBalanceHistory(odejs: string, amount: number, balanceAfter: number, type: string, description?: string): Promise<BalanceHistory> {
    const [history] = await db.insert(balanceHistory).values({ odejs, amount, balanceAfter, type, description }).returning();
    return history;
  }

  async getBalanceHistory(odejs: string, limit: number = 50): Promise<BalanceHistory[]> {
    return db.select().from(balanceHistory).where(eq(balanceHistory.odejs, odejs)).orderBy(desc(balanceHistory.createdAt)).limit(limit);
  }

  async getAllBalanceHistory(limit: number = 100): Promise<BalanceHistory[]> {
    return db.select().from(balanceHistory).orderBy(desc(balanceHistory.createdAt)).limit(limit);
  }

  async getUserWithdrawals(odejs: string): Promise<Withdrawal[]> {
    return db.select().from(withdrawals).where(eq(withdrawals.odejs, odejs)).orderBy(desc(withdrawals.createdAt));
  }

  // ============ POKER FUNCTIONS ============

  async getPokerTables(): Promise<PokerTable[]> {
    return db.select().from(pokerTables).where(eq(pokerTables.isActive, true)).orderBy(pokerTables.bigBlind);
  }

  async getPokerTable(id: string): Promise<PokerTable | undefined> {
    const [table] = await db.select().from(pokerTables).where(eq(pokerTables.id, id));
    return table;
  }

  async getTableSeats(tableId: string): Promise<PokerSeat[]> {
    return db.select().from(pokerSeats).where(and(eq(pokerSeats.tableId, tableId), eq(pokerSeats.isActive, true)));
  }

  async getPlayerSeat(tableId: string, odejs: string): Promise<PokerSeat | undefined> {
    const [seat] = await db.select().from(pokerSeats).where(
      and(eq(pokerSeats.tableId, tableId), eq(pokerSeats.odejs, odejs), eq(pokerSeats.isActive, true))
    );
    return seat;
  }

  async getPlayerSeats(odejs: string): Promise<PokerSeat[]> {
    return db.select().from(pokerSeats).where(
      and(eq(pokerSeats.odejs, odejs), eq(pokerSeats.isActive, true))
    );
  }

  async addPlayerToTable(tableId: string, odejs: string, seatNumber: number, chipStack: number): Promise<PokerSeat> {
    const [seat] = await db.insert(pokerSeats).values({
      tableId,
      odejs,
      seatNumber,
      chipStack,
    }).returning();
    return seat;
  }

  // Atomic seat acquisition using INSERT ON CONFLICT for true atomicity
  async acquireSeat(tableId: string, odejs: string, seatNumber: number, chipStack: number): Promise<{ success: boolean; seat?: PokerSeat; error?: string; existingSeat?: PokerSeat }> {
    try {
      // First check if player already has an active seat at this table
      const existingPlayerSeat = await db.select().from(pokerSeats).where(
        and(eq(pokerSeats.tableId, tableId), eq(pokerSeats.odejs, odejs), eq(pokerSeats.isActive, true))
      );
      
      if (existingPlayerSeat.length > 0) {
        return { 
          success: false, 
          error: "Already seated at this table", 
          existingSeat: existingPlayerSeat[0] 
        };
      }

      // Check if the target seat is already taken
      const existingTargetSeat = await db.select().from(pokerSeats).where(
        and(eq(pokerSeats.tableId, tableId), eq(pokerSeats.seatNumber, seatNumber), eq(pokerSeats.isActive, true))
      );
      
      if (existingTargetSeat.length > 0) {
        return { success: false, error: "Seat is taken" };
      }

      // Atomic INSERT - unique indexes will reject duplicates at DB level
      const [seat] = await db.insert(pokerSeats).values({
        tableId,
        odejs,
        seatNumber,
        chipStack,
      }).returning();

      return { success: true, seat };
    } catch (error: any) {
      // Handle unique constraint violations from partial indexes
      if (error.code === '23505') {
        const errorDetail = error.detail || '';
        const constraintName = error.constraint || '';
        
        // Player already seated (idx_active_player constraint)
        if (errorDetail.includes('user_id') || constraintName.includes('active_player')) {
          const playerSeat = await db.select().from(pokerSeats).where(
            and(eq(pokerSeats.tableId, tableId), eq(pokerSeats.odejs, odejs), eq(pokerSeats.isActive, true))
          );
          if (playerSeat.length > 0) {
            return { 
              success: false, 
              error: "Already seated at this table", 
              existingSeat: playerSeat[0] 
            };
          }
        }
        
        // Seat number was taken (idx_active_seat constraint) 
        if (errorDetail.includes('seat_number') || constraintName.includes('active_seat')) {
          return { success: false, error: "Seat was just taken by another player" };
        }
        
        // Generic conflict - re-check player seat for recovery
        const playerSeat = await db.select().from(pokerSeats).where(
          and(eq(pokerSeats.tableId, tableId), eq(pokerSeats.odejs, odejs), eq(pokerSeats.isActive, true))
        );
        if (playerSeat.length > 0) {
          return { 
            success: false, 
            error: "Already seated at this table", 
            existingSeat: playerSeat[0] 
          };
        }
        
        return { success: false, error: "Seat conflict - please try again" };
      }
      throw error;
    }
  }

  async removePlayerFromTable(tableId: string, odejs: string): Promise<void> {
    await db.update(pokerSeats)
      .set({ isActive: false })
      .where(and(eq(pokerSeats.tableId, tableId), eq(pokerSeats.odejs, odejs)));
  }

  async updateTablePlayerCount(tableId: string, count: number): Promise<void> {
    await db.update(pokerTables).set({ currentPlayers: count }).where(eq(pokerTables.id, tableId));
  }

  async updatePlayerChipStack(tableId: string, odejs: string, chipStack: number): Promise<void> {
    await db.update(pokerSeats)
      .set({ chipStack })
      .where(and(eq(pokerSeats.tableId, tableId), eq(pokerSeats.odejs, odejs), eq(pokerSeats.isActive, true)));
  }

  async updateSeatChipStack(tableId: string, seatNumber: number, chipStack: number): Promise<void> {
    await db.update(pokerSeats)
      .set({ chipStack })
      .where(and(eq(pokerSeats.tableId, tableId), eq(pokerSeats.seatNumber, seatNumber), eq(pokerSeats.isActive, true)));
  }

  async updateBalance(odejs: string, amount: number, type: string, description?: string): Promise<User | undefined> {
    const user = await this.getUser(odejs);
    if (!user) return undefined;
    const newBalance = Math.max(0, user.balance + amount);
    await this.updateUserBalance(odejs, newBalance);
    await this.addBalanceHistory(odejs, amount, newBalance, type, description);
    return this.getUser(odejs);
  }

  async updateBalanceWithCurrency(odejs: string, amount: number, currency: "usd" | "stars", type: string, description?: string): Promise<User | undefined> {
    const user = await this.getUser(odejs);
    if (!user) return undefined;
    
    if (currency === "stars") {
      const newBalance = Math.max(0, (user.starsBalance || 0) + amount);
      await db.update(users).set({ starsBalance: newBalance }).where(eq(users.id, odejs));
      await this.addBalanceHistory(odejs, amount, newBalance, type, `[STARS] ${description || ""}`);
    } else {
      const newBalance = Math.max(0, user.balance + amount);
      await this.updateUserBalance(odejs, newBalance);
      await this.addBalanceHistory(odejs, amount, newBalance, type, description);
    }
    return this.getUser(odejs);
  }

  async getUserBalance(odejs: string, currency: "usd" | "stars"): Promise<number> {
    const user = await this.getUser(odejs);
    if (!user) return 0;
    return currency === "stars" ? (user.starsBalance || 0) : user.balance;
  }

  async setUserBalance(odejs: string, balance: number, currency: "usd" | "stars"): Promise<User | undefined> {
    const user = await this.getUser(odejs);
    if (!user) return undefined;
    
    if (currency === "stars") {
      await db.update(users).set({ starsBalance: Math.max(0, balance) }).where(eq(users.id, odejs));
    } else {
      await this.updateUserBalance(odejs, Math.max(0, balance));
    }
    return this.getUser(odejs);
  }

  async processReferralCommission(userId: string, lostAmount: number): Promise<void> {
    const user = await this.getUser(userId);
    if (!user || !user.referredBy) return;
    
    const referrer = await this.getUserByReferralCode(user.referredBy);
    if (!referrer) return;
    
    const commission = lostAmount * 0.15;
    if (commission <= 0) return;
    
    // Add to referral balance (separate from main balance, requires $50 to withdraw)
    const newReferralBalance = (referrer.referralBalance || 0) + commission;
    await db.update(users).set({ referralBalance: newReferralBalance }).where(eq(users.id, referrer.id));
    await this.addBalanceHistory(referrer.id, commission, referrer.balance, "referral_commission", `15% commission from referral loss (pending: $${newReferralBalance.toFixed(2)})`);
  }

  async withdrawReferralBalance(userId: string): Promise<{ success: boolean; error?: string; newBalance?: number; newReferralBalance?: number }> {
    const MIN_REFERRAL_WITHDRAW = 50;
    
    const user = await this.getUser(userId);
    if (!user) return { success: false, error: "User not found" };
    
    const referralBalance = user.referralBalance || 0;
    if (referralBalance < MIN_REFERRAL_WITHDRAW) {
      return { 
        success: false, 
        error: `Minimum $${MIN_REFERRAL_WITHDRAW} required. Current: $${referralBalance.toFixed(2)}`
      };
    }
    
    // Transfer referral balance to main balance
    const newBalance = user.balance + referralBalance;
    await db.update(users).set({ 
      balance: newBalance, 
      referralBalance: 0 
    }).where(eq(users.id, userId));
    
    await this.addBalanceHistory(userId, referralBalance, newBalance, "referral_withdraw", `Transferred $${referralBalance.toFixed(2)} from referral earnings`);
    
    return { success: true, newBalance, newReferralBalance: 0 };
  }

  // Tournament methods
  async getTournaments(): Promise<Tournament[]> {
    return db.select().from(tournaments).orderBy(desc(tournaments.startAt));
  }

  async getActiveTournaments(): Promise<Tournament[]> {
    const now = new Date();
    return db.select().from(tournaments).where(
      or(
        eq(tournaments.status, "upcoming"),
        eq(tournaments.status, "active")
      )
    ).orderBy(tournaments.startAt);
  }

  async getTournament(id: string): Promise<Tournament | undefined> {
    const [tournament] = await db.select().from(tournaments).where(eq(tournaments.id, id));
    return tournament;
  }

  async createTournament(tournament: InsertTournament): Promise<Tournament> {
    const [created] = await db.insert(tournaments).values(tournament).returning();
    return created;
  }

  async updateTournamentStatus(id: string, status: string): Promise<Tournament | undefined> {
    const [updated] = await db.update(tournaments).set({ status }).where(eq(tournaments.id, id)).returning();
    return updated;
  }

  async updateTournamentPlayers(id: string, delta: number): Promise<Tournament | undefined> {
    const [updated] = await db.update(tournaments)
      .set({ currentPlayers: sql`COALESCE(current_players, 0) + ${delta}` })
      .where(eq(tournaments.id, id))
      .returning();
    return updated;
  }

  async getTournamentEntries(tournamentId: string): Promise<TournamentEntry[]> {
    return db.select().from(tournamentEntries)
      .where(eq(tournamentEntries.tournamentId, tournamentId))
      .orderBy(desc(tournamentEntries.score));
  }

  async getTournamentEntry(tournamentId: string, userId: string): Promise<TournamentEntry | undefined> {
    const [entry] = await db.select().from(tournamentEntries)
      .where(and(eq(tournamentEntries.tournamentId, tournamentId), eq(tournamentEntries.odejs, userId)));
    return entry;
  }

  async joinTournament(tournamentId: string, userId: string): Promise<TournamentEntry> {
    const [entry] = await db.insert(tournamentEntries)
      .values({ tournamentId, odejs: userId })
      .returning();
    await this.updateTournamentPlayers(tournamentId, 1);
    return entry;
  }

  async updateTournamentScore(tournamentId: string, userId: string, wagered: number, isWin: boolean): Promise<TournamentEntry | undefined> {
    const [updated] = await db.update(tournamentEntries)
      .set({ 
        wagered: sql`COALESCE(wagered, 0) + ${wagered}`,
        wins: isWin ? sql`COALESCE(wins, 0) + 1` : sql`COALESCE(wins, 0)`,
        score: sql`COALESCE(score, 0) + ${wagered}`
      })
      .where(and(eq(tournamentEntries.tournamentId, tournamentId), eq(tournamentEntries.odejs, userId)))
      .returning();
    return updated;
  }

  // VIP Chat methods
  async getChatMessages(limit: number = 50): Promise<ChatMessage[]> {
    return db.select().from(chatMessages)
      .orderBy(desc(chatMessages.createdAt))
      .limit(limit);
  }

  async createChatMessage(message: InsertChatMessage): Promise<ChatMessage> {
    const [newMessage] = await db.insert(chatMessages)
      .values(message)
      .returning();
    return newMessage;
  }

  async getLastUserMessage(odejs: string): Promise<ChatMessage | undefined> {
    const [lastMessage] = await db.select().from(chatMessages)
      .where(eq(chatMessages.odejs, odejs))
      .orderBy(desc(chatMessages.createdAt))
      .limit(1);
    return lastMessage;
  }

  async deleteChatMessage(id: string): Promise<boolean> {
    const result = await db.delete(chatMessages)
      .where(eq(chatMessages.id, id))
      .returning();
    return result.length > 0;
  }

  async updateGamesDisabled(disabled: boolean, message: string | null, updatedBy: string): Promise<Settings> {
    const [updated] = await db.update(settings)
      .set({ 
        gamesDisabled: disabled, 
        gamesDisabledMessage: message,
        updatedAt: new Date(), 
        updatedBy 
      })
      .where(eq(settings.id, "global"))
      .returning();
    return updated;
  }

  async updateUserVipStatus(id: string, isVip: boolean): Promise<User | undefined> {
    const [updated] = await db.update(users)
      .set({ isVip })
      .where(eq(users.id, id))
      .returning();
    return updated;
  }

  async updateUserVipTier(id: string, vipTier: string): Promise<User | undefined> {
    const [updated] = await db.update(users)
      .set({ vipTier })
      .where(eq(users.id, id))
      .returning();
    return updated;
  }

  async spinWheel(id: string, prize: number): Promise<{ success: boolean; user?: User; error?: string; nextSpinAt?: Date }> {
    const user = await this.getUser(id);
    if (!user) return { success: false, error: "User not found" };

    const now = new Date();
    const lastSpin = user.lastWheelSpin;
    
    if (lastSpin) {
      const timeSinceLastSpin = now.getTime() - new Date(lastSpin).getTime();
      const twentyFourHours = 24 * 60 * 60 * 1000;
      
      if (timeSinceLastSpin < twentyFourHours) {
        const nextSpinAt = new Date(new Date(lastSpin).getTime() + twentyFourHours);
        return { success: false, error: "Already spun today", nextSpinAt };
      }
    }

    const newBalance = user.balance + prize;
    const [updated] = await db.update(users)
      .set({ 
        balance: newBalance,
        lastWheelSpin: now
      })
      .where(eq(users.id, id))
      .returning();

    if (prize > 0) {
      await this.addBalanceHistory(id, prize, newBalance, "wheel", `Daily wheel prize: $${prize}`);
    }

    return { success: true, user: updated };
  }

  async processDeposit(id: string, amount: number): Promise<User | undefined> {
    const user = await this.getUser(id);
    if (!user) return undefined;
    
    const newTotalDeposited = (user.totalDeposited || 0) + amount;
    const newVipTier = calculateVipTier(newTotalDeposited);
    const newIsVip = hasVipChatAccess(newVipTier);
    
    const [updated] = await db.update(users)
      .set({ 
        totalDeposited: newTotalDeposited,
        vipTier: newVipTier,
        isVip: newIsVip
      })
      .where(eq(users.id, id))
      .returning();
    return updated;
  }

  // Settings - update deposit link
  async updateDepositLink(depositLink: string, updatedBy: string): Promise<Settings> {
    const [updated] = await db.update(settings)
      .set({ depositLink, updatedAt: new Date(), updatedBy })
      .where(eq(settings.id, "global"))
      .returning();
    return updated;
  }

  async updateDepositAddresses(ton: string | null, trc20: string | null, updatedBy: string): Promise<Settings> {
    const [updated] = await db.update(settings)
      .set({ depositAddressTon: ton, depositAddressTrc20: trc20, updatedAt: new Date(), updatedBy })
      .where(eq(settings.id, "global"))
      .returning();
    return updated;
  }

  async updateTelegramChannelLink(link: string | null, updatedBy: string): Promise<Settings> {
    const [updated] = await db.update(settings)
      .set({ telegramChannelLink: link, updatedAt: new Date(), updatedBy })
      .where(eq(settings.id, "global"))
      .returning();
    return updated;
  }

  async updatePokerBotSettings(botSettings: {
    pokerBotsEnabled?: boolean;
    pokerBotJoinMode?: string;
    pokerBot1Name?: string;
    pokerBot2Name?: string;
    pokerBot3Name?: string;
    pokerBot1Style?: string;
    pokerBot2Style?: string;
    pokerBot3Style?: string;
    pokerBot1Enabled?: boolean;
    pokerBot2Enabled?: boolean;
    pokerBot3Enabled?: boolean;
    pokerBotWinRate?: number;
    pokerBot1BudgetUsed?: number;
    pokerBot2BudgetUsed?: number;
    pokerBot3BudgetUsed?: number;
    pokerBotBudgetResetDate?: string;
  }, updatedBy: string): Promise<Settings> {
    const [updated] = await db.update(settings)
      .set({ ...botSettings, updatedAt: new Date(), updatedBy })
      .where(eq(settings.id, "global"))
      .returning();
    return updated;
  }

  // ============ RAFFLE METHODS ============

  async getRaffles(): Promise<Raffle[]> {
    return db.select().from(raffles).orderBy(desc(raffles.createdAt));
  }

  async getActiveRaffle(): Promise<Raffle | undefined> {
    const [raffle] = await db.select().from(raffles).where(eq(raffles.status, "active"));
    return raffle;
  }

  async getRaffle(id: string): Promise<Raffle | undefined> {
    const [raffle] = await db.select().from(raffles).where(eq(raffles.id, id));
    return raffle;
  }

  async createRaffle(raffle: InsertRaffle): Promise<Raffle> {
    const [created] = await db.insert(raffles).values(raffle).returning();
    return created;
  }

  async updateRaffleStatus(id: string, status: string): Promise<Raffle | undefined> {
    const [updated] = await db.update(raffles)
      .set({ status })
      .where(eq(raffles.id, id))
      .returning();
    return updated;
  }

  async activateRaffle(id: string): Promise<Raffle | undefined> {
    // First, cancel any other active raffles
    await db.update(raffles)
      .set({ status: "cancelled" })
      .where(eq(raffles.status, "active"));
    
    // Then activate the new one
    const [updated] = await db.update(raffles)
      .set({ status: "active" })
      .where(eq(raffles.id, id))
      .returning();
    return updated;
  }

  async endRaffle(id: string, endedBy: string): Promise<Raffle | undefined> {
    const [updated] = await db.update(raffles)
      .set({ status: "spinning", endedAt: new Date(), endedBy })
      .where(eq(raffles.id, id))
      .returning();
    return updated;
  }

  async getRaffleEntries(raffleId: string): Promise<RaffleEntry[]> {
    return db.select().from(raffleEntries).where(eq(raffleEntries.raffleId, raffleId));
  }

  async getRaffleEntry(raffleId: string, odejs: string): Promise<RaffleEntry | undefined> {
    const [entry] = await db.select().from(raffleEntries)
      .where(and(eq(raffleEntries.raffleId, raffleId), eq(raffleEntries.odejs, odejs)));
    return entry;
  }

  async joinRaffle(entry: InsertRaffleEntry): Promise<RaffleEntry> {
    const [created] = await db.insert(raffleEntries).values(entry).returning();
    // Update participant count
    await this.updateRaffleParticipants(entry.raffleId, 1);
    return created;
  }

  async updateRaffleParticipants(id: string, delta: number): Promise<Raffle | undefined> {
    const raffle = await this.getRaffle(id);
    if (!raffle) return undefined;
    
    const newCount = Math.max(0, (raffle.currentParticipants || 0) + delta);
    const [updated] = await db.update(raffles)
      .set({ currentParticipants: newCount })
      .where(eq(raffles.id, id))
      .returning();
    return updated;
  }

  async getRaffleWinners(raffleId: string): Promise<RaffleWinner[]> {
    return db.select().from(raffleWinners)
      .where(eq(raffleWinners.raffleId, raffleId))
      .orderBy(raffleWinners.rank);
  }

  async addRaffleWinner(raffleId: string, odejs: string, username: string | null, firstName: string | null, rank: number, prizeNote?: string): Promise<RaffleWinner> {
    const [winner] = await db.insert(raffleWinners).values({
      raffleId,
      odejs,
      username,
      firstName,
      rank,
      prizeNote
    }).returning();
    return winner;
  }

  async drawRaffleWinners(raffleId: string, endedBy: string): Promise<RaffleWinner[]> {
    const raffle = await this.getRaffle(raffleId);
    if (!raffle) return [];

    const entries = await this.getRaffleEntries(raffleId);
    if (entries.length === 0) return [];

    // Shuffle entries using Fisher-Yates
    const shuffled = [...entries];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    // Pick winners
    const winnerCount = Math.min(raffle.maxWinners || 1, shuffled.length);
    const winners: RaffleWinner[] = [];

    for (let rank = 1; rank <= winnerCount; rank++) {
      const entry = shuffled[rank - 1];
      const winner = await this.addRaffleWinner(
        raffleId,
        entry.odejs,
        entry.username,
        entry.firstName,
        rank
      );
      winners.push(winner);
    }

    // Mark raffle as completed
    await db.update(raffles)
      .set({ status: "completed", endedAt: new Date(), endedBy })
      .where(eq(raffles.id, raffleId));

    return winners;
  }

  // Slot session profit tracking
  async getUserSlotSession(odejs: string, gameType: string): Promise<UserSlotSession | undefined> {
    const [session] = await db.select().from(userSlotSessions)
      .where(and(eq(userSlotSessions.odejs, odejs), eq(userSlotSessions.gameType, gameType)));
    return session;
  }

  async createUserSlotSession(odejs: string, gameType: string): Promise<UserSlotSession> {
    const [session] = await db.insert(userSlotSessions)
      .values({ odejs, gameType, sessionProfit: 0, totalWagered: 0, totalWon: 0 })
      .returning();
    return session;
  }

  async updateUserSlotSession(odejs: string, gameType: string, wagered: number, won: number, profit: number): Promise<void> {
    await db.update(userSlotSessions)
      .set({
        sessionProfit: sql`${userSlotSessions.sessionProfit} + ${profit}`,
        totalWagered: sql`${userSlotSessions.totalWagered} + ${wagered}`,
        totalWon: sql`${userSlotSessions.totalWon} + ${won}`,
        lastSpinAt: new Date(),
      })
      .where(and(eq(userSlotSessions.odejs, odejs), eq(userSlotSessions.gameType, gameType)));
  }
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private bets: Map<string, Bet>;
  private withdrawalsMap: Map<string, Withdrawal>;
  private settingsData: Settings;
  private promoCodesMap: Map<string, PromoCode>;
  private promoCodeUsageMap: Map<string, PromoCodeUsage>;

  constructor() {
    this.users = new Map();
    this.bets = new Map();
    this.withdrawalsMap = new Map();
    this.settingsData = { 
      id: "global", 
      winRatePercent: 50, 
      depositLink: null, 
      depositAddressTon: null,
      depositAddressTrc20: null,
      gamesDisabled: false, 
      gamesDisabledMessage: null, 
      pokerBotsEnabled: false,
      pokerBotJoinMode: "random",
      pokerBot1Name: "Bot1",
      pokerBot2Name: "Bot2", 
      pokerBot3Name: "Bot3",
      pokerBot1Style: "normal",
      pokerBot2Style: "normal",
      pokerBot3Style: "normal",
      pokerBot1Enabled: true,
      pokerBot2Enabled: true,
      pokerBot3Enabled: true,
      pokerBotWinRate: 50,
      pokerBot1BudgetUsed: 0,
      pokerBot2BudgetUsed: 0,
      pokerBot3BudgetUsed: 0,
      pokerBotBudgetResetDate: null,
      telegramChannelLink: null,
      luxeRtpPercent: 45,
      egyptRtpPercent: 45,
      egyptMaxProfit: 0,
      minedropRtpPercent: 45,
      minedropMaxProfit: 0,
      winLimitEnabled: true,
      maxWinMultiplier: 20,
      maxAbsoluteWin: 25,
      lossRecoveryPercent: 30,
      updatedAt: new Date(), 
      updatedBy: null 
    };
    this.promoCodesMap = new Map();
    this.promoCodeUsageMap = new Map();
  }

  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByTelegramId(telegramId: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.telegramId === telegramId,
    );
  }

  async getUserByReferralCode(referralCode: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.referralCode === referralCode,
    );
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const user: User = { 
      id,
      telegramId: insertUser.telegramId,
      username: insertUser.username || null,
      firstName: insertUser.firstName || null,
      lastName: insertUser.lastName || null,
      photoUrl: insertUser.photoUrl || null,
      balance: insertUser.balance ?? 1,
      starsBalance: 0,
      preferredCurrency: "usd",
      walletAddress: null,
      isAdmin: insertUser.isAdmin ?? false,
      isVip: insertUser.isVip ?? false,
      vipTier: "none",
      totalDeposited: 0,
      referralCode: null,
      referredBy: null,
      referralCount: 0,
      referralBalance: 0,
      lastSeenAt: new Date(),
      lastWheelSpin: null,
    };
    this.users.set(id, user);
    return user;
  }

  async deleteUser(id: string): Promise<boolean> {
    return this.users.delete(id);
  }

  async updateUserBalance(id: string, balance: number): Promise<User | undefined> {
    const user = this.users.get(id);
    if (!user) return undefined;
    
    const updatedUser = { ...user, balance };
    this.users.set(id, updatedUser);
    return updatedUser;
  }

  async updateUserStarsBalance(id: string, starsBalance: number): Promise<User | undefined> {
    const user = this.users.get(id);
    if (!user) return undefined;
    
    const updatedUser = { ...user, starsBalance };
    this.users.set(id, updatedUser);
    return updatedUser;
  }

  async updateUserPreferredCurrency(id: string, currency: string): Promise<User | undefined> {
    const user = this.users.get(id);
    if (!user) return undefined;
    
    const updatedUser = { ...user, preferredCurrency: currency };
    this.users.set(id, updatedUser);
    return updatedUser;
  }

  async updateUserWallet(id: string, walletAddress: string): Promise<User | undefined> {
    const user = this.users.get(id);
    if (!user) return undefined;
    
    const updatedUser = { ...user, walletAddress };
    this.users.set(id, updatedUser);
    return updatedUser;
  }

  async updateUserReferralCode(id: string, referralCode: string): Promise<User | undefined> {
    const user = this.users.get(id);
    if (!user) return undefined;
    
    const updatedUser = { ...user, referralCode };
    this.users.set(id, updatedUser);
    return updatedUser;
  }

  async incrementReferralCount(id: string): Promise<User | undefined> {
    const user = this.users.get(id);
    if (!user) return undefined;
    
    const updatedUser = { ...user, referralCount: (user.referralCount || 0) + 1 };
    this.users.set(id, updatedUser);
    return updatedUser;
  }

  async updateUserAdmin(id: string, isAdmin: boolean): Promise<User | undefined> {
    const user = this.users.get(id);
    if (!user) return undefined;
    
    const updatedUser = { ...user, isAdmin };
    this.users.set(id, updatedUser);
    return updatedUser;
  }

  async createBet(insertBet: InsertBet): Promise<Bet> {
    const id = randomUUID();
    const bet: Bet = {
      id,
      odejs: insertBet.odejs,
      gameType: insertBet.gameType,
      amount: insertBet.amount,
      multiplier: insertBet.multiplier ?? null,
      payout: insertBet.payout ?? null,
      isWin: insertBet.isWin,
      gameData: insertBet.gameData ?? null,
      createdAt: new Date(),
    };
    this.bets.set(id, bet);
    return bet;
  }

  async getUserBets(odejs: string, limit: number = 10): Promise<Bet[]> {
    return Array.from(this.bets.values())
      .filter((bet) => bet.odejs === odejs)
      .sort((a, b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0))
      .slice(0, limit);
  }

  async getRecentBets(limit: number = 20): Promise<Bet[]> {
    return Array.from(this.bets.values())
      .sort((a, b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0))
      .slice(0, limit);
  }

  async createWithdrawal(insertWithdrawal: InsertWithdrawal): Promise<Withdrawal> {
    const id = randomUUID();
    const withdrawal: Withdrawal = {
      ...insertWithdrawal,
      id,
      status: "pending",
      createdAt: new Date(),
      processedAt: null,
      processedBy: null,
    };
    this.withdrawalsMap.set(id, withdrawal);
    return withdrawal;
  }

  async getPendingWithdrawals(): Promise<Withdrawal[]> {
    return Array.from(this.withdrawalsMap.values())
      .filter((w) => w.status === "pending")
      .sort((a, b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0));
  }

  async getAllWithdrawals(): Promise<Withdrawal[]> {
    return Array.from(this.withdrawalsMap.values())
      .sort((a, b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0));
  }

  async processWithdrawal(id: string, status: string, processedBy: string): Promise<Withdrawal | undefined> {
    const withdrawal = this.withdrawalsMap.get(id);
    if (!withdrawal) return undefined;
    
    const updated = { ...withdrawal, status, processedBy, processedAt: new Date() };
    this.withdrawalsMap.set(id, updated);
    return updated;
  }

  async getSettings(): Promise<Settings> {
    return this.settingsData;
  }

  async updateWinRate(winRatePercent: number, updatedBy: string): Promise<Settings> {
    this.settingsData = { ...this.settingsData, winRatePercent, updatedBy, updatedAt: new Date() };
    return this.settingsData;
  }

  async updateLuxeRtp(luxeRtpPercent: number, updatedBy: string): Promise<Settings> {
    this.settingsData = { ...this.settingsData, luxeRtpPercent, updatedBy, updatedAt: new Date() };
    return this.settingsData;
  }

  async updateMinedropRtp(minedropRtpPercent: number, updatedBy: string): Promise<Settings> {
    this.settingsData = { ...this.settingsData, minedropRtpPercent, updatedBy, updatedAt: new Date() };
    return this.settingsData;
  }

  async updateWinLimitSettings(limitSettings: {
    winLimitEnabled?: boolean;
    maxWinMultiplier?: number;
    maxAbsoluteWin?: number;
    lossRecoveryPercent?: number;
  }, updatedBy: string): Promise<Settings> {
    this.settingsData = { 
      ...this.settingsData, 
      ...limitSettings,
      updatedBy, 
      updatedAt: new Date() 
    };
    return this.settingsData;
  }

  async getAllUsers(): Promise<User[]> {
    return Array.from(this.users.values()).sort((a, b) => b.balance - a.balance);
  }

  // Promo codes for MemStorage
  async getPromoCode(code: string): Promise<PromoCode | undefined> {
    return Array.from(this.promoCodesMap.values()).find(p => p.code === code);
  }

  async getPromoCodeById(id: string): Promise<PromoCode | undefined> {
    return this.promoCodesMap.get(id);
  }

  async createPromoCode(insertPromoCode: InsertPromoCode): Promise<PromoCode> {
    const id = randomUUID();
    const promo: PromoCode = {
      id,
      code: insertPromoCode.code,
      bonusAmount: insertPromoCode.bonusAmount,
      rewardType: insertPromoCode.rewardType ?? "usd",
      maxUses: insertPromoCode.maxUses ?? null,
      currentUses: 0,
      isActive: insertPromoCode.isActive ?? true,
      createdAt: new Date(),
      createdBy: insertPromoCode.createdBy ?? null,
    };
    this.promoCodesMap.set(id, promo);
    return promo;
  }

  async getAllPromoCodes(): Promise<PromoCode[]> {
    return Array.from(this.promoCodesMap.values()).sort((a, b) => 
      (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0)
    );
  }

  async incrementPromoCodeUsage(id: string): Promise<PromoCode | undefined> {
    const promo = this.promoCodesMap.get(id);
    if (!promo) return undefined;
    const updated = { ...promo, currentUses: (promo.currentUses || 0) + 1 };
    this.promoCodesMap.set(id, updated);
    return updated;
  }

  async checkPromoCodeUsage(odejs: string, promoCodeId: string): Promise<boolean> {
    const key = `${odejs}-${promoCodeId}`;
    return this.promoCodeUsageMap.has(key);
  }

  async recordPromoCodeUsage(odejs: string, promoCodeId: string): Promise<PromoCodeUsage> {
    const id = randomUUID();
    const usage: PromoCodeUsage = { id, odejs, promoCodeId, usedAt: new Date() };
    const key = `${odejs}-${promoCodeId}`;
    this.promoCodeUsageMap.set(key, usage);
    return usage;
  }

  async updateLastSeen(id: string): Promise<User | undefined> {
    const user = this.users.get(id);
    if (!user) return undefined;
    const updated = { ...user, lastSeenAt: new Date() };
    this.users.set(id, updated);
    return updated;
  }

  async getRecentlyActiveUsers(): Promise<User[]> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return Array.from(this.users.values())
      .filter(u => u.lastSeenAt && u.lastSeenAt >= today)
      .sort((a, b) => (b.lastSeenAt?.getTime() || 0) - (a.lastSeenAt?.getTime() || 0));
  }

  async addBalanceHistory(odejs: string, amount: number, balanceAfter: number, type: string, description?: string): Promise<BalanceHistory> {
    const id = randomUUID();
    const history: BalanceHistory = { id, odejs, amount, balanceAfter, type, description: description || null, createdAt: new Date() };
    return history;
  }

  async getBalanceHistory(odejs: string, limit: number = 50): Promise<BalanceHistory[]> {
    return [];
  }

  async getAllBalanceHistory(limit: number = 100): Promise<BalanceHistory[]> {
    return [];
  }

  async getUserWithdrawals(odejs: string): Promise<Withdrawal[]> {
    return Array.from(this.withdrawalsMap.values())
      .filter(w => w.odejs === odejs)
      .sort((a, b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0));
  }

  // Poker stub methods for MemStorage (in-memory implementation not used for poker)
  async getPokerTables(): Promise<PokerTable[]> {
    return [];
  }

  async getPokerTable(id: string): Promise<PokerTable | undefined> {
    return undefined;
  }

  async getTableSeats(tableId: string): Promise<PokerSeat[]> {
    return [];
  }

  async getPlayerSeat(tableId: string, odejs: string): Promise<PokerSeat | undefined> {
    return undefined;
  }

  async getPlayerSeats(odejs: string): Promise<PokerSeat[]> {
    return [];
  }

  async addPlayerToTable(tableId: string, odejs: string, seatNumber: number, chipStack: number): Promise<PokerSeat> {
    throw new Error("Poker not supported in MemStorage");
  }

  async acquireSeat(tableId: string, odejs: string, seatNumber: number, chipStack: number): Promise<{ success: boolean; seat?: PokerSeat; error?: string; existingSeat?: PokerSeat }> {
    throw new Error("Poker not supported in MemStorage");
  }

  async removePlayerFromTable(tableId: string, odejs: string): Promise<void> {
    // Not supported
  }

  async updateTablePlayerCount(tableId: string, count: number): Promise<void> {
    // Not supported
  }

  async updatePlayerChipStack(tableId: string, odejs: string, chipStack: number): Promise<void> {
    // Not supported
  }

  async updateSeatChipStack(tableId: string, seatNumber: number, chipStack: number): Promise<void> {
    // Not supported
  }

  async updateBalance(odejs: string, amount: number, type: string, description?: string): Promise<User | undefined> {
    const user = this.users.get(odejs);
    if (!user) return undefined;
    const newBalance = Math.max(0, user.balance + amount);
    const updated = { ...user, balance: newBalance };
    this.users.set(odejs, updated);
    return updated;
  }

  async updateBalanceWithCurrency(odejs: string, amount: number, currency: "usd" | "stars", type: string, description?: string): Promise<User | undefined> {
    const user = this.users.get(odejs);
    if (!user) return undefined;
    
    if (currency === "stars") {
      const newBalance = Math.max(0, (user.starsBalance || 0) + amount);
      const updated = { ...user, starsBalance: newBalance };
      this.users.set(odejs, updated);
      return updated;
    } else {
      const newBalance = Math.max(0, user.balance + amount);
      const updated = { ...user, balance: newBalance };
      this.users.set(odejs, updated);
      return updated;
    }
  }

  async getUserBalance(odejs: string, currency: "usd" | "stars"): Promise<number> {
    const user = this.users.get(odejs);
    if (!user) return 0;
    return currency === "stars" ? (user.starsBalance || 0) : user.balance;
  }

  async setUserBalance(odejs: string, balance: number, currency: "usd" | "stars"): Promise<User | undefined> {
    const user = this.users.get(odejs);
    if (!user) return undefined;
    
    if (currency === "stars") {
      const updated = { ...user, starsBalance: Math.max(0, balance) };
      this.users.set(odejs, updated);
      return updated;
    } else {
      const updated = { ...user, balance: Math.max(0, balance) };
      this.users.set(odejs, updated);
      return updated;
    }
  }

  async processReferralCommission(userId: string, lostAmount: number): Promise<void> {
    const user = this.users.get(userId);
    if (!user || !user.referredBy) return;
    
    const referrer = await this.getUserByReferralCode(user.referredBy);
    if (!referrer) return;
    
    const commission = lostAmount * 0.15;
    if (commission <= 0) return;
    
    const newReferralBalance = (referrer.referralBalance || 0) + commission;
    const updated = { ...referrer, referralBalance: newReferralBalance };
    this.users.set(referrer.id, updated);
  }

  async withdrawReferralBalance(userId: string): Promise<{ success: boolean; error?: string; newBalance?: number; newReferralBalance?: number }> {
    const MIN_REFERRAL_WITHDRAW = 50;
    const user = this.users.get(userId);
    if (!user) return { success: false, error: "User not found" };
    
    const referralBalance = user.referralBalance || 0;
    if (referralBalance < MIN_REFERRAL_WITHDRAW) {
      return { success: false, error: `Minimum $${MIN_REFERRAL_WITHDRAW} required` };
    }
    
    const newBalance = user.balance + referralBalance;
    const updated = { ...user, balance: newBalance, referralBalance: 0 };
    this.users.set(userId, updated);
    
    return { success: true, newBalance, newReferralBalance: 0 };
  }

  // Tournament stubs for MemStorage
  async getTournaments(): Promise<Tournament[]> { return []; }
  async getActiveTournaments(): Promise<Tournament[]> { return []; }
  async getTournament(id: string): Promise<Tournament | undefined> { return undefined; }
  async createTournament(tournament: InsertTournament): Promise<Tournament> { throw new Error("Not supported"); }
  async updateTournamentStatus(id: string, status: string): Promise<Tournament | undefined> { return undefined; }
  async updateTournamentPlayers(id: string, delta: number): Promise<Tournament | undefined> { return undefined; }
  async getTournamentEntries(tournamentId: string): Promise<TournamentEntry[]> { return []; }
  async getTournamentEntry(tournamentId: string, userId: string): Promise<TournamentEntry | undefined> { return undefined; }
  async joinTournament(tournamentId: string, userId: string): Promise<TournamentEntry> { throw new Error("Not supported"); }
  async updateTournamentScore(tournamentId: string, userId: string, wagered: number, isWin: boolean): Promise<TournamentEntry | undefined> { return undefined; }
  
  // VIP Chat stubs for MemStorage
  async getChatMessages(limit?: number): Promise<ChatMessage[]> { return []; }
  async createChatMessage(message: InsertChatMessage): Promise<ChatMessage> { throw new Error("Not supported"); }
  async getLastUserMessage(odejs: string): Promise<ChatMessage | undefined> { return undefined; }
  async deleteChatMessage(id: string): Promise<boolean> { return false; }
  async updateGamesDisabled(disabled: boolean, message: string | null, updatedBy: string): Promise<Settings> {
    this.settingsData.gamesDisabled = disabled;
    this.settingsData.gamesDisabledMessage = message;
    this.settingsData.updatedAt = new Date();
    this.settingsData.updatedBy = updatedBy;
    return this.settingsData;
  }
  async updateUserVipStatus(id: string, isVip: boolean): Promise<User | undefined> { return undefined; }
  async updateUserVipTier(id: string, vipTier: string): Promise<User | undefined> { return undefined; }
  async spinWheel(id: string, prize: number): Promise<{ success: boolean; user?: User; error?: string; nextSpinAt?: Date }> {
    const user = this.users.get(id);
    if (!user) return { success: false, error: "User not found" };
    const now = new Date();
    if (user.lastWheelSpin) {
      const timeSince = now.getTime() - new Date(user.lastWheelSpin).getTime();
      if (timeSince < 24 * 60 * 60 * 1000) {
        return { success: false, error: "Already spun today", nextSpinAt: new Date(new Date(user.lastWheelSpin).getTime() + 24 * 60 * 60 * 1000) };
      }
    }
    const updated = { ...user, balance: user.balance + prize, lastWheelSpin: now };
    this.users.set(id, updated);
    return { success: true, user: updated };
  }
  async processDeposit(id: string, amount: number): Promise<User | undefined> { return undefined; }
  async updateDepositLink(depositLink: string, updatedBy: string): Promise<Settings> { return this.settingsData; }
  async updateDepositAddresses(ton: string | null, trc20: string | null, updatedBy: string): Promise<Settings> { 
    this.settingsData = { ...this.settingsData, depositAddressTon: ton, depositAddressTrc20: trc20 };
    return this.settingsData; 
  }
  async updateTelegramChannelLink(link: string | null, updatedBy: string): Promise<Settings> {
    this.settingsData = { ...this.settingsData, telegramChannelLink: link };
    return this.settingsData;
  }
  async updatePokerBotSettings(botSettings: {
    pokerBotsEnabled?: boolean;
    pokerBotJoinMode?: string;
    pokerBot1Name?: string;
    pokerBot2Name?: string;
    pokerBot3Name?: string;
    pokerBot1Style?: string;
    pokerBot2Style?: string;
    pokerBot3Style?: string;
    pokerBot1Enabled?: boolean;
    pokerBot2Enabled?: boolean;
    pokerBot3Enabled?: boolean;
    pokerBotWinRate?: number;
    pokerBot1BudgetUsed?: number;
    pokerBot2BudgetUsed?: number;
    pokerBot3BudgetUsed?: number;
    pokerBotBudgetResetDate?: string;
  }, updatedBy: string): Promise<Settings> {
    this.settingsData = { ...this.settingsData, ...botSettings };
    return this.settingsData;
  }
  async getRaffles(): Promise<Raffle[]> { return []; }
  async getActiveRaffle(): Promise<Raffle | undefined> { return undefined; }
  async getRaffle(id: string): Promise<Raffle | undefined> { return undefined; }
  async createRaffle(raffle: InsertRaffle): Promise<Raffle> { throw new Error("Not supported"); }
  async updateRaffleStatus(id: string, status: string): Promise<Raffle | undefined> { return undefined; }
  async activateRaffle(id: string): Promise<Raffle | undefined> { return undefined; }
  async endRaffle(id: string, endedBy: string): Promise<Raffle | undefined> { return undefined; }
  async getRaffleEntries(raffleId: string): Promise<RaffleEntry[]> { return []; }
  async getRaffleEntry(raffleId: string, odejs: string): Promise<RaffleEntry | undefined> { return undefined; }
  async joinRaffle(entry: InsertRaffleEntry): Promise<RaffleEntry> { throw new Error("Not supported"); }
  async updateRaffleParticipants(id: string, delta: number): Promise<Raffle | undefined> { return undefined; }
  async getRaffleWinners(raffleId: string): Promise<RaffleWinner[]> { return []; }
  async addRaffleWinner(raffleId: string, odejs: string, username: string | null, firstName: string | null, rank: number, prizeNote?: string): Promise<RaffleWinner> { throw new Error("Not supported"); }
  async drawRaffleWinners(raffleId: string, endedBy: string): Promise<RaffleWinner[]> { return []; }
  async getUserSlotSession(odejs: string, gameType: string): Promise<any | undefined> { return undefined; }
  async createUserSlotSession(odejs: string, gameType: string): Promise<any> { return { odejs, gameType, sessionProfit: 0 }; }
  async updateUserSlotSession(odejs: string, gameType: string, wagered: number, won: number, profit: number): Promise<void> {}
}

export const storage = new DatabaseStorage();
