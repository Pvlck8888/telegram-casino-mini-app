import { WebSocketServer, WebSocket } from "ws";
import { type Server } from "http";
import { getPokerManager } from "./poker/gameManager";
import { getPokerBotManager } from "./poker/pokerBotManager";
import type { PokerGameState, PokerAction } from "@shared/schema";
import { storage } from "./storage";

interface ConnectedUser {
  ws: WebSocket;
  odejs: string;
  username: string;
  photoUrl: string | null;
  tableId?: string;
}

interface LiveBet {
  id: string;
  odejs: string;
  username: string;
  photoUrl: string | null;
  gameType: string;
  amount: number;
  payout: number;
  isWin: boolean;
  timestamp: number;
}

interface OnlineStats {
  onlineCount: number;
  recentBets: LiveBet[];
}

const DISCONNECT_TIMEOUT_SECONDS = 20;

class GameWebSocket {
  private wss: WebSocketServer | null = null;
  private clients: Map<string, ConnectedUser> = new Map();
  private recentBets: LiveBet[] = [];
  private maxRecentBets = 50;
  private tableSubscriptions: Map<string, Set<string>> = new Map();
  private lobbySubscribers: Set<string> = new Set(); // clientIds subscribed to lobby updates
  private disconnectTimers: Map<string, NodeJS.Timeout> = new Map(); // key: odejs
  private playerTableMap: Map<string, string> = new Map(); // odejs -> tableId

  setup(server: Server) {
    this.wss = new WebSocketServer({ server, path: "/ws" });

    const pokerManager = getPokerManager(
      (tableId, state) => this.broadcastPokerState(tableId, state),
      async (odejs, amount) => {
        const user = await storage.getUser(odejs);
        if (user) {
          await storage.updateUserBalance(odejs, user.balance + amount);
        }
      },
      async (tableId, odejs, seatNumber) => {
        // Player was kicked for having zero chips and not rebuying
        console.log(`Player ${odejs} kicked from table ${tableId} seat ${seatNumber}`);
        
        // Clean up database
        await storage.removePlayerFromTable(tableId, odejs);
        const seats = await storage.getTableSeats(tableId);
        await storage.updateTablePlayerCount(tableId, seats.length);
        
        // Notify the kicked player
        this.broadcastToPlayer(tableId, odejs, {
          type: "kicked",
          reason: "zero_chips",
          message: "Вы были удалены из-за нулевого баланса"
        });
      }
    );

    const botManager = getPokerBotManager(pokerManager, storage);
    if (botManager) {
      pokerManager.setBotTurnCallback((tableId, seatNumber, state) => {
        botManager.onBotTurn(tableId, seatNumber, state);
      });
    }

    this.wss.on("connection", (ws) => {
      const clientId = `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      ws.on("message", (data) => {
        try {
          const message = JSON.parse(data.toString());
          this.handleMessage(clientId, ws, message, pokerManager);
        } catch (e) {
          console.error("WebSocket message error:", e);
        }
      });

      ws.on("close", () => {
        const client = this.clients.get(clientId);
        if (client?.tableId && client?.odejs) {
          // Start disconnect timer instead of immediate removal
          this.startDisconnectTimer(client.odejs, client.tableId, pokerManager);
          this.unsubscribeFromTable(clientId, client.tableId);
        }
        this.clients.delete(clientId);
        this.lobbySubscribers.delete(clientId);
        this.broadcastOnlineCount();
      });

      ws.on("error", (error) => {
        console.error("WebSocket error:", error);
        this.clients.delete(clientId);
      });

      ws.send(JSON.stringify({
        type: "connected",
        clientId,
        onlineCount: this.clients.size,
        recentBets: this.recentBets.slice(0, 20),
      }));
    });

    console.log("WebSocket server initialized on /ws");
  }

  private handleMessage(clientId: string, ws: WebSocket, message: any, pokerManager: ReturnType<typeof getPokerManager>) {
    try {
      switch (message.type) {
        case "auth":
          this.clients.set(clientId, {
            ws,
            odejs: message.odejs,
            username: message.username || "Anonymous",
            photoUrl: message.photoUrl || null,
          });
          this.broadcastOnlineCount();
          break;

        case "ping":
          ws.send(JSON.stringify({ type: "pong" }));
          break;

        case "join_table":
          this.handleJoinTable(clientId, ws, message, pokerManager);
          break;

        case "leave_table":
          this.handleLeaveTable(clientId, message, pokerManager);
          break;

        case "poker_action":
          this.handlePokerAction(clientId, message, pokerManager);
          break;

        case "sit_down":
          this.handleSitDown(clientId, message, pokerManager);
          break;

        case "stand_up":
          this.handleStandUp(clientId, message, pokerManager);
          break;

        case "sit_out":
          this.handleSitOut(clientId, message, pokerManager);
          break;

        case "reveal_cards":
          this.handleRevealCards(clientId, message, pokerManager);
          break;

        case "reaction":
          this.handleReaction(clientId, message);
          break;

        case "subscribe_lobby":
          this.lobbySubscribers.add(clientId);
          break;

        case "unsubscribe_lobby":
          this.lobbySubscribers.delete(clientId);
          break;

        case "request_state":
          this.handleRequestState(clientId, message, pokerManager);
          break;

        case "run_it_twice_vote":
          this.handleRunItTwiceVote(clientId, message, pokerManager);
          break;
      }
    } catch (error) {
      console.error(`[WebSocket] Error in handleMessage (${message?.type}):`, error);
      try {
        ws.send(JSON.stringify({ type: "error", message: "Внутренняя ошибка сервера" }));
      } catch (e) { /* ignore send errors */ }
    }
  }

  private handleRequestState(clientId: string, message: any, pokerManager: ReturnType<typeof getPokerManager>) {
    const { tableId } = message;
    const client = this.clients.get(clientId);
    
    if (!client || !tableId) {
      return;
    }

    const state = pokerManager.getState(tableId, client.odejs);
    if (state) {
      client.ws.send(JSON.stringify({
        type: "poker_state",
        state,
      }));
    }
  }

  private handleRunItTwiceVote(clientId: string, message: any, pokerManager: ReturnType<typeof getPokerManager>) {
    const { tableId, seatNumber, choice } = message;
    const client = this.clients.get(clientId);
    
    if (!client || !client.odejs || !tableId) {
      return;
    }
    
    // Verify seat ownership
    const player = pokerManager.getPlayerBySeat(tableId, seatNumber);
    if (!player || player.odejs !== client.odejs) {
      client.ws.send(JSON.stringify({ 
        type: "error", 
        message: "Это не ваше место" 
      }));
      return;
    }
    
    // Validate choice
    if (choice !== 1 && choice !== 2) {
      client.ws.send(JSON.stringify({ 
        type: "error", 
        message: "Неверный выбор" 
      }));
      return;
    }
    
    const success = pokerManager.recordRunItTwiceVote(tableId, seatNumber, choice);
    if (!success) {
      client.ws.send(JSON.stringify({ 
        type: "error", 
        message: "Не удалось записать голос" 
      }));
    }
  }

  private handleRevealCards(clientId: string, message: any, pokerManager: ReturnType<typeof getPokerManager>) {
    const { tableId, seatNumber } = message;
    const client = this.clients.get(clientId);
    
    if (!client || !client.odejs) {
      return;
    }
    
    // Verify seat ownership
    const player = pokerManager.getPlayerBySeat(tableId, seatNumber);
    if (!player || player.odejs !== client.odejs) {
      client.ws.send(JSON.stringify({ 
        type: "error", 
        message: "Это не ваше место" 
      }));
      return;
    }
    
    const success = pokerManager.revealCards(tableId, seatNumber);
    if (success) {
      console.log(`Player ${client.odejs} revealed cards at seat ${seatNumber}`);
    } else {
      // Send feedback when reveal fails (player not folded or already revealed)
      client.ws.send(JSON.stringify({ 
        type: "error", 
        message: "Невозможно показать карты" 
      }));
    }
  }

  // Broadcast lobby update to all subscribers
  broadcastLobbyUpdate() {
    const message = JSON.stringify({ type: "lobby_update" });
    Array.from(this.lobbySubscribers).forEach(clientId => {
      const client = this.clients.get(clientId);
      if (client?.ws.readyState === WebSocket.OPEN) {
        client.ws.send(message);
      }
    });
  }

  // Handle reaction at poker table (supports both old emoji and new reactionId)
  private handleReaction(clientId: string, message: any) {
    const { tableId, emoji, reactionId, seatNumber, username } = message;
    const client = this.clients.get(clientId);
    
    // Support both old emoji and new reactionId format
    const reaction = reactionId || emoji;
    if (!client || !tableId || !reaction || seatNumber === undefined) {
      return;
    }

    // Broadcast reaction to all players at the table
    const reactionMessage = JSON.stringify({
      type: "reaction",
      reactionId: reaction, // New format
      emoji: reaction,       // Backward compatibility
      seatNumber,
      username: username || "Player",
    });

    const subscribers = this.tableSubscriptions.get(tableId);
    if (subscribers) {
      subscribers.forEach((subClientId: string) => {
        const subClient = this.clients.get(subClientId);
        if (subClient?.ws.readyState === WebSocket.OPEN) {
          subClient.ws.send(reactionMessage);
        }
      });
    }
  }

  private startDisconnectTimer(odejs: string, tableId: string, pokerManager: ReturnType<typeof getPokerManager>) {
    // Clear any existing timer
    this.cancelDisconnectTimer(odejs);
    
    console.log(`Starting ${DISCONNECT_TIMEOUT_SECONDS}s disconnect timer for player ${odejs} at table ${tableId}`);
    this.playerTableMap.set(odejs, tableId);
    
    // Mark player as disconnected in game manager - this pauses their turn timer if it's their turn
    pokerManager.markPlayerDisconnected(odejs);
    
    const timer = setTimeout(async () => {
      console.log(`Disconnect timer expired for player ${odejs} - removing from table ${tableId}`);
      
      // Get seat number from manager
      const state = pokerManager.getState(tableId);
      const playerState = state?.players.find(p => p.odejs === odejs);
      if (playerState) {
        // Remove from manager (this handles fold, pot award, etc.)
        pokerManager.removePlayer(tableId, playerState.seatNumber);
        
        // Clean up database
        await storage.removePlayerFromTable(tableId, odejs);
        const seats = await storage.getTableSeats(tableId);
        await storage.updateTablePlayerCount(tableId, seats.length);
        
        // Notify lobby about player count change
        this.broadcastLobbyUpdate();
        
        console.log(`Player ${odejs} removed after disconnect timeout`);
      }
      
      this.disconnectTimers.delete(odejs);
      this.playerTableMap.delete(odejs);
    }, DISCONNECT_TIMEOUT_SECONDS * 1000);
    
    this.disconnectTimers.set(odejs, timer);
  }

  private cancelDisconnectTimer(odejs: string) {
    const timer = this.disconnectTimers.get(odejs);
    if (timer) {
      clearTimeout(timer);
      this.disconnectTimers.delete(odejs);
      this.playerTableMap.delete(odejs);
      console.log(`Cancelled disconnect timer for player ${odejs}`);
    }
  }

  private async handleJoinTable(clientId: string, ws: WebSocket, message: any, pokerManager: ReturnType<typeof getPokerManager>) {
    const { tableId, odejs, username, photoUrl } = message;
    
    // Cancel any pending disconnect timer for this player (they're back!)
    this.cancelDisconnectTimer(odejs);
    
    // Mark player as reconnected - this resumes their turn timer if it was paused
    pokerManager.markPlayerReconnected(odejs);
    
    let client = this.clients.get(clientId);
    if (client) {
      if (client.tableId) {
        this.unsubscribeFromTable(clientId, client.tableId);
      }
      client.tableId = tableId;
      client.odejs = odejs;
    } else {
      // Client not registered yet - register them now
      client = {
        ws,
        odejs: odejs,
        username: username || "Player",
        photoUrl: photoUrl || null,
        tableId: tableId
      };
      this.clients.set(clientId, client);
      console.log(`Registered client ${clientId} with odejs ${odejs} on join_table`);
    }

    this.subscribeToTable(clientId, tableId);

    try {
      const table = await storage.getPokerTable(tableId);
      if (table) {
        pokerManager.getOrCreateTable(
          tableId,
          table.smallBlind,
          table.bigBlind,
          table.rakePercent,
          table.rakeCap
        );
        
        // Sync players from database to manager (handles server restarts / reconnects)
        const dbSeats = await storage.getTableSeats(tableId);
        const managerState = pokerManager.getState(tableId);
        const managerPlayerIds = new Set(managerState?.players.map(p => p.odejs) || []);
        
        for (const dbSeat of dbSeats) {
          if (!managerPlayerIds.has(dbSeat.odejs)) {
            // Player exists in DB but not in manager - add them
            const user = await storage.getUser(dbSeat.odejs);
            pokerManager.addPlayer(tableId, {
              odejs: dbSeat.odejs,
              username: user?.username || user?.firstName || `Player ${dbSeat.seatNumber + 1}`,
              photoUrl: undefined,
              seatNumber: dbSeat.seatNumber,
              chipStack: dbSeat.chipStack,
              isSittingOut: false,
            });
            console.log(`Synced player ${dbSeat.odejs} from DB to manager at seat ${dbSeat.seatNumber}`);
          }
        }
        
        // After sync, check if we can start a new hand (2+ players ready)
        if (pokerManager.canStartHand(tableId)) {
          console.log(`Starting new hand at table ${tableId} after player sync`);
          setTimeout(() => {
            pokerManager.startNewHand(tableId);
          }, 500);
        }
      }
    } catch (e) {
      console.error("Error getting poker table:", e);
    }

    const state = pokerManager.getState(tableId, odejs);
    if (state) {
      ws.send(JSON.stringify({ type: "poker_state", state }));
    }
  }

  private async handleLeaveTable(clientId: string, message: any, pokerManager: ReturnType<typeof getPokerManager>) {
    const { tableId, seatNumber, odejs } = message;
    
    if (seatNumber !== undefined && odejs) {
      pokerManager.removePlayer(tableId, seatNumber);
      
      // Update database
      await storage.removePlayerFromTable(tableId, odejs);
      const seats = await storage.getTableSeats(tableId);
      await storage.updateTablePlayerCount(tableId, seats.length);
      
      this.broadcastLobbyUpdate();
    }

    this.unsubscribeFromTable(clientId, tableId);
    
    const client = this.clients.get(clientId);
    if (client) {
      client.tableId = undefined;
    }
  }

  private async handleSitDown(clientId: string, message: any, pokerManager: ReturnType<typeof getPokerManager>) {
    const { tableId, odejs, seatNumber, buyIn, username, photoUrl } = message;

    const client = this.clients.get(clientId);
    if (!client) return;

    try {
      const table = await storage.getPokerTable(tableId);
      if (table) {
        pokerManager.getOrCreateTable(
          tableId,
          table.smallBlind,
          table.bigBlind,
          table.rakePercent,
          table.rakeCap
        );
      }
    } catch (e) {
      console.error("Error ensuring table exists:", e);
    }

    // Check if this player is already seated (from DB sync during join_table)
    const currentState = pokerManager.getState(tableId);
    const existingPlayer = currentState?.players.find(p => p.odejs === odejs);
    
    if (existingPlayer) {
      // Player already exists in manager (likely synced from DB) - this is fine, just broadcast state
      console.log(`Player ${username} already seated at table ${tableId} seat ${existingPlayer.seatNumber} - broadcasting state`);
      // Broadcast current state to all subscribers to ensure client is synced
      const state = pokerManager.getStateForBroadcast(tableId);
      if (state) {
        this.broadcastPokerState(tableId, state);
      }
      // Check if we can start a hand
      if (pokerManager.canStartHand(tableId)) {
        setTimeout(() => {
          pokerManager.startNewHand(tableId);
        }, 800);
      }
      return;
    }

    const success = pokerManager.addPlayer(tableId, {
      odejs,
      username: username || "Player",
      photoUrl: photoUrl || null,
      seatNumber,
      chipStack: buyIn,
      isSittingOut: false,
    });

    if (success) {
      console.log(`Player ${username} sat at table ${tableId} seat ${seatNumber} with ${buyIn} chips`);
      // Notify lobby subscribers about player count change
      this.broadcastLobbyUpdate();
      if (pokerManager.canStartHand(tableId)) {
        setTimeout(() => {
          pokerManager.startNewHand(tableId);
        }, 800);
      }
    } else {
      // Seat is actually taken by someone else
      client.ws.send(JSON.stringify({ 
        type: "error", 
        message: "Место занято" 
      }));
    }
  }

  private handleStandUp(clientId: string, message: any, pokerManager: ReturnType<typeof getPokerManager>) {
    const { tableId, seatNumber } = message;
    pokerManager.removePlayer(tableId, seatNumber);
    // Notify lobby subscribers about player count change
    this.broadcastLobbyUpdate();
  }

  private handleSitOut(clientId: string, message: any, pokerManager: ReturnType<typeof getPokerManager>) {
    const { tableId, seatNumber, sitOut } = message;
    const client = this.clients.get(clientId);
    
    // Security: Verify seat ownership - only the player at that seat can toggle sit out
    const player = pokerManager.getPlayerBySeat(tableId, seatNumber);
    if (!player || !client || String(player.odejs) !== String(client.odejs)) {
      console.log(`Sit out rejected: seat ${seatNumber} ownership mismatch`);
      client?.ws.send(JSON.stringify({ type: "error", message: "Недействительный запрос" }));
      return;
    }
    
    console.log(`Sit out request: seat ${seatNumber} at table ${tableId}, sitOut: ${sitOut}`);
    
    const success = pokerManager.setSitOut(tableId, seatNumber, sitOut);
    if (success) {
      // State is already broadcast by setSitOut method
      console.log(`Player at seat ${seatNumber} is now ${sitOut ? "sitting out" : "back in"}`);
    }
  }

  private handlePokerAction(clientId: string, message: any, pokerManager: ReturnType<typeof getPokerManager>) {
    try {
      const { tableId, seatNumber, action, amount } = message;
      console.log(`Poker action: ${action} from seat ${seatNumber} at table ${tableId}, amount: ${amount}`);
      
      const success = pokerManager.handleAction(tableId, seatNumber, action as PokerAction, amount);
      console.log(`Poker action result: ${success ? 'success' : 'failed'}`);
      
      // Always broadcast state after any action attempt to ensure all clients are in sync
      // Use getStateForBroadcast to include all cards - websocket will personalize per client
      const state = pokerManager.getStateForBroadcast(tableId);
      if (state) {
        console.log(`Broadcasting poker state to table ${tableId}, ${this.tableSubscriptions.get(tableId)?.size || 0} subscribers`);
        this.broadcastPokerState(tableId, state);
      }
    } catch (error) {
      console.error(`[WebSocket] Error handling poker action:`, error);
      const client = this.clients.get(clientId);
      if (client?.ws) {
        try {
          client.ws.send(JSON.stringify({ type: "error", message: "Ошибка действия" }));
        } catch (e) { /* ignore send errors */ }
      }
    }
  }

  private subscribeToTable(clientId: string, tableId: string) {
    if (!this.tableSubscriptions.has(tableId)) {
      this.tableSubscriptions.set(tableId, new Set());
    }
    this.tableSubscriptions.get(tableId)!.add(clientId);
    console.log(`Client ${clientId} subscribed to table ${tableId}, total subscribers: ${this.tableSubscriptions.get(tableId)!.size}`);
  }

  private unsubscribeFromTable(clientId: string, tableId: string) {
    const subscribers = this.tableSubscriptions.get(tableId);
    if (subscribers) {
      subscribers.delete(clientId);
      if (subscribers.size === 0) {
        this.tableSubscriptions.delete(tableId);
      }
    }
  }

  private broadcastPokerState(tableId: string, state: PokerGameState) {
    const subscribers = this.tableSubscriptions.get(tableId);
    if (!subscribers) {
      console.log(`No subscribers for table ${tableId}`);
      return;
    }

    let sentCount = 0;
    Array.from(subscribers).forEach(clientId => {
      const client = this.clients.get(clientId);
      if (client && client.ws.readyState === WebSocket.OPEN) {
        // Personalize state for each client:
        // - Show own hole cards
        // - Show opponent cards only during showdown (if not folded)
        // - Show own hand strength only
        // - Add hasCards flag for opponents to show card backs
        const personalizedState = {
          ...state,
          players: state.players.map(p => {
            const isMe = p.odejs === client.odejs;
            const showOpponentCards = state.status === "showdown" && !p.isFolded;
            const hasCards = !!(p.holeCards && p.holeCards.length === 2);
            
            return {
              ...p,
              holeCards: isMe ? p.holeCards : (showOpponentCards ? p.holeCards : undefined),
              hasCards: hasCards, // Always include to show card backs
              handStrength: isMe ? p.handStrength : undefined
            };
          })
        };
        
        client.ws.send(JSON.stringify({ 
          type: "poker_state", 
          state: personalizedState 
        }));
        sentCount++;
      } else {
        console.log(`Client ${clientId} not found or WebSocket not open`);
      }
    });
    console.log(`Broadcast poker state to ${sentCount}/${subscribers.size} clients for table ${tableId}`);
  }

  private broadcastToPlayer(tableId: string, odejs: string, data: any) {
    const subscribers = this.tableSubscriptions.get(tableId);
    if (!subscribers) return;

    Array.from(subscribers).forEach(clientId => {
      const client = this.clients.get(clientId);
      if (client && client.odejs === odejs && client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(JSON.stringify(data));
      }
    });
  }

  broadcastBet(bet: Omit<LiveBet, "id" | "timestamp">) {
    const liveBet: LiveBet = {
      id: `bet_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      ...bet,
      timestamp: Date.now(),
    };

    this.recentBets.unshift(liveBet);
    if (this.recentBets.length > this.maxRecentBets) {
      this.recentBets = this.recentBets.slice(0, this.maxRecentBets);
    }

    this.broadcast({
      type: "new_bet",
      bet: liveBet,
    });
  }

  private broadcastOnlineCount() {
    this.broadcast({
      type: "online_count",
      count: this.clients.size,
    });
  }

  private broadcast(data: any) {
    if (!this.wss) return;

    const message = JSON.stringify(data);
    this.wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  }

  getStats(): OnlineStats {
    return {
      onlineCount: this.clients.size,
      recentBets: this.recentBets.slice(0, 20),
    };
  }

  // Force broadcast poker state (called externally with state already fetched)
  forcePokerStateBroadcast(tableId: string, state: any) {
    if (state) {
      this.broadcastPokerState(tableId, state);
    }
  }

  // Spin&Go broadcasts
  broadcastSpinGoMatch(match: any) {
    this.broadcast({
      type: "spingo_match_created",
      match: {
        matchId: match.matchId,
        buyIn: match.buyIn,
        multiplier: match.multiplier,
        prizePool: match.prizePool,
        status: match.status,
        players: match.players.map((p: any) => ({ 
          username: p.username, 
          odejs: p.odejs,
          photoUrl: p.photoUrl 
        })),
        payoutStructure: match.payoutStructure
      }
    });
  }

  broadcastSpinGoQueue(configId: string, queue: any) {
    this.broadcast({
      type: "spingo_queue_update",
      configId,
      queueSize: queue.players.length,
      players: queue.players.map((p: any) => ({ 
        username: p.username, 
        photoUrl: p.photoUrl 
      }))
    });
  }
}

export const gameSocket = new GameWebSocket();
