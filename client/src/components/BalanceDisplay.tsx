import { Wallet, Star, RefreshCw } from "lucide-react";
import { useCurrency } from "./CurrencyProvider";
import { useTelegram } from "./TelegramProvider";

interface BalanceDisplayProps {
  balance: number;
  starsBalance?: number;
  className?: string;
  onClick?: () => void;
  currency?: "USDT" | "TON";
  showToggle?: boolean; // Whether to show the currency toggle (false for games)
  compact?: boolean; // Compact mode for smaller displays
}

export function BalanceDisplay({ balance, starsBalance = 0, className = "", onClick, showToggle = true, compact = false }: BalanceDisplayProps) {
  const { currency, setCurrency, isLoading, isGameActive } = useCurrency();
  const { hapticFeedback } = useTelegram();

  const formattedBalance = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(balance);

  const formattedStars = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(starsBalance);

  const handleCurrencyToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isGameActive) return;
    hapticFeedback("light");
    setCurrency(currency === "usd" ? "stars" : "usd");
  };

  const isUsd = currency === "usd";
  const isDisabled = isLoading || isGameActive;
  const canShowToggle = showToggle && !isGameActive;

  // Compact display (no toggle) for game screens
  if (!canShowToggle || compact) {
    return (
      <button 
        className={`flex items-center gap-1.5 bg-card border border-card-border rounded-lg px-2 py-1 hover-elevate active-elevate-2 cursor-pointer transition-all ${className}`}
        onClick={onClick}
        data-testid="button-balance"
      >
        <div className={`w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 ${
          isUsd 
            ? "bg-gradient-to-br from-green-400 to-emerald-500" 
            : "bg-gradient-to-br from-amber-400 to-yellow-500"
        }`}>
          {isUsd ? (
            <Wallet className="w-2 h-2 text-white" />
          ) : (
            <Star className="w-2 h-2 text-white fill-white" />
          )}
        </div>
        <span className="text-xs font-bold text-foreground whitespace-nowrap max-w-[70px] overflow-hidden text-ellipsis" data-testid="text-balance">
          {isUsd ? `$${formattedBalance}` : formattedStars}
        </span>
        {!isUsd && <Star className="w-2.5 h-2.5 text-yellow-400 fill-yellow-400 flex-shrink-0" />}
      </button>
    );
  }

  return (
    <div className={`flex items-center gap-0.5 ${className}`}>
      <button
        className={`flex items-center gap-1 bg-card/60 border border-card-border rounded-l-lg px-1.5 py-1 transition-all ${
          isDisabled ? "opacity-50 cursor-not-allowed" : "hover-elevate active-elevate-2"
        }`}
        onClick={handleCurrencyToggle}
        disabled={isDisabled}
        data-testid="button-currency-toggle"
      >
        {isLoading ? (
          <RefreshCw className="w-3.5 h-3.5 text-muted-foreground animate-spin" />
        ) : (
          <div className={`w-4 h-4 rounded-full flex items-center justify-center transition-all ${
            isUsd 
              ? "bg-gradient-to-br from-green-400 to-emerald-500" 
              : "bg-gradient-to-br from-amber-400 to-yellow-500"
          }`}>
            {isUsd ? (
              <Wallet className="w-2 h-2 text-white" />
            ) : (
              <Star className="w-2 h-2 text-white fill-white" />
            )}
          </div>
        )}
      </button>
      <button 
        className="flex items-center gap-1 bg-card border border-card-border rounded-r-lg px-2 py-1 hover-elevate active-elevate-2 cursor-pointer transition-all"
        onClick={onClick}
        data-testid="button-balance"
      >
        <span className="text-xs font-bold text-foreground whitespace-nowrap max-w-[70px] overflow-hidden text-ellipsis" data-testid="text-balance">
          {isUsd ? `$${formattedBalance}` : formattedStars}
        </span>
        {!isUsd && <Star className="w-2.5 h-2.5 text-yellow-400 fill-yellow-400 flex-shrink-0" />}
      </button>
    </div>
  );
}

// Read-only balance display for game screens - always shows USD (Stars cannot be used for games)
export function GameBalanceDisplay({ balance, className = "" }: { balance: number; className?: string }) {
  const formattedBalance = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(balance);

  return (
    <div className={`flex items-center gap-1.5 bg-card/80 border border-card-border rounded-lg px-2 py-1 ${className}`} data-testid="game-balance-display">
      <div className="w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 bg-gradient-to-br from-green-400 to-emerald-500">
        <Wallet className="w-2 h-2 text-white" />
      </div>
      <span className="text-xs font-bold text-foreground" data-testid="text-game-balance">
        ${formattedBalance}
      </span>
    </div>
  );
}
