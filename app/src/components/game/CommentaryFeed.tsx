'use client';

import { useRef, useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MatchEvent, MatchSettings } from '@/lib/types';
import { ANIMATION_CONFIG } from '@/lib/constants';

interface CommentaryFeedProps {
  events: MatchEvent[];
  currentMinute: number;
  animationQuality?: MatchSettings['animationQuality'];
}

const intensityStyles = {
  low: 'text-white/60 border-l-2 border-white/20',
  medium: 'text-white border-l-2 border-yellow-500/50',
  high: 'text-white font-medium border-l-2 border-orange-500 bg-orange-500/10',
  dramatic: 'text-yellow-400 font-bold border-l-4 border-red-500 bg-red-500/10',
};

const eventTypeIcons: Record<string, string> = {
  goal: '⚽',
  save: '🧤',
  miss: '😱',
  foul: '🟨',
  card: '🟨',
  corner: '🚩',
  pressure: '🔥',
  buildup: '🎯',
  tension: '💢',
  kickoff: '🏃',
  halftime: '⏸️',
  substitution: '🔄',
  whistle: '⏺️',
};

const getAnimationVariant = (event: MatchEvent, quality: MatchSettings['animationQuality'] = 'medium') => {
  const config = ANIMATION_CONFIG[quality];
  
  if (quality === 'low') {
    return {
      initial: { opacity: 0 },
      animate: { opacity: 1 },
      transition: { duration: config.duration }
    };
  }
  
  if (event.intensity === 'dramatic') {
    return {
      initial: { opacity: 0, scale: 0.8, x: -20 },
      animate: { 
        opacity: 1, 
        scale: 1, 
        x: 0,
        boxShadow: ['0 0 0 rgba(239, 68, 68, 0)', '0 0 20px rgba(239, 68, 68, 0.5)', '0 0 0 rgba(239, 68, 68, 0)']
      },
      transition: { duration: config.duration }
    };
  }
  if (event.type === 'goal') {
    return {
      initial: { opacity: 0, scale: 0.5 },
      animate: { opacity: 1, scale: 1 },
      transition: config.springPhysics ? { type: 'spring' as const, stiffness: 200, damping: 15 } : { duration: config.duration }
    };
  }
  if (event.type === 'card') {
    return {
      initial: { opacity: 0, y: -10 },
      animate: { opacity: 1, y: 0 },
      transition: { duration: config.duration }
    };
  }
  return {
    initial: { opacity: 0, x: -20 },
    animate: { opacity: 1, x: 0 },
    transition: { duration: config.duration }
  };
};

const getGoalAnimation = (event: MatchEvent, quality: MatchSettings['animationQuality'] = 'medium') => {
  const config = ANIMATION_CONFIG[quality];
  
  if (quality === 'low') {
    return {};
  }
  
  if (event.type === 'goal') {
    return {
      initial: { scale: 0, rotate: -180 },
      animate: { scale: 1, rotate: 0 },
      transition: config.springPhysics ? { type: 'spring' as const, stiffness: 150, damping: 12 } : { duration: config.duration }
    };
  }
  return {};
};

export function CommentaryFeed({ events, currentMinute, animationQuality = 'medium' }: CommentaryFeedProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [previousFilteredCount, setPreviousFilteredCount] = useState(0);

  // Filter events to only show those that have occurred up to the current minute
  const filteredEvents = useMemo(() => {
    return events.filter(event => event.minute <= currentMinute);
  }, [events, currentMinute]);

  // Create events with unique keys using index only (stable across renders)
  const eventsWithUniqueKeys = useMemo(() => {
    return filteredEvents.map((event, idx) => {
      return { ...event, uniqueKey: `event_${idx}` };
    });
  }, [filteredEvents]);

  // Only auto-scroll when new events are added (not on every minute change)
  useEffect(() => {
    const currentFilteredCount = filteredEvents.length;
    
    if (currentFilteredCount > previousFilteredCount && containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
    
    setPreviousFilteredCount(currentFilteredCount);
  }, [filteredEvents, previousFilteredCount]);

  const latestGoal = useMemo(() => {
    return events.filter(e => e.type === 'goal').pop();
  }, [events]);

  return (
    <div className="relative">
      {/* Goal celebration overlay */}
      <AnimatePresence>
        {latestGoal && latestGoal.intensity === 'dramatic' && currentMinute === latestGoal.minute && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 1, 0] }}
            exit={{ opacity: 0 }}
            transition={{ duration: 2 }}
            className="absolute inset-0 flex items-center justify-center pointer-events-none z-10"
          >
            <motion.div
              initial={{ scale: 0, rotate: -180 }}
              animate={{ scale: [0, 1.2, 1], rotate: [0, 15, -15, 0] }}
              transition={{ duration: 1.5, times: [0, 0.3, 0.6, 1] }}
              className="text-8xl drop-shadow-2xl"
            >
              ⚽
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div 
        ref={containerRef}
        className="h-64 overflow-y-auto space-y-2 p-2 bg-black/20 rounded-lg"
      >
        {eventsWithUniqueKeys.map((event) => (
          <motion.div
            key={event.uniqueKey}
              {...getAnimationVariant(event, animationQuality)}
              className={`
                p-3 rounded text-sm relative overflow-hidden
                ${intensityStyles[event.intensity]}
                ${event.highlight ? 'ring-1 ring-yellow-400/30' : ''}
                ${event.intensity === 'dramatic' ? 'animate-pulse' : ''}
              `}
            >
              {/* Goal celebration effect */}
              {event.type === 'goal' && event.intensity === 'dramatic' && animationQuality !== 'low' && (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: [1, 1.5, 2, 0] }}
                  transition={{ duration: 1 }}
                  className="absolute inset-0 bg-yellow-400/20 pointer-events-none"
                />
              )}
              
              <div className="flex items-start gap-2 relative z-10">
                <motion.span 
                  className="text-lg"
                  {...getGoalAnimation(event, animationQuality)}
                >
                  {eventTypeIcons[event.type] || '•'}
                </motion.span>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs text-white/50">
                      {event.minute}'
                    </span>
                    {event.player && (
                      <span className="text-xs font-semibold text-blue-300">
                        {event.player.name}
                      </span>
                    )}
                  </div>
                  <p className="mt-1 leading-relaxed">
                    {event.commentary}
                  </p>
                </div>
              </div>
              </motion.div>
            ))}
        
        {filteredEvents.length === 0 && currentMinute === 0 && (
          <div className="text-center text-white/40 py-8">
            <p>Aguardando início do jogo...</p>
          </div>
        )}
      </div>
    </div>
  );
}
