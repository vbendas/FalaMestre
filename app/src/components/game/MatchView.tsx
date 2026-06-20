'use client';

import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { GameState, Match, MatchEvent, MatchScript, Player, DecisionOption } from '@/lib/types';
import { motion } from 'framer-motion';
import { getTeamData } from '@/lib/team-data';
import Image from 'next/image';
import { Home, Plane, Trophy, Swords, Glasses, TrendingUp, Users, Zap, Target } from 'lucide-react';
import { TurnBasedMatchFlow } from './TurnBasedMatchFlow';

import {
  GlassCard,
  CrtButton,
  ComparisonBar,
  CoinDisplay,
  SectionTitle,
  ViewContainer,
} from '@/components/crt';

interface MatchViewProps {
  gameState: GameState;
  isLoading: boolean;
  onPlayMatch: () => void;
  onPlayMatchWithResult?: () => Promise<{
    result: {
      homeScore: number;
      awayScore: number;
      winner: string;
      events: MatchEvent[];
    };
    matchScript?: MatchScript;
    pointsEarned: number;
    pointsChange: number;
    narration: string;
    nextMatch: Match;
    updatedGameState: GameState;
  } | null>;
  onShowMatchResult?: (result: { homeScore: number; awayScore: number; winner: string; events: MatchEvent[] }, pointsEarned: number, pointsChange: number) => void;
}

interface MatchResult {
  homeScore: number;
  awayScore: number;
  winner: string;
  events: MatchEvent[];
}

function MatchPreview({ homeTeam, awayTeam }: {
  homeTeam: string;
  awayTeam: string;
}) {
  const narratives = [
    `${homeTeam} entra confiante para este confronto contra ${awayTeam}. A torcida está ansiosa!`,
    `O técnico prepara a equipe para um grande espetáculo. Será que vem vitória por aí?`,
    `Ambos os times querem a vitória. Prepare-se para um grande jogo!`,
  ];
  const narrative = narratives[Math.floor(Math.random() * narratives.length)];

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
    >
      <GlassCard className="p-4">
        <div className="flex items-center gap-2 mb-2">
          <Target className="w-4 h-4 text-[#FFDF00]" />
          <span className="text-xs font-bold text-[#FFDF00] uppercase tracking-wider font-[family-name:var(--font-pixel)]">
            Prévia da Partida
          </span>
        </div>
        <p className="text-white/80 text-sm leading-relaxed">
          {narrative}
        </p>
      </GlassCard>
    </motion.div>
  );
}

function KeyPlayers({ players, teamName, color }: { players: Player[]; teamName: string; color: string }) {
  if (players.length === 0) return null;

  return (
    <GlassCard className="p-3">
      <div className="flex items-center gap-2 mb-2">
        <Users className="w-4 h-4 text-[#55e0a0]" />
        <span className="text-xs text-[#55e0a0] font-[family-name:var(--font-pixel)]">
          Destaques - {teamName}
        </span>
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {players.slice(0, 3).map((player) => {
          const overall = Math.round((player.pac + player.sho + player.pas + player.dri + player.def + player.phy) / 6);
          return (
            <div key={player.id} className="flex-shrink-0 flex items-center gap-2 bg-[rgba(0,0,0,0.3)] rounded-sm px-2 py-1.5">
              <div
                className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white font-[family-name:var(--font-pixel)]"
                style={{ backgroundColor: color }}
              >
                {overall}
              </div>
              <span className="text-xs text-white/80 truncate max-w-[80px]">{player.name.split(' ').pop()}</span>
            </div>
          );
        })}
      </div>
    </GlassCard>
  );
}

function WinProbability({ homeRating, awayRating, homeColor, awayColor }: {
  homeRating: number;
  awayRating: number;
  homeColor: string;
  awayColor: string;
}) {
  const total = homeRating + awayRating;
  const homeProb = Math.round((homeRating / total) * 100);
  const drawProb = 100 - homeProb - Math.round(((awayRating - homeRating) / total) * 100);
  const clampedDraw = Math.max(5, Math.min(40, drawProb));
  const remaining = 100 - clampedDraw;
  const homeWin = Math.round(remaining * 0.6);
  const awayWin = 100 - clampedDraw - homeWin;

  return (
    <GlassCard className="p-3">
      <div className="flex items-center gap-2 mb-3">
        <TrendingUp className="w-4 h-4 text-[#FFDF00]" />
        <span className="text-xs text-white/60 font-[family-name:var(--font-pixel)]">Probabilidades</span>
      </div>
      <div className="flex gap-1">
        <div
          className="flex-1 text-center py-2 rounded-sm"
          style={{ backgroundColor: `${homeColor}40` }}
        >
          <div className="text-lg font-bold font-[family-name:var(--font-pixel)]" style={{ color: homeColor }}>{homeWin}%</div>
          <div className="text-[10px] text-white/50">Vitória</div>
        </div>
        <div className="flex-1 text-center py-2 bg-[rgba(0,0,0,0.3)] rounded-sm">
          <div className="text-lg font-bold text-white/70 font-[family-name:var(--font-pixel)]">{clampedDraw}%</div>
          <div className="text-[10px] text-white/50">Empate</div>
        </div>
        <div
          className="flex-1 text-center py-2 rounded-sm"
          style={{ backgroundColor: `${awayColor}40` }}
        >
          <div className="text-lg font-bold font-[family-name:var(--font-pixel)]" style={{ color: awayColor }}>{awayWin}%</div>
          <div className="text-[10px] text-white/50">Derrota</div>
        </div>
      </div>
    </GlassCard>
  );
}

export function MatchView({ gameState, isLoading, onPlayMatch, onPlayMatchWithResult, onShowMatchResult }: MatchViewProps) {
  const { user, season, squad } = gameState;
  const { nextMatch } = season;

  const isMountedRef = useRef(true);
  const homeTeamData = nextMatch?.opponent ? getTeamData(user.team) : null;
  const awayTeamData = nextMatch?.opponent ? getTeamData(nextMatch.opponent) : null;

  const avgRating = squad.players.length > 0
    ? Math.round(squad.players.reduce((sum, p) => sum + (p.pac + p.sho + p.pas + p.dri + p.def + p.phy) / 6, 0) / squad.players.length)
    : 70;

  const opponentRating = useMemo(() => {
    if (!nextMatch?.opponent) return 70;
    let hash = 0;
    for (let i = 0; i < nextMatch.opponent.length; i++) {
      hash = ((hash << 5) - hash) + nextMatch.opponent.charCodeAt(i);
      hash = hash & hash;
    }
    return 68 + (Math.abs(hash) % 15);
  }, [nextMatch?.opponent]);

  const [isSimulating, setIsSimulating] = useState(false);
  const [matchResult, setMatchResult] = useState<MatchResult | null>(null);
  const [preMatchData, setPreMatchData] = useState<{ pointsEarned: number; pointsChange: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isHighlightMode, setIsHighlightMode] = useState(false);
  const [highlightEvent, setHighlightEvent] = useState<MatchEvent | null>(null);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (isSimulating) return;
    setIsSimulating(false);
    setMatchResult(null);
    setError(null);
    setIsHighlightMode(false);
    setHighlightEvent(null);
  }, [gameState, isSimulating]);

  const handlePlayMatch = async () => {
    if (isSimulating) return;
    setError(null);
    setPreMatchData({ pointsEarned: 50, pointsChange: 0 });
    setIsSimulating(true);
  };

  const handleMatchEnd = useCallback(
    (result: { homeScore: number; awayScore: number; winner: string; events: MatchEvent[] }) => {
      setMatchResult(result);
      const points = preMatchData || { pointsEarned: 50, pointsChange: 0 };
      if (onShowMatchResult) {
        onShowMatchResult(result, points.pointsEarned, points.pointsChange);
      }
      setIsSimulating(false);
    },
    [preMatchData, onShowMatchResult],
  );

  if (!nextMatch || !nextMatch.opponent) {
    return (
      <ViewContainer className="flex flex-col items-center justify-center py-20 space-y-4">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
        >
          <Trophy className="w-16 h-16 text-[#FFDF00]" />
        </motion.div>
        <div className="text-xl font-bold text-[#FFDF00] font-[family-name:var(--font-pixel)] gold-glow-text">
          Preparando próxima partida...
        </div>
        <p className="text-white/60 text-center max-w-md text-sm">
          Sua equipe está se preparando para o próximo jogo.
          Volte para o Chat e converse com o técnico para agendar uma partida!
        </p>
      </ViewContainer>
    );
  }

  if (isSimulating) {
    return (
      <TurnBasedMatchFlow
        gameState={gameState}
        onMatchEnd={handleMatchEnd}
      />
    );
  }

  return (
    <ViewContainer className="space-y-3">
      {/* VS Screen */}
      <GlassCard glow className="p-6">
        <div className="flex items-center justify-between">
          {/* Home Team */}
          <motion.div
            initial={{ opacity: 0, x: -50 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex-1 text-center"
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 260, damping: 20, delay: 0.2 }}
              className="relative w-20 h-20 mx-auto mb-3"
            >
              {homeTeamData && (
                <Image
                  src={homeTeamData.logo}
                  alt={user.team}
                  fill
                  className="object-contain"
                />
              )}
            </motion.div>
            <div className="font-bold text-white text-lg font-[family-name:var(--font-pixel)]">{user.team}</div>
            <div className="flex items-center justify-center gap-1 text-sm text-[#55e0a0] mt-1">
              <Home className="w-4 h-4" />
              <span className="font-[family-name:var(--font-pixel)] text-xs">Em Casa</span>
            </div>
          </motion.div>

          {/* VS */}
          <motion.div
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: "spring", stiffness: 400, damping: 20, delay: 0.3 }}
            className="px-4"
          >
            <div className="text-4xl font-black text-[#FFDF00] gold-glow-text font-[family-name:var(--font-pixel)]">VS</div>
          </motion.div>

          {/* Away Team */}
          <motion.div
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex-1 text-center"
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 260, damping: 20, delay: 0.4 }}
              className="relative w-20 h-20 mx-auto mb-3"
            >
              {awayTeamData && (
                <Image
                  src={awayTeamData.logo}
                  alt={nextMatch.opponent}
                  fill
                  className="object-contain"
                />
              )}
            </motion.div>
            <div className="font-bold text-white text-lg font-[family-name:var(--font-pixel)]">{nextMatch.opponent}</div>
            <div className="flex items-center justify-center gap-1 text-sm text-[#3EA0D4] mt-1">
              <Plane className="w-4 h-4" />
              <span className="font-[family-name:var(--font-pixel)] text-xs">Fora</span>
            </div>
          </motion.div>
        </div>

        {/* Match Info */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="mt-6 pt-4 border-t border-[rgba(255,255,255,0.1)]"
        >
          <div className="flex items-center justify-center gap-4 text-sm">
            <div className="flex items-center gap-1.5 text-white/60">
              <Trophy className="w-4 h-4 text-[#FFDF00]" />
              <span className="font-[family-name:var(--font-pixel)] text-xs">{nextMatch.competition}</span>
            </div>
            <span className="text-white/20">|</span>
            <div className="text-white/60 font-[family-name:var(--font-pixel)] text-xs">
              {homeTeamData?.stadium || 'Estádio'}
            </div>
          </div>
        </motion.div>
      </GlassCard>

      {/* Match Preview */}
      <MatchPreview
        homeTeam={user.team}
        awayTeam={nextMatch.opponent}
      />

      {/* Key Players */}
      <div className="grid grid-cols-2 gap-2">
        <KeyPlayers
          players={squad.players.slice(0, 5)}
          teamName={user.team}
          color={homeTeamData?.primaryColor || '#00A859'}
        />
        <GlassCard className="p-3">
          <div className="flex items-center gap-2 mb-2">
            <Users className="w-4 h-4 text-[#55e0a0]" />
            <span className="text-xs text-[#55e0a0] font-[family-name:var(--font-pixel)]">
              Destaques - {nextMatch.opponent}
            </span>
          </div>
          <div className="flex gap-2">
            {(() => {
              const names = ['Goleiro', 'Zagueiro', 'Atacante'];
              return names.map((name, i) => {
                let h = 0;
                for (let j = 0; j < nextMatch.opponent.length; j++) {
                  h = ((h << 5) - h) + nextMatch.opponent.charCodeAt(j);
                  h = h & h;
                }
                const rating = opponentRating - 2 + ((Math.abs(h) + i * 7) % 5);
                return (
                  <div key={i} className="flex-shrink-0 flex items-center gap-2 bg-[rgba(0,0,0,0.3)] rounded-sm px-2 py-1.5">
                    <div className="w-6 h-6 rounded-full bg-[#00381a] flex items-center justify-center text-[10px] font-bold text-white font-[family-name:var(--font-pixel)]">
                      {rating}
                    </div>
                    <span className="text-xs text-white/80 truncate max-w-[60px]">{name}</span>
                  </div>
                );
              });
            })()}
          </div>
        </GlassCard>
      </div>

      {/* Team Comparison & Win Probability */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <GlassCard className="p-4">
            <SectionTitle>
              <span className="flex items-center gap-2">
                <Swords className="w-4 h-4 text-[#FFDF00]" />
                Comparação de Equipes
              </span>
            </SectionTitle>

            <div className="space-y-3">
              <div>
                <div className="text-[0.5rem] text-white/40 mb-1 text-center font-[family-name:var(--font-pixel)]">Moral</div>
                <ComparisonBar
                  label="Moral"
                  homeValue={squad.morale}
                  awayValue={70}
                  homeLabel={user.team.substring(0, 3)}
                  awayLabel={nextMatch.opponent.substring(0, 3)}
                />
              </div>

              <div>
                <div className="text-[0.5rem] text-white/40 mb-1 text-center font-[family-name:var(--font-pixel)]">Força do Elenco</div>
                <ComparisonBar
                  label="Força do Elenco"
                  homeValue={avgRating}
                  awayValue={opponentRating}
                  homeLabel={user.team.substring(0, 3)}
                  awayLabel={nextMatch.opponent.substring(0, 3)}
                />
              </div>

              <div>
                <div className="text-[0.5rem] text-white/40 mb-1 text-center font-[family-name:var(--font-pixel)]">Energia</div>
                <ComparisonBar
                  label="Energia"
                  homeValue={gameState.squad.fitness}
                  awayValue={75}
                  homeLabel={user.team.substring(0, 3)}
                  awayLabel={nextMatch.opponent.substring(0, 3)}
                />
              </div>
            </div>
          </GlassCard>
        </motion.div>

        <WinProbability
          homeRating={avgRating}
          awayRating={opponentRating}
          homeColor={homeTeamData?.primaryColor || '#00A859'}
          awayColor={awayTeamData?.primaryColor || '#3EA0D4'}
        />
      </div>

      {/* Play Button */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
      >
        <CrtButton
          variant="primary"
          pulse={!isLoading && !isSimulating}
          onClick={handlePlayMatch}
          disabled={isLoading || isSimulating}
          className="w-full py-4 text-lg flex items-center justify-center gap-3"
        >
          {isLoading || isSimulating ? (
            <div className="flex items-center gap-3">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
              >
                <Swords className="w-6 h-6" />
              </motion.div>
              <span>Simulando partida...</span>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <Swords className="w-6 h-6" />
              <span>JOGAR AGORA</span>
            </div>
          )}
        </CrtButton>
      </motion.div>
    </ViewContainer>
  );
}
