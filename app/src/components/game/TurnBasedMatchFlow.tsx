'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  GameState,
  MatchEvent,
  DecisionTurn,
  DecisionOption,
} from '@/lib/types';
import { getTeamData } from '@/lib/team-data';
import {
  MatchSettlement,
  useTurnBasedMatch,
  turnMinutes,
} from '@/hooks/useTurnBasedMatch';
import { MatchSimulation } from './MatchSimulation';
import { HighlightOverlay } from './HighlightOverlay';
import { DecisionPrompt } from './DecisionPrompt';
import { TurnSummary } from './TurnSummary';

type Phase =
  | 'decision_prompt'
  | 'loading'
  | 'segment_playback'
  | 'turn_summary'
  | 'finalizing'
  | 'failed';

interface TurnBasedMatchFlowProps {
  gameState: GameState;
  /** Called once the server has had its say on the match. */
  onMatchEnd: (settlement: MatchSettlement) => void;
  /** The player leaving a match that did not count, after being told so. */
  onAbandon: () => void;
}

export function TurnBasedMatchFlow({ gameState, onMatchEnd, onAbandon }: TurnBasedMatchFlowProps) {
  const { user, season } = gameState;
  const match = season.nextMatch;
  const isHome = match.isHome;
  const opponentTeam = match.opponent;
  const homeTeam = isHome ? user.team : opponentTeam;
  const awayTeam = isHome ? opponentTeam : user.team;
  const homeTeamData = getTeamData(homeTeam);
  const awayTeamData = getTeamData(awayTeam);

  const { firstTurn, submitTurn, finalizeMatch, totalTurns } = useTurnBasedMatch(gameState);

  const [phase, setPhase] = useState<Phase>('decision_prompt');
  // The turn whose prompt is on screen, and the turn whose segment was last
  // played. They differ by one while a summary is up, and the match now starts
  // at turn 0 so the opening fifteen minutes are played like any other segment.
  const [currentTurnNumber, setCurrentTurnNumber] = useState(0);
  const [playedTurnNumber, setPlayedTurnNumber] = useState(0);
  const [currentTurn, setCurrentTurn] = useState<DecisionTurn | null>(firstTurn);
  const [turnPrompt, setTurnPrompt] = useState('');
  const [segmentSummary, setSegmentSummary] = useState('');
  const [segmentEvents, setSegmentEvents] = useState<MatchEvent[]>([]);
  const [scoreAfterSegment, setScoreAfterSegment] = useState({ home: 0, away: 0 });
  const [failure, setFailure] = useState<{ message: string; canRetry: boolean } | null>(null);

  const [playbackMinute, setPlaybackMinute] = useState(0);
  const [playbackHomeScore, setPlaybackHomeScore] = useState(0);
  const [playbackAwayScore, setPlaybackAwayScore] = useState(0);
  const [currentEvent, setCurrentEvent] = useState<string | null>(null);
  const [isHighlightMode, setIsHighlightMode] = useState(false);
  const [highlightEvent, setHighlightEvent] = useState<MatchEvent | null>(null);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  const playSegmentAnimation = useCallback(
    (events: MatchEvent[], fromMinute: number, toMinute: number) => {
      return new Promise<void>((resolve) => {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }

        setPlaybackMinute(fromMinute);
        setPlaybackHomeScore(0);
        setPlaybackAwayScore(0);
        setCurrentEvent(null);

        let minute = fromMinute;
        const totalHomeGoals = events.filter((e) => e.type === 'goal' && e.team === 'home').length;
        const totalAwayGoals = events.filter((e) => e.type === 'goal' && e.team === 'away').length;

        const tick = () => {
          if (!isMountedRef.current) {
            if (intervalRef.current) clearInterval(intervalRef.current);
            resolve();
            return;
          }

          minute++;
          setPlaybackMinute(minute);

          const eventsUpTo = events.filter((e) => e.minute <= minute);
          setPlaybackHomeScore(eventsUpTo.filter((e) => e.type === 'goal' && e.team === 'home').length);
          setPlaybackAwayScore(eventsUpTo.filter((e) => e.type === 'goal' && e.team === 'away').length);

          const ev = events.find((e) => e.minute === minute);
          if (ev) {
            setCurrentEvent(ev.commentary || ev.description);
            if (ev.highlight) {
              if (intervalRef.current) clearInterval(intervalRef.current);
              setHighlightEvent(ev);
              setIsHighlightMode(true);
              setTimeout(() => {
                setIsHighlightMode(false);
                setHighlightEvent(null);
                if (minute < toMinute && isMountedRef.current) {
                  intervalRef.current = setInterval(tick, 800);
                } else {
                  resolve();
                }
              }, 8000);
              return;
            }
          }

          if (minute >= toMinute) {
            if (intervalRef.current) clearInterval(intervalRef.current);
            setPlaybackHomeScore(totalHomeGoals);
            setPlaybackAwayScore(totalAwayGoals);
            resolve();
          }
        };

        intervalRef.current = setInterval(tick, 800);
      });
    },
    [],
  );

  /**
   * Asks the server to bank the match and reports what it said. Shared by the
   * final whistle and the retry button, so a retry goes through exactly the
   * same path — the same seed, the same decisions — as the first attempt.
   */
  const settleMatch = useCallback(async () => {
    setPhase('finalizing');
    const settlement = await finalizeMatch();
    if (!isMountedRef.current) return;

    if (settlement.status === 'rejected') {
      setFailure({ message: settlement.error, canRetry: settlement.retryable });
      setPhase('failed');
    }
    onMatchEnd(settlement);
  }, [finalizeMatch, onMatchEnd]);

  // The player's decision for the turn on screen, or null when the timer ran
  // out. Either way the turn it belongs to is the one being prompted — the
  // segment it decides is that turn's own, not the next one's.
  const handleDecision = useCallback(
    async (option: DecisionOption | null) => {
      const turnNumber = currentTurnNumber;

      try {
        setPhase('loading');
        const segment = await submitTurn(turnNumber, option);
        if (!isMountedRef.current) return;

        setPlayedTurnNumber(turnNumber);
        setSegmentEvents(segment.events);
        setSegmentSummary(segment.segmentSummary);
        setTurnPrompt(segment.turnPrompt);
        setCurrentTurn(segment.nextTurn);
        setScoreAfterSegment({
          home: segment.endState.homeScore,
          away: segment.endState.awayScore,
        });
        if (segment.nextTurn) {
          setCurrentTurnNumber(turnNumber + 1);
        }

        if (segment.events.length > 0) {
          setPhase('segment_playback');
          await playSegmentAnimation(segment.events, segment.fromMinute, segment.toMinute);
          if (!isMountedRef.current) return;
        }

        if (segment.nextTurn) {
          setPhase('turn_summary');
          return;
        }

        // Full time. The match only counts once the server has replayed it,
        // so the screen waits here rather than showing a result.
        await settleMatch();
      } catch (err) {
        // A turn that never came back: the match cannot be finished, and
        // nothing was written, so there is nothing to retry — the player
        // plays the week again from the start.
        console.error('[TurnBasedMatchFlow] handleDecision error:', err);
        if (!isMountedRef.current) return;
        setFailure({
          message:
            'A partida foi interrompida e não contou. Verifique sua conexão e jogue novamente.',
          canRetry: false,
        });
        setPhase('failed');
      }
    },
    [currentTurnNumber, submitTurn, playSegmentAnimation, settleMatch],
  );

  const handleSummaryContinue = useCallback(() => {
    if (currentTurn) {
      setPhase('decision_prompt');
    }
  }, [currentTurn]);

  const handleTimeout = useCallback(() => {
    // A timeout is a real decision: the server resolves the same
    // context-aware default, and finalize replays it from a null id.
    handleDecision(null);
  }, [handleDecision]);

  if (phase === 'loading' || phase === 'finalizing') {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-6">
        <div className="animate-spin text-6xl">⚽</div>
        <div className="text-xl font-bold text-white font-[family-name:var(--font-retro)]">
          {phase === 'finalizing' ? 'Encerrando a partida...' : 'Processando...'}
        </div>
      </div>
    );
  }

  if (phase === 'failed') {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-6 px-6">
        <div className="text-6xl">⚠️</div>
        <div className="text-xl font-bold text-[#FF3333] font-[family-name:var(--font-retro)] text-center">
          A partida não contou
        </div>
        <p className="text-white/70 text-center text-sm max-w-md">{failure?.message}</p>
        <div className="flex items-center gap-3">
          {/* Retrying sends the same match again — same seed, same decisions —
              so the player does not replay 90 minutes over a dropped
              connection. It is offered only where it could work. */}
          {failure?.canRetry && (
            <button
              onClick={settleMatch}
              className="px-6 py-3 rounded-sm bg-[#FFDF00]/20 hover:bg-[#FFDF00]/30 text-[#FFDF00] font-[family-name:var(--font-pixel)] text-xs transition-colors"
            >
              Tentar novamente
            </button>
          )}
          <button
            onClick={onAbandon}
            className="px-6 py-3 rounded-sm bg-white/10 hover:bg-white/20 text-white font-[family-name:var(--font-pixel)] text-xs transition-colors"
          >
            Voltar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative">
      {phase === 'segment_playback' && (
        <MatchSimulation
          gameState={gameState}
          homeScore={playbackHomeScore}
          awayScore={playbackAwayScore}
          minute={playbackMinute}
          currentEvent={currentEvent}
          isPlaying={true}
          events={segmentEvents}
        />
      )}

      {isHighlightMode && highlightEvent && (
        <HighlightOverlay
          event={highlightEvent}
          homeTeam={homeTeam}
          awayTeam={awayTeam}
          homeColor={homeTeamData?.primaryColor || '#EF4444'}
          awayColor={awayTeamData?.primaryColor || '#3B82F6'}
          onSkip={() => {
            setIsHighlightMode(false);
            setHighlightEvent(null);
          }}
        />
      )}

      {phase === 'turn_summary' && (
        <TurnSummary
          segment={{
            ...turnMinutes(playedTurnNumber),
            events: segmentEvents,
            homeScoreAtStart:
              scoreAfterSegment.home -
              segmentEvents.filter((e) => e.type === 'goal' && e.team === 'home').length,
            awayScoreAtStart:
              scoreAfterSegment.away -
              segmentEvents.filter((e) => e.type === 'goal' && e.team === 'away').length,
            homeScoreAtEnd: scoreAfterSegment.home,
            awayScoreAtEnd: scoreAfterSegment.away,
          }}
          homeTeam={homeTeam}
          awayTeam={awayTeam}
          homeColor={homeTeamData?.primaryColor || '#EF4444'}
          awayColor={awayTeamData?.primaryColor || '#3B82F6'}
          segmentSummary={segmentSummary}
          turnNumber={playedTurnNumber}
          totalTurns={totalTurns}
          onContinue={handleSummaryContinue}
        />
      )}

      {phase === 'decision_prompt' && currentTurn && (
        <DecisionPrompt
          turn={currentTurn}
          turnPrompt={turnPrompt}
          segmentSummary={segmentSummary}
          onDecision={handleDecision}
          onTimeout={handleTimeout}
        />
      )}
    </div>
  );
}
