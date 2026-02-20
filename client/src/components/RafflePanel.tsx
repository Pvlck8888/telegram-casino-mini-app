import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Trophy, Users, Gift, Crown, Diamond, Sparkles, Star, CheckCircle } from "lucide-react";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "./LanguageProvider";

interface Raffle {
  id: string;
  name: string;
  nameRu: string;
  description: string | null;
  descriptionRu: string | null;
  prizeDescription: string | null;
  prizeDescriptionRu: string | null;
  maxWinners: number;
  minDeposit: number | null;
  requiredVipTier: string | null;
  currentParticipants: number | null;
  status: string;
}

interface RaffleWinner {
  id: string;
  raffleId: string;
  odejs: string;
  username: string | null;
  firstName: string | null;
  rank: number;
}

interface RafflePanelProps {
  odejs: string;
  username?: string;
  firstName?: string;
  vipTier?: string;
  totalDeposited?: number;
}

function TierBadge({ tier }: { tier: string }) {
  const { t } = useLanguage();
  
  if (tier === "gold") {
    return (
      <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">
        <Crown className="w-3 h-3 mr-1" />
        Gold
      </Badge>
    );
  }
  if (tier === "diamond") {
    return (
      <Badge className="bg-cyan-500/20 text-cyan-400 border-cyan-500/30">
        <Diamond className="w-3 h-3 mr-1" />
        Diamond
      </Badge>
    );
  }
  if (tier === "godOfWin") {
    return (
      <Badge className="bg-purple-500/20 text-purple-400 border-purple-500/30">
        <Sparkles className="w-3 h-3 mr-1" />
        God of Win
      </Badge>
    );
  }
  return null;
}

function WheelAnimation({ participants, winnersCount, onComplete }: { 
  participants: string[]; 
  winnersCount: number;
  onComplete: () => void;
}) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [spinning, setSpinning] = useState(true);
  const [speed, setSpeed] = useState(50);
  
  useEffect(() => {
    if (!spinning) return;
    
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % participants.length);
    }, speed);
    
    const slowDown = setTimeout(() => {
      setSpeed(100);
    }, 2000);
    
    const stop = setTimeout(() => {
      setSpeed(200);
    }, 3000);
    
    const complete = setTimeout(() => {
      setSpinning(false);
      onComplete();
    }, 4000);
    
    return () => {
      clearInterval(interval);
      clearTimeout(slowDown);
      clearTimeout(stop);
      clearTimeout(complete);
    };
  }, [spinning, speed, participants.length, onComplete]);
  
  if (participants.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No participants
      </div>
    );
  }
  
  return (
    <div className="flex flex-col items-center py-6">
      <div className="relative w-48 h-48">
        <div className="absolute inset-0 rounded-full border-4 border-primary/30 flex items-center justify-center bg-gradient-to-br from-primary/20 to-transparent">
          <div className={`text-xl font-bold text-center px-4 ${spinning ? 'animate-pulse' : ''}`}>
            {participants[currentIndex] || "???"}
          </div>
        </div>
        {spinning && (
          <div className="absolute -top-2 left-1/2 -translate-x-1/2">
            <Star className="w-6 h-6 text-yellow-500 animate-bounce" />
          </div>
        )}
      </div>
      {spinning && (
        <p className="mt-4 text-sm text-muted-foreground animate-pulse">
          Spinning...
        </p>
      )}
    </div>
  );
}

export default function RafflePanel({ odejs, username, firstName, vipTier, totalDeposited }: RafflePanelProps) {
  const { t, language } = useLanguage();
  const { toast } = useToast();
  const [showWheel, setShowWheel] = useState(false);
  
  const { data: activeRaffle } = useQuery<Raffle | null>({
    queryKey: ["/api/raffles/active"],
    refetchInterval: 5000,
  });
  
  const { data: entryStatus } = useQuery<{ joined: boolean }>({
    queryKey: ["/api/raffles", activeRaffle?.id, "status", odejs],
    enabled: !!activeRaffle?.id && !!odejs,
  });
  
  const { data: winners } = useQuery<RaffleWinner[]>({
    queryKey: ["/api/raffles", activeRaffle?.id, "winners"],
    enabled: !!activeRaffle?.id && (activeRaffle?.status === "completed" || activeRaffle?.status === "spinning"),
  });
  
  const { data: entries } = useQuery<Array<{ username: string | null; firstName: string | null }>>({
    queryKey: ["/api/raffles", activeRaffle?.id, "entries"],
    enabled: !!activeRaffle?.id && activeRaffle?.status === "spinning",
  });
  
  const joinMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/raffles/${activeRaffle?.id}/join`, {
        odejs,
        username,
        firstName,
        vipTier,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/raffles", activeRaffle?.id, "status", odejs] });
      queryClient.invalidateQueries({ queryKey: ["/api/raffles/active"] });
      toast({ 
        title: language === "ru" ? "Успешно!" : "Success!", 
        description: language === "ru" ? "Вы участвуете в розыгрыше" : "You've joined the raffle" 
      });
    },
    onError: (error: any) => {
      toast({ 
        title: language === "ru" ? "Ошибка" : "Error", 
        description: error.message, 
        variant: "destructive" 
      });
    },
  });
  
  const canJoin = () => {
    if (!activeRaffle) return false;
    if (entryStatus?.joined) return false;
    if (activeRaffle.status !== "active") return false;
    
    if (activeRaffle.requiredVipTier) {
      const tierOrder = ["", "gold", "diamond", "godOfWin"];
      const requiredIndex = tierOrder.indexOf(activeRaffle.requiredVipTier);
      const userIndex = tierOrder.indexOf(vipTier || "");
      if (userIndex < requiredIndex) return false;
    }
    
    if (activeRaffle.minDeposit && (totalDeposited || 0) < activeRaffle.minDeposit) {
      return false;
    }
    
    return true;
  };
  
  const getJoinBlockReason = () => {
    if (!activeRaffle) return null;
    if (entryStatus?.joined) return language === "ru" ? "Вы уже участвуете" : "Already joined";
    
    if (activeRaffle.requiredVipTier) {
      const tierOrder = ["", "gold", "diamond", "godOfWin"];
      const requiredIndex = tierOrder.indexOf(activeRaffle.requiredVipTier);
      const userIndex = tierOrder.indexOf(vipTier || "");
      if (userIndex < requiredIndex) {
        const tierNames: Record<string, string> = {
          gold: "Gold",
          diamond: "Diamond", 
          godOfWin: "God of Win",
        };
        return language === "ru" 
          ? `Требуется ${tierNames[activeRaffle.requiredVipTier]}+ статус` 
          : `Requires ${tierNames[activeRaffle.requiredVipTier]}+ tier`;
      }
    }
    
    if (activeRaffle.minDeposit && (totalDeposited || 0) < activeRaffle.minDeposit) {
      return language === "ru" 
        ? `Требуется ${activeRaffle.minDeposit}$ депозитов` 
        : `Requires $${activeRaffle.minDeposit} deposits`;
    }
    
    return null;
  };
  
  if (!activeRaffle) {
    return null;
  }
  
  const isSpinning = activeRaffle.status === "spinning";
  const isCompleted = activeRaffle.status === "completed";
  const participantNames = entries?.map(e => e.username ? `@${e.username}` : e.firstName || "User") || [];
  
  return (
    <Card className="bg-gradient-to-br from-yellow-500/10 via-primary/5 to-transparent border-yellow-500/30">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-2">
            <Gift className="w-5 h-5 text-yellow-500" />
            {language === "ru" ? activeRaffle.nameRu || activeRaffle.name : activeRaffle.name}
          </span>
          <Badge 
            className={
              activeRaffle.status === "active" ? "bg-green-500/20 text-green-400" :
              isSpinning ? "bg-yellow-500/20 text-yellow-400 animate-pulse" :
              isCompleted ? "bg-gray-500/20 text-gray-400" :
              "bg-blue-500/20 text-blue-400"
            }
          >
            {activeRaffle.status === "active" 
              ? (language === "ru" ? "Идёт" : "Active") 
              : isSpinning 
                ? (language === "ru" ? "Розыгрыш!" : "Drawing!") 
                : isCompleted 
                  ? (language === "ru" ? "Завершён" : "Completed")
                  : (language === "ru" ? "Скоро" : "Soon")}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between text-sm">
          <span className="flex items-center gap-2 text-muted-foreground">
            <Trophy className="w-4 h-4 text-yellow-500" />
            {language === "ru" 
              ? activeRaffle.prizeDescriptionRu || activeRaffle.prizeDescription || "Приз" 
              : activeRaffle.prizeDescription || "Prize"}
          </span>
          <span className="flex items-center gap-1 text-muted-foreground">
            <Users className="w-4 h-4" />
            {activeRaffle.currentParticipants || 0}
          </span>
        </div>
        
        {activeRaffle.requiredVipTier && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">
              {language === "ru" ? "Требуется:" : "Required:"}
            </span>
            <TierBadge tier={activeRaffle.requiredVipTier} />
          </div>
        )}
        
        {isSpinning && (
          <WheelAnimation 
            participants={participantNames}
            winnersCount={activeRaffle.maxWinners}
            onComplete={() => {
              queryClient.invalidateQueries({ queryKey: ["/api/raffles/active"] });
              queryClient.invalidateQueries({ queryKey: ["/api/raffles", activeRaffle.id, "winners"] });
            }}
          />
        )}
        
        {isCompleted && winners && winners.length > 0 && (
          <div className="space-y-2 py-2">
            <p className="text-sm font-medium text-center text-yellow-500">
              {language === "ru" ? "Победители:" : "Winners:"}
            </p>
            <div className="space-y-1">
              {winners.map((w) => (
                <div key={w.id} className="flex items-center justify-between p-2 bg-yellow-500/10 rounded-lg">
                  <span className="flex items-center gap-2">
                    <span className="text-yellow-500 font-bold">#{w.rank}</span>
                    <span>{w.username ? `@${w.username}` : w.firstName || "User"}</span>
                  </span>
                  <Trophy className="w-4 h-4 text-yellow-500" />
                </div>
              ))}
            </div>
          </div>
        )}
        
        {activeRaffle.status === "active" && (
          <>
            {entryStatus?.joined ? (
              <Button className="w-full" variant="secondary" disabled data-testid="button-raffle-joined">
                <CheckCircle className="w-4 h-4 mr-2" />
                {language === "ru" ? "Вы участвуете!" : "You're in!"}
              </Button>
            ) : canJoin() ? (
              <Button 
                className="w-full bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-600 hover:to-yellow-700" 
                onClick={() => joinMutation.mutate()}
                disabled={joinMutation.isPending}
                data-testid="button-join-raffle"
              >
                <Gift className="w-4 h-4 mr-2" />
                {language === "ru" ? "Участвовать" : "Join Raffle"}
              </Button>
            ) : (
              <div className="text-center">
                <Button className="w-full" variant="outline" disabled>
                  {getJoinBlockReason()}
                </Button>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
