import { useState, useEffect, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { GameHeader } from "@/components/GameHeader";
import { BettingPanel } from "@/components/BettingPanel";
import { Button } from "@/components/ui/button";
import { useTelegram } from "@/components/TelegramProvider";
import { gamesConfig } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Share2 } from "lucide-react";
import { useAudio } from "@/components/AudioProvider";
import { useLanguage } from "@/components/LanguageProvider";
// Games always use USD - Stars are only for conversion

interface TurtleRaceGameProps {
  balance: number;
  onBalanceChange: (newBalance: number) => void;
  onBack: () => void;
}

type TurtleColor = "red" | "blue" | "yellow";

const getTurtleName = (id: TurtleColor, t: (key: string) => string) => {
  switch (id) {
    case "red": return t("redTurtle");
    case "blue": return t("blueTurtle");
    case "yellow": return t("yellowTurtle");
  }
};

const turtles: { id: TurtleColor; color: string; bgColor: string }[] = [
  { id: "red", color: "bg-red-500", bgColor: "bg-red-500/20" },
  { id: "blue", color: "bg-blue-500", bgColor: "bg-blue-500/20" },
  { id: "yellow", color: "bg-yellow-500", bgColor: "bg-yellow-500/20" },
];

export function TurtleRaceGame({ balance, onBalanceChange, onBack }: TurtleRaceGameProps) {
  const gameConfig = gamesConfig.find((g) => g.id === "turtle")!;
  const { hapticFeedback, user, shareGameResult } = useTelegram();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { setCurrentGame, playSound } = useAudio();
  const { t } = useLanguage();
  // Games always use USD - Stars are only for conversion, not playing

  const [selectedTurtle, setSelectedTurtle] = useState<TurtleColor | null>(null);
  const [positions, setPositions] = useState<Record<TurtleColor, number>>({
    red: 0,
    blue: 0,
    yellow: 0,
  });
  const [winner, setWinner] = useState<TurtleColor | null>(null);
  const [isRacing, setIsRacing] = useState(false);
  const [history, setHistory] = useState<{ winner: TurtleColor; myBet: TurtleColor; isWin: boolean }[]>([]);
  
  const animationRef = useRef<number>();

  useEffect(() => {
    setCurrentGame("turtle");
  }, [setCurrentGame]);

  const raceMutation = useMutation({
    mutationFn: async ({ betAmount, turtle }: { betAmount: number; turtle: TurtleColor }) => {
      const response = await apiRequest("POST", "/api/games/turtle/race", {
        odejs: user?.id || "demo",
        currency: "usd",
        amount: betAmount,
        selectedTurtle: turtle,
      });
      return response.json();
    },
    onMutate: () => {
      setWinner(null);
      setPositions({ red: 0, blue: 0, yellow: 0 });
      setIsRacing(true);
    },
    onSuccess: async (data) => {
      const targetPositions = data.raceProgress;
      const finishLine = 100;
      
      const animate = () => {
        setPositions((prev) => {
          const newPos = { ...prev };
          let allFinished = true;
          
          for (const turtle of turtles) {
            const target = targetPositions[turtle.id];
            if (prev[turtle.id] < target) {
              const speed = Math.random() * 3 + 1;
              newPos[turtle.id] = Math.min(prev[turtle.id] + speed, target);
              if (newPos[turtle.id] < target) allFinished = false;
            }
          }
          
          if (allFinished) {
            setIsRacing(false);
            setWinner(data.winner);
            
            if (data.newBalance !== undefined) {
              onBalanceChange(data.newBalance);
            }
            
            setHistory((h) => [
              { winner: data.winner, myBet: data.selectedTurtle, isWin: data.isWin },
              ...h.slice(0, 9),
            ]);
            
            if (data.isWin) {
              hapticFeedback("heavy");
              toast({
                title: t("yourTurtleWon"),
                description: `+$${data.payout.toFixed(2)} (3x)`,
              });
            } else {
              hapticFeedback("rigid");
            }
            
            queryClient.invalidateQueries({ queryKey: ["/api/users/telegram"] });
            return newPos;
          }
          
          hapticFeedback("light");
          animationRef.current = requestAnimationFrame(animate);
          return newPos;
        });
      };
      
      animate();
    },
    onError: () => {
      setIsRacing(false);
      toast({
        title: t("error"),
        description: `${t("failedToRace")}. ${t("tryAgain")}`,
        variant: "destructive",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/users/telegram"] });
    },
  });

  useEffect(() => {
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, []);

  const handleRace = (betAmount: number) => {
    if (!selectedTurtle || isRacing) return;
    hapticFeedback("medium");
    raceMutation.mutate({ betAmount, turtle: selectedTurtle });
  };

  const resetGame = () => {
    setSelectedTurtle(null);
    setWinner(null);
    setPositions({ red: 0, blue: 0, yellow: 0 });
  };

  return (
    <div 
      className="h-screen flex flex-col overflow-hidden"
      style={{
        backgroundImage: `url(/games/turtle/background.png)`,
        backgroundSize: 'cover',
        backgroundPosition: 'center'
      }}
      data-testid="page-turtle-game"
    >
      <GameHeader title={t("turtleTitle")} balance={balance} onBack={onBack} gameType="turtle" schemaGameType="turtle" />

      <main className="flex-1 flex flex-col p-2 gap-2 overflow-hidden">
        <div className="flex gap-1.5 overflow-x-auto hide-scrollbar py-1 flex-shrink-0">
          {history.map((h, i) => (
            <span
              key={i}
              className={`px-2 py-1 rounded-lg text-xs font-bold whitespace-nowrap ${
                h.isWin ? "bg-emerald-500/30 text-emerald-400 border border-emerald-500/50" : "bg-red-500/30 text-red-400 border border-red-500/50"
              }`}
            >
              {h.winner.charAt(0).toUpperCase() + h.winner.slice(1)}
            </span>
          ))}
          {history.length === 0 && (
            <span className="text-sm text-white/50">{t("noHistory")}</span>
          )}
        </div>

        <div className="flex-1 bg-black/60 backdrop-blur-sm border border-emerald-500/30 rounded-2xl p-2 overflow-hidden min-h-0">
          <div className="h-full flex flex-col justify-center gap-2">
            {turtles.map((turtle) => (
              <div key={turtle.id} className="relative">
                <div className="flex items-center gap-2 mb-0.5">
                  <div className={`w-2.5 h-2.5 rounded-full ${turtle.color}`} />
                  <span className="text-xs text-white/60">{getTurtleName(turtle.id, t)}</span>
                  {winner === turtle.id && (
                    <span className="text-xs text-emerald-400 font-bold animate-pulse">{t("youWon")}</span>
                  )}
                </div>
                
                <div className="relative h-10 bg-black/40 rounded-lg overflow-hidden border border-white/10">
                  <div className="absolute inset-0 flex">
                    {[...Array(10)].map((_, i) => (
                      <div
                        key={i}
                        className="flex-1 border-r border-dashed border-white/10"
                      />
                    ))}
                  </div>
                  
                  <div className="absolute right-0 top-0 bottom-0 w-2 bg-gradient-to-r from-transparent via-emerald-500 to-emerald-500" />
                  
                  <div
                    className={`absolute top-1/2 -translate-y-1/2 w-8 h-8 rounded-full ${turtle.color} flex items-center justify-center text-white font-bold text-sm shadow-lg transition-all duration-75`}
                    style={{ left: `${Math.min(positions[turtle.id], 85)}%` }}
                  >
                    {turtle.id === "red" ? "К" : turtle.id === "blue" ? "С" : "Ж"}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex-shrink-0">
          {!winner && !isRacing && (
            <div className="bg-black/60 backdrop-blur-sm border border-emerald-500/30 rounded-xl p-2 mb-2">
              <p className="text-sm text-white/60 mb-2 text-center">
                {t("chooseTurtle")} (3x)
              </p>
              <div className="flex justify-center gap-2">
                {turtles.map((turtle) => (
                  <Button
                    key={turtle.id}
                    variant={selectedTurtle === turtle.id ? "default" : "secondary"}
                    className={`flex-1 h-12 ${
                      selectedTurtle === turtle.id ? turtle.color : "bg-black/40"
                    }`}
                    onClick={() => {
                      hapticFeedback("light");
                      setSelectedTurtle(turtle.id);
                    }}
                    data-testid={`button-turtle-${turtle.id}`}
                  >
                    <div className="flex flex-col items-center gap-0.5">
                      <div className={`w-5 h-5 rounded-full ${turtle.color}`} />
                      <span className="text-[10px]">{turtle.id === "red" ? "Красная" : turtle.id === "blue" ? "Синяя" : "Жёлтая"}</span>
                    </div>
                  </Button>
                ))}
              </div>
            </div>
          )}

          {winner ? (
            <div className="space-y-2">
              <div
                className={`text-center p-3 rounded-xl ${
                  winner === selectedTurtle ? "bg-emerald-500/30 border border-emerald-500/50" : "bg-red-500/30 border border-red-500/50"
                }`}
              >
                <p
                  className={`text-lg font-bold ${
                    winner === selectedTurtle ? "text-emerald-400" : "text-red-400"
                  }`}
                >
                  {winner === selectedTurtle
                    ? t("yourTurtleWon")
                    : `${getTurtleName(winner, t)} ${t("turtleWon")}`}
                </p>
              </div>
              <div className="flex gap-2">
                <Button className="flex-1 h-10 bg-emerald-500 hover:bg-emerald-600" onClick={resetGame} data-testid="button-play-again">
                  {t("playAgain")}
                </Button>
                {winner === selectedTurtle && (
                  <Button
                    variant="secondary"
                    className="h-10 px-4 bg-black/40"
                    onClick={() => {
                      hapticFeedback("light");
                      shareGameResult("My turtle won! Play with me at Telegram Casino");
                    }}
                    data-testid="button-share"
                  >
                    <Share2 className="w-5 h-5" />
                  </Button>
                )}
              </div>
            </div>
          ) : (
            <BettingPanel
              balance={balance}
              minBet={gameConfig.minBet}
              maxBet={gameConfig.maxBet}
              onBet={handleRace}
              isPlaying={isRacing}
              buttonText={isRacing ? t("racing") : t("start")}
              disabled={!selectedTurtle}
              compact
            />
          )}
        </div>
      </main>
    </div>
  );
}
