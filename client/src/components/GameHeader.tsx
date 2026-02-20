import { useEffect } from "react";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BalanceDisplay } from "./BalanceDisplay";
import { AudioControls } from "./AudioControls";
import { GameHelp } from "./GameHelp";
import { LanguageToggle, useLanguage } from "./LanguageProvider";
import { useTelegram } from "./TelegramProvider";
import { type GameType } from "./AudioProvider";
import { type GameType as SchemaGameType } from "@shared/schema";

interface GameHeaderProps {
  title: string;
  balance: number;
  starsBalance?: number;
  onBack: () => void;
  gameType?: GameType;
  schemaGameType?: SchemaGameType;
}

export function GameHeader({ title, balance, starsBalance = 0, onBack, gameType = "lobby", schemaGameType }: GameHeaderProps) {
  const { hapticFeedback, showBackButton, hideBackButton, isTelegram } = useTelegram();
  const { t } = useLanguage();

  useEffect(() => {
    if (isTelegram) {
      showBackButton(() => {
        hapticFeedback("light");
        onBack();
      });
    }
    
    return () => {
      if (isTelegram) {
        hideBackButton();
      }
    };
  }, [isTelegram, onBack, showBackButton, hideBackButton, hapticFeedback]);

  const handleBack = () => {
    hapticFeedback("light");
    onBack();
  };

  return (
    <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-lg border-b border-border">
      <div className="px-4 py-3 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          {!isTelegram && (
            <Button
              size="icon"
              variant="ghost"
              onClick={handleBack}
              data-testid="button-back"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
          )}
          <h1 className="text-lg font-semibold text-foreground">{title}</h1>
        </div>
        <div className="flex items-center gap-2">
          {schemaGameType && <GameHelp gameType={schemaGameType} />}
          <AudioControls gameType={gameType} />
          <LanguageToggle />
          <BalanceDisplay balance={balance} starsBalance={starsBalance} showToggle={false} />
        </div>
      </div>
    </header>
  );
}
