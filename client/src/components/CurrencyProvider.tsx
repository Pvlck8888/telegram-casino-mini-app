import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { useTelegram } from "./TelegramProvider";
import { apiRequest, queryClient } from "@/lib/queryClient";

type Currency = "usd" | "stars";

interface CurrencyContextType {
  currency: Currency;
  setCurrency: (currency: Currency) => void;
  balance: number;
  starsBalance: number;
  currentBalance: number;
  gameBalance: number; // Always USD - Stars cannot be used for games
  gameCurrency: "usd"; // Games always use USD
  isLoading: boolean;
  isGameActive: boolean;
  setGameActive: (active: boolean) => void;
}

const CurrencyContext = createContext<CurrencyContextType | null>(null);

export function CurrencyProvider({ children }: { children: React.ReactNode }) {
  const { user, refetchUser } = useTelegram();
  const [currency, setCurrencyState] = useState<Currency>("usd");
  const [isLoading, setIsLoading] = useState(false);
  const [isGameActive, setGameActive] = useState(false);

  useEffect(() => {
    if (user?.preferredCurrency) {
      setCurrencyState(user.preferredCurrency as Currency);
    }
  }, [user?.preferredCurrency]);

  const setCurrency = useCallback(async (newCurrency: Currency) => {
    // Prevent currency switching during active gameplay
    if (isGameActive) {
      console.log("Cannot switch currency during active game");
      return;
    }
    
    if (!user?.id) return;
    
    const previousCurrency = currency;
    setIsLoading(true);
    
    try {
      await apiRequest("POST", `/api/users/${user.id}/preferred-currency`, { currency: newCurrency });
      setCurrencyState(newCurrency); // Only update state after successful API call
      await refetchUser();
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
    } catch (error) {
      console.error("Failed to update currency preference:", error);
      setCurrencyState(previousCurrency);
    } finally {
      setIsLoading(false);
    }
  }, [user?.id, refetchUser, currency, isGameActive]);

  const balance = user?.balance ?? 0;
  const starsBalance = user?.starsBalance ?? 0;
  const currentBalance = currency === "usd" ? balance : starsBalance;
  // Games always use USD - Stars are only for conversion
  const gameBalance = balance;
  const gameCurrency = "usd" as const;

  return (
    <CurrencyContext.Provider value={{
      currency,
      setCurrency,
      balance,
      starsBalance,
      currentBalance,
      gameBalance,
      gameCurrency,
      isLoading,
      isGameActive,
      setGameActive
    }}>
      {children}
    </CurrencyContext.Provider>
  );
}

export function useCurrency() {
  const context = useContext(CurrencyContext);
  if (!context) {
    throw new Error("useCurrency must be used within a CurrencyProvider");
  }
  return context;
}

// Utility function to format amounts with correct currency symbol
export function formatCurrencyAmount(amount: number, currency: "usd" | "stars", showPlus = false): string {
  const prefix = showPlus && amount > 0 ? "+" : "";
  if (currency === "stars") {
    return `${prefix}${Math.floor(amount)} ⭐`;
  }
  return `${prefix}$${amount.toFixed(2)}`;
}

// Component to display currency-aware amount with icon
export function CurrencyAmount({ 
  amount, 
  currency, 
  showPlus = false,
  className = "" 
}: { 
  amount: number; 
  currency: "usd" | "stars"; 
  showPlus?: boolean;
  className?: string;
}) {
  const isStars = currency === "stars";
  const prefix = showPlus && amount > 0 ? "+" : "";
  const formattedAmount = isStars ? Math.floor(amount) : amount.toFixed(2);
  
  return (
    <span className={`inline-flex items-center gap-0.5 ${className}`}>
      {!isStars && <span>{prefix}$</span>}
      {isStars && <span>{prefix}</span>}
      <span>{formattedAmount}</span>
      {isStars && (
        <svg className="w-3 h-3 text-yellow-400 fill-yellow-400" viewBox="0 0 24 24">
          <polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26" />
        </svg>
      )}
    </span>
  );
}
