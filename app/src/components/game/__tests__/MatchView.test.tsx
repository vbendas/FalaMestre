import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { settle, tickUntil } from '@/test/match-timers';
import { useState } from 'react';
import { withSeed } from '@/lib/rng';
import { createInitialGameState, BRAZILIAN_TEAMS } from '@/lib/game-engine';
import { buildDecisionTurn } from '@/lib/decision-engine';
import { DECISION_TURNS, SEASON_LENGTH } from '@/lib/constants';
import { MatchView } from '../MatchView';
import type { GameState } from '@/lib/types';

/**
 * What the match screen does with a match the server would not bank.
 *
 * The case that matters is a finalize whose *response* is lost: the save moved
 * on, the screen did not hear about it, and the screen's copy still shows the
 * fixture that has already been played. While that copy stays stale, every
 * attempt to play the week again is refused for the same reason — the player
 * cannot get out of it without reloading the page. So a refusal has to send
 * the screen back to the save.
 */

const USER_ID = 'user_abc123def';
const USER_TEAM = BRAZILIAN_TEAMS[0].name;
const PLAYED = BRAZILIAN_TEAMS[1].name;
const NEXT_WEEK = BRAZILIAN_TEAMS[2].name;
const WEEK = 7;

function saveAt(week: number, opponent: string): GameState {
  const state = withSeed('fixture', () => createInitialGameState(USER_ID, USER_TEAM));
  state.season.week = week;
  state.season.nextMatch = { opponent, isHome: true, date: 'x', competition: 'Liga Mestre' };
  return state;
}

const beforeMatch = saveAt(WEEK, PLAYED);

function promptFor(turnNumber: number) {
  return buildDecisionTurn(turnNumber, 0, 0, beforeMatch.squad.players, '4-3-3', 'balanced', false);
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

function mockServer(finalize: (attempt: number) => Response | Promise<Response>) {
  const sent: Array<{ url: string; body: Record<string, any> | null }> = [];
  let attempts = 0;
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (url, init) => {
    const u = String(url);
    const raw = init && (init as RequestInit).body;
    const body = raw ? JSON.parse(String(raw)) : null;
    sent.push({ url: u, body });

    if (u.endsWith('/api/match/decide')) {
      const turnNumber = body!.turnNumber as number;
      const isLast = turnNumber >= DECISION_TURNS.length - 1;
      return jsonResponse({
        events: [],
        segmentSummary: `s${turnNumber}`,
        turnPrompt: `p${turnNumber}`,
        nextTurn: isLast ? null : promptFor(turnNumber + 1),
        endState: {
          homeScore: 1, awayScore: 0, homeMomentum: 0, awayMomentum: 0, tension: 30,
          formation: '4-3-3', mentality: 'balanced', hasRedCard: false,
          squad: beforeMatch.squad.players,
        },
      });
    }
    attempts += 1;
    return finalize(attempts);
  });
  return sent;
}

/**
 * Plays a whole match by letting every prompt and summary time out, one timer
 * at a time so the screen renders between them (see src/test/match-timers.ts).
 */
async function playByTimeout(sent: Array<{ url: string }>, attempts = 1) {
  await tickUntil(
    () => sent.filter((r) => r.url.endsWith('/api/match/finalize')).length >= attempts,
    'the match to be sent for settling'
  );
  await settle();
}

/**
 * Stands in for the page: holds the save, and replaces it when the screen
 * asks for a refresh — which is what `useGameState.refreshGameState` does.
 */
function Page({ refreshedTo }: { refreshedTo: GameState | null }) {
  const [save, setSave] = useState(beforeMatch);
  const [refreshes, setRefreshes] = useState(0);
  return (
    <>
      <div data-testid="refreshes">{refreshes}</div>
      <MatchView
        gameState={save}
        onShowMatchResult={() => {}}
        onRefreshSave={() => {
          setRefreshes((n) => n + 1);
          if (refreshedTo) setSave(refreshedTo);
        }}
      />
    </>
  );
}

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('MatchView once the season is over', () => {
  /** The save as the bookkeeping leaves it after the last round. */
  function closedSeason(): GameState {
    const state = saveAt(SEASON_LENGTH + 1, 'Temporada Completa');
    state.season.nextMatch.competition = 'Fim da Temporada';
    state.season.points = 61;
    state.season.wins = 18;
    state.season.draws = 7;
    state.season.losses = 13;
    state.season.position = 4;
    state.teamStats.matchesPlayed = SEASON_LENGTH;
    state.context.availableActions = ['view_final_standings', 'new_season'];
    return state;
  }

  it('shows how the season ended instead of a match to play', () => {
    render(
      <MatchView gameState={closedSeason()} onShowMatchResult={() => {}} />
    );

    expect(screen.getByText('Temporada Encerrada')).toBeInTheDocument();
    // The placeholder the save carries is not offered as an opponent, and
    // there is nothing to press: both were how a thirty-ninth match got
    // played.
    expect(screen.queryByText('JOGAR AGORA')).not.toBeInTheDocument();
    expect(screen.queryByText('Temporada Completa')).not.toBeInTheDocument();
    expect(screen.queryByText('VS')).not.toBeInTheDocument();
  });

  it('reports the campaign that was played', () => {
    render(
      <MatchView gameState={closedSeason()} onShowMatchResult={() => {}} />
    );

    expect(screen.getByText('4º')).toBeInTheDocument();
    expect(screen.getByText('61')).toBeInTheDocument();
    expect(screen.getByText('18')).toBeInTheDocument();
    expect(screen.getByText(String(SEASON_LENGTH))).toBeInTheDocument();
  });

  it('still offers the match on the last round of the season', () => {
    const lastRound = saveAt(SEASON_LENGTH, PLAYED);

    render(<MatchView gameState={lastRound} onShowMatchResult={() => {}} />);

    expect(screen.getByText('JOGAR AGORA')).toBeInTheDocument();
    expect(screen.queryByText('Temporada Encerrada')).not.toBeInTheDocument();
  });
});

describe('MatchView after a refused finalize', () => {
  it('asks for the save to be re-read and says the match did not count', async () => {
    vi.useFakeTimers();
    const sent = mockServer(() => jsonResponse({ error: 'Fixture mismatch' }, 409));

    render(<Page refreshedTo={null} />);
    await settle();
    fireEvent.click(screen.getByText('JOGAR AGORA'));
    await playByTimeout(sent);

    expect(screen.getByText('A partida não contou')).toBeInTheDocument();
    expect(screen.getByTestId('refreshes').textContent).toBe('1');
  }, 20_000);

  it('moves on to the next fixture once the refreshed save arrives', async () => {
    vi.useFakeTimers();
    // The response to the first finalize is lost, but it did reach the server:
    // the save is already on the next week.
    const sent = mockServer((attempt) =>
      attempt === 1 ? Promise.reject(new Error('network down')) : jsonResponse({ error: 'Fixture mismatch' }, 409)
    );

    render(<Page refreshedTo={saveAt(WEEK + 1, NEXT_WEEK)} />);
    await settle();
    fireEvent.click(screen.getByText('JOGAR AGORA'));
    await playByTimeout(sent);

    expect(screen.getByText('A partida não contou')).toBeInTheDocument();

    // The player goes back. The screen is now showing the save as it really
    // is: next week, next opponent — not the fixture that was just played.
    fireEvent.click(screen.getByText('Voltar'));
    await settle();

    expect(screen.getByText(NEXT_WEEK)).toBeInTheDocument();
    expect(screen.queryByText(PLAYED)).not.toBeInTheDocument();

    // Playing from here finalizes the *new* fixture, so there is no loop of
    // refusals: before the refresh this sent week 7 against the old opponent
    // for ever.
    fireEvent.click(screen.getByText('JOGAR AGORA'));
    await playByTimeout(sent, 2);

    const finalizes = sent.filter((r) => r.url.endsWith('/api/match/finalize'));
    expect(finalizes).toHaveLength(2);
    expect(finalizes[0].body!.week).toBe(WEEK);
    expect(finalizes[0].body!.opponent).toBe(PLAYED);
    expect(finalizes[1].body!.week).toBe(WEEK + 1);
    expect(finalizes[1].body!.opponent).toBe(NEXT_WEEK);
  }, 30_000);

  it('keeps the warning on screen when the save really has not moved', async () => {
    vi.useFakeTimers();
    const sent = mockServer(() => jsonResponse({ error: 'Failed to save match' }, 503));

    // The refresh brings back the same week: the match genuinely did not count.
    render(<Page refreshedTo={saveAt(WEEK, PLAYED)} />);
    await settle();
    fireEvent.click(screen.getByText('JOGAR AGORA'));
    await playByTimeout(sent);

    expect(screen.getByText('A partida não contou')).toBeInTheDocument();
    expect(screen.getByText('Tentar novamente')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Voltar'));
    await settle();

    // Back on the same fixture, with the banner explaining why.
    expect(screen.getByText(PLAYED)).toBeInTheDocument();
    expect(screen.getByText('JOGAR AGORA')).toBeInTheDocument();
  }, 20_000);
});
