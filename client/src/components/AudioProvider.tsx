import { createContext, useContext, useCallback, useEffect, useRef, useState, type ReactNode } from "react";

type GameType = "crash" | "mines" | "dice" | "slots" | "scissors" | "turtle" | "blackjack" | "lobby" | "poker" | "aviamasters" | "luxe";

interface AudioSettings {
  musicEnabled: boolean;
  soundEnabled: boolean;
  musicVolume: number;
  soundVolume: number;
}

interface AudioContextType {
  settings: AudioSettings;
  currentGame: GameType;
  setCurrentGame: (game: GameType) => void;
  playSound: (soundName: keyof typeof SOUND_EFFECTS) => void;
  toggleMusic: () => void;
  toggleSound: () => void;
  setMusicVolume: (volume: number) => void;
  setSoundVolume: (volume: number) => void;
}

const GAME_MUSIC = "https://cdn.pixabay.com/download/audio/2021/11/25/audio_91b32e02f9.mp3";

const MUSIC_TRACKS: Record<GameType, string | null> = {
  lobby: GAME_MUSIC,
  crash: GAME_MUSIC,
  mines: GAME_MUSIC,
  dice: GAME_MUSIC,
  slots: GAME_MUSIC,
  scissors: GAME_MUSIC,
  turtle: GAME_MUSIC,
  blackjack: GAME_MUSIC,
  poker: null, // No music in poker - only sound effects
  aviamasters: GAME_MUSIC,
  luxe: GAME_MUSIC,
};

const SOUND_EFFECTS = {
  // General game sounds
  win: "https://cdn.pixabay.com/download/audio/2021/08/04/audio_0625c1539c.mp3",
  lose: "https://cdn.pixabay.com/download/audio/2022/03/10/audio_c8c8a73467.mp3",
  click: "https://cdn.pixabay.com/download/audio/2022/03/10/audio_29dc91c4ac.mp3",
  bet: "https://cdn.pixabay.com/download/audio/2022/03/15/audio_8cb2e85734.mp3",
  spin: "https://cdn.pixabay.com/download/audio/2021/08/04/audio_12b0c7443c.mp3",
  reveal: "https://cdn.pixabay.com/download/audio/2022/03/10/audio_29dc91c4ac.mp3",
  crash: "https://cdn.pixabay.com/download/audio/2022/03/10/audio_c8c8a73467.mp3",
  cashout: "https://cdn.pixabay.com/download/audio/2021/08/04/audio_0625c1539c.mp3",
  // Poker-specific sounds (clean casino sounds)
  cardDeal: "https://cdn.pixabay.com/download/audio/2022/03/24/audio_4b53310f64.mp3",
  cardFlip: "https://cdn.pixabay.com/download/audio/2022/03/24/audio_4b53310f64.mp3",
  chips: "https://cdn.pixabay.com/download/audio/2022/03/15/audio_8cb2e85734.mp3",
  chipStack: "https://cdn.pixabay.com/download/audio/2022/03/15/audio_8cb2e85734.mp3",
  check: "https://cdn.pixabay.com/download/audio/2022/03/10/audio_29dc91c4ac.mp3",
  fold: "https://cdn.pixabay.com/download/audio/2022/03/24/audio_4b53310f64.mp3",
  call: "https://cdn.pixabay.com/download/audio/2022/03/15/audio_8cb2e85734.mp3",
  raise: "https://cdn.pixabay.com/download/audio/2022/03/15/audio_8cb2e85734.mp3",
  allIn: "https://cdn.pixabay.com/download/audio/2021/08/04/audio_0625c1539c.mp3",
  yourTurn: "https://cdn.pixabay.com/download/audio/2022/03/10/audio_29dc91c4ac.mp3",
  timer: "https://cdn.pixabay.com/download/audio/2022/03/10/audio_29dc91c4ac.mp3",
  shuffle: "https://cdn.pixabay.com/download/audio/2022/03/24/audio_4b53310f64.mp3",
  // The Luxe slot-specific premium sounds (local Mixkit casino sounds)
  luxeSpin: "/sounds/spin.mp3",
  luxeReelStop: "/sounds/reelstop.mp3",
  luxeWin: "/sounds/win.mp3",
  luxeBigWin: "/sounds/bigwin.mp3",
  luxeJackpot: "/sounds/jackpot.mp3",
  luxeBonus: "/sounds/bonus.mp3",
  luxeCoinDrop: "/sounds/coins.mp3",
  luxeMultiplier: "/sounds/multiplier.mp3",
  // Minedrop sounds
  blockBreak: "https://cdn.pixabay.com/download/audio/2022/03/10/audio_c8c8a73467.mp3",
  blockHit: "https://cdn.pixabay.com/download/audio/2022/03/15/audio_8cb2e85734.mp3",
};

const DEFAULT_SETTINGS: AudioSettings = {
  musicEnabled: false,
  soundEnabled: true,
  musicVolume: 0.3,
  soundVolume: 0.5,
};

const AudioContext = createContext<AudioContextType | null>(null);

export function AudioProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<AudioSettings>(() => {
    if (typeof window === "undefined") return DEFAULT_SETTINGS;
    try {
      const saved = localStorage.getItem("gameAudioSettings");
      return saved ? JSON.parse(saved) : DEFAULT_SETTINGS;
    } catch {
      return DEFAULT_SETTINGS;
    }
  });

  const [currentGame, setCurrentGame] = useState<GameType>("lobby");
  const musicRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem("gameAudioSettings", JSON.stringify(settings));
  }, [settings]);

  useEffect(() => {
    // Stop music if disabled or if current game has no music (like poker)
    const trackUrl = MUSIC_TRACKS[currentGame];
    if (!settings.musicEnabled || !trackUrl) {
      if (musicRef.current) {
        musicRef.current.pause();
        musicRef.current = null;
      }
      return;
    }

    const playMusic = async () => {
      try {
        if (musicRef.current) {
          musicRef.current.pause();
        }

        const audio = new Audio(trackUrl);
        audio.loop = true;
        audio.volume = settings.musicVolume;
        musicRef.current = audio;

        await audio.play().catch(() => {
          console.log("Music autoplay blocked");
        });
      } catch (error) {
        console.log("Failed to play music:", error);
      }
    };

    playMusic();

    return () => {
      if (musicRef.current) {
        musicRef.current.pause();
        musicRef.current = null;
      }
    };
  }, [currentGame, settings.musicEnabled, settings.musicVolume]);

  const playSound = useCallback(
    (soundName: keyof typeof SOUND_EFFECTS) => {
      if (!settings.soundEnabled) return;

      try {
        const audio = new Audio(SOUND_EFFECTS[soundName]);
        audio.volume = settings.soundVolume;
        audio.play().catch(() => {});
      } catch (error) {
        console.log("Failed to play sound:", error);
      }
    },
    [settings.soundEnabled, settings.soundVolume]
  );

  const toggleMusic = useCallback(() => {
    setSettings((prev) => ({ ...prev, musicEnabled: !prev.musicEnabled }));
  }, []);

  const toggleSound = useCallback(() => {
    setSettings((prev) => ({ ...prev, soundEnabled: !prev.soundEnabled }));
  }, []);

  const setMusicVolume = useCallback((volume: number) => {
    setSettings((prev) => ({ ...prev, musicVolume: volume }));
    if (musicRef.current) {
      musicRef.current.volume = volume;
    }
  }, []);

  const setSoundVolume = useCallback((volume: number) => {
    setSettings((prev) => ({ ...prev, soundVolume: volume }));
  }, []);

  return (
    <AudioContext.Provider
      value={{
        settings,
        currentGame,
        setCurrentGame,
        playSound,
        toggleMusic,
        toggleSound,
        setMusicVolume,
        setSoundVolume,
      }}
    >
      {children}
    </AudioContext.Provider>
  );
}

export function useAudio() {
  const context = useContext(AudioContext);
  if (!context) {
    throw new Error("useAudio must be used within AudioProvider");
  }
  return context;
}

export type { GameType, AudioSettings };
export { SOUND_EFFECTS };
