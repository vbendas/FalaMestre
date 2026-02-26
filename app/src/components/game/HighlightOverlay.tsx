'use client';

import { useEffect, useRef } from 'react';
import { MatchEvent } from '@/lib/types';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';

interface HighlightOverlayProps {
  event: MatchEvent;
  homeTeam: string;
  awayTeam: string;
  homeColor: string;
  awayColor: string;
  onSkip: () => void;
}

export function HighlightOverlay({
  event,
  homeTeam,
  awayTeam,
  homeColor,
  awayColor,
  onSkip,
}: HighlightOverlayProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Play placeholder sound effect
  useEffect(() => {
    // Placeholder: Create a simple beep sound using Web Audio API
    const playPlaceholderSound = () => {
      try {
        const audioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        // Different sounds based on event type
        if (event.type === 'goal') {
          // celebratory tone
          oscillator.frequency.setValueAtTime(523.25, audioContext.currentTime); // C5
          oscillator.frequency.setValueAtTime(659.25, audioContext.currentTime + 0.1); // E5
          oscillator.frequency.setValueAtTime(783.99, audioContext.currentTime + 0.2); // G5
          gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
          gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
          oscillator.start(audioContext.currentTime);
          oscillator.stop(audioContext.currentTime + 0.5);
        } else if (event.type === 'card') {
          // lower warning tone
          oscillator.frequency.setValueAtTime(200, audioContext.currentTime);
          oscillator.frequency.setValueAtTime(150, audioContext.currentTime + 0.2);
          gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
          gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.4);
          oscillator.start(audioContext.currentTime);
          oscillator.stop(audioContext.currentTime + 0.4);
        } else if (event.type === 'corner') {
          // whistle-like tone
          oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
          oscillator.frequency.setValueAtTime(600, audioContext.currentTime + 0.15);
          gainNode.gain.setValueAtTime(0.2, audioContext.currentTime);
          gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
          oscillator.start(audioContext.currentTime);
          oscillator.stop(audioContext.currentTime + 0.3);
        } else {
          // default highlight sound
          oscillator.frequency.setValueAtTime(440, audioContext.currentTime);
          gainNode.gain.setValueAtTime(0.2, audioContext.currentTime);
          gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2);
          oscillator.start(audioContext.currentTime);
          oscillator.stop(audioContext.currentTime + 0.2);
        }
      } catch (e) {
        // Audio not supported or blocked
        console.log('Audio not available');
      }
    };

    playPlaceholderSound();
  }, [event.type]);

  // Get event-specific content
  const getEventContent = () => {
    switch (event.type) {
      case 'goal':
        return {
          title: 'GOOOOL!',
          subtitle: event.team === 'home' ? homeTeam : awayTeam,
          color: event.team === 'home' ? homeColor : awayColor,
          emoji: '⚽',
        };
      case 'foul':
        return {
          title: 'FALTA!',
          subtitle: event.team === 'home' ? homeTeam : awayTeam,
          color: '#FFD700',
          emoji: '🎯',
        };
      case 'card':
        return {
          title: 'EXPULSO!',
          subtitle: event.player?.name || 'Jogador',
          color: '#FF0000',
          emoji: '🟥',
        };
      case 'save':
        return {
          title: 'DEFESA!',
          subtitle: 'Que defesa!',
          color: '#00FF00',
          emoji: '🧤',
        };
      default:
        return {
          title: event.type.toUpperCase(),
          subtitle: event.description || '',
          color: '#FFD700',
          emoji: '🔥',
        };
    }
  };

  const content = getEventContent();

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      className="fixed inset-0 z-50 flex items-center justify-center"
      onClick={onSkip}
      style={{
        background: `radial-gradient(circle at center, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0.95) 100%)`,
      }}
    >
      {/* Skip button */}
      <button
        onClick={onSkip}
        className="absolute top-4 right-4 z-10 p-2 bg-black/50 hover:bg-black/70 rounded-full text-white/80 hover:text-white transition-colors"
      >
        <X className="w-6 h-6" />
      </button>

      {/* Tap anywhere hint */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 0.6, y: 0 }}
        transition={{ delay: 0.5 }}
        className="absolute bottom-8 text-white/60 text-sm"
      >
        Toque em qualquer lugar para pular
      </motion.div>

      {/* Main content */}
      <AnimatePresence>
        <motion.div
          key={event.id}
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 1.2, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 200, damping: 20 }}
          className="text-center"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Emoji */}
          <motion.div
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ delay: 0.1, type: 'spring', stiffness: 150 }}
            className="text-8xl mb-4"
          >
            {content.emoji}
          </motion.div>

          {/* Title */}
          <motion.h1
            initial={{ y: 50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="text-6xl font-black pixel-text mb-2"
            style={{ 
              color: content.color,
              textShadow: `0 0 30px ${content.color}, 0 0 60px ${content.color}`,
            }}
          >
            {content.title}
          </motion.h1>

          {/* Subtitle */}
          <motion.p
            initial={{ y: 30, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="text-2xl font-bold text-white"
          >
            {content.subtitle}
          </motion.p>

          {/* Commentary */}
          {event.commentary && (
            <motion.p
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.4 }}
              className="text-white/80 mt-4 max-w-md mx-auto px-4"
            >
              {event.commentary}
            </motion.p>
          )}

          {/* Score indicator */}
          {event.type === 'goal' && (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.5, type: 'spring' }}
              className="mt-6 inline-flex items-center gap-4 px-6 py-3 bg-black/60 rounded-full"
            >
              <span className="text-2xl font-bold" style={{ color: homeColor }}>
                {event.team === 'home' ? '⚽' : '⚽'}
              </span>
              <span className="text-white text-xl font-bold">VS</span>
              <span className="text-2xl font-bold" style={{ color: awayColor }}>
                {event.team === 'away' ? '⚽' : '⚽'}
              </span>
            </motion.div>
          )}

          {/* Minute badge */}
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.6 }}
            className="absolute -bottom-16 left-1/2 -translate-x-1/2 px-4 py-1 bg-white/20 rounded-full text-white/80 text-sm"
          >
            {event.minute}'
          </motion.div>
        </motion.div>
      </AnimatePresence>
    </motion.div>
  );
}
