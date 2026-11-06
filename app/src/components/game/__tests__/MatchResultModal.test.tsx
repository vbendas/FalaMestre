import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { withSeed } from '@/lib/rng';
import { createInitialGameState, BRAZILIAN_TEAMS } from '@/lib/game-engine';
import { MatchResultModal } from '../MatchResultModal';
import type { GameState } from '@/lib/types';

/**
 * The modal is shown *after* the match has been banked, by which point the
 * save already points at next week's fixture. These tests cover the two things
 * that go wrong when it reads the save instead of the result: naming the wrong
 * opponent, and putting the player on the wrong side of the score.
 */

const USER_ID = 'user_abc123def';
const USER_TEAM = BRAZILIAN_TEAMS[0].name;
const PLAYED = BRAZILIAN_TEAMS[1].name;
const NEXT_WEEK = BRAZILIAN_TEAMS[2].name;

/** The save as it looks once the match is banked: on to the next fixture. */
function savedAfterMatch(): GameState {
  const state = withSeed('fixture', () => createInitialGameState(USER_ID, USER_TEAM));
  state.season.week = 5;
  state.season.nextMatch = {
    opponent: NEXT_WEEK,
    isHome: false,
    date: '2026-01-01T00:00:00.000Z',
    competition: 'Liga Mestre',
  };
  return state;
}

describe('MatchResultModal', () => {
  it('names the fixture that was played, not the one coming up', () => {
    render(
      <MatchResultModal
        isOpen
        result={{ homeScore: 2, awayScore: 1, winner: USER_TEAM, events: [] }}
        gameState={savedAfterMatch()}
        pointsEarned={3}
        fixture={{ opponent: PLAYED, isHome: true }}
        onClose={() => {}}
      />
    );

    expect(screen.getByText(PLAYED)).toBeInTheDocument();
    expect(screen.queryByText(NEXT_WEEK)).not.toBeInTheDocument();
  });

  it('shows the points the match actually earned', () => {
    render(
      <MatchResultModal
        isOpen
        result={{ homeScore: 1, awayScore: 1, winner: 'Empate', events: [] }}
        gameState={savedAfterMatch()}
        pointsEarned={1}
        fixture={{ opponent: PLAYED, isHome: true }}
        onClose={() => {}}
      />
    );

    expect(screen.getByText('+1')).toBeInTheDocument();
    expect(screen.getByText('Empate: +1 ponto na tabela')).toBeInTheDocument();
  });

  it('puts the player on the away side when they played away', () => {
    render(
      <MatchResultModal
        isOpen
        // 3-0 to the home side, which away from home is the opponent.
        result={{ homeScore: 3, awayScore: 0, winner: PLAYED, events: [] }}
        gameState={savedAfterMatch()}
        pointsEarned={0}
        fixture={{ opponent: PLAYED, isHome: false }}
        onClose={() => {}}
      />
    );

    const teams = screen.getAllByText(new RegExp(`${USER_TEAM}|${PLAYED}`));
    // The opponent is listed first: they were at home.
    expect(teams[0].textContent).toBe(PLAYED);
    expect(screen.getByText('Derrota')).toBeInTheDocument();
  });

  it('falls back to the save when no fixture is given', () => {
    render(
      <MatchResultModal
        isOpen
        result={{ homeScore: 0, awayScore: 0, winner: 'Empate', events: [] }}
        gameState={savedAfterMatch()}
        pointsEarned={1}
        onClose={() => {}}
      />
    );

    expect(screen.getByText(NEXT_WEEK)).toBeInTheDocument();
  });
});
