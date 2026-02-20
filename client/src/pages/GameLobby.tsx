import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { gamesConfig, type GameType } from "@shared/schema";
import { GameCard } from "@/components/GameCard";
import { BalanceDisplay } from "@/components/BalanceDisplay";
import { OnlineCounter } from "@/components/LiveFeed";
import { LiveWinTicker } from "@/components/LiveWinTicker";
import { PromoSlideshow } from "@/components/PromoSlideshow";
import { AudioControls } from "@/components/AudioControls";
import { VipChat } from "@/components/VipChat";
import RafflePanel from "@/components/RafflePanel";
import { DailyWheel } from "@/components/DailyWheel";
import { useLanguage } from "@/components/LanguageProvider";
import { useTelegram } from "@/components/TelegramProvider";
import { useAudio } from "@/components/AudioProvider";
import { useToast } from "@/hooks/use-toast";
import { Trophy, User, Gift, Settings, Shield, MessageCircle, AlertTriangle, Home, Gamepad2, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";

interface GameLobbyProps {
  balance: number;
  starsBalance?: number;
  isVip: boolean;
  vipTier?: string | null;
  totalDeposited?: number;
  odejs: string;
  onSelectGame: (gameId: GameType) => void;
  onOpenProfile: () => void;
  onOpenWallet: () => void;
  onOpenAdmin: () => void;
  onBalanceUpdate: (newBalance: number) => void;
}

interface GamesStatus {
  disabled: boolean;
  message: string | null;
}

export function GameLobby({ balance, starsBalance = 0, isVip, vipTier, totalDeposited, odejs, onSelectGame, onOpenProfile, onOpenWallet, onOpenAdmin, onBalanceUpdate }: GameLobbyProps) {
  const { user, hapticFeedback } = useTelegram();
  const { setCurrentGame } = useAudio();
  const { t } = useLanguage();
  const { toast } = useToast();
  const [showWheel, setShowWheel] = useState(false);
  const [activeTab, setActiveTab] = useState<"home" | "games" | "wheel" | "wallet" | "profile">("home");
  const isAdmin = user?.username === "Nahalist" || user?.isAdmin === true;

  const { data: gamesStatus } = useQuery<GamesStatus>({
    queryKey: ["/api/games-status"],
    refetchInterval: 30000,
  });

  const handleSelectGame = (gameId: GameType) => {
    if (gamesStatus?.disabled && !isAdmin) {
      hapticFeedback("heavy");
      toast({
        title: t("gamesTemporarilyUnavailable"),
        description: gamesStatus.message || t("tryLater"),
        variant: "destructive",
      });
      return;
    }
    hapticFeedback("light");
    onSelectGame(gameId);
  };

  useEffect(() => {
    setCurrentGame("lobby");
  }, [setCurrentGame]);

  return (
    <div className="min-h-screen bg-background" data-testid="page-game-lobby">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-lg border-b border-border">
        <div className="px-3 py-2 flex items-center gap-2">
          {/* User Avatar - clickable for profile */}
          <Button 
            variant="ghost" 
            size="icon"
            className="w-9 h-9 p-0 rounded-full overflow-hidden flex-shrink-0"
            onClick={() => {
              hapticFeedback("light");
              onOpenProfile();
            }}
            data-testid="button-profile"
          >
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary to-emerald-600 flex items-center justify-center">
              {user?.photoUrl ? (
                <img 
                  src={user.photoUrl} 
                  alt={user.firstName || "User"} 
                  className="w-full h-full rounded-full object-cover"
                />
              ) : (
                <User className="w-4 h-4 text-primary-foreground" />
              )}
            </div>
          </Button>

          {/* Online Counter */}
          <OnlineCounter />

          {/* Spacer to push controls right */}
          <div className="flex-1" />

          {/* Controls group - Audio, Admin, Balance */}
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <AudioControls gameType="lobby" />
            {isAdmin && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  hapticFeedback("light");
                  onOpenAdmin();
                }}
                className="w-8 h-8"
                data-testid="button-admin"
              >
                <Settings className="w-4 h-4" />
              </Button>
            )}
            <BalanceDisplay 
              balance={balance}
              starsBalance={0}
              onClick={() => {
                hapticFeedback("light");
                onOpenWallet();
              }}
              showToggle={false}
              compact={true}
            />
          </div>
        </div>
      </header>

      {/* Live Win Ticker - Scrolling wins marquee */}
      <div className="px-3 py-2">
        <LiveWinTicker />
      </div>

      {/* Main Content */}
      <main className="px-4 py-4 space-y-4">
        {/* Promo Slideshow */}
        <PromoSlideshow onSelectGame={handleSelectGame} />

        {/* Referral Banner */}
        <motion.div 
          className="relative bg-gradient-to-br from-purple-600/40 via-pink-500/20 to-transparent border border-purple-500/30 rounded-xl p-4 overflow-hidden cursor-pointer"
          onClick={() => {
            hapticFeedback("light");
            onOpenProfile();
          }}
          whileTap={{ scale: 0.98 }}
          data-testid="banner-referral"
        >
          <div className="absolute top-0 right-0 w-24 h-24 bg-purple-500/30 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2" />
          <div className="relative z-10 flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center flex-shrink-0">
              <Gift className="w-6 h-6 text-white" />
            </div>
            <div className="flex-1">
              <h3 className="font-bold text-foreground">{t("referralBonus")}</h3>
              <p className="text-xs text-muted-foreground">{t("inviteFriendsEarn")}</p>
            </div>
            <div className="text-primary font-bold text-lg">+10%</div>
          </div>
        </motion.div>

        {/* Quick Stats */}
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-gradient-to-br from-emerald-500/20 to-green-600/10 border border-emerald-500/30 rounded-xl p-3 text-center">
            <span className="text-xl font-black text-emerald-400">8+</span>
            <p className="text-[10px] text-emerald-300/80 mt-0.5 uppercase font-medium">
              {t("games")}
            </p>
          </div>
          <div className="bg-gradient-to-br from-amber-500/20 to-orange-600/10 border border-amber-500/30 rounded-xl p-3 text-center">
            <span className="text-xl font-black text-amber-400">94%</span>
            <p className="text-[10px] text-amber-300/80 mt-0.5 uppercase font-medium">
              {t("rtp")}
            </p>
          </div>
          <div className="bg-gradient-to-br from-blue-500/20 to-indigo-600/10 border border-blue-500/30 rounded-xl p-3 text-center">
            <span className="text-xl font-black text-blue-400">24/7</span>
            <p className="text-[10px] text-blue-300/80 mt-0.5 uppercase font-medium">
              {t("online")}
            </p>
          </div>
        </div>

        {/* VIP Chat */}
        <section>
          <VipChat isVip={isVip} vipTier={vipTier} odejs={odejs} isAdmin={isAdmin} />
        </section>

        {/* Active Raffle */}
        <section>
          <RafflePanel 
            odejs={odejs}
            username={user?.username || undefined}
            firstName={user?.firstName || undefined}
            vipTier={vipTier || undefined}
            totalDeposited={totalDeposited}
          />
        </section>

        {/* Games Section */}
        <section id="games-section">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Gamepad2 className="w-5 h-5 text-primary" />
              <h2 className="text-lg font-bold text-foreground">
                {t("games")}
              </h2>
            </div>
            <motion.div 
              className="flex items-center gap-1 px-2 py-1 bg-gradient-to-r from-amber-500/20 to-orange-500/20 rounded-full border border-amber-500/30"
              animate={{ scale: [1, 1.02, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              <Trophy className="w-3.5 h-3.5 text-amber-400" />
              <span className="text-xs text-amber-300 font-bold">
                {t("playToWin")}
              </span>
            </motion.div>
          </div>

          {/* Games Disabled Banner */}
          {gamesStatus?.disabled && !isAdmin && (
            <div className="mb-4 p-4 bg-destructive/10 border border-destructive/30 rounded-lg" data-testid="banner-games-disabled">
              <div className="flex items-center gap-2 text-destructive mb-1">
                <AlertTriangle className="w-5 h-5" />
                <span className="font-semibold">
                  {t("gamesTemporarilyUnavailable")}
                </span>
              </div>
              {gamesStatus.message && (
                <p className="text-sm text-destructive/80 ml-7">{gamesStatus.message}</p>
              )}
            </div>
          )}

          {/* Games Grid */}
          <div className="grid grid-cols-1 gap-3">
            {gamesConfig
              .filter(game => game.id !== "aviamasters" && game.id !== "egypt")
              .map((game, index) => (
              <motion.div
                key={game.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
              >
                <GameCard
                  game={game}
                  globallyDisabled={gamesStatus?.disabled && !isAdmin}
                  onClick={() => {
                    if (!game.disabled) {
                      handleSelectGame(game.id);
                    }
                  }}
                />
              </motion.div>
            ))}
          </div>
        </section>

        {/* Support Footer */}
        <footer className="mt-8 py-6 border-t border-border/50">
          <div className="text-center space-y-3">
            <div className="flex items-center justify-center gap-2 text-primary">
              <Shield className="w-5 h-5" />
              <span className="font-medium">
                {t("fairPlayGuaranteed")}
              </span>
            </div>
            <p className="text-sm text-muted-foreground">
              {t("fairPlayDescription")}
            </p>
            <div className="flex items-center justify-center gap-2 text-muted-foreground">
              <MessageCircle className="w-4 h-4" />
              <span className="text-sm">
                {t("support")}: <a href="https://t.me/paniccar" className="text-primary hover:underline" target="_blank" rel="noopener noreferrer">@paniccar</a>
              </span>
            </div>
            <p className="text-xs text-muted-foreground/70">
              {t("supportDescription")}
            </p>
          </div>
        </footer>

        {/* Bottom Spacing for nav bar */}
        <div className="h-24" />
      </main>

      {/* Bottom Navigation Bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-card/95 backdrop-blur-lg border-t border-border safe-area-bottom">
        <div className="flex items-center justify-around h-16 px-2">
          {/* Home */}
          <button
            onClick={() => {
              hapticFeedback("light");
              setActiveTab("home");
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            className={`flex flex-col items-center justify-center w-14 h-14 rounded-xl transition-colors ${
              activeTab === "home" ? "text-primary" : "text-muted-foreground"
            }`}
            data-testid="nav-home"
          >
            <Home className="w-5 h-5" />
            <span className="text-[10px] mt-1">{t("home")}</span>
          </button>

          {/* Games */}
          <button
            onClick={() => {
              hapticFeedback("light");
              setActiveTab("games");
              document.getElementById("games-section")?.scrollIntoView({ behavior: 'smooth' });
            }}
            className={`flex flex-col items-center justify-center w-14 h-14 rounded-xl transition-colors ${
              activeTab === "games" ? "text-primary" : "text-muted-foreground"
            }`}
            data-testid="nav-games"
          >
            <Gamepad2 className="w-5 h-5" />
            <span className="text-[10px] mt-1">{t("games")}</span>
          </button>

          {/* Wheel (Center - Special) */}
          <button
            onClick={() => {
              hapticFeedback("medium");
              setShowWheel(true);
            }}
            className="relative flex items-center justify-center -mt-8"
            data-testid="nav-wheel"
          >
            <motion.div
              className="w-16 h-16 rounded-full bg-gradient-to-br from-primary via-primary/90 to-emerald-600 flex items-center justify-center shadow-lg shadow-primary/30"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <Gift className="w-7 h-7 text-primary-foreground" />
            </motion.div>
            <span className="absolute -bottom-4 text-[10px] text-primary font-medium">
              {t("wheel")}
            </span>
          </button>

          {/* Wallet */}
          <button
            onClick={() => {
              hapticFeedback("light");
              setActiveTab("wallet");
              onOpenWallet();
            }}
            className={`flex flex-col items-center justify-center w-14 h-14 rounded-xl transition-colors ${
              activeTab === "wallet" ? "text-primary" : "text-muted-foreground"
            }`}
            data-testid="nav-wallet"
          >
            <Wallet className="w-5 h-5" />
            <span className="text-[10px] mt-1">{t("wallet")}</span>
          </button>

          {/* Profile */}
          <button
            onClick={() => {
              hapticFeedback("light");
              setActiveTab("profile");
              onOpenProfile();
            }}
            className={`flex flex-col items-center justify-center w-14 h-14 rounded-xl transition-colors ${
              activeTab === "profile" ? "text-primary" : "text-muted-foreground"
            }`}
            data-testid="nav-profile"
          >
            <User className="w-5 h-5" />
            <span className="text-[10px] mt-1">{t("profile")}</span>
          </button>
        </div>
      </nav>

      {/* Daily Wheel Modal */}
      <DailyWheel 
        odejs={odejs}
        isOpen={showWheel}
        onClose={() => {
          setShowWheel(false);
          setActiveTab("home");
        }}
        onBalanceUpdate={onBalanceUpdate}
      />
    </div>
  );
}
