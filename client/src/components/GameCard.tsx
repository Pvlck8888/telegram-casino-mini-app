import { type GameConfig, gameNamesRu, gameDescriptionsRu } from "@shared/schema";
import { useTelegram } from "./TelegramProvider";
import { useLanguage } from "./LanguageProvider";
import { Lock } from "lucide-react";

import crashImg from "@/assets/games/crash.png";
import blackjackImg from "@/assets/games/blackjack.png";
import minesImg from "@/assets/games/mines.png";
import diceImg from "@/assets/games/dice.png";
import slotImg from "@/assets/games/slot.png";
import scissorImg from "@/assets/games/scissor.png";
import turtleImg from "@/assets/games/turtle.png";
import pokerImg from "@assets/30C0D9DA-51CD-4072-813F-B9B0D74BB1B6_1764511789944.jpeg";
import aviamastersImg from "@assets/generated_images/red_biplane_game_asset.png";
import luxeImg from "@assets/IMG_7968_1765890210673.jpeg";
import egyptImg from "@assets/generated_images/egypt_slot_game_lobby_icon.png";
import minedropImg from "@assets/generated_images/minecraft_style_minedrop_game.png";

interface GameCardProps {
  game: GameConfig;
  onClick: () => void;
  globallyDisabled?: boolean;
}

const gameImages: Record<string, string> = {
  poker: pokerImg,
  aviamasters: aviamastersImg,
  crash: crashImg,
  blackjack: blackjackImg,
  mines: minesImg,
  dice: diceImg,
  slots: slotImg,
  scissors: scissorImg,
  turtle: turtleImg,
  luxe: luxeImg,
  egypt: egyptImg,
  minedrop: minedropImg,
};

export function GameCard({ game, onClick, globallyDisabled }: GameCardProps) {
  const { hapticFeedback } = useTelegram();
  const { language } = useLanguage();
  const gameImage = gameImages[game.id];
  const isDisabled = game.disabled === true || globallyDisabled === true;

  const handleClick = () => {
    if (isDisabled) {
      hapticFeedback("rigid");
      return;
    }
    hapticFeedback("medium");
    onClick();
  };

  return (
    <button
      onClick={handleClick}
      className={`w-full text-left bg-card border border-card-border rounded-2xl overflow-hidden transition-all group ${
        isDisabled 
          ? "opacity-60 cursor-not-allowed" 
          : "hover-elevate active-elevate-2 active:scale-[0.98]"
      }`}
      data-testid={`card-game-${game.id}`}
      disabled={isDisabled}
    >
      <div className="flex items-stretch">
        <div className={`relative w-28 h-28 flex-shrink-0 bg-gradient-to-br ${game.gradient} overflow-hidden`}>
          {gameImage ? (
            <img 
              src={gameImage} 
              alt={game.name}
              className={`w-full h-full object-cover transition-transform duration-300 ${
                isDisabled ? "grayscale" : "group-hover:scale-110"
              }`}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <span className="text-4xl font-bold text-white/50">{game.name[0]}</span>
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
          
          {isDisabled && (
            <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
              <div className="bg-black/70 rounded-full p-2">
                <Lock className="w-6 h-6 text-white" />
              </div>
            </div>
          )}
        </div>

        <div className="flex-1 p-4 flex flex-col justify-center">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-lg font-bold text-foreground">
              {language === "ru" ? gameNamesRu[game.id] : game.name}
            </h3>
            {isDisabled && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-500/20 text-yellow-500">
                {language === "ru" ? "Скоро" : "Soon"}
              </span>
            )}
          </div>
          <p className="text-sm text-muted-foreground mb-2 line-clamp-1">
            {language === "ru" ? gameDescriptionsRu[game.id] : game.description}
          </p>
          
          <div className="flex items-center gap-2">
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
              isDisabled ? "bg-muted text-muted-foreground" : "bg-primary/20 text-primary"
            }`}>
              ${game.minBet} - ${game.maxBet}
            </span>
          </div>
        </div>

        <div className="flex items-center pr-4">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
            isDisabled ? "bg-muted" : "bg-primary/10 group-hover:bg-primary/20"
          }`}>
            <svg className={`w-5 h-5 ${isDisabled ? "text-muted-foreground" : "text-primary"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </div>
        </div>
      </div>
    </button>
  );
}
