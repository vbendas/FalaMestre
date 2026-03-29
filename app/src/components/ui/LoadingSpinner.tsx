'use client';

import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  showText?: boolean;
  text?: string;
}

const sizeClasses = {
  sm: 'w-8 h-8',
  md: 'w-12 h-12',
  lg: 'w-16 h-16',
  xl: 'w-24 h-24',
};

export function LoadingSpinner({ 
  size = 'md', 
  className,
  showText = false,
  text = 'Carregando...'
}: LoadingSpinnerProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-4">
      <div className={cn('relative', sizeClasses[size], className)}>
        {/* Outer ring */}
        <motion.div
          className="absolute inset-0 rounded-full border-4 border-[#FEDD00]/20"
          animate={{ rotate: 360 }}
          transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
        />
        
        {/* Spinning arc */}
        <motion.div
          className="absolute inset-0 rounded-full border-4 border-transparent border-t-[#FEDD00]"
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
        />
        
        {/* Inner spinning arc */}
        <motion.div
          className="absolute inset-2 rounded-full border-4 border-transparent border-b-[#009739]"
          animate={{ rotate: -360 }}
          transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
        />
        
        {/* Center football icon */}
        <div className="absolute inset-0 flex items-center justify-center">
          <motion.div
            animate={{ 
              rotate: [0, 360],
              scale: [1, 1.1, 1]
            }}
            transition={{ 
              duration: 2, 
              repeat: Infinity, 
              ease: 'easeInOut' 
            }}
            className="text-2xl"
          >
            ⚽
          </motion.div>
        </div>
      </div>
      
      {showText && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="text-center"
        >
          <p className="text-[#FEDD00] font-medium font-[family-name:var(--font-retro)]">
            {text}
          </p>
          <motion.div
            className="h-1 bg-[#FEDD00]/30 rounded-full mt-2 overflow-hidden max-w-[120px]"
          >
            <motion.div
              className="h-full bg-[#FEDD00]"
              animate={{ x: ['-100%', '100%'] }}
              transition={{ duration: 1, repeat: Infinity, ease: 'easeInOut' }}
            />
          </motion.div>
        </motion.div>
      )}
    </div>
  );
}

interface FootballSpinnerProps {
  className?: string;
}

export function FootballSpinner({ className }: FootballSpinnerProps) {
  return (
    <motion.div
      className={cn('relative w-16 h-16', className)}
      animate={{ rotate: 360 }}
      transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
    >
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="text-4xl">⚽</div>
      </div>
      {/* Motion trail effect */}
      <motion.div
        className="absolute inset-0"
        animate={{ scale: [1, 1.3, 1], opacity: [0.3, 0, 0.3] }}
        transition={{ duration: 1, repeat: Infinity }}
      >
        <div className="w-full h-full rounded-full border-2 border-[#FEDD00]/30" />
      </motion.div>
    </motion.div>
  );
}

interface StadiumSpinnerProps {
  className?: string;
}

export function StadiumSpinner({ className }: StadiumSpinnerProps) {
  return (
    <div className={cn('relative w-20 h-20', className)}>
      {/* Stadium outline */}
      <svg viewBox="0 0 100 100" className="w-full h-full">
        {/* Pitch */}
        <rect x="10" y="20" width="80" height="60" fill="none" stroke="#FEDD00" strokeWidth="2" rx="2" />
        {/* Center line */}
        <line x1="10" y1="50" x2="90" y2="50" stroke="#FEDD00" strokeWidth="1" strokeDasharray="4,4" />
        {/* Center circle */}
        <circle cx="50" cy="50" r="12" fill="none" stroke="#FEDD00" strokeWidth="1.5" />
        {/* Center dot */}
        <circle cx="50" cy="50" r="2" fill="#FEDD00" />
        {/* Goals */}
        <rect x="8" y="42" width="4" height="16" fill="none" stroke="#009739" strokeWidth="2" />
        <rect x="88" y="42" width="4" height="16" fill="none" stroke="#009739" strokeWidth="2" />
      </svg>
      
      {/* Animated ball */}
      <motion.div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-xl"
        animate={{ 
          x: [0, 20, 0, -20, 0],
          y: [0, -10, 0, 10, 0],
          rotate: [0, 180, 360, 540, 720]
        }}
        transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
      >
        ⚽
      </motion.div>
    </div>
  );
}

interface TrophySpinnerProps {
  className?: string;
}

export function TrophySpinner({ className }: TrophySpinnerProps) {
  return (
    <motion.div
      className={cn('relative', className)}
      animate={{ 
        rotate: [0, 10, 0, -10, 0],
        scale: [1, 1.05, 1, 1.05, 1]
      }}
      transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
    >
      <div className="text-4xl">🏆</div>
      {/* Sparkle effect */}
      <motion.div
        className="absolute -top-1 -right-1"
        animate={{ scale: [0, 1, 0], opacity: [0, 1, 0] }}
        transition={{ duration: 1.5, repeat: Infinity, delay: 0.5 }}
      >
        ✨
      </motion.div>
    </motion.div>
  );
}
