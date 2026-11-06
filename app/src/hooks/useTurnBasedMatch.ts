'use client';

/**
 * Drives one turn-based match: the seed, the decisions, the six
 * /api/match/decide calls and the /api/match/finalize that banks it.
 *
 * The screen used to play the turns and keep the result in the browser, so a
 * reload put the player back before the match. The pieces that fix that live
 * here rather than in the component, which is left with playback and layout:
 *
 *  - **One seed per match.** Drawn at kickoff and sent to every turn as
 *    `deriveTurnSeed(matchSeed, turnNumber)`, which is what lets the server
 *    replay the same football at the end. Without it each turn drew a seed
 *    nobody kept and the match was unreplayable.
 *  - **Every turn, from kickoff.** Turns 0 to 5, so minutes 0-15 are played
 *    like the rest; the old loop started at turn 1 and skipped them.
 *  - **The fixture as it was at kickoff.** Week, opponent and venue are pinned
 *    when the match starts, because finalize checks them against the save and
 *    the save moves on the moment it banks the match.
 *  - **The decisions, by id.** What the player picked at each turn, or null
 *    where the timer ran out, which is all finalize needs to replay the turns.
 *
 * Nothing here trusts itself with the result: the score it sends as
 * `claimedScore` is a cross-check, and the points, earnings and game state the
 * screen shows afterwards are the ones finalize returns.
 */

import { useCallback, useMemo, useRef } from 'react';
import {
  DecisionOption,
  DecisionTurn,
  GameState,
  MatchEvent,
  Player,
  TurnMentality,
} from '@/lib/types';
import { DECISION_TURNS } from '@/lib/constants';
import { buildDecisionTurn } from '@/lib/decision-engine';
import { deriveTurnSeed } from '@/lib/match-seed';
import { generateSeed } from '@/lib/rng';

/** The state a turn starts from; the end state of one turn feeds the next. */
export interface TurnState {
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

/** The fixture being played, as it stood when the match kicked off. */
export interface PlayedFixture {
  week: number;
  opponent: string;
  isHome: boolean;
}

/** One decision turn, as finalize wants it reported. */
export interface RecordedDecision {
  turnNumber: number;
  /** The option the player picked, or null if the timer ran out. */
  decisionId: string | null;
}

/** A segment that has just been played, ready to animate. */
export interface PlayedSegment {
  turnNumber: number;
  fromMinute: number;
  toMinute: number;
  events: MatchEvent[];
  segmentSummary: string;
  turnPrompt: string;
  /** The next prompt, or null when that was the last turn. */
  nextTurn: DecisionTurn | null;
  endState: TurnState;
}

/** What became of the match once the final whistle went. */
export type MatchSettlement =
  | {
      status: 'saved';
      result: { homeScore: number; awayScore: number; winner: string; events: MatchEvent[] };
      fixture: PlayedFixture;
      pointsEarned: number;
      matchResult: 'win' | 'draw' | 'loss';
      earnings: { amount: number; breakdown: string };
      updatedGameState: GameState;
    }
  | {
      status: 'rejected';
      result: { homeScore: number; awayScore: number; winner: string; events: MatchEvent[] };
      fixture: PlayedFixture;
      /** Shown to the player, who needs to know the match did not count. */
      error: string;
      /**
       * Whether sending the same match again could work. True for the
       * failures that are about the moment — a dropped connection, a save
       * that could not be written — and false where the server has decided
       * about this match and will decide the same way again.
       */
      retryable: boolean;
    };

/** The minute a turn's segment runs from, and the minute it runs to. */
export function turnMinutes(turnNumber: number): { fromMinute: number; toMinute: number } {
  return {
    fromMinute: DECISION_TURNS[turnNumber].minute,
    toMinute:
      turnNumber < DECISION_TURNS.length - 1 ? DECISION_TURNS[turnNumber + 1].minute : 90,
  };
}

interface MatchRun {
  seed: string;
  fixture: PlayedFixture;
  userTeam: string;
  state: TurnState;
  decisions: RecordedDecision[];
  events: MatchEvent[];
}

/**
 * What the player is told when a finalize does not go through. The server
 * answers in English and these are the only sentences the screen shows, so
 * each status gets its own; the server's own wording goes to the console.
 */
const FINALIZE_FAILED =
  'Não foi possível salvar a partida — ela não contou. Você pode tentar salvar novamente.';
const FINALIZE_MOVED_ON =
  'O jogo salvo já seguiu em frente: esta partida pode já ter sido salva em outra aba. Confira a próxima rodada.';
const FINALIZE_REFUSED =
  'O servidor não aceitou esta partida, então ela não contou.';
/**
 * The turns shown were not the match the server replays: a screen that was
 * mid-match when a new version went live, say, and played its first turns
 * under a seed of its own. The fixture is still waiting, and playing it
 * again from kickoff replays it as the server has it, which then counts.
 */
const FINALIZE_SCORE_MISMATCH =
  'A partida que você viu não confere com a registrada pelo servidor, então ela não contou. Volte e jogue a partida de novo: ela vai se repetir como o servidor a registrou.';

function rejectionMessage(status: number, error?: string): string {
  if (status === 409 && error === 'Score mismatch') return FINALIZE_SCORE_MISMATCH;
  if (status === 409) return FINALIZE_MOVED_ON;
  if (status >= 400 && status < 500 && status !== 429) return FINALIZE_REFUSED;
  return FINALIZE_FAILED;
}

/**
 * True when sending the same match again could land. A 409 or a 400 is the
 * server's verdict on *this* match and will not change; a dropped connection,
 * a rate limit or a failed write might.
 */
function isRetryable(status: number): boolean {
  return status >= 500 || status === 429;
}

export function useTurnBasedMatch(gameState: GameState) {
  // Pinned once, when the match starts. A lazily initialised ref rather than
  // state: none of it is rendered, and every turn has to read the values the
  // match began with even if the game state prop changes underneath.
  const runRef = useRef<MatchRun | null>(null);
  if (runRef.current === null) {
    runRef.current = {
      seed: generateSeed(),
      fixture: {
        week: gameState.season.week,
        opponent: gameState.season.nextMatch.opponent,
        isHome: gameState.season.nextMatch.isHome,
      },
      userTeam: gameState.user.team,
      state: {
        homeScore: 0,
        awayScore: 0,
        homeMomentum: 0,
        awayMomentum: 0,
        tension: 30,
        formation: gameState.squad.formation || '4-3-3',
        mentality: 'balanced',
        hasRedCard: false,
        squad: [...gameState.squad.players],
      },
      decisions: [],
      events: [],
    };
  }
  const run = runRef.current;
  const userId = gameState.user.id || 'anonymous';

  /**
   * The kickoff prompt, built client-side from the same engine the server
   * uses, so turn 0 costs no round trip. Every later prompt comes back from
   * the turn before it.
   */
  const firstTurn = useMemo(
    () =>
      buildDecisionTurn(
        0,
        run.state.homeScore,
        run.state.awayScore,
        run.state.squad,
        run.state.formation,
        run.state.mentality,
        run.state.hasRedCard
      ),
    // Built from the pinned kickoff state, which never changes for this match.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  /**
   * Plays one turn: sends the decision under this turn's derived seed, records
   * what was picked and chains the end state into the next turn. Throws if the
   * route refuses, which the screen reports rather than leaving the player on
   * a spinner.
   */
  const submitTurn = useCallback(
    async (turnNumber: number, decision: DecisionOption | null): Promise<PlayedSegment> => {
      const response = await fetch('/api/match/decide', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          turnNumber,
          decision,
          priorState: run.state,
          seed: deriveTurnSeed(run.seed, turnNumber),
        }),
      });

      if (!response.ok) {
        // The screen shows its own sentence for a failed turn; the server's
        // message rides along on the error so the console says what the
        // status alone cannot — which field a refused body failed on.
        const refusal = (await response.json().catch(() => null)) as
          | { message?: string; error?: string }
          | null;
        const detail = refusal?.message ?? refusal?.error;
        throw new Error(`Decide API error: ${response.status}${detail ? ` — ${detail}` : ''}`);
      }

      const data = await response.json();

      // The decision the server played the turn with: the one sent, unless
      // the turn had already been played (an abandoned match being played
      // again), in which case the first one stands.
      const playedId: string | null =
        data.decisionId !== undefined ? data.decisionId : (decision?.id ?? null);
      run.decisions.push({ turnNumber, decisionId: playedId });
      run.state = data.endState;
      run.events.push(...data.events);

      return {
        turnNumber,
        ...turnMinutes(turnNumber),
        events: data.events,
        segmentSummary: data.segmentSummary,
        turnPrompt: data.turnPrompt,
        nextTurn: data.nextTurn,
        endState: data.endState,
      };
    },
    [userId, run]
  );

  /**
   * Banks the match. The server replays the turns from the seed and the
   * decisions and answers with the score it computed; a rejection comes back
   * as a settlement the screen can show, not an exception, because "this did
   * not count" is a result the player needs to see.
   */
  const finalizeMatch = useCallback(async (): Promise<MatchSettlement> => {
    const { homeScore, awayScore } = run.state;
    const opponent = run.fixture.opponent;
    const homeTeam = run.fixture.isHome ? run.userTeam : opponent;
    const awayTeam = run.fixture.isHome ? opponent : run.userTeam;
    const watched = {
      homeScore,
      awayScore,
      winner: homeScore > awayScore ? homeTeam : awayScore > homeScore ? awayTeam : 'Empate',
      events: [...run.events],
    };

    try {
      const response = await fetch('/api/match/finalize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          seed: run.seed,
          week: run.fixture.week,
          opponent,
          isHome: run.fixture.isHome,
          decisions: run.decisions,
          // Never the input to the result — only a cross-check, so a screen
          // that has drifted out of step is told rather than quietly saved.
          claimedScore: { homeScore, awayScore },
        }),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        console.error(
          '[useTurnBasedMatch] finalize refused',
          response.status,
          data?.code ?? data?.error,
          data?.message
        );
        return {
          status: 'rejected',
          result: watched,
          fixture: run.fixture,
          error: rejectionMessage(response.status, data?.error),
          retryable: isRetryable(response.status),
        };
      }

      return {
        status: 'saved',
        result: data.result,
        fixture: run.fixture,
        pointsEarned: data.pointsEarned,
        matchResult: data.matchResult,
        earnings: data.earnings,
        updatedGameState: data.updatedGameState,
      };
    } catch {
      // The request never came back. The match may or may not have been
      // banked — only the server knows — so this is the case a retry is for:
      // sending it again either banks it or is told it already counted.
      return {
        status: 'rejected',
        result: watched,
        fixture: run.fixture,
        error: FINALIZE_FAILED,
        retryable: true,
      };
    }
  }, [userId, run]);

  return {
    /** The match seed every turn of this match is derived from. */
    matchSeed: run.seed,
    /** The fixture as it stood at kickoff, which finalize is checked against. */
    fixture: run.fixture,
    firstTurn,
    submitTurn,
    finalizeMatch,
    totalTurns: DECISION_TURNS.length,
  };
}
