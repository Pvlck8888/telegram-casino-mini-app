import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Minus, Plus, Zap } from "lucide-react";
import { useTelegram } from "./TelegramProvider";
import { useLanguage } from "./LanguageProvider";
import { useCurrency } from "./CurrencyProvider";

// USD bet ladder (with decimals) - Stars cannot be used for betting, only conversion
const BET_LADDER = [
  0.10, 0.20, 0.30, 0.40, 0.50, 0.60, 0.70, 0.80, 0.90, 1.00,
  2.00, 3.00, 4.00, 5.00, 10.00, 15.00, 20.00, 25.00, 30.00, 40.00, 50.00
];

const formatBetAmount = (value: number): string => {
  const rounded = Math.round(value * 100) / 100;
  return rounded.toFixed(2);
};

const findNearestLadderIndex = (value: number): number => {
  for (let i = 0; i < BET_LADDER.length; i++) {
    if (BET_LADDER[i] >= value) {
      return i;
    }
  }
  return BET_LADDER.length - 1;
};

interface BettingPanelProps {
  balance: number;
  minBet: number;
  maxBet: number;
  onBet: (amount: number) => void;
  isPlaying: boolean;
  buttonText?: string;
  buttonVariant?: "default" | "destructive";
  disabled?: boolean;
  compact?: boolean;
}

export function BettingPanel({
  balance,
  minBet,
  maxBet,
  onBet,
  isPlaying,
  buttonText,
  buttonVariant = "default",
  disabled = false,
  compact = false,
}: BettingPanelProps) {
  const { setGameActive, gameBalance } = useCurrency();
  // Always use USD balance for games - Stars are only for conversion
  const effectiveBalance = gameBalance;
  
  const [amount, setAmount] = useState(minBet);
  const { hapticFeedback } = useTelegram();
  const { t } = useLanguage();
  const displayButtonText = buttonText || t("bet");

  // Mark game as active when playing
  useEffect(() => {
    setGameActive(isPlaying);
    return () => setGameActive(false);
  }, [isPlaying, setGameActive]);

  // Reset amount on mount
  useEffect(() => {
    setAmount(minBet);
  }, [minBet]);

  const incrementBet = () => {
    hapticFeedback("light");
    const currentIndex = findNearestLadderIndex(amount);
    let nextIndex = currentIndex;
    if (BET_LADDER[currentIndex] <= amount && currentIndex < BET_LADDER.length - 1) {
      nextIndex = currentIndex + 1;
    }
    const newAmount = Math.min(BET_LADDER[nextIndex], maxBet, effectiveBalance);
    if (newAmount > amount) {
      setAmount(newAmount);
    }
  };

  const decrementBet = () => {
    hapticFeedback("light");
    const currentIndex = findNearestLadderIndex(amount);
    let prevIndex = currentIndex;
    if (currentIndex > 0) {
      if (BET_LADDER[currentIndex] >= amount) {
        prevIndex = currentIndex - 1;
      }
    }
    const newAmount = Math.max(BET_LADDER[prevIndex], minBet);
    if (newAmount < amount) {
      setAmount(newAmount);
    }
  };

  const multiplyAmount = (multiplier: number) => {
    hapticFeedback("light");
    const rawAmount = amount * multiplier;
    const nearestIndex = findNearestLadderIndex(rawAmount);
    const newAmount = Math.max(minBet, Math.min(maxBet, Math.min(effectiveBalance, BET_LADDER[nearestIndex])));
    setAmount(newAmount);
  };

  const setMaxBet = () => {
    hapticFeedback("medium");
    const maxAllowed = Math.min(maxBet, effectiveBalance);
    const nearestIndex = findNearestLadderIndex(maxAllowed);
    let newAmount = BET_LADDER[nearestIndex] <= maxAllowed ? BET_LADDER[nearestIndex] : (nearestIndex > 0 ? BET_LADDER[nearestIndex - 1] : BET_LADDER[0]);
    newAmount = Math.min(newAmount, maxAllowed);
    setAmount(newAmount);
  };

  const handleBet = () => {
    if (amount > effectiveBalance) {
      return;
    }
    hapticFeedback("heavy");
    onBet(amount);
  };

  const quickAmounts = [0.10, 0.50, 1.00, 5.00, 10.00, 20.00, 50.00, 100.00];

  if (compact) {
    return (
      <div className="bg-black/60 backdrop-blur-sm border border-emerald-500/30 rounded-xl p-2" data-testid="betting-panel">
        <div className="flex items-center gap-2">
          <Button
            size="icon"
            variant="secondary"
            className="bg-black/40 border-emerald-500/30 h-9 w-9"
            onClick={decrementBet}
            disabled={isPlaying || amount <= minBet}
            data-testid="button-decrease-bet"
          >
            <Minus className="w-4 h-4" />
          </Button>
          
          <div className="flex-1 relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/60 text-sm">$</span>
            <Input
              type="text"
              value={formatBetAmount(amount)}
              onChange={(e) => {
                const val = parseFloat(e.target.value) || minBet;
                const nearestIndex = findNearestLadderIndex(val);
                const newAmount = Math.max(minBet, Math.min(maxBet, Math.min(effectiveBalance, BET_LADDER[nearestIndex])));
                setAmount(newAmount);
              }}
              className="pl-7 text-center font-semibold bg-black/40 border-emerald-500/30 h-9"
              disabled={isPlaying}
              data-testid="input-bet-amount"
            />
          </div>
          
          <Button
            size="icon"
            variant="secondary"
            className="bg-black/40 border-emerald-500/30 h-9 w-9"
            onClick={incrementBet}
            disabled={isPlaying || amount >= Math.min(maxBet, effectiveBalance)}
            data-testid="button-increase-bet"
          >
            <Plus className="w-4 h-4" />
          </Button>
          
          <Button
            className="h-9 px-4 font-semibold gap-2 bg-emerald-500 hover:bg-emerald-600 text-white"
            onClick={handleBet}
            disabled={disabled || isPlaying || amount > effectiveBalance || amount < minBet}
            data-testid="button-place-bet"
          >
            <Zap className="w-4 h-4" />
            {displayButtonText}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-black/60 backdrop-blur-sm border border-emerald-500/30 rounded-xl p-3 space-y-3" data-testid="betting-panel">
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm text-white/60">{t("bet")}</span>
          <span className="text-xs text-white/40">
            Min: ${formatBetAmount(minBet)} | Max: ${formatBetAmount(Math.min(maxBet, effectiveBalance))}
          </span>
        </div>
        
        <div className="flex items-center gap-2">
          <Button
            size="icon"
            variant="secondary"
            className="bg-black/40 border-emerald-500/30"
            onClick={decrementBet}
            disabled={isPlaying || amount <= minBet}
            data-testid="button-decrease-bet"
          >
            <Minus className="w-4 h-4" />
          </Button>
          
          <div className="flex-1 relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/60">$</span>
            <Input
              type="text"
              value={formatBetAmount(amount)}
              onChange={(e) => {
                const val = parseFloat(e.target.value) || minBet;
                const nearestIndex = findNearestLadderIndex(val);
                const newAmount = Math.max(minBet, Math.min(maxBet, Math.min(effectiveBalance, BET_LADDER[nearestIndex])));
                setAmount(newAmount);
              }}
              className="pl-7 text-center text-lg font-semibold bg-black/40 border-emerald-500/30"
              disabled={isPlaying}
              data-testid="input-bet-amount"
            />
          </div>
          
          <Button
            size="icon"
            variant="secondary"
            className="bg-black/40 border-emerald-500/30"
            onClick={incrementBet}
            disabled={isPlaying || amount >= Math.min(maxBet, effectiveBalance)}
            data-testid="button-increase-bet"
          >
            <Plus className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-1">
        {quickAmounts.map((qa) => (
          <Button
            key={qa}
            size="sm"
            variant="secondary"
            className="text-xs bg-black/40 border-emerald-500/30 px-1"
            onClick={() => {
              hapticFeedback("light");
              const newAmount = Math.min(qa, Math.min(maxBet, effectiveBalance));
              setAmount(newAmount);
            }}
            disabled={isPlaying || qa > effectiveBalance || qa < minBet || qa > maxBet}
            data-testid={`button-quick-${qa}`}
          >
            ${formatBetAmount(qa)}
          </Button>
        ))}
      </div>

      <div className="flex items-center gap-1.5">
        <Button
          size="sm"
          variant="outline"
          className="flex-1 bg-black/40 border-emerald-500/30"
          onClick={() => multiplyAmount(0.5)}
          disabled={isPlaying}
          data-testid="button-half-bet"
        >
          ½
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="flex-1 bg-black/40 border-emerald-500/30"
          onClick={() => multiplyAmount(2)}
          disabled={isPlaying || amount * 2 > Math.min(maxBet, effectiveBalance)}
          data-testid="button-double-bet"
        >
          2×
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="flex-1 bg-black/40 border-emerald-500/30"
          onClick={setMaxBet}
          disabled={isPlaying}
          data-testid="button-max-bet"
        >
          MAX
        </Button>
      </div>

      <Button
        className="w-full h-10 text-base font-semibold gap-2 bg-emerald-500 hover:bg-emerald-600 text-white"
        onClick={handleBet}
        disabled={disabled || isPlaying || amount > effectiveBalance || amount < minBet}
        data-testid="button-place-bet"
      >
        <Zap className="w-5 h-5" />
        {displayButtonText}
      </Button>
    </div>
  );
}
