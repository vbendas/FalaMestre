'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { TEAMS } from '@/lib/team-data';

interface LeagueEntry {
  name: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  gf: number;
  ga: number;
  points: number;
  isUser: boolean;
}

interface LeagueMiniTableProps {
  userTeam: string;
  userPosition: number;
  userPoints: number;
  userWins: number;
  userDraws: number;
  userLosses: number;
  week: number;
}

function generateStandings(props: LeagueMiniTableProps): LeagueEntry[] {
  const { userTeam, userPosition, userPoints, userWins, userDraws, userLosses, week } = props;
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
    points: userPoints,
    isUser: true,
  });

  const otherTeams = TEAMS.filter(t => t.name !== userTeam);
  otherTeams.forEach((team, i) => {
    const pos = i < userPosition - 1 ? i + 1 : i + 2;
    const variance = Math.max(0, userPoints + (userPosition - pos) * 4 + Math.floor(Math.random() * 6 - 3));
    const pts = Math.max(0, variance);
    const pld = played + Math.floor(Math.random() * 2 - 1);
    const w = Math.floor(pts / 3.2);
    const d = Math.floor((pts - w * 3) / 1);
    const l = Math.max(0, pld - w - d);

    entries.push({
      name: team.name,
      played: Math.max(0, pld),
      won: w,
      drawn: Math.max(0, d),
      lost: l,
      gf: Math.floor(pts * 0.7 + w * 2),
      ga: Math.floor((pld - pts / 3) * 1.5 + l),
      points: pts,
      isUser: false,
    });
  });

  entries.sort((a, b) => b.points - a.points || (b.gf - b.ga) - (a.gf - a.ga));
  return entries;
}

export function LeagueMiniTable(props: LeagueMiniTableProps) {
  const standings = generateStandings(props);
  const topEntries = standings.slice(0, 5);
  const userEntry = standings.find(e => e.isUser);
  const userIdx = standings.findIndex(e => e.isUser);
  const showUserSeparately = userIdx >= 5;

  return (
    <div className="bg-[#006400] rounded-xl p-4 border-2 border-[#FEDD00]/50">
      <h3 className="text-sm font-medium text-white/60 mb-3 uppercase tracking-wider">
        Classificação
      </h3>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-white/40 text-xs">
            <th className="text-left pb-2 w-6">#</th>
            <th className="text-left pb-2">Time</th>
            <th className="text-center pb-2 w-8">PJ</th>
            <th className="text-center pb-2 w-8">V</th>
            <th className="text-center pb-2 w-8">E</th>
            <th className="text-center pb-2 w-8">D</th>
            <th className="text-center pb-2 w-8">SG</th>
            <th className="text-right pb-2 w-8">Pts</th>
          </tr>
        </thead>
        <tbody>
          {topEntries.map((entry, i) => (
            <tr
              key={entry.name}
              className={`border-t border-[#004d00] ${entry.isUser ? 'bg-[#009739]/30' : ''}`}
            >
              <td className="py-2 text-white/60">{i + 1}º</td>
              <td className="py-2 font-medium text-white truncate max-w-[120px]">
                {entry.name}
                {entry.isUser && <span className="ml-1 text-[10px] text-[#009739]">★</span>}
              </td>
              <td className="py-2 text-center text-white/60">{entry.played}</td>
              <td className="py-2 text-center text-green-400">{entry.won}</td>
              <td className="py-2 text-center text-yellow-400">{entry.drawn}</td>
              <td className="py-2 text-center text-red-400">{entry.lost}</td>
              <td className="py-2 text-center text-white/60">{entry.gf - entry.ga}</td>
              <td className="py-2 text-right font-bold text-[#FEDD00]">{entry.points}</td>
            </tr>
          ))}
          {showUserSeparately && userEntry && (
            <>
              <tr className="border-t border-white/5">
                <td colSpan={8} className="py-1 text-center text-white/30 text-xs">···</td>
              </tr>
              <tr className="border-t border-[#004d00] bg-[#009739]/30">
                <td className="py-2 text-white/60">{userIdx + 1}º</td>
                <td className="py-2 font-medium text-white truncate max-w-[120px]">
                  {userEntry.name}
                  <span className="ml-1 text-[10px] text-[#009739]">★</span>
                </td>
                <td className="py-2 text-center text-white/60">{userEntry.played}</td>
                <td className="py-2 text-center text-green-400">{userEntry.won}</td>
                <td className="py-2 text-center text-yellow-400">{userEntry.drawn}</td>
                <td className="py-2 text-center text-red-400">{userEntry.lost}</td>
                <td className="py-2 text-center text-white/60">{userEntry.gf - userEntry.ga}</td>
                <td className="py-2 text-right font-bold text-[#FEDD00]">{userEntry.points}</td>
              </tr>
            </>
          )}
        </tbody>
      </table>
    </div>
  );
}
