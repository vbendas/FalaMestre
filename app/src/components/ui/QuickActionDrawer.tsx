'use client';

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Menu, X, Settings, HelpCircle, Trophy, Users, Share2, LogOut, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DrawerItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  badge?: string;
  onClick: () => void;
}

interface QuickActionDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  items: DrawerItem[];
  teamName?: string;
  teamLogo?: string;
}

export function QuickActionDrawer({ isOpen, onClose, items, teamName, teamLogo }: QuickActionDrawerProps) {
  const drawerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (drawerRef.current && !drawerRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
          />

          {/* Drawer */}
          <motion.div
            ref={drawerRef}
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed top-0 right-0 bottom-0 w-80 bg-[#012169] z-50 shadow-2xl flex flex-col"
          >
            {/* Header */}
            <div className="p-4 border-b-2 border-[#FEDD00]/30">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {teamLogo ? (
                    <img src={teamLogo} alt={teamName} className="w-10 h-10 rounded-full" />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-[#FEDD00] flex items-center justify-center">
                      <Trophy className="w-5 h-5 text-[#012169]" />
                    </div>
                  )}
                  <div>
                    <p className="text-white font-bold text-sm">{teamName || 'Menu'}</p>
                    <p className="text-white/50 text-xs">Fala Mestre!</p>
                  </div>
                </div>
                <button
                  onClick={onClose}
                  className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-white/70" />
                </button>
              </div>
            </div>

            {/* Items */}
            <div className="flex-1 overflow-y-auto py-4">
              {items.map((item, index) => (
                <motion.button
                  key={item.id}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                  onClick={() => {
                    item.onClick();
                    onClose();
                  }}
                  whileHover={{ x: 5 }}
                  whileTap={{ scale: 0.98 }}
                  className="w-full flex items-center gap-4 px-4 py-3 hover:bg-white/5 transition-colors"
                >
                  <div className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center text-white/70">
                    {item.icon}
                  </div>
                  <span className="flex-1 text-left text-white font-medium">{item.label}</span>
                  {item.badge && (
                    <span className="px-2 py-0.5 bg-[#FF6B00] text-white text-xs font-bold rounded-full">
                      {item.badge}
                    </span>
                  )}
                  <ExternalLink className="w-4 h-4 text-white/30" />
                </motion.button>
              ))}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-white/10">
              <div className="flex items-center gap-4">
                <Settings className="w-4 h-4 text-white/30" />
                <span className="text-white/30 text-xs">v0.1.0</span>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

interface DrawerTriggerProps {
  onClick: () => void;
}

export function DrawerTrigger({ onClick }: DrawerTriggerProps) {
  return (
    <button
      onClick={onClick}
      className="p-2 hover:bg-white/10 rounded-lg transition-colors"
      aria-label="Abrir menu"
    >
      <Menu className="w-5 h-5 text-white/80" />
    </button>
  );
}

// Example items for the drawer
export const DEFAULT_DRAWER_ITEMS: DrawerItem[] = [
  {
    id: 'settings',
    label: 'Configurações',
    icon: <Settings className="w-5 h-5" />,
    onClick: () => console.log('Settings clicked'),
  },
  {
    id: 'help',
    label: 'Ajuda',
    icon: <HelpCircle className="w-5 h-5" />,
    onClick: () => console.log('Help clicked'),
  },
  {
    id: 'leaderboard',
    label: 'Classificação',
    icon: <Trophy className="w-5 h-5" />,
    onClick: () => console.log('Leaderboard clicked'),
  },
  {
    id: 'squad',
    label: 'Ver Elenco',
    icon: <Users className="w-5 h-5" />,
    onClick: () => console.log('Squad clicked'),
  },
  {
    id: 'share',
    label: 'Compartilhar',
    icon: <Share2 className="w-5 h-5" />,
    onClick: () => console.log('Share clicked'),
  },
];
