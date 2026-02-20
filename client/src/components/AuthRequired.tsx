import { motion } from "framer-motion";
import { AlertCircle, Smartphone } from "lucide-react";
import { useLanguage } from "./LanguageProvider";

export function AuthRequired() {
  const { language } = useLanguage();
  
  const handleOpenBot = () => {
    window.open("https://t.me/gomoneygod_bot", "_blank");
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-sm w-full text-center"
      >
        <motion.div
          initial={{ scale: 0.8 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.2 }}
          className="w-20 h-20 mx-auto mb-6 rounded-full bg-gradient-to-br from-red-500 to-orange-500 flex items-center justify-center shadow-lg shadow-red-500/30"
        >
          <AlertCircle className="w-10 h-10 text-white" />
        </motion.div>

        <motion.h1
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="text-2xl font-black text-white mb-3"
        >
          {language === "ru" ? "Требуется авторизация" : "Authentication Required"}
        </motion.h1>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="text-gray-400 mb-8"
        >
          {language === "ru" 
            ? "Для доступа к казино необходимо открыть приложение через Telegram бота."
            : "To access the casino, please open the app through the Telegram bot."}
        </motion.p>

        <motion.button
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={handleOpenBot}
          className="w-full py-4 px-6 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-400 hover:to-cyan-400 text-white font-bold rounded-xl shadow-lg shadow-blue-500/30 flex items-center justify-center gap-3"
          data-testid="button-open-telegram"
        >
          <Smartphone className="w-5 h-5" />
          {language === "ru" ? "Открыть в Telegram" : "Open in Telegram"}
        </motion.button>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="text-xs text-gray-500 mt-6"
        >
          {language === "ru" 
            ? "Нажмите кнопку выше, чтобы перейти к боту @gomoneygod_bot"
            : "Click the button above to open @gomoneygod_bot"}
        </motion.p>
      </motion.div>
    </div>
  );
}
