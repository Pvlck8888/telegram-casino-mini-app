import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { ArrowLeft, Plus, Smile, Menu, X, DollarSign, Settings, Share2, Home, LogOut, Info, RotateCcw, Volume2, VolumeX, ThumbsUp, ThumbsDown, Laugh, Flame, Zap, Heart, Star, Trophy, Coins, Dice1, Clock, Ban } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { BalanceDisplay } from "@/components/BalanceDisplay";
import { useTelegram } from "@/components/TelegramProvider";
import { useAudio } from "@/components/AudioProvider";
import { useLanguage } from "@/components/LanguageProvider";
import { useToast } from "@/hooks/use-toast";
import type { Card, PokerGameState, PokerPlayerState, PokerAction } from "@shared/schema";
import pokerBgImage from "@assets/generated_images/winter_poker_background_snowflakes.png";

const POKER_REACTIONS = [
  { id: "thumbsup", icon: ThumbsUp, color: "text-green-400", labelKey: "reactionGood" },
  { id: "thumbsdown", icon: ThumbsDown, color: "text-red-400", labelKey: "reactionBad" },
  { id: "laugh", icon: Laugh, color: "text-yellow-400", labelKey: "reactionWow" },
  { id: "flame", icon: Flame, color: "text-orange-500", labelKey: "reactionFire" },
  { id: "heart", icon: Heart, color: "text-pink-500", labelKey: "reactionLike" },
  { id: "star", icon: Star, color: "text-yellow-300", labelKey: "reactionWow" },
  { id: "coins", icon: Coins, color: "text-amber-400", labelKey: "bonus" },
  { id: "trophy", icon: Trophy, color: "text-yellow-500", labelKey: "reactionTrophy" },
  { id: "zap", icon: Zap, color: "text-cyan-400", labelKey: "reactionZap" },
  { id: "clock", icon: Clock, color: "text-blue-400", labelKey: "reactionTime" },
  { id: "dice", icon: Dice1, color: "text-purple-400", labelKey: "reactionLuck" },
  { id: "ban", icon: Ban, color: "text-red-500", labelKey: "reactionStop" },
];

interface FloatingReaction {
  id: string;
  reactionId: string;
  seatNumber: number;
  username: string;
}

interface ActiveTableInfo {
  tableId: string;
  tableName: string;
  smallBlind: number;
  bigBlind: number;
  isMyTurn?: boolean;
}

interface PokerTableProps {
  tableId: string;
  tableName: string;
  balance: number;
  smallBlind: number;
  bigBlind: number;
  minBuyIn: number;
  maxBuyIn: number;
  maxSeats: number;
  onBack: () => void;
  onBalanceChange: (newBalance: number) => void;
  onSwitchTable?: (tableId: string) => void;
  activeTables?: ActiveTableInfo[];
}

function getSvgCardId(card: Card): string {
  const suitMap: Record<string, string> = {
    'hearts': 'heart',
    'diamonds': 'diamond', 
    'clubs': 'club',
    'spades': 'spade'
  };
  const rankMap: Record<string, string> = {
    'A': '1', '2': '2', '3': '3', '4': '4', '5': '5',
    '6': '6', '7': '7', '8': '8', '9': '9', 'T': '10',
    'J': 'jack', 'Q': 'queen', 'K': 'king'
  };
  return `${suitMap[card.suit]}_${rankMap[card.rank]}`;
}

function PlayingCard({ card, hidden = false, size = "md", delay = 0 }: { card?: Card; hidden?: boolean; size?: "sm" | "md" | "lg"; delay?: number }) {
  const sizes = {
    sm: { width: 36, height: 52 },
    md: { width: 48, height: 70 },
    lg: { width: 58, height: 84 },
  };
  const { width, height } = sizes[size];

  if (hidden || !card) {
    return (
      <motion.div 
        initial={{ rotateY: 180, scale: 0.5, opacity: 0 }}
        animate={{ rotateY: 0, scale: 1, opacity: 1 }}
        transition={{ duration: 0.3, delay }}
        className="rounded-lg overflow-hidden shadow-xl"
        style={{ width, height }}
      >
        <svg viewBox="0 0 169.075 244.640" width={width} height={height} className="rounded-lg">
          <use href="/svg-cards.svg#back" />
        </svg>
      </motion.div>
    );
  }

  const cardId = getSvgCardId(card);

  return (
    <motion.div 
      initial={{ rotateY: 180, scale: 0.5, opacity: 0 }}
      animate={{ rotateY: 0, scale: 1, opacity: 1 }}
      transition={{ duration: 0.3, delay }}
      className="rounded-lg overflow-hidden shadow-xl"
      style={{ width, height }}
    >
      <svg viewBox="0 0 169.075 244.640" width={width} height={height} className="rounded-lg">
        <use href={`/svg-cards.svg#${cardId}`} />
      </svg>
    </motion.div>
  );
}

function truncateName(name: string, maxLength: number = 8): string {
  if (!name) return "???";
  if (name.length <= maxLength) return name;
  return name.slice(0, maxLength - 1) + "…";
}

interface PlayerSeatProps {
  player?: PokerPlayerState;
  position: number;
  isMe: boolean;
  maxSeats: number;
  isSitOut?: boolean;
  playersCount: number;
  onSeatClick?: (seatNumber: number) => void;
  actionTimeLeft?: number;
  timeBank?: number;
  isShowdown?: boolean;
}

function PlayerSeat({ player, position, isMe, maxSeats, isSitOut = false, playersCount, onSeatClick, actionTimeLeft = 0, timeBank = 30, isShowdown = false }: PlayerSeatProps) {
  // Improved positioning for oval table - positioned around the edge
  const positions6 = [
    { bottom: "0%", left: "50%", transform: "translate(-50%, 0)" }, // Bottom center (hero)
    { top: "70%", left: "2%", transform: "translate(0, -50%)" },   // Bottom left
    { top: "30%", left: "2%", transform: "translate(0, -50%)" },   // Top left
    { top: "2%", left: "50%", transform: "translate(-50%, 0)" },   // Top center
    { top: "30%", right: "2%", left: "auto", transform: "translate(0, -50%)" }, // Top right
    { top: "70%", right: "2%", left: "auto", transform: "translate(0, -50%)" }, // Bottom right
  ];

  const positions9 = [
    { bottom: "0%", left: "50%", transform: "translate(-50%, 0)" }, // Bottom center (hero)
    { top: "78%", left: "2%", transform: "translate(0, -50%)" },   // Bottom left
    { top: "50%", left: "0%", transform: "translate(-30%, -50%)" }, // Middle left
    { top: "22%", left: "2%", transform: "translate(0, -50%)" },   // Top left
    { top: "2%", left: "30%", transform: "translate(-50%, 0)" },   // Top left-center
    { top: "2%", left: "70%", transform: "translate(-50%, 0)" },   // Top right-center
    { top: "22%", right: "2%", left: "auto", transform: "translate(0, -50%)" }, // Top right
    { top: "50%", right: "0%", left: "auto", transform: "translate(30%, -50%)" }, // Middle right
    { top: "78%", right: "2%", left: "auto", transform: "translate(0, -50%)" }, // Bottom right
  ];

  const positionStyle = maxSeats <= 6 ? positions6[position] : positions9[position];
  const showSitOut = isSitOut && player && playersCount === 1;

  if (!player) {
    return (
      <div 
        className="absolute w-16 flex flex-col items-center"
        style={positionStyle as any}
      >
        <div 
          className="w-12 h-12 rounded-full bg-slate-900/60 border-2 border-dashed border-slate-600/50 flex items-center justify-center cursor-pointer hover:bg-slate-800/60 hover:border-cyan-500/50 transition-colors"
          onClick={() => onSeatClick?.(position)}
          data-testid={`button-seat-${position}`}
        >
          <Plus className="w-5 h-5 text-slate-400" />
        </div>
      </div>
    );
  }

  // Cards positioned to left/right of player circle based on seat position
  const isRightSidePlayer = position >= 4; // Right side seats: 4, 5, 6, 7, 8
  
  const showCards = (isMe && player.holeCards && player.holeCards.length === 2) || (!isMe && player.hasCards && !player.isFolded);
  
  const CardsComponent = showCards ? (
    <div className="flex gap-0.5">
      <PlayingCard 
        card={(isMe || (isShowdown && player.holeCards)) ? player.holeCards?.[0] : undefined} 
        hidden={!isMe && !(isShowdown && player.holeCards)} 
        size="md" 
      />
      <div className="-ml-3">
        <PlayingCard 
          card={(isMe || (isShowdown && player.holeCards)) ? player.holeCards?.[1] : undefined} 
          hidden={!isMe && !(isShowdown && player.holeCards)} 
          size="md" 
        />
      </div>
    </div>
  ) : null;
  
  return (
    <div 
      className="absolute flex items-center gap-1 z-10"
      style={positionStyle as any}
    >
      {/* Cards on LEFT of player for right-side seats */}
      {isRightSidePlayer && CardsComponent}
      
      <div className="flex flex-col items-center">
        <div className="relative">
        {/* Timer ring for current turn player */}
        {player.isCurrentTurn && actionTimeLeft > 0 && (
          <div className="absolute -inset-1 z-0">
            <svg className="w-16 h-16 transform -rotate-90" viewBox="0 0 36 36">
              <circle
                cx="18" cy="18" r="17"
                fill="none"
                stroke="#27272a"
                strokeWidth="2"
              />
              <circle
                cx="18" cy="18" r="17"
                fill="none"
                stroke={actionTimeLeft <= 10000 ? "#ef4444" : actionTimeLeft <= 20000 ? "#f59e0b" : "#22c55e"}
                strokeWidth="2"
                strokeDasharray={`${(actionTimeLeft / (timeBank * 1000)) * 106.8} 106.8`}
                strokeLinecap="round"
                className="transition-all duration-100"
              />
            </svg>
          </div>
        )}
        
        <motion.div 
          className={`relative z-10 w-14 h-14 rounded-full overflow-hidden border-3 ${
            player.isFolded ? "border-slate-600 opacity-40" : 
            player.isCurrentTurn ? "border-yellow-400 ring-2 ring-yellow-400/50" :
            isMe ? "border-cyan-400" : "border-blue-400"
          } shadow-lg`}
          animate={player.isCurrentTurn ? {
            boxShadow: ["0 0 0 0 rgba(250, 204, 21, 0)", "0 0 0 8px rgba(250, 204, 21, 0.4)", "0 0 0 0 rgba(250, 204, 21, 0)"]
          } : {}}
          transition={{ duration: 1.5, repeat: Infinity }}
        >
          {player.odejsPhotoUrl ? (
            <img src={player.odejsPhotoUrl} alt={player.odejsname} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-purple-600 to-purple-800 flex items-center justify-center text-white font-bold text-lg">
              {player.odejsname?.[0]?.toUpperCase() || "?"}
            </div>
          )}
        </motion.div>

        {player.isDealer && (
          <div className="absolute -bottom-1 -left-1 w-5 h-5 bg-yellow-500 rounded-full flex items-center justify-center text-xs font-bold text-black shadow-md border border-yellow-600">
            D
          </div>
        )}

        {player.isSmallBlind && !player.isDealer && (
          <div className="absolute -bottom-1 -left-1 w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center text-[8px] font-bold text-white shadow-md border border-blue-600">
            SB
          </div>
        )}

        {player.isBigBlind && (
          <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-orange-500 rounded-full flex items-center justify-center text-[8px] font-bold text-white shadow-md border border-orange-600">
            BB
          </div>
        )}

        {player.isAllIn && (
          <div className="absolute -top-1 left-1/2 -translate-x-1/2 px-2 py-0.5 bg-red-600 rounded text-[9px] font-bold text-white shadow-md">
            ALL IN
          </div>
        )}
      </div>

      <div className={`mt-1 px-2 py-1 rounded-lg ${isMe ? "bg-gradient-to-r from-cyan-600 to-cyan-700" : "bg-gradient-to-r from-blue-600 to-blue-700"} min-w-[60px] text-center shadow-lg border ${isMe ? "border-cyan-400/30" : "border-blue-400/30"}`}>
        <div className="text-[10px] text-white/90 font-medium truncate max-w-[70px]">
          {truncateName(player.odejsname || "Player", 9)}
        </div>
        <div className="text-xs font-bold text-white">
          ${player.chipStack.toFixed(2)}
        </div>
      </div>

        {showSitOut && (
          <div className="mt-1 px-2 py-0.5 bg-orange-500 rounded text-[9px] font-bold text-white">
            SIT OUT
          </div>
        )}

        {/* FOLD label for folded players */}
        {player.isFolded && (
          <div className="mt-1 px-3 py-0.5 bg-slate-700/80 rounded text-[10px] font-bold text-slate-400 uppercase tracking-wide">
            Fold
          </div>
        )}

        <AnimatePresence>
          {player.betAmount > 0 && (
            <motion.div 
              initial={{ scale: 0, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0, opacity: 0, y: -20 }}
              transition={{ duration: 0.2 }}
              className="absolute" 
              style={{ 
                top: position === 0 || position === 4 ? "-30px" : "50%",
                left: position < 3 ? "70px" : "auto",
                right: position >= 4 ? "70px" : "auto",
              }}
            >
              <motion.div 
                className="flex items-center gap-1"
                animate={{ scale: [1, 1.1, 1] }}
                transition={{ duration: 0.3 }}
              >
                <div className="w-4 h-4 rounded-full bg-gradient-to-br from-red-500 to-red-700 border border-red-400 shadow-sm" />
                <span className="text-xs font-bold text-white">${player.betAmount.toFixed(2)}</span>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      
      {/* Cards on RIGHT of player for left-side seats */}
      {!isRightSidePlayer && CardsComponent}
    </div>
  );
}

export function PokerTable({
  tableId,
  tableName,
  balance,
  smallBlind,
  bigBlind,
  minBuyIn,
  maxBuyIn,
  maxSeats,
  onBack,
  onBalanceChange,
  onSwitchTable,
  activeTables = [],
}: PokerTableProps) {
  const { user, hapticFeedback, isLoading: userLoading } = useTelegram();
  const { toast } = useToast();
  const { playSound, setCurrentGame, settings, toggleSound } = useAudio();
  const { t } = useLanguage();

  // Set audio context to poker
  useEffect(() => {
    setCurrentGame("poker");
    return () => setCurrentGame("lobby");
  }, [setCurrentGame]);

  const [gameState, setGameState] = useState<PokerGameState | null>(null);
  const [chipStack, setChipStack] = useState(0);
  const [mySeat, setMySeat] = useState<number | null>(null);
  const [selectedSeat, setSelectedSeat] = useState<number | null>(null);
  const [buyInAmount, setBuyInAmount] = useState(minBuyIn);
  const [betAmount, setBetAmount] = useState(bigBlind);
  const [showBuyIn, setShowBuyIn] = useState(false);
  const [showRebuy, setShowRebuy] = useState(false);
  const [rebuyAmount, setRebuyAmount] = useState(minBuyIn);
  const [kickCountdown, setKickCountdown] = useState<number | null>(null);
  const [actionTimeLeft, setActionTimeLeft] = useState<number>(0);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [floatingReactions, setFloatingReactions] = useState<FloatingReaction[]>([]);
  const [reactionCooldown, setReactionCooldown] = useState(false); // Flood protection
  const [showSideMenu, setShowSideMenu] = useState(false);
  const [showTableInfo, setShowTableInfo] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showWinnerWindow, setShowWinnerWindow] = useState(true);
  const [vibrationEnabled, setVibrationEnabled] = useState(() => {
    try {
      const saved = localStorage.getItem("pokerVibrationEnabled");
      return saved !== null ? JSON.parse(saved) : true;
    } catch { return true; }
  });

  const wsRef = useRef<WebSocket | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const prevStatusRef = useRef<string | null>(null);
  const prevIsMyTurnRef = useRef<boolean>(false);
  const prevHandNumberRef = useRef<number>(0);

  // Save vibration setting to localStorage
  useEffect(() => {
    localStorage.setItem("pokerVibrationEnabled", JSON.stringify(vibrationEnabled));
  }, [vibrationEnabled]);

  const myPlayer = gameState?.players.find(p => String(p.odejs) === String(user?.id));
  const isMyTurn = myPlayer?.isCurrentTurn;
  const canCheck = gameState?.currentBet === (myPlayer?.betAmount || 0);
  const callAmount = (gameState?.currentBet || 0) - (myPlayer?.betAmount || 0);
  const playersCount = gameState?.players.length || 0;

  // Wrapper for haptic feedback that respects vibration setting
  const doHaptic = useCallback((type: "light" | "medium" | "heavy") => {
    if (vibrationEnabled) {
      hapticFeedback(type);
    }
  }, [vibrationEnabled, hapticFeedback]);

  // Sound effects based on game state changes
  useEffect(() => {
    if (!gameState) return;

    // New hand started - play card deal sound and reset winner window
    if (gameState.handNumber > prevHandNumberRef.current && gameState.status === "preflop") {
      playSound("cardDeal");
      prevHandNumberRef.current = gameState.handNumber;
      setShowWinnerWindow(true); // Reset winner window visibility for new hand
    }

    // New community cards dealt (flop, turn, river)
    const statusChanged = gameState.status !== prevStatusRef.current;
    if (statusChanged && (gameState.status === "flop" || gameState.status === "turn" || gameState.status === "river")) {
      playSound("cardFlip");
    }
    prevStatusRef.current = gameState.status;

    // It's now my turn - play notification sound
    if (isMyTurn && !prevIsMyTurnRef.current) {
      playSound("yourTurn");
      doHaptic("heavy");
    }
    prevIsMyTurnRef.current = !!isMyTurn;

    // Win sound when pot is won (showdown completed and we got chips)
    if (gameState.status === "waiting" && myPlayer && myPlayer.chipStack > chipStack) {
      playSound("win");
    }
  }, [gameState, isMyTurn, myPlayer, chipStack, playSound, hapticFeedback]);


  useEffect(() => {
    if (!user?.id || userLoading) {
      return;
    }
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const ws = new WebSocket(`${protocol}//${window.location.host}/ws`);
    wsRef.current = ws;

    ws.onopen = () => {
      ws.send(JSON.stringify({ 
        type: "join_table", 
        tableId, 
        odejs: user.id,
        username: user.username || user.firstName || "Player",
        photoUrl: user.photoUrl || null
      }));
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      
      if (data.type === "poker_state") {
        setGameState(data.state);
        
        const me = data.state.players.find((p: PokerPlayerState) => String(p.odejs) === String(user?.id));
        if (me) {
          setMySeat(me.seatNumber);
          setChipStack(me.chipStack);
          
          // Check if stack is zero and hand is over - show rebuy dialog with countdown
          if (me.chipStack <= 0 && data.state.status === "waiting" && !showRebuy) {
            setShowRebuy(true);
            setRebuyAmount(minBuyIn);
            setKickCountdown(3);
          }
        } else if (mySeat !== null) {
          // We were removed from the table
          setMySeat(null);
          setChipStack(0);
          setShowRebuy(false);
          setKickCountdown(null);
        }
      }

      if (data.type === "kicked") {
        toast({ title: data.message || t("removedFromTable"), variant: "destructive" });
        setMySeat(null);
        setChipStack(0);
        setShowRebuy(false);
        setKickCountdown(null);
      }

      if (data.type === "error") {
        toast({ title: data.message || t("error"), variant: "destructive" });
      }

      if (data.type === "reaction") {
        const newReaction: FloatingReaction = {
          id: `${Date.now()}-${Math.random()}`,
          reactionId: data.emoji || data.reactionId, // Support both old emoji and new reactionId
          seatNumber: data.seatNumber,
          username: data.username,
        };
        setFloatingReactions(prev => [...prev, newReaction]);
        setTimeout(() => {
          setFloatingReactions(prev => prev.filter(r => r.id !== newReaction.id));
        }, 3000);
      }
    };

    ws.onclose = () => {};

    return () => {
      ws.close();
    };
  }, [tableId, user?.id, userLoading]);

  // Countdown timer for kick
  useEffect(() => {
    if (kickCountdown === null || kickCountdown <= 0) return;
    
    const timer = setInterval(() => {
      setKickCountdown(prev => {
        if (prev === null || prev <= 1) {
          return null;
        }
        return prev - 1;
      });
    }, 1000);
    
    return () => clearInterval(timer);
  }, [kickCountdown]);

  // Action timer - updates every 100ms for smooth progress bar
  useEffect(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    if (!gameState?.actionDeadline || gameState.actionDeadline === 0) {
      setActionTimeLeft(0);
      return;
    }

    const updateTimer = () => {
      const now = Date.now();
      const remaining = Math.max(0, gameState.actionDeadline - now);
      setActionTimeLeft(remaining);
    };

    updateTimer();
    timerRef.current = setInterval(updateTimer, 100);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [gameState?.actionDeadline]);

  // Handle rebuy
  const handleRebuy = async () => {
    if (mySeat === null) {
      toast({ title: t("notAtTable"), variant: "destructive" });
      return;
    }
    
    if (!user?.id) {
      toast({ title: t("userNotLoaded"), variant: "destructive" });
      return;
    }
    
    if (rebuyAmount > balance) {
      toast({ title: t("insufficientBalance"), variant: "destructive" });
      return;
    }

    try {
      const res = await fetch(`/api/poker/tables/${tableId}/rebuy`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          odejs: user.id,
          amount: rebuyAmount,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to rebuy");
      }

      const data = await res.json();
      setChipStack(data.newStack);
      onBalanceChange(balance - rebuyAmount);
      setShowRebuy(false);
      setKickCountdown(null);
      doHaptic("medium");
      toast({ title: `${t("rebuySuccess")}: $${rebuyAmount.toFixed(2)}` });
      
      // Force refresh state from server via WebSocket
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({
          type: "rebuy_complete",
          tableId,
          seatNumber: mySeat,
          newStack: data.newStack,
        }));
      }
    } catch (error: any) {
      toast({ title: error.message || t("rebuyError"), variant: "destructive" });
    }
  };

  const sendAction = useCallback((action: PokerAction, amount?: number) => {
    if (!wsRef.current || !isMyTurn) return;

    wsRef.current.send(JSON.stringify({
      type: "poker_action",
      tableId,
      seatNumber: mySeat,
      action,
      amount,
    }));

    // Play appropriate sound based on action
    switch (action) {
      case "fold":
        playSound("fold");
        break;
      case "check":
        playSound("check");
        break;
      case "call":
      case "bet":
      case "raise":
        playSound("chips");
        break;
      case "all_in":
        playSound("allIn");
        break;
    }

    doHaptic("medium");

    // Request state refresh after action to ensure UI stays in sync
    setTimeout(() => {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({
          type: "request_state",
          tableId,
        }));
      }
    }, 300);
  }, [tableId, mySeat, isMyTurn, hapticFeedback, playSound]);

  const handleSeatClick = (seatNumber: number) => {
    // Don't allow sitting if already seated
    if (mySeat !== null) {
      toast({ title: t("alreadySeated"), variant: "destructive" });
      return;
    }
    // Check if user is loaded
    if (!user?.id) {
      toast({ title: t("waitLoading"), variant: "destructive" });
      return;
    }
    // Check if seat is taken
    const seatTaken = gameState?.players.some(p => p.seatNumber === seatNumber);
    if (seatTaken) {
      toast({ title: t("seatTaken"), variant: "destructive" });
      return;
    }
    setSelectedSeat(seatNumber);
    setBuyInAmount(minBuyIn);
    setShowBuyIn(true);
    doHaptic("light");
  };

  const handleBuyIn = async () => {
    if (selectedSeat === null) {
      toast({ title: t("selectSeat"), variant: "destructive" });
      return;
    }
    if (!user?.id) {
      toast({ title: t("userNotLoaded"), variant: "destructive" });
      return;
    }
    if (mySeat !== null) {
      toast({ title: t("alreadySeated"), variant: "destructive" });
      setShowBuyIn(false);
      setSelectedSeat(null);
      return;
    }
    if (buyInAmount > balance) {
      toast({ title: t("insufficientBalance"), variant: "destructive" });
      return;
    }

    try {
      const res = await fetch(`/api/poker/tables/${tableId}/sit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          odejs: user.id,
          buyIn: buyInAmount,
          seatNumber: selectedSeat,
        }),
      });

      const data = await res.json();
      
      if (!res.ok) {
        // If already seated, recover the state
        if (data.error === "Already seated at this table" && data.seatNumber !== undefined) {
          setMySeat(data.seatNumber);
          setChipStack(data.chipStack || 0);
          setShowBuyIn(false);
          setSelectedSeat(null);
          toast({ title: t("alreadySeated") });
          return;
        }
        
        throw new Error(data.error || "Failed to sit");
      }

      // Update local state after successful response
      setMySeat(data.seatNumber);
      setChipStack(data.chipStack || buyInAmount);
      onBalanceChange(balance - buyInAmount);
      setShowBuyIn(false);
      setSelectedSeat(null);
      doHaptic("medium");

      // Notify WebSocket to sync game state
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        const sitMessage = {
          type: "sit_down",
          tableId,
          odejs: user.id,
          seatNumber: data.seatNumber,
          buyIn: buyInAmount,
          username: user.firstName || user.username || "Player",
          photoUrl: user.photoUrl,
        };
        wsRef.current.send(JSON.stringify(sitMessage));
      }
    } catch (error: any) {
      toast({ title: t("error"), description: error.message || t("couldNotSit"), variant: "destructive" });
      // Reset state on error
      setShowBuyIn(false);
      setSelectedSeat(null);
    }
  };

  const handleBack = () => {
    onBack();
  };

  const handleStandUp = async () => {
    if (mySeat === null) {
      toast({ title: t("notAtTable"), variant: "destructive" });
      return;
    }

    if (!user?.id) {
      toast({ title: t("userNotLoaded"), variant: "destructive" });
      return;
    }

    if (gameState && gameState.status !== "waiting") {
      toast({ title: t("waitForHand"), variant: "destructive" });
      return;
    }

    try {
      // First notify backend to leave
      const res = await fetch(`/api/poker/tables/${tableId}/leave`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ odejs: user.id, seatNumber: mySeat }),
      });

      if (res.ok) {
        const data = await res.json();
        
        // Then notify WebSocket
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({
            type: "leave_table",
            tableId,
            seatNumber: mySeat,
            odejs: user.id,
          }));
        }
        
        // Update local state after success
        onBalanceChange(balance + (data.returned || 0));
        setMySeat(null);
        setChipStack(0);
        toast({ title: t("leftTable") });
      } else {
        const errorData = await res.json();
        toast({ title: errorData.error || t("error"), variant: "destructive" });
      }
    } catch (error) {
      toast({ title: t("errorLeaving"), variant: "destructive" });
    }
  };

  const sendReaction = useCallback((reactionId: string) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    if (mySeat === null) return;
    if (reactionCooldown) return; // Flood protection - 2 second cooldown
    
    wsRef.current.send(JSON.stringify({
      type: "reaction",
      tableId,
      reactionId,
      seatNumber: mySeat,
      username: user?.username || user?.firstName || "Player",
    }));
    doHaptic("light");
    setShowEmojiPicker(false);
    
    // Set cooldown to prevent flood
    setReactionCooldown(true);
    setTimeout(() => setReactionCooldown(false), 2000);
  }, [tableId, mySeat, user?.username, user?.firstName, hapticFeedback, reactionCooldown]);

  return (
    <div className="h-screen w-screen bg-zinc-950 flex flex-col overflow-hidden" data-testid="page-poker-table">
      <header className="shrink-0 z-50 bg-gradient-to-b from-slate-900/95 to-slate-900/80 backdrop-blur-sm border-b border-slate-700/50">
        <div className="px-2 py-1.5 flex items-center justify-between">
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="w-8 h-8"
              onClick={() => setShowSideMenu(true)}
              data-testid="button-menu"
            >
              <Menu className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="w-8 h-8"
              onClick={() => setShowTableInfo(true)}
              data-testid="button-info"
            >
              <Info className="w-4 h-4 text-cyan-400" />
            </Button>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-white text-sm font-medium">{tableName}</span>
            <span className="text-cyan-400 text-xs">${smallBlind}/${bigBlind}</span>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="w-8 h-8"
              onClick={() => {
                toggleSound();
                doHaptic("light");
              }}
              data-testid="button-sound-toggle"
            >
              {settings.soundEnabled ? (
                <Volume2 className="w-4 h-4 text-cyan-400" />
              ) : (
                <VolumeX className="w-4 h-4 text-slate-500" />
              )}
            </Button>
            <div className="flex items-center gap-1.5 bg-slate-800/80 px-3 py-1 rounded-lg border border-slate-600/50">
              <div className="w-4 h-4 rounded-full bg-gradient-to-br from-yellow-400 to-yellow-600 flex-shrink-0" />
              <span className="text-white text-sm font-bold whitespace-nowrap">${balance.toFixed(2)}</span>
            </div>
          </div>
        </div>
        
        {/* Multi-table switcher - shows when playing at multiple tables */}
        {activeTables.length > 1 && onSwitchTable && (
          <div className="px-2 py-1 bg-slate-900/90 border-t border-slate-700/30">
            <div className="flex gap-1 overflow-x-auto scrollbar-hide">
              {activeTables.map(table => (
                <button
                  key={table.tableId}
                  onClick={() => {
                    if (table.tableId !== tableId) {
                      doHaptic("light");
                      onSwitchTable(table.tableId);
                    }
                  }}
                  className={`flex-shrink-0 flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                    table.tableId === tableId
                      ? "bg-cyan-600 text-white shadow-lg"
                      : table.isMyTurn
                      ? "bg-yellow-500/20 text-yellow-300 border border-yellow-500/50 animate-pulse"
                      : "bg-slate-800/60 text-slate-400 hover:bg-slate-700/60"
                  }`}
                  data-testid={`switch-table-${table.tableId}`}
                >
                  {table.isMyTurn && table.tableId !== tableId && (
                    <span className="w-2 h-2 rounded-full bg-yellow-400 animate-ping" />
                  )}
                  <span>{table.tableName}</span>
                  <span className="text-[10px] opacity-70">${table.smallBlind}/{table.bigBlind}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </header>

      <main className="flex-1 relative overflow-hidden">
        <div 
          className="absolute inset-0 bg-black/40"
          style={{ 
            backgroundImage: `url(${pokerBgImage})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            backgroundBlendMode: 'darken'
          }}
        />
        <div className="absolute inset-0 bg-black/30" />
        <div className="absolute inset-0 flex items-center justify-center p-3">
          <div className="relative w-full h-full max-w-sm">
            <svg viewBox="0 0 200 320" className="w-full h-full drop-shadow-2xl">
              <defs>
                {/* Blue winter table gradient */}
                <linearGradient id="tableGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#1e3a5f" />
                  <stop offset="50%" stopColor="#152a45" />
                  <stop offset="100%" stopColor="#0f2035" />
                </linearGradient>
                {/* Dark navy border */}
                <linearGradient id="borderGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#0d1f33" />
                  <stop offset="50%" stopColor="#081524" />
                  <stop offset="100%" stopColor="#050d16" />
                </linearGradient>
                {/* LED glow effect */}
                <filter id="ledGlow" x="-50%" y="-50%" width="200%" height="200%">
                  <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
                  <feMerge>
                    <feMergeNode in="coloredBlur"/>
                    <feMergeNode in="SourceGraphic"/>
                  </feMerge>
                </filter>
                <filter id="tableShadow">
                  <feDropShadow dx="0" dy="4" stdDeviation="8" floodColor="#000" floodOpacity="0.6"/>
                </filter>
                {/* Animated LED gradient */}
                <linearGradient id="ledGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#00d4ff">
                    <animate attributeName="stop-color" values="#00d4ff;#00ff88;#00d4ff" dur="3s" repeatCount="indefinite"/>
                  </stop>
                  <stop offset="50%" stopColor="#00ff88">
                    <animate attributeName="stop-color" values="#00ff88;#00d4ff;#00ff88" dur="3s" repeatCount="indefinite"/>
                  </stop>
                  <stop offset="100%" stopColor="#00d4ff">
                    <animate attributeName="stop-color" values="#00d4ff;#00ff88;#00d4ff" dur="3s" repeatCount="indefinite"/>
                  </stop>
                </linearGradient>
              </defs>
              
              {/* Outer glow ring */}
              <ellipse cx="100" cy="160" rx="97" ry="152" fill="none" stroke="url(#ledGradient)" strokeWidth="2" filter="url(#ledGlow)" opacity="0.8" />
              
              {/* Dark outer border */}
              <ellipse cx="100" cy="160" rx="95" ry="150" fill="url(#borderGradient)" filter="url(#tableShadow)" />
              
              {/* Main table surface */}
              <ellipse cx="100" cy="160" rx="85" ry="140" fill="url(#tableGradient)" />
              
              {/* Inner decorative ring */}
              <ellipse cx="100" cy="160" rx="75" ry="125" fill="none" stroke="#1a4060" strokeWidth="1" opacity="0.5" />
              
              {/* Subtle inner glow line */}
              <ellipse cx="100" cy="160" rx="78" ry="130" fill="none" stroke="#00d4ff" strokeWidth="0.5" opacity="0.3" />
              
              {/* Table logo */}
              <text x="100" y="150" textAnchor="middle" fill="#4a7a9f" fontSize="14" fontWeight="bold" fontFamily="'Arial', sans-serif" opacity="0.4">
                PAPA
              </text>
              <text x="100" y="168" textAnchor="middle" fill="#4a7a9f" fontSize="14" fontWeight="bold" fontFamily="'Arial', sans-serif" opacity="0.4">
                POKER
              </text>
            </svg>

            <AnimatePresence>
              {gameState?.pot !== undefined && gameState.pot > 0 && (
                <motion.div 
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 1.5, opacity: 0 }}
                  transition={{ type: "spring", stiffness: 300, damping: 20 }}
                  className="absolute top-[28%] left-[30%] -translate-x-1/2 flex flex-col items-center z-20"
                >
                  <div className="flex items-center gap-2 bg-black/50 px-3 py-1.5 rounded-full backdrop-blur-sm border border-cyan-500/30">
                    <div className="flex -space-x-1">
                      <div className="w-4 h-4 rounded-full bg-gradient-to-br from-yellow-400 to-yellow-600 border border-yellow-300 shadow-md" />
                      <div className="w-4 h-4 rounded-full bg-gradient-to-br from-red-400 to-red-600 border border-red-300 shadow-md" />
                      <div className="w-4 h-4 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 border border-blue-300 shadow-md" />
                    </div>
                    <motion.span 
                      className="text-white font-bold text-base"
                      animate={{ textShadow: ["0 0 8px #00d4ff", "0 0 16px #00d4ff", "0 0 8px #00d4ff"] }}
                      transition={{ duration: 2, repeat: Infinity }}
                    >
                      ${gameState.pot.toFixed(2)}
                    </motion.span>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {gameState?.communityCards && gameState.communityCards.length > 0 && (
              <motion.div 
                className="absolute top-[42%] left-1/2 -translate-x-1/2 flex gap-1.5"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
              >
                {gameState.communityCards.map((card, i) => (
                  <PlayingCard key={i} card={card} size="lg" delay={i * 0.1} />
                ))}
              </motion.div>
            )}

            {Array.from({ length: maxSeats }).map((_, i) => {
              const player = gameState?.players.find(p => p.seatNumber === i);
              return (
                <PlayerSeat 
                  key={i} 
                  player={player} 
                  position={i} 
                  isMe={player?.odejs === user?.id}
                  maxSeats={maxSeats}
                  isSitOut={mySeat !== null && playersCount === 1}
                  playersCount={playersCount}
                  onSeatClick={mySeat === null ? handleSeatClick : undefined}
                  actionTimeLeft={player?.isCurrentTurn ? actionTimeLeft : 0}
                  timeBank={gameState?.timeBank || 30}
                  isShowdown={gameState?.status === "showdown"}
                />
              );
            })}

            {/* Floating Reactions - positioned to the SIDE of player seats within table container */}
            <AnimatePresence>
              {floatingReactions.map((reaction) => {
                // Position reactions to the side of players, not overlapping with avatar
                const reactionPositions6 = [
                  { bottom: "8%", left: "65%", transform: "translate(0, 0)" },        // Right of hero
                  { top: "65%", left: "18%", transform: "translate(0, 0)" },          // Right of bottom-left
                  { top: "25%", left: "18%", transform: "translate(0, 0)" },          // Right of top-left
                  { top: "8%", left: "60%", transform: "translate(0, 0)" },           // Right of top-center
                  { top: "25%", right: "18%", left: "auto", transform: "translate(0, 0)" }, // Left of top-right
                  { top: "65%", right: "18%", left: "auto", transform: "translate(0, 0)" }, // Left of bottom-right
                ];
                const pos = reactionPositions6[reaction.seatNumber % 6];
                const reactionConfig = POKER_REACTIONS.find(r => r.id === reaction.reactionId);
                const IconComponent = reactionConfig?.icon || Heart;
                const iconColor = reactionConfig?.color || "text-white";
                return (
                  <motion.div
                    key={reaction.id}
                    initial={{ opacity: 0, scale: 0.5, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0, y: -30 }}
                    transition={{ type: "spring", stiffness: 400, damping: 25 }}
                    className="absolute pointer-events-none z-[100]"
                    style={pos as any}
                  >
                    <div className="flex flex-col items-center">
                      <div className="w-12 h-12 rounded-full bg-black/60 backdrop-blur-sm flex items-center justify-center animate-bounce border-2 border-white/20 shadow-xl">
                        <IconComponent className={`w-7 h-7 ${iconColor} drop-shadow-lg`} />
                      </div>
                      <span className="text-xs text-white bg-black/80 px-2 py-0.5 rounded-full mt-1 font-medium shadow-lg">
                        {reaction.username}
                      </span>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        </div>

      </main>

      <div className="shrink-0 bg-black/90 backdrop-blur-sm border-t border-zinc-800/50">
        {mySeat !== null && isMyTurn && (
          <div className="px-3 py-2 space-y-2">
            {/* Action Timer - Large Circular Display */}
            {actionTimeLeft > 0 && (
              <div className="flex items-center justify-center gap-3">
                <div className="relative w-14 h-14">
                  <svg className="w-14 h-14 transform -rotate-90" viewBox="0 0 36 36">
                    <circle
                      cx="18" cy="18" r="16"
                      fill="none"
                      stroke="#27272a"
                      strokeWidth="3"
                    />
                    <circle
                      cx="18" cy="18" r="16"
                      fill="none"
                      stroke={actionTimeLeft <= 10000 ? "#ef4444" : actionTimeLeft <= 20000 ? "#f59e0b" : "#22c55e"}
                      strokeWidth="3"
                      strokeDasharray={`${(actionTimeLeft / ((gameState?.timeBank || 30) * 1000)) * 100.5} 100.5`}
                      strokeLinecap="round"
                      className="transition-all duration-100"
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className={`text-lg font-bold ${actionTimeLeft <= 10000 ? "text-red-500 animate-pulse" : actionTimeLeft <= 20000 ? "text-yellow-500" : "text-green-500"}`}>
                      {Math.ceil(actionTimeLeft / 1000)}
                    </span>
                  </div>
                </div>
                <div className="text-sm">
                  <div className={`font-medium ${actionTimeLeft <= 10000 ? "text-red-400" : "text-zinc-400"}`}>
                    {actionTimeLeft <= 10000 ? t("timeRunningOut") : t("yourTurn")}
                  </div>
                  {actionTimeLeft <= 10000 && (
                    <div className="text-xs text-red-400/70">{t("autoFoldSitOut")}</div>
                  )}
                </div>
              </div>
            )}

            {/* Hand Strength Label */}
            {myPlayer?.handStrength && (
              <div className="text-center">
                <span className="px-3 py-1 bg-cyan-500/20 border border-cyan-500/50 rounded-full text-sm text-cyan-400 font-medium">
                  {myPlayer.handStrength}
                </span>
              </div>
            )}

            {/* Pot sizing buttons - No-Limit rules: raise = call + desired pot percentage */}
            <div className="flex gap-2 justify-center">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const call = callAmount;
                  const potPlusCall = (gameState?.pot || 0) + call;
                  const halfPotRaise = Math.max(gameState?.minRaise || bigBlind, call + potPlusCall * 0.5);
                  setBetAmount(Math.min(chipStack, halfPotRaise));
                }}
                className="text-xs border-zinc-600"
                data-testid="button-half-pot"
              >
                1/2 Pot
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const call = callAmount;
                  const potPlusCall = (gameState?.pot || 0) + call;
                  const potRaise = Math.max(gameState?.minRaise || bigBlind, call + potPlusCall);
                  setBetAmount(Math.min(chipStack, potRaise));
                }}
                className="text-xs border-zinc-600"
                data-testid="button-pot"
              >
                Pot
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setBetAmount(chipStack)}
                className="text-xs border-zinc-600"
                data-testid="button-max"
              >
                Max
              </Button>
            </div>

            <div className="flex items-center gap-2">
              <Slider
                value={[betAmount]}
                onValueChange={([v]) => setBetAmount(v)}
                min={gameState?.minRaise || bigBlind}
                max={chipStack}
                step={0.01}
                className="flex-1"
              />
              <Input
                type="number"
                value={betAmount.toFixed(2)}
                onChange={(e) => setBetAmount(parseFloat(e.target.value) || 0)}
                className="w-16 h-8 bg-zinc-800 border-zinc-700 text-center text-sm"
              />
            </div>

            <div className="grid grid-cols-4 gap-2">
              <Button
                variant="destructive"
                onClick={() => sendAction("fold")}
                className="text-sm font-medium active:scale-95 transition-transform"
                data-testid="button-fold"
              >
                {t("fold")}
              </Button>

              {canCheck ? (
                <Button
                  onClick={() => sendAction("check")}
                  className="text-sm font-medium bg-emerald-600 hover:bg-emerald-700 text-white active:scale-95 transition-transform"
                  data-testid="button-check"
                >
                  {t("check")}
                </Button>
              ) : (
                <Button
                  onClick={() => sendAction("call")}
                  className="text-sm font-medium bg-emerald-600 hover:bg-emerald-700 text-white active:scale-95 transition-transform"
                  data-testid="button-call"
                >
                  ${callAmount.toFixed(2)}
                </Button>
              )}

              <Button
                onClick={() => sendAction(gameState?.currentBet === 0 ? "bet" : "raise", betAmount)}
                className="text-sm font-medium bg-cyan-600 hover:bg-cyan-700 active:scale-95 transition-transform"
                data-testid="button-raise"
              >
                {gameState?.currentBet === 0 ? t("bet") : t("raise")}
              </Button>

              <Button
                onClick={() => sendAction("all_in")}
                className="text-sm font-bold bg-amber-500 hover:bg-amber-600 text-black active:scale-95 transition-transform"
                data-testid="button-allin"
              >
                ALL-IN
              </Button>
            </div>
          </div>
        )}

        {mySeat === null && (
          <div className="px-3 py-2 text-center">
            <span className="text-zinc-500 text-sm">{t("clickEmptySeat")}</span>
          </div>
        )}

        {mySeat !== null && !isMyTurn && (
          <div className="px-3 py-2 space-y-2">
            {/* Hand Strength Label when waiting */}
            {myPlayer?.handStrength && (
              <div className="text-center">
                <span className="px-3 py-1 bg-cyan-500/20 border border-cyan-500/50 rounded-full text-sm text-cyan-400 font-medium">
                  {myPlayer.handStrength}
                </span>
              </div>
            )}
            <div className="flex items-center justify-between">
              <span className="text-zinc-400 text-sm">
                {t("yourStack")}: ${chipStack.toFixed(2)}
                {myPlayer?.isSittingOut && <span className="ml-2 text-yellow-500">({t("skipping")})</span>}
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => {
                    toggleSound();
                    doHaptic("light");
                  }}
                  className="w-8 h-8"
                  data-testid="button-sound-bottom"
                >
                  {settings.soundEnabled ? (
                    <Volume2 className="w-4 h-4 text-cyan-400" />
                  ) : (
                    <VolumeX className="w-4 h-4 text-slate-500" />
                  )}
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                  className="w-8 h-8 text-yellow-400 border-yellow-400/50 hover:bg-yellow-500/10"
                  data-testid="button-emoji"
                >
                  <Smile className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
        )}
        
        {/* Stand Up / Sit Out buttons - fixed bottom left */}
        {mySeat !== null && !isMyTurn && (
          <div className="fixed bottom-20 left-2 z-40 flex flex-col gap-1.5">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
                  wsRef.current.send(JSON.stringify({
                    type: "sit_out",
                    tableId,
                    seatNumber: mySeat,
                    sitOut: !myPlayer?.isSittingOut
                  }));
                  doHaptic("light");
                }
              }}
              className={`text-xs ${myPlayer?.isSittingOut 
                ? "text-cyan-400 border-cyan-400/50 hover:bg-cyan-500/10 bg-cyan-500/10" 
                : "text-yellow-400 border-yellow-400/50 hover:bg-yellow-500/10 bg-yellow-500/10"}`}
              data-testid="button-sit-out"
            >
              {myPlayer?.isSittingOut ? t("returnToGame") : t("skipHand")}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleStandUp}
              className="text-xs text-red-400 border-red-400/50 hover:bg-red-500/10 bg-red-500/10"
              data-testid="button-stand-up"
            >
              {t("standUp")}
            </Button>
          </div>
        )}

        {/* Emoji Picker - Positioned above controls */}
        <AnimatePresence>
          {showEmojiPicker && mySeat !== null && (
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.9 }}
              className="fixed bottom-36 right-2 bg-zinc-800/95 backdrop-blur-sm rounded-xl p-2 border border-zinc-700 shadow-xl z-50"
            >
              <div className="grid grid-cols-4 gap-1 max-w-[200px]">
                {POKER_REACTIONS.map((reaction) => {
                  const IconComponent = reaction.icon;
                  return (
                    <button
                      key={reaction.id}
                      onClick={() => sendReaction(reaction.id)}
                      disabled={reactionCooldown}
                      className={`w-11 h-11 flex items-center justify-center hover:bg-zinc-700 rounded-lg transition-all active:scale-90 ${reactionCooldown ? "opacity-50" : ""}`}
                      data-testid={`reaction-${reaction.id}`}
                      title={t(reaction.labelKey)}
                    >
                      <IconComponent className={`w-6 h-6 ${reaction.color}`} />
                    </button>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>


      {showBuyIn && selectedSeat !== null && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-zinc-900 rounded-xl p-6 w-full max-w-sm space-y-4 border border-zinc-700">
            <h2 className="text-xl font-bold text-white text-center">{t("seat")} #{selectedSeat + 1}</h2>
            <p className="text-zinc-400 text-center text-sm">{t("selectBuyInAmount")}</p>
            
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-zinc-400">{t("min")}: ${minBuyIn.toFixed(2)}</span>
                <span className="text-zinc-400">{t("max")}: ${maxBuyIn.toFixed(2)}</span>
              </div>
              <Slider
                value={[buyInAmount]}
                onValueChange={([v]) => setBuyInAmount(v)}
                min={minBuyIn}
                max={Math.min(maxBuyIn, balance)}
                step={0.01}
              />
              <Input
                type="number"
                value={buyInAmount.toFixed(2)}
                onChange={(e) => setBuyInAmount(parseFloat(e.target.value) || minBuyIn)}
                className="bg-zinc-800 border-zinc-700 text-center text-xl h-12"
              />
            </div>

            <div className="flex gap-3">
              <Button
                variant="secondary"
                onClick={() => { setShowBuyIn(false); setSelectedSeat(null); }}
                className="flex-1 h-11"
              >
                {t("cancel")}
              </Button>
              <Button
                className="flex-1 h-11 bg-cyan-600 hover:bg-cyan-700"
                onClick={handleBuyIn}
                disabled={buyInAmount > balance}
              >
                {t("sit")} ${buyInAmount.toFixed(2)}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Run-It-Twice Voting UI */}
      {gameState?.runItTwice && mySeat !== null && (gameState.runItTwice.isActive || gameState.runItTwice.result) && gameState.runItTwice.votes[mySeat] !== undefined && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <motion.div 
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-zinc-900/95 rounded-xl p-6 w-full max-w-sm space-y-4 border-2 border-cyan-500 shadow-2xl"
          >
            <div className="text-center">
              <h2 className="text-xl font-bold text-white mb-2">{t("runItTwice")}?</h2>
              <p className="text-zinc-400 text-sm">{t("bothAllIn")}</p>
              
              {/* Countdown Timer */}
              <div className="mt-3 flex justify-center">
                <div className="w-16 h-16 rounded-full bg-cyan-500/20 border-2 border-cyan-500 flex items-center justify-center">
                  <span className="text-cyan-400 font-bold text-2xl">
                    {Math.max(0, Math.ceil((gameState.runItTwice.deadline - Date.now()) / 1000))}
                  </span>
                </div>
              </div>
            </div>
            
            {/* Show result if voting completed */}
            {gameState.runItTwice.result ? (
              <div className="text-center py-4 space-y-3">
                <div className="text-center py-2 bg-yellow-500/20 rounded-lg">
                  <p className="text-yellow-400 font-bold text-lg">
                    {gameState.runItTwice.result === 2 ? t("playingTwoBoards") : t("playingOneBoard")}
                  </p>
                </div>
                <p className="text-zinc-400 text-sm">{t("dealingCards")}</p>
              </div>
            ) : gameState.runItTwice.votes[mySeat] === null ? (
              <div className="flex gap-3">
                <Button
                  className="flex-1 h-14 bg-blue-600 hover:bg-blue-700 text-lg font-bold"
                  onClick={() => {
                    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
                      wsRef.current.send(JSON.stringify({
                        type: "run_it_twice_vote",
                        tableId,
                        seatNumber: mySeat,
                        choice: 1
                      }));
                      doHaptic("medium");
                    }
                  }}
                  data-testid="button-run-it-once"
                >
                  1 {t("board")}
                </Button>
                <Button
                  className="flex-1 h-14 bg-green-600 hover:bg-green-700 text-lg font-bold"
                  onClick={() => {
                    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
                      wsRef.current.send(JSON.stringify({
                        type: "run_it_twice_vote",
                        tableId,
                        seatNumber: mySeat,
                        choice: 2
                      }));
                      doHaptic("medium");
                    }
                  }}
                  data-testid="button-run-it-twice"
                >
                  2 {t("boards")}
                </Button>
              </div>
            ) : (
              <div className="text-center py-4">
                <p className="text-green-400 font-medium">
                  {t("youSelected")}: {gameState.runItTwice.votes[mySeat]} {gameState.runItTwice.votes[mySeat] === 2 ? t("boards") : t("board")}
                </p>
                <p className="text-zinc-400 text-sm mt-2">{t("waitingForOpponent")}</p>
              </div>
            )}
          </motion.div>
        </div>
      )}

      {/* Showdown Winner Display - Compact with close button */}
      {gameState?.status === "showdown" && gameState.winners && gameState.winners.length > 0 && showWinnerWindow && (
        <div className="fixed top-[15%] left-1/2 -translate-x-1/2 z-50 p-2 max-w-xs w-full pointer-events-auto">
          <motion.div 
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-black/70 backdrop-blur-sm rounded-lg p-3 border border-yellow-500/70 shadow-xl relative"
          >
            {/* Close button */}
            <button
              onClick={() => setShowWinnerWindow(false)}
              className="absolute top-1 right-1 w-6 h-6 rounded-full bg-zinc-700/80 hover:bg-zinc-600 flex items-center justify-center text-zinc-300 hover:text-white transition-colors z-10"
              data-testid="button-close-winner"
            >
              <X className="w-4 h-4" />
            </button>
            
            <div className="text-center space-y-2">
              {/* Check if we ran it twice */}
              {gameState.communityCards2 && gameState.winners2 ? (
                <>
                  {/* Board 1 */}
                  <div className="border-b border-zinc-600 pb-3">
                    <div className="text-cyan-400 font-bold text-sm mb-2">{t("board")} 1</div>
                    <div className="flex gap-1 justify-center mb-2">
                      {gameState.communityCards.map((card, i) => (
                        <PlayingCard key={i} card={card} size="md" />
                      ))}
                    </div>
                    {gameState.winners.map((winner, idx) => (
                      <div key={idx} className="space-y-1">
                        <div className="text-white font-bold text-sm">{winner.username}</div>
                        <div className="text-cyan-400 font-medium text-xs">{winner.handDescription}</div>
                        <div className="text-yellow-400 text-lg font-bold">+${winner.amountWon.toFixed(2)}</div>
                      </div>
                    ))}
                  </div>
                  
                  {/* Board 2 */}
                  <div className="pt-2">
                    <div className="text-purple-400 font-bold text-sm mb-2">{t("board")} 2</div>
                    <div className="flex gap-1 justify-center mb-2">
                      {gameState.communityCards2.map((card, i) => (
                        <PlayingCard key={i} card={card} size="md" />
                      ))}
                    </div>
                    {gameState.winners2.map((winner, idx) => (
                      <div key={idx} className="space-y-1">
                        <div className="text-white font-bold text-sm">{winner.username}</div>
                        <div className="text-purple-400 font-medium text-xs">{winner.handDescription}</div>
                        <div className="text-yellow-400 text-lg font-bold">+${winner.amountWon.toFixed(2)}</div>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <>
                  <div className="text-yellow-400 font-bold text-lg">
                    {gameState.winners.length > 1 ? t("winners") : t("winner")}
                  </div>
                  
                  {/* Display all winners */}
                  {gameState.winners.map((winner, idx) => (
                    <div key={idx} className={`space-y-1 ${idx > 0 ? "pt-2 border-t border-zinc-700" : ""}`}>
                      <div className="text-white font-bold text-sm">{winner.username}</div>
                      <div className="flex gap-1 justify-center">
                        {winner.holeCards.map((card, i) => (
                          <PlayingCard key={i} card={card} size="md" />
                        ))}
                      </div>
                      <div className="text-cyan-400 font-medium text-xs">{winner.handDescription}</div>
                      <div className="text-yellow-400 text-lg font-bold">+${winner.amountWon.toFixed(2)}</div>
                    </div>
                  ))}
                </>
              )}
              
              {/* Reveal button for folded players */}
              {myPlayer?.isFolded && mySeat !== null && !gameState.revealedSeats?.includes(mySeat) && (
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-2 border-blue-500 text-blue-400 hover:bg-blue-500/20"
                  onClick={() => {
                    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
                      wsRef.current.send(JSON.stringify({
                        type: "reveal_cards",
                        tableId,
                        seatNumber: mySeat
                      }));
                      doHaptic("light");
                    }
                  }}
                  data-testid="button-reveal-cards"
                >
                  {t("showCards")}
                </Button>
              )}
              
              {/* Countdown to next hand - uses server deadline */}
              {gameState.showdownDeadline && (
                <div className="text-zinc-400 text-xs mt-2">
                  {t("nextHandIn")} {Math.max(0, Math.ceil((gameState.showdownDeadline - Date.now()) / 1000))}{t("seconds")}
                </div>
              )}
            </div>
          </motion.div>
        </div>
      )}

      {showRebuy && mySeat !== null && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-zinc-900 rounded-xl p-6 w-full max-w-sm space-y-4 border border-red-700">
            <div className="text-center">
              <h2 className="text-xl font-bold text-white">{t("rebuy")}</h2>
              <p className="text-zinc-400 text-sm mt-1">{t("yourStack")}: ${chipStack.toFixed(2)}</p>
              <p className="text-cyan-400 text-xs">{t("tableLimit")}: ${maxBuyIn.toFixed(2)}</p>
              {kickCountdown !== null && (
                <div className="mt-2 flex items-center justify-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-red-500/20 border border-red-500 flex items-center justify-center">
                    <span className="text-red-400 font-bold">{kickCountdown}</span>
                  </div>
                  <span className="text-red-400 text-sm">{t("secondsUntilRemoval")}</span>
                </div>
              )}
            </div>
            
            {/* Calculate max rebuy - cannot exceed table limit */}
            {(() => {
              const maxRebuy = Math.max(0, maxBuyIn - chipStack);
              const effectiveMax = Math.min(maxRebuy, balance);
              const canRebuy = effectiveMax >= minBuyIn;
              
              return canRebuy ? (
                <div className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-zinc-400">{t("min")}: ${minBuyIn.toFixed(2)}</span>
                    <span className="text-zinc-400">{t("max")}: ${effectiveMax.toFixed(2)}</span>
                  </div>
                  <Slider
                    value={[Math.min(rebuyAmount, effectiveMax)]}
                    onValueChange={([v]) => setRebuyAmount(v)}
                    min={minBuyIn}
                    max={effectiveMax}
                    step={0.01}
                  />
                  <Input
                    type="number"
                    value={rebuyAmount.toFixed(2)}
                    onChange={(e) => setRebuyAmount(Math.min(parseFloat(e.target.value) || minBuyIn, effectiveMax))}
                    className="bg-zinc-800 border-zinc-700 text-center text-xl h-12"
                  />
                </div>
              ) : (
                <div className="text-center py-4">
                  <p className="text-red-400">
                    {chipStack >= maxBuyIn 
                      ? t("stackAtMax") 
                      : t("insufficientForRebuy")}
                  </p>
                </div>
              );
            })()}

            <div className="flex gap-3">
              <Button
                variant="secondary"
                onClick={() => {
                  setShowRebuy(false);
                  setKickCountdown(null);
                }}
                className="flex-1 h-11"
              >
                {t("leave")}
              </Button>
              <Button
                className="flex-1 h-11 bg-cyan-600 hover:bg-cyan-700"
                onClick={handleRebuy}
                disabled={rebuyAmount > balance || chipStack >= maxBuyIn || rebuyAmount > (maxBuyIn - chipStack)}
                data-testid="button-rebuy"
              >
                {t("rebuy")} ${rebuyAmount.toFixed(2)}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Side Menu - optimized for performance */}
      <AnimatePresence mode="sync">
        {showSideMenu && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="fixed inset-0 bg-black/60 z-50"
              onClick={() => setShowSideMenu(false)}
            />
            <motion.div
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="fixed left-0 top-0 bottom-0 w-72 bg-gradient-to-b from-slate-900 to-slate-950 z-50 shadow-2xl border-r border-slate-700/50"
            >
              <div className="p-4 border-b border-slate-700/50 flex items-center justify-between">
                <span className="text-white font-bold text-lg">{t("menu")}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setShowSideMenu(false)}
                  className="w-8 h-8"
                  data-testid="button-close-menu"
                >
                  <X className="w-5 h-5" />
                </Button>
              </div>
              
              <div className="p-2 space-y-1">
                {mySeat !== null && (
                  <>
                    <button
                      className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left text-white hover:bg-slate-800/50 transition-colors"
                      onClick={() => {
                        handleStandUp();
                        setShowSideMenu(false);
                      }}
                      data-testid="menu-stand-up"
                    >
                      <LogOut className="w-5 h-5 text-red-400" />
                      <span>{t("standUp")}</span>
                    </button>
                    
                    <button
                      className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left text-white hover:bg-slate-800/50 transition-colors"
                      onClick={() => {
                        setShowRebuy(true);
                        setRebuyAmount(minBuyIn);
                        setShowSideMenu(false);
                      }}
                      data-testid="menu-add-chips"
                    >
                      <DollarSign className="w-5 h-5 text-green-400" />
                      <span>{t("addChipsToTable")}</span>
                    </button>
                  </>
                )}
                
                <button
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left text-white hover:bg-slate-800/50 transition-colors"
                  onClick={() => {
                    setShowTableInfo(true);
                    setShowSideMenu(false);
                  }}
                  data-testid="menu-table-info"
                >
                  <Info className="w-5 h-5 text-cyan-400" />
                  <span>{t("tableInfo")}</span>
                </button>
                
                <button
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left text-white hover:bg-slate-800/50 transition-colors"
                  onClick={() => {
                    setShowSettings(true);
                    setShowSideMenu(false);
                  }}
                  data-testid="menu-settings"
                >
                  <Settings className="w-5 h-5 text-slate-400" />
                  <span>{t("settings")}</span>
                </button>
                
                <div className="border-t border-slate-700/50 my-2" />
                
                <button
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left text-white hover:bg-slate-800/50 transition-colors"
                  onClick={() => {
                    handleBack();
                    setShowSideMenu(false);
                  }}
                  data-testid="menu-lobby"
                >
                  <Home className="w-5 h-5 text-purple-400" />
                  <span>{t("toLobby")}</span>
                </button>
                
                <button
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left text-white hover:bg-slate-800/50 transition-colors"
                  onClick={() => {
                    // Share placeholder
                    if (navigator.share) {
                      navigator.share({
                        title: "Papa Poker",
                        text: `${t("joinTable")} ${tableName}!`,
                        url: window.location.href,
                      });
                    } else {
                      toast({ title: t("linkCopied") });
                    }
                    setShowSideMenu(false);
                  }}
                  data-testid="menu-share"
                >
                  <Share2 className="w-5 h-5 text-yellow-400" />
                  <span>{t("share")}</span>
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Table Info Panel */}
      <AnimatePresence>
        {showTableInfo && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 z-50"
              onClick={() => setShowTableInfo(false)}
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 max-w-[90vw] bg-gradient-to-b from-slate-900 to-slate-950 rounded-2xl z-50 shadow-2xl border border-slate-700/50 overflow-hidden"
            >
              <div className="bg-gradient-to-r from-cyan-600 to-blue-600 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-white font-bold text-lg">{tableName}</h2>
                    <span className="text-cyan-200 text-sm">{t("holdem")} • {t("noLimit")}</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setShowTableInfo(false)}
                    className="w-8 h-8 text-white hover:bg-white/20"
                    data-testid="button-close-info"
                  >
                    <X className="w-5 h-5" />
                  </Button>
                </div>
              </div>
              
              <div className="p-4 space-y-3">
                <div className="flex justify-between py-2 border-b border-slate-700/30">
                  <span className="text-slate-400">{t("blinds")}</span>
                  <span className="text-white font-medium">${smallBlind}/${bigBlind}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-slate-700/30">
                  <span className="text-slate-400">{t("minBuyIn")}</span>
                  <span className="text-white font-medium">${minBuyIn.toFixed(2)}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-slate-700/30">
                  <span className="text-slate-400">{t("maxBuyIn")}</span>
                  <span className="text-white font-medium">${maxBuyIn.toFixed(2)}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-slate-700/30">
                  <span className="text-slate-400">{t("seatsAtTable")}</span>
                  <span className="text-white font-medium">{maxSeats}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-slate-700/30">
                  <span className="text-slate-400">{t("actionTime")}</span>
                  <span className="text-white font-medium">{gameState?.timeBank || 30}{t("seconds")}</span>
                </div>
                <div className="flex justify-between py-2">
                  <span className="text-slate-400">{t("playersNow")}</span>
                  <span className="text-cyan-400 font-medium">{playersCount}/{maxSeats}</span>
                </div>
              </div>
              
              <div className="p-4 bg-slate-800/50">
                <Button
                  className="w-full bg-cyan-600 hover:bg-cyan-700"
                  onClick={() => setShowTableInfo(false)}
                >
                  {t("close")}
                </Button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Settings Panel */}
      <AnimatePresence>
        {showSettings && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 z-50"
              onClick={() => setShowSettings(false)}
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 max-w-[90vw] bg-gradient-to-b from-slate-900 to-slate-950 rounded-2xl z-50 shadow-2xl border border-slate-700/50 overflow-hidden"
            >
              <div className="bg-gradient-to-r from-slate-600 to-slate-700 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-white font-bold text-lg">{t("settings")}</h2>
                    <span className="text-slate-300 text-sm">{t("soundAndVibration")}</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="w-8 h-8 text-white hover:bg-white/10"
                    onClick={() => setShowSettings(false)}
                  >
                    <X className="w-5 h-5" />
                  </Button>
                </div>
              </div>
              
              <div className="p-4 space-y-4">
                <div className="flex items-center justify-between py-2">
                  <div className="flex items-center gap-3">
                    {settings.soundEnabled ? (
                      <Volume2 className="w-5 h-5 text-green-400" />
                    ) : (
                      <VolumeX className="w-5 h-5 text-red-400" />
                    )}
                    <span className="text-white">{t("gameSounds")}</span>
                  </div>
                  <button
                    onClick={toggleSound}
                    className={`relative w-12 h-7 rounded-full transition-colors ${
                      settings.soundEnabled ? "bg-green-500" : "bg-slate-600"
                    }`}
                    data-testid="toggle-sound"
                  >
                    <span
                      className={`absolute top-1 w-5 h-5 rounded-full bg-white shadow transition-transform ${
                        settings.soundEnabled ? "left-6" : "left-1"
                      }`}
                    />
                  </button>
                </div>
                
                <div className="flex items-center justify-between py-2">
                  <div className="flex items-center gap-3">
                    <Zap className={`w-5 h-5 ${vibrationEnabled ? "text-cyan-400" : "text-slate-500"}`} />
                    <span className="text-white">{t("vibration")}</span>
                  </div>
                  <button
                    onClick={() => setVibrationEnabled(!vibrationEnabled)}
                    className={`relative w-12 h-7 rounded-full transition-colors ${
                      vibrationEnabled ? "bg-cyan-500" : "bg-slate-600"
                    }`}
                    data-testid="toggle-vibration"
                  >
                    <span
                      className={`absolute top-1 w-5 h-5 rounded-full bg-white shadow transition-transform ${
                        vibrationEnabled ? "left-6" : "left-1"
                      }`}
                    />
                  </button>
                </div>
                
                <div className="border-t border-slate-700/50 pt-4">
                  <p className="text-slate-400 text-xs text-center">
                    {t("pokerSoundsOnlyNote")}
                  </p>
                </div>
              </div>
              
              <div className="p-4 bg-slate-800/50">
                <Button
                  className="w-full bg-slate-600 hover:bg-slate-700"
                  onClick={() => setShowSettings(false)}
                >
                  {t("done")}
                </Button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
