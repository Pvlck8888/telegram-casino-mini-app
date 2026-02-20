import { useState, useEffect, useRef, useCallback } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { GameHeader } from "@/components/GameHeader";
import { BettingPanel } from "@/components/BettingPanel";
import { Button } from "@/components/ui/button";
import { useTelegram } from "@/components/TelegramProvider";
import { gamesConfig } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAudio } from "@/components/AudioProvider";
import { useLanguage } from "@/components/LanguageProvider";
import { Turtle, User, Rabbit, Zap, Plane } from "lucide-react";

interface AviaMastersGameProps {
  balance: number;
  onBalanceChange: (newBalance: number) => void;
  onBack: () => void;
}

type GameStatus = "waiting" | "flying" | "landing" | "crashed" | "won";
type SpeedMode = 0 | 1 | 2 | 3;

interface Collectible {
  x: number;
  y: number;
  type: "add" | "multiply" | "rocket";
  value: number;
  collected: boolean;
}

interface FlightResult {
  success: boolean;
  collectibles: Collectible[];
  finalMultiplier: number;
  gameId: string;
  crashPoint?: number;
}

export function AviaMastersGame({ balance, onBalanceChange, onBack }: AviaMastersGameProps) {
  const gameConfig = gamesConfig.find((g) => g.id === "aviamasters")!;
  const { hapticFeedback, user } = useTelegram();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { setCurrentGame } = useAudio();
  const { language } = useLanguage();
  
  const [gameStatus, setGameStatus] = useState<GameStatus>("waiting");
  const [speedMode, setSpeedMode] = useState<SpeedMode>(1);
  const [betAmount, setBetAmount] = useState(0);
  const [displayMultiplier, setDisplayMultiplier] = useState(1.0);
  const [planeX, setPlaneX] = useState(0);
  const [planeY, setPlaneY] = useState(0);
  const [planeAngle, setPlaneAngle] = useState(0);
  const [collectibles, setCollectibles] = useState<Collectible[]>([]);
  const [flightResult, setFlightResult] = useState<FlightResult | null>(null);
  const [particles, setParticles] = useState<{x: number, y: number, vx: number, vy: number, life: number, color: string}[]>([]);
  const [history, setHistory] = useState<{mult: number; won: boolean}[]>([
    {mult: 2.5, won: true}, {mult: 1.2, won: true}, {mult: 4.8, won: true}, 
    {mult: 0, won: false}, {mult: 3.2, won: true}, {mult: 1.8, won: true}
  ]);
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>();
  const drawIntervalRef = useRef<ReturnType<typeof setInterval>>();
  const startTimeRef = useRef<number>(0);
  const speedMultipliers = [0.5, 1, 1.5, 2];
  const cloudOffset = useRef(0);
  const waveOffset = useRef(0);

  useEffect(() => {
    setCurrentGame("aviamasters");
  }, [setCurrentGame]);

  const startMutation = useMutation({
    mutationFn: async (amount: number) => {
      const response = await apiRequest("POST", "/api/games/aviamasters/start", {
        odejs: user?.id || "demo",
        amount,
      });
      return response.json();
    },
    onSuccess: (data) => {
      const serverCollectibles: Collectible[] = (data.collectibles || []).map((c: any) => ({
        ...c,
        type: c.type as "add" | "multiply" | "rocket",
        collected: false,
      }));
      
      setFlightResult({
        success: data.success,
        collectibles: serverCollectibles,
        finalMultiplier: data.multiplier,
        gameId: data.gameId,
        crashPoint: data.crashPoint,
      });
      setCollectibles(serverCollectibles);
      
      if (data.newBalance !== undefined) {
        onBalanceChange(data.newBalance);
      }
      
      startTimeRef.current = Date.now();
      setGameStatus("flying");
      setPlaneX(0);
      setPlaneY(0.15);
      setDisplayMultiplier(1.0);
      setParticles([]);
    },
    onError: () => {
      toast({
        title: language === "ru" ? "Ошибка" : "Error",
        description: language === "ru" ? "Не удалось начать игру" : "Failed to start game",
        variant: "destructive",
      });
      setGameStatus("waiting");
      queryClient.invalidateQueries({ queryKey: ["/api/users/telegram"] });
    },
  });

  const endMutation = useMutation({
    mutationFn: async (gameId: string) => {
      const response = await apiRequest("POST", "/api/games/aviamasters/end", {
        odejs: user?.id || "demo",
        gameId,
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

  const drawBiplane = (ctx: CanvasRenderingContext2D, x: number, y: number, angle: number, scale: number = 1) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle * Math.PI / 180);
    ctx.scale(scale, scale);
    
    ctx.fillStyle = "#cc0000";
    ctx.beginPath();
    ctx.ellipse(0, 0, 28, 9, 0, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.fillStyle = "#990000";
    ctx.beginPath();
    ctx.moveTo(-10, -10);
    ctx.lineTo(-10, 10);
    ctx.lineTo(-22, 0);
    ctx.closePath();
    ctx.fill();
    
    ctx.fillStyle = "#aa0000";
    ctx.fillRect(-6, -16, 28, 5);
    ctx.fillRect(-6, 11, 28, 5);
    
    ctx.fillStyle = "#ffcc00";
    ctx.beginPath();
    ctx.arc(22, 0, 5, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.fillStyle = "#666";
    const propAngle = Date.now() / 15;
    ctx.save();
    ctx.translate(28, 0);
    ctx.rotate(propAngle);
    ctx.fillRect(-2, -14, 4, 28);
    ctx.restore();
    
    ctx.fillStyle = "#333";
    ctx.beginPath();
    ctx.arc(-5, 14, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(8, 14, 3, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.restore();
  };

  const drawCarrier = (ctx: CanvasRenderingContext2D, x: number, y: number, width: number, flipped: boolean = false) => {
    ctx.save();
    if (flipped) {
      ctx.translate(x + width, y);
      ctx.scale(-1, 1);
      ctx.translate(-x, -y);
    }
    
    ctx.fillStyle = "#3a4a5a";
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + width * 0.1, y + 30);
    ctx.lineTo(x + width * 0.9, y + 30);
    ctx.lineTo(x + width, y);
    ctx.closePath();
    ctx.fill();
    
    ctx.fillStyle = "#4a5a6a";
    ctx.fillRect(x, y - 8, width, 10);
    
    ctx.fillStyle = "#5a6a7a";
    ctx.fillRect(x + width * 0.75, y - 25, width * 0.2, 20);
    
    ctx.fillStyle = "#666";
    ctx.fillRect(x + width * 0.78, y - 45, 4, 20);
    
    ctx.fillStyle = "#fff";
    for (let i = 0; i < 3; i++) {
      ctx.fillRect(x + width * 0.1 + i * width * 0.25, y - 5, width * 0.15, 3);
    }
    
    ctx.restore();
  };

  const drawCollectible = (ctx: CanvasRenderingContext2D, x: number, y: number, type: string, value: number, pulse: number) => {
    const size = 18 + Math.sin(pulse) * 2;
    
    if (type === "rocket") {
      ctx.fillStyle = "#ff3333";
      ctx.beginPath();
      ctx.moveTo(x, y - size);
      ctx.lineTo(x - size * 0.5, y + size * 0.6);
      ctx.lineTo(x + size * 0.5, y + size * 0.6);
      ctx.closePath();
      ctx.fill();
      
      ctx.fillStyle = "#ff6600";
      ctx.beginPath();
      ctx.moveTo(x - size * 0.3, y + size * 0.6);
      ctx.lineTo(x, y + size);
      ctx.lineTo(x + size * 0.3, y + size * 0.6);
      ctx.closePath();
      ctx.fill();
      
      ctx.fillStyle = "#ffcc00";
      const flameSize = size * 0.4 + Math.random() * 5;
      ctx.beginPath();
      ctx.moveTo(x - size * 0.2, y + size * 0.6);
      ctx.lineTo(x, y + size * 0.6 + flameSize);
      ctx.lineTo(x + size * 0.2, y + size * 0.6);
      ctx.closePath();
      ctx.fill();
    } else if (type === "multiply") {
      ctx.shadowColor = "#ffd700";
      ctx.shadowBlur = 10;
      
      ctx.fillStyle = "#ffd700";
      ctx.beginPath();
      const spikes = 5;
      const outerRadius = size;
      const innerRadius = size * 0.5;
      for (let i = 0; i < spikes * 2; i++) {
        const radius = i % 2 === 0 ? outerRadius : innerRadius;
        const angle = (i * Math.PI) / spikes - Math.PI / 2;
        if (i === 0) ctx.moveTo(x + Math.cos(angle) * radius, y + Math.sin(angle) * radius);
        else ctx.lineTo(x + Math.cos(angle) * radius, y + Math.sin(angle) * radius);
      }
      ctx.closePath();
      ctx.fill();
      ctx.shadowBlur = 0;
      
      ctx.fillStyle = "#000";
      ctx.font = "bold 10px Arial";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(`×${value}`, x, y);
    } else {
      ctx.shadowColor = "#00ff88";
      ctx.shadowBlur = 8;
      
      ctx.fillStyle = "#00dd66";
      ctx.beginPath();
      ctx.arc(x, y, size, 0, Math.PI * 2);
      ctx.fill();
      
      ctx.fillStyle = "#00ff88";
      ctx.beginPath();
      ctx.arc(x - size * 0.3, y - size * 0.3, size * 0.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      
      ctx.fillStyle = "#fff";
      ctx.font = "bold 11px Arial";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(`+${value}`, x, y);
    }
  };

  const drawGame = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * window.devicePixelRatio;
    canvas.height = rect.height * window.devicePixelRatio;
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);

    const width = rect.width;
    const height = rect.height;

    const skyGradient = ctx.createLinearGradient(0, 0, 0, height * 0.7);
    skyGradient.addColorStop(0, "#0a1628");
    skyGradient.addColorStop(0.3, "#1a3050");
    skyGradient.addColorStop(0.6, "#2a5080");
    skyGradient.addColorStop(1, "#3a70a0");
    ctx.fillStyle = skyGradient;
    ctx.fillRect(0, 0, width, height * 0.7);

    for (let i = 0; i < 50; i++) {
      const starX = (i * 37 + cloudOffset.current * 0.1) % width;
      const starY = (i * 23) % (height * 0.5);
      const twinkle = Math.sin(Date.now() / 500 + i) * 0.5 + 0.5;
      ctx.fillStyle = `rgba(255, 255, 255, ${0.3 + twinkle * 0.7})`;
      ctx.beginPath();
      ctx.arc(starX, starY, 1 + twinkle, 0, Math.PI * 2);
      ctx.fill();
    }

    cloudOffset.current += 0.3;
    for (let i = 0; i < 6; i++) {
      const cloudX = ((cloudOffset.current * (0.2 + i * 0.1) + i * 200) % (width + 200)) - 100;
      const cloudY = 30 + i * 35 + Math.sin(i) * 20;
      
      ctx.fillStyle = `rgba(255, 255, 255, ${0.15 - i * 0.02})`;
      ctx.beginPath();
      ctx.ellipse(cloudX, cloudY, 50 + i * 5, 18 + i * 2, 0, 0, Math.PI * 2);
      ctx.ellipse(cloudX - 30, cloudY + 5, 35, 14, 0, 0, Math.PI * 2);
      ctx.ellipse(cloudX + 35, cloudY + 3, 40, 15, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    const waterY = height * 0.7;
    const waterGradient = ctx.createLinearGradient(0, waterY, 0, height);
    waterGradient.addColorStop(0, "#0a3050");
    waterGradient.addColorStop(0.5, "#052535");
    waterGradient.addColorStop(1, "#021520");
    ctx.fillStyle = waterGradient;
    ctx.fillRect(0, waterY, width, height - waterY);

    waveOffset.current += 0.05;
    for (let layer = 0; layer < 4; layer++) {
      ctx.strokeStyle = `rgba(80, 150, 200, ${0.15 - layer * 0.03})`;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      for (let x = 0; x < width; x += 3) {
        const waveY = waterY + 10 + layer * 12 + 
          Math.sin(x / 40 + waveOffset.current + layer) * 4 +
          Math.sin(x / 80 + waveOffset.current * 0.5) * 2;
        if (x === 0) ctx.moveTo(x, waveY);
        else ctx.lineTo(x, waveY);
      }
      ctx.stroke();
    }

    const carrierWidth = 130;
    drawCarrier(ctx, -30, waterY - 15, carrierWidth, false);
    drawCarrier(ctx, width - carrierWidth + 30, waterY - 15, carrierWidth, true);

    if (gameStatus !== "waiting") {
      const pulse = Date.now() / 200;
      collectibles.forEach((c) => {
        if (c.collected) return;
        const cx = c.x * width;
        const cy = c.y * height * 0.55 + height * 0.1;
        drawCollectible(ctx, cx, cy, c.type, c.value, pulse);
      });
    }

    particles.forEach((p, i) => {
      ctx.fillStyle = p.color;
      ctx.globalAlpha = p.life;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 3 + (1 - p.life) * 5, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalAlpha = 1;

    if (gameStatus !== "waiting") {
      const pX = planeX * width * 0.85 + width * 0.08;
      const pY = (1 - planeY) * height * 0.55 + height * 0.12;
      
      if (gameStatus === "crashed") {
        for (let i = 0; i < 15; i++) {
          const angle = (i / 15) * Math.PI * 2 + Date.now() / 80;
          const dist = 25 + Math.sin(Date.now() / 40 + i) * 15;
          ctx.fillStyle = i % 2 === 0 ? "#ff4400" : "#ffaa00";
          ctx.beginPath();
          ctx.arc(pX + Math.cos(angle) * dist, pY + Math.sin(angle) * dist, 5 + Math.random() * 4, 0, Math.PI * 2);
          ctx.fill();
        }
        
        ctx.fillStyle = "rgba(50, 50, 50, 0.7)";
        for (let i = 0; i < 8; i++) {
          const smokeX = pX + Math.sin(Date.now() / 200 + i) * 20;
          const smokeY = pY - 20 - i * 10 - (Date.now() / 50) % 30;
          ctx.beginPath();
          ctx.arc(smokeX, smokeY, 8 + i * 2, 0, Math.PI * 2);
          ctx.fill();
        }
      } else {
        drawBiplane(ctx, pX, pY, planeAngle, 1);
        
        ctx.fillStyle = "rgba(200, 200, 200, 0.5)";
        for (let i = 0; i < 5; i++) {
          const trailX = pX - 40 - i * 15;
          const trailY = pY + Math.sin(Date.now() / 100 + i) * 3;
          ctx.beginPath();
          ctx.arc(trailX, trailY, 4 - i * 0.6, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    ctx.fillStyle = "#fff";
    ctx.font = "bold 32px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    
    if (gameStatus === "flying") {
      ctx.shadowColor = "#ffd700";
      ctx.shadowBlur = 15;
      ctx.fillStyle = "#ffd700";
      ctx.fillText(`${displayMultiplier.toFixed(2)}×`, width / 2, height * 0.4);
      ctx.shadowBlur = 0;
    }
  }, [gameStatus, planeX, planeY, planeAngle, collectibles, displayMultiplier, particles]);

  const landingStartRef = useRef<number>(0);
  const collectedCountRef = useRef<number>(0);

  const resetGameState = useCallback(() => {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = undefined;
    }
    setGameStatus("waiting");
    setBetAmount(0);
    setDisplayMultiplier(1.0);
    setCollectibles([]);
    setFlightResult(null);
    setParticles([]);
    collectedCountRef.current = 0;
    landingStartRef.current = 0;
  }, []);

  const runFlight = useCallback(() => {
    if (gameStatus !== "flying" && gameStatus !== "landing") return;
    
    const elapsed = (Date.now() - startTimeRef.current) / 1000;
    const speed = speedMultipliers[speedMode];
    const progress = Math.min(elapsed * speed * 0.08, 1);
    
    const crashPoint = flightResult?.crashPoint ?? 1;
    const willCrash = !flightResult?.success;
    const serverFinalMult = flightResult?.finalMultiplier ?? 1;
    const totalCollectibles = flightResult?.collectibles?.length ?? 1;
    
    if (willCrash && progress >= crashPoint && gameStatus === "flying") {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = undefined;
      }
      setGameStatus("crashed");
      hapticFeedback("heavy");
      setHistory(prev => [{mult: 0, won: false}, ...prev.slice(0, 5)]);
      if (flightResult?.gameId) {
        endMutation.mutate(flightResult.gameId);
      }
      
      toast({
        title: language === "ru" ? "Крушение!" : "Crashed!",
        description: language === "ru" ? "Самолёт упал в воду" : "Plane crashed into water",
        variant: "destructive",
      });
      
      setTimeout(resetGameState, 2500);
      return;
    }
    
    const newX = progress;
    let newY: number;
    let newAngle: number;
    
    if (progress < 0.15) {
      newY = 0.15 + progress * 3.5;
      newAngle = -25;
    } else if (progress < 0.85) {
      const midProgress = (progress - 0.15) / 0.7;
      newY = 0.65 + Math.sin(midProgress * Math.PI * 2.5) * 0.12;
      newAngle = Math.cos(midProgress * Math.PI * 2.5) * 12;
    } else {
      const landProgress = (progress - 0.85) / 0.15;
      newY = 0.65 - landProgress * 0.45;
      newAngle = 20 + landProgress * 5;
    }
    
    setPlaneX(newX);
    setPlaneY(newY);
    setPlaneAngle(newAngle);
    
    const updatedCollectibles = [...collectibles];
    
    updatedCollectibles.forEach((c, i) => {
      if (c.collected) return;
      const dist = Math.sqrt(Math.pow(newX - c.x, 2) + Math.pow(newY - c.y, 2));
      if (dist < 0.1) {
        updatedCollectibles[i] = { ...c, collected: true };
        collectedCountRef.current += 1;
        hapticFeedback("light");
        
        const canvas = canvasRef.current;
        if (canvas) {
          const rect = canvas.getBoundingClientRect();
          const cx = c.x * rect.width;
          const cy = c.y * rect.height * 0.55 + rect.height * 0.1;
          const newParticles = [];
          for (let j = 0; j < 8; j++) {
            newParticles.push({
              x: cx,
              y: cy,
              vx: (Math.random() - 0.5) * 8,
              vy: (Math.random() - 0.5) * 8,
              life: 1,
              color: c.type === "multiply" ? "#ffd700" : c.type === "add" ? "#00ff88" : "#ff4444"
            });
          }
          setParticles(prev => [...prev, ...newParticles]);
        }
      }
    });
    setCollectibles(updatedCollectibles);
    
    const displayMult = 1 + (serverFinalMult - 1) * progress;
    setDisplayMultiplier(displayMult);
    
    setParticles(prev => prev
      .map(p => ({
        ...p,
        x: p.x + p.vx,
        y: p.y + p.vy,
        vy: p.vy + 0.3,
        life: p.life - 0.03
      }))
      .filter(p => p.life > 0)
    );
    
    drawGame();
    
    if (progress >= 1 && flightResult?.success && gameStatus === "flying") {
      setGameStatus("landing");
      landingStartRef.current = Date.now();
      hapticFeedback("heavy");
      setDisplayMultiplier(serverFinalMult);
      animationRef.current = requestAnimationFrame(runFlight);
      return;
    }
    
    if (gameStatus === "landing") {
      const landingElapsed = (Date.now() - landingStartRef.current) / 1000;
      
      setPlaneY(0.2 - landingElapsed * 0.05);
      setPlaneAngle(25 - landingElapsed * 5);
      
      if (landingElapsed >= 1.5) {
        if (animationRef.current) {
          cancelAnimationFrame(animationRef.current);
          animationRef.current = undefined;
        }
        setGameStatus("won");
        setHistory(prev => [{mult: serverFinalMult, won: true}, ...prev.slice(0, 5)]);
        if (flightResult?.gameId) {
          endMutation.mutate(flightResult.gameId);
        }
        
        toast({
          title: language === "ru" ? "Посадка!" : "Landed!",
          description: language === "ru" 
            ? `Вы выиграли $${(betAmount * serverFinalMult).toFixed(2)}!` 
            : `You won $${(betAmount * serverFinalMult).toFixed(2)}!`,
        });
        
        setTimeout(resetGameState, 2000);
        return;
      }
      
      drawGame();
      animationRef.current = requestAnimationFrame(runFlight);
      return;
    }
    
    animationRef.current = requestAnimationFrame(runFlight);
  }, [gameStatus, speedMode, collectibles, flightResult, betAmount, hapticFeedback, drawGame, endMutation, toast, language, resetGameState]);

  useEffect(() => {
    if (gameStatus === "flying" || gameStatus === "landing") {
      animationRef.current = requestAnimationFrame(runFlight);
    }
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [gameStatus, runFlight]);

  useEffect(() => {
    drawGame();
    drawIntervalRef.current = setInterval(drawGame, 33);
    return () => {
      if (drawIntervalRef.current) {
        clearInterval(drawIntervalRef.current);
      }
    };
  }, [drawGame]);

  const placeBet = (amount: number) => {
    if (gameStatus !== "waiting") return;
    setBetAmount(amount);
    hapticFeedback("medium");
    startMutation.mutate(amount);
  };

  const speedIcons = [
    <Turtle key="turtle" className="w-4 h-4" />,
    <User key="user" className="w-4 h-4" />,
    <Rabbit key="rabbit" className="w-4 h-4" />,
    <Zap key="zap" className="w-4 h-4" />
  ];

  return (
    <div 
      className="h-screen flex flex-col overflow-hidden bg-[#0a1628]"
      data-testid="page-aviamasters-game"
    >
      <GameHeader 
        title={language === "ru" ? "Авиамастерс" : "Avia Masters"} 
        balance={balance} 
        onBack={onBack} 
        gameType="aviamasters" 
        schemaGameType="aviamasters" 
      />

      <main className="flex-1 flex flex-col p-2 gap-2 overflow-hidden">
        <div className="flex items-center justify-center gap-1 flex-shrink-0 overflow-x-auto hide-scrollbar">
          {history.map((h, i) => (
            <span
              key={i}
              className={`px-2 py-1 rounded-lg text-xs font-bold whitespace-nowrap ${
                h.won 
                  ? "bg-emerald-500/30 text-emerald-400 border border-emerald-500/50" 
                  : "bg-red-500/30 text-red-400 border border-red-500/50"
              }`}
              data-testid={`history-item-${i}`}
            >
              {h.won ? `${h.mult.toFixed(2)}×` : "💥"}
            </span>
          ))}
        </div>

        <div className="flex-1 relative rounded-2xl overflow-hidden min-h-0 border border-sky-500/30">
          <canvas
            ref={canvasRef}
            className="absolute inset-0 w-full h-full"
            data-testid="aviamasters-canvas"
          />
          
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            {gameStatus === "waiting" && (
              <div className="text-center bg-black/70 backdrop-blur-sm rounded-2xl p-4 border border-sky-500/30">
                <Plane className="w-12 h-12 mx-auto mb-2 text-red-500 animate-bounce" />
                <p className="text-white/80 text-sm">
                  {language === "ru" ? "Сделайте ставку" : "Place your bet"}
                </p>
                <p className="text-sky-400 text-xs mt-1">
                  {language === "ru" ? "Долетите до авианосца!" : "Fly to the carrier!"}
                </p>
              </div>
            )}
            
            {gameStatus === "landing" && (
              <div className="text-center bg-black/70 backdrop-blur-sm rounded-2xl p-6 border border-sky-500/50">
                <p className="text-sky-400 text-2xl font-bold animate-pulse">
                  {language === "ru" ? "Посадка..." : "Landing..."}
                </p>
                <p className="text-yellow-400 text-xl mt-2">{displayMultiplier.toFixed(2)}×</p>
              </div>
            )}
            
            {gameStatus === "won" && (
              <div className="text-center bg-black/70 backdrop-blur-sm rounded-2xl p-6 border border-emerald-500/50 animate-pulse">
                <p className="text-emerald-400 text-3xl font-bold">
                  {language === "ru" ? "ПОСАДКА!" : "LANDED!"}
                </p>
                <p className="text-white text-xl mt-2">
                  +${(betAmount * displayMultiplier).toFixed(2)}
                </p>
                <p className="text-emerald-300 mt-1">{displayMultiplier.toFixed(2)}×</p>
              </div>
            )}
            
            {gameStatus === "crashed" && (
              <div className="text-center bg-black/70 backdrop-blur-sm rounded-2xl p-6 border border-red-500/50 animate-shake">
                <p className="text-red-500 text-3xl font-bold">
                  {language === "ru" ? "КРУШЕНИЕ!" : "CRASHED!"}
                </p>
                <p className="text-white/60 text-sm mt-2">
                  {language === "ru" ? "Самолёт упал в воду" : "Plane crashed into water"}
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="flex-shrink-0 bg-black/40 rounded-xl p-3 border border-sky-500/20">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3 text-xs">
              <div className="flex items-center gap-1">
                <div className="w-4 h-4 rounded-full bg-emerald-500 flex items-center justify-center text-[8px] font-bold text-black">+</div>
                <span className="text-emerald-400">{language === "ru" ? "Бонус" : "Bonus"}</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-4 h-4 rounded-full bg-yellow-500 flex items-center justify-center text-[8px] font-bold text-black">×</div>
                <span className="text-yellow-400">{language === "ru" ? "Множ." : "Mult."}</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-4 h-4 bg-red-500" style={{clipPath: "polygon(50% 0%, 0% 100%, 100% 100%)"}}></div>
                <span className="text-red-400">{language === "ru" ? "Ракета" : "Rocket"}</span>
              </div>
            </div>
            
            <div className="flex items-center gap-1">
              <span className="text-sky-300 text-xs mr-1">{language === "ru" ? "Скорость:" : "Speed:"}</span>
              {speedIcons.map((icon, i) => (
                <Button
                  key={i}
                  size="icon"
                  variant={speedMode === i ? "default" : "outline"}
                  className={`w-8 h-8 ${speedMode === i ? "bg-sky-600 hover:bg-sky-500" : "bg-black/50 border-sky-500/50 hover:bg-sky-900/50"}`}
                  onClick={() => setSpeedMode(i as SpeedMode)}
                  disabled={gameStatus !== "waiting"}
                  data-testid={`speed-mode-${i}`}
                >
                  {icon}
                </Button>
              ))}
            </div>
          </div>
          
          <BettingPanel
            balance={balance}
            minBet={gameConfig.minBet}
            maxBet={gameConfig.maxBet}
            onBet={placeBet}
            isPlaying={gameStatus !== "waiting"}
            buttonText={
              gameStatus === "flying"
                ? (language === "ru" ? "Летим..." : "Flying...")
                : gameStatus === "landing"
                ? (language === "ru" ? "Посадка..." : "Landing...")
                : gameStatus === "won"
                ? (language === "ru" ? "Победа!" : "Won!")
                : gameStatus === "crashed"
                ? (language === "ru" ? "Крушение!" : "Crashed!")
                : (language === "ru" ? "Взлёт" : "Take Off")
            }
            disabled={gameStatus !== "waiting"}
            compact
          />
        </div>
      </main>

      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          10%, 30%, 50%, 70%, 90% { transform: translateX(-5px); }
          20%, 40%, 60%, 80% { transform: translateX(5px); }
        }
        .animate-shake {
          animation: shake 0.5s ease-in-out;
        }
        .hide-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .hide-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
    </div>
  );
}
