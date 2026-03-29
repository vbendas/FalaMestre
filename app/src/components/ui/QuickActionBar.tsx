'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Play, Users, Wallet, TrendingUp, Zap, Sparkles, MessageCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface QuickAction {
  id: string;
  label: string;
  icon: React.ReactNode;
  color: string;
  recommended?: boolean;
}

interface QuickActionBarProps {
  actions?: QuickAction[];
  onActionClick: (actionId: string) => void;
  disabled?: boolean;
  className?: string;
}

const defaultActions: QuickAction[] = [
  {
    id: 'chat',
    label: 'Chat',
    icon: <MessageCircle className="w-4 h-4" />,
    color: 'bg-[#009739] hover:bg-[#00b342] border-2 border-[#FEDD00]',
  },
  {
    id: 'play_match',
    label: 'Jogar',
    icon: <Play className="w-4 h-4" />,
    color: 'bg-[#012169] hover:bg-[#013399] border-2 border-[#FEDD00]/50',
    recommended: true,
  },
  {
    id: 'transfer_market',
    label: 'Mercado',
    icon: <Wallet className="w-4 h-4" />,
    color: 'bg-[#FF6B00] hover:bg-[#ff8533] border-2 border-[#FEDD00]/50',
  },
  {
    id: 'tactics',
    label: 'Táticas',
    icon: <TrendingUp className="w-4 h-4" />,
    color: 'bg-[#800080] hover:bg-[#993299] border-2 border-[#FEDD00]/50',
  },
  // NEW FEATURES
  {
    id: 'predictions',
    label: 'Previsões',
    icon: <TrendingUp className="w-4 h-4" />,
    color: 'bg-yellow-600 hover:bg-yellow-500 border-2 border-white/50',
  },
  {
    id: 'investments',
    label: 'Investir',
    icon: <Wallet className="w-4 h-4" />,
    color: 'bg-green-600 hover:bg-green-500 border-2 border-white/50',
  },
];

export function QuickActionBar({
  actions = defaultActions,
  onActionClick,
  disabled = false,
  className,
}: QuickActionBarProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 300, damping: 25 }}
      data-tutorial="quick-actions"
      className={cn(
        'flex gap-1.5 p-1.5 sm:p-2 bg-[#012169]/80 backdrop-blur-sm rounded-xl border-2 border-[#FEDD00]/30 overflow-x-auto',
        className
      )}
    >
      {actions.map((action, index) => (
        <motion.div
          key={action.id}
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: index * 0.05 }}
          className="relative flex-1 min-w-0"
        >
          {action.recommended && (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.3 + index * 0.05 }}
              className="absolute -top-1 -right-1 z-10"
            >
              <div className="bg-[#FF6B00] text-white text-[8px] font-bold px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                <Sparkles className="w-2 h-2" />
                <span>Hot</span>
              </div>
            </motion.div>
          )}
          <Button
            onClick={() => onActionClick(action.id)}
            disabled={disabled}
            className={cn(
              'w-full h-10 sm:h-11 text-white font-bold transition-all pixel-btn whitespace-nowrap',
              action.color,
              disabled && 'opacity-50 cursor-not-allowed'
            )}
          >
            <motion.div
              animate={action.recommended ? { scale: [1, 1.1, 1] } : {}}
              transition={{ duration: 1.5, repeat: Infinity }}
            >
              {action.icon}
            </motion.div>
            <span className="text-[10px] sm:text-xs font-[family-name:var(--font-retro)]">
              {action.label}
            </span>
          </Button>
        </motion.div>
      ))}
    </motion.div>
  );
}

interface TypingIndicatorProps {
  teamLogo?: string;
}

export function TypingIndicator({ teamLogo }: TypingIndicatorProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="flex justify-start gap-2"
    >
      {teamLogo ? (
        <div className="w-8 h-8 rounded-full overflow-hidden border-2 border-[#FEDD00]/50 flex-shrink-0">
          <img
            src={teamLogo}
            alt="AI"
            className="w-full h-full object-contain bg-white/10"
          />
        </div>
      ) : (
        <div className="w-8 h-8 rounded-full bg-[#009739] border-2 border-[#FEDD00] flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
          AI
        </div>
      )}
      <div className="bg-[#012169]/80 backdrop-blur rounded-2xl rounded-tl-sm px-4 py-3 border-2 border-[#FEDD00]/50">
        <div className="flex gap-1">
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              className="w-2.5 h-2.5 bg-[#FEDD00] rounded-full"
              animate={{
                y: [0, -8, 0],
                scale: [1, 1.2, 1],
              }}
              transition={{
                duration: 0.8,
                repeat: Infinity,
                delay: i * 0.15,
                ease: 'easeInOut',
              }}
            />
          ))}
        </div>
      </div>
    </motion.div>
  );
}

interface ContextualQuickActionsProps {
  context: 'initial' | 'after_match' | 'after_training' | 'idle';
  onActionClick: (actionId: string) => void;
  disabled?: boolean;
}

export function ContextualQuickActions({
  context,
  onActionClick,
  disabled,
}: ContextualQuickActionsProps) {
  const getActionsForContext = (): QuickAction[] => {
    switch (context) {
      case 'initial':
        return defaultActions.filter((a) => a.id === 'play_match' || a.id === 'view_squad' || a.id === 'predictions' || a.id === 'investments');
      case 'after_match':
        return defaultActions.filter((a) => a.id === 'view_squad' || a.id === 'play_match' || a.id === 'predictions' || a.id === 'investments');
      case 'after_training':
        return defaultActions.filter((a) => a.id === 'play_match' || a.id === 'predictions' || a.id === 'investments');
      case 'idle':
      default:
        return defaultActions;
    }
  };

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={context}
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: 20 }}
        transition={{ duration: 0.2 }}
      >
        <QuickActionBar
          actions={getActionsForContext()}
          onActionClick={onActionClick}
          disabled={disabled}
        />
      </motion.div>
    </AnimatePresence>
  );
}
