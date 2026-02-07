'use client';

import { Button } from '@/components/ui/button';
import { ViewType } from '@/hooks/useGameState';
import { motion } from 'framer-motion';
import { MessageSquare, Users, Trophy } from 'lucide-react';

interface ViewTabsProps {
  view: ViewType;
  onViewChange: (view: ViewType) => void;
  hasPendingMatch?: boolean;
}

const tabs = [
  { id: 'chat' as ViewType, label: 'Chat', icon: MessageSquare },
  { id: 'squad' as ViewType, label: 'Elenco', icon: Users },
  { id: 'match' as ViewType, label: 'Jogo', icon: Trophy },
];

export function ViewTabs({ view, onViewChange, hasPendingMatch }: ViewTabsProps) {
  return (
    <div className="flex gap-2 mb-4 p-2 bg-[#012169]/60 rounded border-2 border-[#FEDD00]/50 pixel-border-thin">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = view === tab.id;
        const isMatchTab = tab.id === 'match';
        
        return (
          <Button
            key={tab.id}
            variant="ghost"
            onClick={() => onViewChange(tab.id)}
            className={`
              flex-1 relative rounded transition-all duration-200 pixel-btn
              ${isActive 
                ? 'text-[#FEDD00] hover:text-[#ffea4d] bg-[#009739]/50 border-2 border-[#FEDD00]' 
                : 'text-white/70 hover:text-white hover:bg-[#009739]/30'
              }
            `}
          >
            <div className="flex items-center gap-2">
              <Icon className="w-4 h-4" />
              <span className="font-medium font-[family-name:var(--font-retro)]">{tab.label}</span>
              
              {/* Badge for pending match */}
              {isMatchTab && hasPendingMatch && (
                <motion.span
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="absolute -top-1 -right-1 w-4 h-4 bg-[#FF6B00] text-[10px] flex items-center justify-center font-bold pixel-border-thin"
                >
                  !
                </motion.span>
              )}
            </div>
            
            {/* Active indicator */}
            {isActive && (
              <motion.div
                layoutId="activeTab"
                className="absolute inset-0 bg-[#009739]/30 rounded -z-10 border-2 border-[#FEDD00]"
                transition={{ type: "spring", stiffness: 500, damping: 30 }}
              />
            )}
          </Button>
        );
      })}
    </div>
  );
}
