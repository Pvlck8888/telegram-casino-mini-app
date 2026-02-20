import TelegramBot from "node-telegram-bot-api";
import fs from "fs";
import path from "path";

const token = process.env.TELEGRAM_BOT_TOKEN_1;

// Get the app URL - ALWAYS use production URL for Telegram Mini App
// Dev URLs don't work with Telegram - they require authentication
function getAppUrl(): string {
  // Priority 1: Explicit deployment URL from Replit
  if (process.env.REPLIT_DEPLOYMENT_URL) {
    return process.env.REPLIT_DEPLOYMENT_URL;
  }
  
  // Priority 2: Custom production URL (set this after publishing)
  if (process.env.MINI_APP_URL) {
    return process.env.MINI_APP_URL;
  }
  
  // Priority 3: Construct from Replit slug (for published apps)
  if (process.env.REPL_SLUG && process.env.REPL_OWNER) {
    return `https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co`;
  }
  
  // Fallback: Default production URL
  return "https://workspace.pashavatsak.repl.co";
}

let bot: TelegramBot | null = null;
let botStartTime: number = 0;
const processedChats = new Map<number, number>(); // chatId -> last processed timestamp
const processedPaymentChargeIds = new Set<string>(); // Track processed payment charge IDs to prevent double-credit

export function stopTelegramBot() {
  if (bot) {
    bot.stopPolling();
    bot = null;
    processedChats.clear();
    console.log("Telegram bot stopped");
  }
}

export function initTelegramBot() {
  if (!token) {
    console.log("TELEGRAM_BOT_TOKEN_1 not set, bot disabled");
    return null;
  }
  
  // Stop existing bot if any
  stopTelegramBot();
  
  // Record bot start time to ignore old messages
  botStartTime = Math.floor(Date.now() / 1000);
  
  try {
    bot = new TelegramBot(token, { 
      polling: {
        interval: 3000,
        autoStart: true,
        params: {
          timeout: 30
        }
      }
    });
    
    // Handle polling errors gracefully - but DON'T stop the bot
    // We need the bot instance for sending broadcasts even if polling fails
    bot.on("polling_error", (error: any) => {
      if (error.code === "ETELEGRAM" && error.message.includes("409 Conflict")) {
        // Another instance is polling - just log it, don't stop
        // Bot can still SEND messages, just can't receive via polling
        console.log("Polling conflict detected (another instance active) - bot still works for sending");
      } else if (error.message && !error.message.includes("ETELEGRAM")) {
        console.error("Bot polling error:", error.message);
      }
    });
    
    // Log bot info on start
    bot.getMe().then((me) => {
      console.log(`Telegram bot started: @${me.username} (ID: ${me.id})`);
    }).catch((err) => {
      console.error("Failed to get bot info:", err.message);
    });
    
    // Use onText for specific command matching - more reliable
    bot.onText(/\/start(.*)/, async (msg, match) => {
      // Ignore old messages
      if (msg.date < botStartTime) return;
      
      const chatId = msg.chat.id;
      const now = Date.now();
      
      // Rate limit: prevent duplicate responses within 5 seconds per chat
      const lastProcessed = processedChats.get(chatId) || 0;
      if (now - lastProcessed < 5000) {
        return; // Skip - already responded recently
      }
      processedChats.set(chatId, now);
      
      // Clean old entries
      if (processedChats.size > 10000) {
        const cutoff = now - 60000;
        Array.from(processedChats.entries()).forEach(([cid, time]) => {
          if (time < cutoff) processedChats.delete(cid);
        });
      }
      
      const startParam = match?.[1]?.trim() || null;
      
      // Build app URL with referral if present
      let appUrl = getAppUrl();
      if (startParam && startParam.startsWith("ref_")) {
        appUrl += `?ref=${startParam.replace("ref_", "")}`;
      }
      
      try {
        await bot!.sendMessage(
          chatId,
          `🎰 *Welcome to Papa Casino!*\n\n` +
          `💰 Big wins and exciting games await you!\n\n` +
          `🎮 *9 games to choose from:*\n` +
          `♠️ Poker\n` +
          `🚀 Crash\n` +
          `💣 Mines\n` +
          `🎲 Dice\n` +
          `🎰 Slots\n` +
          `✂️ Rock-Paper-Scissors\n` +
          `🐢 Turtle Race\n` +
          `🃏 Blackjack\n` +
          `✈️ Avia Masters\n\n` +
          `💵 Get *$1* to start!` +
          (startParam ? `\n🎁 *Bonus from a friend!*` : "") +
          `\n\n👇 *Click the button below to start playing:*`,
          {
            parse_mode: "Markdown",
            reply_markup: {
              inline_keyboard: [
                [{ text: "🎮 PLAY NOW", web_app: { url: appUrl } }]
              ]
            }
          }
        );
      } catch (err) {
        console.error("Failed to send start message:", err);
      }
    });
    
    bot.onText(/\/balance/, async (msg) => {
      if (msg.date < botStartTime) return;
      await bot!.sendMessage(msg.chat.id, "💰 Your balance: check in the app");
    });
    
    console.log("Telegram bot initialized successfully");
    return bot;
  } catch (error) {
    console.error("Failed to initialize Telegram bot:", error);
    return null;
  }
}

export async function sendPromotionalMessage(chatIds: string[], message: string, photoPath?: string) {
  if (!bot) {
    throw new Error("Bot not initialized");
  }
  
  const results: { chatId: string; success: boolean; error?: string }[] = [];
  
  for (const chatId of chatIds) {
    try {
      if (photoPath && fs.existsSync(photoPath)) {
        await bot.sendPhoto(chatId, fs.createReadStream(photoPath), {
          caption: message,
          parse_mode: "Markdown",
          reply_markup: {
            inline_keyboard: [
              [{ text: "ИГРАТЬ", web_app: { url: getAppUrl() } }]
            ]
          }
        });
      } else {
        await bot.sendMessage(chatId, message, {
          parse_mode: "Markdown",
          reply_markup: {
            inline_keyboard: [
              [{ text: "ИГРАТЬ", web_app: { url: getAppUrl() } }]
            ]
          }
        });
      }
      results.push({ chatId, success: true });
    } catch (error: any) {
      results.push({ chatId, success: false, error: error.message });
    }
  }
  
  return results;
}

export async function broadcastToAllUsers(message: string, photoPath?: string) {
  if (!bot) {
    throw new Error("Bot not initialized");
  }
  
  return { message: "Broadcast would be sent to all registered users" };
}

export async function sendWinnerNotification(chatId: string, amount: number, game: string) {
  if (!bot) return;
  
  try {
    const moneyImagePath = path.join(process.cwd(), "attached_assets/generated_images/pile_of_money_casino_style.png");
    
    const message = 
      `🎉 *БОЛЬШОЙ ВЫИГРЫШ!*\n\n` +
      `💰 Вы выиграли *$${amount.toFixed(2)}* в игре ${game}!\n\n` +
      `🔥 Продолжайте играть и выигрывать!\n` +
      `🍀 Удача на вашей стороне!`;
    
    if (fs.existsSync(moneyImagePath)) {
      await bot.sendPhoto(chatId, fs.createReadStream(moneyImagePath), {
        caption: message,
        parse_mode: "Markdown"
      });
    } else {
      await bot.sendMessage(chatId, message, { parse_mode: "Markdown" });
    }
  } catch (error) {
    console.error("Failed to send winner notification:", error);
  }
}

export function getBot() {
  return bot;
}

export async function createStarsInvoiceLink(amount: number, userId: string): Promise<string | null> {
  if (!bot) {
    throw new Error("Bot not initialized");
  }
  
  try {
    const link = await bot.createInvoiceLink(
      `${amount} Stars`,
      `Пополнение баланса Stars в казино`,
      JSON.stringify({ userId, amount, type: "stars_deposit" }),
      "",
      "XTR",
      [{ label: `${amount} Stars`, amount }]
    );
    return link;
  } catch (error: any) {
    console.error("Failed to create invoice link:", error);
    throw error;
  }
}

export async function refundStarsPayment(userId: number, telegramPaymentChargeId: string): Promise<boolean> {
  if (!bot || !token) {
    throw new Error("Bot not initialized");
  }
  
  try {
    const response = await fetch(`https://api.telegram.org/bot${token}/refundStarPayment`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        user_id: userId,
        telegram_payment_charge_id: telegramPaymentChargeId
      })
    });
    
    const result = await response.json();
    if (!result.ok) {
      throw new Error(result.description || "Refund failed");
    }
    return true;
  } catch (error: any) {
    console.error("Failed to refund Stars payment:", error);
    throw error;
  }
}

export function initStarsPaymentHandlers(onPaymentSuccess: (userId: string, amount: number, chargeId: string) => Promise<void>) {
  if (!bot) return;
  
  bot.on("pre_checkout_query", async (query) => {
    try {
      await bot!.answerPreCheckoutQuery(query.id, true);
    } catch (error) {
      console.error("Pre-checkout query failed:", error);
    }
  });
  
  bot.on("successful_payment", async (msg) => {
    try {
      const payment = msg.successful_payment;
      if (!payment) return;
      
      const chargeId = payment.telegram_payment_charge_id;
      
      // Idempotency check - prevent double crediting
      if (processedPaymentChargeIds.has(chargeId)) {
        console.log(`Payment ${chargeId} already processed, skipping duplicate`);
        return;
      }
      
      // Mark as processed immediately to prevent race conditions
      processedPaymentChargeIds.add(chargeId);
      
      const payload = JSON.parse(payment.invoice_payload);
      const { userId, amount, type } = payload;
      
      if (type === "stars_deposit") {
        await onPaymentSuccess(userId, amount, chargeId);
        
        await bot!.sendMessage(
          msg.chat.id,
          `✅ *Оплата успешна!*\n\n⭐ ${amount} Stars зачислено на ваш баланс!`,
          { parse_mode: "Markdown" }
        );
        
        console.log(`Stars deposit processed: ${amount} Stars for user ${userId}, chargeId: ${chargeId}`);
      }
    } catch (error) {
      console.error("Successful payment handling failed:", error);
    }
  });
}
