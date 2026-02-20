import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Users, Coins, Star, Shield, X, RefreshCw, ChevronRight, Trophy, Zap, Sparkles, Crown, Loader2, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BalanceDisplay } from "@/components/BalanceDisplay";
import { AudioControls } from "@/components/AudioControls";
import { SpinGoWheel } from "@/components/SpinGoWheel";
import { useTelegram } from "@/components/TelegramProvider";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/components/LanguageProvider";
import { apiRequest } from "@/lib/queryClient";
import type { PokerTable, PokerSeat } from "@shared/schema";
import { sitNGoConfigs, spinGoConfigs } from "@shared/schema";

interface SpinGoMatchInfo {
  matchId: string;
  buyIn: number;
  multiplier: number;
  prizePool: number;
  players: Array<{ username: string; photoUrl?: string }>;
}

interface SpinGoLobbyProps {
  balance: number;
  userId: string;
  username: string;
  photoUrl?: string;
  hapticFeedback: (type: string) => void;
  onMatch: (match: SpinGoMatchInfo) => void;
}

function SpinGoLobby({ balance, userId, username, photoUrl, hapticFeedback, onMatch }: SpinGoLobbyProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [registeredConfigId, setRegisteredConfigId] = useState<string | null>(null);
  const [isRegistering, setIsRegistering] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);

  const { data: queues, refetch: refetchQueues } = useQuery<Array<{
    configId: string;
    buyIn: number;
    queueSize: number;
    players: Array<{ username: string; photoUrl?: string }>;
  }>>({
    queryKey: ["/api/spingo/queues"],
    refetchInterval: 3000,
  });

  const { data: playerStatus } = useQuery<{
    inQueue: boolean;
    queueConfigId?: string;
    queuePosition?: number;
    inMatch: boolean;
    match?: SpinGoMatchInfo;
  }>({
    queryKey: ["/api/spingo/status", userId],
    enabled: !!userId,
    refetchInterval: 2000,
  });

  useEffect(() => {
    if (playerStatus?.inQueue && playerStatus.queueConfigId) {
      setRegisteredConfigId(playerStatus.queueConfigId);
    } else if (!playerStatus?.inQueue) {
      setRegisteredConfigId(null);
    }
    
    if (playerStatus?.inMatch && playerStatus.match) {
      onMatch(playerStatus.match);
    }
  }, [playerStatus, onMatch]);

  useEffect(() => {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const ws = new WebSocket(`${protocol}//${window.location.host}/ws`);
    wsRef.current = ws;

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === "spingo_queue_update") {
        refetchQueues();
      }
      if (data.type === "spingo_match_created") {
        const match = data.match;
        const isMyMatch = match.players.some((p: any) => p.odejs === userId);
        if (isMyMatch) {
          onMatch({
            matchId: match.matchId,
            buyIn: match.buyIn,
            multiplier: match.multiplier,
            prizePool: match.prizePool,
            players: match.players.map((p: any) => ({ 
              username: p.username, 
              photoUrl: p.photoUrl 
            }))
          });
        }
      }
    };

    return () => {
      ws.close();
    };
  }, [userId, refetchQueues, onMatch]);

  const handleRegister = async (configId: string, buyIn: number) => {
    if (balance < buyIn) {
      toast({
        title: "Insufficient balance",
        description: `Need $${buyIn} to join`,
        variant: "destructive"
      });
      return;
    }

    setIsRegistering(true);
    try {
      const res = await fetch("/api/spingo/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ configId, odejs: userId, username, photoUrl })
      });
      
      const data = await res.json();
      
      if (res.ok) {
        setRegisteredConfigId(configId);
        hapticFeedback("success");
        toast({ title: "Registered!", description: `Position: ${data.queuePosition}/3` });
        queryClient.invalidateQueries({ queryKey: ["/api/user"] });
        refetchQueues();
      } else {
        toast({ title: data.error || "Failed to register", variant: "destructive" });
      }
    } catch (error) {
      toast({ title: "Connection error", variant: "destructive" });
    } finally {
      setIsRegistering(false);
    }
  };

  const handleUnregister = async (configId: string) => {
    try {
      const res = await fetch("/api/spingo/unregister", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ configId, odejs: userId })
      });
      
      if (res.ok) {
        setRegisteredConfigId(null);
        hapticFeedback("light");
        toast({ title: "Unregistered" });
        queryClient.invalidateQueries({ queryKey: ["/api/user"] });
        refetchQueues();
      }
    } catch (error) {
      toast({ title: "Connection error", variant: "destructive" });
    }
  };

  return (
    <div className="mt-6 px-4">
      <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
        <Zap className="w-5 h-5 text-amber-500" />
        Spin & Go
      </h2>
      
      <div className="space-y-3">
        {spinGoConfigs.map(config => {
          const queueInfo = queues?.find(q => q.configId === config.id);
          const queueSize = queueInfo?.queueSize || 0;
          const isRegistered = registeredConfigId === config.id;
          const canAfford = balance >= config.buyIn;
          
          return (
            <div
              key={config.id}
              className={`relative overflow-hidden rounded-xl p-4 transition-all border ${
                isRegistered 
                  ? "bg-gradient-to-r from-amber-900/40 to-yellow-900/30 border-amber-500/50" 
                  : "bg-gradient-to-r from-[#1a1a2e] to-[#12122a] border-amber-700/20"
              }`}
              data-testid={`spin-${config.id}`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className={`w-14 h-14 rounded-xl flex items-center justify-center ${
                    isRegistered 
                      ? "bg-gradient-to-br from-amber-400 to-orange-500 animate-pulse" 
                      : "bg-gradient-to-br from-amber-600 to-orange-700"
                  }`}>
                    <span className="text-xl font-black text-white">${config.buyIn}</span>
                  </div>
                  <div>
                    <div className="font-bold text-white flex items-center gap-2">
                      Spin & Go ${config.buyIn}
                      {isRegistered && (
                        <span className="text-xs bg-amber-500 text-black px-2 py-0.5 rounded-full font-bold">
                          SEARCHING
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-zinc-400 mt-0.5">
                      Prize up to x{Math.max(...config.multiplierOptions.map(o => o.multiplier))}
                    </div>
                    <div className="flex items-center gap-3 mt-1">
                      <div className="flex items-center gap-1 text-xs text-zinc-500">
                        <Users className="w-3 h-3" />
                        <span>{queueSize}/3 in queue</span>
                      </div>
                      {queueSize > 0 && queueInfo?.players && (
                        <div className="flex -space-x-2">
                          {queueInfo.players.slice(0, 3).map((p, i) => (
                            p.photoUrl ? (
                              <img 
                                key={i}
                                src={p.photoUrl} 
                                className="w-5 h-5 rounded-full border border-zinc-800"
                                alt=""
                              />
                            ) : (
                              <div 
                                key={i}
                                className="w-5 h-5 rounded-full bg-amber-600 border border-zinc-800 flex items-center justify-center text-[8px] text-white font-bold"
                              >
                                {p.username[0]?.toUpperCase()}
                              </div>
                            )
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex flex-col items-end gap-2">
                  {isRegistered ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleUnregister(config.id)}
                      className="border-red-500/50 text-red-400 hover:bg-red-500/10"
                      data-testid={`unregister-${config.id}`}
                    >
                      <X className="w-4 h-4 mr-1" />
                      Cancel
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      onClick={() => {
                        hapticFeedback("medium");
                        handleRegister(config.id, config.buyIn);
                      }}
                      disabled={!canAfford || isRegistering || registeredConfigId !== null}
                      className="bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-black font-bold"
                      data-testid={`register-${config.id}`}
                    >
                      {isRegistering ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <>Play ${config.buyIn}</>
                      )}
                    </Button>
                  )}
                  {!canAfford && !isRegistered && (
                    <span className="text-xs text-red-400">Insufficient funds</span>
                  )}
                </div>
              </div>

              {isRegistered && (
                <div className="mt-3 pt-3 border-t border-amber-500/20">
                  <div className="flex items-center justify-center gap-2 text-amber-400">
                    <Clock className="w-4 h-4 animate-pulse" />
                    <span className="text-sm font-medium">Waiting for players... ({queueSize}/3)</span>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
      
      <div className="mt-6 bg-amber-900/20 border border-amber-700/30 rounded-xl p-4">
        <h3 className="text-sm font-bold text-amber-400 mb-2">How to Play</h3>
        <p className="text-xs text-zinc-400 mb-3">
          Spin & Go is a fast 3-max tournament with a random prize multiplier.
          Register and wait for 2 more players. When 3 players match, the wheel spins to determine the prize!
        </p>
        <div className="flex flex-wrap gap-2">
          <span className="px-2 py-1 bg-blue-800/30 text-blue-300 text-xs rounded-full">x2 (75%)</span>
          <span className="px-2 py-1 bg-green-800/30 text-green-300 text-xs rounded-full">x3 (15%)</span>
          <span className="px-2 py-1 bg-orange-800/30 text-orange-300 text-xs rounded-full">x5 (7%)</span>
          <span className="px-2 py-1 bg-purple-800/30 text-purple-300 text-xs rounded-full">x10 (2.5%)</span>
          <span className="px-2 py-1 bg-amber-800/30 text-amber-300 text-xs rounded-full">x100 (0.1%)</span>
        </div>
      </div>
    </div>
  );
}

interface PokerLobbyProps {
  balance: number;
  onBack: () => void;
  onJoinTable: (tableId: string) => void;
  onOpenWallet: () => void;
}

export function PokerLobby({ balance, onBack, onJoinTable, onOpenWallet }: PokerLobbyProps) {
  const { user, hapticFeedback } = useTelegram();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { language } = useLanguage();
  const wsRef = useRef<WebSocket | null>(null);
  const [myTableId, setMyTableId] = useState<string | null>(null);
  const [adminLoading, setAdminLoading] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>("cash");
  const [showSpinWheel, setShowSpinWheel] = useState(false);
  const [spinBuyIn, setSpinBuyIn] = useState<number>(1);
  const [spinGoMatch, setSpinGoMatch] = useState<SpinGoMatchInfo | null>(null);
  
  const isAdmin = user?.username === "Nahalist";

  const { data: rakeData } = useQuery<{ totalRake: number }>({
    queryKey: ["/api/admin/poker/rake"],
    enabled: isAdmin && !!user?.id,
    refetchInterval: 30000,
    queryFn: async () => {
      const res = await fetch("/api/admin/poker/rake", {
        headers: { "x-admin-id": String(user?.id) }
      });
      if (!res.ok) throw new Error("Failed to fetch rake");
      return res.json();
    }
  });

  const handleAdminAction = async (tableId: string, action: "kick" | "close" | "refresh", seatNumber?: number) => {
    if (!user?.id) {
      toast({ title: language === "ru" ? "Пользователь не загружен" : "User not loaded", variant: "destructive" });
      return;
    }
    
    setAdminLoading(`${action}-${tableId}`);
    try {
      const res = await fetch(`/api/admin/poker/tables/${tableId}/${action}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-id": String(user.id),
        },
        body: JSON.stringify(seatNumber !== undefined ? { seatNumber } : {})
      });
      
      const data = await res.json();
      
      if (res.ok) {
        toast({ title: language === "ru" ? `Успешно: ${action}` : `Success: ${action}` });
        queryClient.invalidateQueries({ queryKey: ["/api/poker/tables"] });
      } else {
        toast({ title: data.error || (language === "ru" ? "Ошибка" : "Error"), variant: "destructive" });
      }
    } catch (error) {
      toast({ title: language === "ru" ? "Ошибка" : "Error", variant: "destructive" });
    } finally {
      setAdminLoading(null);
    }
  };

  const { data: tables, isLoading } = useQuery<PokerTable[]>({
    queryKey: ["/api/poker/tables"],
    refetchInterval: 5000,
  });

  const { data: mySeats } = useQuery<PokerSeat[]>({
    queryKey: [`/api/poker/my-seats/${user?.id}`],
    enabled: !!user?.id,
  });

  useEffect(() => {
    if (mySeats && mySeats.length > 0) {
      setMyTableId(mySeats[0].tableId);
    } else {
      setMyTableId(null);
    }
  }, [mySeats]);

  useEffect(() => {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const ws = new WebSocket(`${protocol}//${window.location.host}/ws`);
    wsRef.current = ws;

    ws.onopen = () => {
      ws.send(JSON.stringify({ type: "subscribe_lobby" }));
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === "lobby_update" || data.type === "table_players_update") {
        queryClient.invalidateQueries({ queryKey: ["/api/poker/tables"] });
      }
    };

    return () => {
      ws.close();
    };
  }, [queryClient]);

  // Sort tables: my table first, then by player count (occupied first), then by blinds
  const sortedTables = [...(tables || [])].sort((a, b) => {
    if (a.id === myTableId) return -1;
    if (b.id === myTableId) return 1;
    // Occupied tables first
    if (a.currentPlayers > 0 && b.currentPlayers === 0) return -1;
    if (a.currentPlayers === 0 && b.currentPlayers > 0) return 1;
    // Then by player count (more players = higher priority)
    if (a.currentPlayers !== b.currentPlayers) return b.currentPlayers - a.currentPlayers;
    return 0;
  });

  const groupedTables = sortedTables.reduce((acc, table) => {
    if (!acc[table.limit]) acc[table.limit] = [];
    acc[table.limit].push(table);
    return acc;
  }, {} as Record<string, PokerTable[]>);

  const limits = ["NL2", "NL5", "NL10", "NL25", "NL50", "NL100", "NL200", "NL500"];
  const myTable = tables?.find(t => t.id === myTableId);

  const totalPlayers = tables?.reduce((sum, t) => sum + t.currentPlayers, 0) || 0;

  return (
    <div className="min-h-screen bg-[#0a0a1a]" data-testid="page-poker-lobby">
      <header className="sticky top-0 z-50 bg-[#0a0a1a]/95 backdrop-blur-lg border-b border-indigo-900/30">
        <div className="px-4 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                hapticFeedback("light");
                onBack();
              }}
              className="w-9 h-9 text-white hover:bg-indigo-900/30"
              data-testid="button-back"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                <span className="text-white font-bold text-sm">PP</span>
              </div>
              <div>
                <h1 className="text-lg font-bold text-white">PapaPoker</h1>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <BalanceDisplay
              balance={balance}
              onClick={() => {
                hapticFeedback("light");
                onOpenWallet();
              }}
              currency="USDT"
              showToggle={false}
              compact={true}
            />
            {user?.photoUrl ? (
              <img src={user.photoUrl} className="w-9 h-9 rounded-full border-2 border-indigo-500" alt="" />
            ) : (
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white font-bold text-sm">
                {user?.firstName?.[0] || "?"}
              </div>
            )}
          </div>
        </div>

        <div className="px-4 py-2 flex items-center gap-4 text-xs text-zinc-400">
          <div className="flex items-center gap-1">
            <Users className="w-3.5 h-3.5" />
            <span>{totalPlayers}</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <span>{language === "ru" ? "Онлайн" : "Online"}</span>
          </div>
        </div>
      </header>

      <main className="pb-20">
        {/* Hero Banner */}
        <div className="relative overflow-hidden mx-4 mt-4 rounded-2xl bg-gradient-to-r from-amber-600 via-orange-500 to-red-500 p-4">
          <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxjaXJjbGUgY3g9IjIwIiBjeT0iMjAiIHI9IjMiIGZpbGw9InJnYmEoMjU1LDI1NSwyNTUsMC4xKSIvPjwvZz48L3N2Zz4=')] opacity-30" />
          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-1">
              <Crown className="w-5 h-5 text-yellow-300" />
              <span className="text-yellow-200 text-xs font-medium uppercase tracking-wide">{language === "ru" ? "Бонус" : "BONUS"}</span>
            </div>
            <h2 className="text-xl font-bold text-white mb-1">DEPOSIT BOOSTER</h2>
            <p className="text-white/80 text-sm">{language === "ru" ? "Бонусы на каждый повторный депозит!" : "Bonuses on every repeat deposit!"}</p>
          </div>
          <div className="absolute right-2 bottom-0 w-20 h-20 opacity-80">
            <div className="w-full h-full rounded-full bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center animate-pulse">
              <Sparkles className="w-8 h-8 text-white" />
            </div>
          </div>
        </div>

        {/* Category Cards Grid */}
        <div className="px-4 mt-4 grid grid-cols-2 gap-3">
          {/* Cash Games - Full Width */}
          <button
            onClick={() => {
              hapticFeedback("medium");
              setSelectedCategory("cash");
            }}
            className={`col-span-2 relative overflow-hidden rounded-2xl p-4 transition-all ${
              selectedCategory === "cash" 
                ? "ring-2 ring-yellow-400 ring-offset-2 ring-offset-[#0a0a1a]" 
                : ""
            }`}
            style={{ background: "linear-gradient(135deg, #f59e0b 0%, #d97706 50%, #b45309 100%)" }}
            data-testid="category-cash"
          >
            <div className="flex items-center justify-between">
              <div className="text-left">
                <h3 className="text-white font-bold text-lg">{language === "ru" ? "Кэш-игры" : "Cash Games"}</h3>
                <p className="text-white/70 text-xs mt-1">{tables?.length || 0} {language === "ru" ? "столов" : "tables"}</p>
              </div>
              <div className="flex items-center gap-2">
                <Trophy className="w-10 h-10 text-yellow-200/80" />
                <ChevronRight className="w-5 h-5 text-white/60" />
              </div>
            </div>
          </button>

          {/* Tournaments - Coming Soon */}
          <div
            className="relative overflow-hidden rounded-2xl p-4 opacity-60"
            style={{ background: "linear-gradient(135deg, #7c3aed 0%, #5b21b6 100%)" }}
            data-testid="category-tournaments"
          >
            <div className="text-left">
              <h3 className="text-white font-bold">{language === "ru" ? "Турниры" : "Tournaments"}</h3>
              <p className="text-white/40 text-xs mt-1">{language === "ru" ? "Скоро" : "Soon"}</p>
            </div>
            <Trophy className="absolute right-2 bottom-2 w-8 h-8 text-white/10" />
            <div className="absolute top-1 right-1 bg-purple-600/80 px-2 py-0.5 rounded-full">
              <span className="text-white text-[10px] font-bold">{language === "ru" ? "СКОРО" : "SOON"}</span>
            </div>
          </div>

          {/* Sit & Go */}
          <button
            onClick={() => {
              hapticFeedback("medium");
              setSelectedCategory("sit_n_go");
            }}
            className={`relative overflow-hidden rounded-2xl p-4 transition-all ${
              selectedCategory === "sit_n_go" 
                ? "ring-2 ring-emerald-400 ring-offset-2 ring-offset-[#0a0a1a]" 
                : ""
            }`}
            style={{ background: "linear-gradient(135deg, #059669 0%, #047857 100%)" }}
            data-testid="category-sitgo"
          >
            <div className="text-left">
              <h3 className="text-white font-bold">Sit & Go</h3>
              <p className="text-white/60 text-xs mt-1">{language === "ru" ? "4 турнира" : "4 tournaments"}</p>
            </div>
            <Trophy className="absolute right-2 bottom-2 w-8 h-8 text-white/20" />
          </button>

          {/* Spin & Go - DISABLED */}
          {/* 
          <button
            onClick={() => {
              hapticFeedback("medium");
              setSelectedCategory("spin_go");
            }}
            className={`relative overflow-hidden rounded-2xl p-4 transition-all ${
              selectedCategory === "spin_go" 
                ? "ring-2 ring-cyan-400 ring-offset-2 ring-offset-[#0a0a1a]" 
                : ""
            }`}
            style={{ background: "linear-gradient(135deg, #0891b2 0%, #0e7490 100%)" }}
            data-testid="category-spingo"
          >
            <div className="text-left">
              <h3 className="text-white font-bold">Spin & Go</h3>
              <p className="text-white/60 text-xs mt-1">До x100</p>
            </div>
            <Zap className="absolute right-2 bottom-2 w-8 h-8 text-white/20" />
          </button>
          */}
        </div>

        {/* Admin Total Rake Display */}
        {isAdmin && rakeData !== undefined && (
          <div className="mx-4 mt-4 bg-gradient-to-r from-purple-900/50 to-violet-900/30 border border-purple-800/50 rounded-xl p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-purple-400" />
                <span className="text-sm font-medium text-purple-300">{language === "ru" ? "Общий рейк" : "Total Rake"}</span>
              </div>
              <div className="text-lg font-bold text-purple-400">
                ${rakeData.totalRake.toFixed(2)}
              </div>
            </div>
          </div>
        )}

        {/* Active Table Banner */}
        {myTable && (
          <div className="mx-4 mt-4">
            <button
              onClick={() => {
                hapticFeedback("medium");
                onJoinTable(myTable.id);
              }}
              className="w-full relative overflow-hidden rounded-2xl p-4 bg-gradient-to-r from-yellow-500/20 to-amber-500/10 border border-yellow-500/50"
              data-testid={`table-active-${myTable.id}`}
            >
              <div className="absolute top-2 right-2">
                <span className="px-2 py-1 bg-yellow-500 text-black text-xs font-bold rounded-full animate-pulse">
                  {language === "ru" ? "ИГРАЕТЕ" : "PLAYING"}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center">
                  <Star className="w-6 h-6 text-white fill-white" />
                </div>
                <div className="text-left">
                  <div className="font-bold text-white flex items-center gap-2">
                    {myTable.name}
                    <span className="text-xs bg-yellow-500/30 text-yellow-300 px-2 py-0.5 rounded-full">
                      {myTable.limit}
                    </span>
                  </div>
                  <div className="text-sm text-zinc-400">
                    {myTable.maxSeats}-max • ${myTable.smallBlind}/{myTable.bigBlind}
                  </div>
                </div>
              </div>
            </button>
          </div>
        )}

        {/* Tables List */}
        {selectedCategory === "cash" && (
          <div className="mt-6 px-4">
            <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <Coins className="w-5 h-5 text-yellow-500" />
              {language === "ru" ? "Кэш столы" : "Cash Tables"}
            </h2>

            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full" />
              </div>
            ) : (
              <div className="space-y-3">
                {limits.map(limit => {
                  const limitTables = groupedTables[limit]?.filter(t => t.id !== myTableId);
                  if (!limitTables?.length) return null;

                  return (
                    <div key={limit} className="space-y-2">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-sm font-bold text-indigo-400">{limit}</span>
                        <span className="text-xs text-zinc-500">
                          ${limitTables[0].smallBlind}/${limitTables[0].bigBlind}
                        </span>
                        <div className="flex-1 h-px bg-zinc-800" />
                      </div>

                      {limitTables.map(table => (
                        <button
                          key={table.id}
                          onClick={() => {
                            hapticFeedback("medium");
                            onJoinTable(table.id);
                          }}
                          className={`w-full rounded-xl p-4 transition-all border ${
                            table.currentPlayers > 0 
                              ? "bg-gradient-to-r from-[#12122a] to-green-950/30 border-green-700/40 hover:border-green-600/60" 
                              : "bg-[#12122a] hover:bg-[#1a1a3a] border-indigo-900/30"
                          }`}
                          data-testid={`table-${table.id}`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="relative">
                                <span className="text-2xl">{table.countryFlag}</span>
                                {table.currentPlayers > 0 && (
                                  <span className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full animate-pulse border border-green-400" />
                                )}
                              </div>
                              <div className="text-left">
                                <div className="font-medium text-white flex items-center gap-2">
                                  {table.name}
                                  {table.currentPlayers > 0 && (
                                    <span className="text-[10px] bg-green-500/20 text-green-400 px-1.5 py-0.5 rounded font-bold uppercase">
                                      {language === "ru" ? "Игра" : "LIVE"}
                                    </span>
                                  )}
                                </div>
                                <div className="text-xs text-zinc-500">
                                  {table.maxSeats}-max • Buy-in ${table.minBuyIn.toFixed(0)}-${table.maxBuyIn.toFixed(0)}
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-4">
                              <div className={`flex items-center gap-1 ${table.currentPlayers > 0 ? "text-green-400" : "text-zinc-500"}`}>
                                <Users className="w-4 h-4" />
                                <span className="text-sm font-medium">{table.currentPlayers}/{table.maxSeats}</span>
                              </div>
                              <ChevronRight className="w-5 h-5 text-zinc-600" />
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Sit-N-Go Section */}
        {selectedCategory === "sit_n_go" && (
          <div className="mt-6 px-4">
            <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <Trophy className="w-5 h-5 text-emerald-500" />
              {language === "ru" ? "Sit & Go Турниры" : "Sit & Go Tournaments"}
            </h2>
            
            <div className="space-y-3">
              {sitNGoConfigs.map(config => (
                <button
                  key={config.id}
                  onClick={() => {
                    hapticFeedback("medium");
                    toast({ 
                      title: language === "ru" ? "Скоро!" : "Coming Soon!", 
                      description: language === "ru" ? `${config.name} скоро будет доступен` : `${config.name} will be available soon`
                    });
                  }}
                  className="w-full bg-gradient-to-r from-emerald-900/30 to-teal-900/20 hover:from-emerald-900/50 hover:to-teal-900/40 border border-emerald-700/30 rounded-xl p-4 transition-all"
                  data-testid={`sng-${config.id}`}
                >
                  <div className="flex items-center justify-between">
                    <div className="text-left">
                      <div className="font-bold text-white flex items-center gap-2">
                        {config.name}
                        <span className="text-xs bg-emerald-500/30 text-emerald-300 px-2 py-0.5 rounded-full">
                          {config.players} {language === "ru" ? "игроков" : "players"}
                        </span>
                      </div>
                      <div className="text-sm text-zinc-400 mt-1">
                        {language === "ru" ? "Бай-ин" : "Buy-in"}: ${config.buyIn} • {language === "ru" ? "Стек" : "Stack"}: {config.startingStack}
                      </div>
                      <div className="text-xs text-zinc-500 mt-0.5">
                        {language === "ru" ? "Призовые" : "Prizes"}: {config.prizeStructure.map((p, i) => `${i+1}: ${p}%`).join(", ")}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <div className="text-lg font-bold text-emerald-400">${config.buyIn}</div>
                        <div className="text-xs text-zinc-500">{language === "ru" ? "бай-ин" : "buy-in"}</div>
                      </div>
                      <ChevronRight className="w-5 h-5 text-zinc-600" />
                    </div>
                  </div>
                </button>
              ))}
            </div>
            
            <div className="mt-6 bg-emerald-900/20 border border-emerald-700/30 rounded-xl p-4">
              <h3 className="text-sm font-bold text-emerald-400 mb-2">{language === "ru" ? "Как играть" : "How to Play"}</h3>
              <p className="text-xs text-zinc-400">
                {language === "ru" 
                  ? "Sit & Go начинается когда все места заполнены. Блайнды увеличиваются каждые 3-6 минут. Победитель забирает призовой фонд согласно структуре выплат."
                  : "Sit & Go starts when all seats are filled. Blinds increase every 3-6 minutes. Winner takes the prize pool according to the payout structure."}
              </p>
            </div>
          </div>
        )}

        {/* Spin & Go Section - DISABLED */}
        {/* 
        {selectedCategory === "spin_go" && (
          <SpinGoLobby 
            balance={balance}
            userId={user?.id || ""}
            username={user?.username || user?.firstName || "Player"}
            photoUrl={user?.photoUrl}
            hapticFeedback={hapticFeedback}
            onMatch={(match) => {
              setSpinBuyIn(match.buyIn);
              setSpinGoMatch(match);
              setShowSpinWheel(true);
            }}
          />
        )}
        */}

        {/* Admin Controls Panel */}
        {isAdmin && tables && tables.length > 0 && (
          <div className="mx-4 mt-8 border-t border-red-500/30 pt-6">
            <div className="flex items-center gap-2 mb-4">
              <Shield className="w-5 h-5 text-red-400" />
              <span className="text-lg font-bold text-red-400">{language === "ru" ? "Админ-контроли" : "Admin Controls"}</span>
            </div>
            
            <div className="space-y-3">
              {tables.filter(t => t.currentPlayers > 0).map(table => (
                <div
                  key={`admin-${table.id}`}
                  className="bg-red-950/30 border border-red-800/50 rounded-xl p-4"
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{table.countryFlag}</span>
                      <span className="font-medium text-white">{table.name}</span>
                      <span className="text-xs bg-red-500/20 text-red-400 px-2 py-0.5 rounded-full">
                        {table.currentPlayers} {language === "ru" ? "игроков" : "players"}
                      </span>
                    </div>
                  </div>
                  
                  <div className="flex gap-2 flex-wrap">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleAdminAction(table.id, "refresh")}
                      disabled={adminLoading === `refresh-${table.id}`}
                      className="text-blue-400 border-blue-500/50 hover:bg-blue-500/10"
                      data-testid={`admin-refresh-${table.id}`}
                    >
                      <RefreshCw className="w-4 h-4 mr-1" />
                      {language === "ru" ? "Обновить" : "Refresh"}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleAdminAction(table.id, "close")}
                      disabled={adminLoading === `close-${table.id}`}
                      className="text-red-400 border-red-500/50 hover:bg-red-500/10"
                      data-testid={`admin-close-${table.id}`}
                    >
                      <X className="w-4 h-4 mr-1" />
                      {language === "ru" ? "Закрыть стол" : "Close Table"}
                    </Button>
                  </div>
                </div>
              ))}
              
              {tables.filter(t => t.currentPlayers > 0).length === 0 && (
                <p className="text-zinc-500 text-sm">{language === "ru" ? "Нет столов с игроками" : "No tables with players"}</p>
              )}
            </div>
          </div>
        )}
      </main>
      
      {/* SpinGoWheel - DISABLED */}
      {/* 
      <SpinGoWheel
        isOpen={showSpinWheel}
        buyIn={spinBuyIn}
        multiplier={spinGoMatch?.multiplier}
        serverPrizePool={spinGoMatch?.prizePool}
        players={spinGoMatch?.players}
        onComplete={(multiplier, prizePool) => {
          setShowSpinWheel(false);
          setSpinGoMatch(null);
          toast({
            title: `Multiplier: x${multiplier}`,
            description: `Prize pool: $${prizePool.toLocaleString()}`,
          });
        }}
        onClose={() => {
          setShowSpinWheel(false);
          setSpinGoMatch(null);
        }}
      />
      */}
    </div>
  );
}
