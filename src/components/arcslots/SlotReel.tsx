'use client';

/**
 * SlotReel Component - Framer Motion animation for slot machine reels
 * Handles spinning cycles and symbol reveals
 */

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { SLOT_SYMBOLS, type SlotSymbol } from '@/lib/arcslots/arcslots.constants';

interface SlotReelProps {
  isSpinning: boolean;
  finalSymbols?: string[];
  onSpinComplete?: () => void;
}

export function SlotReel({ isSpinning, finalSymbols = [], onSpinComplete }: SlotReelProps) {
  const [displaySymbols, setDisplaySymbols] = useState<SlotSymbol[]>([
    SLOT_SYMBOLS[0],
    SLOT_SYMBOLS[1],
    SLOT_SYMBOLS[2],
  ]);

  // Animate spinning cycle
  useEffect(() => {
    if (!isSpinning) {
      if (finalSymbols.length === 3) {
        setDisplaySymbols(finalSymbols as SlotSymbol[]);
        onSpinComplete?.();
      }
      return;
    }

    const spinInterval = setInterval(() => {
      setDisplaySymbols([
        SLOT_SYMBOLS[Math.floor(Math.random() * SLOT_SYMBOLS.length)],
        SLOT_SYMBOLS[Math.floor(Math.random() * SLOT_SYMBOLS.length)],
        SLOT_SYMBOLS[Math.floor(Math.random() * SLOT_SYMBOLS.length)],
      ]);
    }, 100);

    return () => clearInterval(spinInterval);
  }, [isSpinning, finalSymbols, onSpinComplete]);

  return (
    <div className="flex justify-center gap-4 p-6 rounded-xl bg-slate-900 border border-cyan-500/20">
      <AnimatePresence mode="wait">
        {displaySymbols.map((symbol, index) => (
          <motion.div
            key={`${symbol}-${index}`}
            initial={{ y: -100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="flex items-center justify-center w-20 h-20 text-5xl bg-gradient-to-b from-slate-700 to-slate-800 rounded-lg border border-cyan-400/30 shadow-lg"
          >
            {symbol}
          </motion.div>
        ))}
      </AnimatePresence>

      {isSpinning && (
        <div className="absolute inset-0 flex items-center justify-center">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
            className="w-8 h-8 border-2 border-cyan-400 border-t-transparent rounded-full"
          />
        </div>
      )}
    </div>
  );
}

/**
 * Reel animation presets
 */
export const reelAnimationVariants = {
  spin: {
    y: [0, -20, -40, -60, 0],
    transition: { duration: 0.5, repeat: Infinity, ease: 'easeInOut' },
  },
  stop: {
    y: 0,
    transition: { duration: 0.3 },
  },
  bounce: {
    y: [0, -10, 0],
    transition: { duration: 0.4, ease: 'easeInOut' },
  },
};
