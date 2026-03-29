'use client';

import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className }: SkeletonProps) {
  return (
    <motion.div
      className={cn('bg-white/10 rounded-lg animate-pulse', className)}
      animate={{ opacity: [0.3, 0.6, 0.3] }}
      transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
    />
  );
}

export function PlayerCardSkeleton({ index = 0 }: { index?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.03 }}
      className="bg-[#006400] rounded-xl border-2 border-[#FEDD00]/50 p-3"
    >
      <div className="flex items-center gap-3">
        {/* Avatar skeleton */}
        <Skeleton className="w-12 h-12 rounded-full" />
        
        {/* Info skeleton */}
        <div className="flex-1 space-y-2">
          <div className="flex items-center gap-2">
            <Skeleton className="w-8 h-4 rounded" />
            <Skeleton className="w-24 h-4 rounded" />
          </div>
          <div className="flex gap-2">
            <Skeleton className="w-[60px] h-4 rounded" />
            <Skeleton className="w-[60px] h-4 rounded" />
            <Skeleton className="w-[60px] h-4 rounded" />
          </div>
        </div>
        
        {/* Status skeleton */}
        <div className="flex flex-col items-end gap-1">
          <Skeleton className="w-8 h-4 rounded" />
          <Skeleton className="w-6 h-6 rounded-full" />
        </div>
      </div>
    </motion.div>
  );
}

export function SquadViewSkeleton() {
  return (
    <div className="space-y-4 pb-20">
      {/* Squad stats skeleton */}
      <div className="bg-white/5 rounded-xl p-4 border border-white/10">
        <div className="grid grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="text-center space-y-2">
              <Skeleton className="w-12 h-12 rounded-full mx-auto" />
              <Skeleton className="w-16 h-3 rounded mx-auto" />
              <Skeleton className="w-8 h-2 rounded mx-auto" />
            </div>
          ))}
        </div>
      </div>
      
      {/* Players by position */}
      {['GK', 'DEF', 'MID', 'FWD'].map((pos) => (
        <motion.div
          key={pos}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white/5 rounded-xl p-3 border border-white/10"
        >
          <div className="flex items-center justify-between mb-3">
            <Skeleton className="w-24 h-6 rounded" />
            <Skeleton className="w-16 h-4 rounded" />
          </div>
          <div className="grid grid-cols-1 gap-2">
            {[...Array(pos === 'GK' ? 2 : pos === 'DEF' ? 4 : pos === 'MID' ? 4 : 2)].map((_, i) => (
              <PlayerCardSkeleton key={i} index={i} />
            ))}
          </div>
        </motion.div>
      ))}
    </div>
  );
}

export function ChatMessageSkeleton() {
  return (
    <div className="flex gap-2">
      <Skeleton className="w-8 h-8 rounded-full flex-shrink-0" />
      <div className="flex flex-col gap-2 max-w-[75%]">
        <Skeleton className="w-48 h-16 rounded-lg" />
        <Skeleton className="w-24 h-3 rounded" />
      </div>
    </div>
  );
}

export function ChatViewSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <div className="bg-white/5 rounded-xl p-4 border border-white/10 h-[60vh] overflow-hidden">
        <div className="flex flex-col gap-4">
          {[...Array(5)].map((_, i) => (
            <ChatMessageSkeleton key={i} />
          ))}
        </div>
      </div>
      <div className="flex gap-2">
        <Skeleton className="flex-1 h-12 rounded-lg" />
        <Skeleton className="w-12 h-12 rounded-lg" />
      </div>
    </div>
  );
}

export function MatchViewSkeleton() {
  return (
    <div className="space-y-4">
      {/* VS Screen skeleton */}
      <div className="bg-white/5 rounded-xl p-6 border border-white/10">
        <div className="flex items-center justify-between">
          <div className="flex-1 text-center space-y-3">
            <Skeleton className="w-20 h-20 rounded-full mx-auto" />
            <Skeleton className="w-24 h-5 rounded mx-auto" />
            <Skeleton className="w-16 h-3 rounded mx-auto" />
          </div>
          <Skeleton className="w-16 h-8 rounded" />
          <div className="flex-1 text-center space-y-3">
            <Skeleton className="w-20 h-20 rounded-full mx-auto" />
            <Skeleton className="w-24 h-5 rounded mx-auto" />
            <Skeleton className="w-16 h-3 rounded mx-auto" />
          </div>
        </div>
      </div>
      
      {/* Comparison skeleton */}
      <div className="bg-white/5 rounded-xl p-4 border border-white/10">
        <Skeleton className="w-48 h-5 rounded mb-4" />
        <div className="space-y-3">
          <Skeleton className="w-full h-4 rounded" />
          <Skeleton className="w-full h-4 rounded" />
        </div>
      </div>
      
      {/* Play button skeleton */}
      <Skeleton className="w-full h-16 rounded-xl" />
    </div>
  );
}

export function PlayerDetailModalSkeleton() {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="relative w-full max-w-md bg-gradient-to-b from-[#012169] to-[#001845] rounded border-4 border-[#FEDD00] overflow-hidden"
      >
        <div className="p-6 space-y-4">
          <div className="flex items-center gap-4">
            <Skeleton className="w-16 h-16 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="w-32 h-5 rounded" />
              <Skeleton className="w-24 h-4 rounded" />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {[...Array(6)].map((_, i) => (
              <Skeleton key={i} className="h-16 rounded-lg" />
            ))}
          </div>
          <div className="flex gap-2">
            <Skeleton className="flex-1 h-10 rounded-lg" />
            <Skeleton className="flex-1 h-10 rounded-lg" />
          </div>
        </div>
      </motion.div>
    </div>
  );
}

interface LoadingOverlayProps {
  message?: string;
}

export function LoadingOverlay({ message = 'Carregando...' }: LoadingOverlayProps) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
    >
      <div className="flex flex-col items-center gap-4">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
        >
          <div className="text-5xl">⚽</div>
        </motion.div>
        <p className="text-[#FEDD00] font-bold">{message}</p>
      </div>
    </motion.div>
  );
}

interface ProgressBarProps {
  progress: number;
  className?: string;
  showPercentage?: boolean;
}

export function ProgressBar({ progress, className, showPercentage = true }: ProgressBarProps) {
  const clampedProgress = Math.min(100, Math.max(0, progress));
  
  return (
    <div className={cn('space-y-1', className)}>
      <div className="flex justify-between text-xs text-white/60">
        <span>Progresso</span>
        {showPercentage && <span>{Math.round(clampedProgress)}%</span>}
      </div>
      <div className="h-2 bg-white/10 rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${clampedProgress}%` }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          className="h-full bg-gradient-to-r from-[#009739] to-[#FEDD00] rounded-full"
        />
      </div>
    </div>
  );
}
