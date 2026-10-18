import {
  MatchEvent,
  MatchSegment,
  TurnResult,
  DecisionTurn,
  Player,
  TurnMentality,
} from './types';
import { simulateMatchSegment as simulateSegment } from './game-engine';
import { buildDecisionTurn, applyTurnResult } from './decision-engine';
import { generateSegmentSummary, generateTurnPrompt } from './commentary';
import { DECISION_TURNS } from './constants';

export interface FullMatchResult {
  homeScore: number;
  awayScore: number;
  events: MatchEvent[];
  winner: string;
  segments: MatchSegment[];
  turnHistory: TurnResult[];
}

interface MatchState {
  homeScore: number;
  awayScore: number;
  homeMomentum: number;
  awayMomentum: number;
  tension: number;
  formation: string;
  mentality: TurnMentality;
  hasRedCard: boolean;
}

const INITIAL_STATE: MatchState = {
  homeScore: 0,
  awayScore: 0,
  homeMomentum: 0,
  awayMomentum: 0,
  tension: 30,
  formation: '4-3-3',
  mentality: 'balanced',
  hasRedCard: false,
};

/**
 * Runs a full 90-minute match as a sequence of 6 segments with decision turns.
 * Each segment runs from one turn minute to the next.
 * Between segments, a DecisionTurn is generated for the user.
 *
 * This function is for PvE (single-player) mode where all decisions are made upfront.
 * For async PvP, use runMatchSegment() to run one segment at a time.
 */
export function runFullMatch(
  homeTeam: string,
  awayTeam: string,
  homeSquad: Player[],
  awaySquad: Player[],
  homeMorale: number,
  awayMorale: number,
  decisions: (TurnResult | null)[],
  week?: number
): FullMatchResult {
  let state: MatchState = { ...INITIAL_STATE };
  let currentSquad = homeSquad.map((p) => ({ ...p }));

  const allEvents: MatchEvent[] = [];
  const segments: MatchSegment[] = [];
  const turnHistory: TurnResult[] = [];

  for (let i = 0; i < DECISION_TURNS.length; i++) {
    const turnConfig = DECISION_TURNS[i];
    const fromMinute = turnConfig.minute;
    const toMinute = i < DECISION_TURNS.length - 1
      ? DECISION_TURNS[i + 1].minute
      : 90;

    const homeScoreAtStart = state.homeScore;
    const awayScoreAtStart = state.awayScore;

    // Get the user's decision for this turn (or null for default)
    const userDecision = decisions[i] ?? null;

    // Apply turn result if provided
    if (userDecision) {
      const applied = applyTurnResult(userDecision, {
        formation: state.formation,
        mentality: state.mentality,
        squad: currentSquad,
      });
      state.formation = applied.formation;
      state.mentality = applied.mentality;
      currentSquad = applied.squad;
      turnHistory.push(userDecision);
    }

    // Simulate the segment
    const segmentResult = simulateSegment(
      homeTeam,
      awayTeam,
      currentSquad,
      awaySquad,
      homeMorale,
      awayMorale,
      fromMinute,
      toMinute,
      {
        homeScore: state.homeScore,
        awayScore: state.awayScore,
        homeMomentum: state.homeMomentum,
        awayMomentum: state.awayMomentum,
        tension: state.tension,
      },
      userDecision ?? undefined,
      week
    );

    // Update state from segment result
    state.homeScore = segmentResult.endState.homeScore;
    state.awayScore = segmentResult.endState.awayScore;
    state.homeMomentum = segmentResult.endState.homeMomentum;
    state.awayMomentum = segmentResult.endState.awayMomentum;
    state.tension = segmentResult.endState.tension;
    if (segmentResult.endState.hasRedCard) {
      state.hasRedCard = true;
    }

    // Accumulate events
    allEvents.push(...segmentResult.events);

    // Store segment
    const segment: MatchSegment = {
      fromMinute,
      toMinute,
      events: segmentResult.events,
      homeScoreAtStart,
      awayScoreAtStart,
      homeScoreAtEnd: state.homeScore,
      awayScoreAtEnd: state.awayScore,
      turnResult: userDecision ?? undefined,
    };
    segments.push(segment);
  }

  const winner = state.homeScore > state.awayScore
    ? homeTeam
    : state.awayScore > state.homeScore
      ? awayTeam
      : 'Empate';

  return {
    homeScore: state.homeScore,
    awayScore: state.awayScore,
    events: allEvents,
    winner,
    segments,
    turnHistory,
  };
}

/**
 * Runs a single match segment and returns the result.
 * Used for async PvP where each segment is run on-demand.
 */
export function runMatchSegment(
  homeTeam: string,
  awayTeam: string,
  homeSquad: Player[],
  awaySquad: Player[],
  homeMorale: number,
  awayMorale: number,
  turnNumber: number,
  priorState: {
    homeScore: number;
    awayScore: number;
    homeMomentum: number;
    awayMomentum: number;
    tension: number;
    formation: string;
    mentality: TurnMentality;
    hasRedCard: boolean;
    squad: Player[];
  },
  turnResult?: TurnResult,
  week?: number
): {
  events: MatchEvent[];
  segmentSummary: string;
  turnPrompt: string;
  nextTurn: DecisionTurn | null;
  endState: {
    homeScore: number;
    awayScore: number;
    homeMomentum: number;
    awayMomentum: number;
    tension: number;
    formation: string;
    mentality: TurnMentality;
    hasRedCard: boolean;
    squad: Player[];
  };
} {
  const turnConfig = DECISION_TURNS[turnNumber];

  if (!turnConfig) {
    throw new Error(
      `Invalid turn number: ${turnNumber}. Must be between 0 and ${DECISION_TURNS.length - 1}.`
    );
  }

  const fromMinute = turnConfig.minute;
  const toMinute = turnNumber < DECISION_TURNS.length - 1
    ? DECISION_TURNS[turnNumber + 1].minute
    : 90;

  // Apply turn result to get updated state before simulation
  let formation = priorState.formation;
  let mentality = priorState.mentality;
  let currentSquad = priorState.squad
    ? priorState.squad.map((p) => ({ ...p }))
    : homeSquad.map((p) => ({ ...p }));

  if (turnResult) {
    const applied = applyTurnResult(turnResult, {
      formation: priorState.formation,
      mentality: priorState.mentality,
      squad: currentSquad,
    });
    formation = applied.formation;
    mentality = applied.mentality;
    currentSquad = applied.squad;
  }

  // Simulate the segment
  const segmentResult = simulateSegment(
    homeTeam,
    awayTeam,
    currentSquad,
    awaySquad,
    homeMorale,
    awayMorale,
    fromMinute,
    toMinute,
    {
      homeScore: priorState.homeScore,
      awayScore: priorState.awayScore,
      homeMomentum: priorState.homeMomentum,
      awayMomentum: priorState.awayMomentum,
      tension: priorState.tension,
    },
    turnResult,
    week
  );

  // Build end state
  const endState = {
    homeScore: segmentResult.endState.homeScore,
    awayScore: segmentResult.endState.awayScore,
    homeMomentum: segmentResult.endState.homeMomentum,
    awayMomentum: segmentResult.endState.awayMomentum,
    tension: segmentResult.endState.tension,
    formation,
    mentality,
    hasRedCard: priorState.hasRedCard || segmentResult.endState.hasRedCard,
    squad: currentSquad,
  };

  // Generate segment summary
  const segmentSummary = generateSegmentSummary(
    segmentResult.events,
    homeTeam,
    awayTeam,
    endState.homeScore,
    endState.awayScore,
    fromMinute,
    toMinute
  );

  // Build next turn if not the last one
  const isLastTurn = turnNumber >= DECISION_TURNS.length - 1;
  let nextTurn: DecisionTurn | null = null;
  let turnPrompt = '';

  if (!isLastTurn) {
    const nextTurnNumber = turnNumber + 1;
    const nextTurnConfig = DECISION_TURNS[nextTurnNumber];

    nextTurn = buildDecisionTurn(
      nextTurnNumber,
      endState.homeScore,
      endState.awayScore,
      currentSquad,
      endState.formation,
      endState.mentality,
      endState.hasRedCard
    );

    // Find a tired player name for the prompt if applicable
    const tiredPlayer = currentSquad.find((p) => p.fatigue > 50);
    const tiredPlayerName = tiredPlayer?.name;

    turnPrompt = generateTurnPrompt(
      nextTurnConfig.label,
      endState.homeScore,
      endState.awayScore,
      homeTeam,
      awayTeam,
      segmentSummary,
      endState.hasRedCard,
      tiredPlayerName
    );
  }

  return {
    events: segmentResult.events,
    segmentSummary,
    turnPrompt,
    nextTurn,
    endState,
  };
}
