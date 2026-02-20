import { useState, useEffect, useRef, useCallback } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { GameHeader } from "@/components/GameHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useTelegram } from "@/components/TelegramProvider";
// Games always use USD - Stars are only for conversion
import { gamesConfig } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAudio } from "@/components/AudioProvider";
import { useLanguage } from "@/components/LanguageProvider";

interface CrashGameProps {
  balance: number;
  onBalanceChange: (newBalance: number) => void;
  onBack: () => void;
}

type GamePhase = "betting" | "preparing" | "running" | "crashed";

const BETTING_TIME = 5000;
const PREPARING_TIME = 3000;
const CRASH_DISPLAY_TIME = 2000;

export function CrashGame({ balance, onBalanceChange, onBack }: CrashGameProps) {
  const gameConfig = gamesConfig.find((g) => g.id === "crash")!;
  const { hapticFeedback, user } = useTelegram();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { setCurrentGame } = useAudio();
  const { t } = useLanguage();
  // Games always use USD - Stars are only for conversion, not playing
  
  // Game state
  const [phase, setPhase] = useState<GamePhase>("betting");
  const [multiplier, setMultiplier] = useState(1.0);
  const [phaseTimeLeft, setPhaseTimeLeft] = useState(BETTING_TIME);
  
  // Betting state
  const [betAmount, setBetAmount] = useState(1);
  const [lastBetAmount, setLastBetAmount] = useState(1);
  const [hasBet, setHasBet] = useState(false);
  const [hasCashedOut, setHasCashedOut] = useState(false);
  const [cashOutMultiplier, setCashOutMultiplier] = useState(0);
  
  // Auto features
  const [autoBet, setAutoBet] = useState(false);
  const [autoCashout, setAutoCashout] = useState(false);
  const [autoCashoutAt, setAutoCashoutAt] = useState(2.0);
  
  // History
  const [history, setHistory] = useState<number[]>([2.34, 1.12, 5.67, 1.45, 3.21, 1.89, 4.56, 2.10]);
  
  // Refs for stable values in callbacks
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);
  const starsRef = useRef<{x: number; y: number; size: number; speed: number}[]>([]);
  const crashPointRef = useRef<number>(0);
  const hasBetRef = useRef<boolean>(false);
  const hasCashedOutRef = useRef<boolean>(false);
  const lastBetAmountRef = useRef<number>(1);
  const phaseRef = useRef<GamePhase>("betting");
  const isBettingRef = useRef<boolean>(false); // Prevent duplicate bets
  
  // Timer refs for cleanup
  const phaseTimerRef = useRef<NodeJS.Timeout | null>(null);
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Sync refs with state
  useEffect(() => { hasBetRef.current = hasBet; }, [hasBet]);
  useEffect(() => { hasCashedOutRef.current = hasCashedOut; }, [hasCashedOut]);
  useEffect(() => { lastBetAmountRef.current = lastBetAmount; }, [lastBetAmount]);
  useEffect(() => { phaseRef.current = phase; }, [phase]);

  useEffect(() => {
    setCurrentGame("crash");
  }, [setCurrentGame]);

  // Initialize stars
  useEffect(() => {
    const stars: {x: number; y: number; size: number; speed: number}[] = [];
    for (let i = 0; i < 100; i++) {
      stars.push({
        x: Math.random(),
        y: Math.random(),
        size: Math.random() * 2 + 0.5,
        speed: Math.random() * 2 + 1
      });
    }
    starsRef.current = stars;
  }, []);

  // Clear all timers helper
  const clearAllTimers = useCallback(() => {
    if (phaseTimerRef.current) {
      clearTimeout(phaseTimerRef.current);
      phaseTimerRef.current = null;
    }
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }
  }, []);

  const startMutation = useMutation({
    mutationFn: async (amount: number) => {
      const response = await apiRequest("POST", "/api/games/crash/start", {
        odejs: user?.id || "demo",
        amount,
        currency: "usd",
      });
      return response.json();
    },
    onSuccess: (data) => {
      crashPointRef.current = data.crashPoint;
      if (data.newBalance !== undefined) {
        onBalanceChange(data.newBalance);
      }
      setHasBet(true);
      setLastBetAmount(betAmount);
      isBettingRef.current = false;
    },
    onError: () => {
      toast({
        title: t("error"),
        description: t("failedToBet"),
        variant: "destructive",
      });
      setHasBet(false);
      isBettingRef.current = false;
    },
  });

  const cashoutMutation = useMutation({
    mutationFn: async ({ betAmt, mult }: { betAmt: number; mult: number }) => {
      const response = await apiRequest("POST", "/api/games/crash/cashout", {
        odejs: user?.id || "demo",
        betAmount: betAmt,
        multiplier: mult,
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
  });

  const crashedMutation = useMutation({
    mutationFn: async ({ betAmt, crash }: { betAmt: number; crash: number }) => {
      const response = await apiRequest("POST", "/api/games/crash/crashed", {
        odejs: user?.id || "demo",
        betAmount: betAmt,
        crashPoint: crash,
        currency: "usd",
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users/telegram"] });
    },
  });

  // Place bet function
  const placeBet = useCallback((amount: number) => {
    if (phaseRef.current !== "betting") return;
    if (isBettingRef.current) return; // Prevent duplicate
    if (amount > balance) {
      toast({ title: t("insufficientFunds"), variant: "destructive" });
      return;
    }
    
    isBettingRef.current = true;
    setBetAmount(amount);
    hapticFeedback("medium");
    startMutation.mutate(amount);
  }, [balance, hapticFeedback, startMutation, toast]);

  // Cashout function
  const cashOut = useCallback(() => {
    if (phaseRef.current !== "running" || hasCashedOutRef.current || !hasBetRef.current) return;
    
    setHasCashedOut(true);
    const currentMult = multiplier;
    setCashOutMultiplier(currentMult);
    hapticFeedback("heavy");
    setHistory(prev => [currentMult, ...prev.slice(0, 7)]);
    
    cashoutMutation.mutate({ betAmt: lastBetAmountRef.current, mult: currentMult });
    
    toast({
      title: t("cashedOut"),
      description: `+$${(lastBetAmountRef.current * currentMult).toFixed(2)} на ${currentMult.toFixed(2)}x`,
    });
  }, [multiplier, hapticFeedback, cashoutMutation, toast]);

  // Start betting phase
  const startBettingPhase = useCallback(() => {
    clearAllTimers();
    
    setPhase("betting");
    setMultiplier(1.0);
    setHasCashedOut(false);
    setCashOutMultiplier(0);
    setHasBet(false);
    setPhaseTimeLeft(BETTING_TIME);
    crashPointRef.current = 0;
    isBettingRef.current = false;

    // Start countdown
    let timeLeft = BETTING_TIME;
    countdownIntervalRef.current = setInterval(() => {
      timeLeft -= 100;
      setPhaseTimeLeft(Math.max(0, timeLeft));
    }, 100);

    // Schedule transition to preparing phase
    phaseTimerRef.current = setTimeout(() => {
      startPreparingPhase();
    }, BETTING_TIME);
  }, [clearAllTimers]);

  // Start preparing phase
  const startPreparingPhase = useCallback(() => {
    clearAllTimers();
    
    setPhase("preparing");
    setPhaseTimeLeft(PREPARING_TIME);

    // Generate crash point if no bet was placed
    if (!hasBetRef.current) {
      crashPointRef.current = Math.random() < 0.5 
        ? 1 + Math.random() * 0.5 
        : 1 + Math.random() * 10;
    }

    // Start countdown
    let timeLeft = PREPARING_TIME;
    countdownIntervalRef.current = setInterval(() => {
      timeLeft -= 100;
      setPhaseTimeLeft(Math.max(0, timeLeft));
    }, 100);

    // Schedule transition to running phase
    phaseTimerRef.current = setTimeout(() => {
      startRunningPhase();
    }, PREPARING_TIME);
  }, [clearAllTimers]);

  // Start running phase
  const startRunningPhase = useCallback(() => {
    clearAllTimers();
    
    setPhase("running");
    startTimeRef.current = Date.now();
    
    // Animation loop will handle the game
  }, [clearAllTimers]);

  // Handle crash
  const handleCrash = useCallback((finalCrashPoint: number) => {
    clearAllTimers();
    
    setPhase("crashed");
    setMultiplier(finalCrashPoint);
    hapticFeedback("heavy");
    
    setHistory(prev => [finalCrashPoint, ...prev.slice(0, 7)]);
    
    if (hasBetRef.current && !hasCashedOutRef.current) {
      crashedMutation.mutate({ betAmt: lastBetAmountRef.current, crash: finalCrashPoint });
    }

    // Schedule next round
    phaseTimerRef.current = setTimeout(() => {
      // Auto-bet for next round if enabled
      if (autoBet && lastBetAmountRef.current <= balance) {
        setTimeout(() => {
          if (phaseRef.current === "betting" && !isBettingRef.current) {
            placeBet(lastBetAmountRef.current);
          }
        }, 500);
      }
      startBettingPhase();
    }, CRASH_DISPLAY_TIME);
  }, [clearAllTimers, hapticFeedback, crashedMutation, autoBet, balance, placeBet, startBettingPhase]);

  // Game running animation
  useEffect(() => {
    if (phase !== "running") return;

    const runGame = () => {
      const elapsed = (Date.now() - startTimeRef.current) / 1000;
      const currentMultiplier = Math.pow(Math.E, elapsed * 0.1);
      
      setMultiplier(parseFloat(currentMultiplier.toFixed(2)));

      // Auto cashout check
      if (autoCashout && hasBetRef.current && !hasCashedOutRef.current && currentMultiplier >= autoCashoutAt) {
        cashOut();
      }

      // Check for crash
      if (crashPointRef.current > 0 && currentMultiplier >= crashPointRef.current) {
        handleCrash(crashPointRef.current);
        return;
      }

      animationRef.current = requestAnimationFrame(runGame);
    };

    animationRef.current = requestAnimationFrame(runGame);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
    };
  }, [phase, autoCashout, autoCashoutAt, cashOut, handleCrash]);

  // Start game cycle on mount
  useEffect(() => {
    startBettingPhase();
    
    return () => {
      clearAllTimers();
    };
  }, [startBettingPhase, clearAllTimers]);

  // Canvas drawing
  const getBackgroundGradient = useCallback((mult: number, crashed: boolean) => {
    if (crashed) return ["#1a0000", "#330000", "#4d0000"];
    if (mult < 1.5) return ["#0a0a1a", "#0f0f2e", "#141452"];
    if (mult < 2) return ["#0f0f2e", "#1a1a5c", "#252580"];
    if (mult < 3) return ["#1a1a5c", "#252580", "#3535a8"];
    if (mult < 5) return ["#252580", "#3535a8", "#4545d0"];
    if (mult < 10) return ["#3535a8", "#4545d0", "#6060ff"];
    return ["#4545d0", "#6060ff", "#8080ff"];
  }, []);

  const drawGame = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * 2;
    canvas.height = rect.height * 2;
    ctx.scale(2, 2);

    const width = rect.width;
    const height = rect.height;
    const isCrashed = phase === "crashed";
    const colors = getBackgroundGradient(multiplier, isCrashed);
    const gradient = ctx.createLinearGradient(0, height, 0, 0);
    gradient.addColorStop(0, colors[0]);
    gradient.addColorStop(0.5, colors[1]);
    gradient.addColorStop(1, colors[2]);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    // Stars
    const starSpeed = phase === "running" ? multiplier * 0.5 : 0.1;
    ctx.fillStyle = "rgba(255, 255, 255, 0.8)";
    starsRef.current.forEach(star => {
      if (phase === "running") {
        star.y += star.speed * starSpeed * 0.01;
        if (star.y > 1) star.y = 0;
      }
      ctx.beginPath();
      ctx.arc(star.x * width, star.y * height, star.size, 0, Math.PI * 2);
      ctx.fill();
    });

    // Rocket and trail
    if (phase === "running" || phase === "crashed") {
      const rocketX = width / 2;
      const baseY = height * 0.7;
      const rocketY = Math.max(height * 0.2, baseY - (multiplier - 1) * 30);
      
      ctx.save();
      ctx.translate(rocketX, rocketY);
      
      if (isCrashed) ctx.rotate(Math.PI / 4);

      ctx.fillStyle = isCrashed ? "#ff4444" : "#ffffff";
      ctx.beginPath();
      ctx.moveTo(0, -30);
      ctx.lineTo(-12, 15);
      ctx.lineTo(-8, 15);
      ctx.lineTo(-8, 25);
      ctx.lineTo(8, 25);
      ctx.lineTo(8, 15);
      ctx.lineTo(12, 15);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = "#10b981";
      ctx.beginPath();
      ctx.arc(0, 0, 6, 0, Math.PI * 2);
      ctx.fill();

      if (!isCrashed) {
        const flameHeight = 15 + Math.sin(Date.now() / 50) * 5 + multiplier * 2;
        const flameGradient = ctx.createLinearGradient(0, 25, 0, 25 + flameHeight);
        flameGradient.addColorStop(0, "#ff6b00");
        flameGradient.addColorStop(0.5, "#ff9500");
        flameGradient.addColorStop(1, "rgba(255, 150, 0, 0)");
        ctx.fillStyle = flameGradient;
        ctx.beginPath();
        ctx.moveTo(-6, 25);
        ctx.quadraticCurveTo(-3, 25 + flameHeight * 0.7, 0, 25 + flameHeight);
        ctx.quadraticCurveTo(3, 25 + flameHeight * 0.7, 6, 25);
        ctx.closePath();
        ctx.fill();
      } else {
        for (let i = 0; i < 8; i++) {
          const angle = (i / 8) * Math.PI * 2 + Date.now() / 200;
          const dist = 20 + Math.sin(Date.now() / 100 + i) * 10;
          ctx.fillStyle = `rgba(255, ${50 + i * 20}, 0, 0.8)`;
          ctx.beginPath();
          ctx.arc(Math.cos(angle) * dist, Math.sin(angle) * dist, 5, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      
      ctx.restore();

      // Trail line
      const points: [number, number][] = [];
      const elapsed = (Date.now() - startTimeRef.current) / 1000;
      const maxTime = Math.min(elapsed, 10);
      
      for (let t = 0; t <= maxTime; t += 0.05) {
        const m = Math.pow(Math.E, t * 0.1);
        const x = 20 + (t / 10) * (width - 40);
        const y = height - 30 - ((m - 1) / 5) * (height - 60);
        points.push([x, Math.max(30, y)]);
      }

      if (points.length > 1) {
        ctx.strokeStyle = isCrashed ? "#ef4444" : "#10b981";
        ctx.lineWidth = 3;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.shadowColor = isCrashed ? "#ef4444" : "#10b981";
        ctx.shadowBlur = 10;
        ctx.beginPath();
        points.forEach(([x, y], i) => {
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        });
        ctx.stroke();
        ctx.shadowBlur = 0;

        const lastPoint = points[points.length - 1];
        ctx.fillStyle = isCrashed ? "#ef4444" : "#10b981";
        ctx.beginPath();
        ctx.arc(lastPoint[0], lastPoint[1], 6, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }, [phase, multiplier, getBackgroundGradient]);

  useEffect(() => {
    drawGame();
    const interval = setInterval(drawGame, 50);
    return () => clearInterval(interval);
  }, [drawGame]);

  const quickBetAmounts = [0.5, 1, 2, 5, 10];

  return (
    <div 
      className="h-screen flex flex-col overflow-hidden bg-zinc-950"
      data-testid="page-crash-game"
    >
      <GameHeader title={t("crashTitle")} balance={balance} onBack={onBack} gameType="crash" schemaGameType="crash" />

      <main className="flex-1 flex flex-col p-2 gap-2 overflow-hidden">
        {/* History */}
        <div className="flex gap-1.5 overflow-x-auto hide-scrollbar py-1 flex-shrink-0">
          {history.map((h, i) => (
            <span
              key={i}
              className={`px-2 py-1 rounded-lg text-xs font-bold whitespace-nowrap ${
                h >= 2 ? "bg-emerald-500/30 text-emerald-400 border border-emerald-500/50" : "bg-red-500/30 text-red-400 border border-red-500/50"
              }`}
              data-testid={`history-item-${i}`}
            >
              {h.toFixed(2)}x
            </span>
          ))}
        </div>

        {/* Game canvas */}
        <div className="flex-1 relative rounded-2xl overflow-hidden min-h-0 bg-zinc-900">
          <canvas
            ref={canvasRef}
            className="absolute inset-0 w-full h-full"
            data-testid="crash-canvas"
          />
          
          {/* Overlay */}
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            {phase === "betting" && (
              <div className="text-center bg-black/60 backdrop-blur-sm rounded-2xl p-4 border border-yellow-500/50">
                <div className="text-yellow-400 text-lg font-bold mb-1">{t("placeBets")}</div>
                <div className="text-3xl font-bold text-white">{(phaseTimeLeft / 1000).toFixed(1)}с</div>
                {hasBet && (
                  <div className="mt-2 text-emerald-400 text-sm">{t("bet")}: ${lastBetAmount.toFixed(2)}</div>
                )}
              </div>
            )}
            
            {phase === "preparing" && (
              <div className="text-center bg-black/60 backdrop-blur-sm rounded-2xl p-4 border border-orange-500/50 animate-pulse">
                <div className="text-orange-400 text-lg font-bold mb-1">{t("launching")}</div>
                <div className="text-4xl font-bold text-white">{Math.ceil(phaseTimeLeft / 1000)}</div>
              </div>
            )}
            
            {(phase === "running" || phase === "crashed") && (
              <div className={`text-center bg-black/60 backdrop-blur-sm rounded-2xl p-4 border ${phase === "crashed" ? "border-red-500/50" : "border-emerald-500/50"}`}>
                <span
                  className={`text-5xl font-bold ${
                    phase === "crashed" ? "text-red-500" : "text-emerald-400"
                  }`}
                  data-testid="multiplier-display"
                >
                  {multiplier.toFixed(2)}x
                </span>
                {phase === "crashed" && (
                  <p className="text-red-500 font-bold mt-2 text-lg">{t("crashed")}</p>
                )}
                {hasCashedOut && (
                  <p className="text-emerald-400 font-medium mt-2 text-sm">
                    {t("cashoutAt")} {cashOutMultiplier.toFixed(2)}x (+${(lastBetAmount * cashOutMultiplier).toFixed(2)})
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Controls */}
        <div className="flex-shrink-0 space-y-2">
          {/* Cashout button when running */}
          {phase === "running" && hasBet && !hasCashedOut && (
            <Button
              className="w-full h-12 text-lg font-bold bg-gradient-to-r from-emerald-500 to-green-500 hover:from-emerald-600 hover:to-green-600"
              onClick={cashOut}
              data-testid="button-cash-out"
            >
              {t("cashout")} ${(lastBetAmount * multiplier).toFixed(2)}
            </Button>
          )}

          {/* Bet controls when betting phase */}
          {phase === "betting" && !hasBet && (
            <div className="space-y-2">
              <div className="flex gap-1">
                {quickBetAmounts.map((amount) => (
                  <Button
                    key={amount}
                    variant="outline"
                    size="sm"
                    className="flex-1 text-xs"
                    onClick={() => setBetAmount(amount)}
                    disabled={amount > balance}
                  >
                    ${amount}
                  </Button>
                ))}
              </div>
              
              <div className="flex gap-2">
                <Input
                  type="number"
                  value={betAmount}
                  onChange={(e) => setBetAmount(parseFloat(e.target.value) || 0)}
                  className="flex-1 h-12 text-center text-lg"
                  min={gameConfig.minBet}
                  max={Math.min(gameConfig.maxBet, balance)}
                  data-testid="input-bet-amount"
                />
                <Button
                  className="h-12 px-8 text-lg font-bold bg-emerald-600 hover:bg-emerald-700"
                  onClick={() => placeBet(betAmount)}
                  disabled={betAmount > balance || betAmount < gameConfig.minBet || startMutation.isPending}
                  data-testid="button-place-bet"
                >
                  {t("bet")}
                </Button>
              </div>
            </div>
          )}

          {/* Waiting message */}
          {phase === "betting" && hasBet && (
            <div className="text-center py-3 text-emerald-400 font-medium">
              {t("betAccepted")}: ${lastBetAmount.toFixed(2)}
            </div>
          )}
          
          {phase !== "betting" && !hasBet && phase !== "crashed" && (
            <div className="text-center py-3 text-zinc-500">
              {t("waitingNextRound")}...
            </div>
          )}

          {/* Auto features */}
          <div className="flex gap-4 p-3 bg-zinc-900 rounded-xl border border-zinc-800">
            <div className="flex items-center gap-2 flex-1">
              <Switch
                checked={autoBet}
                onCheckedChange={setAutoBet}
                data-testid="switch-auto-bet"
              />
              <span className="text-sm text-zinc-400">{t("autoBet")}</span>
            </div>
            
            <div className="flex items-center gap-2 flex-1">
              <Switch
                checked={autoCashout}
                onCheckedChange={setAutoCashout}
                data-testid="switch-auto-cashout"
              />
              <span className="text-sm text-zinc-400">{t("autoCashout")}</span>
              {autoCashout && (
                <Input
                  type="number"
                  value={autoCashoutAt}
                  onChange={(e) => setAutoCashoutAt(parseFloat(e.target.value) || 2)}
                  className="w-16 h-7 text-xs text-center"
                  min={1.1}
                  step={0.1}
                  data-testid="input-auto-cashout"
                />
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
