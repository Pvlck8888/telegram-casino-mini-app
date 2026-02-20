import { useState, useRef, useEffect, useCallback } from "react";
import { GameHeader } from "@/components/GameHeader";
import { useTelegram } from "@/components/TelegramProvider";
import { useToast } from "@/hooks/use-toast";
import { useAudio } from "@/components/AudioProvider";
import { Info, RotateCcw, Zap, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

import enderEyeImg from "@assets/generated_images/ender_eye_scatter_symbol.png";

interface MinedropGameProps {
  balance: number;
  onBalanceChange: (newBalance: number) => void;
  onBack: () => void;
}

interface Block {
  type: number;
  durability: number;
  maxDurability: number;
  broken: boolean;
}

interface ChestMultiplier {
  col: number;
  multiplier: number;
}

const BLOCK_NAMES = ["Grass", "Dirt", "Stone", "Ruby Ore", "Gold", "Diamond"];
const BLOCK_PAYOUTS = [0, 0.1, 0.5, 1, 3, 5];
const BLOCK_DURABILITY = [1, 2, 3, 4, 5, 6];

const PICKAXE_NAMES = ["Wooden", "Stone", "Gold", "Diamond"];
const PICKAXE_HITS = [1, 2, 3, 5];

const BET_AMOUNTS = [0.10, 0.20, 0.50, 1.00, 2.00, 5.00, 10.00, 20.00, 50.00, 100.00];

const MinecraftPickaxe = ({ type, size = 48 }: { type: number; size?: number }) => {
  const headColors = ["#8B6914", "#7a7a7a", "#FFCC00", "#5DCEDB"];
  const handleColors = ["#6b4423", "#5a4a3a", "#6b4423", "#6b4423"];
  
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" style={{ imageRendering: "pixelated" }}>
      <rect x="7" y="9" width="2" height="6" fill={handleColors[type]} />
      <rect x="8" y="10" width="1" height="4" fill="#4a3218" />
      <rect x="3" y="2" width="10" height="5" fill={headColors[type]} />
      <rect x="2" y="3" width="2" height="3" fill={headColors[type]} />
      <rect x="12" y="3" width="2" height="3" fill={headColors[type]} />
      <rect x="4" y="2" width="8" height="1" fill="#fff" opacity="0.3" />
      <rect x="3" y="3" width="1" height="2" fill="#fff" opacity="0.2" />
      <rect x="4" y="6" width="8" height="1" fill="#000" opacity="0.2" />
    </svg>
  );
};

const MinecraftBlock = ({ type, durability, maxDurability, size = 48, broken, isHit }: { 
  type: number; 
  durability: number; 
  maxDurability: number;
  size?: number;
  broken?: boolean;
  isHit?: boolean;
}) => {
  if (broken) {
    return <div style={{ width: size, height: size }} className="bg-transparent" />;
  }

  const damage = 1 - (durability / maxDurability);
  
  return (
    <motion.div
      style={{ width: size, height: size }}
      className="relative"
      animate={isHit ? { scale: [1, 0.8, 1], rotate: [0, -2, 2, 0] } : {}}
      transition={{ duration: 0.25, ease: "easeOut" }}
    >
      <svg width={size} height={size} viewBox="0 0 16 16" style={{ imageRendering: "pixelated" }}>
        {type === 0 && (
          <>
            <rect x="0" y="0" width="16" height="4" fill="#5D8C3E" />
            <rect x="0" y="4" width="16" height="12" fill="#8B5A2B" />
            <rect x="0" y="0" width="16" height="1" fill="#7CB950" />
            <rect x="2" y="1" width="2" height="2" fill="#4a7030" />
            <rect x="8" y="2" width="3" height="1" fill="#4a7030" />
            <rect x="12" y="1" width="2" height="2" fill="#4a7030" />
            <rect x="1" y="6" width="2" height="2" fill="#6B4423" />
            <rect x="10" y="8" width="3" height="2" fill="#6B4423" />
          </>
        )}
        {type === 1 && (
          <>
            <rect x="0" y="0" width="16" height="16" fill="#8B5A2B" />
            <rect x="0" y="0" width="16" height="1" fill="#A0724B" />
            <rect x="0" y="0" width="1" height="16" fill="#A0724B" opacity="0.5" />
            <rect x="2" y="3" width="3" height="3" fill="#6B4423" />
            <rect x="9" y="2" width="4" height="2" fill="#6B4423" />
            <rect x="4" y="8" width="3" height="3" fill="#6B4423" />
            <rect x="11" y="10" width="3" height="3" fill="#6B4423" />
            <rect x="1" y="12" width="2" height="2" fill="#6B4423" />
          </>
        )}
        {type === 2 && (
          <>
            <rect x="0" y="0" width="16" height="16" fill="#808080" />
            <rect x="0" y="0" width="16" height="1" fill="#a0a0a0" />
            <rect x="0" y="0" width="1" height="16" fill="#a0a0a0" opacity="0.5" />
            <rect x="2" y="2" width="3" height="3" fill="#606060" />
            <rect x="10" y="4" width="4" height="3" fill="#606060" />
            <rect x="5" y="9" width="4" height="3" fill="#606060" />
            <rect x="12" y="11" width="3" height="3" fill="#606060" />
          </>
        )}
        {type === 3 && (
          <>
            <rect x="0" y="0" width="16" height="16" fill="#808080" />
            <rect x="0" y="0" width="16" height="1" fill="#a0a0a0" />
            <rect x="3" y="3" width="4" height="4" fill="#CC3333" />
            <rect x="4" y="4" width="2" height="2" fill="#FF6666" />
            <rect x="9" y="8" width="4" height="4" fill="#CC3333" />
            <rect x="10" y="9" width="2" height="2" fill="#FF6666" />
            <rect x="2" y="10" width="3" height="3" fill="#CC3333" />
            <rect x="11" y="2" width="3" height="3" fill="#CC3333" />
          </>
        )}
        {type === 4 && (
          <>
            <rect x="0" y="0" width="16" height="16" fill="#FFCC00" />
            <rect x="0" y="0" width="16" height="1" fill="#FFE066" />
            <rect x="0" y="0" width="1" height="16" fill="#FFE066" opacity="0.5" />
            <rect x="2" y="2" width="4" height="4" fill="#DAA520" />
            <rect x="10" y="3" width="4" height="4" fill="#DAA520" />
            <rect x="5" y="9" width="5" height="4" fill="#DAA520" />
            <rect x="3" y="3" width="2" height="2" fill="#FFE066" />
            <rect x="11" y="4" width="2" height="2" fill="#FFE066" />
          </>
        )}
        {type === 5 && (
          <>
            <rect x="0" y="0" width="16" height="16" fill="#4DD0E1" />
            <rect x="0" y="0" width="16" height="1" fill="#80DEEA" />
            <rect x="0" y="0" width="1" height="16" fill="#80DEEA" opacity="0.5" />
            <rect x="2" y="2" width="4" height="4" fill="#26C6DA" />
            <rect x="10" y="4" width="4" height="4" fill="#26C6DA" />
            <rect x="5" y="9" width="5" height="4" fill="#26C6DA" />
            <rect x="3" y="3" width="2" height="2" fill="#B2EBF2" />
            <rect x="11" y="5" width="2" height="2" fill="#B2EBF2" />
          </>
        )}
      </svg>
      
      {damage > 0 && (
        <svg className="absolute inset-0 w-full h-full" viewBox="0 0 16 16" style={{ imageRendering: "pixelated" }}>
          {damage >= 0.2 && <path d="M4 2 L6 5 L4 8" stroke="#1a1a1a" strokeWidth="1" fill="none" />}
          {damage >= 0.4 && <path d="M12 3 L10 6 L12 9" stroke="#1a1a1a" strokeWidth="1" fill="none" />}
          {damage >= 0.6 && <path d="M8 1 L6 4 L8 7 L6 10" stroke="#1a1a1a" strokeWidth="1" fill="none" />}
          {damage >= 0.8 && (
            <>
              <path d="M2 10 L4 13 L2 15" stroke="#1a1a1a" strokeWidth="1" fill="none" />
              <path d="M14 8 L12 11 L14 14" stroke="#1a1a1a" strokeWidth="1" fill="none" />
            </>
          )}
        </svg>
      )}
    </motion.div>
  );
};

const TNTBlock = ({ size = 48 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" style={{ imageRendering: "pixelated" }}>
    <rect x="0" y="0" width="16" height="16" fill="#CC0000" />
    <rect x="0" y="0" width="16" height="1" fill="#FF3333" />
    <rect x="1" y="0" width="1" height="16" fill="#FF3333" opacity="0.3" />
    <rect x="2" y="5" width="12" height="6" fill="#fff" />
    <text x="8" y="10" textAnchor="middle" fontSize="5" fontWeight="bold" fontFamily="monospace" fill="#CC0000">TNT</text>
    <rect x="7" y="0" width="2" height="2" fill="#333" />
    <rect x="6" y="0" width="4" height="1" fill="#FF6600" />
  </svg>
);

const SpellbookSymbol = ({ size = 48 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" style={{ imageRendering: "pixelated" }}>
    <rect x="2" y="1" width="12" height="14" fill="#6B238E" />
    <rect x="3" y="2" width="10" height="12" fill="#8B3AAE" />
    <rect x="4" y="3" width="8" height="10" fill="#4B0082" />
    <rect x="6" y="5" width="4" height="1" fill="#FFD700" />
    <rect x="5" y="7" width="6" height="1" fill="#FFD700" />
    <rect x="6" y="9" width="4" height="1" fill="#FFD700" />
    <rect x="7" y="4" width="2" height="1" fill="#FF00FF" />
    <rect x="7" y="11" width="2" height="1" fill="#FF00FF" />
  </svg>
);

const TreasureChest = ({ multiplier, revealed, size = 48 }: { multiplier?: number; revealed: boolean; size?: number }) => (
  <motion.div animate={revealed ? { y: [0, -5, 0] } : {}} transition={{ duration: 0.3 }}>
    <svg width={size} height={size * 0.75} viewBox="0 0 16 12" style={{ imageRendering: "pixelated" }}>
      <rect x="1" y="4" width="14" height="7" fill={revealed ? "#DAA520" : "#8B4513"} />
      <rect x="2" y="5" width="12" height="5" fill={revealed ? "#FFD700" : "#A0522D"} />
      <rect x="0" y="3" width="16" height="2" fill={revealed ? "#B8860B" : "#654321"} />
      <rect x="6" y="2" width="4" height="3" fill={revealed ? "#C0C0C0" : "#808080"} />
      <rect x="7" y="3" width="2" height="2" fill={revealed ? "#FFD700" : "#696969"} />
      {revealed && multiplier && (
        <text x="8" y="9" textAnchor="middle" fontSize="4" fontWeight="bold" fill="#000">x{multiplier}</text>
      )}
    </svg>
  </motion.div>
);

const CloudSVG = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 100 40" style={{ filter: "drop-shadow(2px 2px 4px rgba(0,0,0,0.1))" }}>
    <ellipse cx="30" cy="25" rx="25" ry="12" fill="white" />
    <ellipse cx="55" cy="22" rx="20" ry="15" fill="white" />
    <ellipse cx="75" cy="26" rx="18" ry="10" fill="white" />
    <ellipse cx="45" cy="28" rx="22" ry="10" fill="white" />
  </svg>
);

export function MinedropGame({ balance, onBalanceChange, onBack }: MinedropGameProps) {
  const { user, hapticFeedback } = useTelegram();
  const { toast } = useToast();
  const { playSound, setCurrentGame } = useAudio();

  const [betIndex, setBetIndex] = useState(3);
  const [isSpinning, setIsSpinning] = useState(false);
  const [lastWin, setLastWin] = useState(0);
  const [showPaytable, setShowPaytable] = useState(false);
  const [showBonusBuy, setShowBonusBuy] = useState(false);
  const [freeSpins, setFreeSpins] = useState(0);
  const [freeSpinWins, setFreeSpinWins] = useState(0);
  const [autoSpin, setAutoSpin] = useState(false);
  const [extraChance, setExtraChance] = useState(false);
  const [showBonusModal, setShowBonusModal] = useState(false);
  const [pendingBonus, setPendingBonus] = useState<{ freeSpins: number; scatterCount: number } | null>(null);
  const [isFreeSpinAutoPlay, setIsFreeSpinAutoPlay] = useState(false);
  const [showTotalWinModal, setShowTotalWinModal] = useState(false);
  const [finalTotalWin, setFinalTotalWin] = useState(0);
  const [freeSpinBlockStats, setFreeSpinBlockStats] = useState<{[blockType: number]: {count: number; payout: number}}>({});
  const autoSpinRef = useRef(false);
  const freeSpinAutoRef = useRef(false);
  
  const [topReel, setTopReel] = useState<number[][]>([
    [7, 7, 7, 7, 7],
    [7, 7, 7, 7, 7],
    [7, 7, 7, 7, 7],
  ]);
  
  const [blockGrid, setBlockGrid] = useState<Block[][]>(() => initializeGrid());
  const [animatingHits, setAnimatingHits] = useState<Set<string>>(new Set());
  const [chestMultipliers, setChestMultipliers] = useState<ChestMultiplier[]>([]);
  const [activeColumn, setActiveColumn] = useState<number | null>(null);
  const [droppingPickaxes, setDroppingPickaxes] = useState<{col: number; row: number; type: number}[]>([]);
  const [winBreakdown, setWinBreakdown] = useState<{col: number; amount: number}[]>([]);
  const persistentGridRef = useRef<Block[][] | null>(null);

  const bet = BET_AMOUNTS[betIndex];
  const actualBet = extraChance ? bet * 3 : bet;

  function initializeGrid(): Block[][] {
    const grid: Block[][] = [];
    for (let row = 0; row < 6; row++) {
      const rowData: Block[] = [];
      for (let col = 0; col < 5; col++) {
        // True random block generation with weighted chances
        const rand = Math.random();
        let blockType: number;
        // Weighted: dirt 25%, stone 25%, ruby 20%, gold 15%, diamond 10%, obsidian 5%
        if (rand < 0.25) blockType = 0;      // dirt
        else if (rand < 0.50) blockType = 1; // stone
        else if (rand < 0.70) blockType = 2; // ruby
        else if (rand < 0.85) blockType = 3; // gold
        else if (rand < 0.95) blockType = 4; // diamond
        else blockType = 5;                   // obsidian
        
        rowData.push({
          type: blockType,
          durability: BLOCK_DURABILITY[blockType],
          maxDurability: BLOCK_DURABILITY[blockType],
          broken: false,
        });
      }
      grid.push(rowData);
    }
    return grid;
  }

  useEffect(() => {
    setCurrentGame("luxe");
    return () => setCurrentGame("lobby");
  }, [setCurrentGame]);

  const spin = useCallback(async (isBonusBuy = false) => {
    if (isSpinning || !user?.id) return;
    
    const currentBet = freeSpins > 0 ? 0 : (isBonusBuy ? bet * 100 : actualBet);
    if (currentBet > balance) {
      toast({ title: "Недостаточно баланса", variant: "destructive" });
      setAutoSpin(false);
      autoSpinRef.current = false;
      return;
    }

    setIsSpinning(true);
    setLastWin(0);
    setAnimatingHits(new Set());
    setChestMultipliers([]);
    setActiveColumn(null);
    setDroppingPickaxes([]);
    setWinBreakdown([]);
    hapticFeedback("medium");
    playSound("luxeSpin");

    try {
      const response = await fetch("/api/games/minedrop/spin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          odejs: user.id,
          bet: bet,
          isFreeSpins: freeSpins > 0,
          extraChance: extraChance,
          isBonusBuy: isBonusBuy,
        }),
      });
      
      if (!response.ok) throw new Error("Spin failed");
      const result = await response.json();
      
      // PHASE 1: Reveal top reel column by column (slower - 250ms each)
      for (let col = 0; col < 5; col++) {
        await new Promise(resolve => setTimeout(resolve, 250));
        playSound("luxeReelStop");
        setTopReel(prev => {
          const newReel = prev.map(row => [...row]);
          for (let row = 0; row < 3; row++) {
            newReel[row][col] = result.topReel[row][col];
          }
          return newReel;
        });
      }
      
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // PHASE 2: Process blocks column by column with pickaxe drop animation
      // Group brokenBlocks by column for payout tracking
      const blocksByColumn: Map<number, {row: number; col: number; payout: number}[]> = new Map();
      for (const broken of result.brokenBlocks) {
        if (!blocksByColumn.has(broken.col)) {
          blocksByColumn.set(broken.col, []);
        }
        blocksByColumn.get(broken.col)!.push(broken);
      }
      
      // Track win per column
      const columnWins: {col: number; amount: number}[] = [];
      
      // Create a mutable copy of the current grid state for animation
      let animationGrid: Block[][] = blockGrid.map(row => row.map(block => ({ ...block })));
      
      // Process each column sequentially
      for (let col = 0; col < 5; col++) {
        // Find pickaxes and TNT in this column
        const pickaxesInColumn: number[] = [];
        let hasTnt = false;
        for (let row = 0; row < 3; row++) {
          const symbol = result.topReel[row][col];
          if (symbol <= 3) pickaxesInColumn.push(symbol);
          if (symbol === 5) hasTnt = true;
        }
        
        // Skip if no pickaxes AND no TNT
        if (pickaxesInColumn.length === 0 && !hasTnt) continue;
        
        // Highlight active column
        setActiveColumn(col);
        
        // Get server payouts for this column
        const columnPayouts = blocksByColumn.get(col) || [];
        let payoutIndex = 0;
        let columnTotal = 0;
        
        // Track which blocks were broken by TNT to avoid double-counting in pickaxe processing
        const tntBrokenSet = new Set<string>();
        
        // Process TNT first - explodes entire column + neighbors
        if (hasTnt) {
          // TNT explosion animation
          hapticFeedback("heavy");
          playSound("blockBreak");
          
          // Find first non-broken block in column
          let targetRow = -1;
          for (let row = 0; row < 6; row++) {
            if (!animationGrid[row][col].broken) {
              targetRow = row;
              break;
            }
          }
          
          if (targetRow !== -1) {
            // Show explosion effect on all blocks in column + neighbors
            const explosionBlocks: string[] = [];
            for (let row = 0; row < 6; row++) {
              if (!animationGrid[row][col].broken) {
                explosionBlocks.push(`${row}-${col}`);
                // Also add left and right neighbors
                if (col > 0 && !animationGrid[row][col - 1].broken) {
                  explosionBlocks.push(`${row}-${col - 1}`);
                }
                if (col < 4 && !animationGrid[row][col + 1].broken) {
                  explosionBlocks.push(`${row}-${col + 1}`);
                }
              }
            }
            
            setAnimatingHits(prev => new Set([...Array.from(prev), ...explosionBlocks]));
            await new Promise(resolve => setTimeout(resolve, 300));
            
            // Break all blocks in column and neighbors (from server response)
            // Only include blocks that are in the current column or immediate neighbors
            const tntBrokenBlocks = (result.brokenBlocks || []).filter((b: {row: number; col: number; payout: number}) => 
              (b.col === col || b.col === col - 1 || b.col === col + 1) && !animationGrid[b.row][b.col].broken
            );
            
            for (const bb of tntBrokenBlocks) {
              if (animationGrid[bb.row] && animationGrid[bb.row][bb.col]) {
                animationGrid[bb.row][bb.col].broken = true;
                animationGrid[bb.row][bb.col].durability = 0;
                // Track TNT-broken blocks to skip them during pickaxe processing
                tntBrokenSet.add(`${bb.row}-${bb.col}`);
              }
            }
            
            // Update visual grid with all broken blocks
            setBlockGrid(prev => {
              const newGrid = prev.map(r => r.map(b => ({ ...b })));
              for (const bb of tntBrokenBlocks) {
                if (newGrid[bb.row] && newGrid[bb.row][bb.col]) {
                  newGrid[bb.row][bb.col].broken = true;
                  newGrid[bb.row][bb.col].durability = 0;
                }
              }
              return newGrid;
            });
            
            await new Promise(resolve => setTimeout(resolve, 300));
            setAnimatingHits(new Set());
          }
        }
        
        // Process each pickaxe in order
        for (let pickIdx = 0; pickIdx < pickaxesInColumn.length; pickIdx++) {
          const pickaxeType = pickaxesInColumn[pickIdx];
          const totalHits = PICKAXE_HITS[pickaxeType];
          
          // Each pickaxe can do multiple hits
          for (let hitNum = 0; hitNum < totalHits; hitNum++) {
            // Find first non-broken block in column (6 rows, not 5!)
            let targetRow = -1;
            for (let row = 0; row < 6; row++) {
              if (!animationGrid[row][col].broken) {
                targetRow = row;
                break;
              }
            }
            
            // No more blocks to hit in this column
            if (targetRow === -1) break;
            
            // Move pickaxe to target block
            setDroppingPickaxes([{ col, row: targetRow, type: pickaxeType }]);
            await new Promise(resolve => setTimeout(resolve, 150));
            
            // Show hit effect with sound
            hapticFeedback("light");
            playSound("blockHit");
            setAnimatingHits(prev => new Set([...Array.from(prev), `${targetRow}-${col}`]));
            
            // Update local animation grid state
            const block = animationGrid[targetRow][col];
            block.durability = Math.max(0, block.durability - 1);
            const justBroke = block.durability === 0;
            if (justBroke) {
              block.broken = true;
              playSound("blockBreak");
              // Use server payout if available
              if (payoutIndex < columnPayouts.length) {
                columnTotal += columnPayouts[payoutIndex].payout || 0;
                payoutIndex++;
              }
            }
            
            // Update visual grid state
            setBlockGrid(prev => {
              const newGrid = prev.map(r => r.map(b => ({ ...b })));
              newGrid[targetRow][col] = { ...block };
              return newGrid;
            });
            
            // Keep hit visible
            await new Promise(resolve => setTimeout(resolve, 200));
            setAnimatingHits(prev => {
              const newSet = new Set(Array.from(prev));
              newSet.delete(`${targetRow}-${col}`);
              return newSet;
            });
          }
        }
        
        // Record column win
        if (columnTotal > 0) {
          columnWins.push({ col, amount: columnTotal });
        }
        
        // Clear pickaxe
        setDroppingPickaxes([]);
        
        // Brief pause between columns
        await new Promise(resolve => setTimeout(resolve, 150));
      }
      
      // Clear active column
      setActiveColumn(null);
      
      // Show win breakdown
      if (columnWins.length > 0) {
        setWinBreakdown(columnWins);
      }
      
      // PHASE 3: Chest reveal with longer pause
      if (result.chestMultipliers?.length > 0) {
        await new Promise(resolve => setTimeout(resolve, 500));
        setChestMultipliers(result.chestMultipliers);
        hapticFeedback("heavy");
        await new Promise(resolve => setTimeout(resolve, 800));
      }
      
      if (freeSpins > 0 || result.awardedFreeSpins > 0) {
        // During free spins or when free spins are awarded, use the current grid
        persistentGridRef.current = result.blockGrid;
        setBlockGrid(result.blockGrid);
      } else {
        // After regular spin, use nextBlockGrid for fresh random board immediately
        persistentGridRef.current = null;
        const newGrid = result.nextBlockGrid || initializeGrid();
        setBlockGrid(newGrid);
      }
      onBalanceChange(result.newBalance);
      
      if (freeSpins > 0) {
        const newFreeSpinWins = freeSpinWins + result.totalWin;
        setFreeSpins(prev => prev - 1);
        if (result.totalWin > 0) {
          setFreeSpinWins(newFreeSpinWins);
        }
        
        // Accumulate block stats during free spins
        if (result.brokenBlocks?.length > 0) {
          setFreeSpinBlockStats(prev => {
            const updated = { ...prev };
            for (const block of result.brokenBlocks) {
              const bt = block.blockType;
              if (!updated[bt]) {
                updated[bt] = { count: 0, payout: 0 };
              }
              updated[bt].count++;
              updated[bt].payout += block.payout || 0;
            }
            return updated;
          });
        }
        
        // Last free spin - show total win modal
        if (freeSpins === 1 && !result.awardedFreeSpins) {
          setTimeout(() => {
            setBlockGrid(initializeGrid());
            persistentGridRef.current = null;
            setIsFreeSpinAutoPlay(false);
            freeSpinAutoRef.current = false;
            if (newFreeSpinWins > 0) {
              setFinalTotalWin(newFreeSpinWins);
              setShowTotalWinModal(true);
              playSound("luxeBigWin");
              hapticFeedback("heavy");
            } else {
              // Clear stats even if no wins (modal won't show)
              setFreeSpinBlockStats({});
            }
            setFreeSpinWins(0);
          }, 800);
        }
      }
      
      if (result.awardedFreeSpins > 0) {
        setExtraChance(false);
        persistentGridRef.current = result.blockGrid;
        setPendingBonus({ freeSpins: result.awardedFreeSpins, scatterCount: result.scatterCount });
        setShowBonusModal(true);
        playSound("luxeBonus");
        hapticFeedback("heavy");
      }
      
      if (result.totalWin > 0) {
        setLastWin(result.totalWin);
        hapticFeedback("heavy");
        playSound("luxeWin");
        if (result.totalWin >= bet * 10) {
          playSound("luxeBigWin");
        }
      }
      
    } catch (error) {
      console.error("Spin error:", error);
      toast({ title: "Ошибка спина", variant: "destructive" });
    } finally {
      setIsSpinning(false);
    }
  }, [isSpinning, user?.id, bet, balance, freeSpins, actualBet, extraChance, hapticFeedback, playSound, toast, onBalanceChange, freeSpinWins]);

  useEffect(() => {
    autoSpinRef.current = autoSpin;
  }, [autoSpin]);

  useEffect(() => {
    if (autoSpinRef.current && !isSpinning && (freeSpins > 0 || balance >= actualBet)) {
      const timer = setTimeout(() => {
        if (autoSpinRef.current) spin();
      }, 1200);
      return () => clearTimeout(timer);
    }
  }, [isSpinning, autoSpin, freeSpins, balance, actualBet, spin]);

  useEffect(() => {
    freeSpinAutoRef.current = isFreeSpinAutoPlay;
  }, [isFreeSpinAutoPlay]);

  useEffect(() => {
    if (freeSpinAutoRef.current && !isSpinning && freeSpins > 0 && !showBonusModal) {
      const timer = setTimeout(() => {
        if (freeSpinAutoRef.current && freeSpins > 0) {
          spin();
        }
      }, 800);
      return () => clearTimeout(timer);
    }
    if (freeSpinAutoRef.current && freeSpins === 0) {
      setIsFreeSpinAutoPlay(false);
      freeSpinAutoRef.current = false;
    }
  }, [isSpinning, freeSpins, showBonusModal, spin]);

  const startFreeSpinAutoPlay = useCallback(() => {
    if (pendingBonus) {
      setFreeSpins(pendingBonus.freeSpins);
      setFreeSpinWins(0);
      setFreeSpinBlockStats({}); // Reset block stats for new bonus
      setPendingBonus(null);
      setShowBonusModal(false);
      setIsFreeSpinAutoPlay(true);
      freeSpinAutoRef.current = true;
      // Don't call spin() here - let the useEffect handle it
      // to ensure freeSpins state is updated before spin is called
    }
  }, [pendingBonus]);

  const resetGrid = () => {
    setBlockGrid(initializeGrid());
    setChestMultipliers([]);
  };

  const renderSymbol = (symbol: number, size = 40) => {
    if (symbol <= 3) return <MinecraftPickaxe type={symbol} size={size} />;
    if (symbol === 4) return <SpellbookSymbol size={size} />;
    if (symbol === 5) return <TNTBlock size={size} />;
    if (symbol === 6) return <img src={enderEyeImg} alt="Ender Eye" style={{ width: size, height: size, imageRendering: "pixelated" }} />;
    return <div style={{ width: size, height: size }} className="bg-gray-600/50 rounded" />;
  };

  return (
    <div className="min-h-screen flex flex-col relative overflow-hidden" style={{ background: "linear-gradient(180deg, #87CEEB 0%, #5BA3D0 100%)" }}>
      <CloudSVG className="absolute top-8 left-4 w-24 h-10 opacity-90" />
      <CloudSVG className="absolute top-16 right-8 w-32 h-12 opacity-80" />
      <CloudSVG className="absolute top-4 right-24 w-20 h-8 opacity-70" />
      
      <div className="relative z-10 flex flex-col h-full">
        <div className="flex items-center justify-between px-3 py-2">
          <div className="text-white font-bold text-sm drop-shadow">Minedrop</div>
          <button onClick={onBack} className="text-white/80 hover:text-white" data-testid="button-back">
            <X size={20} />
          </button>
        </div>
        
        <div className="flex-1 flex flex-col items-center justify-start px-2 gap-3">
          {freeSpins > 0 && (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="bg-gradient-to-r from-purple-600 to-pink-600 px-6 py-2 rounded-full font-bold text-white shadow-lg"
            >
              FREE SPINS: {freeSpins}
            </motion.div>
          )}
          
          <div className="bg-gray-700/80 rounded-lg p-1.5 shadow-lg border-2 border-gray-600">
            <div className="grid grid-cols-5 gap-0.5">
              {topReel.map((row, rowIndex) => (
                row.map((symbol, colIndex) => (
                  <motion.div
                    key={`reel-${rowIndex}-${colIndex}`}
                    className="w-12 h-12 bg-gray-500 rounded flex items-center justify-center border border-gray-400"
                    animate={isSpinning && symbol === 7 ? { rotateY: [0, 360] } : {}}
                    transition={{ duration: 0.3, delay: colIndex * 0.05 }}
                  >
                    {renderSymbol(symbol, 40)}
                  </motion.div>
                ))
              ))}
            </div>
          </div>
          
          <div className="flex flex-col gap-0 relative">
            {blockGrid.map((row, rowIndex) => (
              <div key={`row-${rowIndex}`} className="flex gap-0">
                {row.map((block, colIndex) => {
                  const isActiveCol = activeColumn === colIndex;
                  const droppingPickaxe = droppingPickaxes.find(p => p.col === colIndex && p.row === rowIndex);
                  
                  return (
                    <div 
                      key={`block-${rowIndex}-${colIndex}`} 
                      className={`w-12 h-12 relative transition-all duration-200 ${isActiveCol ? 'ring-2 ring-yellow-400/70' : ''}`}
                    >
                      <MinecraftBlock 
                        type={block.type}
                        durability={block.durability}
                        maxDurability={block.maxDurability}
                        broken={block.broken}
                        isHit={animatingHits.has(`${rowIndex}-${colIndex}`)}
                        size={48}
                      />
                      {droppingPickaxe && (
                        <motion.div 
                          className="absolute inset-0 flex items-center justify-center z-20 pointer-events-none"
                          initial={{ y: -30, opacity: 0, scale: 0.5, rotate: -15 }}
                          animate={{ y: 0, opacity: 1, scale: 1.3, rotate: 15 }}
                          transition={{ duration: 0.2, ease: "easeOut" }}
                        >
                          <MinecraftPickaxe type={droppingPickaxe.type} size={36} />
                        </motion.div>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
          
          <div className="flex gap-0">
            {[0, 1, 2, 3, 4].map(col => {
              const chest = chestMultipliers.find(c => c.col === col);
              const columnCleared = blockGrid.every(row => row[col].broken);
              return (
                <div key={`chest-${col}`} className="w-12 h-10 flex items-center justify-center">
                  <TreasureChest 
                    multiplier={chest?.multiplier}
                    revealed={columnCleared && !!chest}
                    size={44}
                  />
                </div>
              );
            })}
          </div>
          
          <AnimatePresence>
            {lastWin > 0 && (
              <motion.div
                initial={{ scale: 0, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0, opacity: 0 }}
                className="bg-gradient-to-r from-yellow-400 to-amber-500 px-6 py-3 rounded-2xl shadow-xl border-2 border-yellow-300"
              >
                <div className="flex flex-col items-center gap-1">
                  <span className="text-2xl font-black text-white drop-shadow-lg">
                    +${lastWin.toFixed(2)}
                  </span>
                  {winBreakdown.length > 0 && (
                    <div className="flex gap-2 text-xs text-white/90">
                      {winBreakdown.map((w, i) => (
                        <span key={i} className="bg-black/20 px-2 py-0.5 rounded">
                          Col{w.col + 1}: ${w.amount.toFixed(2)}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        
        <div className="bg-green-800/90 p-3 rounded-t-2xl border-t-4 border-green-700">
          <div className="flex items-center justify-center gap-3 mb-3">
            <button
              onClick={() => setShowPaytable(true)}
              className="w-10 h-10 rounded-full bg-gray-700 hover:bg-gray-600 flex items-center justify-center text-white shadow-md"
              data-testid="button-paytable"
            >
              <Info size={18} />
            </button>
            
            <button
              onClick={() => setShowBonusBuy(true)}
              disabled={isSpinning || freeSpins > 0}
              className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 disabled:opacity-50 flex items-center justify-center text-white shadow-md"
              data-testid="button-bonus-buy"
            >
              <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor">
                <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" />
              </svg>
            </button>
            
            <button
              onClick={() => {
                setAutoSpin(!autoSpin);
                autoSpinRef.current = !autoSpin;
              }}
              className={`w-10 h-10 rounded-full flex items-center justify-center shadow-md ${autoSpin ? "bg-amber-500 text-white" : "bg-gray-700 text-white hover:bg-gray-600"}`}
              data-testid="button-auto-spin"
            >
              <RotateCcw size={18} />
            </button>
            
            <button
              onClick={() => spin(false)}
              disabled={isSpinning || (freeSpins === 0 && balance < actualBet)}
              className="w-16 h-16 rounded-full bg-white hover:bg-gray-100 disabled:opacity-50 flex items-center justify-center shadow-xl border-4 border-gray-300"
              data-testid="button-spin"
            >
              <motion.div
                animate={isSpinning ? { rotate: 360 } : {}}
                transition={{ duration: 0.5, repeat: isSpinning ? Infinity : 0, ease: "linear" }}
              >
                <RotateCcw size={28} className="text-gray-700" />
              </motion.div>
            </button>
            
            <button
              onClick={() => setExtraChance(!extraChance)}
              disabled={isSpinning || freeSpins > 0}
              className={`w-10 h-10 rounded-full flex items-center justify-center shadow-md transition-all ${
                isSpinning || freeSpins > 0 
                  ? "bg-gray-600 text-gray-400 opacity-50" 
                  : extraChance 
                    ? "bg-cyan-500 text-white" 
                    : "bg-gray-700 text-white hover:bg-gray-600"
              }`}
              data-testid="button-extra-chance"
            >
              <Zap size={18} />
            </button>
            
            <button
              onClick={resetGrid}
              disabled={isSpinning || freeSpins > 0}
              className="w-10 h-10 rounded-full bg-cyan-600 hover:bg-cyan-500 flex items-center justify-center text-white shadow-md border-2 border-cyan-400"
              data-testid="button-reset-grid"
            >
              <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
              </svg>
            </button>
          </div>
          
          <div className="flex items-center justify-between bg-brown-800 rounded-lg overflow-hidden">
            <div className="flex-1 bg-gray-800 py-2 px-3">
              <div className="text-gray-400 text-xs">БАЛАНС</div>
              <div className="text-white font-bold" data-testid="text-balance">${balance.toFixed(2)}</div>
            </div>
            
            <button
              onClick={() => setBetIndex(Math.max(0, betIndex - 1))}
              disabled={isSpinning || freeSpins > 0}
              className="bg-gray-700 hover:bg-gray-600 disabled:opacity-50 p-3 text-white"
              data-testid="button-decrease-bet"
            >
              <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="3">
                <path d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            
            <div className="flex-1 bg-gray-800 py-2 px-3 text-center">
              <div className="text-gray-400 text-xs">СТАВКА</div>
              <div className="text-white font-bold" data-testid="text-bet-amount">${actualBet.toFixed(2)}</div>
            </div>
            
            <button
              onClick={() => setBetIndex(Math.min(BET_AMOUNTS.length - 1, betIndex + 1))}
              disabled={isSpinning || freeSpins > 0}
              className="bg-gray-700 hover:bg-gray-600 disabled:opacity-50 p-3 text-white"
              data-testid="button-increase-bet"
            >
              <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="3">
                <path d="M5 15l7-7 7 7" />
              </svg>
            </button>
          </div>
        </div>
      </div>
      
      <AnimatePresence>
        {showBonusModal && pendingBonus && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.5, y: 50, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              transition={{ type: "spring", duration: 0.6, bounce: 0.3 }}
              className="relative"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-purple-600 via-pink-500 to-purple-600 rounded-3xl blur-xl opacity-60 animate-pulse" />
              
              <div className="relative bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 rounded-3xl p-8 max-w-sm w-full border-2 border-purple-500 shadow-2xl">
                <motion.div 
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.2, type: "spring", bounce: 0.5 }}
                  className="text-center mb-6"
                >
                  <div className="flex justify-center mb-4">
                    {[0, 1, 2].map((i) => (
                      <motion.div 
                        key={i}
                        initial={{ y: -30, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        transition={{ delay: 0.3 + i * 0.1 }}
                        className="mx-1"
                      >
                        <img src={enderEyeImg} alt="Ender Eye" className="w-12 h-12" />
                      </motion.div>
                    ))}
                  </div>
                  
                  <motion.h2 
                    initial={{ scale: 0 }}
                    animate={{ scale: [0, 1.2, 1] }}
                    transition={{ delay: 0.5, duration: 0.5 }}
                    className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 via-amber-400 to-yellow-300 mb-2"
                  >
                    FREE SPINS!
                  </motion.h2>
                  
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.7 }}
                    className="text-purple-300 text-lg"
                  >
                    {pendingBonus.scatterCount} Ender Eyes найдено!
                  </motion.div>
                </motion.div>
                
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.8, type: "spring", bounce: 0.4 }}
                  className="bg-gradient-to-r from-purple-600 to-pink-600 rounded-2xl p-4 mb-6 text-center"
                >
                  <div className="text-white text-sm mb-1">Вы выиграли</div>
                  <div className="text-5xl font-black text-white drop-shadow-lg">
                    {pendingBonus.freeSpins}
                  </div>
                  <div className="text-purple-200 text-lg font-bold">БЕСПЛАТНЫХ СПИНОВ</div>
                </motion.div>
                
                <motion.button
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 1 }}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={startFreeSpinAutoPlay}
                  className="w-full py-4 rounded-xl bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-400 hover:to-emerald-500 text-white font-bold text-xl shadow-lg shadow-green-500/30"
                  data-testid="button-start-free-spins"
                >
                  ПРОДОЛЖИТЬ
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      
      <AnimatePresence>
        {showTotalWinModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.5, opacity: 0 }}
              transition={{ type: "spring", bounce: 0.4 }}
            >
              <div className="relative bg-gradient-to-br from-amber-900 via-yellow-900 to-amber-900 rounded-3xl p-6 max-w-sm w-full border-2 border-yellow-500 shadow-2xl">
                <motion.div 
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.2, type: "spring", bounce: 0.5 }}
                  className="text-center mb-4"
                >
                  <motion.h2 
                    initial={{ scale: 0 }}
                    animate={{ scale: [0, 1.2, 1] }}
                    transition={{ delay: 0.3, duration: 0.5 }}
                    className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 via-amber-400 to-yellow-300"
                  >
                    БОНУС ЗАВЕРШЁН!
                  </motion.h2>
                </motion.div>
                
                {/* Block breakdown */}
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 }}
                  className="bg-black/30 rounded-xl p-3 mb-4 max-h-48 overflow-y-auto"
                >
                  <div className="text-yellow-300 text-xs font-bold mb-2 text-center">СЛОМАННЫЕ БЛОКИ</div>
                  <div className="space-y-2">
                    {Object.entries(freeSpinBlockStats)
                      .filter(([_, stats]) => stats.count > 0)
                      .sort((a, b) => b[1].payout - a[1].payout)
                      .map(([blockTypeStr, stats]) => {
                        const blockType = parseInt(blockTypeStr);
                        return (
                          <div key={blockType} className="flex items-center justify-between bg-black/20 rounded-lg px-2 py-1.5">
                            <div className="flex items-center gap-2">
                              <MinecraftBlock type={blockType} durability={BLOCK_DURABILITY[blockType]} maxDurability={BLOCK_DURABILITY[blockType]} size={24} />
                              <span className="text-white text-sm">{BLOCK_NAMES[blockType]}</span>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="text-gray-300 text-xs">x{stats.count}</span>
                              <span className="text-yellow-400 font-bold text-sm">{BLOCK_PAYOUTS[blockType]}x</span>
                              <span className="text-green-400 font-bold text-sm">${stats.payout.toFixed(2)}</span>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </motion.div>
                
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.5, type: "spring", bounce: 0.4 }}
                  className="bg-gradient-to-r from-yellow-600 to-amber-600 rounded-2xl p-4 mb-4 text-center"
                >
                  <div className="text-white text-sm mb-1">Общий выигрыш</div>
                  <div className="text-4xl font-black text-white drop-shadow-lg">
                    {`$${finalTotalWin.toFixed(2)}`}
                  </div>
                </motion.div>
                
                <motion.button
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.7 }}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => {
                    setShowTotalWinModal(false);
                    setFreeSpinBlockStats({});
                  }}
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-400 hover:to-emerald-500 text-white font-bold text-lg shadow-lg shadow-green-500/30"
                  data-testid="button-close-total-win"
                >
                  ЗАКРЫТЬ
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      
      <AnimatePresence>
        {showPaytable && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
            onClick={() => setShowPaytable(false)}
          >
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.9 }}
              className="bg-gray-800 rounded-2xl p-4 max-w-sm w-full max-h-[80vh] overflow-y-auto"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold text-white">Как играть</h2>
                <button onClick={() => setShowPaytable(false)} className="text-gray-400" data-testid="button-close-paytable">
                  <X size={24} />
                </button>
              </div>
              
              <div className="space-y-4 text-sm">
                <div>
                  <h3 className="text-amber-400 font-bold mb-2">Кирки</h3>
                  <div className="grid grid-cols-2 gap-2">
                    {PICKAXE_NAMES.map((name, i) => (
                      <div key={name} className="flex items-center gap-2 bg-gray-700 rounded p-2">
                        <MinecraftPickaxe type={i} size={28} />
                        <div>
                          <div className="text-white text-xs">{name}</div>
                          <div className="text-gray-400 text-xs">{PICKAXE_HITS[i]} ударов</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                
                <div>
                  <h3 className="text-amber-400 font-bold mb-2">Блоки</h3>
                  <div className="grid grid-cols-2 gap-2">
                    {BLOCK_NAMES.map((name, i) => (
                      <div key={name} className="flex items-center gap-2 bg-gray-700 rounded p-2">
                        <MinecraftBlock type={i} durability={BLOCK_DURABILITY[i]} maxDurability={BLOCK_DURABILITY[i]} size={28} />
                        <div>
                          <div className="text-white text-xs">{name}</div>
                          <div className="text-gray-400 text-xs">{BLOCK_DURABILITY[i]} HP | {BLOCK_PAYOUTS[i]}x</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                
                <div>
                  <h3 className="text-amber-400 font-bold mb-2">Спецсимволы</h3>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 bg-gray-700 rounded p-2">
                      <SpellbookSymbol size={28} />
                      <div className="text-xs">
                        <div className="text-white">Книга заклинаний</div>
                        <div className="text-gray-400">Улучшает кирку до алмазной</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 bg-gray-700 rounded p-2">
                      <TNTBlock size={28} />
                      <div className="text-xs">
                        <div className="text-white">TNT</div>
                        <div className="text-gray-400">Взрывает блок и соседние</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 bg-gray-700 rounded p-2">
                      <img src={enderEyeImg} alt="Ender Eye" className="w-7 h-7" />
                      <div className="text-xs">
                        <div className="text-white">Око Эндера</div>
                        <div className="text-gray-400">3+ = Бесплатные спины</div>
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="text-center text-gray-500 text-xs pt-2 border-t border-gray-700">
                  Макс. выигрыш: 5000x | RTP: 96%
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      
      <AnimatePresence>
        {showBonusBuy && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
            onClick={() => setShowBonusBuy(false)}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-2xl p-5 max-w-sm w-full shadow-2xl border border-purple-500/30"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex justify-between items-center mb-5">
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <svg viewBox="0 0 24 24" className="w-6 h-6 text-purple-400" fill="currentColor">
                    <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" />
                  </svg>
                  Bonus Buy
                </h2>
                <button onClick={() => setShowBonusBuy(false)} className="text-gray-400 hover:text-white" data-testid="button-close-bonus-buy">
                  <X size={24} />
                </button>
              </div>
              
              <div className="space-y-3">
                <p className="text-gray-400 text-sm text-center mb-4">
                  Купите бонус и сразу получите бесплатные спины!
                </p>
                
                <button
                  onClick={() => {
                    if (balance >= bet * 100) {
                      setShowBonusBuy(false);
                      spin(true);
                    } else {
                      toast({ title: "Недостаточно баланса", variant: "destructive" });
                    }
                  }}
                  disabled={isSpinning || balance < bet * 100}
                  className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-4 px-6 rounded-xl shadow-lg transition-all"
                  data-testid="button-buy-bonus"
                >
                  <div className="flex flex-col items-center gap-1">
                    <span className="text-lg">Купить бонус</span>
                    <span className="text-2xl font-black">${(bet * 100).toFixed(2)}</span>
                    <span className="text-xs text-purple-200">4+ бесплатных спинов</span>
                  </div>
                </button>
                
                <div className="text-center text-gray-500 text-xs pt-2">
                  Стоимость: 100x от базовой ставки (${bet.toFixed(2)})
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default MinedropGame;
