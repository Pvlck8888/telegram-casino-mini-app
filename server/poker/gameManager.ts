import { Card, PokerGameState, PokerPlayerState, PokerAction } from "@shared/schema";
import { createDeck, shuffleDeck, evaluateHand, compareHands, cardsToString } from "./handEvaluator";

export interface TablePlayer {
  odejs: string;
  username: string;
  photoUrl?: string;
  seatNumber: number;
  chipStack: number;
  holeCards: Card[];
  betAmount: number;
  totalBetInHand: number;
  isFolded: boolean;
  isAllIn: boolean;
  hasActed: boolean;
  isSittingOut: boolean;
  isReady: boolean; // false = away
}

interface WinnerInfo {
  seatNumber: number;
  odejs: string;
  username: string;
  holeCards: Card[];
  handDescription: string;
  amountWon: number;
}

interface RunItTwiceVote {
  isActive: boolean;
  deadline: number;
  votes: Map<number, 1 | 2 | null>; // seatNumber -> choice
  timeout?: NodeJS.Timeout;
  result?: 1 | 2; // Final result after voting
}

interface ActiveHand {
  tableId: string;
  handNumber: number;
  pot: number;
  sidePots: { amount: number; eligiblePlayers: string[] }[];
  communityCards: Card[];
  communityCards2?: Card[]; // Second board for run-it-twice
  deck: Card[];
  deckIndex: number;
  status: "waiting" | "preflop" | "flop" | "turn" | "river" | "showdown";
  dealerSeat: number;
  smallBlindSeat: number;
  bigBlindSeat: number;
  currentTurn: number | null;
  currentBet: number;
  minRaise: number;
  lastRaiser: number | null;
  players: Map<number, TablePlayer>;
  smallBlind: number;
  bigBlind: number;
  rakePercent: number;
  rakeCap: number;
  rake: number;
  actionTimeout: NodeJS.Timeout | null;
  actionDeadline: number; // Unix timestamp when current player's turn expires
  winners?: WinnerInfo[]; // Showdown winner info
  winners2?: WinnerInfo[]; // Winners for second board in run-it-twice
  revealedCards: Set<number>; // Seat numbers of players who chose to reveal their cards
  showdownDeadline?: number; // When showdown reveal period ends
  runItTwice?: RunItTwiceVote; // Run-it-twice voting state
}

const TURN_TIME_SECONDS = 30;
const ZERO_STACK_KICK_SECONDS = 15;
const SIT_OUT_KICK_SECONDS = 240; // 4 minutes - kick player after sitting out this long
const SHOWDOWN_DISPLAY_SECONDS = 5; // Time to show winner and allow card reveals
const RUN_IT_TWICE_VOTE_SECONDS = 8; // Time for players to vote on run-it-twice
const DISCONNECT_GRACE_SECONDS = 20; // Grace period before turn timer starts for disconnected players

export interface TableSnapshot {
  tableId: string;
  status: string;
  smallBlind: number;
  bigBlind: number;
  playerCount: number;
  seats: Array<{
    seatNumber: number;
    odejs: string | null;
    chipStack: number;
    isSittingOut: boolean;
  }>;
  currentTurn: number | null;
}

export class PokerTableManager {
  private tables: Map<string, ActiveHand> = new Map();
  private tableHandNumbers: Map<string, number> = new Map();
  private zeroStackTimers: Map<string, NodeJS.Timeout> = new Map(); // key: tableId-seatNumber
  private sitOutKickTimers: Map<string, NodeJS.Timeout> = new Map(); // key: tableId-seatNumber, kicks after 4min sit out
  private disconnectedPlayers: Set<string> = new Set(); // odejs of players who are disconnected
  private pausedTurnTimers: Map<string, { tableId: string; seatNumber: number; remainingTime: number; graceConsumed: boolean }> = new Map(); // odejs -> paused timer info
  private totalRakeCollected: number = 0; // Total rake collected across all tables
  private onStateChange: (tableId: string, state: PokerGameState) => void;
  private onBalanceChange: (odejs: string, amount: number) => void;
  private onPlayerKicked: (tableId: string, odejs: string, seatNumber: number) => void;
  private onBotTurn?: (tableId: string, seatNumber: number, state: PokerGameState) => void;

  constructor(
    onStateChange: (tableId: string, state: PokerGameState) => void,
    onBalanceChange: (odejs: string, amount: number) => void,
    onPlayerKicked?: (tableId: string, odejs: string, seatNumber: number) => void
  ) {
    this.onStateChange = onStateChange;
    this.onBalanceChange = onBalanceChange;
    this.onPlayerKicked = onPlayerKicked || (() => {});
  }

  setBotTurnCallback(callback: (tableId: string, seatNumber: number, state: PokerGameState) => void): void {
    this.onBotTurn = callback;
  }

  getActiveTables(): TableSnapshot[] {
    const snapshots: TableSnapshot[] = [];
    const entries = Array.from(this.tables.entries());
    for (const [tableId, hand] of entries) {
      const seats: TableSnapshot["seats"] = [];
      const playerEntries = Array.from(hand.players.entries());
      for (const [seatNumber, player] of playerEntries) {
        seats.push({
          seatNumber,
          odejs: player.odejs,
          chipStack: player.chipStack,
          isSittingOut: player.isSittingOut || false,
        });
      }
      snapshots.push({
        tableId,
        status: hand.status,
        smallBlind: hand.smallBlind,
        bigBlind: hand.bigBlind,
        playerCount: hand.players.size,
        seats,
        currentTurn: hand.currentTurn,
      });
    }
    return snapshots;
  }

  getTotalRake(): number {
    return this.totalRakeCollected;
  }

  getOrCreateTable(tableId: string, smallBlind: number, bigBlind: number, rakePercent: number, rakeCap: number): ActiveHand {
    let hand = this.tables.get(tableId);
    if (!hand) {
      hand = {
        tableId,
        handNumber: this.tableHandNumbers.get(tableId) || 0,
        pot: 0,
        sidePots: [],
        communityCards: [],
        deck: [],
        deckIndex: 0,
        status: "waiting",
        dealerSeat: 0,
        smallBlindSeat: 0,
        bigBlindSeat: 0,
        currentTurn: null,
        currentBet: 0,
        minRaise: bigBlind,
        lastRaiser: null,
        players: new Map(),
        smallBlind,
        bigBlind,
        rakePercent,
        rakeCap,
        rake: 0,
        actionTimeout: null,
        actionDeadline: 0,
        revealedCards: new Set(),
      };
      this.tables.set(tableId, hand);
    }
    return hand;
  }

  addPlayer(tableId: string, player: Omit<TablePlayer, "holeCards" | "betAmount" | "totalBetInHand" | "isFolded" | "isAllIn" | "hasActed" | "isReady">): boolean {
    const hand = this.tables.get(tableId);
    if (!hand) return false;

    // Validate seat is not taken
    if (hand.players.has(player.seatNumber)) {
      console.log(`[PokerTable] Seat ${player.seatNumber} already taken at table ${tableId}`);
      return false;
    }

    // Validate seat number is within bounds
    if (player.seatNumber < 0 || player.seatNumber >= 9) {
      console.log(`[PokerTable] Invalid seat number ${player.seatNumber}`);
      return false;
    }

    // Validate player is not already at this table
    for (const [_, existingPlayer] of Array.from(hand.players)) {
      if (existingPlayer.odejs === player.odejs) {
        console.log(`[PokerTable] Player ${player.odejs} already at table ${tableId}`);
        return false;
      }
    }

    // Validate chip stack
    if (player.chipStack <= 0) {
      console.log(`[PokerTable] Invalid chip stack ${player.chipStack}`);
      return false;
    }

    hand.players.set(player.seatNumber, {
      ...player,
      holeCards: [],
      betAmount: 0,
      totalBetInHand: 0,
      isFolded: false,
      isAllIn: false,
      hasActed: false,
      isReady: true,
    });

    console.log(`[PokerTable] Player ${player.odejs} (${player.username}) joined table ${tableId} at seat ${player.seatNumber} with $${player.chipStack}`);
    this.broadcastState(tableId);
    
    // Trigger deal start check when player joins (similar to returning from sit out)
    if (hand.status === "waiting") {
      setTimeout(() => {
        if (this.canStartHand(tableId)) {
          console.log(`Player joined table, starting new hand for table ${tableId}`);
          this.startNewHand(tableId);
        }
      }, 1500);
    }
    
    return true;
  }

  removePlayer(tableId: string, seatNumber: number): boolean {
    const hand = this.tables.get(tableId);
    if (!hand) return false;

    const player = hand.players.get(seatNumber);
    if (!player) return false;

    // Clear any timers for this player
    this.clearZeroStackTimer(tableId, seatNumber);
    this.clearSitOutKickTimer(tableId, seatNumber);

    // If hand is active, fold the leaving player first
    if (hand.status !== "waiting" && !player.isFolded) {
      console.log(`Player ${player.odejs} leaving during active hand - auto-folding`);
      player.isFolded = true;
      
      // If it was their turn, clear timer
      if (hand.currentTurn === seatNumber) {
        this.clearTurnTimer(hand);
      }
      
      // Check if only one player remains - they win the pot
      const activePlayers = Array.from(hand.players.values()).filter(p => !p.isFolded);
      if (activePlayers.length === 1) {
        console.log(`Only one player remaining - awarding pot to ${activePlayers[0].odejs}`);
        this.awardPot(hand, activePlayers[0]);
        this.endHandAndRemovePlayer(tableId, seatNumber, player.chipStack, player.odejs);
        return true;
      }
      
      // If it was this player's turn, move to next player
      if (hand.currentTurn === seatNumber) {
        this.moveToNextPlayer(hand);
        if (hand.currentTurn) {
          this.startTurnTimer(tableId);
        } else if (this.isStreetComplete(hand)) {
          this.advanceStreet(hand);
          // advanceStreet handles turn assignment and showdown
        }
        this.broadcastState(tableId);
      }
    }

    // Return chips to player balance
    if (player.chipStack > 0) {
      this.onBalanceChange(player.odejs, player.chipStack);
    }

    // Clean up disconnected state
    this.cleanupDisconnectedState(player.odejs);
    
    hand.players.delete(seatNumber);
    this.broadcastState(tableId);
    return true;
  }

  private endHandAndRemovePlayer(tableId: string, seatNumber: number, chipStack: number, odejs: string): void {
    const hand = this.tables.get(tableId);
    if (!hand) return;

    this.clearTurnTimer(hand);
    hand.status = "waiting";
    hand.currentTurn = null;

    // Return chips to leaving player
    if (chipStack > 0) {
      this.onBalanceChange(odejs, chipStack);
    }

    // Clean up disconnected state
    this.cleanupDisconnectedState(odejs);
    
    // Remove the player
    hand.players.delete(seatNumber);

    // Check for players with zero chips - start kick timers
    this.checkZeroStackPlayers(hand);

    this.broadcastState(tableId);

    // Auto-start next hand after delay if enough players
    setTimeout(() => {
      if (this.canStartHand(tableId)) {
        this.startNewHand(tableId);
      }
    }, 1500);
  }

  // Rebuy - add chips to player's stack and cancel kick timer
  // Returns the new chip stack after adding amount
  rebuy(tableId: string, seatNumber: number, amount: number): number | null {
    const hand = this.tables.get(tableId);
    if (!hand) return null;

    const player = hand.players.get(seatNumber);
    if (!player) return null;

    // Cancel all kick timers since player is rebuying/returning
    this.clearZeroStackTimer(tableId, seatNumber);
    this.clearSitOutKickTimer(tableId, seatNumber);

    // Add chips to stack
    player.chipStack += amount;
    player.isSittingOut = false;

    this.broadcastState(tableId);
    console.log(`Player ${player.odejs} rebought ${amount} at table ${tableId}, new stack: ${player.chipStack}`);
    
    // Trigger deal start check if we're in waiting state (player returned)
    if (hand.status === "waiting" && this.canStartHand(hand.tableId)) {
      setTimeout(() => {
        if (this.canStartHand(hand.tableId)) {
          console.log(`Player rebought, starting new hand for table ${hand.tableId}`);
          this.startNewHand(hand.tableId);
        }
      }, 1000);
    }
    
    return player.chipStack;
  }

  private startZeroStackTimer(tableId: string, seatNumber: number, odejs: string): void {
    const timerKey = `${tableId}-${seatNumber}`;
    
    // Clear any existing timer
    this.clearZeroStackTimer(tableId, seatNumber);

    console.log(`Starting ${ZERO_STACK_KICK_SECONDS}s kick timer for player ${odejs} at seat ${seatNumber}`);

    const timer = setTimeout(() => {
      console.log(`Kicking player ${odejs} from seat ${seatNumber} - no rebuy in ${ZERO_STACK_KICK_SECONDS}s`);
      
      // Clean up disconnected state
      this.cleanupDisconnectedState(odejs);
      
      // Remove player from table (chips already 0, nothing to return)
      const hand = this.tables.get(tableId);
      if (hand) {
        hand.players.delete(seatNumber);
        this.broadcastState(tableId);
      }
      
      this.zeroStackTimers.delete(timerKey);
      this.onPlayerKicked(tableId, odejs, seatNumber);
    }, ZERO_STACK_KICK_SECONDS * 1000);

    this.zeroStackTimers.set(timerKey, timer);
  }

  private clearZeroStackTimer(tableId: string, seatNumber: number): void {
    const timerKey = `${tableId}-${seatNumber}`;
    const timer = this.zeroStackTimers.get(timerKey);
    if (timer) {
      clearTimeout(timer);
      this.zeroStackTimers.delete(timerKey);
      console.log(`Cleared kick timer for seat ${seatNumber} at table ${tableId}`);
    }
  }

  private checkZeroStackPlayers(hand: ActiveHand): void {
    for (const [seatNumber, player] of Array.from(hand.players.entries())) {
      if (player.chipStack <= 0) {
        // Start kick timer for this player with zero chips
        this.startZeroStackTimer(hand.tableId, seatNumber, player.odejs);
      }
    }
  }

  // Start 4-minute kick timer for player who is sitting out due to timeout
  private startSitOutKickTimer(tableId: string, seatNumber: number, odejs: string): void {
    const timerKey = `${tableId}-${seatNumber}`;
    
    // Clear any existing timer
    this.clearSitOutKickTimer(tableId, seatNumber);

    console.log(`Starting ${SIT_OUT_KICK_SECONDS}s (4min) sit-out kick timer for player ${odejs} at seat ${seatNumber}`);

    const timer = setTimeout(() => {
      console.log(`Kicking player ${odejs} from seat ${seatNumber} - no return from sit-out in ${SIT_OUT_KICK_SECONDS}s`);
      
      const hand = this.tables.get(tableId);
      if (hand) {
        const player = hand.players.get(seatNumber);
        if (player) {
          // Clean up disconnected state BEFORE removing player
          this.cleanupDisconnectedState(odejs);
          
          // Return chips to balance
          if (player.chipStack > 0) {
            this.onBalanceChange(player.odejs, player.chipStack);
          }
          hand.players.delete(seatNumber);
          this.broadcastState(tableId);
        }
      }
      
      this.sitOutKickTimers.delete(timerKey);
      this.onPlayerKicked(tableId, odejs, seatNumber);
    }, SIT_OUT_KICK_SECONDS * 1000);

    this.sitOutKickTimers.set(timerKey, timer);
  }

  private clearSitOutKickTimer(tableId: string, seatNumber: number): void {
    const timerKey = `${tableId}-${seatNumber}`;
    const timer = this.sitOutKickTimers.get(timerKey);
    if (timer) {
      clearTimeout(timer);
      this.sitOutKickTimers.delete(timerKey);
      console.log(`Cleared sit-out kick timer for seat ${seatNumber} at table ${tableId}`);
    }
  }

  // Mark player as disconnected (WebSocket closed) - pauses turn timer if it's their turn
  markPlayerDisconnected(odejs: string): void {
    this.disconnectedPlayers.add(odejs);
    console.log(`Player ${odejs} marked as disconnected`);
    
    // Check if this player has the current turn on any table
    const entries = Array.from(this.tables.entries());
    for (const [tableId, hand] of entries) {
      if (hand.currentTurn !== null) {
        const player = hand.players.get(hand.currentTurn);
        if (player && player.odejs === odejs) {
          const currentSeat = hand.currentTurn;
          const now = Date.now();
          
          // Clear existing timeout
          if (hand.actionTimeout) {
            clearTimeout(hand.actionTimeout);
            hand.actionTimeout = null;
          }
          
          // Check if grace was already consumed for this turn
          const existingPaused = this.pausedTurnTimers.get(odejs);
          const graceAlreadyUsed = existingPaused && existingPaused.graceConsumed && existingPaused.seatNumber === currentSeat;
          
          // Calculate remaining time from deadline
          const remaining = Math.max(0, hand.actionDeadline - now);
          
          // If timer expired, fold immediately
          if (remaining <= 0) {
            console.log(`Player ${odejs} disconnected but turn already expired - auto-folding`);
            if (!player.odejs.startsWith("bot_")) {
              player.isSittingOut = true;
              this.startSitOutKickTimer(tableId, currentSeat, player.odejs);
            }
            this.handleAction(tableId, currentSeat, "fold");
            return;
          }
          
          // Determine new deadline: only add grace if not already consumed
          let timeUntilDeadline: number;
          if (graceAlreadyUsed) {
            // Grace already consumed - just use remaining time, no extra
            timeUntilDeadline = remaining;
            console.log(`Player ${odejs} re-disconnected (grace already used) - ${timeUntilDeadline}ms remaining`);
          } else {
            // First disconnect this turn - grant grace (capped at max)
            const maxTime = (TURN_TIME_SECONDS + DISCONNECT_GRACE_SECONDS) * 1000;
            timeUntilDeadline = Math.min(remaining + (DISCONNECT_GRACE_SECONDS * 1000), maxTime);
            console.log(`Player ${odejs} disconnected - granting grace, ${timeUntilDeadline}ms total`);
          }
          
          // Update deadline
          hand.actionDeadline = now + timeUntilDeadline;
          
          // Mark grace as consumed
          this.pausedTurnTimers.set(odejs, {
            tableId,
            seatNumber: currentSeat,
            remainingTime: 0,
            graceConsumed: true
          });
          
          // Schedule watchdog
          hand.actionTimeout = setTimeout(() => {
            const currentHand = this.tables.get(tableId);
            if (!currentHand || currentHand.currentTurn !== currentSeat) return;
            
            const p = currentHand.players.get(currentSeat);
            if (p) {
              console.log(`Player ${p.username} disconnected too long - auto-folding`);
              if (!p.odejs.startsWith("bot_")) {
                p.isSittingOut = true;
                this.startSitOutKickTimer(tableId, currentSeat, p.odejs);
              }
              this.handleAction(tableId, currentSeat, "fold");
            }
          }, timeUntilDeadline);
          
          this.broadcastState(tableId);
        }
      }
    }
  }
  
  // Clean up disconnected state for a player (called when player is removed)
  private cleanupDisconnectedState(odejs: string): void {
    this.disconnectedPlayers.delete(odejs);
    this.pausedTurnTimers.delete(odejs);
  }

  // Mark player as reconnected - resumes turn timer if paused
  markPlayerReconnected(odejs: string): void {
    this.disconnectedPlayers.delete(odejs);
    console.log(`Player ${odejs} marked as reconnected`);
    
    // Check for paused timer - DO NOT delete it yet, keep graceConsumed flag for subsequent disconnects
    const pausedTimer = this.pausedTurnTimers.get(odejs);
    if (pausedTimer) {
      const { tableId, seatNumber } = pausedTimer;
      // Note: We keep pausedTimer in place so graceConsumed persists for this turn
      
      const hand = this.tables.get(tableId);
      if (hand && hand.currentTurn === seatNumber) {
        // Calculate actual remaining time from the deadline (accounts for time spent disconnected)
        const now = Date.now();
        const actualRemaining = Math.max(0, hand.actionDeadline - now);
        
        // Clamp to max allowance (30s + 20s grace = 50s)
        const maxTime = (TURN_TIME_SECONDS + DISCONNECT_GRACE_SECONDS) * 1000;
        const clampedTime = Math.min(actualRemaining, maxTime);
        
        // If time has expired while disconnected, fold immediately
        if (clampedTime <= 0) {
          console.log(`Player ${odejs} reconnected but turn already expired - auto-folding`);
          const player = hand.players.get(seatNumber);
          if (player && !player.odejs.startsWith("bot_")) {
            player.isSittingOut = true;
            this.startSitOutKickTimer(tableId, seatNumber, player.odejs);
          }
          this.handleAction(tableId, seatNumber, "fold");
          return;
        }
        
        console.log(`Resuming turn timer for player ${odejs} with ${clampedTime}ms remaining`);
        
        // Clear the existing watchdog timeout (just the callback, not the deadline)
        if (hand.actionTimeout) {
          clearTimeout(hand.actionTimeout);
          hand.actionTimeout = null;
        }
        
        // Restore the deadline with the computed time
        hand.actionDeadline = Date.now() + clampedTime;
        
        // Start new timeout with actual remaining time
        hand.actionTimeout = setTimeout(() => {
          const currentHand = this.tables.get(tableId);
          if (!currentHand || currentHand.currentTurn !== seatNumber) {
            return;
          }
          
          const player = currentHand.players.get(seatNumber);
          if (player) {
            console.log(`Player ${player.username} timed out after reconnect - auto-folding`);
            if (!player.odejs.startsWith("bot_")) {
              player.isSittingOut = true;
              this.startSitOutKickTimer(tableId, seatNumber, player.odejs);
            }
            this.handleAction(tableId, seatNumber, "fold");
          }
        }, clampedTime);
        
        this.broadcastState(tableId);
      }
    }
    // Note: No fallback to start fresh timer - if there's no paused timer, the turn should
    // already have a timer running or the player will get a fresh timer on their next turn
  }

  // Check if player is disconnected
  isPlayerDisconnected(odejs: string): boolean {
    return this.disconnectedPlayers.has(odejs);
  }

  // Toggle sit out status for a player
  setSitOut(tableId: string, seatNumber: number, sitOut: boolean): boolean {
    const hand = this.tables.get(tableId);
    if (!hand) return false;

    const player = hand.players.get(seatNumber);
    if (!player) return false;

    player.isSittingOut = sitOut;
    console.log(`Player ${player.odejs} at seat ${seatNumber} is now ${sitOut ? "sitting out" : "back in"}`);
    
    if (!sitOut) {
      // Player is returning from sit out - cancel the kick timer
      this.clearSitOutKickTimer(tableId, seatNumber);
      
      // Trigger deal start check if we're in waiting state
      if (hand.status === "waiting" && this.canStartHand(tableId)) {
        console.log(`Player returned from sit-out, checking deal start for table ${tableId}`);
        setTimeout(() => {
          if (this.canStartHand(tableId)) {
            this.startNewHand(tableId);
          }
        }, 1000);
      }
    }
    
    this.broadcastState(tableId);
    return true;
  }

  // Admin: Kick a player from the table (returns chips to balance)
  kickPlayer(tableId: string, seatNumber: number): { odejs: string; chips: number } | null {
    const hand = this.tables.get(tableId);
    if (!hand) return null;

    const player = hand.players.get(seatNumber);
    if (!player) return null;

    const odejs = player.odejs;
    const chips = player.chipStack;

    // Clear any kick timers
    this.clearZeroStackTimer(tableId, seatNumber);
    this.clearSitOutKickTimer(tableId, seatNumber);
    
    // Clean up disconnected state
    this.cleanupDisconnectedState(odejs);

    // If in active hand, fold them first
    if (hand.status !== "waiting" && !player.isFolded) {
      player.isFolded = true;
    }

    // Remove player
    hand.players.delete(seatNumber);

    // Return chips to balance
    if (chips > 0) {
      this.onBalanceChange(odejs, chips);
    }

    this.broadcastState(tableId);
    
    // Notify about kick
    this.onPlayerKicked(tableId, odejs, seatNumber);

    return { odejs, chips };
  }

  // Admin: Close table - kick all players and return chips
  closeTable(tableId: string): { kicked: Array<{ odejs: string; chips: number }> } {
    const hand = this.tables.get(tableId);
    if (!hand) return { kicked: [] };

    const kicked: Array<{ odejs: string; chips: number }> = [];

    // Clear turn timer
    this.clearTurnTimer(hand);

    // Kick all players and return their chips
    for (const [seatNumber, player] of Array.from(hand.players.entries())) {
      this.clearZeroStackTimer(tableId, seatNumber);
      this.clearSitOutKickTimer(tableId, seatNumber);
      this.cleanupDisconnectedState(player.odejs);
      
      if (player.chipStack > 0) {
        this.onBalanceChange(player.odejs, player.chipStack);
      }
      
      kicked.push({ odejs: player.odejs, chips: player.chipStack });
      this.onPlayerKicked(tableId, player.odejs, seatNumber);
    }

    // Clear all players
    hand.players.clear();
    hand.status = "waiting";
    hand.pot = 0;
    hand.communityCards = [];
    hand.currentTurn = null;

    this.broadcastState(tableId);
    
    return { kicked };
  }

  // Admin: Refresh table state - reset hand if in waiting, broadcast state
  refreshTable(tableId: string): boolean {
    const hand = this.tables.get(tableId);
    if (!hand) return false;

    // If waiting, just broadcast current state
    // If in active hand, we don't interrupt it
    this.broadcastState(tableId);
    
    return true;
  }

  // Get player info by odejs
  getPlayerBySeat(tableId: string, seatNumber: number): TablePlayer | null {
    const hand = this.tables.get(tableId);
    if (!hand) return null;
    return hand.players.get(seatNumber) || null;
  }

  canStartHand(tableId: string): boolean {
    const hand = this.tables.get(tableId);
    if (!hand) return false;

    const activePlayers = Array.from(hand.players.values()).filter(p => !p.isSittingOut && p.chipStack > 0);
    return activePlayers.length >= 2 && hand.status === "waiting";
  }

  startNewHand(tableId: string): boolean {
    const hand = this.tables.get(tableId);
    if (!hand || !this.canStartHand(tableId)) return false;

    // Increment hand number
    hand.handNumber++;
    this.tableHandNumbers.set(tableId, hand.handNumber);

    // Reset hand state
    hand.pot = 0;
    hand.sidePots = [];
    hand.communityCards = [];
    hand.currentBet = 0;
    hand.minRaise = hand.bigBlind;
    hand.lastRaiser = null;
    hand.rake = 0;
    hand.status = "preflop";

    // Create and shuffle deck
    hand.deck = shuffleDeck(createDeck());
    hand.deckIndex = 0;

    // Reset player states
    const activePlayers = Array.from(hand.players.entries())
      .filter(([_, p]) => !p.isSittingOut && p.chipStack > 0)
      .sort((a, b) => a[0] - b[0]);

    for (const [seat, player] of Array.from(hand.players.entries())) {
      player.holeCards = [];
      player.betAmount = 0;
      player.totalBetInHand = 0;
      player.isFolded = player.isSittingOut || player.chipStack <= 0;
      player.isAllIn = false;
      player.hasActed = false;
    }

    // Move dealer button
    const seats = activePlayers.map(([seat]) => seat);
    const currentDealerIndex = seats.indexOf(hand.dealerSeat);
    const newDealerIndex = (currentDealerIndex + 1) % seats.length;
    hand.dealerSeat = seats[newDealerIndex];

    // Set blinds
    const sbIndex = (newDealerIndex + 1) % seats.length;
    const bbIndex = (newDealerIndex + 2) % seats.length;
    
    // Special case for heads-up
    if (seats.length === 2) {
      hand.smallBlindSeat = seats[newDealerIndex];
      hand.bigBlindSeat = seats[(newDealerIndex + 1) % 2];
    } else {
      hand.smallBlindSeat = seats[sbIndex];
      hand.bigBlindSeat = seats[bbIndex];
    }

    // Post blinds
    this.postBlind(hand, hand.smallBlindSeat, hand.smallBlind);
    this.postBlind(hand, hand.bigBlindSeat, hand.bigBlind);
    hand.currentBet = hand.bigBlind;

    // Deal hole cards
    for (const [seat, player] of Array.from(hand.players.entries())) {
      if (!player.isFolded) {
        player.holeCards = [
          hand.deck[hand.deckIndex++],
          hand.deck[hand.deckIndex++]
        ];
      }
    }

    // Set first action
    const firstToActIndex = seats.length === 2 ? 0 : (bbIndex + 1) % seats.length;
    hand.currentTurn = seats[firstToActIndex];

    this.startTurnTimer(tableId);
    this.broadcastState(tableId);
    
    this.checkBotTurn(hand, seats[firstToActIndex]);
    
    return true;
  }

  private postBlind(hand: ActiveHand, seatNumber: number, amount: number): void {
    const player = hand.players.get(seatNumber);
    if (!player) return;

    const actualAmount = Math.min(amount, player.chipStack);
    player.chipStack -= actualAmount;
    player.betAmount = actualAmount;
    player.totalBetInHand = actualAmount;
    hand.pot += actualAmount;

    if (player.chipStack === 0) {
      player.isAllIn = true;
    }
  }

  handleAction(tableId: string, seatNumber: number, action: PokerAction, amount?: number): boolean {
    try {
      const hand = this.tables.get(tableId);
      if (!hand || hand.currentTurn !== seatNumber) return false;

      const player = hand.players.get(seatNumber);
      if (!player || player.isFolded || player.isAllIn) return false;

      this.clearTurnTimer(hand);
      
      // Clear paused timer for this player - they successfully acted
      this.pausedTurnTimers.delete(player.odejs);

      switch (action) {
      case "fold":
        player.isFolded = true;
        break;

      case "check":
        if (hand.currentBet > player.betAmount) return false;
        break;

      case "call":
        const callAmount = Math.min(hand.currentBet - player.betAmount, player.chipStack);
        player.chipStack -= callAmount;
        player.betAmount += callAmount;
        player.totalBetInHand += callAmount;
        hand.pot += callAmount;
        if (player.chipStack === 0) player.isAllIn = true;
        break;

      case "bet":
      case "raise":
        if (!amount || amount < hand.minRaise) return false;
        const totalBet = hand.currentBet > 0 ? hand.currentBet + amount : amount;
        const raiseAmount = totalBet - player.betAmount;
        if (raiseAmount > player.chipStack) return false;
        
        player.chipStack -= raiseAmount;
        player.betAmount = totalBet;
        player.totalBetInHand += raiseAmount;
        hand.pot += raiseAmount;
        hand.currentBet = totalBet;
        hand.minRaise = amount;
        hand.lastRaiser = seatNumber;
        
        if (player.chipStack === 0) player.isAllIn = true;

        // Reset hasActed for all other players
        for (const [s, p] of Array.from(hand.players.entries())) {
          if (s !== seatNumber && !p.isFolded && !p.isAllIn) {
            p.hasActed = false;
          }
        }
        break;

      case "all_in":
        const allInAmount = player.chipStack;
        const newBet = player.betAmount + allInAmount;
        
        if (newBet > hand.currentBet) {
          hand.minRaise = Math.max(hand.minRaise, newBet - hand.currentBet);
          hand.currentBet = newBet;
          hand.lastRaiser = seatNumber;
          
          // Reset hasActed for all other players
          for (const [s, p] of Array.from(hand.players.entries())) {
            if (s !== seatNumber && !p.isFolded && !p.isAllIn) {
              p.hasActed = false;
            }
          }
        }
        
        player.chipStack = 0;
        player.betAmount = newBet;
        player.totalBetInHand += allInAmount;
        hand.pot += allInAmount;
        player.isAllIn = true;
        break;
    }

    player.hasActed = true;
    
    console.log(`[PokerTable] After action ${action}: player=${player.odejs}, isAllIn=${player.isAllIn}, currentBet=${hand.currentBet}`);

    // Check if hand is over
    const activePlayers = Array.from(hand.players.values()).filter(p => !p.isFolded);
    console.log(`[PokerTable] Active players: ${activePlayers.length}, folded check`);
    
    if (activePlayers.length === 1) {
      console.log(`[PokerTable] Only one player remains, awarding pot`);
      this.awardPot(hand, activePlayers[0]);
      this.endHand(tableId);
      return true;
    }

    // Check if street is complete (all non-all-in players have acted and matched bet)
    const streetComplete = this.isStreetComplete(hand);
    console.log(`[PokerTable] Street complete: ${streetComplete}`);
    
    // Move to next player or next street
    if (streetComplete) {
      console.log(`[PokerTable] Advancing street from ${hand.status}`);
      this.advanceStreet(hand);
    } else {
      console.log(`[PokerTable] Moving to next player`);
      this.moveToNextPlayer(hand);
    }

    this.startTurnTimer(tableId);
    this.broadcastState(tableId);
    return true;
    } catch (error) {
      console.error(`[PokerTable] Error in handleAction (${action}):`, error);
      // Try to recover by broadcasting current state
      try {
        this.broadcastState(tableId);
      } catch (e) { /* ignore */ }
      return false;
    }
  }

  private isStreetComplete(hand: ActiveHand): boolean {
    const activePlayers = Array.from(hand.players.values()).filter(p => !p.isFolded && !p.isAllIn);
    
    console.log(`[PokerTable] isStreetComplete check: ${activePlayers.length} active players (not folded/all-in)`);
    for (const p of activePlayers) {
      console.log(`[PokerTable]   - ${p.odejs}: hasActed=${p.hasActed}, betAmount=${p.betAmount}, currentBet=${hand.currentBet}`);
    }
    
    if (activePlayers.length === 0) {
      console.log(`[PokerTable] All players all-in or folded - street complete`);
      return true;
    }
    
    const complete = activePlayers.every(p => p.hasActed && p.betAmount === hand.currentBet);
    console.log(`[PokerTable] Street complete result: ${complete}`);
    return complete;
  }

  private moveToNextPlayer(hand: ActiveHand): void {
    const seats = Array.from(hand.players.keys()).sort((a, b) => a - b);
    const currentIndex = seats.indexOf(hand.currentTurn!);
    
    console.log(`[PokerTable] moveToNextPlayer: currentTurn=${hand.currentTurn}, seats=${seats.join(',')}`);
    
    for (let i = 1; i <= seats.length; i++) {
      const nextSeat = seats[(currentIndex + i) % seats.length];
      const player = hand.players.get(nextSeat);
      if (player) {
        console.log(`[PokerTable]   Checking seat ${nextSeat} (${player.odejs}): folded=${player.isFolded}, allIn=${player.isAllIn}, hasActed=${player.hasActed}`);
      }
      if (player && !player.isFolded && !player.isAllIn && !player.hasActed) {
        console.log(`[PokerTable] Next player: seat ${nextSeat} (${player.odejs})`);
        hand.currentTurn = nextSeat;
        this.checkBotTurn(hand, nextSeat);
        return;
      }
    }
    
    // If no one else can act, street is complete
    console.log(`[PokerTable] No valid next player found, setting currentTurn to null`);
    hand.currentTurn = null;
  }

  private checkBotTurn(hand: ActiveHand, seatNumber: number): void {
    const player = hand.players.get(seatNumber);
    if (!player) return;
    
    console.log(`[PokerTable] checkBotTurn: seat=${seatNumber}, odejs=${player.odejs}, isBot=${player.odejs.startsWith("bot_")}, hasCallback=${!!this.onBotTurn}`);
    
    if (!this.onBotTurn) {
      console.log(`[PokerTable] No bot turn callback set!`);
      return;
    }
    
    if (player.odejs.startsWith("bot_")) {
      const tableId = hand.tableId;
      console.log(`[PokerTable] Scheduling bot action for ${player.odejs} at table ${tableId}`);
      setTimeout(() => {
        const freshHand = this.tables.get(tableId);
        if (!freshHand || freshHand.currentTurn !== seatNumber) {
          console.log(`[PokerTable] Bot turn check: table or turn changed, skipping`);
          return;
        }
        const freshState = this.getStateForBroadcast(tableId);
        if (freshState) {
          console.log(`[PokerTable] Calling onBotTurn callback for ${player.odejs}`);
          this.onBotTurn!(tableId, seatNumber, freshState);
        }
      }, 50);
    }
  }

  private advanceStreet(hand: ActiveHand): void {
    // Reset bets for new street
    for (const [_, player] of Array.from(hand.players.entries())) {
      player.betAmount = 0;
      player.hasActed = false;
    }
    hand.currentBet = 0;
    hand.minRaise = hand.bigBlind;
    hand.lastRaiser = null;

    const activePlayers = Array.from(hand.players.values()).filter(p => !p.isFolded && !p.isAllIn);
    
    switch (hand.status) {
      case "preflop":
        hand.status = "flop";
        hand.communityCards = [
          hand.deck[hand.deckIndex++],
          hand.deck[hand.deckIndex++],
          hand.deck[hand.deckIndex++]
        ];
        break;
      case "flop":
        hand.status = "turn";
        hand.communityCards.push(hand.deck[hand.deckIndex++]);
        break;
      case "turn":
        hand.status = "river";
        hand.communityCards.push(hand.deck[hand.deckIndex++]);
        break;
      case "river":
        hand.status = "showdown";
        this.determineWinners(hand);
        this.endHand(hand.tableId);
        return;
    }

    // If only one player can act (everyone else is all-in)
    if (activePlayers.length <= 1) {
      // Check if we should offer run-it-twice before continuing
      if (this.shouldOfferRunItTwice(hand)) {
        this.startRunItTwiceVote(hand);
        return;
      }
      this.advanceStreet(hand);
      return;
    }

    // Set first to act (first player after dealer)
    const seats = Array.from(hand.players.keys()).sort((a, b) => a - b);
    const dealerIndex = seats.indexOf(hand.dealerSeat);
    
    for (let i = 1; i <= seats.length; i++) {
      const seat = seats[(dealerIndex + i) % seats.length];
      const player = hand.players.get(seat);
      if (player && !player.isFolded && !player.isAllIn) {
        hand.currentTurn = seat;
        this.checkBotTurn(hand, seat);
        break;
      }
    }
  }

  // Run-it-twice: Check if we should offer the choice
  private shouldOfferRunItTwice(hand: ActiveHand): boolean {
    // Only offer if not already in a vote and before river is complete
    if (hand.runItTwice?.isActive) return false;
    if (hand.status === "river" || hand.status === "showdown") return false;
    
    // Must have exactly 2 players who are not folded
    const contenders = Array.from(hand.players.values()).filter(p => !p.isFolded);
    if (contenders.length !== 2) return false;
    
    // All contenders must be all-in
    const allAllIn = contenders.every(p => p.isAllIn);
    if (!allAllIn) return false;
    
    console.log(`[PokerTable] Run-it-twice eligible: 2 players all-in before river`);
    return true;
  }

  // Run-it-twice: Start the voting process
  private startRunItTwiceVote(hand: ActiveHand): void {
    const contenders = Array.from(hand.players.entries()).filter(([_, p]) => !p.isFolded);
    
    const votes = new Map<number, 1 | 2 | null>();
    for (const [seat] of contenders) {
      votes.set(seat, null);
    }
    
    const deadline = Date.now() + RUN_IT_TWICE_VOTE_SECONDS * 1000;
    
    hand.runItTwice = {
      isActive: true,
      deadline,
      votes,
      timeout: setTimeout(() => {
        this.resolveRunItTwiceVote(hand.tableId);
      }, RUN_IT_TWICE_VOTE_SECONDS * 1000)
    };
    
    hand.currentTurn = null; // Pause normal turn progression
    
    console.log(`[PokerTable] Run-it-twice vote started, deadline: ${deadline}`);
    this.broadcastState(hand.tableId);
  }

  // Run-it-twice: Record a player's vote
  recordRunItTwiceVote(tableId: string, seatNumber: number, choice: 1 | 2): boolean {
    const hand = this.tables.get(tableId);
    if (!hand || !hand.runItTwice?.isActive) return false;
    
    if (!hand.runItTwice.votes.has(seatNumber)) return false;
    if (hand.runItTwice.votes.get(seatNumber) !== null) return false; // Already voted
    
    hand.runItTwice.votes.set(seatNumber, choice);
    console.log(`[PokerTable] Run-it-twice vote: seat ${seatNumber} chose ${choice} board(s)`);
    
    // Check if all votes are in
    const allVoted = Array.from(hand.runItTwice.votes.values()).every(v => v !== null);
    if (allVoted) {
      if (hand.runItTwice.timeout) {
        clearTimeout(hand.runItTwice.timeout);
      }
      this.resolveRunItTwiceVote(tableId);
    } else {
      this.broadcastState(tableId);
    }
    
    return true;
  }

  // Run-it-twice: Resolve the vote and continue the hand
  private resolveRunItTwiceVote(tableId: string): void {
    const hand = this.tables.get(tableId);
    if (!hand || !hand.runItTwice?.isActive) return;
    
    // Check if both voted for 2 boards
    const votes = Array.from(hand.runItTwice.votes.values());
    const bothWantTwo = votes.every(v => v === 2);
    
    if (bothWantTwo) {
      console.log(`[PokerTable] Both players chose 2 boards - running it twice!`);
      hand.runItTwice.result = 2;
    } else {
      console.log(`[PokerTable] Not unanimous for 2 boards - running single board`);
      hand.runItTwice.result = 1;
    }
    
    // Set voting as no longer active - result is determined
    hand.runItTwice.isActive = false;
    
    // Clear the vote state after a brief delay to show result
    const runTwice = bothWantTwo;
    
    // Broadcast state immediately to show result
    this.broadcastState(tableId);
    
    setTimeout(() => {
      const freshHand = this.tables.get(tableId);
      if (!freshHand) return;
      
      if (runTwice) {
        this.runTwoBoards(freshHand);
      } else {
        freshHand.runItTwice = undefined;
        // Continue normal advancement
        this.advanceStreetToShowdown(freshHand);
      }
    }, 1500);
  }

  // Run-it-twice: Deal remaining cards and determine winners for two boards
  private runTwoBoards(hand: ActiveHand): void {
    // Save current deck position
    const deckPos = hand.deckIndex;
    const currentCards = [...hand.communityCards];
    
    // Calculate how many cards we need to deal for each board
    const cardsNeeded = 5 - currentCards.length;
    
    // Board 1: Deal remaining cards
    hand.communityCards = [...currentCards];
    for (let i = 0; i < cardsNeeded; i++) {
      hand.communityCards.push(hand.deck[deckPos + i]);
    }
    
    // Board 2: Deal different cards
    hand.communityCards2 = [...currentCards];
    for (let i = 0; i < cardsNeeded; i++) {
      hand.communityCards2.push(hand.deck[deckPos + cardsNeeded + i]);
    }
    
    hand.deckIndex = deckPos + cardsNeeded * 2;
    hand.status = "showdown";
    
    // Determine winners for both boards and split pot
    this.determineWinnersTwoBoards(hand);
    this.endHand(hand.tableId);
  }

  // Run-it-twice: Advance directly to showdown (for single board after vote)
  private advanceStreetToShowdown(hand: ActiveHand): void {
    // Deal remaining community cards
    while (hand.communityCards.length < 5) {
      hand.communityCards.push(hand.deck[hand.deckIndex++]);
    }
    
    hand.status = "showdown";
    this.determineWinners(hand);
    this.endHand(hand.tableId);
  }

  // Run-it-twice: Determine winners for both boards and split pot
  private determineWinnersTwoBoards(hand: ActiveHand): void {
    const contenders = Array.from(hand.players.entries())
      .filter(([_, p]) => !p.isFolded);
    
    if (contenders.length === 0) return;
    
    // Calculate rake once on total pot
    const potBeforeRake = hand.pot;
    const rakeAmount = Math.min(potBeforeRake * (hand.rakePercent / 100), hand.rakeCap);
    hand.rake = rakeAmount;
    this.totalRakeCollected += rakeAmount;
    
    // Split pot (after rake) between two boards
    const potAfterRake = potBeforeRake - rakeAmount;
    const halfPot = potAfterRake / 2;
    
    // Evaluate board 1
    const board1Results = contenders.map(([seat, player]) => ({
      seat,
      player,
      handResult: evaluateHand(player.holeCards, hand.communityCards),
    })).sort((a, b) => -compareHands(a.handResult, b.handResult));
    
    // Evaluate board 2
    const board2Results = contenders.map(([seat, player]) => ({
      seat,
      player,
      handResult: evaluateHand(player.holeCards, hand.communityCards2!),
    })).sort((a, b) => -compareHands(a.handResult, b.handResult));
    
    // Determine winners and distribute chips for board 1
    const winner1 = board1Results[0];
    winner1.player.chipStack += halfPot;
    this.onBalanceChange(winner1.player.odejs, halfPot);
    
    hand.winners = [{
      seatNumber: winner1.seat,
      odejs: winner1.player.odejs,
      username: winner1.player.username,
      holeCards: winner1.player.holeCards,
      handDescription: winner1.handResult.description,
      amountWon: halfPot
    }];
    
    // Determine winners and distribute chips for board 2
    const winner2 = board2Results[0];
    winner2.player.chipStack += halfPot;
    this.onBalanceChange(winner2.player.odejs, halfPot);
    
    hand.winners2 = [{
      seatNumber: winner2.seat,
      odejs: winner2.player.odejs,
      username: winner2.player.username,
      holeCards: winner2.player.holeCards,
      handDescription: winner2.handResult.description,
      amountWon: halfPot
    }];
    
    console.log(`[PokerTable] Run-it-twice results: Board 1 winner: ${winner1.player.username} ($${halfPot.toFixed(2)}), Board 2 winner: ${winner2.player.username} ($${halfPot.toFixed(2)})`);
    
    hand.showdownDeadline = Date.now() + SHOWDOWN_DISPLAY_SECONDS * 1000;
    hand.runItTwice = undefined;
  }

  private determineWinners(hand: ActiveHand): void {
    const contenders = Array.from(hand.players.entries())
      .filter(([_, p]) => !p.isFolded)
      .map(([seat, player]) => ({
        seat,
        player,
        handResult: evaluateHand(player.holeCards, hand.communityCards),
        totalBetInHand: player.totalBetInHand
      }))
      .sort((a, b) => -compareHands(a.handResult, b.handResult));

    if (contenders.length === 0) return;

    // Calculate rake on total pot
    const potBeforeRake = hand.pot;
    const rakeAmount = Math.min(potBeforeRake * (hand.rakePercent / 100), hand.rakeCap);
    hand.rake = rakeAmount;
    this.totalRakeCollected += rakeAmount;

    // Build side pots based on all-in amounts
    // Get all unique bet levels from players who went all-in
    const allPlayers = Array.from(hand.players.entries())
      .filter(([_, p]) => !p.isFolded)
      .map(([seat, player]) => ({
        seat,
        player,
        totalBet: player.totalBetInHand,
        isAllIn: player.isAllIn
      }))
      .sort((a, b) => a.totalBet - b.totalBet);

    // Calculate side pots
    interface SidePot {
      amount: number;
      eligibleSeats: number[];
    }
    
    const sidePots: SidePot[] = [];
    let previousLevel = 0;
    
    for (let i = 0; i < allPlayers.length; i++) {
      const currentLevel = allPlayers[i].totalBet;
      if (currentLevel > previousLevel) {
        const potContribution = (currentLevel - previousLevel) * (allPlayers.length - i);
        const eligibleSeats = allPlayers.slice(i).map(p => p.seat);
        
        // Include folded players' contributions to this pot level
        const foldedContribution = Array.from(hand.players.entries())
          .filter(([_, p]) => p.isFolded)
          .reduce((sum, [_, p]) => {
            const contribution = Math.min(p.totalBetInHand, currentLevel) - Math.min(p.totalBetInHand, previousLevel);
            return sum + Math.max(0, contribution);
          }, 0);
        
        sidePots.push({
          amount: potContribution + foldedContribution,
          eligibleSeats
        });
        previousLevel = currentLevel;
      }
    }

    // If no side pots created, use single pot
    if (sidePots.length === 0) {
      sidePots.push({
        amount: hand.pot,
        eligibleSeats: contenders.map(c => c.seat)
      });
    }

    // Distribute rake proportionally across pots
    const totalPotAmount = sidePots.reduce((sum, pot) => sum + pot.amount, 0);
    let remainingRake = rakeAmount;
    
    // Award each side pot to its winner
    hand.winners = [];
    for (const pot of sidePots) {
      // Find the best hand among eligible players
      const eligibleContenders = contenders.filter(c => pot.eligibleSeats.includes(c.seat));
      if (eligibleContenders.length === 0) continue;
      
      const winner = eligibleContenders[0]; // Already sorted by hand strength
      
      // Calculate rake for this pot proportionally
      const potRake = (pot.amount / totalPotAmount) * rakeAmount;
      remainingRake -= potRake;
      const potAfterRake = pot.amount - potRake;
      
      winner.player.chipStack += potAfterRake;
      
      // Add to winners list (avoid duplicates, just add amounts)
      const existingWinner = hand.winners.find(w => w.seatNumber === winner.seat);
      if (existingWinner) {
        existingWinner.amountWon += potAfterRake;
      } else {
        hand.winners.push({
          seatNumber: winner.seat,
          odejs: winner.player.odejs,
          username: winner.player.username,
          holeCards: [...winner.player.holeCards],
          handDescription: winner.handResult.description,
          amountWon: potAfterRake
        });
      }
    }

    // Set showdown deadline for reveal period
    hand.showdownDeadline = Date.now() + SHOWDOWN_DISPLAY_SECONDS * 1000;
    hand.revealedCards = new Set();

    const winnersStr = hand.winners.map(w => `Seat ${w.seatNumber}: $${w.amountWon.toFixed(2)}`).join(", ");
    console.log(`Hand #${hand.handNumber} Winners: ${winnersStr}, Rake: $${rakeAmount.toFixed(2)}`);
  }

  private awardPot(hand: ActiveHand, winner: TablePlayer): void {
    const rakeAmount = Math.min(hand.pot * (hand.rakePercent / 100), hand.rakeCap);
    hand.rake = rakeAmount;
    this.totalRakeCollected += rakeAmount;
    winner.chipStack += hand.pot - rakeAmount;
  }

  // Allow folded players to reveal their cards during showdown
  revealCards(tableId: string, seatNumber: number): boolean {
    const hand = this.tables.get(tableId);
    if (!hand) return false;
    if (hand.status !== "showdown") return false;
    
    const player = hand.players.get(seatNumber);
    if (!player) return false;
    
    // Only folded players can choose to reveal
    if (!player.isFolded) return false;
    
    hand.revealedCards.add(seatNumber);
    this.broadcastState(tableId);
    return true;
  }

  private endHand(tableId: string): void {
    const hand = this.tables.get(tableId);
    if (!hand) return;

    this.clearTurnTimer(hand);
    
    // Broadcast showdown state first (with winners visible)
    this.broadcastState(tableId);

    // After showdown display period, move to waiting and start next hand
    setTimeout(() => {
      const currentHand = this.tables.get(tableId);
      if (!currentHand) return;
      
      currentHand.status = "waiting";
      currentHand.currentTurn = null;
      currentHand.winners = undefined;
      currentHand.showdownDeadline = undefined;
      currentHand.revealedCards = new Set();

      // Check for players with zero chips - start kick timers
      this.checkZeroStackPlayers(currentHand);

      this.broadcastState(tableId);

      // Auto-start next hand after short delay
      setTimeout(() => {
        if (this.canStartHand(tableId)) {
          this.startNewHand(tableId);
        }
      }, 1500);
    }, SHOWDOWN_DISPLAY_SECONDS * 1000);
  }

  private startTurnTimer(tableId: string): void {
    const hand = this.tables.get(tableId);
    if (!hand || !hand.currentTurn) return;

    // ALWAYS clear existing timeout first to prevent multiple timers
    if (hand.actionTimeout) {
      clearTimeout(hand.actionTimeout);
      hand.actionTimeout = null;
    }

    const seatNumber = hand.currentTurn;
    const player = hand.players.get(seatNumber);
    if (!player) return;

    // Clear paused timer if it's from a different turn (stale)
    const existingPaused = this.pausedTurnTimers.get(player.odejs);
    if (existingPaused && existingPaused.seatNumber !== seatNumber) {
      this.pausedTurnTimers.delete(player.odejs);
    }
    
    // Check if player is disconnected
    if (this.disconnectedPlayers.has(player.odejs)) {
      const currentPaused = this.pausedTurnTimers.get(player.odejs);
      
      // Determine deadline: preserve existing if grace was consumed, else grant fresh
      let timeoutMs: number;
      if (currentPaused && currentPaused.graceConsumed && currentPaused.seatNumber === seatNumber) {
        // Grace already consumed - use remaining time from existing deadline
        timeoutMs = Math.max(0, hand.actionDeadline - Date.now());
        console.log(`Player ${player.odejs} is disconnected (grace already used) - ${timeoutMs}ms remaining`);
      } else {
        // Fresh disconnect - grant full time + grace
        timeoutMs = (TURN_TIME_SECONDS + DISCONNECT_GRACE_SECONDS) * 1000;
        hand.actionDeadline = Date.now() + timeoutMs;
        this.pausedTurnTimers.set(player.odejs, {
          tableId,
          seatNumber,
          remainingTime: 0,
          graceConsumed: true
        });
        console.log(`Player ${player.odejs} is disconnected - granting ${timeoutMs}ms total`);
      }
      
      // Fold immediately if time expired
      if (timeoutMs <= 0) {
        console.log(`Player ${player.username} turn expired - auto-folding`);
        if (!player.odejs.startsWith("bot_")) {
          player.isSittingOut = true;
          this.startSitOutKickTimer(tableId, seatNumber, player.odejs);
        }
        this.handleAction(tableId, seatNumber, "fold");
        return;
      }
      
      // Schedule watchdog
      hand.actionTimeout = setTimeout(() => {
        const currentHand = this.tables.get(tableId);
        if (!currentHand || currentHand.currentTurn !== seatNumber) return;
        
        const p = currentHand.players.get(seatNumber);
        if (p) {
          console.log(`Player ${p.username} disconnected too long - auto-folding`);
          if (!p.odejs.startsWith("bot_")) {
            p.isSittingOut = true;
            this.startSitOutKickTimer(tableId, seatNumber, p.odejs);
          }
          this.handleAction(tableId, seatNumber, "fold");
        }
      }, timeoutMs);
      
      return;
    }

    // Connected player - set fresh deadline
    hand.actionDeadline = Date.now() + TURN_TIME_SECONDS * 1000;

    hand.actionTimeout = setTimeout(() => {
      const currentHand = this.tables.get(tableId);
      if (!currentHand || currentHand.currentTurn !== seatNumber) return;

      const currentPlayer = currentHand.players.get(seatNumber);
      if (currentPlayer) {
        console.log(`Player ${currentPlayer.username} timed out - auto-folding`);
        if (!currentPlayer.odejs.startsWith("bot_")) {
          currentPlayer.isSittingOut = true;
          this.startSitOutKickTimer(tableId, seatNumber, currentPlayer.odejs);
        }
        this.handleAction(tableId, seatNumber, "fold");
      }
    }, TURN_TIME_SECONDS * 1000);
  }

  private clearTurnTimer(hand: ActiveHand): void {
    if (hand.actionTimeout) {
      clearTimeout(hand.actionTimeout);
      hand.actionTimeout = null;
    }
    hand.actionDeadline = 0;
  }

  getState(tableId: string, requestingUserId?: string): PokerGameState | null {
    const hand = this.tables.get(tableId);
    if (!hand) return null;

    const players: PokerPlayerState[] = [];
    const seats = Array.from(hand.players.entries()).sort((a, b) => a[0] - b[0]);

    for (const [seat, player] of seats) {
      // Calculate hand strength for the player if they have cards and there are community cards
      let handStrength: string | undefined;
      if (player.holeCards.length === 2 && hand.communityCards.length >= 3 && !player.isFolded) {
        try {
          const result = evaluateHand(player.holeCards, hand.communityCards);
          handStrength = result.description;
        } catch (e) {
          // Ignore evaluation errors
        }
      }

      // Determine which cards to include:
      // - requestingUserId matches: show own cards
      // - showdown and not folded: show cards (winners always visible)
      // - showdown and folded but revealed: show cards
      // - otherwise: hide cards
      let holeCards: Card[] | undefined;
      if (player.odejs === requestingUserId) {
        holeCards = player.holeCards.length > 0 ? player.holeCards : undefined;
      } else if (hand.status === "showdown" && !player.isFolded) {
        holeCards = player.holeCards.length > 0 ? player.holeCards : undefined;
      } else if (hand.status === "showdown" && hand.revealedCards.has(seat)) {
        holeCards = player.holeCards.length > 0 ? player.holeCards : undefined;
      } else {
        holeCards = undefined;
      }

      players.push({
        odejs: player.odejs,
        odejsname: player.username,
        odejsPhotoUrl: player.photoUrl,
        seatNumber: seat,
        chipStack: player.chipStack,
        betAmount: player.betAmount,
        isFolded: player.isFolded,
        isAllIn: player.isAllIn,
        isDealer: seat === hand.dealerSeat,
        isSmallBlind: seat === hand.smallBlindSeat,
        isBigBlind: seat === hand.bigBlindSeat,
        isCurrentTurn: seat === hand.currentTurn,
        holeCards,
        isSittingOut: player.isSittingOut,
        isReady: player.isReady,
        handStrength: player.odejs === requestingUserId ? handStrength : undefined,
      });
    }

    // Convert run-it-twice vote state for getState
    let runItTwiceState = undefined;
    if (hand.runItTwice) {
      const votesObj: { [seatNumber: number]: 1 | 2 | null } = {};
      for (const [seat, vote] of Array.from(hand.runItTwice.votes.entries())) {
        votesObj[seat] = vote;
      }
      runItTwiceState = {
        isActive: hand.runItTwice.isActive,
        deadline: hand.runItTwice.deadline,
        votes: votesObj,
        result: hand.runItTwice.result
      };
    }

    return {
      tableId: hand.tableId,
      tableName: "",
      handNumber: hand.handNumber,
      pot: hand.pot,
      communityCards: hand.communityCards,
      communityCards2: hand.communityCards2,
      status: hand.status,
      dealerSeat: hand.dealerSeat,
      currentTurn: hand.currentTurn,
      currentBet: hand.currentBet,
      minRaise: hand.minRaise,
      players,
      timeBank: TURN_TIME_SECONDS,
      actionDeadline: hand.actionDeadline,
      bigBlind: hand.bigBlind,
      smallBlind: hand.smallBlind,
      winners: hand.winners,
      winners2: hand.winners2,
      showdownDeadline: hand.showdownDeadline,
      revealedSeats: Array.from(hand.revealedCards),
      runItTwice: runItTwiceState,
    };
  }

  // Internal method to get state with ALL cards for broadcast - websocket will personalize
  getStateForBroadcast(tableId: string): PokerGameState | null {
    const hand = this.tables.get(tableId);
    if (!hand) return null;

    const players: PokerPlayerState[] = [];
    const seats = Array.from(hand.players.entries()).sort((a, b) => a[0] - b[0]);

    for (const [seat, player] of seats) {
      // Calculate hand strength for all players
      let handStrength: string | undefined;
      if (player.holeCards.length === 2 && hand.communityCards.length >= 3 && !player.isFolded) {
        try {
          const result = evaluateHand(player.holeCards, hand.communityCards);
          handStrength = result.description;
        } catch (e) {
          // Ignore evaluation errors
        }
      }

      players.push({
        odejs: player.odejs,
        odejsname: player.username,
        odejsPhotoUrl: player.photoUrl,
        seatNumber: seat,
        chipStack: player.chipStack,
        betAmount: player.betAmount,
        isFolded: player.isFolded,
        isAllIn: player.isAllIn,
        isDealer: seat === hand.dealerSeat,
        isSmallBlind: seat === hand.smallBlindSeat,
        isBigBlind: seat === hand.bigBlindSeat,
        isCurrentTurn: seat === hand.currentTurn,
        // Include ALL cards - websocket will filter per-client
        holeCards: player.holeCards.length > 0 ? player.holeCards : undefined,
        isSittingOut: player.isSittingOut,
        isReady: player.isReady,
        handStrength, // Include all hand strengths for broadcast
      });
    }

    // Convert run-it-twice vote state for broadcast
    let runItTwiceState = undefined;
    if (hand.runItTwice) {
      const votesObj: { [seatNumber: number]: 1 | 2 | null } = {};
      for (const [seat, vote] of Array.from(hand.runItTwice.votes.entries())) {
        votesObj[seat] = vote;
      }
      runItTwiceState = {
        isActive: hand.runItTwice.isActive,
        deadline: hand.runItTwice.deadline,
        votes: votesObj,
        result: hand.runItTwice.result
      };
    }

    return {
      tableId: hand.tableId,
      tableName: "",
      handNumber: hand.handNumber,
      pot: hand.pot,
      communityCards: hand.communityCards,
      communityCards2: hand.communityCards2,
      status: hand.status,
      dealerSeat: hand.dealerSeat,
      currentTurn: hand.currentTurn,
      currentBet: hand.currentBet,
      minRaise: hand.minRaise,
      players,
      timeBank: TURN_TIME_SECONDS,
      actionDeadline: hand.actionDeadline,
      bigBlind: hand.bigBlind,
      smallBlind: hand.smallBlind,
      winners: hand.winners,
      winners2: hand.winners2,
      showdownDeadline: hand.showdownDeadline,
      revealedSeats: Array.from(hand.revealedCards),
      runItTwice: runItTwiceState,
    };
  }

  private broadcastState(tableId: string): void {
    // Use getStateForBroadcast to include all cards - websocket will personalize per client
    const state = this.getStateForBroadcast(tableId);
    if (state) {
      this.onStateChange(tableId, state);
    }
  }
}

// Singleton instance
let pokerManager: PokerTableManager | null = null;

export function getPokerManager(
  onStateChange?: (tableId: string, state: PokerGameState) => void,
  onBalanceChange?: (odejs: string, amount: number) => void,
  onPlayerKicked?: (tableId: string, odejs: string, seatNumber: number) => void
): PokerTableManager {
  if (!pokerManager && onStateChange && onBalanceChange) {
    pokerManager = new PokerTableManager(onStateChange, onBalanceChange, onPlayerKicked);
  }
  if (!pokerManager) {
    throw new Error("PokerManager not initialized");
  }
  return pokerManager;
}
