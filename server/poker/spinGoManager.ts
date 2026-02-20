import { spinGoConfigs } from "@shared/schema";

interface QueuedPlayer {
  odejs: string;
  username: string;
  photoUrl?: string;
  joinedAt: number;
}

interface SpinGoQueue {
  buyIn: number;
  configId: string;
  players: QueuedPlayer[];
}

interface SpinGoMatch {
  matchId: string;
  buyIn: number;
  multiplier: number;
  prizePool: number;
  players: QueuedPlayer[];
  tableId: string | null;
  status: "spinning" | "playing" | "finished";
  createdAt: number;
  payoutStructure: { place: number; percentage: number }[];
}

function generateMatchId(): string {
  return `spingo_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function determineMultiplier(configId: string): number {
  const config = spinGoConfigs.find(c => c.id === configId);
  if (!config) return 2;
  
  const rand = Math.random() * 100;
  let cumulative = 0;
  
  for (const option of config.multiplierOptions) {
    cumulative += option.probability;
    if (rand <= cumulative) {
      return option.multiplier;
    }
  }
  
  return 2;
}

function getPayoutStructure(multiplier: number): { place: number; percentage: number }[] {
  if (multiplier <= 10) {
    return [{ place: 1, percentage: 100 }];
  } else {
    return [
      { place: 1, percentage: 80 },
      { place: 2, percentage: 12 },
      { place: 3, percentage: 8 }
    ];
  }
}

export class SpinGoManager {
  private queues: Map<string, SpinGoQueue> = new Map();
  private activeMatches: Map<string, SpinGoMatch> = new Map();
  private playerMatchMap: Map<string, string> = new Map();
  private onMatchCreated: (match: SpinGoMatch) => void;
  private onQueueUpdate: (configId: string, queue: SpinGoQueue) => void;

  constructor(
    onMatchCreated: (match: SpinGoMatch) => void,
    onQueueUpdate: (configId: string, queue: SpinGoQueue) => void
  ) {
    this.onMatchCreated = onMatchCreated;
    this.onQueueUpdate = onQueueUpdate;
    
    for (const config of spinGoConfigs) {
      this.queues.set(config.id, {
        buyIn: config.buyIn,
        configId: config.id,
        players: []
      });
    }
  }

  registerPlayer(
    configId: string,
    odejs: string,
    username: string,
    photoUrl?: string
  ): { success: boolean; queuePosition?: number; error?: string } {
    const queue = this.queues.get(configId);
    if (!queue) {
      return { success: false, error: "Invalid Spin&Go configuration" };
    }

    if (this.playerMatchMap.has(odejs)) {
      return { success: false, error: "Already in a Spin&Go match" };
    }

    const existingInQueue = queue.players.find(p => p.odejs === odejs);
    if (existingInQueue) {
      return { success: false, error: "Already registered in this queue" };
    }

    const player: QueuedPlayer = {
      odejs,
      username,
      photoUrl,
      joinedAt: Date.now()
    };

    queue.players.push(player);
    this.onQueueUpdate(configId, queue);

    if (queue.players.length >= 3) {
      this.createMatch(configId);
    }

    return { 
      success: true, 
      queuePosition: queue.players.length
    };
  }

  unregisterPlayer(configId: string, odejs: string): boolean {
    const queue = this.queues.get(configId);
    if (!queue) return false;

    const index = queue.players.findIndex(p => p.odejs === odejs);
    if (index === -1) return false;

    queue.players.splice(index, 1);
    this.onQueueUpdate(configId, queue);
    return true;
  }

  private createMatch(configId: string): void {
    const queue = this.queues.get(configId);
    if (!queue || queue.players.length < 3) return;

    const matchPlayers = queue.players.splice(0, 3);
    const matchId = generateMatchId();
    const multiplier = determineMultiplier(configId);
    const prizePool = queue.buyIn * 3 * multiplier * 0.93;

    const match: SpinGoMatch = {
      matchId,
      buyIn: queue.buyIn,
      multiplier,
      prizePool,
      players: matchPlayers,
      tableId: null,
      status: "spinning",
      createdAt: Date.now(),
      payoutStructure: getPayoutStructure(multiplier)
    };

    for (const player of matchPlayers) {
      this.playerMatchMap.set(player.odejs, matchId);
    }

    this.activeMatches.set(matchId, match);
    this.onQueueUpdate(configId, queue);
    this.onMatchCreated(match);
  }

  setMatchTableId(matchId: string, tableId: string): void {
    const match = this.activeMatches.get(matchId);
    if (match) {
      match.tableId = tableId;
      match.status = "playing";
    }
  }

  finishMatch(matchId: string, results: { odejs: string; place: number }[]): void {
    const match = this.activeMatches.get(matchId);
    if (!match) return;

    match.status = "finished";
    
    for (const player of match.players) {
      this.playerMatchMap.delete(player.odejs);
    }

    setTimeout(() => {
      this.activeMatches.delete(matchId);
    }, 60000);
  }

  getQueueStatus(configId: string): { 
    queueSize: number; 
    players: Array<{ username: string; photoUrl?: string }>;
    estimatedWait: number;
  } | null {
    const queue = this.queues.get(configId);
    if (!queue) return null;

    return {
      queueSize: queue.players.length,
      players: queue.players.map(p => ({ 
        username: p.username, 
        photoUrl: p.photoUrl 
      })),
      estimatedWait: Math.max(0, (3 - queue.players.length) * 15)
    };
  }

  getAllQueues(): Array<{
    configId: string;
    buyIn: number;
    queueSize: number;
    players: Array<{ username: string; photoUrl?: string }>;
  }> {
    const result: Array<{
      configId: string;
      buyIn: number;
      queueSize: number;
      players: Array<{ username: string; photoUrl?: string }>;
    }> = [];

    const entries = Array.from(this.queues.entries());
    for (const [configId, queue] of entries) {
      result.push({
        configId,
        buyIn: queue.buyIn,
        queueSize: queue.players.length,
        players: queue.players.map((p: QueuedPlayer) => ({ 
          username: p.username, 
          photoUrl: p.photoUrl 
        }))
      });
    }

    return result;
  }

  getPlayerMatch(odejs: string): SpinGoMatch | null {
    const matchId = this.playerMatchMap.get(odejs);
    if (!matchId) return null;
    return this.activeMatches.get(matchId) || null;
  }

  getMatch(matchId: string): SpinGoMatch | null {
    return this.activeMatches.get(matchId) || null;
  }

  isPlayerInQueue(odejs: string): { inQueue: boolean; configId?: string; position?: number } {
    const entries = Array.from(this.queues.entries());
    for (const [configId, queue] of entries) {
      const index = queue.players.findIndex((p: QueuedPlayer) => p.odejs === odejs);
      if (index !== -1) {
        return { inQueue: true, configId, position: index + 1 };
      }
    }
    return { inQueue: false };
  }
}

let spinGoManager: SpinGoManager | null = null;

export function initSpinGoManager(
  onMatchCreated: (match: SpinGoMatch) => void,
  onQueueUpdate: (configId: string, queue: SpinGoQueue) => void
): SpinGoManager {
  spinGoManager = new SpinGoManager(onMatchCreated, onQueueUpdate);
  return spinGoManager;
}

export function getSpinGoManager(): SpinGoManager | null {
  return spinGoManager;
}

export type { SpinGoMatch, SpinGoQueue, QueuedPlayer };
