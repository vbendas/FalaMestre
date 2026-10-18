'use client';

import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Table, Trophy, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { GameState } from '@/lib/types';
import { TEAMS } from '@/lib/team-data';
import { GlassCard, SectionTitle, ViewContainer } from '@/components/crt';

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

  const getZoneBorder = (position: number): string => {
    if (position <= 4) return 'border-l-[#00A859]';
    if (position <= 6) return 'border-l-[#3EA0D4]';
    if (position <= 12) return 'border-l-white/20';
    return 'border-l-[#FF3333]';
  };

  const getZoneLabel = (position: number): string => {
    if (position <= 4) return 'Copa Continental';
    if (position <= 6) return 'Sul-Americana';
    if (position >= 17) return 'Zona de Rebaixamento';
    return '';
  };

  const FormIcon = ({ form }: { form: 'up' | 'down' | 'stable' }) => {
    if (form === 'up') return <TrendingUp className="w-3.5 h-3.5 text-[#00A859]" />;
    if (form === 'down') return <TrendingDown className="w-3.5 h-3.5 text-[#FF3333]" />;
    return <Minus className="w-3.5 h-3.5 text-white/30" />;
  };

  return (
    <ViewContainer>
      <GlassCard glow className="p-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-[#00381a] flex items-center justify-center">
            <Table className="w-5 h-5 text-[#FFDF00]" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-[#FFDF00] font-[family-name:var(--font-pixel)]">
              Classificação
            </h1>
            <p className="text-white/60 text-sm">{season.league} • Semana {season.week}</p>
          </div>
        </div>
      </GlassCard>

      <div className="flex flex-wrap gap-3 text-[10px] text-white/50 px-1">
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded-sm bg-[#00A859]/20 border-l-2 border-[#00A859]" />
          <span>Copa Continental</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded-sm bg-[#3EA0D4]/20 border-l-2 border-[#3EA0D4]" />
          <span>Sul-Americana</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded-sm bg-[#FF3333]/20 border-l-2 border-[#FF3333]" />
          <span>Rebaixamento</span>
        </div>
      </div>

      <GlassCard className="p-0">
        <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[500px]">
          <thead>
            <tr className="bg-[#00381a] text-white/40 text-xs font-[family-name:var(--font-pixel)]">
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
                  className={`border-t border-[#00381a] ${getZoneBorder(pos)} border-l-2 ${
                    entry.isUser ? 'bg-[#FFDF00]/10' : 'hover:bg-[#00A859]/5'
                  } transition-colors`}
                >
                  <td className="py-2.5 px-3 text-white/60 font-medium">{pos}º</td>
                  <td className="py-2.5 px-2">
                    <div className="flex items-center gap-1.5">
                      <span className={`font-medium truncate max-w-[120px] ${entry.isUser ? 'text-[#FFDF00] gold-glow-text' : 'text-white'}`}>
                        {entry.name}
                      </span>
                      {pos <= 3 && <Trophy className="w-3 h-3 text-[#FFDF00] flex-shrink-0" />}
                    </div>
                    {getZoneLabel(pos) && (
                      <span className="text-[10px] text-white/30">{getZoneLabel(pos)}</span>
                    )}
                  </td>
                  <td className="py-2.5 px-1 text-center text-white/50">{entry.played}</td>
                  <td className="py-2.5 px-1 text-center text-[#00A859]">{entry.won}</td>
                  <td className="py-2.5 px-1 text-center text-[#FFDF00]">{entry.drawn}</td>
                  <td className="py-2.5 px-1 text-center text-[#FF3333]">{entry.lost}</td>
                  <td className="py-2.5 px-1 text-center text-white/50">{entry.gf}</td>
                  <td className="py-2.5 px-1 text-center text-white/50">{entry.ga}</td>
                  <td className={`py-2.5 px-1 text-center font-medium ${entry.gd > 0 ? 'text-[#00A859]' : entry.gd < 0 ? 'text-[#FF3333]' : 'text-white/50'}`}>
                    {entry.gd > 0 ? '+' : ''}{entry.gd}
                  </td>
                  <td className="py-2.5 px-1 text-center">
                    <FormIcon form={entry.form} />
                  </td>
                  <td className="py-2.5 px-3 text-right font-bold text-[#FFDF00]">{entry.points}</td>
                </motion.tr>
              );
            })}
          </tbody>
        </table>
        </div>
      </GlassCard>
    </ViewContainer>
  );
}
