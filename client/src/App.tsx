import { useState, useEffect } from "react";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { TelegramProvider, useTelegram } from "@/components/TelegramProvider";
import { AudioProvider } from "@/components/AudioProvider";
import { LanguageProvider } from "@/components/LanguageProvider";
import { CurrencyProvider, useCurrency } from "@/components/CurrencyProvider";
import { TonConnectUIProvider } from "@tonconnect/ui-react";
import { LoadingScreen } from "@/components/LoadingScreen";
import { WelcomePopup } from "@/components/WelcomePopup";
import { AuthRequired } from "@/components/AuthRequired";
import { GameLobby } from "@/pages/GameLobby";
import { CrashGame } from "@/pages/CrashGame";
import { AviaMastersGame } from "@/pages/AviaMastersGame";
import { MinesGame } from "@/pages/MinesGame";
import { DiceGame } from "@/pages/DiceGame";
import { ScissorsGame } from "@/pages/ScissorsGame";
import { TurtleRaceGame } from "@/pages/TurtleRaceGame";
import { BlackjackGame } from "@/pages/BlackjackGame";
import { PokerLobby } from "@/pages/PokerLobby";
import { PokerTable } from "@/pages/PokerTable";
import { TheLuxeGame } from "@/pages/TheLuxeGame";
import { EgyptTreasuresGame } from "@/pages/EgyptTreasuresGame";
import { MinedropGame } from "@/pages/MinedropGame";
import { ProfilePage } from "@/pages/ProfilePage";
import { WalletPage } from "@/pages/WalletPage";
import AdminPanel from "@/pages/AdminPanel";
import { type GameType, type PokerTable as PokerTableType, gamesConfig } from "@shared/schema";

type Screen = GameType | "profile" | "wallet" | "admin" | "poker_table" | null;

interface SelectedPokerTable {
  id: string;
  name: string;
  smallBlind: number;
  bigBlind: number;
  minBuyIn: number;
  maxBuyIn: number;
  maxSeats: number;
}

interface ActiveTableSession {
  tableId: string;
  tableName: string;
  smallBlind: number;
  bigBlind: number;
  minBuyIn: number;
  maxBuyIn: number;
  maxSeats: number;
}

function GameApp() {
  const { isReady, isLoading, user, refetchUser, telegramUser, isTelegram } = useTelegram();
  const { currency, currentBalance } = useCurrency();
  const [currentScreen, setCurrentScreen] = useState<Screen>(null);
  const [selectedPokerTable, setSelectedPokerTable] = useState<SelectedPokerTable | null>(null);
  const [activeTables, setActiveTables] = useState<ActiveTableSession[]>([]);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [showLoading, setShowLoading] = useState(true);
  const [showWelcomePopup, setShowWelcomePopup] = useState(false);

  useEffect(() => {
    if (user && !showLoading) {
      setShowWelcomePopup(true);
    }
  }, [user, showLoading]);

  const handleCloseWelcome = () => {
    setShowWelcomePopup(false);
  };

  useEffect(() => {
    if (!isReady || isLoading) {
      const interval = setInterval(() => {
        setLoadingProgress((prev) => {
          if (prev >= 90) return prev;
          return prev + Math.random() * 15;
        });
      }, 200);
      return () => clearInterval(interval);
    } else {
      setLoadingProgress(100);
      const timeout = setTimeout(() => {
        setShowLoading(false);
      }, 500);
      return () => clearTimeout(timeout);
    }
  }, [isReady, isLoading]);

  const handleBalanceChange = (newBalance: number) => {
    // Backend already updates the correct balance (USD or Stars based on currency)
    // Just refetch user data to sync the display
    refetchUser();
  };

  const handleBack = () => {
    setCurrentScreen(null);
    refetchUser();
  };

  if (showLoading) {
    return <LoadingScreen progress={Math.min(loadingProgress, 100)} />;
  }

  // Require Telegram authentication - no guest access allowed
  // In production (isTelegram), require valid telegramUser
  // In development, allow dev accounts for testing
  if (isTelegram && !telegramUser) {
    return <AuthRequired />;
  }

  const balance = user?.balance ?? 1;
  const starsBalance = user?.starsBalance ?? 0;
  // Use currency-aware balance for games
  const gameBalance = currentBalance ?? (currency === "usd" ? balance : starsBalance);

  if (currentScreen === "admin") {
    return <AdminPanel onBack={handleBack} />;
  }

  if (currentScreen === "wallet") {
    return (
      <WalletPage
        balance={balance}
        onBack={handleBack}
        onBalanceChange={handleBalanceChange}
      />
    );
  }

  if (currentScreen === "profile") {
    return (
      <ProfilePage
        balance={balance}
        onBack={handleBack}
        onOpenAdmin={() => setCurrentScreen("admin")}
        onOpenWallet={() => setCurrentScreen("wallet")}
      />
    );
  }

  if (currentScreen === "crash") {
    return (
      <CrashGame
        balance={gameBalance}
        onBalanceChange={handleBalanceChange}
        onBack={handleBack}
      />
    );
  }

  if (currentScreen === "aviamasters") {
    return (
      <AviaMastersGame
        balance={gameBalance}
        onBalanceChange={handleBalanceChange}
        onBack={handleBack}
      />
    );
  }

  if (currentScreen === "mines") {
    return (
      <MinesGame
        balance={gameBalance}
        onBalanceChange={handleBalanceChange}
        onBack={handleBack}
      />
    );
  }

  if (currentScreen === "dice") {
    return (
      <DiceGame
        balance={gameBalance}
        onBalanceChange={handleBalanceChange}
        onBack={handleBack}
      />
    );
  }

  if (currentScreen === "luxe") {
    return (
      <TheLuxeGame
        balance={gameBalance}
        onBalanceChange={handleBalanceChange}
        onBack={handleBack}
      />
    );
  }

  if (currentScreen === "scissors") {
    return (
      <ScissorsGame
        balance={gameBalance}
        onBalanceChange={handleBalanceChange}
        onBack={handleBack}
      />
    );
  }

  if (currentScreen === "turtle") {
    return (
      <TurtleRaceGame
        balance={gameBalance}
        onBalanceChange={handleBalanceChange}
        onBack={handleBack}
      />
    );
  }

  if (currentScreen === "blackjack") {
    return (
      <BlackjackGame
        balance={gameBalance}
        onBalanceChange={handleBalanceChange}
        onBack={handleBack}
      />
    );
  }

  if (currentScreen === "egypt") {
    return (
      <EgyptTreasuresGame
        balance={gameBalance}
        onBalanceChange={handleBalanceChange}
        onBack={handleBack}
      />
    );
  }

  if (currentScreen === "minedrop") {
    return (
      <MinedropGame
        balance={gameBalance}
        onBalanceChange={handleBalanceChange}
        onBack={handleBack}
      />
    );
  }

  if (currentScreen === "poker") {
    return (
      <PokerLobby
        balance={balance}
        onBack={handleBack}
        onJoinTable={async (tableId) => {
          try {
            const res = await fetch(`/api/poker/tables/${tableId}`);
            if (res.ok) {
              const table = await res.json();
              const newSession: ActiveTableSession = {
                tableId: table.id,
                tableName: table.name,
                smallBlind: table.smallBlind,
                bigBlind: table.bigBlind,
                minBuyIn: table.minBuyIn,
                maxBuyIn: table.maxBuyIn,
                maxSeats: table.maxSeats,
              };
              
              // Add to active tables if not already there
              setActiveTables(prev => {
                if (prev.some(t => t.tableId === table.id)) {
                  return prev;
                }
                return [...prev, newSession];
              });
              
              setSelectedPokerTable({
                id: table.id,
                name: table.name,
                smallBlind: table.smallBlind,
                bigBlind: table.bigBlind,
                minBuyIn: table.minBuyIn,
                maxBuyIn: table.maxBuyIn,
                maxSeats: table.maxSeats,
              });
              setCurrentScreen("poker_table");
            }
          } catch (error) {
            console.error("Failed to get table:", error);
          }
        }}
        onOpenWallet={() => setCurrentScreen("wallet")}
      />
    );
  }

  if (currentScreen === "poker_table" && selectedPokerTable) {
    const handleSwitchTable = (tableId: string) => {
      const table = activeTables.find(t => t.tableId === tableId);
      if (table) {
        setSelectedPokerTable({
          id: table.tableId,
          name: table.tableName,
          smallBlind: table.smallBlind,
          bigBlind: table.bigBlind,
          minBuyIn: table.minBuyIn,
          maxBuyIn: table.maxBuyIn,
          maxSeats: table.maxSeats,
        });
      }
    };
    
    const handleLeaveTable = () => {
      // Remove current table from active tables using functional update
      setActiveTables(prev => {
        const remainingTables = prev.filter(t => t.tableId !== selectedPokerTable.id);
        
        // If there are other active tables, switch to one of them
        if (remainingTables.length > 0) {
          const nextTable = remainingTables[0];
          setSelectedPokerTable({
            id: nextTable.tableId,
            name: nextTable.tableName,
            smallBlind: nextTable.smallBlind,
            bigBlind: nextTable.bigBlind,
            minBuyIn: nextTable.minBuyIn,
            maxBuyIn: nextTable.maxBuyIn,
            maxSeats: nextTable.maxSeats,
          });
        } else {
          setSelectedPokerTable(null);
          setCurrentScreen("poker");
          refetchUser();
        }
        
        return remainingTables;
      });
    };
    
    return (
      <PokerTable
        tableId={selectedPokerTable.id}
        tableName={selectedPokerTable.name}
        balance={balance}
        smallBlind={selectedPokerTable.smallBlind}
        bigBlind={selectedPokerTable.bigBlind}
        minBuyIn={selectedPokerTable.minBuyIn}
        maxBuyIn={selectedPokerTable.maxBuyIn}
        maxSeats={selectedPokerTable.maxSeats}
        onBack={handleLeaveTable}
        onBalanceChange={handleBalanceChange}
        onSwitchTable={handleSwitchTable}
        activeTables={activeTables.map(t => ({
          tableId: t.tableId,
          tableName: t.tableName,
          smallBlind: t.smallBlind,
          bigBlind: t.bigBlind,
        }))}
      />
    );
  }

  return (
    <>
      <GameLobby
        balance={balance}
        starsBalance={starsBalance}
        isVip={user?.isVip ?? false}
        vipTier={user?.vipTier ?? null}
        totalDeposited={user?.totalDeposited ?? 0}
        odejs={user?.id ?? ""}
        onSelectGame={(gameId) => setCurrentScreen(gameId)}
        onOpenProfile={() => setCurrentScreen("profile")}
        onOpenWallet={() => setCurrentScreen("wallet")}
        onOpenAdmin={() => setCurrentScreen("admin")}
        onBalanceUpdate={handleBalanceChange}
      />
      {showWelcomePopup && <WelcomePopup onClose={handleCloseWelcome} />}
    </>
  );
}

function App() {
  const manifestUrl = typeof window !== 'undefined' 
    ? `${window.location.origin}/tonconnect-manifest.json`
    : 'https://toncasino.replit.app/tonconnect-manifest.json';

  return (
    <TonConnectUIProvider 
      manifestUrl={manifestUrl}
      actionsConfiguration={{
        twaReturnUrl: 'https://t.me/TONCasinoApp'
      }}
    >
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <LanguageProvider>
            <TelegramProvider>
              <CurrencyProvider>
                <AudioProvider>
                  <GameApp />
                  <Toaster />
                </AudioProvider>
              </CurrencyProvider>
            </TelegramProvider>
          </LanguageProvider>
        </TooltipProvider>
      </QueryClientProvider>
    </TonConnectUIProvider>
  );
}

export default App;
