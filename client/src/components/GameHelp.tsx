import { useState } from "react";
import { HelpCircle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/components/LanguageProvider";
import type { GameType } from "@shared/schema";

interface GameHelpProps {
  gameType: GameType;
}

interface GameInstructions {
  title: { ru: string; en: string };
  rules: { ru: string[]; en: string[] };
  tips: { ru: string[]; en: string[] };
}

const gameInstructions: Record<GameType, GameInstructions> = {
  crash: {
    title: { ru: "Краш", en: "Crash" },
    rules: {
      ru: [
        "1. Сделайте ставку до начала раунда",
        "2. Множитель начинает расти с 1.00x",
        "3. Заберите выигрыш до того, как множитель крашнется",
        "4. Если не успеете забрать - потеряете ставку",
        "5. Максимальный множитель: 1000x"
      ],
      en: [
        "1. Place your bet before the round starts",
        "2. Multiplier starts growing from 1.00x",
        "3. Cash out before the multiplier crashes",
        "4. If you don't cash out in time - you lose your bet",
        "5. Maximum multiplier: 1000x"
      ]
    },
    tips: {
      ru: ["Не будьте слишком жадными", "Установите целевой множитель заранее"],
      en: ["Don't be too greedy", "Set a target multiplier in advance"]
    }
  },
  blackjack: {
    title: { ru: "Блэкджек", en: "Blackjack" },
    rules: {
      ru: [
        "1. Цель: набрать 21 или ближе к 21, чем дилер",
        "2. Карты 2-10 = номинал, J/Q/K = 10, A = 1 или 11",
        "3. 'Ещё' - взять ещё карту",
        "4. 'Хватит' - остановиться",
        "5. 'Удвоить' - удвоить ставку и взять одну карту",
        "6. Перебор (больше 21) = проигрыш"
      ],
      en: [
        "1. Goal: get 21 or closer to 21 than the dealer",
        "2. Cards 2-10 = face value, J/Q/K = 10, A = 1 or 11",
        "3. 'Hit' - take another card",
        "4. 'Stand' - stop taking cards",
        "5. 'Double' - double bet and take one card",
        "6. Bust (over 21) = lose"
      ]
    },
    tips: {
      ru: ["Удваивайте при 10-11 против слабой карты дилера", "Стойте при 17+"],
      en: ["Double on 10-11 against dealer's weak card", "Stand on 17+"]
    }
  },
  mines: {
    title: { ru: "Мины", en: "Mines" },
    rules: {
      ru: [
        "1. Выберите количество мин (1-24)",
        "2. Кликайте на ячейки, чтобы открыть алмазы",
        "3. Найдите алмаз - множитель растёт",
        "4. Найдите мину - игра окончена",
        "5. Заберите выигрыш в любой момент"
      ],
      en: [
        "1. Select number of mines (1-24)",
        "2. Click cells to reveal gems",
        "3. Find a gem - multiplier increases",
        "4. Hit a mine - game over",
        "5. Cash out anytime"
      ]
    },
    tips: {
      ru: ["Больше мин = выше множитель, но выше риск", "Забирайте выигрыш вовремя"],
      en: ["More mines = higher multiplier, but higher risk", "Cash out at the right time"]
    }
  },
  dice: {
    title: { ru: "Кости", en: "Dice" },
    rules: {
      ru: [
        "1. Установите целевое число (1-99)",
        "2. Выберите 'Больше' или 'Меньше'",
        "3. Бросьте кости (результат 1-100)",
        "4. Если угадали - выигрыш по множителю",
        "5. Чем ниже шанс - тем выше множитель"
      ],
      en: [
        "1. Set target number (1-99)",
        "2. Choose 'Over' or 'Under'",
        "3. Roll the dice (result 1-100)",
        "4. If correct - win with multiplier",
        "5. Lower chance = higher multiplier"
      ]
    },
    tips: {
      ru: ["50% шанс = 2x множитель", "Экспериментируйте с разными целями"],
      en: ["50% chance = 2x multiplier", "Experiment with different targets"]
    }
  },
  slots: {
    title: { ru: "Слоты", en: "Slots" },
    rules: {
      ru: [
        "1. Сделайте ставку",
        "2. Нажмите 'Крутить'",
        "3. 5 барабанов, 3 ряда, 9 линий выплат",
        "4. 3+ одинаковых символа на линии = выигрыш",
        "5. WILD заменяет любой символ",
        "6. Множители зависят от символа"
      ],
      en: [
        "1. Place your bet",
        "2. Press 'Spin'",
        "3. 5 reels, 3 rows, 9 paylines",
        "4. 3+ matching symbols on a line = win",
        "5. WILD substitutes any symbol",
        "6. Multipliers depend on symbol"
      ]
    },
    tips: {
      ru: ["Следите за линиями выплат", "Викинг и корабль дают лучшие выплаты"],
      en: ["Watch the paylines", "Viking and Ship give best payouts"]
    }
  },
  scissors: {
    title: { ru: "Камень-Ножницы-Бумага", en: "Rock Paper Scissors" },
    rules: {
      ru: [
        "1. Сделайте ставку",
        "2. Выберите Камень, Ножницы или Бумагу",
        "3. Компьютер делает свой выбор",
        "4. Камень бьёт Ножницы",
        "5. Ножницы бьют Бумагу",
        "6. Бумага бьёт Камень",
        "7. Победа = 2x ставки, Ничья = возврат"
      ],
      en: [
        "1. Place your bet",
        "2. Choose Rock, Paper or Scissors",
        "3. Computer makes its choice",
        "4. Rock beats Scissors",
        "5. Scissors beats Paper",
        "6. Paper beats Rock",
        "7. Win = 2x bet, Draw = bet returned"
      ]
    },
    tips: {
      ru: ["Шанс победы 33%", "Классическая игра на удачу"],
      en: ["33% chance to win", "Classic game of chance"]
    }
  },
  turtle: {
    title: { ru: "Черепашьи гонки", en: "Turtle Race" },
    rules: {
      ru: [
        "1. Сделайте ставку",
        "2. Выберите черепаху (Красная, Синяя, Жёлтая)",
        "3. Начните гонку",
        "4. Черепахи бегут с разной скоростью",
        "5. Если ваша черепаха победит = 3x ставки"
      ],
      en: [
        "1. Place your bet",
        "2. Choose a turtle (Red, Blue, Yellow)",
        "3. Start the race",
        "4. Turtles run at different speeds",
        "5. If your turtle wins = 3x bet"
      ]
    },
    tips: {
      ru: ["Шанс победы ~33%", "Множитель 3x за угаданную черепаху"],
      en: ["~33% chance to win", "3x multiplier for correct turtle"]
    }
  },
  poker: {
    title: { ru: "Покер", en: "Poker" },
    rules: {
      ru: [
        "1. Texas Hold'em No-Limit",
        "2. Каждому игроку раздаётся 2 карты",
        "3. 5 общих карт на столе",
        "4. Составьте лучшую комбинацию из 5 карт",
        "5. Ставки: Чек, Колл, Рейз, Фолд"
      ],
      en: [
        "1. Texas Hold'em No-Limit",
        "2. Each player gets 2 cards",
        "3. 5 community cards on the table",
        "4. Make the best 5-card hand",
        "5. Actions: Check, Call, Raise, Fold"
      ]
    },
    tips: {
      ru: ["Скоро будет доступно", "Следите за обновлениями"],
      en: ["Coming soon", "Stay tuned for updates"]
    }
  }
};

export function GameHelp({ gameType }: GameHelpProps) {
  const [isOpen, setIsOpen] = useState(false);
  const { language, t } = useLanguage();
  
  const instructions = gameInstructions[gameType];
  if (!instructions) return null;

  return (
    <>
      <Button
        size="icon"
        variant="ghost"
        className="w-8 h-8 rounded-full bg-black/40 border border-emerald-500/30 hover:bg-black/60"
        onClick={() => setIsOpen(true)}
        data-testid="button-game-help"
      >
        <HelpCircle className="w-4 h-4 text-emerald-400" />
      </Button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-md bg-gray-900 border border-emerald-500/30 rounded-2xl p-4 max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-emerald-400">
                {instructions.title[language]}
              </h2>
              <Button
                size="icon"
                variant="ghost"
                className="w-8 h-8"
                onClick={() => setIsOpen(false)}
                data-testid="button-close-help"
              >
                <X className="w-5 h-5" />
              </Button>
            </div>

            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-semibold text-white/60 mb-2">
                  {t("rules")}
                </h3>
                <ul className="space-y-1.5">
                  {instructions.rules[language].map((rule, index) => (
                    <li key={index} className="text-sm text-white/80">
                      {rule}
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-emerald-400/80 mb-2">
                  💡 {language === "ru" ? "Советы" : "Tips"}
                </h3>
                <ul className="space-y-1">
                  {instructions.tips[language].map((tip, index) => (
                    <li key={index} className="text-sm text-white/60">
                      • {tip}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <Button
              className="w-full mt-4 bg-emerald-500 hover:bg-emerald-600"
              onClick={() => setIsOpen(false)}
              data-testid="button-understand"
            >
              {t("close")}
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
