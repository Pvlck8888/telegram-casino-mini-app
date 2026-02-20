import { useEffect, useState, useRef, type ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useMultiplayer } from "@/hooks/useMultiplayer";
import { useLanguage } from "@/components/LanguageProvider";
import { Trophy, Flame, Sparkles, Dice1, CircleDollarSign, Spade, Rocket, Target, Bomb, Turtle } from "lucide-react";

interface WinEntry {
  id: string;
  username: string;
  amount: number;
  multiplier: number;
  gameType: string;
  timestamp: number;
}

const gameIcons: Record<string, ReactNode> = {
  crash: <Rocket className="w-3.5 h-3.5" />,
  mines: <Bomb className="w-3.5 h-3.5" />,
  dice: <Dice1 className="w-3.5 h-3.5" />,
  slots: <Sparkles className="w-3.5 h-3.5" />,
  luxe: <Sparkles className="w-3.5 h-3.5" />,
  scissors: <Target className="w-3.5 h-3.5" />,
  turtle: <Turtle className="w-3.5 h-3.5" />,
  blackjack: <Spade className="w-3.5 h-3.5" />,
  poker: <Spade className="w-3.5 h-3.5" />,
};

const gameColors: Record<string, string> = {
  crash: "text-orange-400",
  mines: "text-yellow-400",
  dice: "text-blue-400",
  slots: "text-purple-400",
  luxe: "text-amber-400",
  scissors: "text-pink-400",
  turtle: "text-green-400",
  blackjack: "text-red-400",
  poker: "text-emerald-400",
};

const gameNames: Record<string, Record<string, string>> = {
  crash: { en: "Crash", ru: "Краш", he: "קראש", ar: "كراش" },
  mines: { en: "Mines", ru: "Мины", he: "מוקשים", ar: "ألغام" },
  dice: { en: "Dice", ru: "Кости", he: "קוביות", ar: "نرد" },
  slots: { en: "Slots", ru: "Слоты", he: "סלוטים", ar: "سلوتس" },
  luxe: { en: "Luxe", ru: "Люкс", he: "לוקס", ar: "لوكس" },
  scissors: { en: "RPS", ru: "КНБ", he: "אבן נייר ומספריים", ar: "حجر ورقة مقص" },
  turtle: { en: "Turtle", ru: "Черепахи", he: "צבים", ar: "سلحفاة" },
  blackjack: { en: "Blackjack", ru: "Блэкджек", he: "בלקג'ק", ar: "بلاك جاك" },
  poker: { en: "Poker", ru: "Покер", he: "פוקר", ar: "بوكر" },
};

export function LiveWinTicker() {
  const { recentBets } = useMultiplayer();
  const { language } = useLanguage();
  const [wins, setWins] = useState<WinEntry[]>([]);
  const contentRef = useRef<HTMLDivElement>(null);
  const [contentWidth, setContentWidth] = useState(0);

  useEffect(() => {
    const winningBets = recentBets
      .filter((bet) => bet.isWin && bet.payout > 0)
      .map((bet) => ({
        id: bet.id,
        username: bet.username.length > 8 ? bet.username.substring(0, 6) + "..." : bet.username,
        amount: bet.payout,
        multiplier: bet.payout / bet.amount,
        gameType: bet.gameType,
        timestamp: Date.now(),
      }))
      .slice(0, 15);

    if (winningBets.length > 0) {
      setWins(winningBets);
    }
  }, [recentBets]);

  useEffect(() => {
    const updateWidth = () => {
      if (contentRef.current) {
        setContentWidth(contentRef.current.scrollWidth / 2);
      }
    };
    
    updateWidth();
    
    const resizeObserver = new ResizeObserver(updateWidth);
    if (contentRef.current) {
      resizeObserver.observe(contentRef.current);
    }
    
    return () => resizeObserver.disconnect();
  }, [wins]);

  if (wins.length === 0) {
    return null;
  }

  const duplicatedWins = [...wins, ...wins];
  const animationDuration = Math.max(wins.length * 3, 15);

  return (
    <div 
      className="relative overflow-hidden bg-gradient-to-r from-primary/10 via-amber-500/10 to-primary/10 rounded-lg py-2"
      data-testid="live-win-ticker"
    >
      <div className="absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-background to-transparent z-10" />
      <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-background to-transparent z-10" />
      
      <motion.div
        ref={contentRef}
        className="flex gap-4 whitespace-nowrap"
        animate={{
          x: contentWidth > 0 ? [0, -contentWidth] : [0, -800],
        }}
        transition={{
          x: {
            repeat: Infinity,
            repeatType: "loop",
            duration: animationDuration,
            ease: "linear",
          },
        }}
      >
        {duplicatedWins.map((win, index) => (
          <div
            key={`${win.id}-${index}`}
            className="flex items-center gap-2 px-3 py-1 bg-card/60 backdrop-blur-sm rounded-full border border-border/50 flex-shrink-0"
          >
            <div className={`${gameColors[win.gameType] || "text-primary"}`}>
              {gameIcons[win.gameType] || <CircleDollarSign className="w-3.5 h-3.5" />}
            </div>
            <span className="text-xs text-muted-foreground font-medium">
              {win.username}
            </span>
            <span className="text-xs font-semibold text-primary">
              ${win.amount.toFixed(2)}
            </span>
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full bg-primary/20 ${gameColors[win.gameType] || "text-primary"}`}>
              {win.multiplier.toFixed(1)}x
            </span>
            <span className="text-[10px] text-muted-foreground">
              {gameNames[win.gameType]?.[language] || win.gameType}
            </span>
          </div>
        ))}
      </motion.div>
    </div>
  );
}

export function GamePromoTicker() {
  const { language } = useLanguage();
  const [currentPromo, setCurrentPromo] = useState(0);

  const promos = [
    {
      id: "poker",
      icon: <Spade className="w-5 h-5" />,
      title: language === "ru" ? "ПОКЕР" : "POKER",
      subtitle: language === "ru" ? "Турниры 24/7" : "24/7 Tournaments",
      color: "from-emerald-600 to-green-500",
      accent: "text-emerald-400",
    },
    {
      id: "crash",
      icon: <Rocket className="w-5 h-5" />,
      title: language === "ru" ? "КРАШ" : "CRASH",
      subtitle: language === "ru" ? "До 1000x" : "Up to 1000x",
      color: "from-orange-600 to-red-500",
      accent: "text-orange-400",
    },
    {
      id: "slots",
      icon: <Sparkles className="w-5 h-5" />,
      title: language === "ru" ? "СЛОТЫ" : "SLOTS",
      subtitle: language === "ru" ? "Бонус 300%" : "300% Bonus",
      color: "from-purple-600 to-pink-500",
      accent: "text-purple-400",
    },
    {
      id: "jackpot",
      icon: <Trophy className="w-5 h-5" />,
      title: language === "ru" ? "ДЖЕКПОТ" : "JACKPOT",
      subtitle: "$2,500+",
      color: "from-amber-500 to-yellow-400",
      accent: "text-amber-400",
    },
    {
      id: "bonus",
      icon: <Flame className="w-5 h-5" />,
      title: language === "ru" ? "БОНУС" : "BONUS",
      subtitle: language === "ru" ? "Каждый день" : "Every Day",
      color: "from-red-600 to-orange-500",
      accent: "text-red-400",
    },
  ];

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentPromo((prev) => (prev + 1) % promos.length);
    }, 3000);
    return () => clearInterval(interval);
  }, [promos.length]);

  return (
    <div className="relative overflow-hidden h-10" data-testid="game-promo-ticker">
      <AnimatePresence mode="wait">
        <motion.div
          key={promos[currentPromo].id}
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -20, opacity: 0 }}
          transition={{ duration: 0.3 }}
          className={`absolute inset-0 flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r ${promos[currentPromo].color} px-4`}
        >
          <motion.div
            animate={{ rotate: [0, 10, -10, 0] }}
            transition={{ repeat: Infinity, duration: 2 }}
            className="text-white"
          >
            {promos[currentPromo].icon}
          </motion.div>
          <span className="font-bold text-white text-sm tracking-wide">
            {promos[currentPromo].title}
          </span>
          <span className="text-white/80 text-xs">
            {promos[currentPromo].subtitle}
          </span>
          <motion.div
            className="absolute right-3"
            animate={{ scale: [1, 1.2, 1] }}
            transition={{ repeat: Infinity, duration: 1.5 }}
          >
            <Flame className="w-4 h-4 text-white/60" />
          </motion.div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

export function JackpotCounter() {
  const { language } = useLanguage();
  const [jackpot, setJackpot] = useState(2349.48);

  useEffect(() => {
    const interval = setInterval(() => {
      setJackpot((prev) => prev + Math.random() * 0.5);
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  return (
    <motion.div 
      className="relative overflow-hidden rounded-xl bg-gradient-to-r from-amber-600 via-yellow-500 to-amber-600 p-3"
      data-testid="jackpot-counter"
    >
      <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxjaXJjbGUgY3g9IjIwIiBjeT0iMjAiIHI9IjMiIGZpbGw9InJnYmEoMjU1LDI1NSwyNTUsMC4xKSIvPjwvZz48L3N2Zz4=')] opacity-30" />
      
      <motion.div 
        className="absolute -left-4 -top-4 w-16 h-16 rounded-full bg-white/10 blur-xl"
        animate={{ scale: [1, 1.3, 1], opacity: [0.3, 0.6, 0.3] }}
        transition={{ repeat: Infinity, duration: 2 }}
      />
      
      <div className="relative flex items-center justify-between">
        <div className="flex items-center gap-2">
          <motion.div
            animate={{ rotate: [0, 360] }}
            transition={{ repeat: Infinity, duration: 3, ease: "linear" }}
          >
            <Trophy className="w-6 h-6 text-white drop-shadow-lg" />
          </motion.div>
          <span className="text-white font-semibold text-sm uppercase tracking-wide">
            {language === "ru" ? "Джекпот" : "Jackpot"}
          </span>
        </div>
        
        <motion.div
          className="flex items-baseline gap-1"
          animate={{ scale: [1, 1.02, 1] }}
          transition={{ repeat: Infinity, duration: 1 }}
        >
          <span className="text-white/80 text-lg font-bold">$</span>
          <span className="text-white text-2xl font-black tracking-tight drop-shadow-lg">
            {jackpot.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        </motion.div>
      </div>
    </motion.div>
  );
}
