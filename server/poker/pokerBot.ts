import { Card, PokerAction, BotPlayStyle } from "@shared/schema";
import { evaluateHand } from "./handEvaluator";

export interface BotConfig {
  id: string;
  odejs: string;
  username: string;
  photoUrl: string;
  style: BotPlayStyle;
  enabled: boolean;
}

export const BOT_CONFIGS: BotConfig[] = [
  {
    id: "bot1",
    odejs: "bot_aggressive_001",
    username: "AceHunter",
    photoUrl: "",
    style: "aggressive",
    enabled: true,
  },
  {
    id: "bot2",
    odejs: "bot_tight_002", 
    username: "RiverKing",
    photoUrl: "",
    style: "tight",
    enabled: true,
  },
  {
    id: "bot3",
    odejs: "bot_balanced_003",
    username: "BluffMaster",
    photoUrl: "",
    style: "balanced",
    enabled: true,
  },
];

export function isBotPlayer(odejs: string): boolean {
  return odejs.startsWith("bot_");
}

export function getBotByOdejs(odejs: string): BotConfig | undefined {
  return BOT_CONFIGS.find(b => b.odejs === odejs);
}

interface BotDecisionContext {
  holeCards: Card[];
  communityCards: Card[];
  pot: number;
  currentBet: number;
  myBetAmount: number;
  myChipStack: number;
  bigBlind: number;
  position: "early" | "middle" | "late" | "blinds";
  street: "preflop" | "flop" | "turn" | "river";
  playersRemaining: number;
  isHeadsUp: boolean;
  botWinRate: number;
}

function getHandStrength(holeCards: Card[], communityCards: Card[]): { ranking: number; description: string } {
  if (communityCards.length === 0) {
    return getPreflopStrength(holeCards);
  }
  const result = evaluateHand(holeCards, communityCards);
  return { ranking: result.rankValue, description: result.description };
}

function getPreflopStrength(holeCards: Card[]): { ranking: number; description: string } {
  const [card1, card2] = holeCards;
  const rank1 = getRankValue(card1.rank);
  const rank2 = getRankValue(card2.rank);
  const isPair = card1.rank === card2.rank;
  const isSuited = card1.suit === card2.suit;
  const isConnected = Math.abs(rank1 - rank2) === 1;
  const highCard = Math.max(rank1, rank2);
  const lowCard = Math.min(rank1, rank2);

  let strength = 0;
  let description = "High Card";

  if (isPair) {
    strength = 50 + highCard * 3;
    description = "Pair";
    if (highCard >= 12) strength += 20;
    if (highCard >= 10) strength += 10;
  } else {
    strength = highCard + lowCard / 2;
    if (isSuited) strength += 5;
    if (isConnected) strength += 3;
    if (highCard === 14 && lowCard >= 10) strength += 15;
    if (highCard === 13 && lowCard >= 10) strength += 12;
    if (highCard >= 12 && lowCard >= 10) strength += 8;
  }

  const normalizedStrength = Math.min(9, Math.floor(strength / 10));
  return { ranking: normalizedStrength, description };
}

function getRankValue(rank: string): number {
  const values: Record<string, number> = {
    "2": 2, "3": 3, "4": 4, "5": 5, "6": 6, "7": 7, "8": 8, "9": 9,
    "T": 10, "J": 11, "Q": 12, "K": 13, "A": 14,
  };
  return values[rank] || 0;
}

function calculatePotOdds(callAmount: number, pot: number): number {
  if (callAmount <= 0) return 100;
  return (callAmount / (pot + callAmount)) * 100;
}

function shouldBluff(style: BotPlayStyle, street: string, potOdds: number): boolean {
  const random = Math.random() * 100;
  
  switch (style) {
    case "aggressive":
      if (street === "preflop") return random < 25;
      if (street === "flop") return random < 20;
      if (street === "turn") return random < 15;
      return random < 10;
    case "tight":
      if (street === "preflop") return random < 5;
      return random < 3;
    case "balanced":
      if (street === "preflop") return random < 15;
      if (street === "flop") return random < 12;
      if (street === "turn") return random < 8;
      return random < 5;
    default:
      return random < 10;
  }
}

function getPlayThreshold(style: BotPlayStyle, street: string): number {
  switch (style) {
    case "aggressive":
      if (street === "preflop") return 2;
      return 1;
    case "tight":
      if (street === "preflop") return 5;
      return 3;
    case "balanced":
      if (street === "preflop") return 3;
      return 2;
    default:
      return 3;
  }
}

function getRaiseFrequency(style: BotPlayStyle, handStrength: number): number {
  const baseFrequency = handStrength * 8;
  
  switch (style) {
    case "aggressive":
      return baseFrequency + 30;
    case "tight":
      return baseFrequency - 10;
    case "balanced":
      return baseFrequency + 10;
    default:
      return baseFrequency;
  }
}

export function decideBotAction(
  style: BotPlayStyle,
  context: BotDecisionContext
): { action: PokerAction; amount?: number } {
  const { holeCards, communityCards, pot, currentBet, myBetAmount, myChipStack, bigBlind, street, playersRemaining, botWinRate } = context;

  const callAmount = currentBet - myBetAmount;
  const canCheck = callAmount <= 0;
  const potOdds = calculatePotOdds(callAmount, pot);
  const handStrength = getHandStrength(holeCards, communityCards);
  const playThreshold = getPlayThreshold(style, street);

  const winRateBonus = (botWinRate - 50) / 10;
  const adjustedStrength = handStrength.ranking + winRateBonus;

  if (adjustedStrength < playThreshold && !canCheck) {
    if (shouldBluff(style, street, potOdds) && myChipStack > callAmount * 3) {
      const bluffAmount = Math.min(pot * 0.75, myChipStack);
      return { action: "raise", amount: Math.max(bluffAmount, bigBlind * 2) };
    }
    
    if (style === "tight" || callAmount > myChipStack * 0.3) {
      return { action: "fold" };
    }
    
    if (potOdds < 25 && callAmount <= bigBlind * 3) {
      return { action: "call" };
    }
    
    return { action: "fold" };
  }

  if (canCheck) {
    const raiseChance = getRaiseFrequency(style, adjustedStrength);
    
    if (Math.random() * 100 < raiseChance) {
      const raiseSize = calculateRaiseSize(style, pot, myChipStack, bigBlind, adjustedStrength);
      if (raiseSize > bigBlind) {
        return { action: "bet", amount: raiseSize };
      }
    }
    return { action: "check" };
  }

  if (adjustedStrength >= 7) {
    if (myChipStack <= callAmount * 2 || adjustedStrength >= 9) {
      return { action: "all_in" };
    }
    
    const raiseAmount = calculateRaiseSize(style, pot, myChipStack, bigBlind, adjustedStrength);
    return { action: "raise", amount: raiseAmount };
  }

  if (adjustedStrength >= 5) {
    const raiseChance = getRaiseFrequency(style, adjustedStrength);
    
    if (Math.random() * 100 < raiseChance && myChipStack > callAmount * 2) {
      const raiseAmount = calculateRaiseSize(style, pot, myChipStack, bigBlind, adjustedStrength);
      return { action: "raise", amount: raiseAmount };
    }
    
    return { action: "call" };
  }

  if (adjustedStrength >= playThreshold) {
    if (callAmount <= myChipStack * 0.2 || potOdds < 30) {
      return { action: "call" };
    }
  }

  return { action: "fold" };
}

function calculateRaiseSize(
  style: BotPlayStyle,
  pot: number,
  chipStack: number,
  bigBlind: number,
  strength: number
): number {
  let multiplier: number;
  
  switch (style) {
    case "aggressive":
      multiplier = 0.8 + (strength / 10) * 0.5;
      break;
    case "tight":
      multiplier = 0.5 + (strength / 10) * 0.3;
      break;
    case "balanced":
      multiplier = 0.6 + (strength / 10) * 0.4;
      break;
    default:
      multiplier = 0.6;
  }

  const random = 0.8 + Math.random() * 0.4;
  const baseRaise = pot * multiplier * random;
  
  const minRaise = bigBlind * 2;
  const maxRaise = chipStack * 0.5;
  
  return Math.max(minRaise, Math.min(maxRaise, baseRaise));
}

export function getPositionType(
  seatNumber: number,
  dealerSeat: number,
  totalSeats: number
): "early" | "middle" | "late" | "blinds" {
  const relativePosition = (seatNumber - dealerSeat + totalSeats) % totalSeats;
  
  if (relativePosition <= 2) return "blinds";
  if (relativePosition <= totalSeats / 3) return "early";
  if (relativePosition <= (totalSeats * 2) / 3) return "middle";
  return "late";
}

export function shouldBotJoinTable(
  joinMode: string,
  hasRealPlayers: boolean,
  currentPlayerCount: number,
  maxSeats: number
): boolean {
  if (joinMode === "wait_for_player") {
    return hasRealPlayers && currentPlayerCount < maxSeats;
  }
  return currentPlayerCount < maxSeats;
}

export function getBotBuyInAmount(minBuyIn: number, maxBuyIn: number): number {
  const range = maxBuyIn - minBuyIn;
  return minBuyIn + range * (0.5 + Math.random() * 0.5);
}
