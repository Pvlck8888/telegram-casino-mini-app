import { useState, useRef, useEffect, useCallback } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { GameHeader } from "@/components/GameHeader";
import { useTelegram } from "@/components/TelegramProvider";
import { gamesConfig } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAudio } from "@/components/AudioProvider";
import { Minus, Plus, Zap, RotateCcw, Info, Volume2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useCurrency } from "@/components/CurrencyProvider";

interface SlotsGameProps {
  balance: number;
  onBalanceChange: (newBalance: number) => void;
  onBack: () => void;
}

const REEL_COUNT = 5;
const ROWS = 3;
const SYMBOL_COUNT = 11;
const WILD_INDEX = 9;
const SCATTER_INDEX = 10;

const PAYLINES = [
  [[1, 0], [1, 1], [1, 2], [1, 3], [1, 4]],
  [[0, 0], [0, 1], [0, 2], [0, 3], [0, 4]],
  [[2, 0], [2, 1], [2, 2], [2, 3], [2, 4]],
  [[0, 0], [1, 1], [2, 2], [1, 3], [0, 4]],
  [[2, 0], [1, 1], [0, 2], [1, 3], [2, 4]],
  [[1, 0], [2, 1], [2, 2], [2, 3], [1, 4]],
  [[1, 0], [0, 1], [0, 2], [0, 3], [1, 4]],
  [[0, 0], [0, 1], [1, 2], [2, 3], [2, 4]],
  [[2, 0], [2, 1], [1, 2], [0, 3], [0, 4]]
];

const PAYOUTS: Record<number, number[]> = {
  0: [0, 0, 0.25, 1, 5],
  1: [0, 0, 0.5, 2, 7.5],
  2: [0, 0, 0.25, 1, 5],
  3: [0, 0, 0.5, 2, 7.5],
  4: [0, 0, 0.5, 2, 7.5],
  5: [0, 0.5, 5, 50, 250],
  6: [0, 0.25, 0.75, 3.75, 12.5],
  7: [0, 0.25, 1.25, 5, 25],
  8: [0, 0.25, 2.5, 10, 50],
  9: [0, 0.5, 5, 50, 250],
};

const SYMBOL_NAMES = ["Sword", "Shield", "Helmet", "Horn", "Axe", "Barrel", "Coins", "Viking", "Ship", "WILD", "SCATTER"];

const BET_AMOUNTS = [0.20, 0.50, 1.00, 2.00, 5.00, 10.00, 20.00, 50.00];

const generateRandomGrid = (): number[][] => {
  const grid: number[][] = [];
  for (let row = 0; row < ROWS; row++) {
    const rowData: number[] = [];
    for (let col = 0; col < REEL_COUNT; col++) {
      rowData.push(Math.floor(Math.random() * (SYMBOL_COUNT - 1)));
    }
    grid.push(rowData);
  }
  return grid;
};

const checkWins = (grid: number[][], betAmount: number): { totalPayout: number; winningLines: number[]; multiplier: number } => {
  let totalPayout = 0;
  const winningLines: number[] = [];
  
  for (let lineIndex = 0; lineIndex < PAYLINES.length; lineIndex++) {
    const line = PAYLINES[lineIndex];
    const symbols: number[] = line.map(([row, col]) => grid[row][col]);
    
    let firstSymbol = symbols[0];
    if (firstSymbol === WILD_INDEX) {
      firstSymbol = symbols.find(s => s !== WILD_INDEX) ?? WILD_INDEX;
    }
    
    let matchCount = 0;
    for (const symbol of symbols) {
      if (symbol === firstSymbol || symbol === WILD_INDEX) {
        matchCount++;
      } else {
        break;
      }
    }
    
    if (matchCount >= 2 && PAYOUTS[firstSymbol]) {
      const multiplier = PAYOUTS[firstSymbol][matchCount - 1] || 0;
      if (multiplier > 0) {
        totalPayout += betAmount * multiplier;
        winningLines.push(lineIndex);
      }
    }
  }
  
  let scatterCount = 0;
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < REEL_COUNT; col++) {
      if (grid[row][col] === SCATTER_INDEX) {
        scatterCount++;
      }
    }
  }
  
  if (scatterCount >= 3) {
    totalPayout += betAmount * scatterCount * 5;
  }
  
  return { 
    totalPayout, 
    winningLines, 
    multiplier: totalPayout > 0 ? totalPayout / betAmount : 0 
  };
};

export function SlotsGame({ balance, onBalanceChange, onBack }: SlotsGameProps) {
  const gameConfig = gamesConfig.find((g) => g.id === "slots")!;
  const { hapticFeedback, user } = useTelegram();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { setCurrentGame, playSound } = useAudio();
  const { currency } = useCurrency();
  
  const [grid, setGrid] = useState<number[][]>(generateRandomGrid);
  const [isSpinning, setIsSpinning] = useState(false);
  const [reelSpinning, setReelSpinning] = useState<boolean[]>([false, false, false, false, false]);
  const [winningLines, setWinningLines] = useState<number[]>([]);
  const [isWin, setIsWin] = useState<boolean | null>(null);
  const [winAmount, setWinAmount] = useState(0);
  const [displaySymbols, setDisplaySymbols] = useState<number[][]>(generateRandomGrid);
  const [betIndex, setBetIndex] = useState(2);
  const [showBigWin, setShowBigWin] = useState(false);
  const [turboMode, setTurboMode] = useState(false);
  const [autoPlay, setAutoPlay] = useState(false);
  const autoPlayRef = useRef(false);
  const betIndexRef = useRef(betIndex);
  
  const spinTimeouts = useRef<NodeJS.Timeout[]>([]);
  const animationInterval = useRef<NodeJS.Timeout | null>(null);

  const currentBet = BET_AMOUNTS[betIndex];

  useEffect(() => {
    betIndexRef.current = betIndex;
  }, [betIndex]);

  useEffect(() => {
    setCurrentGame("slots");
    return () => {
      spinTimeouts.current.forEach(clearTimeout);
      if (animationInterval.current) clearInterval(animationInterval.current);
      autoPlayRef.current = false;
    };
  }, [setCurrentGame]);

  useEffect(() => {
    autoPlayRef.current = autoPlay;
  }, [autoPlay]);

  const animateReels = useCallback((finalGrid: number[][], onComplete: () => void) => {
    setReelSpinning([true, true, true, true, true]);
    
    animationInterval.current = setInterval(() => {
      setDisplaySymbols(prev => {
        const newSymbols = prev.map((row, rowIdx) => 
          row.map((_, colIdx) => {
            if (reelSpinning[colIdx]) {
              return Math.floor(Math.random() * (SYMBOL_COUNT - 1));
            }
            return finalGrid[rowIdx][colIdx];
          })
        );
        return newSymbols;
      });
    }, turboMode ? 40 : 60);

    const baseDelay = turboMode ? 300 : 600;
    const reelDelay = turboMode ? 150 : 300;

    for (let i = 0; i < REEL_COUNT; i++) {
      const delay = baseDelay + i * reelDelay;
      spinTimeouts.current[i] = setTimeout(() => {
        setReelSpinning(prev => {
          const newState = [...prev];
          newState[i] = false;
          return newState;
        });
        
        setDisplaySymbols(prev => {
          const newSymbols = [...prev.map(row => [...row])];
          for (let row = 0; row < ROWS; row++) {
            newSymbols[row][i] = finalGrid[row][i];
          }
          return newSymbols;
        });
        
        hapticFeedback("light");
        playSound("click");
        
        if (i === REEL_COUNT - 1) {
          if (animationInterval.current) {
            clearInterval(animationInterval.current);
          }
          setTimeout(onComplete, 100);
        }
      }, delay);
    }
  }, [hapticFeedback, turboMode, playSound]);

  const spinMutation = useMutation({
    mutationFn: async (betAmount: number) => {
      setIsWin(null);
      setWinAmount(0);
      setWinningLines([]);
      setShowBigWin(false);
      setIsSpinning(true);
      
      const response = await apiRequest("POST", "/api/games/slots/spin", {
        odejs: user?.id || "demo",
        amount: betAmount,
        currency,
      });
      
      return { ...await response.json(), betAmount };
    },
    onSuccess: async (data) => {
      playSound("spin");
      
      const finalGrid = data.grid || generateRandomGrid();
      setGrid(finalGrid);
      
      animateReels(finalGrid, () => {
        setIsSpinning(false);
        
        const result = data.isWin !== undefined 
          ? { totalPayout: data.payout, winningLines: data.winningLines || [], multiplier: data.multiplier }
          : checkWins(finalGrid, data.betAmount);
        
        setWinningLines(result.winningLines);
        setIsWin(result.totalPayout > 0);
        setWinAmount(result.totalPayout);
        
        const newBalance = data.newBalance !== undefined ? data.newBalance : balance;
        if (data.newBalance !== undefined) {
          onBalanceChange(data.newBalance);
        }
        
        if (result.totalPayout > 0) {
          hapticFeedback("heavy");
          playSound("win");
          
          if (result.multiplier >= 10) {
            setShowBigWin(true);
            setTimeout(() => setShowBigWin(false), 3000);
          }
        } else {
          playSound("lose");
        }
        
        queryClient.invalidateQueries({ queryKey: ["/api/users/telegram"] });
        
        if (autoPlayRef.current) {
          const nextBetAmount = BET_AMOUNTS[betIndexRef.current];
          if (newBalance >= nextBetAmount) {
            setTimeout(() => {
              if (autoPlayRef.current) {
                spinMutation.mutate(nextBetAmount);
              }
            }, 1000);
          } else {
            setAutoPlay(false);
            toast({
              title: "Autoplay stopped",
              description: "Insufficient balance for next spin",
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
        description: "Spin failed. Please try again.",
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
        description: "Not enough funds to spin",
        variant: "destructive"
      });
      setAutoPlay(false);
      return;
    }
    hapticFeedback("medium");
    playSound("bet");
    spinMutation.mutate(betAmount);
  };

  const isSymbolInWinningLine = (row: number, col: number): boolean => {
    for (const lineIndex of winningLines) {
      const line = PAYLINES[lineIndex];
      if (line.some(([r, c]) => r === row && c === col)) {
        return true;
      }
    }
    return false;
  };

  const decreaseBet = () => {
    if (betIndex > 0) {
      setBetIndex(betIndex - 1);
      hapticFeedback("light");
    }
  };

  const increaseBet = () => {
    if (betIndex < BET_AMOUNTS.length - 1) {
      setBetIndex(betIndex + 1);
      hapticFeedback("light");
    }
  };

  return (
    <div 
      className="h-screen flex flex-col overflow-hidden"
      style={{ 
        background: 'linear-gradient(180deg, #1a0a2e 0%, #16082a 50%, #0d0518 100%)'
      }}
      data-testid="page-slots-game"
    >
      <GameHeader title="Viking Slots" balance={balance} onBack={onBack} gameType="slots" schemaGameType="slots" />

      <main className="flex-1 flex flex-col items-center justify-between p-2 overflow-hidden">
        <div className="relative w-full max-w-md flex-1 flex flex-col min-h-0">
          <div 
            className="relative flex-1 rounded-2xl overflow-hidden"
            style={{
              background: 'linear-gradient(180deg, #2d1b4e 0%, #1a0f30 100%)',
              border: '3px solid',
              borderImage: 'linear-gradient(180deg, #ffd700 0%, #b8860b 50%, #ffd700 100%) 1',
              boxShadow: '0 0 30px rgba(255, 215, 0, 0.3), inset 0 0 60px rgba(0,0,0,0.5)'
            }}
          >
            <div 
              className="absolute inset-0 opacity-20"
              style={{
                background: 'radial-gradient(ellipse at center top, rgba(255,215,0,0.4) 0%, transparent 60%)'
              }}
            />
            
            <div className="absolute top-2 left-0 right-0 flex justify-center z-10">
              <div 
                className="px-6 py-1 rounded-full text-sm font-bold"
                style={{
                  background: 'linear-gradient(180deg, #ffd700 0%, #ff8c00 100%)',
                  color: '#1a0a2e',
                  boxShadow: '0 4px 15px rgba(255, 215, 0, 0.5)'
                }}
              >
                VIKING SLOTS
              </div>
            </div>

            <div 
              className="absolute grid grid-cols-5 gap-1 p-2"
              style={{
                top: '12%',
                left: '3%',
                right: '3%',
                bottom: '8%',
              }}
            >
              {[0, 1, 2, 3, 4].map((col) => (
                <div 
                  key={col} 
                  className="flex flex-col gap-1 rounded-lg overflow-hidden"
                  style={{
                    background: 'linear-gradient(180deg, rgba(0,0,0,0.6) 0%, rgba(20,10,40,0.8) 100%)',
                    boxShadow: 'inset 0 2px 10px rgba(0,0,0,0.5)'
                  }}
                  data-testid={`reel-${col}`}
                >
                  {[0, 1, 2].map((row) => {
                    const symbolIndex = displaySymbols[row]?.[col] ?? 0;
                    const isWinning = isSymbolInWinningLine(row, col) && !isSpinning;
                    
                    return (
                      <motion.div
                        key={`${row}-${col}`}
                        className="relative aspect-square flex items-center justify-center overflow-hidden"
                        animate={isWinning ? { 
                          scale: [1, 1.1, 1],
                          boxShadow: ['0 0 0px rgba(255,215,0,0)', '0 0 20px rgba(255,215,0,0.8)', '0 0 0px rgba(255,215,0,0)']
                        } : {}}
                        transition={{ duration: 0.5, repeat: isWinning ? Infinity : 0 }}
                        style={{
                          background: isWinning 
                            ? 'linear-gradient(135deg, rgba(255,215,0,0.4), rgba(255,140,0,0.4))'
                            : 'transparent'
                        }}
                      >
                        {isWinning && (
                          <div 
                            className="absolute inset-0 rounded-sm"
                            style={{
                              border: '2px solid #ffd700',
                              boxShadow: '0 0 15px rgba(255,215,0,0.6), inset 0 0 10px rgba(255,215,0,0.3)'
                            }}
                          />
                        )}
                        <motion.img 
                          src={`/games/slot/slot_${symbolIndex === WILD_INDEX ? 'wild' : symbolIndex === SCATTER_INDEX ? 'scatter' : symbolIndex + 1}.png`}
                          alt={SYMBOL_NAMES[symbolIndex]}
                          className="w-full h-full object-contain p-0.5"
                          animate={reelSpinning[col] ? { 
                            y: [0, -20, 0],
                            opacity: [1, 0.5, 1]
                          } : {}}
                          transition={{ duration: 0.1, repeat: reelSpinning[col] ? Infinity : 0 }}
                          draggable={false}
                          style={{
                            filter: isWinning ? 'drop-shadow(0 0 8px rgba(255,215,0,0.8))' : 'none'
                          }}
                        />
                      </motion.div>
                    );
                  })}
                </div>
              ))}
            </div>

            {winningLines.length > 0 && !isSpinning && (
              <div className="absolute inset-0 pointer-events-none" style={{ top: '12%', left: '3%', right: '3%', bottom: '8%' }}>
                <svg className="w-full h-full">
                  {winningLines.map((lineIndex, i) => {
                    const line = PAYLINES[lineIndex];
                    const colors = ['#FFD700', '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F'];
                    const color = colors[lineIndex % colors.length];
                    
                    const points = line.map(([row, col]) => {
                      const x = (col + 0.5) * 20;
                      const y = (row + 0.5) * 33.33;
                      return `${x}%,${y}%`;
                    }).join(' ');
                    
                    return (
                      <motion.polyline
                        key={i}
                        points={points}
                        fill="none"
                        stroke={color}
                        strokeWidth="4"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        initial={{ pathLength: 0, opacity: 0 }}
                        animate={{ pathLength: 1, opacity: [0.5, 1, 0.5] }}
                        transition={{ duration: 1, repeat: Infinity }}
                        style={{ filter: `drop-shadow(0 0 6px ${color})` }}
                      />
                    );
                  })}
                </svg>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between mt-3 px-2">
            <div 
              className="flex flex-col items-center px-4 py-2 rounded-xl"
              style={{
                background: 'linear-gradient(180deg, rgba(45,27,78,0.9) 0%, rgba(26,15,48,0.9) 100%)',
                border: '1px solid rgba(255,215,0,0.3)'
              }}
            >
              <span className="text-[10px] text-yellow-500/70 uppercase tracking-wider">Balance</span>
              <span className="text-lg font-bold text-white">${balance.toFixed(2)}</span>
            </div>

            <AnimatePresence>
              {winAmount > 0 && !isSpinning && (
                <motion.div 
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0, opacity: 0 }}
                  className="flex flex-col items-center px-6 py-2 rounded-xl"
                  style={{
                    background: 'linear-gradient(180deg, rgba(255,215,0,0.3) 0%, rgba(255,140,0,0.2) 100%)',
                    border: '2px solid #ffd700',
                    boxShadow: '0 0 20px rgba(255,215,0,0.4)'
                  }}
                >
                  <span className="text-[10px] text-yellow-400 uppercase tracking-wider">WIN</span>
                  <motion.span 
                    className="text-xl font-bold text-yellow-400"
                    animate={{ scale: [1, 1.1, 1] }}
                    transition={{ duration: 0.5, repeat: Infinity }}
                  >
                    ${winAmount.toFixed(2)}
                  </motion.span>
                </motion.div>
              )}
            </AnimatePresence>

            <div 
              className="flex flex-col items-center px-4 py-2 rounded-xl"
              style={{
                background: 'linear-gradient(180deg, rgba(45,27,78,0.9) 0%, rgba(26,15,48,0.9) 100%)',
                border: '1px solid rgba(255,215,0,0.3)'
              }}
            >
              <span className="text-[10px] text-yellow-500/70 uppercase tracking-wider">Bet</span>
              <span className="text-lg font-bold text-white">${currentBet.toFixed(2)}</span>
            </div>
          </div>
        </div>

        <div className="w-full max-w-md mt-3 pb-2">
          <div className="flex items-center justify-between gap-2">
            <button
              onClick={decreaseBet}
              disabled={isSpinning || betIndex === 0}
              className="w-12 h-12 rounded-full flex items-center justify-center transition-all active:scale-95 disabled:opacity-50"
              style={{
                background: 'linear-gradient(180deg, #3d2a5c 0%, #2d1b4e 100%)',
                border: '2px solid rgba(255,215,0,0.4)',
                boxShadow: '0 4px 15px rgba(0,0,0,0.3)'
              }}
              data-testid="button-decrease-bet"
            >
              <Minus className="w-5 h-5 text-yellow-400" />
            </button>

            <button
              onClick={() => setTurboMode(!turboMode)}
              className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${turboMode ? 'ring-2 ring-yellow-400' : ''}`}
              style={{
                background: turboMode 
                  ? 'linear-gradient(180deg, #ffd700 0%, #ff8c00 100%)'
                  : 'linear-gradient(180deg, #3d2a5c 0%, #2d1b4e 100%)',
                border: '2px solid rgba(255,215,0,0.4)'
              }}
              data-testid="button-turbo"
            >
              <Zap className={`w-4 h-4 ${turboMode ? 'text-purple-900' : 'text-yellow-400'}`} />
            </button>

            <button
              onClick={() => spin(currentBet)}
              disabled={isSpinning || balance < currentBet}
              className="w-20 h-20 rounded-full flex items-center justify-center transition-all active:scale-95 disabled:opacity-50"
              style={{
                background: isSpinning 
                  ? 'linear-gradient(180deg, #666 0%, #444 100%)'
                  : 'linear-gradient(180deg, #ffd700 0%, #ff8c00 50%, #ff6600 100%)',
                border: '4px solid rgba(255,255,255,0.3)',
                boxShadow: isSpinning 
                  ? '0 4px 20px rgba(0,0,0,0.4)' 
                  : '0 4px 30px rgba(255,215,0,0.6), inset 0 2px 10px rgba(255,255,255,0.3)'
              }}
              data-testid="button-spin"
            >
              {isSpinning ? (
                <motion.div 
                  className="w-8 h-8 border-4 border-white/30 border-t-white rounded-full"
                  animate={{ rotate: 360 }}
                  transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }}
                />
              ) : (
                <span className="text-2xl font-black text-purple-900">SPIN</span>
              )}
            </button>

            <button
              onClick={() => {
                setAutoPlay(!autoPlay);
                if (!autoPlay && !isSpinning) {
                  spin(currentBet);
                }
              }}
              className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${autoPlay ? 'ring-2 ring-green-400' : ''}`}
              style={{
                background: autoPlay 
                  ? 'linear-gradient(180deg, #22c55e 0%, #16a34a 100%)'
                  : 'linear-gradient(180deg, #3d2a5c 0%, #2d1b4e 100%)',
                border: '2px solid rgba(255,215,0,0.4)'
              }}
              data-testid="button-autoplay"
            >
              <RotateCcw className={`w-4 h-4 ${autoPlay ? 'text-white' : 'text-yellow-400'}`} />
            </button>

            <button
              onClick={increaseBet}
              disabled={isSpinning || betIndex === BET_AMOUNTS.length - 1}
              className="w-12 h-12 rounded-full flex items-center justify-center transition-all active:scale-95 disabled:opacity-50"
              style={{
                background: 'linear-gradient(180deg, #3d2a5c 0%, #2d1b4e 100%)',
                border: '2px solid rgba(255,215,0,0.4)',
                boxShadow: '0 4px 15px rgba(0,0,0,0.3)'
              }}
              data-testid="button-increase-bet"
            >
              <Plus className="w-5 h-5 text-yellow-400" />
            </button>
          </div>

          <div className="flex justify-center gap-1 mt-2">
            {BET_AMOUNTS.map((bet, idx) => (
              <div 
                key={bet}
                className={`w-2 h-2 rounded-full transition-all ${idx === betIndex ? 'bg-yellow-400 scale-125' : 'bg-white/20'}`}
              />
            ))}
          </div>
        </div>
      </main>

      <AnimatePresence>
        {showBigWin && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
            onClick={() => setShowBigWin(false)}
          >
            <motion.div
              initial={{ scale: 0, rotate: -180 }}
              animate={{ scale: 1, rotate: 0 }}
              exit={{ scale: 0, rotate: 180 }}
              transition={{ type: "spring", damping: 15 }}
              className="text-center"
            >
              <motion.div
                animate={{ 
                  textShadow: [
                    '0 0 20px rgba(255,215,0,0.8)',
                    '0 0 60px rgba(255,215,0,1)',
                    '0 0 20px rgba(255,215,0,0.8)'
                  ]
                }}
                transition={{ duration: 0.5, repeat: Infinity }}
                className="text-6xl font-black mb-4"
                style={{
                  background: 'linear-gradient(180deg, #ffd700 0%, #ff8c00 50%, #ffd700 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                }}
              >
                BIG WIN!
              </motion.div>
              <motion.div
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ duration: 0.5, repeat: Infinity }}
                className="text-5xl font-bold text-white"
                style={{ textShadow: '0 0 30px rgba(255,215,0,0.8)' }}
              >
                ${winAmount.toFixed(2)}
              </motion.div>
              <div className="mt-6 text-white/60 text-sm">Tap to continue</div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
