import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLanguage } from "@/components/LanguageProvider";
import { Zap } from "lucide-react";

import pokerBanner from "../assets/promo/poker-banner.png";
import crashBanner from "../assets/promo/crash-banner.png";
import jackpotBanner from "../assets/promo/jackpot-banner.png";
import bonusBanner from "../assets/promo/bonus-banner.png";
import cashbackBanner from "../assets/promo/cashback-banner.png";
import vipBanner from "../assets/promo/vip-banner.png";

import type { GameType } from "@shared/schema";

interface PromoSlide {
  id: string;
  gameType?: GameType;
  title: { en: string; ru: string };
  subtitle: { en: string; ru: string };
  cta: { en: string; ru: string };
  image: string;
  overlayGradient: string;
  accentColor: string;
}

interface PromoSlideshowProps {
  onSelectGame?: (gameId: GameType) => void;
}

const promoSlides: PromoSlide[] = [
  {
    id: "poker",
    gameType: "poker",
    title: { en: "POKER TABLES", ru: "ПОКЕР СТОЛЫ" },
    subtitle: { en: "Live tournaments • Real players • Big pots", ru: "Живые турниры • Реальные игроки • Большие банки" },
    cta: { en: "PLAY NOW", ru: "ИГРАТЬ" },
    image: pokerBanner,
    overlayGradient: "from-emerald-900/80 via-emerald-900/40 to-transparent",
    accentColor: "text-emerald-300",
  },
  {
    id: "crash",
    gameType: "crash",
    title: { en: "CRASH X1000", ru: "CRASH X1000" },
    subtitle: { en: "Catch the multiplier before it crashes!", ru: "Поймай множитель пока не упал!" },
    cta: { en: "TRY LUCK", ru: "ИСПЫТАТЬ УДАЧУ" },
    image: crashBanner,
    overlayGradient: "from-orange-900/80 via-red-900/40 to-transparent",
    accentColor: "text-orange-300",
  },
  {
    id: "slots",
    gameType: "luxe",
    title: { en: "MEGA JACKPOT", ru: "МЕГА ДЖЕКПОТ" },
    subtitle: { en: "$50,000+ progressive jackpot waiting!", ru: "Прогрессивный джекпот $50,000+ ждёт!" },
    cta: { en: "SPIN NOW", ru: "КРУТИТЬ" },
    image: jackpotBanner,
    overlayGradient: "from-purple-900/80 via-violet-900/40 to-transparent",
    accentColor: "text-purple-300",
  },
  {
    id: "bonus",
    gameType: "dice",
    title: { en: "DAILY BONUS", ru: "ЕЖЕДНЕВНЫЙ БОНУС" },
    subtitle: { en: "Spin the wheel every day for free rewards", ru: "Крути колесо каждый день за бесплатные призы" },
    cta: { en: "CLAIM FREE", ru: "ЗАБРАТЬ" },
    image: bonusBanner,
    overlayGradient: "from-amber-900/80 via-yellow-900/40 to-transparent",
    accentColor: "text-yellow-200",
  },
  {
    id: "cashback",
    gameType: "blackjack",
    title: { en: "35% CASHBACK", ru: "35% КЭШБЕК" },
    subtitle: { en: "Get back 35% of your losses every week", ru: "Возврат 35% от проигрыша каждую неделю" },
    cta: { en: "LEARN MORE", ru: "ПОДРОБНЕЕ" },
    image: cashbackBanner,
    overlayGradient: "from-cyan-900/80 via-teal-900/40 to-transparent",
    accentColor: "text-cyan-300",
  },
  {
    id: "vip",
    gameType: "mines",
    title: { en: "VIP REWARDS", ru: "VIP НАГРАДЫ" },
    subtitle: { en: "Exclusive bonuses for loyal players", ru: "Эксклюзивные бонусы для лояльных игроков" },
    cta: { en: "JOIN VIP", ru: "СТАТЬ VIP" },
    image: vipBanner,
    overlayGradient: "from-pink-900/80 via-rose-900/40 to-transparent",
    accentColor: "text-pink-300",
  },
];

export function PromoSlideshow({ onSelectGame }: PromoSlideshowProps) {
  const { language } = useLanguage();
  const lang = language === "ru" ? "ru" : "en";
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isAutoPlaying, setIsAutoPlaying] = useState(true);

  const handleSlideClick = useCallback(() => {
    const currentSlide = promoSlides[currentIndex];
    if (currentSlide.gameType && onSelectGame) {
      onSelectGame(currentSlide.gameType);
    }
  }, [currentIndex, onSelectGame]);

  const nextSlide = useCallback(() => {
    setCurrentIndex((prev) => (prev + 1) % promoSlides.length);
  }, []);

  const prevSlide = useCallback(() => {
    setCurrentIndex((prev) => (prev - 1 + promoSlides.length) % promoSlides.length);
  }, []);

  const goToSlide = useCallback((index: number) => {
    setCurrentIndex(index);
    setIsAutoPlaying(false);
    setTimeout(() => setIsAutoPlaying(true), 5000);
  }, []);

  useEffect(() => {
    if (!isAutoPlaying) return;
    const interval = setInterval(nextSlide, 4000);
    return () => clearInterval(interval);
  }, [isAutoPlaying, nextSlide]);

  const currentSlide = promoSlides[currentIndex];

  return (
    <div 
      className="relative w-full rounded-xl overflow-hidden shadow-2xl"
      data-testid="promo-slideshow"
      onMouseEnter={() => setIsAutoPlaying(false)}
      onMouseLeave={() => setIsAutoPlaying(true)}
    >
      <AnimatePresence mode="wait">
        <motion.div
          key={currentSlide.id}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5, ease: "easeInOut" }}
          className="relative h-[180px] md:h-[220px]"
        >
          <motion.img
            src={currentSlide.image}
            alt={currentSlide.title.en}
            className="absolute inset-0 w-full h-full object-cover"
            initial={{ scale: 1.1 }}
            animate={{ scale: 1 }}
            transition={{ duration: 6, ease: "easeOut" }}
          />
          
          <div className={`absolute inset-0 bg-gradient-to-r ${currentSlide.overlayGradient}`} />
          
          <motion.div 
            className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          />
          
          <div className="absolute inset-0 p-4 md:p-6 flex flex-col justify-end">
            <motion.div
              initial={{ y: 30, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.1, duration: 0.5 }}
              className="flex items-center gap-2 mb-1"
            >
              <motion.div
                animate={{ rotate: [0, 15, -15, 0] }}
                transition={{ duration: 0.5, repeat: Infinity, repeatDelay: 2 }}
              >
                <Zap className={`w-4 h-4 ${currentSlide.accentColor}`} />
              </motion.div>
              <span className={`text-xs font-bold uppercase tracking-wider ${currentSlide.accentColor}`}>
                {lang === "ru" ? "Горячее предложение" : "Hot Offer"}
              </span>
            </motion.div>
            
            <motion.h2
              initial={{ y: 30, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.2, duration: 0.5 }}
              className="text-2xl md:text-3xl font-black text-white mb-1 tracking-tight drop-shadow-lg"
            >
              {currentSlide.title[lang]}
            </motion.h2>
            
            <motion.p
              initial={{ y: 30, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.3, duration: 0.5 }}
              className="text-sm md:text-base text-white/90 mb-3 max-w-[300px] drop-shadow"
            >
              {currentSlide.subtitle[lang]}
            </motion.p>
            
            <motion.button
              initial={{ y: 30, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.4, duration: 0.5 }}
              whileHover={{ scale: 1.05, boxShadow: "0 0 20px rgba(255,255,255,0.3)" }}
              whileTap={{ scale: 0.95 }}
              onClick={handleSlideClick}
              className="w-fit px-5 py-2.5 bg-white text-gray-900 font-bold text-sm rounded-lg shadow-xl hover:bg-gray-100 transition-colors"
              data-testid={`promo-cta-${currentSlide.id}`}
            >
              {currentSlide.cta[lang]}
            </motion.button>
          </div>
          
          <motion.div
            className="absolute top-0 left-0 w-full h-1 bg-white/20"
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ duration: 4, ease: "linear" }}
            style={{ transformOrigin: "left" }}
          />
        </motion.div>
      </AnimatePresence>
      
      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-2 z-20">
        {promoSlides.map((slide, index) => (
          <button
            key={slide.id}
            onClick={() => goToSlide(index)}
            className={`h-2 rounded-full transition-all duration-300 ${
              index === currentIndex 
                ? "bg-white w-8 shadow-lg" 
                : "bg-white/40 w-2 hover:bg-white/60"
            }`}
            data-testid={`promo-dot-${index}`}
          />
        ))}
      </div>
    </div>
  );
}
