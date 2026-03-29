'use client';

import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Table, Trophy, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { GameState } from '@/lib/types';
import { TEAMS } from '@/lib/team-data';

interface StandingsViewProps {
  gameState: GameState;
}

interface LeagueEntry {
  name: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  gf: number;
  ga: number;
  gd: number;
  points: number;
  isUser: boolean;
  form: 'up' | 'down' | 'stable';
}

function generateFullStandings(
  userTeam: string,
  userPosition: number,
  userPoints: number,
  userWins: number,
  userDraws: number,
  userLosses: number,
  week: number
): LeagueEntry[] {
  const played = userWins + userDraws + userLosses;
  const entries: LeagueEntry[] = [];

  entries.push({
    name: userTeam,
    played,
    won: userWins,
    drawn: userDraws,
    lost: userLosses,
    gf: Math.floor(userPoints * 0.8 + userWins * 2),
    ga: Math.floor(userPoints * 0.3 + userLosses * 2),
    gd: 0,
    points: userPoints,
    isUser: true,
    form: userPosition <= 6 ? 'up' : userPosition >= 16 ? 'down' : 'stable',
  });

  const otherTeams = TEAMS.filter(t => t.name !== userTeam);
  otherTeams.forEach((team) => {
    const pts = Math.max(0, userPoints + Math.floor(Math.random() * 14 - 7));
    const pld = Math.max(0, played + Math.floor(Math.random() * 2 - 1));
    const w = Math.max(0, Math.floor(pts / 3.2));
    const d = Math.max(0, Math.min(pld, Math.floor((pts - w * 3) / 1)));
    const l = Math.max(0, pld - w - d);
    const gf = Math.floor(pts * 0.7 + w * 2);
    const ga = Math.floor((pld - pts / 3) * 1.5 + l);

    entries.push({
      name: team.name,
      played: pld,
      won: w,
      drawn: d,
      lost: l,
      gf,
      ga,
      gd: gf - ga,
      points: pts,
      isUser: false,
      form: ['up', 'down', 'stable'][Math.floor(Math.random() * 3)] as 'up' | 'down' | 'stable',
    });
  });

  entries.forEach(e => { e.gd = e.gf - e.ga; });
  entries.sort((a, b) => b.points - a.points || b.gd - a.gd);

  return entries;
}

export function StandingsView({ gameState }: StandingsViewProps) {
  const { season, user } = gameState;

  const standings = useMemo(
    () => generateFullStandings(
      user.team,
      season.position,
      season.points,
      season.wins,
      season.draws,
      season.losses,
      season.week
    ),
    [user.team, season.position, season.points, season.wins, season.draws, season.losses, season.week]
  );

  const getZoneColor = (position: number): string => {
    if (position <= 4) return 'border-l-green-500';
    if (position <= 6) return 'border-l-blue-500';
    if (position <= 12) return 'border-l-white/20';
    return 'border-l-red-500';
  };

  const getZoneLabel = (position: number): string => {
    if (position <= 4) return 'Libertadores';
    if (position <= 6) return 'Sul-Americana';
    if (position >= 17) return 'Zona de Rebaixamento';
    return '';
  };

  const FormIcon = ({ form }: { form: 'up' | 'down' | 'stable' }) => {
    if (form === 'up') return <TrendingUp className="w-3.5 h-3.5 text-green-400" />;
    if (form === 'down') return <TrendingDown className="w-3.5 h-3.5 text-red-400" />;
    return <Minus className="w-3.5 h-3.5 text-white/30" />;
  };

  return (
    <div className="space-y-4 pb-20">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-[#006400] rounded-xl p-4 border-2 border-[#FEDD00]/50"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-[#004d00] flex items-center justify-center">
            <Table className="w-5 h-5 text-[#FEDD00]" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Classificação</h1>
            <p className="text-white/60 text-sm">{season.league} • Semana {season.week}</p>
          </div>
        </div>
      </motion.div>

      {/* Zone legend */}
      <div className="flex flex-wrap gap-3 text-[10px] text-white/50 px-1">
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded-sm bg-green-500/30 border-l-2 border-green-500" />
          <span>Libertadores</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded-sm bg-blue-500/30 border-l-2 border-blue-500" />
          <span>Sul-Americana</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded-sm bg-red-500/30 border-l-2 border-red-500" />
          <span>Rebaixamento</span>
        </div>
      </div>

      {/* Table */}
      <div className="bg-[#006400] rounded-xl border-2 border-[#FEDD00]/50 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-[#004d00] text-white/40 text-xs">
              <th className="text-left py-3 px-3 w-8">#</th>
              <th className="text-left py-3 px-2">Time</th>
              <th className="text-center py-3 px-1 w-8">PJ</th>
              <th className="text-center py-3 px-1 w-8">V</th>
              <th className="text-center py-3 px-1 w-8">E</th>
              <th className="text-center py-3 px-1 w-8">D</th>
              <th className="text-center py-3 px-1 w-10">GM</th>
              <th className="text-center py-3 px-1 w-10">GS</th>
              <th className="text-center py-3 px-1 w-8">SG</th>
              <th className="text-center py-3 px-1 w-10">Form</th>
              <th className="text-right py-3 px-3 w-10">Pts</th>
            </tr>
          </thead>
          <tbody>
            {standings.map((entry, i) => {
              const pos = i + 1;
              return (
                <motion.tr
                  key={entry.name}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.04 }}
                  className={`border-t border-[#004d00] ${getZoneColor(pos)} border-l-2 ${
                    entry.isUser ? 'bg-[#009739]/30' : 'hover:bg-[#009739]/10'
                  } transition-colors`}
                >
                  <td className="py-2.5 px-3 text-white/60 font-medium">{pos}º</td>
                  <td className="py-2.5 px-2">
                    <div className="flex items-center gap-1.5">
                      <span className={`font-medium truncate max-w-[120px] ${entry.isUser ? 'text-[#FEDD00]' : 'text-white'}`}>
                        {entry.name}
                      </span>
                      {pos <= 3 && <Trophy className="w-3 h-3 text-[#FEDD00] flex-shrink-0" />}
                    </div>
                    {getZoneLabel(pos) && (
                      <span className="text-[10px] text-white/30">{getZoneLabel(pos)}</span>
                    )}
                  </td>
                  <td className="py-2.5 px-1 text-center text-white/50">{entry.played}</td>
                  <td className="py-2.5 px-1 text-center text-green-400">{entry.won}</td>
                  <td className="py-2.5 px-1 text-center text-yellow-400">{entry.drawn}</td>
                  <td className="py-2.5 px-1 text-center text-red-400">{entry.lost}</td>
                  <td className="py-2.5 px-1 text-center text-white/50">{entry.gf}</td>
                  <td className="py-2.5 px-1 text-center text-white/50">{entry.ga}</td>
                  <td className={`py-2.5 px-1 text-center font-medium ${entry.gd > 0 ? 'text-green-400' : entry.gd < 0 ? 'text-red-400' : 'text-white/50'}`}>
                    {entry.gd > 0 ? '+' : ''}{entry.gd}
                  </td>
                  <td className="py-2.5 px-1 text-center">
                    <FormIcon form={entry.form} />
                  </td>
                  <td className="py-2.5 px-3 text-right font-bold text-[#FEDD00]">{entry.points}</td>
                </motion.tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
