'use client';

import React from 'react';
import { motion, useMotionValue, useTransform, animate } from 'framer-motion';
import { Heart, Trophy, Star, Calendar, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { GameState, Player } from '@/lib/types';
import { ViewType } from '@/hooks/useGameState';

interface StatCardProps {
  icon: React.ReactNode;
  value: number;
  label: string;
  color: string;
  suffix?: string;
}

function StatCard({ icon, value, label, color, suffix = '' }: StatCardProps) {
  const count = useMotionValue(0);
  const rounded = useTransform(count, (latest) => Math.round(latest));

  React.useEffect(() => {
    const controls = animate(count, value, {
      duration: 1.5,
      ease: "easeOut"
    });
    return controls.stop;
  }, [value, count]);

  const getTrend = () => {
    if (label === 'Moral') {
      return value >= 75 ? <TrendingUp className="w-3 h-3 text-green-400" /> : 
             value >= 50 ? <Minus className="w-3 h-3 text-yellow-400" /> : 
             <TrendingDown className="w-3 h-3 text-red-400" />;
    }
    if (label === 'Posição') {
      return value <= 3 ? <TrendingUp className="w-3 h-3 text-green-400" /> : 
             value <= 10 ? <Minus className="w-3 h-3 text-yellow-400" /> : 
             <TrendingDown className="w-3 h-3 text-red-400" />;
    }
    return null;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ scale: 1.02 }}
      className="bg-[#012169]/60 rounded p-4 border-2 border-[#FEDD00]/50 pixel-border-thin"
    >
      <div className="flex items-start justify-between">
        <div 
          className="w-10 h-10 rounded-lg flex items-center justify-center"
          style={{ backgroundColor: `${color}20` }}
        >
          {icon}
        </div>
        {getTrend()}
      </div>
      
      <div className="mt-3">
        <div className="text-2xl font-bold text-white">
          <motion.span>{rounded}</motion.span>
          {suffix}
        </div>
        <div className="text-xs text-white/50 mt-0.5">{label}</div>
      </div>
    </motion.div>
  );
}

interface PlayerCardProps {
  player: Player;
  index: number;
}

function PlayerCard({ player, index }: PlayerCardProps) {
  const overall = Math.round((player.pac + player.sho + player.pas + player.dri + player.def + player.phy) / 6);
  
  const getRatingColor = (rating: number) => {
    if (rating >= 75) return 'bg-green-500';
    if (rating >= 65) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  const getPositionColor = (pos: string) => {
    switch (pos) {
      case 'GK': return 'bg-purple-500';
      case 'DEF': return 'bg-blue-500';
      case 'MID': return 'bg-green-500';
      case 'FWD': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.05 }}
      whileHover={{ scale: 1.02, backgroundColor: 'rgba(255,255,255,0.1)' }}
      className="bg-white/5 rounded-lg p-3 border border-white/10 flex items-center gap-3 cursor-pointer transition-colors"
    >
      {/* Overall Rating */}
      <div className={`w-10 h-10 rounded-full ${getRatingColor(overall)} flex items-center justify-center text-white font-bold text-sm`}>
        {overall}
      </div>
      
      {/* Player Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className={`px-2 py-0.5 rounded text-[10px] font-bold text-white ${getPositionColor(player.position)}`}>
            {player.position}
          </span>
          <span className="font-medium text-white truncate">{player.name}</span>
        </div>
        
        {/* Mini attribute bars */}
        <div className="flex gap-1 mt-1.5">
          {[
            { label: 'PAC', value: player.pac },
            { label: 'SHO', value: player.sho },
            { label: 'PAS', value: player.pas },
          ].map((attr) => (
            <div key={attr.label} className="flex-1">
              <div className="flex justify-between text-[8px] text-white/40 mb-0.5">
                <span>{attr.label}</span>
              </div>
              <div className="h-1 bg-white/10 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${attr.value}%` }}
                  transition={{ delay: index * 0.05 + 0.3, duration: 0.5 }}
                  className={`h-full rounded-full ${getRatingColor(attr.value)}`}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}

// Formation View Component
function FormationView({ players }: { players: Player[] }) {
  const positions = [
    // GK
    { x: 50, y: 90, pos: 'GK' },
    // DEF
    { x: 20, y: 70, pos: 'DEF' },
    { x: 40, y: 70, pos: 'DEF' },
    { x: 60, y: 70, pos: 'DEF' },
    { x: 80, y: 70, pos: 'DEF' },
    // MID
    { x: 30, y: 45, pos: 'MID' },
    { x: 50, y: 45, pos: 'MID' },
    { x: 70, y: 45, pos: 'MID' },
    // FWD
    { x: 25, y: 20, pos: 'FWD' },
    { x: 50, y: 20, pos: 'FWD' },
    { x: 75, y: 20, pos: 'FWD' },
  ];

  const getPositionColor = (pos: string) => {
    switch (pos) {
      case 'GK': return '#8B5CF6';
      case 'DEF': return '#3B82F6';
      case 'MID': return '#10B981';
      case 'FWD': return '#EF4444';
      default: return '#6B7280';
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className="relative bg-[#006400]/80 rounded overflow-hidden border-4 border-[#FEDD00] aspect-[3/4] pixel-border"
    >
      {/* Pitch markings */}
      <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
        {/* Center line */}
        <line x1="0" y1="50" x2="100" y2="50" stroke="rgba(255,255,255,0.2)" strokeWidth="0.5" />
        {/* Center circle */}
        <circle cx="50" cy="50" r="10" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="0.5" />
        {/* Penalty areas */}
        <rect x="20" y="0" width="60" height="20" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="0.5" />
        <rect x="20" y="80" width="60" height="20" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="0.5" />
      </svg>
      
      {/* Player dots */}
      {positions.map((pos, idx) => {
        const player = players[idx];
        if (!player) return null;
        
        return (
          <motion.div
            key={idx}
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: idx * 0.1, type: "spring" }}
            whileHover={{ scale: 1.2 }}
            className="absolute w-8 h-8 -ml-4 -mt-4 rounded-full flex items-center justify-center text-white text-xs font-bold cursor-pointer shadow-lg"
            style={{
              left: `${pos.x}%`,
              top: `${pos.y}%`,
              backgroundColor: getPositionColor(pos.pos),
              boxShadow: `0 0 10px ${getPositionColor(pos.pos)}50`
            }}
            title={player.name}
          >
            {player.position}
          </motion.div>
        );
      })}
    </motion.div>
  );
}

interface SquadViewProps {
  gameState: GameState;
  onViewChange: (view: ViewType) => void;
}

export function SquadView({ gameState, onViewChange }: SquadViewProps) {
  const { squad, season, user } = gameState;
  
  // Group players by position
  const playersByPosition = {
    GK: squad.players.filter(p => p.position === 'GK'),
    DEF: squad.players.filter(p => p.position === 'DEF'),
    MID: squad.players.filter(p => p.position === 'MID'),
    FWD: squad.players.filter(p => p.position === 'FWD'),
  };

  const positionLabels = {
    GK: 'Goleiros',
    DEF: 'Defensores',
    MID: 'Meio-campistas',
    FWD: 'Atacantes'
  };

  return (
    <div className="space-y-4">
      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-3">
        <StatCard
          icon={<Heart className="w-5 h-5" style={{ color: '#EF4444' }} />}
          value={squad.morale}
          label="Moral"
          color="#EF4444"
          suffix="%"
        />
        <StatCard
          icon={<Trophy className="w-5 h-5" style={{ color: '#F59E0B' }} />}
          value={season.position}
          label="Posição"
          color="#F59E0B"
          suffix="º"
        />
        <StatCard
          icon={<Star className="w-5 h-5" style={{ color: '#3B82F6' }} />}
          value={season.points}
          label="Pontos"
          color="#3B82F6"
        />
        <StatCard
          icon={<Calendar className="w-5 h-5" style={{ color: '#8B5CF6' }} />}
          value={season.week}
          label="Semana"
          color="#8B5CF6"
        />
      </div>

      {/* Formation View */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white/5 rounded-xl p-4 border border-white/10"
      >
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-bold text-white">Formação 4-3-3</h3>
          <span className="text-xs text-white/50">{user.team}</span>
        </div>
        <FormationView players={squad.players} />
      </motion.div>

      {/* Players List */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="bg-[#012169]/60 rounded p-4 border-2 border-[#FEDD00]/50 pixel-border-thin"
      >
        <h3 className="font-bold text-white mb-3">Elenco</h3>
        
        <div className="space-y-4 max-h-[300px] overflow-y-auto pr-2">
          {(Object.keys(playersByPosition) as Array<keyof typeof playersByPosition>).map((pos) => (
            <div key={pos}>
              <div className="text-xs font-medium text-white/40 uppercase tracking-wider mb-2">
                {positionLabels[pos]}
              </div>
              <div className="space-y-2">
                {playersByPosition[pos].map((player, idx) => (
                  <PlayerCard key={player.id} player={player} index={idx} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
