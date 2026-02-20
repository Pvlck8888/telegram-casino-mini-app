import { useState, useRef, useEffect, useCallback } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { GameHeader } from "@/components/GameHeader";
import { useTelegram } from "@/components/TelegramProvider";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAudio } from "@/components/AudioProvider";
import { Minus, Plus, Zap, RotateCcw, Menu, Info, Home, Volume2, Music, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

import diamondSuitImg from "@assets/generated_images/diamond_suit_gold_frame.png";
import clubSuitImg from "@assets/generated_images/club_suit_gold_frame.png";
import spadeSuitImg from "@assets/generated_images/spade_suit_gold_frame.png";
import heartSuitImg from "@assets/generated_images/heart_suit_gold_frame.png";
import diceImg from "@assets/generated_images/luxury_dark_dice_gold.png";
import chipsImg from "@assets/generated_images/dark_poker_chips_gold.png";
import cardsImg from "@assets/generated_images/black_gold_playing_cards.png";
import crownImg from "@assets/generated_images/golden_royal_crown.png";
import gemImg from "@assets/generated_images/golden_diamond_gemstone.png";
import wildImg from "@assets/generated_images/wild_w_symbol_gold.png";
import fsScatterImg from "@assets/generated_images/blue_fs_scatter_symbol.png";

const SYMBOL_IMAGES: Record<string, string> = {
  diamond_suit: diamondSuitImg,
  club_suit: clubSuitImg,
  spade_suit: spadeSuitImg,
  heart_suit: heartSuitImg,
  dice: diceImg,
  chips: chipsImg,
  cards: cardsImg,
  crown: crownImg,
  gem: gemImg,
  wild: wildImg,
  scatter: fsScatterImg,
};

interface TheLuxeGameProps {
  balance: number;
  onBalanceChange: (newBalance: number) => void;
  onBack: () => void;
}

const REEL_COUNT = 5;
const ROWS = 4;

const SYMBOLS = [
  { id: "diamond_suit", name: "Diamond", payout: [0, 0, 1.4, 3.5, 7] },
  { id: "club_suit", name: "Club", payout: [0, 0, 1.4, 3.5, 7] },
  { id: "spade_suit", name: "Spade", payout: [0, 0, 1.4, 3.5, 7] },
  { id: "heart_suit", name: "Heart", payout: [0, 0, 1.4, 3.5, 7] },
  { id: "dice", name: "Dice", payout: [0, 0, 3.5, 14, 35] },
  { id: "chips", name: "Chips", payout: [0, 0, 7, 35, 105] },
  { id: "cards", name: "Cards", payout: [0, 0, 14, 70, 175] },
  { id: "crown", name: "Crown", payout: [0, 0, 70, 210, 700] },
  { id: "gem", name: "Diamond Gem", payout: [0, 0, 140, 350, 1400] },
  { id: "wild", name: "Wild", payout: [0, 0, 140, 350, 1400], isWild: true },
  { id: "scatter", name: "Free Spins", payout: [0, 0, 0, 0, 0], isScatter: true },
];

type BonusMode = "none" | "black_and_gold" | "golden_hits" | "velvet_nights";

interface BonusState {
  mode: BonusMode;
  spinsRemaining: number;
  totalWin: number;
  stickyFrames: { row: number; col: number; type: "multiplier" | "jackpot"; value: number }[];
}

const MULTIPLIERS = [2, 3, 4, 5, 6, 7, 8, 9, 10, 25, 50, 100];
const JACKPOTS = [
  { name: "MINI", value: 25, color: "#888888" },
  { name: "MAJOR", value: 100, color: "#D4AF37" },
  { name: "MEGA", value: 500, color: "#FFD700" },
  { name: "MAXWIN", value: 20000, color: "#FFD700" },
];

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

const BET_AMOUNTS = [0.10, 0.20, 0.50, 1.00, 2.00, 5.00, 7.00, 10.00, 20.00, 50.00, 100.00];

interface GridCell {
  symbolIndex: number;
  hasFrame: boolean;
  frameType: "multiplier" | "jackpot" | null;
  frameValue: number;
  jackpotIndex: number;
}

const SCATTER_INDEX = 10;
const WILD_INDEX = 9;

const generateRandomGrid = (bonusMode: BonusMode = "none"): GridCell[][] => {
  const grid: GridCell[][] = [];
  const REGULAR_SYMBOL_COUNT = 9;
  
  for (let row = 0; row < ROWS; row++) {
    const rowData: GridCell[] = [];
    for (let col = 0; col < REEL_COUNT; col++) {
      let symbolIndex: number;
      const rand = Math.random();
      
      if (bonusMode === "velvet_nights") {
        if (rand < 0.03) {
          symbolIndex = WILD_INDEX;
        } else {
          symbolIndex = Math.floor(Math.random() * REGULAR_SYMBOL_COUNT);
        }
      } else {
        if (rand < 0.02) {
          symbolIndex = SCATTER_INDEX;
        } else if (rand < 0.05) {
          symbolIndex = WILD_INDEX;
        } else {
          symbolIndex = Math.floor(Math.random() * REGULAR_SYMBOL_COUNT);
        }
      }
      
      const hasFrame = bonusMode === "velvet_nights" ? true : Math.random() < 0.12;
      let frameType: "multiplier" | "jackpot" | null = null;
      let frameValue = 0;
      let jackpotIndex = -1;
      
      if (hasFrame) {
        if (Math.random() < 0.90) {
          frameType = "multiplier";
          // Multipliers above 10x (25x, 50x, 100x at indices 9,10,11) only during bonus spins
          // Base game: indices 0-8 (values 2,3,4,5,6,7,8,9,10)
          // Bonus: all indices 0-11 (values 2-100)
          const multiplierPool = bonusMode !== "none" 
            ? MULTIPLIERS  // All multipliers during bonus
            : MULTIPLIERS.slice(0, 9); // Only 2-10x during base game
          frameValue = multiplierPool[Math.floor(Math.random() * multiplierPool.length)];
        } else {
          frameType = "jackpot";
          jackpotIndex = Math.floor(Math.random() * JACKPOTS.length);
          frameValue = JACKPOTS[jackpotIndex].value;
        }
      }
      
      rowData.push({ symbolIndex, hasFrame, frameType, frameValue, jackpotIndex });
    }
    grid.push(rowData);
  }
  return grid;
};

const SymbolIcon = ({ symbolId, size = 48 }: { symbolId: string; size?: number; hasFrame?: boolean }) => {
  const imageSrc = SYMBOL_IMAGES[symbolId];
  
  if (imageSrc) {
    return (
      <img 
        src={imageSrc} 
        alt={symbolId} 
        style={{ 
          width: size, 
          height: size, 
          objectFit: "contain",
          imageRendering: "crisp-edges"
        }} 
      />
    );
  }
  
  return (
    <div 
      style={{ 
        width: size, 
        height: size, 
        backgroundColor: "#1a1a1a", 
        border: "1px solid #B8860B",
        borderRadius: 4 
      }} 
    />
  );
};

export function TheLuxeGame({ balance, onBalanceChange, onBack }: TheLuxeGameProps) {
  const { hapticFeedback, user } = useTelegram();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { setCurrentGame, playSound } = useAudio();
  
  const [grid, setGrid] = useState<GridCell[][]>(generateRandomGrid);
  const [displayGrid, setDisplayGrid] = useState<GridCell[][]>(generateRandomGrid);
  const [isSpinning, setIsSpinning] = useState(false);
  const [reelSpinning, setReelSpinning] = useState<boolean[]>([false, false, false, false, false]);
  const [winningCells, setWinningCells] = useState<Set<string>>(new Set());
  const [winAmount, setWinAmount] = useState(0);
  const [totalWin, setTotalWin] = useState(0);
  const [betIndex, setBetIndex] = useState(0);
  const [showBigWin, setShowBigWin] = useState(false);
  const [bigWinType, setBigWinType] = useState<string>("");
  const [turboMode, setTurboMode] = useState(false);
  const [superTurbo, setSuperTurbo] = useState(false);
  const [autoPlay, setAutoPlay] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [freeSpins, setFreeSpins] = useState(0);
  const [bonusState, setBonusState] = useState<BonusState>({
    mode: "none",
    spinsRemaining: 0,
    totalWin: 0,
    stickyFrames: [],
  });
  const [showBonusIntro, setShowBonusIntro] = useState(false);
  const [bonusIntroText, setBonusIntroText] = useState("");
  const [bonusBetAmount, setBonusBetAmount] = useState(0);
  const [startBonusSpin, setStartBonusSpin] = useState(false);
  const [bonusCountdown, setBonusCountdown] = useState(0);
  const [showInfo, setShowInfo] = useState(false);
  const [winningSymbolName, setWinningSymbolName] = useState<string>("");
  const [showBonusBuy, setShowBonusBuy] = useState(false);
  const [selectedSymbol, setSelectedSymbol] = useState<{ index: number; name: string; payouts: number[] } | null>(null);
  
  const autoPlayRef = useRef(false);
  const betIndexRef = useRef(betIndex);
  const spinTimeouts = useRef<NodeJS.Timeout[]>([]);
  const animationInterval = useRef<NodeJS.Timeout | null>(null);
  const bonusTotalWinRef = useRef(0);
  const isPageVisibleRef = useRef(true);
  const waitingForResumeRef = useRef(false);
  const [waitingForResume, setWaitingForResume] = useState(false);

  useEffect(() => {
    waitingForResumeRef.current = waitingForResume;
  }, [waitingForResume]);

  const currentBet = BET_AMOUNTS[betIndex];

  useEffect(() => {
    const handleVisibilityChange = () => {
      const isVisible = document.visibilityState === "visible";
      isPageVisibleRef.current = isVisible;
      
      if (!isVisible && bonusState.mode !== "none" && bonusState.spinsRemaining > 0) {
        waitingForResumeRef.current = true;
        setWaitingForResume(true);
        localStorage.setItem("luxe_bonus_state", JSON.stringify({
          bonusState,
          bonusBetAmount,
          bonusTotalWin: bonusTotalWinRef.current,
        }));
      }
    };
    
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [bonusState, bonusBetAmount]);

  useEffect(() => {
    const savedState = localStorage.getItem("luxe_bonus_state");
    if (savedState) {
      try {
        const { bonusState: saved, bonusBetAmount: savedBet, bonusTotalWin } = JSON.parse(savedState);
        if (saved && saved.mode !== "none" && saved.spinsRemaining > 0) {
          setBonusState(saved);
          setBonusBetAmount(savedBet);
          bonusTotalWinRef.current = bonusTotalWin || 0;
          setFreeSpins(saved.spinsRemaining);
          setWaitingForResume(true);
        }
        localStorage.removeItem("luxe_bonus_state");
      } catch (e) {
        localStorage.removeItem("luxe_bonus_state");
      }
    }
  }, []);

  useEffect(() => {
    setCurrentGame("luxe");
    return () => {
      spinTimeouts.current.forEach(clearTimeout);
      if (animationInterval.current) clearInterval(animationInterval.current);
      autoPlayRef.current = false;
    };
  }, [setCurrentGame]);

  useEffect(() => {
    autoPlayRef.current = autoPlay;
  }, [autoPlay]);

  useEffect(() => {
    betIndexRef.current = betIndex;
  }, [betIndex]);

  useEffect(() => {
    if (startBonusSpin && bonusState.mode !== "none" && bonusState.spinsRemaining > 0 && bonusBetAmount > 0) {
      setStartBonusSpin(false);
      setTimeout(() => {
        spinMutation.mutate(bonusBetAmount);
      }, 500);
    }
  }, [startBonusSpin, bonusState.mode, bonusState.spinsRemaining, bonusBetAmount]);

  useEffect(() => {
    if (showBonusIntro) {
      setBonusCountdown(5);
      const interval = setInterval(() => {
        setBonusCountdown(prev => {
          if (prev <= 1) {
            clearInterval(interval);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [showBonusIntro]);

  const animateReels = useCallback((finalGrid: GridCell[][], onComplete: () => void) => {
    // Track which columns have stopped spinning
    const stoppedColumns = new Set<number>();
    
    setReelSpinning([true, true, true, true, true]);
    // Start with the final grid values for display (they will be obscured by animation)
    setDisplayGrid(finalGrid);
    
    const spinSpeed = superTurbo ? 30 : turboMode ? 50 : 70;
    animationInterval.current = setInterval(() => {
      setDisplayGrid(prev => {
        const newGrid = prev.map(row => [...row]);
        // Only randomize columns that are still spinning
        for (let col = 0; col < REEL_COUNT; col++) {
          if (!stoppedColumns.has(col)) {
            for (let row = 0; row < ROWS; row++) {
              newGrid[row][col] = {
                symbolIndex: Math.floor(Math.random() * 10),
                hasFrame: Math.random() < 0.3,
                frameType: Math.random() < 0.5 ? "multiplier" : null,
                frameValue: Math.random() < 0.5 ? Math.floor(Math.random() * 10) + 2 : 0,
                jackpotIndex: -1,
              };
            }
          }
        }
        return newGrid;
      });
    }, spinSpeed);

    const baseDelay = superTurbo ? 150 : turboMode ? 300 : 500;
    const reelDelay = superTurbo ? 50 : turboMode ? 100 : 150;

    for (let i = 0; i < REEL_COUNT; i++) {
      const delay = baseDelay + i * reelDelay;
      spinTimeouts.current[i] = setTimeout(() => {
        // Mark this column as stopped
        stoppedColumns.add(i);
        
        setReelSpinning(prev => {
          const newState = [...prev];
          newState[i] = false;
          return newState;
        });
        
        // Set final values for this column
        setDisplayGrid(prev => {
          const newGrid = prev.map(row => [...row]);
          for (let row = 0; row < ROWS; row++) {
            newGrid[row][i] = finalGrid[row][i];
          }
          return newGrid;
        });
        
        hapticFeedback("light");
        playSound("luxeReelStop");
        
        if (i === REEL_COUNT - 1) {
          if (animationInterval.current) {
            clearInterval(animationInterval.current);
          }
          setTimeout(onComplete, 50);
        }
      }, delay);
    }
  }, [hapticFeedback, turboMode, superTurbo, playSound]);

  const spinMutation = useMutation({
    mutationFn: async (betAmount: number) => {
      setWinAmount(0);
      setWinningCells(new Set());
      setShowBigWin(false);
      setIsSpinning(true);
      
      const isBonusSpin = bonusState.mode !== "none" && bonusState.spinsRemaining > 0;
      
      const response = await apiRequest("POST", "/api/games/luxe/spin", {
        userId: user?.id || "demo",
        amount: betAmount,
        isBonusSpin,
        stickyFrames: isBonusSpin ? bonusState.stickyFrames : [],
      });
      
      return { ...await response.json(), betAmount, wasBonusSpin: isBonusSpin };
    },
    onSuccess: async (data) => {
      playSound("luxeSpin");
      
      const finalGrid = data.grid || generateRandomGrid();
      setGrid(finalGrid);
      
      animateReels(finalGrid, () => {
        setIsSpinning(false);
        
        const payout = data.payout || 0;
        const winCells = new Set<string>(data.winningCells || []);
        
        setWinningCells(winCells);
        setWinAmount(payout);
        if (payout > 0) {
          setTotalWin(prev => prev + payout);
          if (data.winningPaylines && data.winningPaylines.length > 0) {
            const topWin = data.winningPaylines.sort((a: any, b: any) => b.payout - a.payout)[0];
            const symbol = SYMBOLS[topWin.symbolIndex];
            setWinningSymbolName(`${topWin.matchCount}x ${symbol.name} - $${topWin.payout.toFixed(2)}`);
          } else {
            setWinningSymbolName("");
          }
        } else {
          setWinningSymbolName("");
        }
        
        if (data.newBalance !== undefined) {
          onBalanceChange(data.newBalance);
        }
        
        if (data.bonusTrigger && data.freeSpinsAwarded > 0) {
          bonusTotalWinRef.current = 0;
          setBonusState({
            mode: data.bonusTrigger as BonusMode,
            spinsRemaining: data.freeSpinsAwarded,
            totalWin: 0,
            stickyFrames: data.initialStickyFrames || [],
          });
          setFreeSpins(data.freeSpinsAwarded);
          setBonusBetAmount(data.betAmount);
          setShowBonusIntro(true);
          
          hapticFeedback("heavy");
          playSound("luxeBonus");
          
          return;
        }
        
        if (data.wasBonusSpin) {
          bonusTotalWinRef.current += payout;
          const newTotalWin = bonusTotalWinRef.current;
          const newSpinsRemaining = bonusState.spinsRemaining - 1;
          
          let extraSpins = 0;
          if (data.scatterCount >= 3) {
            extraSpins = 4;
          } else if (data.scatterCount >= 2) {
            extraSpins = 2;
          }
          
          if (extraSpins > 0) {
            toast({
              title: `+${extraSpins} FREE SPINS!`,
              description: "Scatter retrigger",
            });
          }
          
          const finalSpinsRemaining = newSpinsRemaining + extraSpins;
          
          // Use updated sticky frames from server for super bonus frame doubling
          // If updatedStickyFrames is null/undefined, keep existing frames (no change)
          const newStickyFrames = data.updatedStickyFrames !== null && data.updatedStickyFrames !== undefined
            ? data.updatedStickyFrames
            : bonusState.stickyFrames;
          
          setBonusState(prev => ({
            ...prev,
            spinsRemaining: finalSpinsRemaining,
            totalWin: newTotalWin,
            stickyFrames: newStickyFrames,
          }));
          setFreeSpins(finalSpinsRemaining);
          
          if (finalSpinsRemaining <= 0) {
            setTimeout(() => {
              setBigWinType(`TOTAL WIN: $${newTotalWin.toFixed(2)}`);
              setShowBigWin(true);
              setTimeout(() => {
                setShowBigWin(false);
                bonusTotalWinRef.current = 0;
                setBonusState({
                  mode: "none",
                  spinsRemaining: 0,
                  totalWin: 0,
                  stickyFrames: [],
                });
              }, 3000);
            }, 500);
            return;
          }
        }
        
        if (payout > 0) {
          hapticFeedback("heavy");
          
          const multiplier = payout / data.betAmount;
          // Only show MAX WIN for truly massive wins (5000x or more) or if MAXWIN jackpot was hit
          if (multiplier >= 5000) {
            playSound("luxeJackpot");
            setBigWinType("MAX WIN");
            setShowBigWin(true);
            setTimeout(() => setShowBigWin(false), 4000);
          } else if (multiplier >= 500) {
            playSound("luxeJackpot");
            setBigWinType("MEGA WIN");
            setShowBigWin(true);
            setTimeout(() => setShowBigWin(false), 3000);
          } else if (multiplier >= 50) {
            playSound("luxeBigWin");
            setBigWinType("BIG WIN");
            setShowBigWin(true);
            setTimeout(() => setShowBigWin(false), 2500);
          } else {
            playSound("luxeWin");
          }
        }
        
        queryClient.invalidateQueries({ queryKey: ["/api/users/telegram"] });
        
        if (data.wasBonusSpin && bonusState.spinsRemaining > 1) {
          if (!isPageVisibleRef.current || waitingForResumeRef.current) {
            setWaitingForResume(true);
            return;
          }
          setTimeout(() => {
            if (isPageVisibleRef.current && !waitingForResumeRef.current) {
              spinMutation.mutate(data.betAmount);
            } else {
              setWaitingForResume(true);
            }
          }, superTurbo ? 300 : turboMode ? 600 : 1000);
          return;
        }
        
        if (autoPlayRef.current) {
          const nextBetAmount = BET_AMOUNTS[betIndexRef.current];
          const newBalance = data.newBalance ?? balance;
          if (newBalance >= nextBetAmount) {
            setTimeout(() => {
              if (autoPlayRef.current) {
                spinMutation.mutate(nextBetAmount);
              }
            }, superTurbo ? 300 : turboMode ? 600 : 1000);
          } else {
            setAutoPlay(false);
            toast({
              title: "Autoplay stopped",
              description: "Insufficient balance",
            });
          }
        }
      });
    },
    onError: () => {
      setIsSpinning(false);
      setReelSpinning([false, false, false, false, false]);
      setAutoPlay(false);
      toast({
        title: "Error",
        description: "Spin failed. Try again.",
        variant: "destructive",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/users/telegram"] });
    },
  });

  const spin = (betAmount: number) => {
    if (spinMutation.isPending || isSpinning) return;
    if (balance < betAmount) {
      toast({
        title: "Insufficient balance",
        description: "Not enough funds",
        variant: "destructive"
      });
      setAutoPlay(false);
      return;
    }
    hapticFeedback("medium");
    playSound("luxeCoinDrop");
    spinMutation.mutate(betAmount);
  };

  const bonusBuyMutation = useMutation({
    mutationFn: async ({ bonusType }: { bonusType: "regular" | "super" }) => {
      const response = await apiRequest("POST", "/api/games/luxe/buy-bonus", {
        userId: user?.id || "demo",
        betAmount: currentBet,
        bonusType,
      });
      return response.json();
    },
    onSuccess: (data) => {
      if (data.success) {
        onBalanceChange(data.newBalance);
        setShowBonusBuy(false);
        
        bonusTotalWinRef.current = 0;
        setBonusState({
          mode: data.bonusTrigger as BonusMode,
          spinsRemaining: data.freeSpinsAwarded,
          totalWin: 0,
          stickyFrames: data.initialStickyFrames || [],
        });
        setFreeSpins(data.freeSpinsAwarded);
        setBonusBetAmount(data.betAmount);
        setShowBonusIntro(true);
        
        hapticFeedback("heavy");
        playSound("luxeBonus");
        
        toast({
          title: "Bonus Purchased!",
          description: `${data.freeSpinsAwarded} Free Spins activated`,
        });
      }
    },
    onError: (error: any) => {
      toast({
        title: "Purchase Failed",
        description: error?.message || "Insufficient balance",
        variant: "destructive",
      });
    },
  });

  const buyBonus = (bonusType: "regular" | "super") => {
    const cost = bonusType === "super" ? currentBet * 300 : currentBet * 100;
    if (balance < cost) {
      toast({
        title: "Insufficient balance",
        description: `Need $${cost.toFixed(2)} to buy this bonus`,
        variant: "destructive",
      });
      return;
    }
    hapticFeedback("heavy");
    bonusBuyMutation.mutate({ bonusType });
  };

  return (
    <div 
      className="h-screen flex flex-col overflow-hidden relative"
      style={{ 
        background: '#0a0a0a',
      }}
      data-testid="page-luxe-game"
    >
      <div 
        className="absolute inset-0 pointer-events-none opacity-30"
        style={{
          background: `
            radial-gradient(ellipse at 20% 20%, rgba(212,175,55,0.3) 0%, transparent 50%),
            radial-gradient(ellipse at 80% 80%, rgba(212,175,55,0.2) 0%, transparent 50%),
            radial-gradient(ellipse at 50% 0%, rgba(255,215,0,0.15) 0%, transparent 40%)
          `
        }}
      />
      
      <header className="relative z-10 flex items-center justify-between px-3 py-2 border-b border-[#333]">
        <button 
          onClick={onBack}
          className="text-white/70 hover:text-white text-sm"
          data-testid="button-back"
        >
          ←
        </button>
        <div className="flex-1 flex justify-center">
          <div className="text-center">
            <div 
              className="text-2xl font-serif tracking-wider"
              style={{
                background: 'linear-gradient(180deg, #D4AF37 0%, #FFD700 30%, #B8860B 70%, #D4AF37 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                textShadow: '0 2px 10px rgba(212,175,55,0.5)',
                fontFamily: 'Times New Roman, serif',
              }}
            >
              <span className="text-lg">THE</span>
              <br />
              <span className="text-3xl font-bold tracking-[0.2em]">LUXE</span>
            </div>
          </div>
        </div>
        <div className="w-8" />
      </header>

      <div className="relative z-10 flex justify-around px-2 py-2 bg-gradient-to-b from-[#1a1a1a] to-transparent">
        {JACKPOTS.map((jp) => (
          <div key={jp.name} className="text-center">
            <div 
              className="text-[10px] font-bold tracking-wider"
              style={{ color: jp.color }}
            >
              {jp.name}
            </div>
            <div className="text-white text-xs font-bold">
              ${(jp.value * currentBet).toFixed(0)}
            </div>
          </div>
        ))}
      </div>

      <main className="flex-1 flex flex-col items-center justify-center p-2 relative z-10">
        <div 
          className="relative w-full max-w-md aspect-[5/4] rounded-lg overflow-hidden"
          style={{
            background: 'linear-gradient(180deg, #1a1a1a 0%, #0d0d0d 100%)',
            border: '3px solid',
            borderImage: 'linear-gradient(180deg, #FFD700 0%, #B8860B 50%, #8B7355 100%) 1',
            boxShadow: '0 0 30px rgba(212,175,55,0.2), inset 0 0 50px rgba(0,0,0,0.8)'
          }}
        >
          <div 
            className="absolute inset-0 grid grid-cols-5 gap-1 p-2"
          >
            {[0, 1, 2, 3, 4].map((col) => (
              <div key={col} className="flex flex-col gap-1">
                {[0, 1, 2, 3].map((row) => {
                  const cell = displayGrid[row]?.[col];
                  if (!cell) return null;
                  
                  const symbolData = SYMBOLS[cell.symbolIndex];
                  const isWinning = winningCells.has(`${row}-${col}`) && !isSpinning;
                  
                  return (
                    <motion.div
                      key={`${row}-${col}`}
                      className="relative flex-1 flex items-center justify-center rounded-sm overflow-hidden cursor-pointer"
                      animate={isWinning ? { scale: [1, 1.08, 1] } : {}}
                      transition={{ duration: 0.5, repeat: isWinning ? Infinity : 0 }}
                      onClick={() => {
                        if (!isSpinning && symbolData) {
                          setSelectedSymbol({
                            index: cell.symbolIndex,
                            name: symbolData.name,
                            payouts: symbolData.payout.map(p => p * currentBet)
                          });
                          hapticFeedback("light");
                        }
                      }}
                      style={{
                        background: cell.hasFrame 
                          ? 'linear-gradient(135deg, rgba(212,175,55,0.15) 0%, rgba(139,115,85,0.1) 100%)'
                          : 'linear-gradient(180deg, rgba(30,30,30,0.9) 0%, rgba(20,20,20,0.95) 100%)',
                        border: cell.hasFrame 
                          ? '2px solid #D4AF37' 
                          : '1px solid rgba(50,50,50,0.5)',
                        boxShadow: cell.hasFrame 
                          ? '0 0 15px rgba(212,175,55,0.4), inset 0 0 10px rgba(212,175,55,0.1)' 
                          : 'none'
                      }}
                    >
                      {cell.hasFrame && cell.frameType === "multiplier" && (
                        <div 
                          className="absolute bottom-0 right-0 px-1 text-[9px] font-bold z-10"
                          style={{ 
                            color: '#D4AF37',
                            textShadow: '0 0 5px rgba(212,175,55,0.8)'
                          }}
                        >
                          {cell.frameValue}x
                        </div>
                      )}
                      
                      <motion.div
                        className="w-full h-full flex items-center justify-center p-0.5"
                        animate={reelSpinning[col] ? { y: [0, -8, 0], opacity: [1, 0.6, 1] } : {}}
                        transition={{ duration: 0.06, repeat: reelSpinning[col] ? Infinity : 0 }}
                      >
                        <SymbolIcon 
                          symbolId={symbolData?.id || "gem"} 
                          size={42} 
                          hasFrame={cell.hasFrame}
                        />
                      </motion.div>
                      
                      {isWinning && (
                        <motion.div 
                          className="absolute inset-0 pointer-events-none"
                          animate={{ opacity: [0, 0.4, 0] }}
                          transition={{ duration: 0.6, repeat: Infinity }}
                          style={{ background: 'radial-gradient(circle, rgba(212,175,55,0.5) 0%, transparent 70%)' }}
                        />
                      )}
                    </motion.div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>

        {/* Symbol Info Popup */}
        <AnimatePresence>
          {selectedSymbol && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
              onClick={() => setSelectedSymbol(null)}
              data-testid="modal-symbol-info-overlay"
            >
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.8, opacity: 0 }}
                className="bg-[#1a1a1a] border-2 border-[#D4AF37] rounded-lg p-4 mx-4 max-w-xs w-full"
                onClick={(e) => e.stopPropagation()}
                data-testid="modal-symbol-info"
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <SymbolIcon symbolId={SYMBOLS[selectedSymbol.index]?.id || "gem"} size={48} />
                    <div>
                      <div className="text-lg font-bold text-[#D4AF37]" data-testid="text-symbol-name">{selectedSymbol.name}</div>
                      <div className="text-xs text-white/50" data-testid="text-current-bet">Bet: ${currentBet.toFixed(2)}</div>
                    </div>
                  </div>
                  <button 
                    onClick={() => setSelectedSymbol(null)}
                    className="p-1 text-white/50 hover:text-white"
                    data-testid="button-close-symbol-info"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
                
                <div className="space-y-2">
                  <div className="text-xs text-white/50 uppercase tracking-wider mb-2">Payouts</div>
                  {selectedSymbol.payouts[2] > 0 && (
                    <div className="flex justify-between items-center bg-[#252525] rounded px-3 py-2" data-testid="text-payout-3x">
                      <span className="text-white">3x</span>
                      <span className="text-[#D4AF37] font-bold">${selectedSymbol.payouts[2].toFixed(2)}</span>
                    </div>
                  )}
                  {selectedSymbol.payouts[3] > 0 && (
                    <div className="flex justify-between items-center bg-[#252525] rounded px-3 py-2" data-testid="text-payout-4x">
                      <span className="text-white">4x</span>
                      <span className="text-[#D4AF37] font-bold">${selectedSymbol.payouts[3].toFixed(2)}</span>
                    </div>
                  )}
                  {selectedSymbol.payouts[4] > 0 && (
                    <div className="flex justify-between items-center bg-[#252525] rounded px-3 py-2" data-testid="text-payout-5x">
                      <span className="text-white">5x</span>
                      <span className="text-[#D4AF37] font-bold">${selectedSymbol.payouts[4].toFixed(2)}</span>
                    </div>
                  )}
                  {selectedSymbol.payouts[2] === 0 && selectedSymbol.payouts[3] === 0 && selectedSymbol.payouts[4] === 0 && (
                    <div className="text-center text-white/50 py-2" data-testid="text-no-payout">
                      {selectedSymbol.name === "Free Spins" ? "3+ triggers Free Spins bonus" : "No direct payout"}
                    </div>
                  )}
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="w-full max-w-md mt-3 flex items-center justify-between gap-2">
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="w-10 h-10 rounded flex items-center justify-center bg-[#1a1a1a] border border-[#333] hover:bg-[#252525]"
            data-testid="button-menu"
          >
            <Menu className="w-5 h-5 text-white/70" />
          </button>
          
          <div className="flex-1 flex justify-center gap-4">
            <div className="text-center bg-[#1a1a1a] border border-[#333] rounded px-4 py-1">
              <div className="text-[9px] text-white/50 uppercase tracking-wider">Total Win</div>
              <div className="text-sm font-bold text-white">${totalWin.toFixed(2)}</div>
            </div>
            <div className="text-center bg-[#1a1a1a] border border-[#333] rounded px-4 py-1">
              <div className="text-[9px] text-white/50 uppercase tracking-wider">Free Spins</div>
              <div className="text-sm font-bold text-white">{freeSpins}</div>
            </div>
          </div>
          
          <div className="w-10" />
        </div>
      </main>

      <footer className="relative z-10 bg-[#0d0d0d] border-t border-[#222] px-3 py-3">
        <div className="max-w-md mx-auto">
          <div className="flex items-center justify-between gap-2 mb-2">
            <button
              onClick={() => betIndex > 0 && setBetIndex(betIndex - 1)}
              disabled={isSpinning || betIndex === 0}
              className="w-9 h-9 rounded flex items-center justify-center bg-[#1a1a1a] border border-[#333] disabled:opacity-40"
              data-testid="button-decrease-bet"
            >
              <Minus className="w-4 h-4 text-white" />
            </button>
            
            <button
              onClick={() => {
                setSuperTurbo(!superTurbo);
                if (!superTurbo) setTurboMode(false);
              }}
              className={`w-8 h-8 rounded flex items-center justify-center transition-all ${superTurbo ? 'bg-amber-600' : 'bg-[#1a1a1a] border border-[#333]'}`}
              data-testid="button-super-turbo"
            >
              <Zap className={`w-4 h-4 ${superTurbo ? 'text-white' : 'text-white/60'}`} />
              <Zap className={`w-3 h-3 -ml-2 ${superTurbo ? 'text-white' : 'text-white/60'}`} />
            </button>

            <button
              onClick={() => spin(currentBet)}
              disabled={isSpinning || balance < currentBet}
              className="flex-1 max-w-[140px] h-12 rounded-lg flex items-center justify-center transition-all active:scale-95 disabled:opacity-50"
              style={{
                background: isSpinning 
                  ? 'linear-gradient(180deg, #333 0%, #222 100%)'
                  : 'linear-gradient(180deg, #D4AF37 0%, #B8860B 50%, #8B6914 100%)',
                border: '2px solid rgba(255,255,255,0.1)',
                boxShadow: isSpinning ? 'none' : '0 4px 20px rgba(212,175,55,0.4)'
              }}
              data-testid="button-spin"
            >
              {isSpinning ? (
                <motion.div 
                  className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full"
                  animate={{ rotate: 360 }}
                  transition={{ duration: 0.5, repeat: Infinity, ease: "linear" }}
                />
              ) : (
                <span className="text-sm font-bold text-black tracking-wide">SPIN</span>
              )}
            </button>

            <button
              onClick={() => {
                setAutoPlay(!autoPlay);
                if (!autoPlay && !isSpinning) spin(currentBet);
              }}
              className={`w-8 h-8 rounded flex items-center justify-center transition-all ${autoPlay ? 'bg-green-600' : 'bg-[#1a1a1a] border border-[#333]'}`}
              data-testid="button-autoplay"
            >
              <RotateCcw className={`w-4 h-4 ${autoPlay ? 'text-white' : 'text-white/60'}`} />
            </button>

            <button
              onClick={() => betIndex < BET_AMOUNTS.length - 1 && setBetIndex(betIndex + 1)}
              disabled={isSpinning || betIndex === BET_AMOUNTS.length - 1}
              className="w-9 h-9 rounded flex items-center justify-center bg-[#1a1a1a] border border-[#333] disabled:opacity-40"
              data-testid="button-increase-bet"
            >
              <Plus className="w-4 h-4 text-white" />
            </button>
          </div>
          
          <div className="flex items-center justify-between gap-2">
            <div 
              className="flex-1 text-center py-2 px-3 rounded"
              style={{ background: 'rgba(26,26,26,0.8)', border: '1px solid #333' }}
            >
              <div className="text-[9px] text-white/50 uppercase tracking-wider">Balance</div>
              <div className="text-sm font-bold text-white">${balance.toFixed(2)}</div>
            </div>
            <div 
              className="flex-1 text-center py-2 px-3 rounded"
              style={{ background: 'rgba(212,175,55,0.15)', border: '1px solid #B8860B' }}
            >
              <div className="text-[9px] text-amber-400/70 uppercase tracking-wider">Bet</div>
              <div className="text-sm font-bold text-amber-400">${currentBet.toFixed(2)}</div>
            </div>
            {winAmount > 0 ? (
              <div 
                className="flex-1 text-center py-2 px-3 rounded"
                style={{ background: 'rgba(34,197,94,0.15)', border: '1px solid #22c55e' }}
              >
                <div className="text-[9px] text-green-400/70 uppercase tracking-wider">Win</div>
                <motion.div 
                  className="text-green-400 font-bold text-sm"
                  animate={{ scale: [1, 1.1, 1] }}
                  transition={{ duration: 0.5, repeat: 3 }}
                >
                  ${winAmount.toFixed(2)}
                </motion.div>
                {winningSymbolName && (
                  <div className="text-green-400/70 text-[8px] mt-0.5 truncate">
                    {winningSymbolName}
                  </div>
                )}
              </div>
            ) : (
              <div 
                className="flex-1 text-center py-2 px-3 rounded"
                style={{ background: 'rgba(26,26,26,0.8)', border: '1px solid #333' }}
              >
                <div className="text-[9px] text-white/50 uppercase tracking-wider">Win</div>
                <div className="text-sm font-bold text-white/30">$0.00</div>
              </div>
            )}
          </div>
        </div>
      </footer>

      <AnimatePresence>
        {showMenu && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end justify-center bg-black/70"
            onClick={() => setShowMenu(false)}
          >
            <motion.div
              initial={{ y: 300 }}
              animate={{ y: 0 }}
              exit={{ y: 300 }}
              className="w-full max-w-md bg-[#1a1a1a] rounded-t-2xl p-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="grid grid-cols-2 gap-3">
                <button 
                  onClick={() => { setShowMenu(false); setShowBonusBuy(true); }}
                  className="col-span-2 flex items-center justify-center gap-3 p-4 rounded-lg"
                  style={{
                    background: 'linear-gradient(180deg, #B8860B 0%, #D4AF37 50%, #B8860B 100%)',
                    border: '2px solid #FFD700',
                    boxShadow: '0 0 20px rgba(212,175,55,0.4)',
                  }}
                  data-testid="button-buy-bonus"
                >
                  <Zap className="w-6 h-6 text-black" />
                  <span className="text-black font-bold text-lg">BUY BONUS</span>
                </button>
                <button 
                  onClick={() => { setShowMenu(false); setShowInfo(true); }}
                  className="flex items-center gap-3 p-4 bg-[#252525] rounded-lg hover:bg-[#2a2a2a]"
                >
                  <Info className="w-5 h-5 text-white/70" />
                  <span className="text-white text-sm">INFO</span>
                </button>
                <button 
                  onClick={() => { setShowMenu(false); onBack(); }}
                  className="flex items-center gap-3 p-4 bg-[#252525] rounded-lg hover:bg-[#2a2a2a]"
                >
                  <Home className="w-5 h-5 text-white/70" />
                  <span className="text-white text-sm">HOME</span>
                </button>
                <button 
                  onClick={() => { setSuperTurbo(!superTurbo); setShowMenu(false); }}
                  className={`flex items-center gap-3 p-4 rounded-lg ${superTurbo ? 'bg-amber-600/30 border border-amber-600' : 'bg-[#252525]'}`}
                >
                  <div className="flex">
                    <Zap className="w-5 h-5 text-white/70" />
                    <Zap className="w-4 h-4 -ml-2 text-white/70" />
                  </div>
                  <span className="text-white text-sm">SUPER TURBO</span>
                </button>
                <button 
                  onClick={() => { setTurboMode(!turboMode); setShowMenu(false); }}
                  className={`flex items-center gap-3 p-4 rounded-lg ${turboMode ? 'bg-amber-600/30 border border-amber-600' : 'bg-[#252525]'}`}
                >
                  <Zap className="w-5 h-5 text-white/70" />
                  <span className="text-white text-sm">TURBO</span>
                </button>
                <button className="flex items-center gap-3 p-4 bg-[#252525] rounded-lg hover:bg-[#2a2a2a]">
                  <Volume2 className="w-5 h-5 text-white/70" />
                  <span className="text-white text-sm">SOUND</span>
                </button>
                <button className="flex items-center gap-3 p-4 bg-[#252525] rounded-lg hover:bg-[#2a2a2a]">
                  <Music className="w-5 h-5 text-white/70" />
                  <span className="text-white text-sm">MUSIC</span>
                </button>
              </div>
              <button 
                onClick={() => setShowMenu(false)}
                className="w-10 h-10 mt-4 mx-auto flex items-center justify-center rounded-full bg-[#333] hover:bg-[#444]"
              >
                <X className="w-5 h-5 text-white" />
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showBigWin && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/90"
            onClick={() => setShowBigWin(false)}
          >
            <motion.div
              initial={{ scale: 0, rotate: -180 }}
              animate={{ scale: 1, rotate: 0 }}
              exit={{ scale: 0 }}
              transition={{ type: "spring", damping: 12 }}
              className="text-center"
            >
              <motion.div
                animate={{ 
                  textShadow: ['0 0 20px rgba(212,175,55,0.5)', '0 0 60px rgba(212,175,55,1)', '0 0 20px rgba(212,175,55,0.5)']
                }}
                transition={{ duration: 0.5, repeat: Infinity }}
                className="text-5xl font-black mb-4"
                style={{
                  background: 'linear-gradient(180deg, #FFD700 0%, #D4AF37 50%, #B8860B 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                }}
              >
                {bigWinType}
              </motion.div>
              <motion.div
                animate={{ scale: [1, 1.15, 1] }}
                transition={{ duration: 0.4, repeat: Infinity }}
                className="text-4xl font-bold text-white"
                style={{ textShadow: '0 0 30px rgba(212,175,55,0.8)' }}
              >
                ${winAmount.toFixed(2)}
              </motion.div>
              <div className="mt-6 text-white/50 text-xs uppercase tracking-wider">Click to continue</div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {waitingForResume && bonusState.mode !== "none" && bonusState.spinsRemaining > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex flex-col items-center justify-center"
            style={{
              background: 'linear-gradient(180deg, rgba(0,0,0,0.95) 0%, rgba(26,26,26,0.98) 100%)',
            }}
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring" }}
              className="text-center p-8"
            >
              <motion.h2
                animate={{ 
                  textShadow: ['0 0 20px rgba(212,175,55,0.5)', '0 0 40px rgba(212,175,55,1)', '0 0 20px rgba(212,175,55,0.5)']
                }}
                transition={{ duration: 1.5, repeat: Infinity }}
                className="text-3xl font-black mb-4"
                style={{
                  background: 'linear-gradient(180deg, #FFD700 0%, #D4AF37 50%, #B8860B 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                }}
              >
                BONUS PAUSED
              </motion.h2>
              
              <p className="text-white/80 text-lg mb-2">
                {bonusState.mode === "velvet_nights" ? "Velvet Nights" : bonusState.mode === "golden_hits" ? "Golden Hits" : "Black and Gold"}
              </p>
              
              <p className="text-amber-400 text-2xl font-bold mb-6">
                {bonusState.spinsRemaining} FREE SPINS REMAINING
              </p>
              
              {bonusState.totalWin > 0 && (
                <p className="text-white/70 mb-6">
                  Current Win: ${bonusState.totalWin.toFixed(2)}
                </p>
              )}
              
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => {
                  waitingForResumeRef.current = false;
                  setWaitingForResume(false);
                  localStorage.removeItem("luxe_bonus_state");
                  setTimeout(() => {
                    spinMutation.mutate(bonusBetAmount);
                  }, 300);
                }}
                className="px-8 py-4 rounded-lg font-bold text-lg"
                style={{
                  background: 'linear-gradient(180deg, #D4AF37 0%, #B8860B 100%)',
                  color: '#000',
                  boxShadow: '0 0 20px rgba(212,175,55,0.5)',
                }}
                data-testid="button-resume-bonus"
              >
                CONTINUE BONUS
              </motion.button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showBonusIntro && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex flex-col items-center justify-center overflow-hidden"
            onClick={() => {
              if (bonusCountdown === 0) {
                setShowBonusIntro(false);
                setStartBonusSpin(true);
              }
            }}
            style={{
              background: 'linear-gradient(180deg, #0a0a0a 0%, #1a1a1a 100%)',
            }}
          >
            <motion.div
              className="absolute inset-0 pointer-events-none"
              animate={{
                background: [
                  'radial-gradient(ellipse at 30% 20%, rgba(212,175,55,0.4) 0%, transparent 50%)',
                  'radial-gradient(ellipse at 70% 80%, rgba(212,175,55,0.4) 0%, transparent 50%)',
                  'radial-gradient(ellipse at 30% 20%, rgba(212,175,55,0.4) 0%, transparent 50%)',
                ]
              }}
              transition={{ duration: 4, repeat: Infinity }}
            />
            
            <motion.div
              initial={{ y: -50, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.2, type: "spring" }}
              className="text-center mb-8"
            >
              <motion.h1
                animate={{ 
                  textShadow: ['0 0 20px rgba(212,175,55,0.5)', '0 0 60px rgba(212,175,55,1)', '0 0 20px rgba(212,175,55,0.5)']
                }}
                transition={{ duration: 1.5, repeat: Infinity }}
                className="text-4xl font-black tracking-wider"
                style={{
                  background: 'linear-gradient(180deg, #FFD700 0%, #D4AF37 40%, #8B6914 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  textShadow: '0 4px 15px rgba(212,175,55,0.5)',
                }}
              >
                {bonusState.mode === "velvet_nights" 
                  ? "VELVET NIGHTS" 
                  : bonusState.mode === "golden_hits" 
                    ? "GOLDEN HITS" 
                    : "BLACK AND GOLD"}
              </motion.h1>
            </motion.div>

            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.4, type: "spring" }}
              className="relative mx-6 max-w-sm"
              style={{
                background: 'rgba(0,0,0,0.9)',
                border: '3px solid #B8860B',
                boxShadow: '0 0 30px rgba(212,175,55,0.3), inset 0 0 20px rgba(0,0,0,0.5)',
              }}
            >
              <div className="p-6 text-center">
                <motion.div
                  animate={{ scale: [1, 1.05, 1] }}
                  transition={{ duration: 1, repeat: Infinity }}
                  className="text-2xl font-bold text-amber-400 mb-4"
                >
                  YOU WON {freeSpins} FREE SPINS
                </motion.div>
                
                <div className="text-white/80 text-sm leading-relaxed mb-4">
                  {bonusState.mode === "velvet_nights" 
                    ? "All cells have Golden Frames from the start! Multipliers will double on wins, and Jackpot Frames will be refilled with new values once awarded!"
                    : bonusState.mode === "golden_hits"
                      ? "3 Golden Frames will be on the grid from the start. All Golden Frames are Sticky. Multipliers double on wins!"
                      : "1 Golden Frame will be on the grid. Golden Frames are Sticky and double multipliers on wins!"}
                </div>
                
                <div className="text-amber-400/70 text-xs">
                  Landing additional FS symbols during the bonus awards extra free spins.
                </div>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
              className="mt-12 text-center"
            >
              {bonusCountdown > 0 ? (
                <div className="flex flex-col items-center gap-2">
                  <motion.div
                    key={bonusCountdown}
                    initial={{ scale: 1.5, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="text-5xl font-bold text-amber-400"
                    style={{ textShadow: '0 0 20px rgba(212,175,55,0.8)' }}
                  >
                    {bonusCountdown}
                  </motion.div>
                  <div className="text-white/50 text-xs uppercase tracking-widest">
                    GET READY...
                  </div>
                </div>
              ) : (
                <motion.div
                  animate={{ scale: [1, 1.05, 1] }}
                  transition={{ duration: 0.5, repeat: Infinity }}
                  className="text-white text-lg font-bold uppercase tracking-widest cursor-pointer"
                  style={{ textShadow: '0 0 10px rgba(255,255,255,0.5)' }}
                >
                  TAP TO START
                </motion.div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {bonusState.mode !== "none" && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-40 flex flex-col items-center gap-2">
          <div 
            className="px-4 py-2 rounded-full text-center"
            style={{
              background: bonusState.mode === "velvet_nights" 
                ? 'linear-gradient(180deg, #8B0000 0%, #DC143C 100%)' 
                : bonusState.mode === "golden_hits"
                  ? 'linear-gradient(180deg, #B8860B 0%, #FFD700 100%)'
                  : 'linear-gradient(180deg, #1a1a1a 0%, #333 100%)',
              border: '2px solid #FFD700',
              boxShadow: '0 0 20px rgba(212,175,55,0.5)',
            }}
          >
            <div className="text-amber-400 text-xs font-bold uppercase tracking-wider">
              {bonusState.mode === "velvet_nights" 
                ? "VELVET NIGHTS" 
                : bonusState.mode === "golden_hits" 
                  ? "GOLDEN HITS" 
                  : "BLACK AND GOLD"}
            </div>
            <div className="text-white font-bold text-lg">
              {freeSpins} FREE SPINS
            </div>
          </div>
          <div className="text-amber-400/80 text-xs">
            Total Win: ${bonusState.totalWin.toFixed(2)}
          </div>
        </div>
      )}

      <AnimatePresence>
        {showInfo && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
            onClick={() => setShowInfo(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="w-full max-w-md max-h-[80vh] overflow-y-auto rounded-xl p-5"
              style={{
                background: 'linear-gradient(180deg, #1a1a1a 0%, #0d0d0d 100%)',
                border: '2px solid #D4AF37',
                boxShadow: '0 0 30px rgba(212,175,55,0.3)'
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-amber-400">THE LUXE - Game Rules</h2>
                <button 
                  onClick={() => setShowInfo(false)}
                  className="text-white/50 hover:text-white"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="space-y-4 text-white/80 text-sm">
                <div>
                  <h3 className="text-amber-400 font-bold mb-1">How to Play</h3>
                  <p>The Luxe is a 5x4 reel slot with 20 paylines. Match 3 or more symbols on a payline from left to right to win. Balance is connected to your casino account - each spin deducts the bet amount, wins are added automatically.</p>
                </div>

                <div>
                  <h3 className="text-amber-400 font-bold mb-1">Golden Frames</h3>
                  <p>Random cells can have golden frames with multipliers (2x-10x). When winning symbols land on framed cells, the multiplier is applied to your win!</p>
                </div>

                <div>
                  <h3 className="text-amber-400 font-bold mb-1">Wild Symbol (W)</h3>
                  <p>The golden W wild substitutes for all symbols except FS scatter. Wilds help complete winning combinations.</p>
                </div>

                <div>
                  <h3 className="text-amber-400 font-bold mb-1">Free Spins Bonus</h3>
                  <p>Land 3+ blue FS scatter symbols anywhere to trigger Free Spins:</p>
                  <ul className="list-disc list-inside mt-1 space-y-1 text-white/70">
                    <li><span className="text-white">3 Scatters:</span> BLACK AND GOLD - 10 Free Spins + 1 Sticky Frame</li>
                    <li><span className="text-white">4 Scatters:</span> GOLDEN HITS - 12 Free Spins + 3 Sticky Frames</li>
                    <li><span className="text-white">5+ Scatters:</span> VELVET NIGHTS - 14 Free Spins + Full Grid Sticky Frames</li>
                  </ul>
                </div>

                <div>
                  <h3 className="text-amber-400 font-bold mb-1">Buy Bonus</h3>
                  <p>Skip the wait and purchase bonus rounds directly:</p>
                  <ul className="list-disc list-inside mt-1 space-y-1 text-white/70">
                    <li><span className="text-white">BONUS (100x bet):</span> Random Black & Gold or Golden Hits mode</li>
                    <li><span className="text-white">SUPER BONUS (300x bet):</span> Velvet Nights - 14 spins + all frames!</li>
                  </ul>
                </div>

                <div>
                  <h3 className="text-amber-400 font-bold mb-1">Retrigger</h3>
                  <p>During Free Spins, landing scatters awards extra spins: 2 Scatters = +2 Spins, 3+ Scatters = +4 Spins.</p>
                </div>

                <div>
                  <h3 className="text-amber-400 font-bold mb-1">Jackpots</h3>
                  <p>Some golden frames contain jackpot symbols (MINI, MINOR, MAJOR, GRAND) for instant prizes based on your bet!</p>
                </div>

                <div className="border-t border-white/10 pt-3">
                  <p className="text-white/50 text-xs">RTP: 96.5% | Min Bet: $0.10 | Max Bet: $100</p>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bonus Buy Modal */}
      <AnimatePresence>
        {showBonusBuy && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
            onClick={() => setShowBonusBuy(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="w-full max-w-sm rounded-xl p-5"
              style={{
                background: 'linear-gradient(180deg, #1a1a1a 0%, #0d0d0d 100%)',
                border: '2px solid #D4AF37',
                boxShadow: '0 0 30px rgba(212,175,55,0.3)'
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-amber-400">BUY BONUS</h2>
                <button 
                  onClick={() => setShowBonusBuy(false)}
                  className="text-white/50 hover:text-white"
                  data-testid="button-close-bonus-buy"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="text-center mb-4">
                <div className="text-white/70 text-sm mb-2">Select Bet</div>
                <div className="flex items-center justify-center gap-4">
                  <button
                    onClick={() => betIndex > 0 && setBetIndex(betIndex - 1)}
                    disabled={betIndex === 0}
                    className="w-10 h-10 rounded-full flex items-center justify-center bg-[#333] border border-[#555] disabled:opacity-40 hover:bg-[#444]"
                    data-testid="bonus-buy-decrease-bet"
                  >
                    <Minus className="w-5 h-5 text-white" />
                  </button>
                  <div className="text-3xl font-bold text-amber-400 min-w-[100px]">${currentBet.toFixed(2)}</div>
                  <button
                    onClick={() => betIndex < BET_AMOUNTS.length - 1 && setBetIndex(betIndex + 1)}
                    disabled={betIndex === BET_AMOUNTS.length - 1}
                    className="w-10 h-10 rounded-full flex items-center justify-center bg-[#333] border border-[#555] disabled:opacity-40 hover:bg-[#444]"
                    data-testid="bonus-buy-increase-bet"
                  >
                    <Plus className="w-5 h-5 text-white" />
                  </button>
                </div>
              </div>

              <div className="space-y-3">
                {/* Regular Bonus - 100x */}
                <button
                  onClick={() => buyBonus("regular")}
                  disabled={bonusBuyMutation.isPending || balance < currentBet * 100}
                  className="w-full p-4 rounded-lg transition-all disabled:opacity-50"
                  style={{
                    background: 'linear-gradient(180deg, #333 0%, #1a1a1a 100%)',
                    border: '2px solid #B8860B',
                  }}
                  data-testid="button-buy-regular-bonus"
                >
                  <div className="flex items-center justify-between">
                    <div className="text-left">
                      <div className="text-amber-400 font-bold">BONUS</div>
                      <div className="text-white/60 text-xs">Black & Gold or Golden Hits</div>
                      <div className="text-white/60 text-xs">10-12 Free Spins</div>
                    </div>
                    <div className="text-right">
                      <div className="text-white font-bold text-lg">${(currentBet * 100).toFixed(2)}</div>
                      <div className="text-amber-400/70 text-xs">100x BET</div>
                    </div>
                  </div>
                </button>

                {/* Super Bonus - 300x */}
                <button
                  onClick={() => buyBonus("super")}
                  disabled={bonusBuyMutation.isPending || balance < currentBet * 300}
                  className="w-full p-4 rounded-lg transition-all disabled:opacity-50"
                  style={{
                    background: 'linear-gradient(180deg, #8B0000 0%, #DC143C 50%, #8B0000 100%)',
                    border: '2px solid #FFD700',
                    boxShadow: '0 0 20px rgba(220,20,60,0.3)',
                  }}
                  data-testid="button-buy-super-bonus"
                >
                  <div className="flex items-center justify-between">
                    <div className="text-left">
                      <div className="text-amber-400 font-bold text-lg">SUPER BONUS</div>
                      <div className="text-white/80 text-xs">VELVET NIGHTS</div>
                      <div className="text-white/80 text-xs">14 Free Spins + All Frames!</div>
                    </div>
                    <div className="text-right">
                      <div className="text-white font-bold text-xl">${(currentBet * 300).toFixed(2)}</div>
                      <div className="text-amber-400 text-xs font-bold">300x BET</div>
                    </div>
                  </div>
                </button>
              </div>

              <div className="mt-4 text-center text-white/50 text-xs">
                Your Balance: ${balance.toFixed(2)}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
