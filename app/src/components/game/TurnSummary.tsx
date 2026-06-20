'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MatchSegment } from '@/lib/types';
import { getTeamData } from '@/lib/team-data';
import Image from 'next/image';

interface TurnSummaryProps {
  segment: MatchSegment;
  homeTeam: string;
  awayTeam: string;
  homeColor: string;
  awayColor: string;
  segmentSummary: string;
  turnNumber: number;
  totalTurns: number;
  onContinue: () => void;
}

export function TurnSummary({
  segment,
  homeTeam,
  awayTeam,
  segmentSummary,
  turnNumber,
  totalTurns,
  onContinue,
}: TurnSummaryProps) {
  const [countdown, setCountdown] = useState(4);
  const [autoAdvance, setAutoAdvance] = useState(true);

  const homeTeamData = getTeamData(homeTeam);
  const awayTeamData = getTeamData(awayTeam);

  const goalScored =
    segment.homeScoreAtEnd !== segment.homeScoreAtStart ||
    segment.awayScoreAtEnd !== segment.awayScoreAtStart;

  const segmentLabel =
    segment.fromMinute === 45
      ? 'Fim do 1º Tempo'
      : `Minutos ${segment.fromMinute}'- ${segment.toMinute}'`;

  useEffect(() => {
    if (!autoAdvance) return;
    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          onContinue();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [autoAdvance, onContinue]);

  const handleContinue = () => {
    setAutoAdvance(false);
    onContinue();
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.3 }}
          className="pixel-card w-full max-w-[400px] mx-4 p-5 rounded-lg"
        >
          <p className="text-[#FEDD00] font-[family-name:var(--font-retro)] text-sm text-center mb-1">
            {segmentLabel}
          </p>
          <p className="text-white/60 text-xs text-center mb-4">
            Decisão {turnNumber + 1}/{totalTurns}
          </p>

          <div className="flex items-center justify-center gap-6 mb-4">
            <div className="text-center">
              {homeTeamData?.logo && (
                <Image
                  src={homeTeamData.logo}
                  alt={homeTeam}
                  width={40}
                  height={40}
                  className="mx-auto mb-1 object-contain"
                />
              )}
              <p className="text-white text-xs font-[family-name:var(--font-retro)]">{homeTeam}</p>
            </div>

            <div className={`text-3xl font-[family-name:var(--font-retro)] text-white ${goalScored ? 'score-pulse' : ''}`}>
              {segment.homeScoreAtEnd} - {segment.awayScoreAtEnd}
            </div>

            <div className="text-center">
              {awayTeamData?.logo && (
                <Image
                  src={awayTeamData.logo}
                  alt={awayTeam}
                  width={40}
                  height={40}
                  className="mx-auto mb-1 object-contain"
                />
              )}
              <p className="text-white text-xs font-[family-name:var(--font-retro)]">{awayTeam}</p>
            </div>
          </div>

          <p className="text-white/80 text-sm font-[family-name:var(--font-retro)] text-center mb-4 line-clamp-3">
            {segmentSummary}
          </p>

          <button
            onClick={handleContinue}
            className="pixel-btn w-full py-2 bg-[#FEDD00] text-black font-[family-name:var(--font-retro)] text-sm rounded border-2 border-[#B8860B] hover:brightness-110 transition"
          >
            Continuar
          </button>

          {autoAdvance && (
            <p className="text-white/40 text-xs text-center mt-2">
              Continuando em {countdown}...
            </p>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
