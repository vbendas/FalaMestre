'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { GameState, YouthPlayer, TrainingFocus } from '@/lib/types';
import { ViewType } from '@/hooks/useGameState';
import { GraduationCap, ChevronLeft, Star, Check, X, Target } from 'lucide-react';

interface YouthAcademyViewProps {
  gameState: GameState;
  userId: string;
  onViewChange: (view: ViewType) => void;
}

export function YouthAcademyView({ gameState, userId, onViewChange }: YouthAcademyViewProps) {
  const { user, facilities, season } = gameState;
  const [players, setPlayers] = useState<YouthPlayer[]>([]);
  const [loading, setLoading] = useState(false);
  const [weeksUntilIntake, setWeeksUntilIntake] = useState(4);
  const [focus, setFocus] = useState<TrainingFocus>(null);

  useEffect(() => {
    const academy = gameState.youthAcademy;
    if (academy) {
      setPlayers(academy.playersAvailable || []);
      setFocus(academy.trainingFocus);
      const weeks = academy.nextIntakeWeek - season.week;
      setWeeksUntilIntake(Math.max(0, weeks));
    }
  }, [gameState.youthAcademy, season.week]);

  const handleGenerateIntake = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/youth?userId=${userId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'generate' }),
      });

      if (response.ok) {
        const data = await response.json();
        setPlayers(data.players || []);
        setWeeksUntilIntake(4);
        window.location.reload();
      }
    } catch (error) {
      console.error('Failed to generate intake:', error);
    }
    setLoading(false);
  };

  const handleSignPlayer = async (playerId: string) => {
    try {
      const response = await fetch(`/api/youth?userId=${userId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'sign', playerId }),
      });

      if (response.ok) {
        setPlayers(prev => prev.filter(p => p.id !== playerId));
      }
    } catch (error) {
      console.error('Failed to sign player:', error);
    }
  };

  const handleRejectPlayer = async (playerId: string) => {
    try {
      const response = await fetch(`/api/youth?userId=${userId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reject', playerId }),
      });

      if (response.ok) {
        setPlayers(prev => prev.filter(p => p.id !== playerId));
      }
    } catch (error) {
      console.error('Failed to reject player:', error);
    }
  };

  const handleSetFocus = async (newFocus: TrainingFocus) => {
    try {
      const response = await fetch(`/api/youth?userId=${userId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'set-focus', focus: newFocus }),
      });

      if (response.ok) {
        setFocus(newFocus);
      }
    } catch (error) {
      console.error('Failed to set focus:', error);
    }
  };

  const renderStars = (stars: number) => {
    return (
      <div className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map(i => (
          <Star
            key={i}
            className={`w-3 h-3 ${i <= stars ? 'text-yellow-400 fill-yellow-400' : 'text-gray-600'}`}
          />
        ))}
      </div>
    );
  };

  const academyLevel = facilities.youthAcademy;

  return (
    <div className="p-4 space-y-4">
      {/* Back button */}
      <button
        onClick={() => onViewChange('dashboard')}
        className="flex items-center gap-2 text-white/60 hover:text-white"
      >
        <ChevronLeft className="w-5 h-5" />
        Voltar
      </button>

      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-[#006400] rounded-xl p-4 border-2 border-[#FEDD00]/50"
      >
        <div className="flex items-center gap-3">
          <GraduationCap className="w-8 h-8 text-pink-400" />
          <div>
            <h2 className="text-xl font-bold text-white">Academia Juvenil</h2>
            <p className="text-sm text-white/60">Nível {academyLevel} •Próxima turma em {weeksUntilIntake} semanas</p>
          </div>
        </div>
      </motion.div>

      {/* Generate Intake Button */}
      {players.length === 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-[#006400] rounded-xl p-4 border-2 border-[#FEDD00]/50 text-center"
        >
          <p className="text-white mb-3">Próxima turma de jogadores juniores:</p>
          <p className="text-3xl font-bold text-[#FEDD00] mb-3">{weeksUntilIntake} semanass</p>
          
          {academyLevel === 0 ? (
            <p className="text-red-400 text-sm">Construa sua Academia Juvenil para receber jogadores!</p>
          ) : (
            <button
              onClick={handleGenerateIntake}
              disabled={loading}
              className="px-6 py-2 bg-[#FEDD00] text-black font-bold rounded-lg hover:bg-[#ffea4d] disabled:opacity-50"
            >
              {loading ? 'Gerando...' : 'Gerar Nova Turma'}
            </button>
          )}
        </motion.div>
      )}

      {/* Training Focus */}
      {players.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-[#006400] rounded-xl p-4 border-2 border-[#FEDD00]/30"
        >
          <div className="flex items-center gap-2 mb-3">
            <Target className="w-5 h-5 text-green-400" />
            <h3 className="font-bold text-white">Foco de Treinamento</h3>
          </div>
          
          <div className="grid grid-cols-3 gap-2">
            {(['technical', 'physical', 'tactical'] as const).map((f) => (
              <button
                key={f}
                onClick={() => handleSetFocus(f)}
                className={`p-2 rounded-lg text-sm font-medium capitalize ${
                  focus === f
                    ? 'bg-green-500 text-white'
                    : 'bg-[#004d00] text-white/60 hover:bg-[#005500]'
                }`}
              >
                {f === 'technical' && 'Técnico'}
                {f === 'physical' && 'Físico'}
                {f === 'tactical' && 'Tático'}
              </button>
            ))}
          </div>
        </motion.div>
      )}

      {/* Youth Players List */}
      {players.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-lg font-bold text-white">Jogadores Disponíveis</h3>
          
          {players.map((player, index) => (
            <motion.div
              key={player.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.1 }}
              className="bg-[#006400] rounded-xl p-4 border-2 border-[#FEDD00]/30"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                      player.position === 'GK' ? 'bg-yellow-500/20 text-yellow-400' :
                      player.position === 'DEF' ? 'bg-blue-500/20 text-blue-400' :
                      player.position === 'MID' ? 'bg-green-500/20 text-green-400' :
                      'bg-red-500/20 text-red-400'
                    }`}>
                      {player.position}
                    </span>
                    <span className="font-bold text-white">{player.name}</span>
                  </div>
                  
                  <div className="flex items-center gap-4 text-sm text-white/60">
                    <span>Idade: {player.age} anos</span>
                    <span>CA: {player.currentAbility}</span>
                    <span>PA: {player.potential}</span>
                  </div>
                  
                  <div className="mt-2 flex items-center gap-1 text-xs">
                    <span className="text-white/40">Scout:</span>
                    {renderStars(player.scoutAssessment)}
                  </div>
                  
                  <div className="mt-2 flex flex-wrap gap-1">
                    {player.personalityTraits.map((trait, i) => (
                      <span key={i} className="text-xs px-2 py-0.5 bg-[#004d00] rounded text-white/50">
                        {trait}
                      </span>
                    ))}
                  </div>
                </div>
                
                <div className="flex gap-2">
                  <button
                    onClick={() => handleRejectPlayer(player.id)}
                    className="p-2 bg-red-900/50 hover:bg-red-800/50 rounded-lg"
                  >
                    <X className="w-5 h-5 text-red-400" />
                  </button>
                  <button
                    onClick={() => handleSignPlayer(player.id)}
                    className="p-2 bg-green-900/50 hover:bg-green-800/50 rounded-lg"
                  >
                    <Check className="w-5 h-5 text-green-400" />
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Balance */}
      <div className="bg-[#004d00] rounded-lg p-3 text-center">
        <p className="text-white/60 text-sm">Saldo Atual</p>
        <p className="text-2xl font-bold text-[#FEDD00]">$$ {(user.money || 0).toLocaleString()}</p>
      </div>
    </div>
  );
}