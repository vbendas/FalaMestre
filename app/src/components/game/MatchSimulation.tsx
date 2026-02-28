'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { useMemo } from 'react';
import { GameState, MatchEvent } from '@/lib/types';
import { getTeamData } from '@/lib/team-data';
import Image from 'next/image';
import { Clock, Trophy, Zap, Target, Shield, Activity } from 'lucide-react';
import { CommentaryFeed } from './CommentaryFeed';

interface MatchSimulationProps {
  gameState: GameState;
  homeScore: number;
  awayScore: number;
  minute: number;
  currentEvent: string | null;
  isPlaying: boolean;
  events?: MatchEvent[];
}

export function MatchSimulation({ 
  gameState, 
  homeScore, 
  awayScore, 
  minute, 
  currentEvent,
  isPlaying: _isPlaying,
  events = []
}: MatchSimulationProps) {
  const { user, season } = gameState;
  const homeTeamData = getTeamData(user.team);
  const awayTeamData = getTeamData(season.nextMatch.opponent);

  // Calculate match progress percentage
  const progress = (minute / 90) * 100;

  // Stable possession stats based on minute - only update every 5 minutes
  const possessionBucket = Math.floor(minute / 5);
  const possessionStats = useMemo(() => {
    const baseHome = 50;
    const variation = (possessionBucket % 3 - 1) * 3; // -3, 0, +3 every 5 minutes
    const homePossession = baseHome + variation;
    const awayPossession = 100 - homePossession;
    return { homePossession, awayPossession };
  }, [possessionBucket]); // Only recalculate every 5 minutes

  return (
    <div className="space-y-4">
      {/* Live Match Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="pixel-card p-4"
      >
        {/* Competition Badge */}
        <div className="flex items-center justify-center gap-2 mb-4">
          <Trophy className="w-4 h-4 text-[#FEDD00]" />
          <span className="text-sm text-white/70 font-[family-name:var(--font-retro)]">
            {season.nextMatch.competition}
          </span>
        </div>

        {/* Scoreboard */}
        <div className="flex items-center justify-between mb-4">
          {/* Home Team */}
          <div className="flex-1 text-center">
            <motion.div
              className="relative w-16 h-16 mx-auto mb-2"
              animate={homeScore > awayScore ? { 
                scale: [1, 1.1, 1],
                filter: ['brightness(1)', 'brightness(1.3)', 'brightness(1)']
              } : {}}
              transition={{ duration: 0.5 }}
            >
              {homeTeamData?.logo && homeTeamData.logo !== '' ? (
                <Image
                  src={homeTeamData.logo}
                  alt={user.team}
                  fill
                  className="object-contain"
                />
              ) : (
                <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center text-2xl">
                  {user.team?.charAt(0) || '?'}
                </div>
              )}
            </motion.div>
            <div className="font-bold text-white text-sm truncate">{user.team}</div>
          </div>

          {/* Score */}
          <div className="px-6">
            <div className="flex items-center gap-3">
              <motion.div 
                key={`home-score-${homeScore}`}
                initial={{ scale: 1.5, color: '#FEDD00' }}
                animate={{ scale: 1, color: '#FFFFFF' }}
                className="text-5xl font-black pixel-text"
              >
                {homeScore}
              </motion.div>
              <div className="text-3xl text-white/40">:</div>
              <motion.div 
                key={`away-score-${awayScore}`}
                initial={{ scale: 1.5, color: '#FEDD00' }}
                animate={{ scale: 1, color: '#FFFFFF' }}
                className="text-5xl font-black pixel-text"
              >
                {awayScore}
              </motion.div>
            </div>
            <div className="text-center mt-2">
              <div className="inline-flex items-center gap-1.5 bg-[#FF6B00] px-3 py-1 rounded text-xs font-bold text-white">
                <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                AO VIVO
              </div>
            </div>
          </div>

          {/* Away Team */}
          <div className="flex-1 text-center">
            <motion.div
              className="relative w-16 h-16 mx-auto mb-2"
              animate={awayScore > homeScore ? { 
                scale: [1, 1.1, 1],
                filter: ['brightness(1)', 'brightness(1.3)', 'brightness(1)']
              } : {}}
              transition={{ duration: 0.5 }}
            >
              {awayTeamData?.logo && awayTeamData.logo !== '' ? (
                <Image
                  src={awayTeamData.logo}
                  alt={season.nextMatch.opponent}
                  fill
                  className="object-contain"
                />
              ) : (
                <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center text-2xl">
                  {season.nextMatch.opponent?.charAt(0) || '?'}
                </div>
              )}
            </motion.div>
            <div className="font-bold text-white text-sm truncate">{season.nextMatch.opponent}</div>
          </div>
        </div>

        {/* Match Timer */}
        <div className="flex items-center justify-center gap-2 mb-3">
          <Clock className="w-4 h-4 text-[#FEDD00]" />
          <span className="text-2xl font-bold text-[#FEDD00] pixel-text">
            {minute}'
          </span>
        </div>

        {/* Progress Bar */}
        <div className="relative h-3 bg-[#012169]/60 rounded overflow-hidden border border-[#FEDD00]/30">
          <motion.div
            className="absolute top-0 left-0 h-full bg-gradient-to-r from-[#009739] to-[#FEDD00]"
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.3 }}
          />
          {/* Match Events Markers */}
          {[15, 30, 45, 60, 75].map((mark) => (
            <div
              key={`marker-${mark}`}
              className="absolute top-0 w-0.5 h-full bg-white/30"
              style={{ left: `${(mark / 90) * 100}%` }}
            />
          ))}
        </div>
        <div className="flex justify-between text-xs text-white/50 mt-1 font-[family-name:var(--font-retro)]">
          <span>0'</span>
          <span>45'</span>
          <span>90'</span>
        </div>
      </motion.div>

      {/* Live Event Feed */}
      <AnimatePresence mode="wait">
        {currentEvent && (
          <motion.div
            key={currentEvent}
            initial={{ opacity: 0, scale: 0.8, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: -20 }}
            className="pixel-card p-4 border-4 border-[#FEDD00]"
          >
            <div className="flex items-center gap-3">
              <motion.div
                animate={{ rotate: [0, -10, 10, -10, 10, 0] }}
                transition={{ duration: 0.5 }}
              >
                <Activity className="w-6 h-6 text-[#FEDD00]" />
              </motion.div>
              <div className="flex-1">
                <div className="text-xs text-white/60 mb-1 font-[family-name:var(--font-retro)]">
                  {minute}' - Evento ao vivo
                </div>
                <div className="text-white font-bold">
                  {currentEvent}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Commentary Feed */}
      {events.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <h3 className="font-bold text-white mb-2 flex items-center gap-2 font-[family-name:var(--font-pixel)] text-sm">
            <Activity className="w-4 h-4 text-[#FEDD00]" />
            Comentários
          </h3>
          <CommentaryFeed 
            events={events} 
            currentMinute={minute} 
            animationQuality={gameState.user.matchSettings?.animationQuality}
          />
        </motion.div>
      )}

      {/* Match Stats */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="bg-[#012169]/60 rounded p-4 border-2 border-[#FEDD00]/50 pixel-border-thin"
      >
        <h3 className="font-bold text-white mb-3 flex items-center gap-2 font-[family-name:var(--font-pixel)]">
          <Zap className="w-4 h-4 text-[#FEDD00]" />
          Estatísticas da Partida
        </h3>

        <div className="space-y-3">
          {/* Possession */}
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-white/60">
              <span>{possessionStats.homePossession}%</span>
              <span className="font-medium">Posse de Bola</span>
              <span>{possessionStats.awayPossession}%</span>
            </div>
            <div className="h-2 bg-[#012169] rounded overflow-hidden flex">
              <div 
                className="h-full bg-[#009739]"
                style={{ width: `${possessionStats.homePossession}%` }}
              />
              <div 
                className="h-full bg-[#3B82F6]"
                style={{ width: `${possessionStats.awayPossession}%` }}
              />
            </div>
          </div>

          {/* Shots - Calculate from events if available, otherwise estimate */}
          <div className="flex items-center justify-between py-2 border-b border-white/10">
            <div className="flex items-center gap-2">
              <span className="text-lg font-bold text-white">
                {events.length > 0 
                  ? events.filter(e => e.minute <= minute && (e.type === 'goal' || e.type === 'miss' || e.type === 'buildup')).length + homeScore
                  : Math.floor(minute / 10) + 2}
              </span>
              <Target className="w-4 h-4 text-white/60" />
            </div>
            <span className="text-xs text-white/60 font-[family-name:var(--font-retro)]">Chutes</span>
            <div className="flex items-center gap-2">
              <Target className="w-4 h-4 text-white/60" />
              <span className="text-lg font-bold text-white">
                {events.length > 0 
                  ? events.filter(e => e.minute <= minute && (e.type === 'goal' || e.type === 'miss' || e.type === 'buildup')).length + awayScore
                  : Math.floor(minute / 12) + 1}
              </span>
            </div>
          </div>

          {/* Defenses - Calculate from events if available, otherwise estimate */}
          <div className="flex items-center justify-between py-2">
            <div className="flex items-center gap-2">
              <span className="text-lg font-bold text-white">
                {events.length > 0 
                  ? Math.max(1, Math.floor(minute / 15) + 1 - Math.floor(events.filter(e => e.minute <= minute).length / 3))
                  : Math.floor(minute / 15) + 1}
              </span>
              <Shield className="w-4 h-4 text-white/60" />
            </div>
            <span className="text-xs text-white/60 font-[family-name:var(--font-retro)]">Defesas</span>
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-white/60" />
              <span className="text-lg font-bold text-white">
                {events.length > 0 
                  ? Math.max(1, Math.floor(minute / 18) + 1 - Math.floor(events.filter(e => e.minute <= minute).length / 3))
                  : Math.floor(minute / 18) + 1}
              </span>
            </div>
          </div>
        </div>
      </motion.div>

    </div>
  );
}
