import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { Gift, ExternalLink, X, Sparkles, Crown, Gem, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useTelegram } from "@/components/TelegramProvider";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/components/LanguageProvider";
import { apiRequest } from "@/lib/queryClient";

interface WelcomePopupProps {
  onClose: () => void;
}

export function WelcomePopup({ onClose }: WelcomePopupProps) {
  const { user, hapticFeedback } = useTelegram();
  const { toast } = useToast();
  const { language } = useLanguage();
  const queryClient = useQueryClient();
  const [code, setCode] = useState("");

  const { data: settings } = useQuery<{ telegramChannelLink?: string }>({
    queryKey: ["/api/settings/public"],
    queryFn: async () => {
      const res = await fetch("/api/settings/public");
      if (!res.ok) return {};
      return res.json();
    },
  });

  const applyCodeMutation = useMutation({
    mutationFn: async (inputCode: string) => {
      const promoResponse = await fetch("/api/promo/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user?.id, code: inputCode }),
      });
      
      if (promoResponse.ok) {
        const data = await promoResponse.json();
        return { type: "promo", ...data };
      }
      
      if (user?.id) {
        const referralResponse = await fetch(`/api/users/${user.id}/apply-referral`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ referralCode: inputCode }),
        });
        
        if (referralResponse.ok) {
          const data = await referralResponse.json();
          return { type: "referral", bonus: data.bonus || 5, ...data };
        }
        
        const referralError = await referralResponse.json().catch(() => ({}));
        if (referralError.error) {
          throw new Error(referralError.error);
        }
      }
      
      throw new Error(language === "ru" ? "Неверный код" : "Invalid code");
    },
    onSuccess: (data) => {
      hapticFeedback("heavy");
      queryClient.invalidateQueries({ queryKey: ["/api/users/telegram", user?.telegramId] });
      
      const title = data.type === "referral" 
        ? (language === "ru" ? "Реферальный бонус!" : "Referral bonus!")
        : (language === "ru" ? "Бонус получен!" : "Bonus received!");
      
      toast({
        title,
        description: data.message || `+$${data.bonus}`,
      });
      onClose();
    },
    onError: (error: any) => {
      toast({
        title: language === "ru" ? "Ошибка" : "Error",
        description: error.message || (language === "ru" ? "Неверный код" : "Invalid code"),
        variant: "destructive",
      });
    },
  });

  const handleApply = () => {
    if (code.trim()) {
      applyCodeMutation.mutate(code.trim());
    }
  };

  const handleOpenChannel = () => {
    if (settings?.telegramChannelLink) {
      window.open(settings.telegramChannelLink, "_blank");
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.5, opacity: 0, rotateY: -30 }}
          animate={{ scale: 1, opacity: 1, rotateY: 0 }}
          exit={{ scale: 0.5, opacity: 0, rotateY: 30 }}
          transition={{ type: "spring", damping: 20, stiffness: 200 }}
          className="relative w-full max-w-sm"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="absolute -inset-1 rounded-3xl overflow-hidden">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
              className="absolute inset-0 bg-gradient-conic from-amber-500 via-purple-500 via-pink-500 via-amber-500 to-amber-500"
              style={{
                background: "conic-gradient(from 0deg, #f59e0b, #a855f7, #ec4899, #3b82f6, #f59e0b)",
              }}
            />
          </div>
          
          <div className="relative bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-3xl overflow-hidden">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(245,158,11,0.15),transparent_50%)]" />
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom,rgba(168,85,247,0.1),transparent_50%)]" />
            
            <motion.div
              className="absolute top-0 left-1/4 w-1 h-20 bg-gradient-to-b from-amber-400/50 to-transparent blur-sm"
              animate={{ y: [-80, 200], opacity: [0, 1, 0] }}
              transition={{ duration: 2, repeat: Infinity, delay: 0 }}
            />
            <motion.div
              className="absolute top-0 right-1/3 w-1 h-16 bg-gradient-to-b from-purple-400/50 to-transparent blur-sm"
              animate={{ y: [-60, 200], opacity: [0, 1, 0] }}
              transition={{ duration: 2.5, repeat: Infinity, delay: 0.5 }}
            />
            <motion.div
              className="absolute top-0 right-1/4 w-1 h-24 bg-gradient-to-b from-pink-400/50 to-transparent blur-sm"
              animate={{ y: [-100, 200], opacity: [0, 1, 0] }}
              transition={{ duration: 3, repeat: Infinity, delay: 1 }}
            />
            
            <button
              onClick={onClose}
              className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors z-10 backdrop-blur-sm"
              data-testid="button-close-welcome"
            >
              <X className="w-4 h-4 text-white/80" />
            </button>

            <div className="relative p-6 pt-8">
              <div className="flex items-center justify-center mb-6">
                <motion.div 
                  className="relative"
                  animate={{ y: [0, -5, 0] }}
                  transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                >
                  <div className="relative w-24 h-24">
                    <motion.div
                      animate={{ scale: [1, 1.1, 1], opacity: [0.5, 0.8, 0.5] }}
                      transition={{ duration: 2, repeat: Infinity }}
                      className="absolute inset-0 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 blur-xl"
                    />
                    
                    <div className="relative w-24 h-24 rounded-2xl bg-gradient-to-br from-amber-400 via-amber-500 to-amber-600 flex items-center justify-center shadow-2xl shadow-amber-500/50 border-2 border-amber-300/50">
                      <div className="absolute inset-1 rounded-xl bg-gradient-to-br from-slate-900/80 to-slate-800/80 flex items-center justify-center">
                        <div className="relative">
                          <Crown className="w-10 h-10 text-amber-400" />
                          <motion.div
                            animate={{ opacity: [0.5, 1, 0.5] }}
                            transition={{ duration: 1.5, repeat: Infinity }}
                          >
                            <Sparkles className="w-4 h-4 text-amber-300 absolute -top-1 -right-1" />
                          </motion.div>
                        </div>
                      </div>
                    </div>
                    
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
                      className="absolute -inset-2"
                    >
                      <Star className="w-4 h-4 text-amber-400 absolute top-0 left-1/2 -translate-x-1/2" />
                      <Gem className="w-3 h-3 text-purple-400 absolute bottom-0 left-1/2 -translate-x-1/2" />
                      <Star className="w-3 h-3 text-pink-400 absolute top-1/2 left-0 -translate-y-1/2" />
                      <Gem className="w-4 h-4 text-blue-400 absolute top-1/2 right-0 -translate-y-1/2" />
                    </motion.div>
                  </div>
                </motion.div>
              </div>

              <motion.h2 
                className="text-3xl font-black text-center bg-gradient-to-r from-amber-200 via-amber-400 to-amber-200 bg-clip-text text-transparent mb-1 tracking-tight drop-shadow-lg"
                animate={{ backgroundPosition: ["0% 50%", "100% 50%", "0% 50%"] }}
                transition={{ duration: 3, repeat: Infinity }}
                style={{ 
                  backgroundSize: "200% auto",
                  textShadow: "0 0 40px rgba(245, 158, 11, 0.5)",
                  WebkitTextStroke: "0.5px rgba(245, 158, 11, 0.3)"
                }}
              >
                {language === "ru" ? "ДОБРО ПОЖАЛОВАТЬ!" : "WELCOME!"}
              </motion.h2>
              
              <motion.p 
                className="text-lg font-extrabold text-center bg-gradient-to-r from-purple-300 via-pink-300 to-purple-300 bg-clip-text text-transparent mb-5"
                animate={{ opacity: [0.7, 1, 0.7] }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                {language === "ru" ? "В МИР УДАЧИ" : "TO FORTUNE"}
              </motion.p>
              
              <p className="text-sm text-center text-slate-400 mb-6">
                {language === "ru" 
                  ? "Введите промокод или реферальный код для получения бонуса!" 
                  : "Enter a promo code or referral code to get a bonus!"}
              </p>

              <div className="space-y-4">
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Input
                      placeholder={language === "ru" ? "ПРОМОКОД или РЕФ. КОД" : "PROMO or REFERRAL CODE"}
                      value={code}
                      onChange={(e) => setCode(e.target.value.toUpperCase())}
                      className="w-full bg-slate-800/80 border-slate-600/50 text-white placeholder:text-slate-500 uppercase pr-4 focus:border-amber-500/50 focus:ring-amber-500/20"
                      data-testid="input-promo-code"
                    />
                    <div className="absolute inset-0 rounded-md bg-gradient-to-r from-amber-500/10 to-purple-500/10 pointer-events-none" />
                  </div>
                  <Button
                    onClick={handleApply}
                    disabled={!code.trim() || applyCodeMutation.isPending}
                    className="bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-white shadow-lg shadow-amber-500/25 border border-amber-400/30"
                    data-testid="button-apply-promo"
                  >
                    <Gift className="w-4 h-4" />
                  </Button>
                </div>

                {settings?.telegramChannelLink && (
                  <Button
                    variant="outline"
                    className="w-full border-slate-600/50 text-slate-300 hover:bg-slate-700/50 hover:border-purple-500/50 transition-all duration-300"
                    onClick={handleOpenChannel}
                    data-testid="button-telegram-channel"
                  >
                    <ExternalLink className="w-4 h-4 mr-2" />
                    {language === "ru" ? "Наш Telegram канал" : "Our Telegram Channel"}
                  </Button>
                )}

                <Button
                  variant="ghost"
                  className="w-full text-slate-500 hover:text-slate-300 hover:bg-white/5"
                  onClick={onClose}
                  data-testid="button-skip-welcome"
                >
                  {language === "ru" ? "Начать игру" : "Start Playing"}
                </Button>
              </div>
              
              <div className="mt-6 flex justify-center gap-2">
                {[...Array(5)].map((_, i) => (
                  <motion.div
                    key={i}
                    animate={{ 
                      opacity: [0.3, 1, 0.3],
                      scale: [0.8, 1, 0.8]
                    }}
                    transition={{ 
                      duration: 1.5, 
                      repeat: Infinity, 
                      delay: i * 0.2 
                    }}
                    className="w-2 h-2 rounded-full bg-gradient-to-r from-amber-400 to-amber-500"
                  />
                ))}
              </div>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
