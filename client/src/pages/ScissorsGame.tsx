import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { GameHeader } from "@/components/GameHeader";
import { BettingPanel } from "@/components/BettingPanel";
import { Button } from "@/components/ui/button";
import { useTelegram } from "@/components/TelegramProvider";
import { gamesConfig } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Hand, Scissors, FileText, Share2 } from "lucide-react";
import { useAudio } from "@/components/AudioProvider";
import { useLanguage } from "@/components/LanguageProvider";
import { formatCurrencyAmount } from "@/components/CurrencyProvider";

interface ScissorsGameProps {
  balance: number;
  onBalanceChange: (newBalance: number) => void;
  onBack: () => void;
}

type Choice = "rock" | "paper" | "scissors";
type Result = "win" | "lose" | "draw" | null;

const getChoiceName = (id: Choice, t: (key: string) => string) => {
  switch (id) {
    case "rock": return t("rock");
    case "paper": return t("paper");
    case "scissors": return t("scissors");
  }
};

const choices: { id: Choice; icon: typeof Hand; beats: Choice }[] = [
  { id: "rock", icon: Hand, beats: "scissors" },
  { id: "paper", icon: FileText, beats: "rock" },
  { id: "scissors", icon: Scissors, beats: "paper" },
];

export function ScissorsGame({ balance, onBalanceChange, onBack }: ScissorsGameProps) {
  const gameConfig = gamesConfig.find((g) => g.id === "scissors")!;
  const { hapticFeedback, user, shareGameResult } = useTelegram();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { setCurrentGame, playSound } = useAudio();
  const { t } = useLanguage();
  // Games always use USD - Stars are only for conversion, not playing

  const [playerChoice, setPlayerChoice] = useState<Choice | null>(null);
  const [computerChoice, setComputerChoice] = useState<Choice | null>(null);
  const [result, setResult] = useState<Result>(null);
  const [history, setHistory] = useState<{ result: Result; playerChoice: Choice }[]>([]);

  useEffect(() => {
    setCurrentGame("scissors");
  }, [setCurrentGame]);

  const playMutation = useMutation({
    mutationFn: async ({ betAmount, choice }: { betAmount: number; choice: Choice }) => {
      const response = await apiRequest("POST", "/api/games/scissors/play", {
        odejs: user?.id || "demo",
        amount: betAmount,
        choice,
      });
      return response.json();
    },
    onMutate: async ({ choice }) => {
      setPlayerChoice(choice);
      setComputerChoice(null);
      setResult(null);
      
      await new Promise((r) => setTimeout(r, 500));
      
      const randomChoices: Choice[] = ["rock", "paper", "scissors"];
      for (let i = 0; i < 10; i++) {
        await new Promise((r) => setTimeout(r, 100));
        setComputerChoice(randomChoices[Math.floor(Math.random() * 3)]);
      }
    },
    onSuccess: (data) => {
      setComputerChoice(data.computerChoice);
      setResult(data.result);
      
      if (data.newBalance !== undefined) {
        onBalanceChange(data.newBalance);
      }
      
      setHistory((prev) => [
        { result: data.result, playerChoice: data.playerChoice },
        ...prev.slice(0, 9),
      ]);
      
      if (data.result === "win") {
        hapticFeedback("heavy");
        toast({
          title: t("youWon"),
          description: `${formatCurrencyAmount(data.payout, "usd", true)} (2x)`,
        });
      } else if (data.result === "draw") {
        hapticFeedback("medium");
        toast({
          title: t("tie"),
          description: t("betReturned"),
        });
      } else {
        hapticFeedback("rigid");
      }
      
      queryClient.invalidateQueries({ queryKey: ["/api/users/telegram"] });
    },
    onError: () => {
      toast({
        title: t("error"),
        description: `${t("failedToPlay")}. ${t("tryAgain")}`,
        variant: "destructive",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/users/telegram"] });
    },
  });

  const [selectedChoice, setSelectedChoice] = useState<Choice | null>(null);

  const handlePlay = (betAmount: number) => {
    if (!selectedChoice || playMutation.isPending) return;
    hapticFeedback("medium");
    playMutation.mutate({ betAmount, choice: selectedChoice });
  };

  const resetGame = () => {
    setPlayerChoice(null);
    setComputerChoice(null);
    setResult(null);
    setSelectedChoice(null);
  };

  const getResultColor = (r: Result) => {
    if (r === "win") return "text-primary";
    if (r === "lose") return "text-destructive";
    return "text-yellow-500";
  };

  return (
    <div 
      className="h-screen flex flex-col overflow-hidden"
      style={{
        backgroundImage: `url(/games/scissors/background.png)`,
        backgroundSize: 'cover',
        backgroundPosition: 'center'
      }}
      data-testid="page-scissors-game"
    >
      <GameHeader title={t("scissorsTitle")} balance={balance} onBack={onBack} gameType="scissors" schemaGameType="scissors" />

      <main className="flex-1 flex flex-col p-2 gap-2 overflow-hidden">
        <div className="flex gap-1.5 overflow-x-auto hide-scrollbar py-1 flex-shrink-0">
          {history.map((h, i) => (
            <span
              key={i}
              className={`px-2 py-1 rounded-lg text-xs font-bold whitespace-nowrap ${
                h.result === "win"
                  ? "bg-emerald-500/30 text-emerald-400 border border-emerald-500/50"
                  : h.result === "lose"
                  ? "bg-red-500/30 text-red-400 border border-red-500/50"
                  : "bg-yellow-500/30 text-yellow-400 border border-yellow-500/50"
              }`}
            >
              {h.result === "win" ? t("youWon") : h.result === "lose" ? t("youLost") : t("tie")}
            </span>
          ))}
          {history.length === 0 && (
            <span className="text-sm text-white/50">{t("noHistory")}</span>
          )}
        </div>

        <div className="flex-1 flex flex-col items-center justify-center gap-4 min-h-0">
          <div className="flex items-center gap-6">
            <div className="text-center">
              <p className="text-sm text-white/60 mb-2">Вы</p>
              <div
                className={`w-20 h-20 rounded-2xl flex items-center justify-center border-2 bg-black/40 backdrop-blur-sm ${
                  result === "win"
                    ? "border-emerald-500 shadow-lg shadow-emerald-500/30"
                    : result === "lose"
                    ? "border-red-500 shadow-lg shadow-red-500/30"
                    : playerChoice
                    ? "border-white/30"
                    : "border-dashed border-white/20"
                }`}
              >
                {playerChoice ? (
                  (() => {
                    const choice = choices.find((c) => c.id === playerChoice);
                    const Icon = choice?.icon || Hand;
                    return <Icon className="w-8 h-8 text-white" />;
                  })()
                ) : (
                  <span className="text-2xl text-white/50">?</span>
                )}
              </div>
            </div>

            <div className="text-xl font-bold text-white/60">VS</div>

            <div className="text-center">
              <p className="text-sm text-white/60 mb-2">{t("bot")}</p>
              <div
                className={`w-20 h-20 rounded-2xl flex items-center justify-center border-2 bg-black/40 backdrop-blur-sm ${
                  result === "lose"
                    ? "border-emerald-500 shadow-lg shadow-emerald-500/30"
                    : result === "win"
                    ? "border-red-500 shadow-lg shadow-red-500/30"
                    : computerChoice
                    ? "border-white/30"
                    : "border-dashed border-white/20"
                } ${playMutation.isPending && !result ? "animate-pulse" : ""}`}
              >
                {computerChoice ? (
                  (() => {
                    const choice = choices.find((c) => c.id === computerChoice);
                    const Icon = choice?.icon || Hand;
                    return <Icon className="w-8 h-8 text-white" />;
                  })()
                ) : (
                  <span className="text-2xl text-white/50">?</span>
                )}
              </div>
            </div>
          </div>

          {result && (
            <div
              className={`text-2xl font-bold px-6 py-2 rounded-xl ${
                result === "win" 
                  ? "bg-emerald-500/30 text-emerald-400 border border-emerald-500/50" 
                  : result === "lose" 
                  ? "bg-red-500/30 text-red-400 border border-red-500/50"
                  : "bg-yellow-500/30 text-yellow-400 border border-yellow-500/50"
              } animate-in zoom-in duration-300`}
            >
              {result === "win" ? t("youWon") : result === "lose" ? t("youLost") : t("tie")}
            </div>
          )}
        </div>

        <div className="flex-shrink-0">
          {!result && (
            <div className="bg-black/60 backdrop-blur-sm border border-emerald-500/30 rounded-xl p-3 mb-2">
              <p className="text-sm text-white/60 mb-2 text-center">{t("chooseMove")} (2x)</p>
              <div className="flex justify-center gap-3">
                {choices.map((choice) => {
                  const Icon = choice.icon;
                  return (
                    <Button
                      key={choice.id}
                      variant={selectedChoice === choice.id ? "default" : "secondary"}
                      className={`w-16 h-16 flex flex-col gap-1 ${selectedChoice === choice.id ? "bg-emerald-500 hover:bg-emerald-600" : "bg-black/40"}`}
                      onClick={() => {
                        hapticFeedback("light");
                        setSelectedChoice(choice.id);
                      }}
                      disabled={playMutation.isPending}
                      data-testid={`button-${choice.id}`}
                    >
                      <Icon className="w-6 h-6" />
                      <span className="text-[10px]">{getChoiceName(choice.id, t)}</span>
                    </Button>
                  );
                })}
              </div>
            </div>
          )}

          {result ? (
            <div className="flex gap-2">
              <Button className="flex-1 h-10 bg-emerald-500 hover:bg-emerald-600" onClick={resetGame} data-testid="button-play-again">
                {t("playAgain")}
              </Button>
              {result === "win" && (
                <Button
                  variant="secondary"
                  className="h-10 px-4 bg-black/40"
                  onClick={() => {
                    hapticFeedback("light");
                    shareGameResult("I won at Rock Paper Scissors! Play with me at Telegram Casino");
                  }}
                  data-testid="button-share"
                >
                  <Share2 className="w-5 h-5" />
                </Button>
              )}
            </div>
          ) : (
            <BettingPanel
              balance={balance}
              minBet={gameConfig.minBet}
              maxBet={gameConfig.maxBet}
              onBet={handlePlay}
              isPlaying={playMutation.isPending}
              buttonText={playMutation.isPending ? t("playing") : t("play")}
              disabled={!selectedChoice}
              compact
            />
          )}
        </div>
      </main>
    </div>
  );
}
