'use client';

import { motion } from 'framer-motion';
import { Home, Users, Trophy, Plus } from 'lucide-react';
import { ViewType } from '@/hooks/useGameState';
import { cn } from '@/lib/utils';

interface BottomNavProps {
  currentView: ViewType;
  onViewChange: (view: ViewType) => void;
  onPlayMatch?: () => void;
  hasPendingMatch?: boolean;
}

const navItems = [
  { id: 'dashboard' as ViewType, label: 'Início', icon: Home },
  { id: 'squad' as ViewType, label: 'Elenco', icon: Users },
  { id: 'match' as ViewType, label: 'Jogo', icon: Trophy },
];

export function BottomNav({ currentView, onViewChange, onPlayMatch, hasPendingMatch }: BottomNavProps) {
  return (
    <div data-tutorial="bottom-nav" className="fixed bottom-0 left-0 right-0 z-40 md:hidden">
      {/* Safe area inset for notched devices */}
      <div className="bg-[#012169]/95 backdrop-blur-lg border-t-2 border-[#FEDD00]/50 pb-safe texture-woven">
        <div className="flex items-center justify-around py-2 px-4">
          {/* Regular nav items */}
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentView === item.id;
            const isMatchTab = item.id === 'match';

            return (
              <button
                key={item.id}
                onClick={() => onViewChange(item.id)}
                className={cn(
                  'relative flex flex-col items-center justify-center px-4 py-2 rounded-lg transition-colors',
                  isActive ? 'text-[#FEDD00]' : 'text-white/60 hover:text-white'
                )}
              >
                <motion.div
                  animate={isActive ? { scale: 1.1 } : { scale: 1 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                  className="relative"
                >
                  <Icon className="w-6 h-6" />
                  {isMatchTab && hasPendingMatch && (
                    <motion.span
                      animate={{ scale: [1, 1.2, 1] }}
                      transition={{ duration: 1.5, repeat: Infinity }}
                      className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-[#FF6B00] rounded-full"
                    />
                  )}
                </motion.div>
                <span className="text-[10px] mt-1 font-medium">{item.label}</span>
                
                {isActive && (
                  <motion.div
                    layoutId="bottomNavActive"
                    className="absolute inset-0 bg-[#FEDD00]/10 rounded-lg -z-10"
                    transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                  />
                )}
              </button>
            );
          })}

          {/* Floating Action Button for Quick Match */}
          {onPlayMatch && (
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={onPlayMatch}
              className="relative flex items-center justify-center w-14 h-14 -mt-6 rounded-full bg-gradient-to-br from-[#009739] to-[#006400] shadow-lg shadow-[#009739]/30 border-2 border-[#FEDD00]"
            >
              <div className="absolute inset-0 rounded-full bg-gradient-to-br from-[#00b342] to-[#009739] opacity-0 hover:opacity-100 transition-opacity" />
              <Plus className="w-7 h-7 text-white relative z-10" />
              
              {/* Pulse ring */}
              <motion.div
                animate={{ scale: [1, 1.3, 1], opacity: [0.5, 0, 0.5] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="absolute inset-0 rounded-full border-2 border-[#FEDD00]/50"
              />
            </motion.button>
          )}
        </div>
      </div>
    </div>
  );
}
