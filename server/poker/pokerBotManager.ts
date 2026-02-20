import { Settings, PokerPlayerState, PokerGameState } from "@shared/schema";
import { 
  BOT_CONFIGS, 
  BotConfig, 
  decideBotAction, 
  isBotPlayer, 
  getPositionType, 
  getBotBuyInAmount,
  shouldBotJoinTable
} from "./pokerBot";
import { PokerTableManager, TablePlayer, TableSnapshot } from "./gameManager";
import { IStorage } from "../storage";

const MAX_SEATS_PER_TABLE = 6;

const BOT_ACTION_DELAY_MIN = 1500;
const BOT_ACTION_DELAY_MAX = 4000;

// Daily budget limit per bot
const BOT_DAILY_BUDGET = 3000;

interface ActiveBotSession {
  botConfig: BotConfig;
  tableId: string;
  seatNumber: number;
  chipStack: number;
}

export class PokerBotManager {
  private pokerManager: PokerTableManager;
  private storage: IStorage;
  private activeBots: Map<string, ActiveBotSession> = new Map();
  private botActionTimeouts: Map<string, NodeJS.Timeout> = new Map();
  private checkTablesInterval: NodeJS.Timeout | null = null;
  private enabled: boolean = false;
  private settings: Partial<Settings> = {};
  private lastSettingsErrorTime: number = 0;

  constructor(pokerManager: PokerTableManager, storage: IStorage) {
    this.pokerManager = pokerManager;
    this.storage = storage;
  }

  async initialize(): Promise<void> {
    await this.refreshSettings();
    this.startTableMonitoring();
    console.log("[PokerBotManager] Initialized");
  }

  async refreshSettings(): Promise<void> {
    try {
      const settings = await this.storage.getSettings();
      this.settings = settings;
      this.enabled = settings.pokerBotsEnabled || false;
    } catch (error: any) {
      // Only log once per minute to avoid spam
      if (!this.lastSettingsErrorTime || Date.now() - this.lastSettingsErrorTime > 60000) {
        console.error("[PokerBotManager] Failed to refresh settings:", error?.message || "Unknown error");
        this.lastSettingsErrorTime = Date.now();
      }
      // Keep using previous settings if available, otherwise use defaults
      if (!this.settings.pokerBotsEnabled === undefined) {
        this.enabled = true;
        this.settings = {
          pokerBotsEnabled: true,
          pokerBotJoinMode: "join_active",
          pokerBot1Enabled: true,
          pokerBot1Style: "balanced",
          pokerBot2Enabled: true,
          pokerBot2Style: "aggressive",
          pokerBot3Enabled: true,
          pokerBot3Style: "tight",
        };
      }
    }
  }

  private startTableMonitoring(): void {
    if (this.checkTablesInterval) {
      clearInterval(this.checkTablesInterval);
    }

    this.checkTablesInterval = setInterval(() => {
      this.checkAndJoinTables();
    }, 10000);
  }

  async checkAndJoinTables(): Promise<void> {
    await this.refreshSettings();
    
    // Check and reset daily budgets before any operations
    await this.checkAndResetDailyBudgets();
    
    if (!this.enabled) {
      this.removeAllBots();
      return;
    }

    const tables = this.pokerManager.getActiveTables();
    const enabledBots = this.getEnabledBots();
    const joinMode = this.settings.pokerBotJoinMode || "join_active";
    
    this.reconcileBotSessions(tables);
    
    for (const table of tables) {
      this.processTable(table, enabledBots, joinMode);
    }
  }

  private reconcileBotSessions(tables: TableSnapshot[]): void {
    const tableMap = new Map<string, TableSnapshot>();
    for (const t of tables) {
      tableMap.set(t.tableId, t);
    }

    const entries = Array.from(this.activeBots.entries());
    for (const [odejs, session] of entries) {
      const table = tableMap.get(session.tableId);
      if (!table) {
        this.activeBots.delete(odejs);
        continue;
      }
      
      const seatData = table.seats.find(s => s.seatNumber === session.seatNumber);
      if (!seatData || seatData.odejs !== odejs) {
        this.activeBots.delete(odejs);
      }
    }
  }

  private processTable(table: TableSnapshot, enabledBots: BotConfig[], joinMode: string): void {
    const humanPlayers = table.seats.filter(s => s.odejs && !s.odejs.startsWith("bot_"));
    const botPlayers = table.seats.filter(s => s.odejs && s.odejs.startsWith("bot_"));
    const emptySeats = MAX_SEATS_PER_TABLE - table.seats.length;
    
    if (joinMode === "wait_for_player") {
      if (humanPlayers.length === 1 && botPlayers.length === 0 && emptySeats > 0) {
        this.tryAddBot(table, enabledBots, emptySeats);
      }
    } else if (joinMode === "join_active") {
      if (humanPlayers.length >= 1 && botPlayers.length === 0 && emptySeats > 0) {
        this.tryAddBot(table, enabledBots, emptySeats);
      }
      if (humanPlayers.length >= 2 && botPlayers.length === 1 && emptySeats > 0) {
        if (enabledBots.length > 1) {
          this.tryAddBot(table, enabledBots, emptySeats, 1);
        }
      }
    }
    
    if (humanPlayers.length === 0 && botPlayers.length > 0) {
      this.removeAllBotsFromTable(table.tableId);
    }
  }

  private tryAddBot(
    table: TableSnapshot, 
    enabledBots: BotConfig[], 
    emptySeats: number,
    botIndex: number = 0
  ): void {
    if (botIndex >= enabledBots.length || emptySeats < 1) {
      return;
    }

    const bot = enabledBots[botIndex];
    
    if (this.activeBots.has(bot.odejs)) {
      if (botIndex + 1 < enabledBots.length) {
        this.tryAddBot(table, enabledBots, emptySeats, botIndex + 1);
      }
      return;
    }

    const occupiedSeats = new Set(table.seats.map(s => s.seatNumber));
    let freeSeat: number | null = null;
    for (let i = 1; i <= MAX_SEATS_PER_TABLE; i++) {
      if (!occupiedSeats.has(i)) {
        freeSeat = i;
        break;
      }
    }

    if (freeSeat === null) {
      return;
    }

    // Standard buy-in is 40-100 big blinds
    const minBuyIn = table.bigBlind * 40;
    const maxBuyIn = table.bigBlind * 100;
    const buyIn = getBotBuyInAmount(minBuyIn, maxBuyIn);
    this.addBotToTable(table.tableId, freeSeat, buyIn, botIndex, enabledBots);
  }

  private removeAllBots(): void {
    const entries = Array.from(this.activeBots.entries());
    for (const [odejs, session] of entries) {
      this.pokerManager.removePlayer(session.tableId, session.seatNumber);
    }
    this.activeBots.clear();
  }

  private getEnabledBots(): BotConfig[] {
    const bots: BotConfig[] = [];
    
    // Note: Daily budget reset is handled in checkAndJoinTables() before this is called
    
    if (this.settings.pokerBot1Enabled !== false) {
      const bot = { ...BOT_CONFIGS[0] };
      bot.style = (this.settings.pokerBot1Style as "aggressive" | "tight" | "balanced") || "balanced";
      // Use nickname from settings if available
      if (this.settings.pokerBot1Name) {
        bot.username = this.settings.pokerBot1Name;
      }
      bots.push(bot);
    }
    
    if (this.settings.pokerBot2Enabled !== false) {
      const bot = { ...BOT_CONFIGS[1] };
      bot.style = (this.settings.pokerBot2Style as "aggressive" | "tight" | "balanced") || "aggressive";
      if (this.settings.pokerBot2Name) {
        bot.username = this.settings.pokerBot2Name;
      }
      bots.push(bot);
    }
    
    if (this.settings.pokerBot3Enabled !== false) {
      const bot = { ...BOT_CONFIGS[2] };
      bot.style = (this.settings.pokerBot3Style as "aggressive" | "tight" | "balanced") || "tight";
      if (this.settings.pokerBot3Name) {
        bot.username = this.settings.pokerBot3Name;
      }
      bots.push(bot);
    }

    return bots;
  }

  private getTodayDateString(): string {
    return new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  }

  private async checkAndResetDailyBudgets(): Promise<void> {
    const today = this.getTodayDateString();
    const lastReset = this.settings.pokerBotBudgetResetDate;
    
    if (lastReset !== today) {
      // Reset all budgets for new day
      console.log(`[PokerBotManager] Resetting daily budgets for ${today}`);
      try {
        await this.storage.updatePokerBotSettings({
          pokerBot1BudgetUsed: 0,
          pokerBot2BudgetUsed: 0,
          pokerBot3BudgetUsed: 0,
          pokerBotBudgetResetDate: today,
        } as any, "system");
        // Update local cache
        this.settings.pokerBot1BudgetUsed = 0;
        this.settings.pokerBot2BudgetUsed = 0;
        this.settings.pokerBot3BudgetUsed = 0;
        this.settings.pokerBotBudgetResetDate = today;
      } catch (error) {
        console.error("[PokerBotManager] Failed to reset daily budgets:", error);
      }
    }
  }

  private getBotRemainingBudget(botIndex: number): number {
    let budgetUsed = 0;
    switch (botIndex) {
      case 0: budgetUsed = this.settings.pokerBot1BudgetUsed || 0; break;
      case 1: budgetUsed = this.settings.pokerBot2BudgetUsed || 0; break;
      case 2: budgetUsed = this.settings.pokerBot3BudgetUsed || 0; break;
    }
    return Math.max(0, BOT_DAILY_BUDGET - budgetUsed);
  }

  private async recordBotBudgetSpend(botIndex: number, amount: number): Promise<void> {
    try {
      let updates: any = {};
      switch (botIndex) {
        case 0:
          updates.pokerBot1BudgetUsed = (this.settings.pokerBot1BudgetUsed || 0) + amount;
          this.settings.pokerBot1BudgetUsed = updates.pokerBot1BudgetUsed;
          break;
        case 1:
          updates.pokerBot2BudgetUsed = (this.settings.pokerBot2BudgetUsed || 0) + amount;
          this.settings.pokerBot2BudgetUsed = updates.pokerBot2BudgetUsed;
          break;
        case 2:
          updates.pokerBot3BudgetUsed = (this.settings.pokerBot3BudgetUsed || 0) + amount;
          this.settings.pokerBot3BudgetUsed = updates.pokerBot3BudgetUsed;
          break;
      }
      await this.storage.updatePokerBotSettings(updates, "system");
      console.log(`[PokerBotManager] Bot ${botIndex + 1} budget updated: spent ${amount}, total used: ${updates[`pokerBot${botIndex + 1}BudgetUsed`]}`);
    } catch (error) {
      console.error("[PokerBotManager] Failed to record budget spend:", error);
    }
  }

  private getBotIndexByOdejs(odejs: string): number {
    if (odejs === BOT_CONFIGS[0].odejs) return 0;
    if (odejs === BOT_CONFIGS[1].odejs) return 1;
    if (odejs === BOT_CONFIGS[2].odejs) return 2;
    return -1;
  }

  async addBotToTable(
    tableId: string, 
    seatNumber: number, 
    buyInAmount: number,
    botIndex: number = 0,
    cachedBots?: BotConfig[]
  ): Promise<boolean> {
    const enabledBots = cachedBots || this.getEnabledBots();
    if (botIndex >= enabledBots.length) {
      return false;
    }

    const bot = enabledBots[botIndex];
    const actualBotIndex = this.getBotIndexByOdejs(bot.odejs);
    
    // Check if bot has enough budget for buy-in
    const remainingBudget = this.getBotRemainingBudget(actualBotIndex);
    if (remainingBudget < buyInAmount) {
      console.log(`[PokerBotManager] Bot ${bot.username} has insufficient budget: ${remainingBudget} < ${buyInAmount}`);
      // Try next bot if this one is out of budget
      if (botIndex + 1 < enabledBots.length) {
        return this.addBotToTable(tableId, seatNumber, buyInAmount, botIndex + 1, enabledBots);
      }
      return false;
    }
    
    const success = this.pokerManager.addPlayer(tableId, {
      odejs: bot.odejs,
      username: bot.username,
      photoUrl: bot.photoUrl,
      seatNumber,
      chipStack: buyInAmount,
      isSittingOut: false,
    });

    if (success) {
      // Record budget spend
      await this.recordBotBudgetSpend(actualBotIndex, buyInAmount);
      
      this.activeBots.set(bot.odejs, {
        botConfig: bot,
        tableId,
        seatNumber,
        chipStack: buyInAmount,
      });
      console.log(`[PokerBotManager] Bot ${bot.username} added to table ${tableId} at seat ${seatNumber}, spent ${buyInAmount} from daily budget`);
      
      // Trigger game start check after bot joins (short delay to let state settle)
      setTimeout(() => {
        if (this.pokerManager.canStartHand(tableId)) {
          console.log(`[PokerBotManager] Starting new hand after bot joined at table ${tableId}`);
          this.pokerManager.startNewHand(tableId);
        }
      }, 500);
    }

    return success;
  }

  async onBotTurn(tableId: string, seatNumber: number, state: PokerGameState): Promise<void> {
    console.log(`[PokerBotManager] onBotTurn called: table=${tableId}, seat=${seatNumber}`);
    
    const player = state.players.find((p: PokerPlayerState) => p.seatNumber === seatNumber);
    if (!player || !isBotPlayer(player.odejs || "")) {
      console.log(`[PokerBotManager] Not a bot player at seat ${seatNumber}`);
      return;
    }

    const botOdejs = player.odejs || "";
    console.log(`[PokerBotManager] Bot ${botOdejs} needs to act`);
    const session = this.activeBots.get(botOdejs);
    if (!session) {
      const entries = Array.from(this.activeBots.entries());
      for (const [odejs, sess] of entries) {
        if (sess.tableId === tableId && sess.seatNumber === seatNumber) {
          this.activeBots.delete(odejs);
          break;
        }
      }
      
      const enabledBots = this.getEnabledBots();
      const matchingBot = enabledBots.find(b => b.odejs === botOdejs);
      if (matchingBot) {
        this.activeBots.set(botOdejs, {
          botConfig: matchingBot,
          tableId,
          seatNumber,
          chipStack: player.chipStack,
        });
      } else {
        return;
      }
    }

    const existingTimeout = this.botActionTimeouts.get(botOdejs);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
    }

    const delay = BOT_ACTION_DELAY_MIN + Math.random() * (BOT_ACTION_DELAY_MAX - BOT_ACTION_DELAY_MIN);
    
    const timeout = setTimeout(async () => {
      await this.executeBotAction(tableId, seatNumber, state, botOdejs);
      this.botActionTimeouts.delete(botOdejs);
    }, delay);

    this.botActionTimeouts.set(botOdejs, timeout);
  }

  private async executeBotAction(
    tableId: string, 
    seatNumber: number, 
    state: PokerGameState,
    botOdejs: string
  ): Promise<void> {
    try {
      const currentState = this.pokerManager.getState(tableId, botOdejs);
      if (!currentState || currentState.currentTurn !== seatNumber) {
        return;
      }

      const botPlayer = currentState.players.find((p: PokerPlayerState) => p.seatNumber === seatNumber);
      if (!botPlayer || !botPlayer.holeCards || botPlayer.isFolded) {
        return;
      }

      const session = this.activeBots.get(botOdejs);
      if (!session) return;

      const street = this.getStreet(currentState.communityCards.length);
      const activePlayers = currentState.players.filter((p: PokerPlayerState) => !p.isFolded);
      const position = getPositionType(
        seatNumber,
        currentState.dealerSeat,
        activePlayers.length
      );

      const decision = decideBotAction(session.botConfig.style, {
        holeCards: botPlayer.holeCards,
        communityCards: currentState.communityCards,
        pot: currentState.pot,
        currentBet: currentState.currentBet,
        myBetAmount: botPlayer.betAmount,
        myChipStack: botPlayer.chipStack,
        bigBlind: currentState.bigBlind,
        position,
        street,
        playersRemaining: activePlayers.length,
        isHeadsUp: activePlayers.length === 2,
        botWinRate: this.settings.pokerBotWinRate || 55,
      });

      console.log(`[PokerBotManager] Bot ${session.botConfig.username} action: ${decision.action}${decision.amount ? ` $${decision.amount}` : ""}`);

      let actionSuccess = false;
      switch (decision.action) {
        case "fold":
          actionSuccess = this.pokerManager.handleAction(tableId, seatNumber, "fold");
          break;
        case "check":
          actionSuccess = this.pokerManager.handleAction(tableId, seatNumber, "check");
          // If check fails (there's a bet to call), try calling instead
          if (!actionSuccess) {
            console.log(`[PokerBotManager] Check failed, trying call`);
            actionSuccess = this.pokerManager.handleAction(tableId, seatNumber, "call");
          }
          break;
        case "call":
          actionSuccess = this.pokerManager.handleAction(tableId, seatNumber, "call");
          break;
        case "bet":
        case "raise":
          actionSuccess = this.pokerManager.handleAction(tableId, seatNumber, "raise", decision.amount);
          // If raise fails (maybe not enough chips or invalid amount), try call instead
          if (!actionSuccess) {
            console.log(`[PokerBotManager] Raise failed, trying call`);
            actionSuccess = this.pokerManager.handleAction(tableId, seatNumber, "call");
          }
          break;
        case "all_in":
          // For all-in, check if we need to call (short stack) or raise
          const callNeeded = currentState.currentBet - botPlayer.betAmount;
          if (botPlayer.chipStack <= callNeeded) {
            // Short stack - just call with whatever we have
            actionSuccess = this.pokerManager.handleAction(tableId, seatNumber, "call");
          } else {
            // Can raise - go all-in with full chip stack
            actionSuccess = this.pokerManager.handleAction(tableId, seatNumber, "raise", botPlayer.chipStack);
            // If raise fails, try call as fallback
            if (!actionSuccess) {
              actionSuccess = this.pokerManager.handleAction(tableId, seatNumber, "call");
            }
          }
          break;
      }

      // State broadcast is handled by handleAction -> broadcastState
      if (actionSuccess) {
        console.log(`[PokerBotManager] Bot action ${decision.action} executed successfully`);
      } else {
        console.log(`[PokerBotManager] Bot action ${decision.action} failed, falling back to fold`);
        this.pokerManager.handleAction(tableId, seatNumber, "fold");
      }
    } catch (error) {
      console.error(`[PokerBotManager] Error executing bot action:`, error);
      try {
        this.pokerManager.handleAction(tableId, seatNumber, "fold");
      } catch (e) {
        console.error(`[PokerBotManager] Failed to fold:`, e);
      }
    }
  }

  private getStreet(communityCardsCount: number): "preflop" | "flop" | "turn" | "river" {
    if (communityCardsCount === 0) return "preflop";
    if (communityCardsCount === 3) return "flop";
    if (communityCardsCount === 4) return "turn";
    return "river";
  }

  removeBotFromTable(tableId: string, seatNumber: number): void {
    const result = this.pokerManager.removePlayer(tableId, seatNumber);
    
    const entries = Array.from(this.activeBots.entries());
    for (const [odejs, session] of entries) {
      if (session.tableId === tableId && session.seatNumber === seatNumber) {
        this.activeBots.delete(odejs);
        console.log(`[PokerBotManager] Bot removed from table ${tableId}`);
        break;
      }
    }
  }

  removeAllBotsFromTable(tableId: string): void {
    const botsAtTable = Array.from(this.activeBots.entries())
      .filter(([_, session]) => session.tableId === tableId);
    
    for (const [odejs, session] of botsAtTable) {
      this.pokerManager.removePlayer(tableId, session.seatNumber);
      this.activeBots.delete(odejs);
    }
  }

  isBot(odejs: string): boolean {
    return isBotPlayer(odejs);
  }

  getActiveBots(): Map<string, ActiveBotSession> {
    return this.activeBots;
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  shutdown(): void {
    if (this.checkTablesInterval) {
      clearInterval(this.checkTablesInterval);
      this.checkTablesInterval = null;
    }

    const timeouts = Array.from(this.botActionTimeouts.values());
    for (const timeout of timeouts) {
      clearTimeout(timeout);
    }
    this.botActionTimeouts.clear();

    console.log("[PokerBotManager] Shutdown complete");
  }
}

let botManager: PokerBotManager | null = null;

export function getPokerBotManager(
  pokerManager?: PokerTableManager,
  storage?: IStorage
): PokerBotManager | null {
  if (!botManager && pokerManager && storage) {
    botManager = new PokerBotManager(pokerManager, storage);
    botManager.initialize();
  }
  return botManager;
}
