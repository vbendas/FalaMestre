'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  GameState,
  MatchEvent,
  DecisionTurn,
  DecisionOption,
  TurnMentality,
  Player,
} from '@/lib/types';
import { DECISION_TURNS } from '@/lib/constants';
import { buildDecisionTurn } from '@/lib/decision-engine';
import { getTeamData } from '@/lib/team-data';
import { MatchSimulation } from './MatchSimulation';
import { HighlightOverlay } from './HighlightOverlay';
import { DecisionPrompt } from './DecisionPrompt';
import { TurnSummary } from './TurnSummary';

interface PriorState {
  homeScore: number;
  awayScore: number;
  homeMomentum: number;
  awayMomentum: number;
  tension: number;
  formation: string;
  mentality: TurnMentality;
  hasRedCard: boolean;
  squad: Player[];
}

interface DecideResponse {
  events: MatchEvent[];
  segmentSummary: string;
  turnPrompt: string;
  nextTurn: DecisionTurn | null;
  endState: PriorState;
  turnResult: unknown;
}

type Phase = 'loading' | 'segment_playback' | 'turn_summary' | 'decision_prompt' | 'match_end';

interface TurnBasedMatchFlowProps {
  gameState: GameState;
  onMatchEnd: (result: {
    homeScore: number;
    awayScore: number;
    winner: string;
    events: MatchEvent[];
  }) => void;
}

export function TurnBasedMatchFlow({ gameState, onMatchEnd }: TurnBasedMatchFlowProps) {
  const { user, season } = gameState;
  const match = season.nextMatch;
  const isHome = match.isHome;
  const opponentTeam = match.opponent;
  const homeTeam = isHome ? user.team : opponentTeam;
  const awayTeam = isHome ? opponentTeam : user.team;
  const homeTeamData = getTeamData(homeTeam);
  const awayTeamData = getTeamData(awayTeam);

  const [phase, setPhase] = useState<Phase>('decision_prompt');
  const [currentTurnNumber, setCurrentTurnNumber] = useState(0);
  const [priorState, setPriorState] = useState<PriorState | null>(null);
  const [currentTurn, setCurrentTurn] = useState<DecisionTurn | null>(null);
  const [turnPrompt, setTurnPrompt] = useState('');
  const [segmentSummary, setSegmentSummary] = useState('');
  const [segmentEvents, setSegmentEvents] = useState<MatchEvent[]>([]);
  const [allEvents, setAllEvents] = useState<MatchEvent[]>([]);

  const [playbackMinute, setPlaybackMinute] = useState(0);
  const [playbackHomeScore, setPlaybackHomeScore] = useState(0);
  const [playbackAwayScore, setPlaybackAwayScore] = useState(0);
  const [currentEvent, setCurrentEvent] = useState<string | null>(null);
  const [isHighlightMode, setIsHighlightMode] = useState(false);
  const [highlightEvent, setHighlightEvent] = useState<MatchEvent | null>(null);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isMountedRef = useRef(true);

  const buildInitialPriorState = useCallback((): PriorState => {
    return {
      homeScore: 0,
      awayScore: 0,
      homeMomentum: 0,
      awayMomentum: 0,
      tension: 30,
      formation: gameState.squad.formation || '4-3-3',
      mentality: 'balanced',
      hasRedCard: false,
      squad: [...gameState.squad.players],
    };
  }, [gameState]);

  // Build first decision client-side — no API call, no loading
  const buildFirstDecision = useCallback((): DecisionTurn => {
    const state = buildInitialPriorState();
    return buildDecisionTurn(
      0,
      state.homeScore,
      state.awayScore,
      state.squad,
      state.formation,
      state.mentality,
      state.hasRedCard,
    );
  }, [buildInitialPriorState]);

  const callDecideAPI = useCallback(
    async (turnNumber: number, decision: DecisionOption | null, state: PriorState): Promise<DecideResponse> => {
      const response = await fetch('/api/match/decide', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id || 'anonymous',
          turnNumber,
          decision,
          priorState: state,
        }),
      });
      if (!response.ok) throw new Error(`Decide API error: ${response.status}`);
      return response.json();
    },
    [user.id],
  );

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

  // Handle user decision → simulate segment with decision applied
  const handleDecision = useCallback(
    async (option: DecisionOption) => {
      if (!priorState) return;

      try {
        setPhase('loading');
        const nextTurn = currentTurnNumber + 1;
        const data = await callDecideAPI(nextTurn, option, priorState);
        if (!isMountedRef.current) return;

        setCurrentTurnNumber(nextTurn);
        setPriorState(data.endState);
        setAllEvents((prev) => [...prev, ...data.events]);
        setSegmentEvents(data.events);
        setSegmentSummary(data.segmentSummary);
        setTurnPrompt(data.turnPrompt);
        setCurrentTurn(data.nextTurn);

        // Play segment animation
        const fromMinute = DECISION_TURNS[nextTurn].minute;
        const toMinute = nextTurn < DECISION_TURNS.length - 1 ? DECISION_TURNS[nextTurn + 1].minute : 90;

        if (data.events.length > 0) {
          setPhase('segment_playback');
          await playSegmentAnimation(data.events, fromMinute, toMinute);
          if (!isMountedRef.current) return;
        }

        if (data.nextTurn) {
          setPhase('turn_summary');
        } else {
          // Last turn — match over
          const homeScore = data.endState.homeScore;
          const awayScore = data.endState.awayScore;
          const winner = homeScore > awayScore ? 'home' : awayScore > homeScore ? 'away' : 'draw';
          setPhase('match_end');
          setAllEvents((prev) => {
            onMatchEnd({ homeScore, awayScore, winner, events: prev });
            return prev;
          });
        }
      } catch (err) {
        console.error('[TurnBasedMatchFlow] handleDecision error:', err);
      }
    },
    [priorState, currentTurnNumber, callDecideAPI, playSegmentAnimation, onMatchEnd],
  );

  const handleSummaryContinue = useCallback(() => {
    if (currentTurn) {
      setPhase('decision_prompt');
    }
  }, [currentTurn]);

  const handleTimeout = useCallback(() => {
    if (!priorState || !currentTurn) return;
    handleDecision(currentTurn.defaultOption);
  }, [priorState, currentTurn, handleDecision]);

  // Initial mount — build first decision client-side, show immediately
  useEffect(() => {
    isMountedRef.current = true;
    const initialState = buildInitialPriorState();
    setPriorState(initialState);
    setCurrentTurn(buildFirstDecision());

    return () => {
      isMountedRef.current = false;
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Show loading only for API calls (not initial)
  if (phase === 'loading') {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-6">
        <div className="animate-spin text-6xl">⚽</div>
        <div className="text-xl font-bold text-white font-[family-name:var(--font-retro)]">Processando...</div>
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

      {phase === 'turn_summary' && priorState && (
        <TurnSummary
          segment={{
            fromMinute: DECISION_TURNS[currentTurnNumber].minute,
            toMinute:
              currentTurnNumber < DECISION_TURNS.length - 1
                ? DECISION_TURNS[currentTurnNumber + 1].minute
                : 90,
            events: segmentEvents,
            homeScoreAtStart: priorState.homeScore - segmentEvents.filter((e) => e.type === 'goal' && e.team === 'home').length,
            awayScoreAtStart: priorState.awayScore - segmentEvents.filter((e) => e.type === 'goal' && e.team === 'away').length,
            homeScoreAtEnd: priorState.homeScore,
            awayScoreAtEnd: priorState.awayScore,
          }}
          homeTeam={homeTeam}
          awayTeam={awayTeam}
          homeColor={homeTeamData?.primaryColor || '#EF4444'}
          awayColor={awayTeamData?.primaryColor || '#3B82F6'}
          segmentSummary={segmentSummary}
          turnNumber={currentTurnNumber}
          totalTurns={DECISION_TURNS.length}
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
