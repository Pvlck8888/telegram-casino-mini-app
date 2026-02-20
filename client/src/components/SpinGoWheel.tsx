import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Zap, DollarSign, Star, Sparkles, Crown, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAudio } from "@/components/AudioProvider";

interface SpinGoWheelProps {
  isOpen: boolean;
  buyIn: number;
  multiplier?: number;
  serverPrizePool?: number;
  players?: Array<{ username: string; photoUrl?: string }>;
  onComplete: (multiplier: number, prizePool: number) => void;
  onClose: () => void;
}

interface WheelSegment {
  multiplier: number;
  label: string;
  color: string;
  glowColor: string;
  textColor: string;
  isJackpot?: boolean;
}

const WHEEL_SEGMENTS: WheelSegment[] = [
  { multiplier: 2, label: "2x", color: "#1e40af", glowColor: "#3b82f6", textColor: "#fff" },
  { multiplier: 3, label: "3x", color: "#065f46", glowColor: "#10b981", textColor: "#fff" },
  { multiplier: 2, label: "2x", color: "#1e40af", glowColor: "#3b82f6", textColor: "#fff" },
  { multiplier: 5, label: "5x", color: "#7c2d12", glowColor: "#f97316", textColor: "#fff" },
  { multiplier: 2, label: "2x", color: "#1e40af", glowColor: "#3b82f6", textColor: "#fff" },
  { multiplier: 10, label: "10x", color: "#7e22ce", glowColor: "#a855f7", textColor: "#fff" },
  { multiplier: 2, label: "2x", color: "#1e40af", glowColor: "#3b82f6", textColor: "#fff" },
  { multiplier: 3, label: "3x", color: "#065f46", glowColor: "#10b981", textColor: "#fff" },
  { multiplier: 2, label: "2x", color: "#1e40af", glowColor: "#3b82f6", textColor: "#fff" },
  { multiplier: 25, label: "25x", color: "#be123c", glowColor: "#f43f5e", textColor: "#fff" },
  { multiplier: 2, label: "2x", color: "#1e40af", glowColor: "#3b82f6", textColor: "#fff" },
  { multiplier: 100, label: "100x", color: "#92400e", glowColor: "#fbbf24", textColor: "#000", isJackpot: true },
];

const TOTAL_SEGMENTS = WHEEL_SEGMENTS.length;
const SEGMENT_ANGLE = 360 / TOTAL_SEGMENTS;

function getSegmentIndexForMultiplier(multiplier: number): number {
  const indices = WHEEL_SEGMENTS.map((seg, idx) => 
    seg.multiplier === multiplier ? idx : -1
  ).filter(idx => idx !== -1);
  return indices[Math.floor(Math.random() * indices.length)] ?? 0;
}

export function SpinGoWheel({ 
  isOpen, 
  buyIn, 
  multiplier: presetMultiplier,
  serverPrizePool,
  players,
  onComplete, 
  onClose 
}: SpinGoWheelProps) {
  const { playSound } = useAudio();
  const [phase, setPhase] = useState<"idle" | "anticipation" | "spinning" | "slowing" | "landing" | "reveal">("idle");
  const [rotation, setRotation] = useState(0);
  const [finalMultiplier, setFinalMultiplier] = useState<number | null>(null);
  const [prizePool, setPrizePool] = useState(0);
  const tickIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const [tickSpeed, setTickSpeed] = useState(100);

  const startSpin = useCallback(() => {
    if (phase !== "idle") return;
    if (!presetMultiplier) return;
    
    const targetSegmentIndex = getSegmentIndexForMultiplier(presetMultiplier);
    const finalTargetAngle = (360 - (targetSegmentIndex * SEGMENT_ANGLE)) - (SEGMENT_ANGLE / 2);
    
    setPhase("anticipation");
    playSound("spin");
    
    setTimeout(() => {
      setPhase("spinning");
      
      const fullSpins = 360 * 4;
      const firstRotation = rotation + fullSpins;
      setRotation(firstRotation);
      
      setTimeout(() => {
        setPhase("slowing");
        const slowSpins = 360 * 2;
        const secondRotation = firstRotation + slowSpins + finalTargetAngle;
        setRotation(secondRotation);
        
        setTimeout(() => {
          setPhase("landing");
          
          setTimeout(() => {
            setPhase("reveal");
            setFinalMultiplier(presetMultiplier);
            const prize = serverPrizePool || (buyIn * 3 * presetMultiplier * 0.93);
            setPrizePool(prize);
            playSound("win");
          }, 500);
        }, 3000);
      }, 2000);
    }, 500);
  }, [phase, rotation, buyIn, presetMultiplier, serverPrizePool, playSound]);

  useEffect(() => {
    if (phase === "spinning" || phase === "slowing") {
      tickIntervalRef.current = setInterval(() => {
        playSound("click");
      }, phase === "spinning" ? 80 : 150);
      
      return () => {
        if (tickIntervalRef.current) {
          clearInterval(tickIntervalRef.current);
        }
      };
    }
  }, [phase, playSound]);

  useEffect(() => {
    if (isOpen && phase === "idle" && presetMultiplier) {
      setRotation(0);
      setFinalMultiplier(null);
      setPrizePool(0);
      setTimeout(() => startSpin(), 800);
    }
  }, [isOpen, presetMultiplier]);

  const handleContinue = () => {
    if (finalMultiplier !== null) {
      onComplete(finalMultiplier, prizePool);
    }
  };

  const getSpinDuration = () => {
    switch (phase) {
      case "spinning": return 2;
      case "slowing": return 3;
      default: return 0;
    }
  };

  const getEasing = () => {
    switch (phase) {
      case "spinning": return [0.2, 0, 0.8, 1];
      case "slowing": return [0.2, 0.8, 0.2, 1];
      default: return [0.2, 0.8, 0.2, 1];
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/90 z-50"
          />
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.8, opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
          >
            <div className="w-full max-w-md bg-gradient-to-b from-[#1a1a2e] to-[#0f0f1a] rounded-3xl overflow-hidden border border-amber-500/30 shadow-2xl shadow-amber-500/20">
              <div className="bg-gradient-to-r from-amber-600 via-yellow-500 to-amber-600 p-4 relative">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(255,255,255,0.2),transparent_70%)]" />
                <div className="relative z-10 text-center">
                  <div className="flex items-center justify-center gap-2">
                    <Zap className="w-6 h-6 text-white" />
                    <h2 className="text-2xl font-black text-white tracking-wide">SPIN & GO</h2>
                    <Zap className="w-6 h-6 text-white" />
                  </div>
                  <div className="flex items-center justify-center gap-4 mt-2 text-amber-100">
                    <span className="text-lg font-bold">${buyIn}</span>
                    <span className="text-sm opacity-80">Buy-in</span>
                  </div>
                </div>
                <button
                  onClick={onClose}
                  className="absolute top-2 right-2 w-8 h-8 flex items-center justify-center rounded-full bg-black/20 hover:bg-black/40 transition-colors"
                  data-testid="close-spin-wheel"
                >
                  <X className="w-5 h-5 text-white" />
                </button>
              </div>

              {players && players.length > 0 && (
                <div className="px-4 py-3 bg-black/30 border-b border-amber-500/20">
                  <div className="flex items-center justify-center gap-1 mb-2 text-xs text-amber-400">
                    <Users className="w-3 h-3" />
                    <span>3 Players Matched</span>
                  </div>
                  <div className="flex justify-center gap-3">
                    {players.map((player, i) => (
                      <div key={i} className="flex flex-col items-center">
                        {player.photoUrl ? (
                          <img 
                            src={player.photoUrl} 
                            alt={player.username}
                            className="w-10 h-10 rounded-full border-2 border-amber-500/50"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center text-white font-bold text-sm border-2 border-amber-500/50">
                            {player.username[0]?.toUpperCase()}
                          </div>
                        )}
                        <span className="text-xs text-zinc-400 mt-1 truncate max-w-[60px]">
                          {player.username}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              <div className="p-6 flex flex-col items-center">
                <div className="relative w-72 h-72">
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 z-20 -mt-1">
                    <div className="relative">
                      <div className="w-0 h-0 border-l-[14px] border-r-[14px] border-t-[28px] border-l-transparent border-r-transparent border-t-amber-400 drop-shadow-lg" />
                      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-0 h-0 border-l-[10px] border-r-[10px] border-t-[20px] border-l-transparent border-r-transparent border-t-yellow-300" />
                    </div>
                  </div>
                  
                  <div className={`absolute inset-0 rounded-full transition-shadow duration-300 ${
                    phase === "reveal" ? "shadow-[0_0_60px_20px_rgba(251,191,36,0.4)]" : "shadow-[0_0_30px_10px_rgba(251,191,36,0.2)]"
                  }`} />
                  
                  <div className="absolute inset-0 rounded-full border-[6px] border-amber-500/70 shadow-inner" />
                  <div className="absolute inset-1 rounded-full border-[3px] border-amber-400/40" />
                  
                  <motion.div
                    className="absolute inset-3 rounded-full overflow-hidden"
                    style={{
                      background: `conic-gradient(from 0deg, ${WHEEL_SEGMENTS.map((seg, i) => 
                        `${seg.color} ${(i / TOTAL_SEGMENTS) * 100}% ${((i + 1) / TOTAL_SEGMENTS) * 100}%`
                      ).join(", ")})`,
                    }}
                    animate={{ rotate: rotation }}
                    transition={{
                      duration: getSpinDuration(),
                      ease: getEasing() as any,
                    }}
                  >
                    {WHEEL_SEGMENTS.map((seg, i) => {
                      const angle = SEGMENT_ANGLE * i + (SEGMENT_ANGLE / 2);
                      const radians = (angle - 90) * (Math.PI / 180);
                      const radius = 85;
                      const x = 50 + radius * Math.cos(radians) * 0.65;
                      const y = 50 + radius * Math.sin(radians) * 0.65;
                      
                      return (
                        <div
                          key={i}
                          className={`absolute font-black text-sm drop-shadow-md ${seg.isJackpot ? "animate-pulse" : ""}`}
                          style={{
                            left: `${x}%`,
                            top: `${y}%`,
                            transform: `translate(-50%, -50%) rotate(${angle}deg)`,
                            color: seg.textColor,
                            textShadow: seg.isJackpot ? "0 0 10px rgba(251,191,36,0.8)" : "0 2px 4px rgba(0,0,0,0.5)",
                            fontSize: seg.isJackpot ? "14px" : "12px",
                          }}
                        >
                          {seg.label}
                        </div>
                      );
                    })}
                    
                    {WHEEL_SEGMENTS.map((_, i) => {
                      const angle = SEGMENT_ANGLE * i;
                      return (
                        <div
                          key={`divider-${i}`}
                          className="absolute w-[2px] h-1/2 bg-black/30 origin-bottom"
                          style={{
                            left: "50%",
                            top: "0",
                            transform: `translateX(-50%) rotate(${angle}deg)`,
                            transformOrigin: "50% 100%",
                          }}
                        />
                      );
                    })}
                  </motion.div>
                  
                  <div className="absolute inset-0 flex items-center justify-center z-10">
                    <motion.div 
                      className="w-20 h-20 rounded-full bg-gradient-to-br from-amber-400 via-yellow-400 to-amber-500 border-4 border-yellow-300 shadow-lg flex items-center justify-center"
                      animate={phase === "reveal" ? { scale: [1, 1.1, 1] } : {}}
                      transition={{ duration: 0.5 }}
                    >
                      <div className="text-center">
                        <Crown className="w-8 h-8 text-amber-800 mx-auto" />
                      </div>
                    </motion.div>
                  </div>
                </div>
                
                <AnimatePresence>
                  {phase === "reveal" && finalMultiplier && (
                    <motion.div
                      initial={{ opacity: 0, y: 20, scale: 0.8 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      className="mt-6 text-center"
                    >
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: [0, 1.4, 1] }}
                        transition={{ duration: 0.6, ease: "backOut" }}
                        className={`inline-flex items-center gap-3 px-8 py-4 rounded-2xl ${
                          finalMultiplier >= 100 
                            ? "bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-400 text-amber-900" 
                            : finalMultiplier >= 25
                              ? "bg-gradient-to-r from-rose-500 to-pink-600 text-white"
                              : finalMultiplier >= 10
                                ? "bg-gradient-to-r from-purple-500 to-violet-600 text-white"
                                : "bg-gradient-to-r from-blue-500 to-cyan-500 text-white"
                        } shadow-lg`}
                      >
                        {finalMultiplier >= 25 && <Star className="w-7 h-7 fill-current" />}
                        <span className="text-4xl font-black">
                          {finalMultiplier}x
                        </span>
                        {finalMultiplier >= 25 && <Star className="w-7 h-7 fill-current" />}
                      </motion.div>
                      
                      <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.3 }}
                        className="mt-4 space-y-1"
                      >
                        <div className="text-sm text-zinc-400">Prize Pool</div>
                        <div className="flex items-center justify-center gap-2">
                          <DollarSign className="w-7 h-7 text-green-400" />
                          <span className="text-3xl font-black text-green-400">
                            {prizePool.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                        </div>
                      </motion.div>
                      
                      <Button
                        onClick={handleContinue}
                        className="mt-6 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-bold text-lg px-10 py-6 h-auto"
                        data-testid="button-start-spingo"
                      >
                        <Sparkles className="w-5 h-5 mr-2" />
                        Start Game!
                      </Button>
                    </motion.div>
                  )}
                </AnimatePresence>
                
                {(phase === "anticipation" || phase === "spinning" || phase === "slowing" || phase === "landing") && (
                  <div className="mt-6 text-center">
                    <motion.div
                      animate={{ opacity: [0.5, 1, 0.5] }}
                      transition={{ duration: 0.8, repeat: Infinity }}
                      className="text-amber-400 font-semibold text-lg"
                    >
                      {phase === "anticipation" && "Get Ready..."}
                      {phase === "spinning" && "Spinning..."}
                      {phase === "slowing" && "Almost there..."}
                      {phase === "landing" && "Landing..."}
                    </motion.div>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
