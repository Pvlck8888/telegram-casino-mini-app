import { useState, useCallback, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { GameHeader } from "@/components/GameHeader";
import { BettingPanel } from "@/components/BettingPanel";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { useTelegram } from "@/components/TelegramProvider";
import { gamesConfig } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { Dice1, Dice2, Dice3, Dice4, Dice5, Dice6, ArrowUp, ArrowDown, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAudio } from "@/components/AudioProvider";
import { useLanguage } from "@/components/LanguageProvider";
import { formatCurrencyAmount } from "@/components/CurrencyProvider";

interface DiceGameProps {
  balance: number;
  onBalanceChange: (newBalance: number) => void;
  onBack: () => void;
}

const diceIcons = [Dice1, Dice2, Dice3, Dice4, Dice5, Dice6];

export function DiceGame({ balance, onBalanceChange, onBack }: DiceGameProps) {
  const gameConfig = gamesConfig.find((g) => g.id === "dice")!;
  const { hapticFeedback, user, telegramUser } = useTelegram();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { setCurrentGame, playSound } = useAudio();
  const { t } = useLanguage();
  // Games always use USD - Stars are only for conversion, not playing
  
  const [target, setTarget] = useState(50);
  const [isOver, setIsOver] = useState(true);
  const [lastRoll, setLastRoll] = useState<number | null>(null);
  const [lastWin, setLastWin] = useState<boolean | null>(null);
  const [displayRoll, setDisplayRoll] = useState<number | null>(null);
  const [history, setHistory] = useState<{ roll: number; isWin: boolean }[]>([]);

  useEffect(() => {
    setCurrentGame("dice");
  }, [setCurrentGame]);

  const calculateMultiplier = useCallback((t: number, over: boolean) => {
    const winChance = over ? (100 - t) / 100 : t / 100;
    if (winChance <= 0) return 0;
    return Math.floor((0.97 / winChance) * 100) / 100;
  }, []);

  const winChance = isOver ? 100 - target : target;
  const multiplier = calculateMultiplier(target, isOver);

  const rollMutation = useMutation({
    mutationFn: async (betAmount: number) => {
      // Animate roll while waiting for response
      const animateRoll = async () => {
        const rollDuration = 1500;
        const rollInterval = 50;
        const rolls = rollDuration / rollInterval;
        
        for (let i = 0; i < rolls; i++) {
          await new Promise((r) => setTimeout(r, rollInterval - i));
          setDisplayRoll(Math.floor(Math.random() * 100) + 1);
        }
      };
      
      const [response] = await Promise.all([
        apiRequest("POST", "/api/games/dice/roll", {
          odejs: user?.id || "demo",
          amount: betAmount,
          target,
          isOver,
          currency: "usd",
        }),
        animateRoll(),
      ]);
      
      return response.json();
    },
    onSuccess: (data) => {
      setLastRoll(data.roll);
      setDisplayRoll(data.roll);
      setLastWin(data.isWin);
      setHistory((prev) => [{ roll: data.roll, isWin: data.isWin }, ...prev.slice(0, 9)]);
      
      // Use server balance
      if (data.newBalance !== undefined) {
        onBalanceChange(data.newBalance);
      }
      
      if (data.isWin) {
        hapticFeedback("heavy");
        toast({
          title: t("youWon"),
          description: formatCurrencyAmount(data.payout, "usd", true),
        });
      } else {
        hapticFeedback("rigid");
      }
      
      // Invalidate user query to sync balance
      queryClient.invalidateQueries({ queryKey: ["/api/users/telegram"] });
    },
    onError: () => {
      toast({
        title: t("error"),
        description: `${t("failedToRoll")}. ${t("tryAgain")}`,
        variant: "destructive",
      });
      // Revert balance on error
      queryClient.invalidateQueries({ queryKey: ["/api/users/telegram"] });
    },
  });

  const roll = (betAmount: number) => {
    if (rollMutation.isPending) return;
    hapticFeedback("medium");
    rollMutation.mutate(betAmount);
  };

  const currentDisplayRoll = displayRoll ?? lastRoll;
  const DiceIcon = currentDisplayRoll ? diceIcons[Math.min(5, Math.floor((currentDisplayRoll - 1) / 16.67))] : Dice1;

  return (
    <div 
      className="h-screen flex flex-col overflow-hidden"
      style={{
        backgroundImage: `url(/games/dice/background.png)`,
        backgroundSize: 'cover',
        backgroundPosition: 'center'
      }}
      data-testid="page-dice-game"
    >
      <GameHeader title={t("diceTitle")} balance={balance} onBack={onBack} gameType="dice" schemaGameType="dice" />

      <main className="flex-1 flex flex-col p-2 gap-2 overflow-hidden">
        <div className="flex gap-1.5 overflow-x-auto hide-scrollbar py-1 flex-shrink-0">
          {history.map((h, i) => (
            <span
              key={i}
              className={`px-2 py-1 rounded-lg text-xs font-bold whitespace-nowrap ${
                h.isWin ? "bg-emerald-500/30 text-emerald-400 border border-emerald-500/50" : "bg-red-500/30 text-red-400 border border-red-500/50"
              }`}
            >
              {h.roll}
            </span>
          ))}
          {history.length === 0 && (
            <span className="text-sm text-white/50">{t("noHistory")}</span>
          )}
        </div>

        <div className="flex-1 flex items-center justify-center">
          <div className="relative">
            <div
              className={`
                w-32 h-32 sm:w-40 sm:h-40 rounded-3xl flex items-center justify-center
                transition-all duration-300 bg-black/60 backdrop-blur-sm
                ${rollMutation.isPending ? "animate-bounce" : ""}
                ${lastWin === true ? "border-2 border-emerald-500 shadow-lg shadow-emerald-500/30" : 
                  lastWin === false ? "border-2 border-red-500 shadow-lg shadow-red-500/30" :
                  "border-2 border-white/20"}
              `}
            >
              {rollMutation.isPending ? (
                <Loader2 className="w-12 h-12 text-emerald-400 animate-spin" />
              ) : (
                <div className="text-center">
                  <DiceIcon className={`w-12 h-12 mx-auto mb-1 ${
                    lastWin === true ? "text-emerald-400" : 
                    lastWin === false ? "text-red-400" : 
                    "text-white"
                  }`} />
                  <span className={`text-3xl font-bold ${
                    lastWin === true ? "text-emerald-400" : 
                    lastWin === false ? "text-red-400" : 
                    "text-white"
                  }`}>
                    {currentDisplayRoll ?? "?"}
                  </span>
                </div>
              )}
            </div>

            {lastWin !== null && !rollMutation.isPending && (
              <div className={`absolute -bottom-6 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full text-sm font-bold ${
                lastWin ? "bg-emerald-500 text-white" : "bg-red-500 text-white"
              }`}>
                {lastWin ? t("youWon") : t("youLost")}
              </div>
            )}
          </div>
        </div>

        <div className="bg-black/60 backdrop-blur-sm border border-emerald-500/30 rounded-xl p-3 space-y-3 flex-shrink-0">
          <div className="flex gap-2">
            <Button
              variant={isOver ? "default" : "secondary"}
              className={`flex-1 gap-2 h-10 ${isOver ? "bg-emerald-500 hover:bg-emerald-600" : "bg-black/40"}`}
              onClick={() => {
                hapticFeedback("light");
                setIsOver(true);
              }}
              disabled={rollMutation.isPending}
              data-testid="button-over"
            >
              <ArrowUp className="w-4 h-4" />
              {t("over")}
            </Button>
            <Button
              variant={!isOver ? "default" : "secondary"}
              className={`flex-1 gap-2 h-10 ${!isOver ? "bg-emerald-500 hover:bg-emerald-600" : "bg-black/40"}`}
              onClick={() => {
                hapticFeedback("light");
                setIsOver(false);
              }}
              disabled={rollMutation.isPending}
              data-testid="button-under"
            >
              <ArrowDown className="w-4 h-4" />
              {t("under")}
            </Button>
          </div>

          <div className="space-y-1">
            <div className="flex justify-between text-sm">
              <span className="text-white/60">{t("target")}</span>
              <span className="font-medium text-white">{target}</span>
            </div>
            <Slider
              value={[target]}
              onValueChange={([v]) => setTarget(v)}
              min={2}
              max={98}
              step={1}
              disabled={rollMutation.isPending}
              data-testid="slider-target"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="text-center p-2 bg-black/40 rounded-lg border border-white/10">
              <p className="text-xs text-white/60">{t("chance")}</p>
              <p className="text-lg font-bold text-white">{winChance}%</p>
            </div>
            <div className="text-center p-2 bg-black/40 rounded-lg border border-white/10">
              <p className="text-xs text-white/60">{t("multiplier")}</p>
              <p className="text-lg font-bold text-emerald-400">{multiplier.toFixed(2)}x</p>
            </div>
          </div>
        </div>

        <div className="flex-shrink-0">
          <BettingPanel
            balance={balance}
            minBet={gameConfig.minBet}
            maxBet={gameConfig.maxBet}
            onBet={roll}
            isPlaying={rollMutation.isPending}
            buttonText={rollMutation.isPending ? t("rolling") : t("roll")}
            compact
          />
        </div>
      </main>
    </div>
  );
}
