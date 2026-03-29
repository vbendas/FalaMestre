'use client';

import { motion } from 'framer-motion';
import { Play, Pause, SkipForward, FastForward } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PlaybackControlsProps {
  isPlaying: boolean;
  onPlayPause: () => void;
  onSkip?: () => void;
  speed?: number;
  onSpeedChange?: (speed: number) => void;
  minute: number;
  maxMinute?: number;
}

const SPEED_OPTIONS = [0.5, 1, 2, 4];

export function PlaybackControls({
  isPlaying,
  onPlayPause,
  onSkip,
  speed = 1,
  onSpeedChange,
  minute,
  maxMinute = 90,
}: PlaybackControlsProps) {
  return (
    <div className="flex items-center justify-between gap-4 p-3 bg-[#012169]/80 backdrop-blur-sm rounded-xl border-2 border-[#FEDD00]/30">
      {/* Play/Pause Button */}
      <motion.button
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        onClick={onPlayPause}
        className={cn(
          'w-12 h-12 rounded-full flex items-center justify-center transition-colors',
          isPlaying
            ? 'bg-[#FF6B00] hover:bg-[#ff8533]'
            : 'bg-[#009739] hover:bg-[#00b342]'
        )}
      >
        {isPlaying ? (
          <Pause className="w-6 h-6 text-white" />
        ) : (
          <Play className="w-6 h-6 text-white ml-1" />
        )}
      </motion.button>

      {/* Speed Controls */}
      <div className="flex items-center gap-2">
        <FastForward className="w-4 h-4 text-white/60" />
        <div className="flex gap-1">
          {SPEED_OPTIONS.map((s) => (
            <button
              key={s}
              onClick={() => onSpeedChange?.(s)}
              className={cn(
                'px-2 py-1 rounded text-xs font-bold transition-colors',
                speed === s
                  ? 'bg-[#FEDD00] text-[#012169]'
                  : 'bg-white/10 text-white/60 hover:bg-white/20'
              )}
            >
              {s}x
            </button>
          ))}
        </div>
      </div>

      {/* Skip Button */}
      {onSkip && (
        <motion.button
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          onClick={onSkip}
          className="w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
        >
          <SkipForward className="w-6 h-6 text-white" />
        </motion.button>
      )}

      {/* Minute Display */}
      <div className="text-center min-w-[60px]">
        <div className="text-lg font-bold text-[#FEDD00]">{minute}'</div>
        <div className="text-[10px] text-white/40">/ {maxMinute}'</div>
      </div>
    </div>
  );
}

interface MiniPlaybackControlsProps {
  isPlaying: boolean;
  onPlayPause: () => void;
  className?: string;
}

export function MiniPlaybackControls({ isPlaying, onPlayPause, className }: MiniPlaybackControlsProps) {
  return (
    <motion.button
      whileHover={{ scale: 1.1 }}
      whileTap={{ scale: 0.9 }}
      onClick={onPlayPause}
      className={cn(
        'w-10 h-10 rounded-full flex items-center justify-center transition-colors',
        isPlaying
          ? 'bg-[#FF6B00] hover:bg-[#ff8533]'
          : 'bg-[#009739] hover:bg-[#00b342]',
        className
      )}
    >
      {isPlaying ? (
        <Pause className="w-5 h-5 text-white" />
      ) : (
        <Play className="w-5 h-5 text-white ml-0.5" />
      )}
    </motion.button>
  );
}
