/**
 * Replaying a turn-based match on the server.
 *
 * The match screen plays a match as six decision turns, one /api/match/decide
 * call each. Those calls save nothing, and the score they report lives only in
 * the browser. /api/match/finalize settles such a match — but it must not
 * believe the score the client sends, so it replays the turns itself from the
 * match seed and the decisions and uses the score *it* computes.
 *
 * For that to be worth anything the replay has to land on the same score as
 * the turns the player watched. Two things make that true:
 *
 *  1. `playDecisionTurn` is the one place a turn is played. /api/match/decide
 *     calls it and so does the replay, so there is no second implementation to
 *     drift — the draws (opponent squad, opponent morale, then the segment)
 *     happen in one order, under one seed, in one synchronous block.
 *  2. `deriveTurnSeed` pins each turn's seed to the match seed, so the whole
 *     match follows from a single token. A client driving the live turns sends
 *     `deriveTurnSeed(matchSeed, turnNumber)` as each decide call's `seed`;
 *     finalize re-derives the same seeds from `matchSeed` alone.
 *
 * Everything else a turn needs, the server already has or recomputes: the
 * squad and morale come from the saved game, and the state each turn starts
 * from is the previous turn's end state, chained here rather than taken from
 * the request. The only thing the client is trusted for is *which* option it
 * picked, and even that is checked against the options the server would have
 * offered for the replayed state (see `replayMatch`).
 */

import {
  DecisionOption,
  MatchEvent,
  MatchSegment,
  Player,
  TurnMentality,
  TurnResult,
} from './types';
import { DECISION_TURNS } from './constants';
import { generateSquad } from './game-engine';
import { buildDecisionTurn, createTurnResult, resolveDefaultAction } from './decision-engine';
import { runMatchSegment } from './match-segment-engine';
import { rollOpponentMorale } from './match-setup';
import { deriveTurnSeed } from './match-seed';
import { withSeed } from './rng';
import { Seed } from './validations';

/** The state a decision turn starts from — the previous turn's end state. */
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

/** The fixture being played, from the saved game's point of view. */
export interface MatchSetup {
  userTeam: string;
  opponentTeam: string;
  isHome: boolean;
  /** The user squad's morale; the opponent's is rolled per turn. */
  userMorale: number;
  week: number;
}

/** Kickoff state: 0-0, balanced, the squad as it was named. */
export function initialTurnState(formation: string, squad: Player[]): TurnState {
  return {
    homeScore: 0,
    awayScore: 0,
    homeMomentum: 0,
    awayMomentum: 0,
    tension: 30,
    formation: formation || '4-3-3',
    mentality: 'balanced',
    hasRedCard: false,
    squad,
  };
}

// The per-turn seed derivation is the contract between the match screen and
// these routes, so it lives in match-seed.ts, which the client can import
// without the match engine behind it. Re-exported here because the replay is
// its other half.
export { deriveTurnSeed } from './match-seed';

export interface PlayedTurn {
  turnResult: TurnResult;
  events: MatchEvent[];
  segmentSummary: string;
  turnPrompt: string;
  nextTurn: ReturnType<typeof buildDecisionTurn> | null;
  endState: TurnState;
}

/**
 * Plays one decision turn under `seed`.
 *
 * The single implementation of a turn, shared by /api/match/decide and the
 * replay below. Every random draw the turn makes happens inside one
 * synchronous seeded block, in this order — opponent squad, opponent morale,
 * then the segment — because `withSeed` cannot span an await and the replay
 * has to make the same draws in the same order to land on the same events
 * (see rng.ts).
 *
 * `decision` is the option the user picked, or null for a timeout, in which
 * case the context-aware default stands in exactly as it does live.
 */
export function playDecisionTurn(
  setup: MatchSetup,
  turnNumber: number,
  decision: DecisionOption | null,
  priorState: TurnState,
  seed: Seed
): PlayedTurn {
  const turnConfig = DECISION_TURNS[turnNumber];
  if (!turnConfig) {
    throw new Error(
      `Invalid turn number: ${turnNumber}. Must be between 0 and ${DECISION_TURNS.length - 1}.`
    );
  }

  return withSeed(seed, () => {
    const { isHome, opponentTeam } = setup;
    const opponentSquad = generateSquad(opponentTeam);
    const opponentMorale = rollOpponentMorale();

    const homeTeam = isHome ? setup.userTeam : opponentTeam;
    const awayTeam = isHome ? opponentTeam : setup.userTeam;
    const homeSquad = isHome ? priorState.squad : opponentSquad;
    const awaySquad = isHome ? opponentSquad : priorState.squad;
    const homeMorale = isHome ? setup.userMorale : opponentMorale;
    const awayMorale = isHome ? opponentMorale : setup.userMorale;

    const turnResult = createTurnResult(
      turnNumber,
      turnConfig.minute,
      decision,
      resolveDefaultAction(
        priorState.homeScore,
        priorState.awayScore,
        priorState.squad,
        priorState.hasRedCard
      )
    );

    const segment = runMatchSegment(
      homeTeam,
      awayTeam,
      homeSquad,
      awaySquad,
      homeMorale,
      awayMorale,
      turnNumber,
      priorState,
      turnResult,
      setup.week
    );

    return { turnResult, ...segment };
  });
}

/** One turn of a match as the client reports having played it. */
export interface SubmittedDecision {
  turnNumber: number;
  /** The id of the option picked, or null when the timer ran out. */
  decisionId: string | null;
}

export interface ReplayedMatch {
  homeScore: number;
  awayScore: number;
  /** The winning team's name, or 'Empate'. */
  winner: string;
  events: MatchEvent[];
  segments: MatchSegment[];
  turnHistory: TurnResult[];
  /** The per-turn seeds the replay used, in turn order. */
  turnSeeds: string[];
}

export type ReplayRejection =
  | { code: 'turn_coverage'; message: string }
  | { code: 'unknown_decision'; message: string };

export type ReplayResult =
  | { ok: true; match: ReplayedMatch }
  | { ok: false; rejection: ReplayRejection };

/**
 * Replays a whole match from the match seed and the decisions.
 *
 * A match is all six turns or nothing: the decisions must be turns 0 through
 * 5, in order, with no gaps, repeats or extras. Anything less would let a
 * caller choose how much football to play — dropping the opening segments, or
 * stopping once ahead — and the score would still be "confirmed by the
 * server". The 90 minutes are not negotiable, so an incomplete list is
 * rejected rather than padded with defaults.
 *
 * Each decision is given as an *option id*, resolved against the options the
 * server itself generates for the replayed state. That is what stops a client
 * from inventing a decision: a tactic that was never offered, a mentality
 * switch at a minute where it was not on the menu, or a hand-written option
 * with a formation of its own, all fail to resolve. A null id means the timer
 * ran out and the default applies.
 */
export function replayMatch(
  setup: MatchSetup,
  matchSeed: Seed,
  formation: string,
  squad: Player[],
  decisions: SubmittedDecision[],
  /**
   * Turns whose decision was recorded when the turn was played live (see
   * fixture-kickoff.ts). A recorded decision the replay does not offer
   * plays as the timer's default instead of refusing the whole match: it
   * was already played, and refusing it would leave a fixture that can
   * never be banked.
   */
  recordedTurns: ReadonlySet<number> = new Set()
): ReplayResult {
  const expectedTurns = DECISION_TURNS.length;

  if (decisions.length !== expectedTurns) {
    return {
      ok: false,
      rejection: {
        code: 'turn_coverage',
        message: `decisions must cover all ${expectedTurns} turns, received ${decisions.length}`,
      },
    };
  }

  for (let i = 0; i < expectedTurns; i++) {
    if (decisions[i].turnNumber !== i) {
      return {
        ok: false,
        rejection: {
          code: 'turn_coverage',
          message: `decisions must be turns 0 to ${expectedTurns - 1} in order; found turn ${decisions[i].turnNumber} at position ${i}`,
        },
      };
    }
  }

  let state = initialTurnState(formation, squad.map((p) => ({ ...p })));
  const events: MatchEvent[] = [];
  const segments: MatchSegment[] = [];
  const turnHistory: TurnResult[] = [];
  const turnSeeds: string[] = [];

  for (let turnNumber = 0; turnNumber < expectedTurns; turnNumber++) {
    const { decisionId } = decisions[turnNumber];

    // The prompt the player answered for this turn, rebuilt from the state the
    // replay has reached — so the option set is the server's, not the client's.
    const offered = buildDecisionTurn(
      turnNumber,
      state.homeScore,
      state.awayScore,
      state.squad,
      state.formation,
      state.mentality,
      state.hasRedCard
    );

    let decision: DecisionOption | null = null;
    if (decisionId !== null) {
      decision =
        offered.options.find((option) => option.id === decisionId) ??
        (offered.defaultOption.id === decisionId ? offered.defaultOption : null);

      if (!decision && !recordedTurns.has(turnNumber)) {
        return {
          ok: false,
          rejection: {
            code: 'unknown_decision',
            message: `decision "${decisionId}" was not offered at turn ${turnNumber}`,
          },
        };
      }
    }

    const seed = deriveTurnSeed(matchSeed, turnNumber);
    turnSeeds.push(seed);

    const homeScoreAtStart = state.homeScore;
    const awayScoreAtStart = state.awayScore;

    const played = playDecisionTurn(setup, turnNumber, decision, state, seed);

    state = played.endState;
    events.push(...played.events);
    turnHistory.push(played.turnResult);

    const fromMinute = DECISION_TURNS[turnNumber].minute;
    const toMinute =
      turnNumber < expectedTurns - 1 ? DECISION_TURNS[turnNumber + 1].minute : 90;

    segments.push({
      fromMinute,
      toMinute,
      events: played.events,
      homeScoreAtStart,
      awayScoreAtStart,
      homeScoreAtEnd: state.homeScore,
      awayScoreAtEnd: state.awayScore,
      turnResult: played.turnResult,
    });
  }

  const homeTeam = setup.isHome ? setup.userTeam : setup.opponentTeam;
  const awayTeam = setup.isHome ? setup.opponentTeam : setup.userTeam;
  const winner =
    state.homeScore > state.awayScore
      ? homeTeam
      : state.awayScore > state.homeScore
        ? awayTeam
        : 'Empate';

  return {
    ok: true,
    match: {
      homeScore: state.homeScore,
      awayScore: state.awayScore,
      winner,
      events,
      segments,
      turnHistory,
      turnSeeds,
    },
  };
}
