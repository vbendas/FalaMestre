'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ViewType } from '@/hooks/useGameState';
import { 
  Home, Users, Building, UserPlus, Trophy, 
  Search, BarChart3, Star, Target, Wallet,
  ChevronRight, ChevronDown, TrendingUp, DollarSign
} from 'lucide-react';

interface FloatingBottomNavProps {
  currentView: ViewType;
  onViewChange: (view: ViewType) => void;
}

const CLUSTER_TIME = [
  { id: 'squad' as ViewType, icon: Users, label: 'Elenco' },
  { id: 'standings' as ViewType, icon: BarChart3, label: 'Tabela' },
  { id: 'youth' as ViewType, icon: Star, label: 'Academia' },
  { id: 'apostas' as ViewType, icon: TrendingUp, label: 'Apostas' },
];

const CLUSTER_FINANCE = [
  { id: 'stadium' as ViewType, icon: Building, label: 'Estádio' },
  { id: 'staff' as ViewType, icon: UserPlus, label: 'Staff' },
  { id: 'facilities' as ViewType, icon: Target, label: 'Instalações' },
  { id: 'transfers' as ViewType, icon: Search, label: 'Transferências' },
  { id: 'investir' as ViewType, icon: DollarSign, label: 'Investir' },
];

export function FloatingBottomNav({ currentView, onViewChange }: FloatingBottomNavProps) {
  const [hoveredCluster, setHoveredCluster] = useState<'time' | 'finance' | null>(null);

  const isOnMatchPage = currentView === 'match';

  return (
    <motion.div
      initial={{ y: 100 }}
      animate={{ y: 0 }}
      className="fixed bottom-0 left-0 right-0 z-[100] bg-[#012169]"
    >
      {/* JOGAR / JOGAR AGORA Button - Full Width */}
      <motion.button
        onClick={() => onViewChange('match')}
        whileTap={{ scale: 0.98 }}
        animate={isOnMatchPage ? {
          boxShadow: [
            '0 0 10px 2px rgba(254, 221, 0, 0.2)',
            '0 0 15px 4px rgba(254, 221, 0, 0.3)',
            '0 0 10px 2px rgba(254, 221, 0, 0.2)'
          ]
        } : {}}
        transition={{
          duration: 2.5,
          repeat: Infinity,
          ease: "easeInOut"
        }}
        className={`w-full py-4 flex items-center justify-center gap-3 transition-all ${
          isOnMatchPage 
            ? 'bg-[#009739] text-white border-4 border-[#FEDD00] shadow-[0_0_15px_rgba(254,221,0,0.3)]' 
            : 'bg-[#009739] hover:bg-[#00b344] text-white border-none'
        }`}
      >
        <Trophy className="w-7 h-7" />
        <span className="text-xl font-bold tracking-widest">
          {isOnMatchPage ? 'JOGAR PARTIDA' : 'JOGAR PARTIDA'}
        </span>
      </motion.button>

      {/* Navigation Row */}
      <div className="flex divide-x divide-white/20">
        {/* Início - Always Visible */}
        <button
          onClick={() => onViewChange('dashboard')}
          className={`flex-1 py-3 flex flex-col items-center justify-center gap-0.5 transition-colors ${
            currentView === 'dashboard' ? 'bg-[#FEDD00]/20' : 'hover:bg-white/10'
          }`}
        >
          <Home className={`w-5 h-5 ${currentView === 'dashboard' ? 'text-[#FEDD00]' : 'text-white/70'}`} />
          <span className={`text-[10px] ${currentView === 'dashboard' ? 'text-[#FEDD00]' : 'text-white/70'}`}>
            Início
          </span>
        </button>

        {/* TIME Cluster */}
        <div 
          className="flex-1 relative"
          onMouseEnter={() => setHoveredCluster('time')}
          onMouseLeave={() => setHoveredCluster(null)}
        >
          <button
            className="w-full py-3 flex items-center justify-center gap-1 hover:bg-white/10 transition-colors"
          >
            <Users className="w-5 h-5 text-blue-400" />
            <span className="text-sm font-medium">TIME</span>
            {hoveredCluster !== 'time' ? (
              <ChevronDown className="w-3 h-3 text-white/50" />
            ) : (
              <ChevronRight className="w-3 h-3 text-[#FEDD00]" />
            )}
          </button>

          {/* TIME Sub-menu */}
          <AnimatePresence>
            {hoveredCluster === 'time' && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="absolute bottom-full left-0 right-0 bg-[#012169] border-b-2 border-[#FEDD00]/50"
              >
                {CLUSTER_TIME.map((item) => {
                  const Icon = item.icon;
                  const isActive = currentView === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => onViewChange(item.id)}
                      className={`w-full px-3 py-2 flex items-center gap-2 hover:bg-white/10 transition-colors ${
                        isActive ? 'bg-[#FEDD00]/20' : ''
                      }`}
                    >
                      <Icon className={`w-4 h-4 ${isActive ? 'text-[#FEDD00]' : 'text-white/70'}`} />
                      <span className={`text-sm ${isActive ? 'text-[#FEDD00]' : 'text-white'}`}>
                        {item.label}
                      </span>
                    </button>
                  );
                })}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* FINANCE Cluster */}
        <div 
          className="flex-1 relative"
          onMouseEnter={() => setHoveredCluster('finance')}
          onMouseLeave={() => setHoveredCluster(null)}
        >
          <button
            className="w-full py-3 flex items-center justify-center gap-1 hover:bg-white/10 transition-colors"
          >
            <Wallet className="w-5 h-5 text-green-400" />
            <span className="text-sm font-medium">FINANÇAS</span>
            {hoveredCluster !== 'finance' ? (
              <ChevronDown className="w-3 h-3 text-white/50" />
            ) : (
              <ChevronRight className="w-3 h-3 text-[#FEDD00]" />
            )}
          </button>

          {/* FINANCE Sub-menu */}
          <AnimatePresence>
            {hoveredCluster === 'finance' && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="absolute bottom-full left-0 right-0 bg-[#012169] border-b-2 border-[#FEDD00]/50"
              >
                {CLUSTER_FINANCE.map((item) => {
                  const Icon = item.icon;
                  const isActive = currentView === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => onViewChange(item.id)}
                      className={`w-full px-3 py-2 flex items-center gap-2 hover:bg-white/10 transition-colors ${
                        isActive ? 'bg-[#FEDD00]/20' : ''
                      }`}
                    >
                      <Icon className={`w-4 h-4 ${isActive ? 'text-[#FEDD00]' : 'text-white/70'}`} />
                      <span className={`text-sm ${isActive ? 'text-[#FEDD00]' : 'text-white'}`}>
                        {item.label}
                      </span>
                    </button>
                  );
                })}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
}