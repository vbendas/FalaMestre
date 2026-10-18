'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { GameState, MatchEvent } from '@/lib/types';
import { getTeamData } from '@/lib/team-data';
import Image from 'next/image';
import { X, Trophy, Circle, AlertCircle, Sparkles, Share2, Star, ChevronDown, ChevronUp, Crown } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { GlassCard, CrtButton, StatCard, SectionTitle, Divider } from '@/components/crt';

interface MatchResult {
  homeScore: number;
  awayScore: number;
  winner: string;
  events: MatchEvent[];
}

interface MatchResultModalProps {
  isOpen: boolean;
  result: MatchResult | null;
  gameState: GameState;
  pointsEarned: number;
  pointsChange: number;
  onClose: () => void;
}

function Confetti() {
  const pieces = useMemo(() => {
    return [...Array(30)].map((_, i) => ({
      id: i,
      initialX: Math.random() * 400 - 200,
      rotateEnd: Math.random() * 720 - 360,
      duration: 2.5 + Math.random() * 2,
      delay: Math.random() * 0.5,
      color: ['#FFDF00', '#FF3333', '#55e0a0', '#3EA0D4', '#00A859', '#FFDF00'][i % 6],
      size: 4 + Math.random() * 4,
    }));
  }, []);

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {pieces.map((piece) => (
        <motion.div
          key={piece.id}
          initial={{
            x: piece.initialX,
            y: -50,
            rotate: 0,
            opacity: 1
          }}
          animate={{
            y: 500,
            rotate: piece.rotateEnd,
            opacity: [1, 1, 0]
          }}
          transition={{
            duration: piece.duration,
            ease: "easeOut",
            delay: piece.delay
          }}
          className="absolute left-1/2 top-0 rounded-full"
          style={{
            backgroundColor: piece.color,
            width: piece.size,
            height: piece.size,
          }}
        />
      ))}
    </div>
  );
}

function ManOfTheMatch({ playerName, playerRating, teamColor }: {
  playerName: string;
  playerRating: number;
  teamColor: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: 0.6 }}
      className="mx-4 mb-3"
    >
      <GlassCard className="flex items-center gap-3 p-3 border border-[#FFDF00]/30" glow>
        <motion.div
          animate={{ rotate: [0, 10, -10, 0] }}
          transition={{ duration: 2, repeat: Infinity, repeatDelay: 3 }}
          className="w-12 h-12 rounded-full flex items-center justify-center shrink-0"
          style={{ backgroundColor: teamColor }}
        >
          <Crown className="w-6 h-6 text-white" />
        </motion.div>
        <div className="flex-1 min-w-0">
          <p className="text-[#FFDF00] text-[0.55rem] font-[family-name:var(--font-pixel)] uppercase tracking-wider">Homem do Jogo</p>
          <p className="text-white font-semibold truncate">{playerName}</p>
        </div>
        <div className="text-center shrink-0">
          <div className="text-2xl font-bold gold-glow-text font-[family-name:var(--font-pixel)]">{playerRating}</div>
          <div className="text-[10px] text-white/50">rating</div>
        </div>
      </GlassCard>
    </motion.div>
  );
}

function ExpandableStats({ events }: { events: MatchEvent[] }) {
  const [isExpanded, setIsExpanded] = useState(false);

  const stats = useMemo(() => {
    const goals = events.filter(e => e.type === 'goal');
    const cards = events.filter(e => e.type === 'foul');
    const saves = events.filter(e => e.type === 'save');

    return {
      goals: goals.length,
      cards: cards.length,
      saves: saves.length,
      possession: { home: 55 + Math.random() * 10, away: 45 - Math.random() * 10 },
    };
  }, [events]);

  return (
    <div className="mx-4">
      <Divider />
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between py-3 hover:opacity-80 transition-opacity"
      >
        <span className="section-title">Estatisticas da Partida</span>
        {isExpanded ? (
          <ChevronUp className="w-4 h-4 text-[#FFDF00]/60" />
        ) : (
          <ChevronDown className="w-4 h-4 text-[#FFDF00]/60" />
        )}
      </button>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="pb-4 space-y-3">
              <div className="grid grid-cols-3 gap-2">
                <StatCard value={stats.goals} label="Gols" />
                <StatCard value={stats.saves} label="Defesas" />
                <StatCard value={stats.cards} label="Faltas" />
              </div>
              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-white/50">Posse de Bola</span>
                  <span className="text-[#55e0a0] font-[family-name:var(--font-pixel)]">{Math.round(stats.possession.home)}% - {Math.round(stats.possession.away)}%</span>
                </div>
                <div className="h-2 bg-white/10 rounded-full overflow-hidden flex">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${stats.possession.home}%` }}
                    transition={{ duration: 1, delay: 0.2 }}
                    className="h-full bg-[#00A859]"
                  />
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${stats.possession.away}%` }}
                    transition={{ duration: 1, delay: 0.2 }}
                    className="h-full bg-[#3EA0D4]"
                  />
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function AnimatedCounter({ value, duration = 1.5 }: { value: number; duration?: number }) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let startTime: number;
    let animationFrame: number;

    const animate = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / (duration * 1000), 1);

      setCount(Math.floor(progress * value));

      if (progress < 1) {
        animationFrame = requestAnimationFrame(animate);
      }
    };

    animationFrame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationFrame);
  }, [value, duration]);

  return <span>{count}</span>;
}

export function MatchResultModal({
  isOpen,
  result,
  gameState,
  pointsEarned,
  pointsChange,
  onClose
}: MatchResultModalProps) {
  if (!isOpen || !result) return null;

  const { user, season } = gameState;

  const homeTeam = user.team;
  const awayTeam = season.nextMatch.opponent;
  const homeScore = result.homeScore;
  const awayScore = result.awayScore;

  const homeTeamData = getTeamData(homeTeam);
  const awayTeamData = getTeamData(awayTeam);

  const isWin = result.winner === user.team;
  const isDraw = result.winner === 'Empate';

  const handleShare = async () => {
    const text = `⚽ ${homeTeam} ${homeScore} x ${awayScore} ${awayTeam}\n${isWin ? '🎉 Vitoria!' : isDraw ? '🤝 Empate' : '😢 Derrota'}\n#FalaMestre`;

    if (navigator.share) {
      try {
        await navigator.share({ text });
      } catch (err) {
        console.log('Share cancelled');
      }
    } else {
      await navigator.clipboard.writeText(text);
    }
  };

  const motmName = gameState.squad.players[0]?.name || 'Jogador';
  const motmRating = Math.round(75 + Math.random() * 10);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md"
          onClick={onClose}
        >
          {isWin && <Confetti />}

          <motion.div
            initial={{ scale: 0.8, opacity: 0, y: 50 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.8, opacity: 0, y: 50 }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
            className="relative w-full max-w-md"
            onClick={(e) => e.stopPropagation()}
          >
            <GlassCard strong className="border border-[#FFDF00]/40 overflow-hidden" glow>
              <button
                onClick={onClose}
                className="absolute top-4 right-4 z-10 w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
              >
                <X className="w-4 h-4 text-white/60" />
              </button>

              <div className="text-center pt-8 pb-4">
                <motion.div
                  initial={{ y: -20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.2 }}
                  className="section-title mb-2"
                >
                  Fim de Jogo
                </motion.div>

                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", stiffness: 400, damping: 20, delay: 0.3 }}
                  className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-[family-name:var(--font-pixel)] font-bold ${
                    isWin
                      ? 'bg-[#FFDF00]/20 text-[#FFDF00]'
                      : isDraw
                        ? 'bg-[#55e0a0]/20 text-[#55e0a0]'
                        : 'bg-[#FF3333]/20 text-[#FF3333]'
                  }`}
                >
                  <Trophy className="w-4 h-4" />
                  {isWin ? 'VITORIA!' : isDraw ? 'Empate' : 'Derrota'}
                </motion.div>
              </div>

              <div className="px-6 py-4">
                <div className="flex items-center justify-between">
                  <div className="flex-1 text-center">
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: "spring", stiffness: 260, damping: 20, delay: 0.35 }}
                      className="relative w-16 h-16 mx-auto mb-2"
                    >
                      {homeTeamData && (
                        <Image
                          src={homeTeamData.logo}
                          alt={homeTeam}
                          fill
                          className="object-contain"
                        />
                      )}
                    </motion.div>
                    <div className="text-sm font-medium text-white/80 truncate">{homeTeam}</div>
                  </div>

                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", stiffness: 400, damping: 20, delay: 0.4 }}
                    className="px-4"
                  >
                    <div className="flex items-center gap-3 text-5xl font-[family-name:var(--font-pixel)] font-black gold-glow-text">
                      <AnimatedCounter value={homeScore} />
                      <span className="text-white/30">x</span>
                      <AnimatedCounter value={awayScore} />
                    </div>
                  </motion.div>

                  <div className="flex-1 text-center">
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: "spring", stiffness: 260, damping: 20, delay: 0.45 }}
                      className="relative w-16 h-16 mx-auto mb-2"
                    >
                      {awayTeamData && (
                        <Image
                          src={awayTeamData.logo}
                          alt={awayTeam}
                          fill
                          className="object-contain"
                        />
                      )}
                    </motion.div>
                    <div className="text-sm font-medium text-white/80 truncate">{awayTeam}</div>
                  </div>
                </div>
              </div>

              {isWin && (
                <ManOfTheMatch
                  playerName={motmName}
                  playerRating={motmRating}
                  teamColor={homeTeamData?.primaryColor || '#00A859'}
                />
              )}

              <div className="px-6 py-4">
                <Divider label="Eventos" />
                <div className="space-y-2 max-h-32 overflow-y-auto">
                  {result.events.slice(0, 5).map((event, idx) => (
                    <motion.div
                      key={`${event.id}-${idx}`}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.5 + idx * 0.1 }}
                      className="flex items-center gap-3 text-sm"
                    >
                      <div className="w-8 text-right font-[family-name:var(--font-pixel)] text-white/40">
                        {event.minute}'
                      </div>
                      <div className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center shrink-0">
                        {event.type === 'goal' ? (
                          <Circle className="w-3 h-3 fill-[#FFDF00] text-[#FFDF00]" />
                        ) : (
                          <AlertCircle className="w-3 h-3 text-[#FF3333]" />
                        )}
                      </div>

                      <div className="flex-1 text-white/80 truncate">{event.commentary}</div>
                    </motion.div>
                  ))}
                </div>
              </div>

              <ExpandableStats events={result.events} />

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.8 }}
                className="mx-4 my-3"
              >
                <GlassCard className="p-4 border-t-2 border-[#FFDF00]/40">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-5 h-5 text-[#FFDF00]" />
                      <span className="text-white/80 font-[family-name:var(--font-pixel)] text-xs">Pontos</span>
                    </div>
                    <div className="text-2xl font-bold gold-glow-text font-[family-name:var(--font-pixel)]">
                      +{pointsChange}
                    </div>
                  </div>

                  <div className="mt-2 text-xs text-white/50 font-[family-name:var(--font-pixel)]">
                    {pointsEarned === 3 ? 'Vitoria: +3 pontos na tabela' :
                     pointsEarned === 1 ? 'Empate: +1 ponto na tabela' :
                     'Derrota: +0 pontos na tabela'}
                  </div>
                </GlassCard>
              </motion.div>

              <div className="p-4 space-y-3">
                <CrtButton
                  variant="outline"
                  onClick={handleShare}
                  className="w-full flex items-center justify-center gap-2 py-3"
                >
                  <Share2 className="w-4 h-4" />
                  Compartilhar Resultado
                </CrtButton>

                <CrtButton
                  variant="primary"
                  onClick={onClose}
                  pulse
                  className="w-full py-3"
                >
                  Continuar
                </CrtButton>
              </div>
            </GlassCard>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
