import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useLanguage } from "@/components/LanguageProvider";
import { useTelegram } from "@/components/TelegramProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Crown, Send, Lock, User, Diamond, Sparkles, Star } from "lucide-react";
import type { ChatMessage } from "@shared/schema";

interface VipChatProps {
  isVip: boolean;
  vipTier?: string | null;
  odejs: string;
  isAdmin?: boolean;
}

const MAX_CHARS = 200;

type VipTier = "gold" | "diamond" | "godOfWin" | null;

const tierConfig = {
  gold: {
    label: { ru: "Gold", en: "Gold" },
    color: "text-amber-400",
    bgColor: "bg-amber-500/20",
    borderColor: "border-amber-500/30",
    icon: Star,
    minDeposit: 30,
  },
  diamond: {
    label: { ru: "Diamond", en: "Diamond" },
    color: "text-cyan-400",
    bgColor: "bg-cyan-500/20",
    borderColor: "border-cyan-500/30",
    icon: Diamond,
    minDeposit: 100,
  },
  godOfWin: {
    label: { ru: "God of Win", en: "God of Win" },
    color: "text-purple-400",
    bgColor: "bg-purple-500/20",
    borderColor: "border-purple-500/30",
    icon: Sparkles,
    minDeposit: 1000,
  },
};

export function TierBadge({ tier, size = "sm" }: { tier: string | null | undefined; size?: "sm" | "lg" }) {
  if (!tier || !tierConfig[tier as keyof typeof tierConfig]) return null;
  
  const config = tierConfig[tier as keyof typeof tierConfig];
  const IconComponent = config.icon;
  const iconSize = size === "sm" ? "w-3 h-3" : "w-4 h-4";
  const textSize = size === "sm" ? "text-[10px]" : "text-xs";
  const padding = size === "sm" ? "px-1.5 py-0.5" : "px-2 py-1";
  
  return (
    <span className={`inline-flex items-center gap-1 ${padding} rounded-full ${config.bgColor} ${config.borderColor} border`}>
      <IconComponent className={`${iconSize} ${config.color}`} />
      <span className={`${textSize} font-medium ${config.color}`}>
        {config.label.en}
      </span>
    </span>
  );
}

export function VipChat({ isVip, vipTier, odejs, isAdmin = false }: VipChatProps) {
  const { language } = useLanguage();
  const { hapticFeedback } = useTelegram();
  const [message, setMessage] = useState("");
  const [cooldownSeconds, setCooldownSeconds] = useState(0);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // Admins can access chat even without VIP
  const canAccessChat = isVip || isAdmin;

  const { data: messages = [], isLoading } = useQuery<ChatMessage[]>({
    queryKey: ["/api/chat/messages"],
    refetchInterval: canAccessChat ? 5000 : false,
    enabled: canAccessChat,
  });

  const sendMessageMutation = useMutation({
    mutationFn: async (messageText: string) => {
      const res = await apiRequest("POST", "/api/chat/messages", {
        odejs,
        message: messageText,
      });
      return res.json();
    },
    onSuccess: () => {
      setMessage("");
      hapticFeedback("light");
      queryClient.invalidateQueries({ queryKey: ["/api/chat/messages"] });
      setCooldownSeconds(60);
    },
    onError: (error: any) => {
      if (error.remainingSeconds) {
        setCooldownSeconds(error.remainingSeconds);
      }
      hapticFeedback("heavy");
    },
  });

  useEffect(() => {
    if (cooldownSeconds > 0) {
      const timer = setInterval(() => {
        setCooldownSeconds((prev) => Math.max(0, prev - 1));
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [cooldownSeconds]);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  const handleSend = () => {
    // Admins bypass cooldown and VIP requirement
    const canSend = isAdmin || (canAccessChat && cooldownSeconds === 0);
    if (!message.trim() || !canSend) return;
    sendMessageMutation.mutate(message.trim());
  };

  const formatTime = (dateInput: Date | string | null) => {
    if (!dateInput) return "";
    const date = typeof dateInput === "string" ? new Date(dateInput) : dateInput;
    return date.toLocaleTimeString(language === "ru" ? "ru-RU" : "en-US", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getDisplayName = (msg: ChatMessage) => {
    // Admin messages show "Admin" instead of username
    if (msg.isAdmin) return "Admin";
    if (msg.username) return `@${msg.username}`;
    if (msg.firstName) return msg.firstName;
    return language === "ru" ? "Игрок" : "Player";
  };

  const charsRemaining = MAX_CHARS - message.length;
  const isOverLimit = charsRemaining < 0;

  return (
    <div className="bg-card border border-card-border rounded-2xl overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-gradient-to-r from-amber-500/10 to-amber-600/5">
        <Crown className="w-5 h-5 text-amber-500" />
        <span className="font-semibold text-foreground">
          {language === "ru" ? "VIP Чат" : "VIP Chat"}
        </span>
        {canAccessChat && vipTier && (
          <TierBadge tier={vipTier} size="sm" />
        )}
        {isAdmin && (
          <span className="ml-auto text-xs text-red-500 font-medium flex items-center gap-1">
            <Crown className="w-3 h-3" />
            Admin
          </span>
        )}
        {!canAccessChat && (
          <Lock className="w-4 h-4 text-muted-foreground ml-auto" />
        )}
      </div>

      <ScrollArea className="h-48" ref={scrollAreaRef}>
        <div className="p-3 space-y-2">
          {!canAccessChat ? (
            <div className="flex flex-col items-center justify-center h-36 text-center px-4">
              <Lock className="w-8 h-8 text-amber-500/50 mb-2" />
              <p className="text-sm text-muted-foreground mb-2">
                {language === "ru" 
                  ? "Чат доступен для VIP игроков" 
                  : "Chat is available for VIP players"}
              </p>
              <div className="space-y-1 text-xs">
                <p className="text-amber-400 flex items-center gap-1 justify-center">
                  <Star className="w-3 h-3" />
                  Gold: ${tierConfig.gold.minDeposit}+
                </p>
                <p className="text-cyan-400 flex items-center gap-1 justify-center">
                  <Diamond className="w-3 h-3" />
                  Diamond: ${tierConfig.diamond.minDeposit}+
                </p>
                <p className="text-purple-400 flex items-center gap-1 justify-center">
                  <Sparkles className="w-3 h-3" />
                  God of Win: ${tierConfig.godOfWin.minDeposit}+
                </p>
              </div>
            </div>
          ) : isLoading ? (
            <div className="text-center text-muted-foreground text-sm py-4">
              {language === "ru" ? "Загрузка..." : "Loading..."}
            </div>
          ) : messages.length === 0 ? (
            <div className="text-center text-muted-foreground text-sm py-4">
              {language === "ru" 
                ? "Пока нет сообщений. Будьте первым!" 
                : "No messages yet. Be the first!"}
            </div>
          ) : (
            messages.map((msg) => (
              <div 
                key={msg.id} 
                className={`flex gap-2 ${msg.odejs === odejs ? "justify-end" : ""}`}
              >
                <div 
                  className={`max-w-[85%] rounded-xl px-3 py-2 ${
                    msg.isAdmin
                      ? "bg-red-500/10 border border-red-500/30"
                      : msg.odejs === odejs 
                        ? "bg-primary/20 border border-primary/30" 
                        : "bg-muted/50"
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <div className="flex items-center gap-1">
                      {msg.isAdmin ? (
                        <>
                          <Crown className="w-3 h-3 text-red-500" />
                          <span className="text-xs font-bold text-red-500">
                            Admin
                          </span>
                        </>
                      ) : (
                        <>
                          <User className="w-3 h-3 text-amber-500" />
                          <span className="text-xs font-medium text-amber-500">
                            {getDisplayName(msg)}
                          </span>
                        </>
                      )}
                    </div>
                    {!msg.isAdmin && msg.vipTier && <TierBadge tier={msg.vipTier} size="sm" />}
                    <span className="text-xs text-muted-foreground">
                      {formatTime(msg.createdAt)}
                    </span>
                  </div>
                  <p className="text-sm text-foreground break-words">
                    {msg.message}
                  </p>
                </div>
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>

      {canAccessChat && (
        <div className="p-3 border-t border-border">
          <div className="space-y-2">
            <div className="flex gap-2">
              <Input
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder={language === "ru" ? "Написать сообщение..." : "Type a message..."}
                maxLength={MAX_CHARS + 50}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                disabled={(!isAdmin && cooldownSeconds > 0) || sendMessageMutation.isPending}
                className="flex-1 bg-muted/50"
                data-testid="input-chat-message"
              />
              <Button
                size="icon"
                onClick={handleSend}
                disabled={!message.trim() || isOverLimit || (!isAdmin && cooldownSeconds > 0) || sendMessageMutation.isPending}
                data-testid="button-send-message"
              >
                <Send className="w-4 h-4" />
              </Button>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className={`${isOverLimit ? "text-destructive" : "text-muted-foreground"}`}>
                {charsRemaining} {language === "ru" ? "симв." : "chars"}
              </span>
              {!isAdmin && cooldownSeconds > 0 && (
                <span className="text-amber-500">
                  {language === "ru" 
                    ? `Подождите ${cooldownSeconds} сек.` 
                    : `Wait ${cooldownSeconds}s`}
                </span>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
