import { sql } from "drizzle-orm";
import { pgTable, text, varchar, real, timestamp, boolean, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// VIP tier types - based on total deposits
export const vipTiers = ["none", "gold", "diamond", "godOfWin"] as const;
export type VipTier = typeof vipTiers[number];

// VIP tier thresholds in USD
export const VIP_TIER_THRESHOLDS = {
  gold: 30,      // $30+ = Gold
  diamond: 100,  // $100+ = Diamond  
  godOfWin: 1000 // $1000+ = God of Win
} as const;

// Calculate VIP tier based on total deposited amount
export function calculateVipTier(totalDeposited: number): VipTier {
  if (totalDeposited >= VIP_TIER_THRESHOLDS.godOfWin) return "godOfWin";
  if (totalDeposited >= VIP_TIER_THRESHOLDS.diamond) return "diamond";
  if (totalDeposited >= VIP_TIER_THRESHOLDS.gold) return "gold";
  return "none";
}

// Check if user has chat access (any VIP tier)
export function hasVipChatAccess(vipTier: VipTier | string | null): boolean {
  return vipTier === "gold" || vipTier === "diamond" || vipTier === "godOfWin";
}

// Users table - stores Telegram user data
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  telegramId: text("telegram_id").notNull().unique(),
  username: text("username"),
  firstName: text("first_name"),
  lastName: text("last_name"),
  photoUrl: text("photo_url"),
  balance: real("balance").notNull().default(1),
  starsBalance: real("stars_balance").notNull().default(0),
  preferredCurrency: text("preferred_currency").notNull().default("usd"),
  walletAddress: text("wallet_address"),
  isAdmin: boolean("is_admin").default(false),
  isVip: boolean("is_vip").default(false),
  vipTier: text("vip_tier").default("none"),
  totalDeposited: real("total_deposited").default(0),
  referralCode: text("referral_code").unique(),
  referredBy: text("referred_by"),
  referralCount: real("referral_count").default(0),
  referralBalance: real("referral_balance").default(0),
  lastSeenAt: timestamp("last_seen_at").defaultNow(),
  lastWheelSpin: timestamp("last_wheel_spin"),
});

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

// Game types enum
export const gameTypes = ["crash", "mines", "dice", "scissors", "turtle", "blackjack", "poker", "aviamasters", "luxe", "egypt", "minedrop"] as const;
export type GameType = typeof gameTypes[number];

// Bet history table
export const bets = pgTable("bets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  odejs: text("user_id").notNull(),
  gameType: text("game_type").notNull(),
  amount: real("amount").notNull(),
  multiplier: real("multiplier"),
  payout: real("payout"),
  isWin: boolean("is_win").notNull(),
  gameData: text("game_data"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertBetSchema = createInsertSchema(bets).omit({
  id: true,
  createdAt: true,
});

export type InsertBet = z.infer<typeof insertBetSchema>;
export type Bet = typeof bets.$inferSelect;

// Withdrawal requests table
export const withdrawals = pgTable("withdrawals", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  odejs: text("user_id").notNull(),
  amount: real("amount").notNull(),
  walletAddress: text("wallet_address").notNull(),
  status: text("status").notNull().default("pending"),
  createdAt: timestamp("created_at").defaultNow(),
  processedAt: timestamp("processed_at"),
  processedBy: text("processed_by"),
});

export const insertWithdrawalSchema = createInsertSchema(withdrawals).omit({
  id: true,
  createdAt: true,
  processedAt: true,
  processedBy: true,
});

export type InsertWithdrawal = z.infer<typeof insertWithdrawalSchema>;
export type Withdrawal = typeof withdrawals.$inferSelect;

// Poker bot play styles
export const botPlayStyles = ["aggressive", "tight", "balanced"] as const;
export type BotPlayStyle = typeof botPlayStyles[number];

// Admin settings table
export const settings = pgTable("settings", {
  id: varchar("id").primaryKey().default("global"),
  winRatePercent: integer("win_rate_percent").notNull().default(50),
  depositLink: text("deposit_link"), // Admin-configurable deposit payment link
  depositAddressTon: text("deposit_address_ton"), // TON wallet address for deposits
  depositAddressTrc20: text("deposit_address_trc20"), // USDT TRC20 address for deposits
  gamesDisabled: boolean("games_disabled").default(false), // Admin can temporarily disable all games
  gamesDisabledMessage: text("games_disabled_message"), // Message to show when games are disabled
  // Poker bot settings
  pokerBotsEnabled: boolean("poker_bots_enabled").default(false), // Enable/disable poker bots
  pokerBotJoinMode: text("poker_bot_join_mode").default("wait_for_player"), // "wait_for_player" or "join_active"
  pokerBot1Name: text("poker_bot1_name").default("Viktor"), // Bot 1 display name
  pokerBot2Name: text("poker_bot2_name").default("Anna"), // Bot 2 display name
  pokerBot3Name: text("poker_bot3_name").default("Maria"), // Bot 3 display name
  pokerBot1Style: text("poker_bot1_style").default("balanced"), // aggressive, tight, balanced
  pokerBot2Style: text("poker_bot2_style").default("aggressive"),
  pokerBot3Style: text("poker_bot3_style").default("tight"),
  pokerBot1Enabled: boolean("poker_bot1_enabled").default(true),
  pokerBot2Enabled: boolean("poker_bot2_enabled").default(true),
  pokerBot3Enabled: boolean("poker_bot3_enabled").default(true),
  pokerBotWinRate: integer("poker_bot_win_rate").default(55), // Bot advantage percentage (higher = bots win more)
  // Bot daily budgets - each bot has $3000 daily that replenishes at midnight
  pokerBot1BudgetUsed: real("poker_bot1_budget_used").default(0), // Amount spent today
  pokerBot2BudgetUsed: real("poker_bot2_budget_used").default(0),
  pokerBot3BudgetUsed: real("poker_bot3_budget_used").default(0),
  pokerBotBudgetResetDate: text("poker_bot_budget_reset_date"), // Last reset date (YYYY-MM-DD)
  // Game-specific RTP settings (percentage 1-100)
  luxeRtpPercent: integer("luxe_rtp_percent").default(45), // The Luxe slot RTP (45% = house advantage)
  egyptRtpPercent: integer("egypt_rtp_percent").default(45), // Egypt slot RTP
  egyptMaxProfit: real("egypt_max_profit").default(50), // Max profit before forced losses ($)
  minedropRtpPercent: integer("minedrop_rtp_percent").default(45), // Minedrop RTP
  minedropMaxProfit: real("minedrop_max_profit").default(50), // Max profit before forced losses ($)
  // Win Limiting System (prevents casino bankruptcy - applies to ALL games except poker)
  // AGGRESSIVE DEFAULTS: Prevents $0.10 -> $100+ wins
  winLimitEnabled: boolean("win_limit_enabled").default(true), // Enable win limiting
  maxWinMultiplier: integer("max_win_multiplier").default(20), // Max win = bet * this multiplier (20x = $2 max from $0.10)
  maxAbsoluteWin: real("max_absolute_win").default(25), // Absolute max win per spin regardless of bet ($25)
  lossRecoveryPercent: integer("loss_recovery_percent").default(30), // If user is at loss, max win is this % of losses
  // Social links
  telegramChannelLink: text("telegram_channel_link"), // Admin-configurable Telegram channel link
  updatedAt: timestamp("updated_at").defaultNow(),
  updatedBy: text("updated_by"),
});

export type Settings = typeof settings.$inferSelect;

// Promo codes table
export const promoCodes = pgTable("promo_codes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  code: text("code").notNull().unique(),
  bonusAmount: real("bonus_amount").notNull(),
  rewardType: text("reward_type").default("usd"), // "usd" or "stars"
  maxUses: integer("max_uses").default(0),
  currentUses: integer("current_uses").default(0),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  createdBy: text("created_by"),
});

export const insertPromoCodeSchema = createInsertSchema(promoCodes).omit({
  id: true,
  createdAt: true,
  currentUses: true,
});

export type InsertPromoCode = z.infer<typeof insertPromoCodeSchema>;
export type PromoCode = typeof promoCodes.$inferSelect;

// User promo code usage tracking
export const promoCodeUsage = pgTable("promo_code_usage", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  odejs: text("user_id").notNull(),
  promoCodeId: text("promo_code_id").notNull(),
  usedAt: timestamp("used_at").defaultNow(),
});

export type PromoCodeUsage = typeof promoCodeUsage.$inferSelect;

// User slot session profit tracking (for anti-loss system)
export const userSlotSessions = pgTable("user_slot_sessions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  odejs: text("user_id").notNull(),
  gameType: text("game_type").notNull(), // egypt, luxe, etc.
  sessionProfit: real("session_profit").default(0), // Current session profit (positive = won, negative = lost)
  totalWagered: real("total_wagered").default(0),
  totalWon: real("total_won").default(0),
  lastSpinAt: timestamp("last_spin_at").defaultNow(),
  resetAt: timestamp("reset_at"), // When profit was last reset
});

export type UserSlotSession = typeof userSlotSessions.$inferSelect;

// ============ VIP CHAT ============

// Chat messages table (VIP only)
export const chatMessages = pgTable("chat_messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  odejs: text("user_id").notNull(),
  username: text("username"),
  firstName: text("first_name"),
  vipTier: text("vip_tier"),
  isAdmin: boolean("is_admin").default(false), // Admin messages show "Admin" label
  message: text("message").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertChatMessageSchema = createInsertSchema(chatMessages).omit({
  id: true,
  createdAt: true,
});

export type InsertChatMessage = z.infer<typeof insertChatMessageSchema>;
export type ChatMessage = typeof chatMessages.$inferSelect;

// ============ RAFFLES (Розыгрыши) ============

// Raffle status
export const raffleStatuses = ["draft", "active", "spinning", "completed", "cancelled"] as const;
export type RaffleStatus = typeof raffleStatuses[number];

// Raffles table (replaces tournaments)
export const raffles = pgTable("raffles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  nameRu: text("name_ru").notNull(),
  description: text("description"),
  descriptionRu: text("description_ru"),
  prizeDescription: text("prize_description"), // What winners get
  prizeDescriptionRu: text("prize_description_ru"),
  maxWinners: integer("max_winners").notNull().default(1), // Number of winners to pick
  minDeposit: real("min_deposit").default(0), // Minimum deposit requirement to enter
  requiredVipTier: text("required_vip_tier"), // null = no requirement, "gold", "diamond", "godOfWin"
  currentParticipants: integer("current_participants").default(0),
  status: text("status").notNull().default("draft"),
  createdAt: timestamp("created_at").defaultNow(),
  createdBy: text("created_by"),
  endedAt: timestamp("ended_at"),
  endedBy: text("ended_by"),
});

export const insertRaffleSchema = createInsertSchema(raffles).omit({
  id: true,
  createdAt: true,
  currentParticipants: true,
  endedAt: true,
  endedBy: true,
});

export type InsertRaffle = z.infer<typeof insertRaffleSchema>;
export type Raffle = typeof raffles.$inferSelect;

// Raffle entries (participants)
export const raffleEntries = pgTable("raffle_entries", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  raffleId: text("raffle_id").notNull(),
  odejs: text("user_id").notNull(),
  username: text("username"),
  firstName: text("first_name"),
  vipTier: text("vip_tier"),
  joinedAt: timestamp("joined_at").defaultNow(),
});

export const insertRaffleEntrySchema = createInsertSchema(raffleEntries).omit({
  id: true,
  joinedAt: true,
});

export type InsertRaffleEntry = z.infer<typeof insertRaffleEntrySchema>;
export type RaffleEntry = typeof raffleEntries.$inferSelect;

// Raffle winners
export const raffleWinners = pgTable("raffle_winners", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  raffleId: text("raffle_id").notNull(),
  odejs: text("user_id").notNull(),
  username: text("username"),
  firstName: text("first_name"),
  rank: integer("rank").notNull(), // 1st winner, 2nd winner, etc.
  prizeNote: text("prize_note"),
  selectedAt: timestamp("selected_at").defaultNow(),
});

export type RaffleWinner = typeof raffleWinners.$inferSelect;

// Legacy tournament types kept for backward compatibility during migration
export const tournamentStatuses = ["upcoming", "active", "finished", "cancelled"] as const;
export type TournamentStatus = typeof tournamentStatuses[number];
export const tournaments = pgTable("tournaments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  nameRu: text("name_ru").notNull(),
  description: text("description"),
  descriptionRu: text("description_ru"),
  gameType: text("game_type"),
  entryFee: real("entry_fee").notNull().default(0),
  prizePool: real("prize_pool").notNull(),
  minPlayers: integer("min_players").default(2),
  maxPlayers: integer("max_players").default(100),
  currentPlayers: integer("current_players").default(0),
  startAt: timestamp("start_at").notNull(),
  endAt: timestamp("end_at").notNull(),
  status: text("status").notNull().default("upcoming"),
  createdAt: timestamp("created_at").defaultNow(),
  createdBy: text("created_by"),
});
export const insertTournamentSchema = createInsertSchema(tournaments).omit({ id: true, createdAt: true, currentPlayers: true });
export type InsertTournament = z.infer<typeof insertTournamentSchema>;
export type Tournament = typeof tournaments.$inferSelect;
export const tournamentEntries = pgTable("tournament_entries", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tournamentId: text("tournament_id").notNull(),
  odejs: text("user_id").notNull(),
  score: real("score").default(0),
  wagered: real("wagered").default(0),
  wins: integer("wins").default(0),
  rank: integer("rank"),
  prize: real("prize"),
  joinedAt: timestamp("joined_at").defaultNow(),
});
export const insertTournamentEntrySchema = createInsertSchema(tournamentEntries).omit({ id: true, joinedAt: true, score: true, wagered: true, wins: true, rank: true, prize: true });
export type InsertTournamentEntry = z.infer<typeof insertTournamentEntrySchema>;
export type TournamentEntry = typeof tournamentEntries.$inferSelect;

// Balance history table - tracks all balance changes
export const balanceHistory = pgTable("balance_history", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  odejs: text("user_id").notNull(),
  amount: real("amount").notNull(),
  balanceAfter: real("balance_after").notNull(),
  type: text("type").notNull(), // 'bet', 'win', 'deposit', 'withdraw', 'promo', 'referral', 'admin'
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow(),
});

export type BalanceHistory = typeof balanceHistory.$inferSelect;

// Game configuration
export interface GameConfig {
  id: GameType;
  name: string;
  description: string;
  minBet: number;
  maxBet: number;
  icon: string;
  gradient: string;
  disabled?: boolean;
}

export const gamesConfig: GameConfig[] = [
  { id: "poker", name: "Poker", description: "Texas Hold'em", minBet: 1, maxBet: 500, icon: "cards", gradient: "from-emerald-700 to-teal-900" },
  { id: "aviamasters", name: "Avia Masters", description: "Fly to the carrier!", minBet: 0.10, maxBet: 100, icon: "plane", gradient: "from-sky-600 to-blue-900" },
  { id: "crash", name: "Crash", description: "Cash out before crash!", minBet: 0.10, maxBet: 100, icon: "rocket", gradient: "from-rose-600 to-red-800" },
  { id: "blackjack", name: "Blackjack", description: "Beat the dealer to 21!", minBet: 0.10, maxBet: 100, icon: "cards", gradient: "from-green-700 to-emerald-900" },
  { id: "mines", name: "Mines", description: "Find gems, avoid bombs", minBet: 0.10, maxBet: 100, icon: "gem", gradient: "from-violet-600 to-purple-800" },
  { id: "dice", name: "Dice", description: "Roll and win big", minBet: 0.10, maxBet: 100, icon: "dice", gradient: "from-indigo-600 to-violet-800" },
  { id: "luxe", name: "The Luxe Slots", description: "Golden Frames & Jackpots", minBet: 0.10, maxBet: 100, icon: "gem", gradient: "from-yellow-600 to-amber-900" },
  { id: "scissors", name: "Rock Paper Scissors", description: "Classic game of chance", minBet: 0.10, maxBet: 100, icon: "hand", gradient: "from-red-600 to-rose-800" },
  { id: "turtle", name: "Turtle Race", description: "Bet on the winner", minBet: 0.10, maxBet: 100, icon: "turtle", gradient: "from-green-600 to-emerald-800" },
  { id: "egypt", name: "Egypt Treasures", description: "Pharaoh's riches await!", minBet: 0.10, maxBet: 100, icon: "pyramid", gradient: "from-amber-600 to-amber-900" },
  { id: "minedrop", name: "Minedrop", description: "Mine blocks & find treasure!", minBet: 0.10, maxBet: 1000, icon: "pickaxe", gradient: "from-cyan-600 to-emerald-900" },
];

export const gameNamesRu: Record<GameType, string> = {
  crash: "Краш",
  blackjack: "Блэкджек",
  mines: "Мины",
  dice: "Кости",
  scissors: "Камень-Ножницы-Бумага",
  turtle: "Черепашьи гонки",
  poker: "Покер",
  aviamasters: "Авиамастерс",
  luxe: "The Luxe Slots",
  egypt: "Сокровища Египта",
  minedrop: "Minedrop",
};

export const gameDescriptionsRu: Record<GameType, string> = {
  crash: "Выведи до краша!",
  blackjack: "Обыграй дилера до 21!",
  mines: "Найди алмазы, избегай бомб",
  dice: "Брось кости и выиграй",
  scissors: "Классическая игра на удачу",
  turtle: "Ставь на победителя",
  poker: "Техасский Холдем",
  aviamasters: "Долетай до авианосца!",
  luxe: "Золотые рамки и джекпоты",
  egypt: "Сокровища фараона ждут!",
  minedrop: "Добывай блоки и находи сокровища!",
};

// Crash game state
export interface CrashGameState {
  status: "waiting" | "running" | "crashed";
  multiplier: number;
  crashPoint?: number;
  startTime?: number;
}

// Mines game state
export interface MinesGameState {
  gridSize: number;
  minesCount: number;
  revealedCells: number[];
  minePositions: number[];
  currentMultiplier: number;
  isGameOver: boolean;
  isWin: boolean;
}

// Dice game result
export interface DiceResult {
  target: number;
  roll: number;
  isOver: boolean;
  isWin: boolean;
  multiplier: number;
}

// Slots result
export interface SlotsResult {
  reels: string[][];
  finalSymbols: string[];
  isWin: boolean;
  multiplier: number;
}

// ============ POKER ROOM ============

// Poker table limits
export const pokerLimits = ["NL2", "NL5", "NL10", "NL25", "NL50", "NL100", "NL200", "NL500"] as const;
export type PokerLimit = typeof pokerLimits[number];

// Poker table sizes
export const tableSizes = [6, 9] as const;
export type TableSize = typeof tableSizes[number];

// Card suits and ranks
export const suits = ["hearts", "diamonds", "clubs", "spades"] as const;
export const ranks = ["2", "3", "4", "5", "6", "7", "8", "9", "T", "J", "Q", "K", "A"] as const;
export type Suit = typeof suits[number];
export type Rank = typeof ranks[number];

export interface Card {
  rank: Rank;
  suit: Suit;
}

// Poker tables table
export const pokerTables = pgTable("poker_tables", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  countryFlag: text("country_flag").notNull(), // emoji flag
  limit: text("limit").notNull(), // NL2, NL5, etc.
  maxSeats: integer("max_seats").notNull().default(9),
  smallBlind: real("small_blind").notNull(),
  bigBlind: real("big_blind").notNull(),
  minBuyIn: real("min_buy_in").notNull(),
  maxBuyIn: real("max_buy_in").notNull(),
  rakePercent: real("rake_percent").notNull().default(5),
  rakeCap: real("rake_cap").notNull(), // max rake in BB
  currentPlayers: integer("current_players").notNull().default(0),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

export type PokerTable = typeof pokerTables.$inferSelect;

// Poker seats (players at table)
export const pokerSeats = pgTable("poker_seats", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tableId: text("table_id").notNull(),
  odejs: text("user_id").notNull(),
  seatNumber: integer("seat_number").notNull(), // 0-8 for 9-max, 0-5 for 6-max
  chipStack: real("chip_stack").notNull(),
  isActive: boolean("is_active").default(true),
  isSittingOut: boolean("is_sitting_out").default(false),
  joinedAt: timestamp("joined_at").defaultNow(),
});

// Note: Need to add unique index via SQL migration:
// CREATE UNIQUE INDEX idx_active_seat ON poker_seats (table_id, seat_number) WHERE is_active = true;
// CREATE UNIQUE INDEX idx_active_player ON poker_seats (table_id, user_id) WHERE is_active = true;

export type PokerSeat = typeof pokerSeats.$inferSelect;

// Poker hand history
export const pokerHands = pgTable("poker_hands", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tableId: text("table_id").notNull(),
  handNumber: integer("hand_number").notNull(),
  smallBlind: real("small_blind").notNull(),
  bigBlind: real("big_blind").notNull(),
  pot: real("pot").notNull().default(0),
  rake: real("rake").notNull().default(0),
  communityCards: text("community_cards"), // JSON array of cards
  winners: text("winners"), // JSON array of winner info
  status: text("status").notNull().default("preflop"), // preflop, flop, turn, river, showdown, finished
  dealerSeat: integer("dealer_seat").notNull(),
  currentBet: real("current_bet").notNull().default(0),
  currentTurn: integer("current_turn"), // seat number of current player
  createdAt: timestamp("created_at").defaultNow(),
  finishedAt: timestamp("finished_at"),
});

export type PokerHand = typeof pokerHands.$inferSelect;

// Player hands in a poker hand
export const playerHands = pgTable("player_hands", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  handId: text("hand_id").notNull(),
  odejs: text("user_id").notNull(),
  seatNumber: integer("seat_number").notNull(),
  holeCards: text("hole_cards"), // JSON array of 2 cards (hidden from others)
  betAmount: real("bet_amount").notNull().default(0),
  totalBetInHand: real("total_bet_in_hand").notNull().default(0),
  isFolded: boolean("is_folded").default(false),
  isAllIn: boolean("is_all_in").default(false),
  hasActed: boolean("has_acted").default(false),
  winAmount: real("win_amount").default(0),
});

export type PlayerHand = typeof playerHands.$inferSelect;

// Poker action types
export const pokerActions = ["fold", "check", "call", "bet", "raise", "all_in"] as const;
export type PokerAction = typeof pokerActions[number];

// Poker hand ranking
export const handRankings = [
  "high_card",
  "pair",
  "two_pair",
  "three_of_a_kind",
  "straight",
  "flush",
  "full_house",
  "four_of_a_kind",
  "straight_flush",
  "royal_flush"
] as const;
export type HandRanking = typeof handRankings[number];

// Game mode types
export const pokerGameModes = ["cash", "sit_n_go", "spin_go"] as const;
export type PokerGameMode = typeof pokerGameModes[number];

// Predefined poker tables configuration
export interface PokerTableConfig {
  name: string;
  countryFlag: string;
  limit: PokerLimit;
  maxSeats: TableSize;
  smallBlind: number;
  bigBlind: number;
  minBuyIn: number;
  maxBuyIn: number;
  gameMode?: PokerGameMode; // cash, sit_n_go, spin_go
  buyIn?: number; // For tournaments - fixed buy-in
  prizePool?: number; // For Spin & Go - random prize multiplier
}

// Sit-N-Go configuration
export interface SitNGoConfig {
  id: string;
  name: string;
  buyIn: number;
  players: number; // 2, 3, 6, 9
  prizeStructure: number[]; // Percentage for each place
  startingStack: number;
  blindLevels: { sb: number; bb: number; duration: number }[];
}

// Spin & Go configuration  
export interface SpinGoConfig {
  id: string;
  buyIn: number;
  multiplierOptions: { multiplier: number; probability: number }[];
  maxPlayers: 3;
  startingStack: number;
}

// Countries for table names
export const tableCountries = [
  { name: "Россия", flag: "🇷🇺" },
  { name: "Украина", flag: "🇺🇦" },
  { name: "Беларусь", flag: "🇧🇾" },
  { name: "Казахстан", flag: "🇰🇿" },
  { name: "Узбекистан", flag: "🇺🇿" },
  { name: "Грузия", flag: "🇬🇪" },
  { name: "Армения", flag: "🇦🇲" },
  { name: "Азербайджан", flag: "🇦🇿" },
  { name: "Молдова", flag: "🇲🇩" },
  { name: "Кыргызстан", flag: "🇰🇬" },
  { name: "Таджикистан", flag: "🇹🇯" },
  { name: "Израиль", flag: "🇮🇱" },
  { name: "США", flag: "🇺🇸" },
] as const;

// Generate predefined tables config
export function generatePokerTablesConfig(): PokerTableConfig[] {
  const tables: PokerTableConfig[] = [];
  const limits: { limit: PokerLimit; sb: number; bb: number }[] = [
    { limit: "NL2", sb: 0.01, bb: 0.02 },
    { limit: "NL5", sb: 0.02, bb: 0.05 },
    { limit: "NL10", sb: 0.05, bb: 0.10 },
    { limit: "NL25", sb: 0.10, bb: 0.25 },
    { limit: "NL50", sb: 0.25, bb: 0.50 },
    { limit: "NL100", sb: 0.50, bb: 1.00 },
    { limit: "NL200", sb: 1.00, bb: 2.00 },
    { limit: "NL500", sb: 2.50, bb: 5.00 },
  ];
  
  let countryIndex = 0;
  
  for (const { limit, sb, bb } of limits) {
    // 6-max table
    const country6 = tableCountries[countryIndex % tableCountries.length];
    tables.push({
      name: `${country6.name} ${limit}`,
      countryFlag: country6.flag,
      limit,
      maxSeats: 6,
      smallBlind: sb,
      bigBlind: bb,
      minBuyIn: bb * 20,
      maxBuyIn: bb * 100,
    });
    countryIndex++;
    
    // 9-max table
    const country9 = tableCountries[countryIndex % tableCountries.length];
    tables.push({
      name: `${country9.name} ${limit}`,
      countryFlag: country9.flag,
      limit,
      maxSeats: 9,
      smallBlind: sb,
      bigBlind: bb,
      minBuyIn: bb * 20,
      maxBuyIn: bb * 100,
    });
    countryIndex++;
  }
  
  return tables;
}

// Predefined Sit-N-Go configurations
export const sitNGoConfigs: SitNGoConfig[] = [
  {
    id: "sng_2p_1",
    name: "Heads Up $1",
    buyIn: 1,
    players: 2,
    prizeStructure: [100], // Winner takes all
    startingStack: 1500,
    blindLevels: [
      { sb: 10, bb: 20, duration: 180 },
      { sb: 15, bb: 30, duration: 180 },
      { sb: 25, bb: 50, duration: 180 },
      { sb: 50, bb: 100, duration: 180 },
      { sb: 75, bb: 150, duration: 180 },
      { sb: 100, bb: 200, duration: 180 },
    ]
  },
  {
    id: "sng_3p_2",
    name: "3-Max $2",
    buyIn: 2,
    players: 3,
    prizeStructure: [65, 35], // 1st: 65%, 2nd: 35%
    startingStack: 1500,
    blindLevels: [
      { sb: 10, bb: 20, duration: 180 },
      { sb: 15, bb: 30, duration: 180 },
      { sb: 25, bb: 50, duration: 180 },
      { sb: 50, bb: 100, duration: 180 },
      { sb: 75, bb: 150, duration: 180 },
    ]
  },
  {
    id: "sng_6p_5",
    name: "6-Max $5",
    buyIn: 5,
    players: 6,
    prizeStructure: [60, 30, 10], // Top 3 get paid
    startingStack: 2000,
    blindLevels: [
      { sb: 10, bb: 20, duration: 300 },
      { sb: 20, bb: 40, duration: 300 },
      { sb: 30, bb: 60, duration: 300 },
      { sb: 50, bb: 100, duration: 300 },
      { sb: 75, bb: 150, duration: 300 },
      { sb: 100, bb: 200, duration: 300 },
    ]
  },
  {
    id: "sng_9p_10",
    name: "9-Max $10",
    buyIn: 10,
    players: 9,
    prizeStructure: [50, 30, 20], // Top 3 get paid
    startingStack: 3000,
    blindLevels: [
      { sb: 15, bb: 30, duration: 360 },
      { sb: 25, bb: 50, duration: 360 },
      { sb: 50, bb: 100, duration: 360 },
      { sb: 75, bb: 150, duration: 360 },
      { sb: 100, bb: 200, duration: 360 },
      { sb: 150, bb: 300, duration: 360 },
    ]
  },
];

// Predefined Spin & Go configurations
export const spinGoConfigs: SpinGoConfig[] = [
  {
    id: "spin_1",
    buyIn: 1,
    multiplierOptions: [
      { multiplier: 2, probability: 75 },    // 2x most common
      { multiplier: 3, probability: 15 },    // 3x 
      { multiplier: 5, probability: 7 },     // 5x
      { multiplier: 10, probability: 2.5 },  // 10x
      { multiplier: 25, probability: 0.4 },  // 25x
      { multiplier: 100, probability: 0.1 }, // 100x rare
    ],
    maxPlayers: 3,
    startingStack: 500,
  },
  {
    id: "spin_2",
    buyIn: 2,
    multiplierOptions: [
      { multiplier: 2, probability: 75 },
      { multiplier: 3, probability: 15 },
      { multiplier: 5, probability: 7 },
      { multiplier: 10, probability: 2.5 },
      { multiplier: 25, probability: 0.4 },
      { multiplier: 100, probability: 0.1 },
    ],
    maxPlayers: 3,
    startingStack: 500,
  },
  {
    id: "spin_5",
    buyIn: 5,
    multiplierOptions: [
      { multiplier: 2, probability: 72 },
      { multiplier: 3, probability: 17 },
      { multiplier: 5, probability: 8 },
      { multiplier: 10, probability: 2.5 },
      { multiplier: 25, probability: 0.4 },
      { multiplier: 100, probability: 0.1 },
    ],
    maxPlayers: 3,
    startingStack: 500,
  },
  {
    id: "spin_10",
    buyIn: 10,
    multiplierOptions: [
      { multiplier: 2, probability: 70 },
      { multiplier: 3, probability: 18 },
      { multiplier: 5, probability: 9 },
      { multiplier: 10, probability: 2.5 },
      { multiplier: 25, probability: 0.4 },
      { multiplier: 100, probability: 0.1 },
    ],
    maxPlayers: 3,
    startingStack: 500,
  },
];

// Winner info for showdown display
export interface WinnerInfo {
  seatNumber: number;
  odejs: string;
  username: string;
  holeCards: Card[];
  handDescription: string;
  amountWon: number;
}

// Run-it-twice vote state
export interface RunItTwiceState {
  isActive: boolean;
  deadline: number; // Unix timestamp when voting expires
  votes: { [seatNumber: number]: 1 | 2 | null }; // 1 = one board, 2 = two boards, null = not voted
  result?: 1 | 2; // Final result after voting
}

// Poker game state for WebSocket
export interface PokerGameState {
  tableId: string;
  tableName: string;
  handNumber: number;
  pot: number;
  communityCards: Card[];
  communityCards2?: Card[]; // Second board for run-it-twice
  status: "waiting" | "preflop" | "flop" | "turn" | "river" | "showdown";
  dealerSeat: number;
  currentTurn: number | null;
  currentBet: number;
  minRaise: number;
  players: PokerPlayerState[];
  timeBank: number;
  actionDeadline: number; // Unix timestamp when action expires (0 = no timer)
  bigBlind: number;
  smallBlind: number;
  winners?: WinnerInfo[]; // Winner info for showdown display
  winners2?: WinnerInfo[]; // Winners for second board in run-it-twice
  showdownDeadline?: number; // When showdown reveal period ends
  revealedSeats?: number[]; // Seat numbers of players who revealed their cards
  runItTwice?: RunItTwiceState; // Run-it-twice voting state
}

export interface PokerPlayerState {
  odejs: string;
  odejsname: string;
  odejsPhotoUrl?: string;
  seatNumber: number;
  chipStack: number;
  betAmount: number;
  isFolded: boolean;
  isAllIn: boolean;
  isDealer: boolean;
  isSmallBlind: boolean;
  isBigBlind: boolean;
  isCurrentTurn: boolean;
  holeCards?: Card[]; // Only visible to the player themselves
  hasCards?: boolean; // True if player has cards (for showing card backs)
  isSittingOut: boolean;
  isReady: boolean; // false = away
  handStrength?: string; // e.g. "Pair", "Two Pair", "Flush"
}
