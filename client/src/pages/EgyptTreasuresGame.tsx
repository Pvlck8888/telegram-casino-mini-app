import { useState, useRef, useEffect, useCallback } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { GameHeader } from "@/components/GameHeader";
import { useTelegram } from "@/components/TelegramProvider";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAudio } from "@/components/AudioProvider";
import { Minus, Plus, Zap, RotateCcw, Info, Home, Volume2, X, Sparkles } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

import pharaohImg from "@assets/generated_images/egyptian_pharaoh_mask_symbol.png";
import anubisImg from "@assets/generated_images/egyptian_anubis_god_symbol.png";
import scarabImg from "@assets/generated_images/egyptian_scarab_beetle_symbol.png";
import eyeImg from "@assets/generated_images/eye_of_horus_symbol.png";
import snakeImg from "@assets/generated_images/egyptian_cobra_snake_symbol.png";
import catImg from "@assets/generated_images/egyptian_bastet_cat_symbol.png";
import pyramidsImg from "@assets/generated_images/egyptian_pyramids_scatter_symbol.png";
import sphinxImg from "@assets/generated_images/egyptian_sphinx_symbol.png";

const SYMBOL_IMAGES: Record<string, string> = {
  pharaoh: pharaohImg,
  anubis: anubisImg,
  sphinx: sphinxImg,
  scarab: scarabImg,
  snake: snakeImg,
  cat: catImg,
  eye: eyeImg,
  pyramids: pyramidsImg,
};

interface EgyptTreasuresGameProps {
  balance: number;
  onBalanceChange: (newBalance: number) => void;
  onBack: () => void;
}

const REEL_COUNT = 5;
const ROWS = 3;

const SYMBOLS = [
  { id: "pharaoh", name: "Pharaoh", payout: [0, 0, 15, 50, 200], isWild: true },
  { id: "pyramids", name: "Pyramids", payout: [0, 0, 3, 10, 50], isScatter: true },
  { id: "anubis", name: "Anubis", payout: [0, 0, 10, 30, 100] },
  { id: "sphinx", name: "Sphinx", payout: [0, 0, 10, 30, 100] },
  { id: "snake", name: "Cobra", payout: [0, 0, 5, 20, 60] },
  { id: "cat", name: "Bastet", payout: [0, 0, 4, 15, 40] },
  { id: "eye", name: "Eye of Horus", payout: [0, 0, 4, 15, 40] },
  { id: "scarab", name: "Scarab", payout: [0, 0, 3, 10, 25] },
];

const PAYLINES = [
  [[1,0],[1,1],[1,2],[1,3],[1,4]],
  [[0,0],[0,1],[0,2],[0,3],[0,4]],
  [[2,0],[2,1],[2,2],[2,3],[2,4]],
  [[0,0],[1,1],[2,2],[1,3],[0,4]],
  [[2,0],[1,1],[0,2],[1,3],[2,4]],
  [[0,0],[0,1],[1,2],[0,3],[0,4]],
  [[2,0],[2,1],[1,2],[2,3],[2,4]],
  [[1,0],[0,1],[0,2],[0,3],[1,4]],
  [[1,0],[2,1],[2,2],[2,3],[1,4]],
  [[0,0],[1,1],[1,2],[1,3],[0,4]],
];

const BET_AMOUNTS = [0.10, 0.20, 0.50, 1.00, 2.00, 5.00, 10.00, 20.00, 50.00];

interface MiniSlot {
  symbols: [number, number, number];
  multiplier: number;
}

const generateRandomGrid = (): number[][] => {
  const grid: number[][] = [];
  for (let row = 0; row < ROWS; row++) {
    const rowData: number[] = [];
    for (let col = 0; col < REEL_COUNT; col++) {
      const rand = Math.random();
      let symbolIndex: number;
      if (rand < 0.025) {
        symbolIndex = 1; // scatter (2.5%)
      } else if (rand < 0.045) {
        symbolIndex = 0; // wild (2%)
      } else {
        symbolIndex = Math.floor(Math.random() * 6) + 2; // regular symbols
      }
      rowData.push(symbolIndex);
    }
    grid.push(rowData);
  }
  return grid;
};

const generateMiniSlot = (): MiniSlot => {
  const symbols: [number, number, number] = [
    Math.floor(Math.random() * 3) + 1,
    Math.floor(Math.random() * 3) + 1,
    Math.floor(Math.random() * 3) + 1,
  ];
  let multiplier = 1;
  if (symbols[0] === symbols[1] && symbols[1] === symbols[2]) {
    if (symbols[0] === 1) multiplier = 2;
    else if (symbols[0] === 2) multiplier = 3;
    else multiplier = 5;
  }
  return { symbols, multiplier };
};

const SymbolIcon = ({ symbolId, size = 60 }: { symbolId: string; size?: number }) => {
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
      className="bg-amber-900/50 rounded flex items-center justify-center text-amber-300 text-xs"
      style={{ width: size, height: size }}
    >
      {symbolId}
    </div>
  );
};

const MiniSlotDisplay = ({ miniSlot, spinning }: { miniSlot: MiniSlot; spinning: boolean }) => {
  const miniSymbols = ["", "🏺", "💎", "👁️"];
  
  return (
    <div className="flex flex-col items-center gap-1 p-2 bg-gradient-to-b from-amber-900/80 to-amber-950/80 rounded-lg border border-amber-600/50">
      <div className="text-[10px] text-amber-400 font-medium">MINI SLOT</div>
      <div className="flex gap-1">
        {miniSlot.symbols.map((sym, i) => (
          <motion.div
            key={i}
            className="w-6 h-6 bg-amber-950 rounded flex items-center justify-center text-lg border border-amber-700/50"
            animate={spinning ? { rotateX: [0, 360, 720, 1080] } : {}}
            transition={{ duration: 0.8, delay: i * 0.1 }}
          >
            {miniSymbols[sym]}
          </motion.div>
        ))}
      </div>
      {miniSlot.multiplier > 1 && (
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="text-xs font-bold text-amber-300"
        >
          x{miniSlot.multiplier}
        </motion.div>
      )}
    </div>
  );
};

export function EgyptTreasuresGame({ balance, onBalanceChange, onBack }: EgyptTreasuresGameProps) {
  const { user, hapticFeedback } = useTelegram();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { playSound, setCurrentGame } = useAudio();

  const [grid, setGrid] = useState<number[][]>(() => generateRandomGrid());
  const [betIndex, setBetIndex] = useState(3);
  const [isSpinning, setIsSpinning] = useState(false);
  const [lastWin, setLastWin] = useState(0);
  const [winningCells, setWinningCells] = useState<Set<string>>(new Set());
  const [showPaytable, setShowPaytable] = useState(false);
  const [miniSlot, setMiniSlot] = useState<MiniSlot>({ symbols: [1, 2, 3], multiplier: 1 });
  const [freeSpins, setFreeSpins] = useState(0);
  const [freeSpinWins, setFreeSpinWins] = useState(0);
  const [autoSpin, setAutoSpin] = useState(false);
  const autoSpinRef = useRef(false);

  const bet = BET_AMOUNTS[betIndex];

  useEffect(() => {
    setCurrentGame("luxe");
    return () => setCurrentGame("lobby");
  }, [setCurrentGame]);

  const placeBetMutation = useMutation({
    mutationFn: async (data: { odejs: string; amount: number; gameType: string; result: "win" | "lose"; winAmount: number }) => {
      const response = await apiRequest("POST", "/api/bets", data);
      return response.json();
    },
    onSuccess: (data) => {
      if (data.newBalance !== undefined) {
        onBalanceChange(data.newBalance);
      }
      queryClient.invalidateQueries({ queryKey: ["/api/users", user?.id] });
    },
  });

  const calculateWins = useCallback((currentGrid: number[][], currentMiniSlot: MiniSlot) => {
    let totalWin = 0;
    const winCells = new Set<string>();
    
    for (let lineIndex = 0; lineIndex < PAYLINES.length; lineIndex++) {
      const line = PAYLINES[lineIndex];
      let firstSymbol = -1;
      let count = 0;
      let wildCount = 0;
      const lineCells: string[] = [];
      
      for (let i = 0; i < line.length; i++) {
        const [row, col] = line[i];
        const symbol = currentGrid[row][col];
        
        // Scatter (1) is skipped on paylines - doesn't count, doesn't break
        if (symbol === 1) {
          continue;
        }
        
        if (symbol === 0) {
          // Wild substitutes
          wildCount++;
          lineCells.push(`${row}-${col}`);
          if (firstSymbol === -1) count++;
          else count++;
        } else if (firstSymbol === -1) {
          firstSymbol = symbol;
          count = wildCount + 1;
          lineCells.push(`${row}-${col}`);
        } else if (symbol === firstSymbol) {
          count++;
          lineCells.push(`${row}-${col}`);
        } else {
          break;
        }
      }
      
      if (count >= 2 && firstSymbol >= 0) {
        const symbolData = SYMBOLS[firstSymbol];
        const payout = symbolData.payout[count - 1];
        if (payout > 0) {
          totalWin += payout * bet * currentMiniSlot.multiplier;
          lineCells.forEach(cell => winCells.add(cell));
        }
      }
    }
    
    // Count scatters (don't add to winCells - they only trigger free spins)
    let scatterCount = 0;
    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < REEL_COUNT; col++) {
        if (currentGrid[row][col] === 1) {
          scatterCount++;
        }
      }
    }
    
    return { totalWin, winCells, scatterCount };
  }, [bet]);

  const spin = useCallback(async () => {
    if (isSpinning || !user?.id) return;
    
    const currentBet = freeSpins > 0 ? 0 : bet;
    if (currentBet > balance) {
      toast({ title: "Insufficient balance", variant: "destructive" });
      setAutoSpin(false);
      autoSpinRef.current = false;
      return;
    }

    setIsSpinning(true);
    setLastWin(0);
    setWinningCells(new Set());
    hapticFeedback("medium");
    playSound("luxeSpin");

    try {
      // Call server for spin result
      const response = await fetch("/api/games/egypt/spin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          odejs: user.id,
          bet: bet,
          isFreeSpins: freeSpins > 0,
        }),
      });
      
      if (!response.ok) {
        throw new Error("Spin failed");
      }
      
      const result = await response.json();
      const finalGrid = result.grid;
      
      // Animate reels one by one
      await new Promise(resolve => setTimeout(resolve, 300));
      
      for (let col = 0; col < REEL_COUNT; col++) {
        await new Promise(resolve => setTimeout(resolve, 150));
        playSound("luxeReelStop");
        setGrid(prev => {
          const newGrid = [...prev.map(row => [...row])];
          for (let row = 0; row < ROWS; row++) {
            newGrid[row][col] = finalGrid[row][col];
          }
          return newGrid;
        });
      }
      
      await new Promise(resolve => setTimeout(resolve, 200));
      
      // Update state from server result
      setMiniSlot(result.miniSlot);
      setWinningCells(new Set(result.winCells));
      onBalanceChange(result.newBalance);
      
      if (freeSpins > 0) {
        setFreeSpins(prev => prev - 1);
      }
      
      if (result.awardedFreeSpins > 0) {
        setFreeSpins(prev => prev + result.awardedFreeSpins);
        playSound("luxeBonus");
        toast({ title: "🎉 FREE SPINS!", description: `+${result.awardedFreeSpins} Free Spins!` });
      }
      
      if (result.totalWin > 0) {
        setLastWin(result.totalWin);
        if (freeSpins > 0) {
          setFreeSpinWins(prev => prev + result.totalWin);
        }
        
        if (result.totalWin >= bet * 50) {
          playSound("luxeJackpot");
          hapticFeedback("heavy");
        } else if (result.totalWin >= bet * 10) {
          playSound("luxeBigWin");
          hapticFeedback("heavy");
        } else {
          playSound("luxeWin");
          hapticFeedback("light");
        }
      }
    } catch (error) {
      console.error("Spin error:", error);
      toast({ title: "Spin failed", variant: "destructive" });
    }
    
    setIsSpinning(false);
    
    if (autoSpinRef.current && freeSpins === 0) {
      setTimeout(() => {
        if (autoSpinRef.current) spin();
      }, 1500);
    } else if (freeSpins > 1) {
      setTimeout(() => spin(), 1500);
    }
  }, [isSpinning, bet, balance, freeSpins, hapticFeedback, playSound, onBalanceChange, toast, user?.id]);

  useEffect(() => {
    autoSpinRef.current = autoSpin;
  }, [autoSpin]);

  const toggleAutoSpin = () => {
    if (autoSpin) {
      setAutoSpin(false);
      autoSpinRef.current = false;
    } else {
      setAutoSpin(true);
      autoSpinRef.current = true;
      if (!isSpinning) spin();
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-950 via-amber-900 to-amber-950 flex flex-col">
      <GameHeader 
        title="Egypt Treasures" 
        balance={balance} 
        onBack={onBack}
      />
      
      <div className="flex-1 flex flex-col items-center justify-center p-2 gap-2">
        {freeSpins > 0 && (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="bg-gradient-to-r from-amber-600 to-yellow-500 px-4 py-2 rounded-full text-white font-bold flex items-center gap-2"
          >
            <Sparkles className="w-4 h-4" />
            FREE SPINS: {freeSpins} | Won: ${freeSpinWins.toFixed(2)}
          </motion.div>
        )}

        <div className="relative">
          <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-10">
            <MiniSlotDisplay miniSlot={miniSlot} spinning={isSpinning} />
          </div>
          
          <div className="relative bg-gradient-to-b from-amber-800 to-amber-950 p-3 pt-8 rounded-xl border-2 border-amber-600 shadow-2xl">
            <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0MCIgaGVpZ2h0PSI0MCI+CjxwYXRoIGQ9Ik0yMCAwTDQwIDIwTDIwIDQwTDAgMjBaIiBmaWxsPSJub25lIiBzdHJva2U9IiNmZmQ3MDAiIHN0cm9rZS1vcGFjaXR5PSIwLjEiLz4KPC9zdmc+')] opacity-30 pointer-events-none rounded-xl" />
            
            <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${REEL_COUNT}, 1fr)` }}>
              {grid.map((row, rowIndex) =>
                row.map((symbolIndex, colIndex) => {
                  const symbol = SYMBOLS[symbolIndex];
                  const isWinning = winningCells.has(`${rowIndex}-${colIndex}`);
                  
                  return (
                    <motion.div
                      key={`${rowIndex}-${colIndex}`}
                      className={`relative w-14 h-14 sm:w-16 sm:h-16 rounded-lg flex items-center justify-center overflow-hidden ${
                        isWinning 
                          ? "bg-gradient-to-br from-amber-500/50 to-yellow-400/50 ring-2 ring-yellow-400" 
                          : "bg-amber-950/80"
                      }`}
                      animate={isSpinning ? { 
                        y: [0, -10, 10, 0],
                        opacity: [1, 0.5, 0.5, 1]
                      } : isWinning ? {
                        scale: [1, 1.05, 1],
                      } : {}}
                      transition={{ 
                        duration: isSpinning ? 0.3 : 0.5,
                        repeat: isSpinning ? Infinity : isWinning ? Infinity : 0,
                        delay: isSpinning ? colIndex * 0.05 : 0
                      }}
                    >
                      <SymbolIcon symbolId={symbol.id} size={48} />
                      
                      {symbol.isWild && (
                        <div className="absolute top-0 left-0 right-0 bg-gradient-to-r from-amber-500 to-yellow-400 text-[8px] font-bold text-amber-950 text-center">
                          WILD
                        </div>
                      )}
                      {symbol.isScatter && (
                        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-r from-purple-500 to-pink-400 text-[8px] font-bold text-white text-center">
                          SCATTER
                        </div>
                      )}
                    </motion.div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        <AnimatePresence>
          {lastWin > 0 && (
            <motion.div
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              className="text-center"
            >
              <div className="text-2xl font-bold text-yellow-400 drop-shadow-lg">
                WIN ${lastWin.toFixed(2)}
              </div>
              {miniSlot.multiplier > 1 && (
                <div className="text-sm text-amber-300">x{miniSlot.multiplier} Multiplier!</div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex flex-col gap-3 w-full max-w-md px-4">
          <div className="flex items-center justify-between bg-amber-900/50 rounded-lg p-3 border border-amber-700/50">
            <div className="flex items-center gap-2">
              <span className="text-amber-400 text-sm">BET:</span>
              <span className="text-white font-bold">${bet.toFixed(2)}</span>
            </div>
            
            <div className="flex items-center gap-2">
              <button
                onClick={() => setBetIndex(Math.max(0, betIndex - 1))}
                disabled={isSpinning || freeSpins > 0}
                className="w-8 h-8 rounded-full bg-amber-700 hover:bg-amber-600 disabled:opacity-50 flex items-center justify-center"
                data-testid="button-decrease-bet"
              >
                <Minus className="w-4 h-4 text-white" />
              </button>
              <button
                onClick={() => setBetIndex(Math.min(BET_AMOUNTS.length - 1, betIndex + 1))}
                disabled={isSpinning || freeSpins > 0}
                className="w-8 h-8 rounded-full bg-amber-700 hover:bg-amber-600 disabled:opacity-50 flex items-center justify-center"
                data-testid="button-increase-bet"
              >
                <Plus className="w-4 h-4 text-white" />
              </button>
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={spin}
              disabled={isSpinning || (bet > balance && freeSpins === 0)}
              className="flex-1 h-14 bg-gradient-to-r from-amber-600 to-yellow-500 hover:from-amber-500 hover:to-yellow-400 disabled:opacity-50 rounded-xl font-bold text-lg text-amber-950 flex items-center justify-center gap-2 shadow-lg"
              data-testid="button-spin"
            >
              <Zap className="w-5 h-5" />
              {freeSpins > 0 ? "FREE SPIN" : "SPIN"}
            </button>
            
            <button
              onClick={toggleAutoSpin}
              disabled={freeSpins > 0}
              className={`w-14 h-14 rounded-xl flex items-center justify-center ${
                autoSpin 
                  ? "bg-red-600 hover:bg-red-500" 
                  : "bg-amber-800 hover:bg-amber-700"
              }`}
              data-testid="button-auto-spin"
            >
              {autoSpin ? <X className="w-5 h-5 text-white" /> : <RotateCcw className="w-5 h-5 text-amber-300" />}
            </button>
            
            <button
              onClick={() => setShowPaytable(true)}
              className="w-14 h-14 bg-amber-800 hover:bg-amber-700 rounded-xl flex items-center justify-center"
              data-testid="button-paytable"
            >
              <Info className="w-5 h-5 text-amber-300" />
            </button>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {showPaytable && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
            onClick={() => setShowPaytable(false)}
          >
            <motion.div
              initial={{ scale: 0.8 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.8 }}
              className="bg-gradient-to-b from-amber-900 to-amber-950 rounded-2xl p-4 max-w-sm w-full max-h-[80vh] overflow-y-auto border border-amber-600"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold text-amber-300">Paytable</h2>
                <button onClick={() => setShowPaytable(false)} className="text-amber-400">
                  <X className="w-6 h-6" />
                </button>
              </div>
              
              <div className="space-y-3">
                {SYMBOLS.map(symbol => (
                  <div key={symbol.id} className="flex items-center gap-3 bg-amber-950/50 rounded-lg p-2">
                    <SymbolIcon symbolId={symbol.id} size={40} />
                    <div className="flex-1">
                      <div className="text-amber-300 font-medium text-sm">{symbol.name}</div>
                      <div className="text-amber-500 text-xs">
                        {symbol.payout.slice(1).map((p, i) => p > 0 ? `${i+2}x=${p}` : null).filter(Boolean).join(" | ")}
                      </div>
                    </div>
                    {symbol.isWild && <span className="text-xs bg-amber-600 px-2 py-0.5 rounded text-amber-950 font-bold">WILD</span>}
                    {symbol.isScatter && <span className="text-xs bg-purple-600 px-2 py-0.5 rounded text-white font-bold">SCATTER</span>}
                  </div>
                ))}
              </div>
              
              <div className="mt-4 p-3 bg-amber-950/50 rounded-lg">
                <h3 className="text-amber-300 font-bold mb-2">Mini Slot Multipliers</h3>
                <div className="text-amber-500 text-sm space-y-1">
                  <div>🏺🏺🏺 = x2 Multiplier</div>
                  <div>💎💎💎 = x3 Multiplier</div>
                  <div>👁️👁️👁️ = x5 Multiplier</div>
                </div>
              </div>
              
              <div className="mt-4 p-3 bg-amber-950/50 rounded-lg">
                <h3 className="text-amber-300 font-bold mb-2">Free Spins</h3>
                <div className="text-amber-500 text-sm">
                  3+ Pyramids = 10 Free Spins!
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
