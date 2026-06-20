'use client';

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { GameState } from '@/lib/types';
import { ViewType } from '@/hooks/useGameState';
import { CoinDisplay } from './CoinDisplay';
import { NotificationBadge } from './NotificationBadge';

const NAV_ITEMS: { key: ViewType; icon: string; label: string }[] = [
  { key: 'dashboard', icon: '⚽', label: 'JOGO' },
  { key: 'squad', icon: '👥', label: 'ELENCO' },
  { key: 'transfers', icon: '🏪', label: 'MERCADO' },
  { key: 'standings', icon: '🏆', label: 'LIGA' },
];

const MORE_ITEMS: { key: ViewType; icon: string; label: string }[] = [
  { key: 'stadium', icon: '🏟️', label: 'ESTÁDIO' },
  { key: 'facilities', icon: '⚙️', label: 'INSTALAÇÕES' },
  { key: 'youth', icon: '🌟', label: 'ACADEMIA' },
  { key: 'staff', icon: '👔', label: 'STAFF' },
  { key: 'apostas', icon: '🎯', label: 'APOSTAS' },
  { key: 'investir', icon: '📈', label: 'INVESTIR' },
];

interface SidebarNavProps {
  view: ViewType;
  onViewChange: (view: ViewType) => void;
  gameState: GameState | null;
  notificationCount?: number;
  className?: string;
}

export function SidebarNav({
  view,
  onViewChange,
  gameState,
  notificationCount = 0,
  className,
}: SidebarNavProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const teamName = gameState?.user?.team || 'TIME';
  const money = gameState?.user?.money ?? 0;
  const round = gameState?.season?.week ?? 0;

  const handleNavClick = useCallback((key: ViewType) => {
    onViewChange(key);
    setDrawerOpen(false);
  }, [onViewChange]);

  const sidebarContent = (
    <nav
      className={cn(
        'flex flex-col h-full bg-[rgba(0,8,3,0.92)] border-r border-[rgba(255,223,0,0.20)]',
        className
      )}
      style={{ width: 180, minWidth: 180 }}
    >
      <div className="p-3 border-b border-[rgba(255,223,0,0.15)] text-center">
        <div className="w-8 h-8 mx-auto rounded bg-[#FFDF00] flex items-center justify-center text-[#00381a] text-lg font-bold">
          ⚽
        </div>
        <div className="text-[0.5rem] gold-glow-text font-[family-name:var(--font-pixel)] mt-1 truncate">
          {teamName.toUpperCase()}
        </div>
        <div className="text-[0.5rem] text-[#55e0a0] font-[family-name:var(--font-pixel)] mt-0.5">
          SÉRIE D · RD.{round}
        </div>
      </div>

      <div className="flex-1 py-1">
        {NAV_ITEMS.map((item) => (
          <NavItem
            key={item.key}
            icon={item.icon}
            label={item.label}
            active={view === item.key}
            onClick={() => handleNavClick(item.key)}
          />
        ))}

        <div className="h-px bg-[rgba(255,223,0,0.1)] mx-3 my-1" />

        {MORE_ITEMS.map((item) => (
          <NavItem
            key={item.key}
            icon={item.icon}
            label={item.label}
            active={view === item.key}
            onClick={() => handleNavClick(item.key)}
          />
        ))}
      </div>

      <div className="p-3 border-t border-[rgba(255,223,0,0.15)] flex items-center justify-between">
        <CoinDisplay amount={money} size="sm" />
        <div className="relative">
          <span className="text-white text-sm cursor-pointer hover:text-[#FFDF00]">🔔</span>
          <NotificationBadge count={notificationCount} />
        </div>
      </div>
    </nav>
  );

  return (
    <>
      {/* Hamburger — visible only on mobile */}
      <button
        onClick={() => setDrawerOpen(true)}
        className="md:hidden fixed top-3 left-3 z-50 w-10 h-10 flex items-center justify-center rounded bg-[rgba(0,8,3,0.9)] border border-[rgba(255,223,0,0.3)] text-[#FFDF00] active:scale-95 transition-transform"
        aria-label="Abrir menu"
      >
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <line x1="3" y1="5" x2="17" y2="5" />
          <line x1="3" y1="10" x2="17" y2="10" />
          <line x1="3" y1="15" x2="17" y2="15" />
        </svg>
      </button>

      {/* Desktop sidebar — always visible on md+ */}
      <div className="hidden md:flex h-full">
        {sidebarContent}
      </div>

      {/* Mobile drawer overlay */}
      <AnimatePresence>
        {drawerOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-40 bg-black/60 md:hidden"
              onClick={() => setDrawerOpen(false)}
            />
            <motion.div
              initial={{ x: -200 }}
              animate={{ x: 0 }}
              exit={{ x: -200 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="fixed inset-y-0 left-0 z-50 md:hidden"
            >
              {sidebarContent}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}

function NavItem({
  icon,
  label,
  active,
  onClick,
}: {
  icon: string;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full flex items-center gap-2 px-3 py-2 text-left transition-all active:scale-[0.94]',
        active
          ? 'border-l-[3px] border-[#FFDF00] bg-[rgba(255,223,0,0.08)] text-[#FFDF00]'
          : 'border-l-[3px] border-transparent text-[rgba(255,223,0,0.40)] hover:text-[rgba(255,223,0,0.7)] hover:bg-[rgba(255,223,0,0.04)]'
      )}
    >
      <span className="text-sm">{icon}</span>
      <span className="font-[family-name:var(--font-pixel)] text-[0.5rem]">
        {label}
      </span>
    </button>
  );
}
