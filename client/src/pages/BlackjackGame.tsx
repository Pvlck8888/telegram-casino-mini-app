import { useState, useCallback, useEffect } from "react";
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
import { formatCurrencyAmount } from "@/components/CurrencyProvider";

import gameBg from "@/assets/blackjack/gamebg.png";

interface BlackjackGameProps {
  balance: number;
  onBalanceChange: (newBalance: number) => void;
  onBack: () => void;
}

type Card = {
  suit: "hearts" | "diamonds" | "clubs" | "spades";
  value: string;
  numValue: number;
};

type GameState = "betting" | "playing" | "dealer_turn" | "finished";
type GameResult = "win" | "lose" | "push" | "blackjack" | null;

const suits: Card["suit"][] = ["hearts", "diamonds", "clubs", "spades"];
const values = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];

const getSuitSymbol = (suit: Card["suit"]) => {
  switch (suit) {
    case "hearts": return "♥";
    case "diamonds": return "♦";
    case "clubs": return "♣";
    case "spades": return "♠";
  }
};

const getSuitColor = (suit: Card["suit"]) => {
  return suit === "hearts" || suit === "diamonds" ? "text-red-600" : "text-gray-800";
};

export function BlackjackGame({ balance, onBalanceChange, onBack }: BlackjackGameProps) {
  const gameConfig = gamesConfig.find((g) => g.id === "blackjack")!;
  const { hapticFeedback, user } = useTelegram();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { setCurrentGame, playSound } = useAudio();
  const { t } = useLanguage();
  // Games always use USD - Stars are only for conversion, not playing
  
  const [gameState, setGameState] = useState<GameState>("betting");
  const [playerHand, setPlayerHand] = useState<Card[]>([]);
  const [dealerHand, setDealerHand] = useState<Card[]>([]);
  const [betAmount, setBetAmount] = useState(0);
  const [result, setResult] = useState<GameResult>(null);
  const [deck, setDeck] = useState<Card[]>([]);
  const [showDealerCard, setShowDealerCard] = useState(false);
  const [history, setHistory] = useState<{ result: GameResult; payout: number }[]>([]);

  useEffect(() => {
    setCurrentGame("blackjack");
  }, [setCurrentGame]);

  const createDeck = useCallback((): Card[] => {
    const newDeck: Card[] = [];
    for (const suit of suits) {
      for (let i = 0; i < values.length; i++) {
        const value = values[i];
        let numValue = i + 1;
        if (value === "A") numValue = 11;
        else if (["J", "Q", "K"].includes(value)) numValue = 10;
        
        newDeck.push({ suit, value, numValue });
      }
    }
    for (let i = newDeck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [newDeck[i], newDeck[j]] = [newDeck[j], newDeck[i]];
    }
    return newDeck;
  }, []);

  const calculateHand = useCallback((hand: Card[]): number => {
    let total = 0;
    let aces = 0;
    
    for (const card of hand) {
      total += card.numValue;
      if (card.value === "A") aces++;
    }
    
    while (total > 21 && aces > 0) {
      total -= 10;
      aces--;
    }
    
    return total;
  }, []);

  const drawCard = useCallback((currentDeck: Card[]): [Card, Card[]] => {
    const card = currentDeck[0];
    const remainingDeck = currentDeck.slice(1);
    return [card, remainingDeck];
  }, []);

  const startMutation = useMutation({
    mutationFn: async (amount: number) => {
      const response = await apiRequest("POST", "/api/games/blackjack/start", {
        odejs: user?.id || "demo",
        amount,
        currency: "usd",
      });
      return response.json();
    },
    onSuccess: async (data, amount) => {
      setBetAmount(amount);
      if (data.newBalance !== undefined) {
        onBalanceChange(data.newBalance);
      }

      const newDeck = createDeck();
      let currentDeck = newDeck;
      
      const [pCard1, deck1] = drawCard(currentDeck);
      currentDeck = deck1;
      playSound("cardDeal");
      
      const [dCard1, deck2] = drawCard(currentDeck);
      currentDeck = deck2;
      
      const [pCard2, deck3] = drawCard(currentDeck);
      currentDeck = deck3;
      
      const [dCard2, deck4] = drawCard(currentDeck);
      currentDeck = deck4;

      setPlayerHand([pCard1, pCard2]);
      setDealerHand([dCard1, dCard2]);
      setDeck(currentDeck);
      setShowDealerCard(false);
      setResult(null);
      
      hapticFeedback("medium");

      const playerTotal = calculateHand([pCard1, pCard2]);
      const dealerTotal = calculateHand([dCard1, dCard2]);
      
      if (playerTotal === 21) {
        setShowDealerCard(true);
        if (dealerTotal === 21) {
          setResult("push");
          setGameState("finished");
          finishMutation.mutate({ bet: amount, result: "push", multiplier: 1 });
        } else {
          setResult("blackjack");
          setGameState("finished");
          playSound("win");
          finishMutation.mutate({ bet: amount, result: "blackjack", multiplier: 2.5 });
        }
      } else {
        setGameState("playing");
      }
    },
    onError: () => {
      toast({
        title: t("error"),
        description: `${t("failedToStart")}. ${t("tryAgain")}`,
        variant: "destructive",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/users/telegram"] });
    },
  });

  const finishMutation = useMutation({
    mutationFn: async ({ bet, result, multiplier }: { bet: number; result: string; multiplier: number }) => {
      const response = await apiRequest("POST", "/api/games/blackjack/finish", {
        odejs: user?.id || "demo",
        betAmount: bet,
        result,
        multiplier,
        currency: "usd",
      });
      return response.json();
    },
    onSuccess: (data) => {
      if (data.newBalance !== undefined) {
        onBalanceChange(data.newBalance);
      }
      
      const gameResult = data.isWin ? (data.payout > betAmount * 2 ? "blackjack" : "win") : data.isPush ? "push" : "lose";
      setHistory(prev => [{ result: gameResult as GameResult, payout: data.payout }, ...prev.slice(0, 9)]);
      
      if (data.isWin) {
        hapticFeedback("heavy");
        toast({
          title: t("youWon"),
          description: formatCurrencyAmount(data.payout, "usd", true),
        });
      } else if (data.isPush) {
        toast({
          title: t("tie"),
          description: t("betReturned"),
        });
      }
      
      queryClient.invalidateQueries({ queryKey: ["/api/users/telegram"] });
    },
    onError: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users/telegram"] });
    },
  });

  const hit = () => {
    if (gameState !== "playing") return;
    
    hapticFeedback("light");
    playSound("cardDeal");
    const [card, newDeck] = drawCard(deck);
    const newHand = [...playerHand, card];
    setPlayerHand(newHand);
    setDeck(newDeck);
    
    const total = calculateHand(newHand);
    if (total > 21) {
      setShowDealerCard(true);
      setResult("lose");
      setGameState("finished");
      hapticFeedback("heavy");
      playSound("lose");
      finishMutation.mutate({ bet: betAmount, result: "lose", multiplier: 0 });
    }
  };

  const stand = async () => {
    if (gameState !== "playing") return;
    
    hapticFeedback("medium");
    playSound("cardFlip");
    setShowDealerCard(true);
    setGameState("dealer_turn");
    
    let currentDealerHand = [...dealerHand];
    let currentDeck = deck;
    
    while (calculateHand(currentDealerHand) < 17) {
      await new Promise(r => setTimeout(r, 600));
      const [card, newDeck] = drawCard(currentDeck);
      currentDealerHand = [...currentDealerHand, card];
      currentDeck = newDeck;
      setDealerHand(currentDealerHand);
      setDeck(currentDeck);
      hapticFeedback("light");
      playSound("cardDeal");
    }
    
    const playerTotal = calculateHand(playerHand);
    const dealerTotal = calculateHand(currentDealerHand);
    
    let gameResult: GameResult;
    let multiplier: number;
    
    if (dealerTotal > 21) {
      gameResult = "win";
      multiplier = 2;
      playSound("win");
    } else if (playerTotal > dealerTotal) {
      gameResult = "win";
      multiplier = 2;
      playSound("win");
    } else if (playerTotal < dealerTotal) {
      gameResult = "lose";
      multiplier = 0;
      playSound("lose");
    } else {
      gameResult = "push";
      multiplier = 1;
    }
    
    setResult(gameResult);
    setGameState("finished");
    
    finishMutation.mutate({ bet: betAmount, result: gameResult!, multiplier });
  };

  const doubleDown = async () => {
    if (gameState !== "playing" || playerHand.length !== 2) return;
    if (balance < betAmount) {
      toast({
        title: t("insufficientFunds"),
        description: t("cannotDouble"),
        variant: "destructive",
      });
      return;
    }
    
    hapticFeedback("medium");
    playSound("chips");
    
    try {
      const response = await apiRequest("POST", "/api/games/blackjack/start", {
        odejs: user?.id || "demo",
        amount: betAmount,
        currency: "usd",
      });
      const data = await response.json();
      
      if (data.newBalance !== undefined) {
        onBalanceChange(data.newBalance);
      }
      
      const newBet = betAmount * 2;
      setBetAmount(newBet);
      
      playSound("cardDeal");
      const [card, newDeck] = drawCard(deck);
      const newHand = [...playerHand, card];
      setPlayerHand(newHand);
      setDeck(newDeck);
      
      const total = calculateHand(newHand);
      if (total > 21) {
        setShowDealerCard(true);
        setResult("lose");
        setGameState("finished");
        hapticFeedback("heavy");
        playSound("lose");
        finishMutation.mutate({ bet: newBet, result: "lose", multiplier: 0 });
      } else {
        setShowDealerCard(true);
        setGameState("dealer_turn");
        
        let currentDealerHand = [...dealerHand];
        let currentDeck = newDeck;
        
        while (calculateHand(currentDealerHand) < 17) {
          await new Promise(r => setTimeout(r, 600));
          playSound("cardDeal");
          const [dCard, dDeck] = drawCard(currentDeck);
          currentDealerHand = [...currentDealerHand, dCard];
          currentDeck = dDeck;
          setDealerHand(currentDealerHand);
          setDeck(currentDeck);
          hapticFeedback("light");
        }
        
        const playerTotal = calculateHand(newHand);
        const dealerTotal = calculateHand(currentDealerHand);
        
        let gameResult: GameResult;
        let multiplier: number;
        
        if (dealerTotal > 21) {
          gameResult = "win";
          multiplier = 2;
          playSound("win");
        } else if (playerTotal > dealerTotal) {
          gameResult = "win";
          multiplier = 2;
          playSound("win");
        } else if (playerTotal < dealerTotal) {
          gameResult = "lose";
          multiplier = 0;
          playSound("lose");
        } else {
          gameResult = "push";
          multiplier = 1;
        }
        
        setResult(gameResult);
        setGameState("finished");
        
        finishMutation.mutate({ bet: newBet, result: gameResult!, multiplier });
      }
    } catch {
      toast({
        title: t("error"),
        description: t("failedToDouble"),
        variant: "destructive",
      });
    }
  };

  const resetGame = () => {
    setGameState("betting");
    setPlayerHand([]);
    setDealerHand([]);
    setBetAmount(0);
    setResult(null);
    setShowDealerCard(false);
    setDeck([]);
  };

  const startGame = (amount: number) => {
    playSound("bet");
    startMutation.mutate(amount);
  };

  const renderCard = (card: Card, hidden = false, index = 0) => {
    if (hidden) {
      return (
        <div
          key={`hidden-${index}`}
          className="w-16 h-24 sm:w-20 sm:h-28 bg-gradient-to-br from-indigo-600 via-purple-600 to-indigo-800 rounded-xl border-2 border-indigo-400/50 flex items-center justify-center shadow-xl flex-shrink-0 transform transition-all duration-300"
          style={{ marginLeft: index > 0 ? '-2rem' : 0 }}
        >
          <div className="w-10 h-14 sm:w-12 sm:h-16 rounded-lg border-2 border-indigo-300/30 bg-gradient-to-br from-indigo-500/50 to-purple-500/50 flex items-center justify-center">
            <span className="text-2xl font-bold text-indigo-200">?</span>
          </div>
        </div>
      );
    }
    
    return (
      <div
        key={`${card.suit}-${card.value}-${index}`}
        className={`w-16 h-24 sm:w-20 sm:h-28 bg-gradient-to-br from-white to-gray-100 rounded-xl border-2 border-gray-200 shadow-xl flex flex-col items-center justify-between p-2 flex-shrink-0 transform transition-all duration-300 hover:scale-105 ${getSuitColor(card.suit)}`}
        style={{ 
          marginLeft: index > 0 ? '-2rem' : 0,
          animationDelay: `${index * 100}ms` 
        }}
      >
        <div className="text-left w-full">
          <div className="text-sm sm:text-lg font-black leading-none">{card.value}</div>
          <div className="text-lg sm:text-xl leading-none">{getSuitSymbol(card.suit)}</div>
        </div>
        <div className="text-3xl sm:text-4xl font-bold">{getSuitSymbol(card.suit)}</div>
        <div className="text-right w-full rotate-180">
          <div className="text-sm sm:text-lg font-black leading-none">{card.value}</div>
          <div className="text-lg sm:text-xl leading-none">{getSuitSymbol(card.suit)}</div>
        </div>
      </div>
    );
  };

  const playerTotal = playerHand.length > 0 ? calculateHand(playerHand) : 0;
  const dealerTotal = dealerHand.length > 0 
    ? (showDealerCard ? calculateHand(dealerHand) : calculateHand([dealerHand[0]]))
    : 0;

  return (
    <div 
      className="h-screen flex flex-col overflow-hidden"
      style={{
        backgroundImage: `url(${gameBg})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center'
      }}
      data-testid="page-blackjack-game"
    >
      <GameHeader title={t("blackjackTitle")} balance={balance} onBack={onBack} gameType="blackjack" schemaGameType="blackjack" />

      <main className="flex-1 flex flex-col p-2 gap-2 overflow-hidden">
        <div className="flex gap-1.5 overflow-x-auto hide-scrollbar py-1 flex-shrink-0">
          {history.map((h, i) => (
            <span
              key={i}
              className={`px-2 py-1 rounded-lg text-xs font-bold whitespace-nowrap ${
                h.result === "win" || h.result === "blackjack"
                  ? "bg-emerald-500/30 text-emerald-300 border border-emerald-500/50"
                  : h.result === "push"
                  ? "bg-yellow-500/30 text-yellow-300 border border-yellow-500/50"
                  : "bg-red-500/30 text-red-300 border border-red-500/50"
              }`}
              data-testid={`history-item-${i}`}
            >
              {h.result?.toUpperCase()}
            </span>
          ))}
          {history.length === 0 && (
            <span className="text-sm text-white/60">{t("noHistory")}</span>
          )}
        </div>

        <div className="flex-1 relative rounded-2xl overflow-hidden min-h-0 bg-gradient-to-b from-green-900/80 to-green-950/90 border border-green-600/30">
          <div className="absolute inset-0 opacity-10" style={{
            backgroundImage: `radial-gradient(circle at 2px 2px, white 1px, transparent 0)`,
            backgroundSize: "24px 24px"
          }} />

          <div className="relative h-full flex flex-col justify-between p-4">
            <div className="text-center pt-2">
              <div className="inline-flex items-center gap-2 bg-black/40 backdrop-blur-sm rounded-full px-4 py-2 mb-4">
                <span className="text-green-200 text-sm font-medium">{t("dealer")}</span>
                {dealerHand.length > 0 && (
                  <span className="bg-green-600/50 text-white text-sm font-bold px-2 py-0.5 rounded-full">
                    {showDealerCard ? dealerTotal : "?"}
                  </span>
                )}
              </div>
              <div className="flex justify-center items-center min-h-[120px]">
                {dealerHand.map((card, i) => renderCard(card, i === 1 && !showDealerCard, i))}
              </div>
            </div>

            {result && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
                <div className={`
                  px-8 py-4 rounded-2xl text-2xl sm:text-3xl font-black animate-in zoom-in duration-300 shadow-2xl
                  ${result === "win" || result === "blackjack" 
                    ? "bg-gradient-to-r from-emerald-500 to-green-500 text-white border-2 border-emerald-300" 
                    : result === "push" 
                    ? "bg-gradient-to-r from-yellow-500 to-amber-500 text-white border-2 border-yellow-300"
                    : "bg-gradient-to-r from-red-500 to-rose-500 text-white border-2 border-red-300"}
                `}>
                  {result === "blackjack" ? "BLACKJACK!" :
                   result === "win" ? t("youWon") :
                   result === "push" ? t("tie") :
                   t("youLost")}
                </div>
              </div>
            )}

            <div className="text-center pb-4 mt-auto">
              <div className="flex justify-center items-center min-h-[120px] mb-4">
                {playerHand.map((card, i) => renderCard(card, false, i))}
              </div>
              <div className="inline-flex items-center gap-2 bg-black/40 backdrop-blur-sm rounded-full px-4 py-2">
                <span className="text-green-200 text-sm font-medium">Вы</span>
                {playerHand.length > 0 && (
                  <span className={`text-sm font-bold px-2 py-0.5 rounded-full ${
                    playerTotal > 21 
                      ? "bg-red-500 text-white" 
                      : playerTotal === 21 
                      ? "bg-yellow-500 text-black" 
                      : "bg-green-600/50 text-white"
                  }`}>
                    {playerTotal}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {gameState === "playing" && (
          <div className="grid grid-cols-3 gap-3">
            <Button
              variant="secondary"
              className="h-14 text-lg font-bold bg-gradient-to-b from-blue-500 to-blue-600 hover:from-blue-400 hover:to-blue-500 text-white border-none"
              onClick={hit}
              disabled={finishMutation.isPending}
              data-testid="button-hit"
            >
              {t("hit")}
            </Button>
            <Button
              className="h-14 text-lg font-bold bg-gradient-to-b from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-white border-none"
              onClick={stand}
              disabled={finishMutation.isPending}
              data-testid="button-stand"
            >
              {t("stand")}
            </Button>
            <Button
              variant="outline"
              className="h-14 text-lg font-bold bg-gradient-to-b from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-white border-none"
              onClick={doubleDown}
              disabled={finishMutation.isPending || balance < betAmount}
              data-testid="button-double"
            >
              x2
            </Button>
          </div>
        )}

        {gameState === "dealer_turn" && (
          <div className="text-center py-4 bg-black/30 backdrop-blur-sm rounded-xl">
            <div className="flex items-center justify-center gap-2">
              <div className="w-3 h-3 bg-green-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
              <div className="w-3 h-3 bg-green-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
              <div className="w-3 h-3 bg-green-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
            </div>
            <p className="text-white/80 mt-2 font-medium">{t("dealerTurn")}</p>
          </div>
        )}

        {gameState === "finished" && (
          <Button
            className="h-14 text-lg font-bold bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70"
            onClick={resetGame}
            data-testid="button-play-again"
          >
            {t("playAgain")}
          </Button>
        )}

        {gameState === "betting" && (
          <BettingPanel
            balance={balance}
            minBet={gameConfig.minBet}
            maxBet={gameConfig.maxBet}
            onBet={startGame}
            isPlaying={startMutation.isPending}
            buttonText={startMutation.isPending ? t("dealing") : t("deal")}
          />
        )}
      </main>
    </div>
  );
}
