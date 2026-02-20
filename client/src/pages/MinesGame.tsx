import { useState, useCallback, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { GameHeader } from "@/components/GameHeader";
import { BettingPanel } from "@/components/BettingPanel";
import { Button } from "@/components/ui/button";
import { useTelegram } from "@/components/TelegramProvider";
import { gamesConfig } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { Gem, Bomb, Sparkles } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useAudio } from "@/components/AudioProvider";
import { useLanguage } from "@/components/LanguageProvider";
import { formatCurrencyAmount } from "@/components/CurrencyProvider";

interface MinesGameProps {
  balance: number;
  onBalanceChange: (newBalance: number) => void;
  onBack: () => void;
}

type CellState = "hidden" | "gem" | "mine";

export function MinesGame({ balance, onBalanceChange, onBack }: MinesGameProps) {
  const gameConfig = gamesConfig.find((g) => g.id === "mines")!;
  const { hapticFeedback, user } = useTelegram();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { setCurrentGame, playSound } = useAudio();
  const { t } = useLanguage();
  // Games always use USD - Stars are only for conversion, not playing
  
  const GRID_SIZE = 25;
  const [minesCount, setMinesCount] = useState(5);
  const [isPlaying, setIsPlaying] = useState(false);
  const [betAmount, setBetAmount] = useState(0);
  const [cells, setCells] = useState<CellState[]>(Array(GRID_SIZE).fill("hidden"));
  const [minePositions, setMinePositions] = useState<number[]>([]);
  const [revealedCount, setRevealedCount] = useState(0);
  const [currentMultiplier, setCurrentMultiplier] = useState(0.60);
  const [isGameOver, setIsGameOver] = useState(false);
  const [isWin, setIsWin] = useState(false);
  const [gameId, setGameId] = useState("");

  useEffect(() => {
    setCurrentGame("mines");
  }, [setCurrentGame]);

  const calculateMultiplier = useCallback((revealed: number, mines: number) => {
    // Base multiplier depends on mines count: each mine adds +0.12
    // 1 mine = 0.12, 2 mines = 0.24, 3 mines = 0.36, etc.
    const baseMultiplier = 0.12 * mines;
    
    if (revealed === 0) return baseMultiplier;
    
    // Progressive increase per revealed cell
    // More mines = higher growth rate per reveal
    const safeSpots = GRID_SIZE - mines;
    const growthPerReveal = 0.12 + (mines * 0.05); // Growth rate increases with mines
    
    const multiplier = baseMultiplier + (revealed * growthPerReveal);
    return Math.floor(multiplier * 100) / 100; // Round to 2 decimal places
  }, []);

  const startMutation = useMutation({
    mutationFn: async (amount: number) => {
      const response = await apiRequest("POST", "/api/games/mines/start", {
        odejs: user?.id || "demo",
        amount,
        minesCount,
        currency: "usd",
      });
      return response.json();
    },
    onSuccess: (data, amount) => {
      setGameId(data.gameId);
      setMinePositions(data.minePositions);
      setCells(Array(GRID_SIZE).fill("hidden"));
      setRevealedCount(0);
      setCurrentMultiplier(0.12 * minesCount); // Base multiplier: 0.12 per mine
      setBetAmount(amount);
      setIsPlaying(true);
      setIsGameOver(false);
      setIsWin(false);
      if (data.newBalance !== undefined) {
        onBalanceChange(data.newBalance);
      }
    },
    onError: () => {
      toast({
        title: t("error"),
        description: `${t("failedToStart")}. ${t("tryAgain")}`,
        variant: "destructive",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/users/telegram"] });
    },
  });

  const cashoutMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/games/mines/cashout", {
        odejs: user?.id || "demo",
        betAmount,
        multiplier: currentMultiplier,
        revealedCount,
        currency: "usd",
      });
      return response.json();
    },
    onSuccess: (data) => {
      if (data.newBalance !== undefined) {
        onBalanceChange(data.newBalance);
      }
      queryClient.invalidateQueries({ queryKey: ["/api/users/telegram"] });
    },
    onError: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users/telegram"] });
    },
  });

  const lostMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/games/mines/lost", {
        odejs: user?.id || "demo",
        betAmount,
        revealedCount,
        currency: "usd",
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users/telegram"] });
    },
    onError: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users/telegram"] });
    },
  });

  const startGame = (amount: number) => {
    hapticFeedback("medium");
    startMutation.mutate(amount);
  };

  const revealMutation = useMutation({
    mutationFn: async (cellIndex: number) => {
      const response = await apiRequest("POST", "/api/games/mines/reveal", {
        gameId,
        cellIndex,
        minePositions,
        revealedCount,
      });
      return response.json();
    },
    onSuccess: (data, cellIndex) => {
      if (data.isMine) {
        hapticFeedback("heavy");
        const newCells = [...cells];
        minePositions.forEach((pos) => {
          newCells[pos] = "mine";
        });
        newCells[cellIndex] = "mine";
        setCells(newCells);
        setIsGameOver(true);
        setIsWin(false);
        setIsPlaying(false);
        // Record lost bet on backend
        lostMutation.mutate();
        queryClient.invalidateQueries({ queryKey: ["/api/users/telegram"] });
      } else {
        hapticFeedback("light");
        const newCells = [...cells];
        newCells[cellIndex] = "gem";
        setCells(newCells);
        
        const newRevealed = revealedCount + 1;
        setRevealedCount(newRevealed);
        setCurrentMultiplier(data.multiplier);
        
        if (newRevealed === GRID_SIZE - minesCount) {
          setIsGameOver(true);
          setIsWin(true);
          setIsPlaying(false);
          hapticFeedback("heavy");
          // Auto-cashout on full clear
          cashoutMutation.mutate();
          toast({
            title: t("youWon"),
            description: formatCurrencyAmount(betAmount * data.multiplier, "usd", true),
          });
        }
      }
    },
    onError: () => {
      toast({
        title: t("error"),
        description: `${t("failedToStart")}. ${t("tryAgain")}`,
        variant: "destructive",
      });
    },
  });

  const revealCell = (index: number) => {
    if (!isPlaying || cells[index] !== "hidden" || isGameOver || revealMutation.isPending) return;
    revealMutation.mutate(index);
  };

  const cashOut = () => {
    if (!isPlaying || revealedCount === 0) return;
    
    hapticFeedback("heavy");
    
    const newCells = [...cells];
    minePositions.forEach((pos) => {
      if (newCells[pos] === "hidden") {
        newCells[pos] = "mine";
      }
    });
    setCells(newCells);
    
    setIsGameOver(true);
    setIsWin(true);
    setIsPlaying(false);
    
    // Save cashout to backend
    cashoutMutation.mutate();
    
    toast({
      title: t("cashed"),
      description: `${formatCurrencyAmount(betAmount * currentMultiplier, "usd", true)} @ ${currentMultiplier.toFixed(2)}x`,
    });
  };

  const resetGame = () => {
    setCells(Array(GRID_SIZE).fill("hidden"));
    setMinePositions([]);
    setRevealedCount(0);
    setCurrentMultiplier(0.12);
    setBetAmount(0);
    setIsPlaying(false);
    setIsGameOver(false);
    setIsWin(false);
    setGameId("");
  };

  return (
    <div 
      className="h-screen flex flex-col overflow-hidden"
      style={{
        backgroundImage: `url(/games/mines/background.png)`,
        backgroundSize: 'cover',
        backgroundPosition: 'center'
      }}
      data-testid="page-mines-game"
    >
      <GameHeader title={t("minesTitle")} balance={balance} onBack={onBack} gameType="mines" schemaGameType="mines" />

      <main className="flex-1 flex flex-col p-2 gap-2 overflow-hidden">
        <div className="flex items-center justify-between bg-black/60 backdrop-blur-sm border border-emerald-500/30 rounded-xl p-2 flex-shrink-0">
          <div className="text-center">
            <p className="text-xs text-white/60">{t("revealed")}</p>
            <p className="text-lg font-bold text-emerald-400">{revealedCount}</p>
          </div>
          <div className="text-center">
            <p className="text-xs text-white/60">{t("multiplier")}</p>
            <p className="text-lg font-bold text-white">{currentMultiplier.toFixed(2)}x</p>
          </div>
          <div className="text-center">
            <p className="text-xs text-white/60">{t("payout")}</p>
            <p className="text-lg font-bold text-emerald-400">
              ${(betAmount * currentMultiplier).toFixed(2)}
            </p>
          </div>
        </div>

        <div className="flex-1 flex items-center justify-center min-h-0">
          <div className="grid grid-cols-5 gap-1.5 w-full max-w-[280px] aspect-square">
            {cells.map((cell, index) => (
              <button
                key={index}
                onClick={() => revealCell(index)}
                disabled={!isPlaying || cell !== "hidden" || isGameOver || revealMutation.isPending}
                className={`
                  aspect-square rounded-lg border-2 flex items-center justify-center
                  transition-all duration-200 active:scale-95
                  ${cell === "hidden" 
                    ? "bg-black/40 border-white/20 hover:bg-emerald-500/20 hover:border-emerald-500/50" 
                    : cell === "gem"
                    ? "bg-emerald-500/30 border-emerald-500 shadow-lg shadow-emerald-500/20"
                    : "bg-red-500/30 border-red-500 shadow-lg shadow-red-500/20"
                  }
                  ${!isPlaying && cell === "hidden" ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}
                `}
                data-testid={`cell-${index}`}
              >
                {cell === "gem" && <Gem className="w-5 h-5 text-emerald-400" />}
                {cell === "mine" && <Bomb className="w-5 h-5 text-red-400" />}
                {cell === "hidden" && isPlaying && (
                  <Sparkles className="w-3 h-3 text-white/30" />
                )}
              </button>
            ))}
          </div>
        </div>

        {isGameOver && (
          <div className={`text-center p-3 rounded-xl flex-shrink-0 ${isWin ? "bg-emerald-500/30 border border-emerald-500/50" : "bg-red-500/30 border border-red-500/50"}`}>
            <p className={`text-lg font-bold ${isWin ? "text-emerald-400" : "text-red-400"}`}>
              {isWin ? `${t("youWon")} $${(betAmount * currentMultiplier).toFixed(2)}!` : t("boom")}
            </p>
          </div>
        )}

        <div className="flex-shrink-0">
          {isGameOver ? (
            <Button
              className="w-full h-10 bg-emerald-500 hover:bg-emerald-600"
              onClick={resetGame}
              data-testid="button-play-again"
            >
              {t("playAgain")}
            </Button>
          ) : isPlaying ? (
            <Button
              className="w-full h-10 text-lg font-bold bg-emerald-500 hover:bg-emerald-600"
              onClick={cashOut}
              disabled={revealedCount === 0}
              data-testid="button-cash-out"
            >
              {t("cashout")} ${(betAmount * currentMultiplier).toFixed(2)}
            </Button>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center justify-between bg-black/60 backdrop-blur-sm border border-emerald-500/30 rounded-xl p-2">
                <span className="text-sm text-white/70">{t("mines")}</span>
                <Select
                  value={minesCount.toString()}
                  onValueChange={(v) => setMinesCount(parseInt(v))}
                >
                  <SelectTrigger className="w-20 bg-black/40 border-emerald-500/30" data-testid="select-mines">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[1, 3, 5, 10, 15, 20].map((n) => (
                      <SelectItem key={n} value={n.toString()}>
                        {n}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <BettingPanel
                balance={balance}
                minBet={gameConfig.minBet}
                maxBet={gameConfig.maxBet}
                onBet={startGame}
                isPlaying={startMutation.isPending}
                buttonText={t("start")}
                compact
              />
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
