import { useState, useEffect, useRef } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { X, Gift, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "./LanguageProvider";
import { useTelegram } from "./TelegramProvider";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

interface DailyWheelProps {
  odejs: string;
  isOpen: boolean;
  onClose: () => void;
  onBalanceUpdate: (newBalance: number) => void;
}

interface WheelStatus {
  canSpin: boolean;
  nextSpinAt: string | null;
}

// Wheel segments with consistent prizes (must match server)
// Segment index 0 = top segment (where pointer is)
const WHEEL_SEGMENTS = [
  { prize: 12, label: "$12.00", color: "#8b5cf6", isJackpot: false },    // 0 - Purple
  { prize: 0.60, label: "$0.60", color: "#3b82f6", isJackpot: false },   // 1 - Blue
  { prize: 0.12, label: "$0.12", color: "#ec4899", isJackpot: false },   // 2 - Pink
  { prize: 0, label: "$0", color: "#374151", isJackpot: false },         // 3 - Gray (gift box)
  { prize: 3, label: "$3.00", color: "#3b82f6", isJackpot: false },      // 4 - Blue
  { prize: 0.30, label: "$0.30", color: "#ec4899", isJackpot: false },   // 5 - Pink
  { prize: 0.60, label: "$0.60", color: "#8b5cf6", isJackpot: false },   // 6 - Purple
  { prize: 0, label: "$0", color: "#374151", isJackpot: false },         // 7 - Gray (gift box)
];

export function DailyWheel({ odejs, isOpen, onClose, onBalanceUpdate }: DailyWheelProps) {
  const { language } = useLanguage();
  const { hapticFeedback } = useTelegram();
  const { toast } = useToast();
  const [rotation, setRotation] = useState(0);
  const [isSpinning, setIsSpinning] = useState(false);
  const [countdown, setCountdown] = useState<string>("");
  const wheelRef = useRef<HTMLDivElement>(null);

  const { data: wheelStatus, refetch: refetchStatus } = useQuery<WheelStatus>({
    queryKey: ["/api/wheel/status", odejs],
    enabled: isOpen && !!odejs,
  });

  const spinMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/wheel/spin", { odejs });
      return res.json();
    },
    onSuccess: (data) => {
      if (data.success) {
        const segmentIndex = data.segmentIndex ?? 0;
        const segmentAngle = 360 / WHEEL_SEGMENTS.length;
        
        // Calculate the exact rotation needed to land on the correct segment
        // The pointer is at top (0 degrees), so we need to rotate the segment to that position
        const targetSegmentCenter = segmentIndex * segmentAngle + segmentAngle / 2;
        
        const spins = 5; // Total rotations for effect
        
        // Calculate final rotation to land on correct segment
        const finalRotation = spins * 360 - targetSegmentCenter;
        
        setRotation(finalRotation);
        setIsSpinning(true);
        hapticFeedback("medium");
        
        // Wait for spin to complete
        setTimeout(() => {
          setIsSpinning(false);
          hapticFeedback("heavy");
          
          if (data.prize > 0) {
            toast({
              title: language === "ru" ? "Поздравляем!" : "Congratulations!",
              description: language === "ru" 
                ? `Вы выиграли $${data.prize.toFixed(2)}!` 
                : `You won $${data.prize.toFixed(2)}!`,
            });
          } else {
            toast({
              title: language === "ru" ? "Не повезло!" : "Better luck next time!",
              description: language === "ru" 
                ? "Попробуйте завтра!" 
                : "Try again tomorrow!",
              variant: "destructive",
            });
          }

          if (data.newBalance !== undefined) {
            onBalanceUpdate(data.newBalance);
          }

          refetchStatus();
          queryClient.invalidateQueries({ queryKey: ["/api/user"] });
        }, 4000);
      }
    },
    onError: (error: any) => {
      toast({
        title: language === "ru" ? "Ошибка" : "Error",
        description: error.message || (language === "ru" ? "Не удалось крутить колесо" : "Failed to spin wheel"),
        variant: "destructive",
      });
    },
  });

  useEffect(() => {
    if (!wheelStatus?.nextSpinAt) {
      setCountdown("");
      return;
    }

    const updateCountdown = () => {
      const now = new Date().getTime();
      const target = new Date(wheelStatus.nextSpinAt!).getTime();
      const diff = target - now;

      if (diff <= 0) {
        setCountdown("");
        refetchStatus();
        return;
      }

      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);
      setCountdown(`${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`);
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [wheelStatus?.nextSpinAt, refetchStatus]);

  const handleSpin = () => {
    if (!wheelStatus?.canSpin || isSpinning) return;
    hapticFeedback("light");
    spinMutation.mutate();
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.8, opacity: 0 }}
          className="bg-gradient-to-b from-gray-900 via-gray-800 to-gray-900 border-2 border-amber-500/50 rounded-3xl p-5 max-w-sm w-full shadow-2xl shadow-amber-500/20"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-400 to-orange-600 flex items-center justify-center">
                <Gift className="w-4 h-4 text-white" />
              </div>
              <div>
                <h2 className="text-lg font-black text-white">
                  {language === "ru" ? "КОЛЕСО ФОРТУНЫ" : "WHEEL OF FORTUNE"}
                </h2>
                <p className="text-xs text-amber-400 font-medium">
                  {language === "ru" ? "Выиграй до $100!" : "Win up to $100!"}
                </p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="text-white/60 hover:text-white hover:bg-white/10"
              data-testid="button-close-wheel"
            >
              <X className="w-5 h-5" />
            </Button>
          </div>

          {/* Spin Button - MOVED HIGHER */}
          <div className="mb-4">
            {countdown ? (
              <div className="text-center py-2 bg-gray-800/50 rounded-xl border border-gray-700">
                <p className="text-xs text-gray-400 mb-1">
                  {language === "ru" ? "Следующий спин:" : "Next spin in:"}
                </p>
                <div className="text-2xl font-mono font-bold text-amber-400" data-testid="text-wheel-countdown">
                  {countdown}
                </div>
              </div>
            ) : (
              <Button
                className="w-full h-14 text-xl font-black bg-gradient-to-r from-amber-500 via-orange-500 to-red-500 hover:from-amber-400 hover:via-orange-400 hover:to-red-400 text-white shadow-lg shadow-orange-500/30 border-0"
                onClick={handleSpin}
                disabled={!wheelStatus?.canSpin || isSpinning || spinMutation.isPending}
                data-testid="button-spin-wheel"
              >
                {isSpinning ? (
                  <span className="flex items-center gap-2">
                    <Sparkles className="w-5 h-5 animate-pulse" />
                    {language === "ru" ? "КРУТИТСЯ..." : "SPINNING..."}
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <Sparkles className="w-5 h-5" />
                    {language === "ru" ? "КРУТИТЬ!" : "SPIN NOW!"}
                  </span>
                )}
              </Button>
            )}
          </div>

          {/* Wheel */}
          <div className="relative w-56 h-56 mx-auto mb-3">
            {/* Pointer */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1 z-20">
              <div className="w-0 h-0 border-l-[14px] border-r-[14px] border-t-[24px] border-l-transparent border-r-transparent border-t-amber-400 drop-shadow-lg" />
            </div>

            {/* Glow effect */}
            <div className="absolute inset-0 rounded-full bg-gradient-to-br from-amber-500/20 to-orange-500/20 blur-xl" />

            <motion.div
              ref={wheelRef}
              className="w-full h-full rounded-full overflow-hidden shadow-2xl border-4 border-amber-500/50"
              style={{ rotate: rotation }}
              animate={{ rotate: rotation }}
              transition={{ 
                duration: isSpinning ? 2.5 : 0, 
                ease: [0.2, 0.8, 0.2, 1] 
              }}
            >
              <svg viewBox="0 0 100 100" className="w-full h-full">
                {WHEEL_SEGMENTS.map((segment, i) => {
                  const angle = (360 / WHEEL_SEGMENTS.length) * i;
                  const startAngle = (angle - 90) * (Math.PI / 180);
                  const endAngle = (angle + 360 / WHEEL_SEGMENTS.length - 90) * (Math.PI / 180);
                  const x1 = 50 + 50 * Math.cos(startAngle);
                  const y1 = 50 + 50 * Math.sin(startAngle);
                  const x2 = 50 + 50 * Math.cos(endAngle);
                  const y2 = 50 + 50 * Math.sin(endAngle);
                  const largeArc = 360 / WHEEL_SEGMENTS.length > 180 ? 1 : 0;
                  
                  const midAngle = (startAngle + endAngle) / 2;
                  const textX = 50 + 32 * Math.cos(midAngle);
                  const textY = 50 + 32 * Math.sin(midAngle);

                  return (
                    <g key={i}>
                      <path
                        d={`M 50 50 L ${x1} ${y1} A 50 50 0 ${largeArc} 1 ${x2} ${y2} Z`}
                        fill={segment.color}
                        stroke="#1f2937"
                        strokeWidth="0.5"
                      />
                      <text
                        x={textX}
                        y={textY}
                        textAnchor="middle"
                        dominantBaseline="middle"
                        fill="white"
                        fontSize="6"
                        fontWeight="bold"
                        style={{ 
                          transform: `rotate(${angle + 360 / WHEEL_SEGMENTS.length / 2}deg)`,
                          transformOrigin: `${textX}px ${textY}px`
                        }}
                      >
                        {segment.label}
                      </text>
                    </g>
                  );
                })}
                {/* Center hub */}
                <circle cx="50" cy="50" r="10" fill="#1f2937" stroke="#fbbf24" strokeWidth="2" />
                <circle cx="50" cy="50" r="6" fill="url(#hubGradient)" />
                <defs>
                  <radialGradient id="hubGradient">
                    <stop offset="0%" stopColor="#fbbf24" />
                    <stop offset="100%" stopColor="#f59e0b" />
                  </radialGradient>
                </defs>
              </svg>
            </motion.div>
          </div>

          {/* Max prize highlight */}
          <div className="text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-purple-600/20 border border-purple-500/30 rounded-full">
              <span className="w-2 h-2 bg-purple-500 rounded-full animate-pulse" />
              <span className="text-xs font-bold text-purple-400">
                {language === "ru" ? "МАКС $12.00" : "MAX $12.00"}
              </span>
              <span className="w-2 h-2 bg-purple-500 rounded-full animate-pulse" />
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
