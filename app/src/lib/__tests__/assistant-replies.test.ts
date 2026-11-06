import { describe, it, expect, vi, afterEach } from 'vitest';
import { withSeed } from '@/lib/rng';
import { createInitialGameState, BRAZILIAN_TEAMS } from '@/lib/game-engine';
import { SEASON_LENGTH } from '@/lib/constants';
import { callAIMock } from '@/lib/ai-service';
import {
  allowedActionsFor,
  filterSuggestions,
  lookupAction,
  suggestActions,
} from '@/lib/assistant-actions';
import type { GameState } from '@/lib/types';

/**
 * What the assistant says and offers has to follow the save. Three things
 * are pinned here: a suggestion is only ever something the chat can open,
 * the suggestions follow the reply rather than being one fixed list, and a
 * finished season is talked about as finished instead of as a fixture
 * against the 'Temporada Completa' placeholder the save carries.
 */

const USER_ID = 'user_abc123def';

function midSeason(): GameState {
  const state = withSeed('fixture', () =>
    createInitialGameState(USER_ID, BRAZILIAN_TEAMS[0].name)
  );
  state.season.week = 12;
  state.season.points = 18;
  state.season.position = 7;
  state.season.wins = 5;
  state.season.draws = 3;
  state.season.losses = 3;
  return state;
}

/** A save the way match bookkeeping leaves it once the last round is banked. */
function finishedSeason(): GameState {
  const state = midSeason();
  state.season.week = SEASON_LENGTH + 1;
  state.season.points = 61;
  state.season.position = 3;
  state.season.wins = 18;
  state.season.draws = 7;
  state.season.losses = 13;
  state.season.nextMatch = {
    opponent: 'Temporada Completa',
    isHome: false,
    date: new Date().toISOString(),
    competition: 'Fim da Temporada',
  };
  state.context.availableActions = ['view_final_standings', 'new_season'];
  return state;
}

describe('suggested actions', () => {
  it('only ever suggests something the chat screen can open', () => {
    const states = [midSeason(), finishedSeason()];
    const intents = [
      'greeting',
      'view_squad',
      'transfer_market',
      'play_match',
      'standings',
      'match_result',
      'training',
      'general_chat',
      'an_intent_nobody_defined',
    ];
    for (const state of states) {
      for (const intent of intents) {
        const suggested = suggestActions(state, intent);
        expect(suggested.length).toBeGreaterThan(0);
        for (const key of suggested) {
          expect(lookupAction(key), `${intent} suggested ${key}`).toBeDefined();
        }
      }
    }
  });

  it('follows what was just said instead of one fixed list', () => {
    const state = midSeason();
    expect(suggestActions(state, 'transfer_market')[0]).toBe('transfer_market');
    expect(suggestActions(state, 'view_squad')[0]).toBe('view_squad');
    expect(suggestActions(state, 'training')[0]).toBe('train');
    expect(suggestActions(state, 'standings')[0]).toBe('view_standings');
    expect(suggestActions(state, 'next_opponent')[0]).toBe('play_match');
    // Three different intents, three different lists.
    const lists = ['transfer_market', 'view_squad', 'standings'].map((intent) =>
      suggestActions(state, intent).join(',')
    );
    expect(new Set(lists).size).toBe(3);
  });

  it('drops the match and the live table once the season is over', () => {
    const over = finishedSeason();
    for (const intent of ['greeting', 'play_match', 'standings', 'season_over']) {
      const suggested = suggestActions(over, intent);
      expect(suggested).not.toContain('play_match');
      expect(suggested).not.toContain('view_standings');
    }
    expect(suggestActions(over, 'season_over')).toContain('view_final_standings');
    // Asking about the table at the end of a season leads to the final one.
    expect(suggestActions(over, 'standings')[0]).toBe('view_final_standings');
    // The one the save itself still carries, for a feature that does not
    // exist, is never offered.
    expect(allowedActionsFor(over).map((a) => a.key)).not.toContain('new_season');
    expect(lookupAction('new_season')).toBeUndefined();
  });

  it('offers the live table mid-season and not the final one', () => {
    const suggested = suggestActions(midSeason(), 'standings');
    expect(suggested).toContain('view_standings');
    expect(suggested).not.toContain('view_final_standings');
  });

  it('throws away what the live model invented and keeps what it got right', () => {
    const state = midSeason();
    expect(filterSuggestions(state, 'view_squad', ['view_squad', 'new_season', 'buy_a_yacht'])).toEqual([
      'view_squad',
    ]);
    // Nothing usable left: the intent's own suggestions stand in.
    expect(filterSuggestions(state, 'transfer_market', ['new_season'])).toEqual(
      suggestActions(state, 'transfer_market')
    );
    expect(filterSuggestions(state, 'greeting', 'not even a list')).toEqual(
      suggestActions(state, 'greeting')
    );
  });
});

describe('the mock assistant', () => {
  it('marks its replies as coming from the mock', async () => {
    const reply = await callAIMock('oi', midSeason(), [], 'seed-1');
    expect(reply.source).toBe('mock');
  });

  it('answers about the next match with the fixture mid-season', async () => {
    const state = midSeason();
    const reply = await callAIMock('e o próximo jogo?', state, [], 'seed-2');
    expect(reply.content).toContain(state.season.nextMatch.opponent);
    expect(reply.actions).toContain('play_match');
  });

  for (const [label, question] of [
    ['a question about the next match', 'quando é a próxima partida?'],
    ['a greeting', 'oi'],
    ['a question about the table', 'como está a classificação?'],
    ['anything else', 'e aí, o que acha?'],
  ] as const) {
    it(`says the season is over when asked ${label}`, async () => {
      const over = finishedSeason();
      const reply = await callAIMock(question, over, [], `seed-${label}`);

      // Never the placeholder fixture, and never a match being pitched.
      expect(reply.content).not.toContain('Temporada Completa');
      expect(reply.actions).not.toContain('play_match');
      for (const key of reply.actions) expect(lookupAction(key)).toBeDefined();
    });
  }

  it('reports the finished campaign when asked about the next match', async () => {
    const over = finishedSeason();
    const reply = await callAIMock('e o próximo jogo?', over, [], 'seed-over');
    expect(reply.intent).toBe('season_over');
    expect(reply.content).toMatch(/temporada (acabou|do|está encerrada)|Fim de temporada/i);
    expect(reply.content).toContain(String(over.season.points));
    expect(reply.actions).toContain('view_final_standings');
  });
});

describe('what the live model is told', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.OPENROUTER_API_KEY;
    vi.resetModules();
  });

  /** Calls the live path with a stubbed model, returning the prompt and reply. */
  async function askTheModel(state: GameState, answer: Record<string, unknown>) {
    process.env.OPENROUTER_API_KEY = 'sk-test';
    vi.resetModules();
    const { callAI } = await import('@/lib/ai-service');
    let systemPrompt = '';
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init: RequestInit) => {
        systemPrompt = JSON.parse(init.body as string).messages[0].content;
        return {
          ok: true,
          json: async () => ({
            choices: [{ message: { content: JSON.stringify(answer) } }],
            usage: { total_tokens: 100 },
          }),
        } as unknown as Response;
      })
    );
    const reply = await callAI('como terminou a temporada?', state, []);
    return { systemPrompt, reply };
  }

  it('describes a finished season as finished, with no fixture to talk up', async () => {
    const { systemPrompt } = await askTheModel(finishedSeason(), {
      message: 'Campanha encerrada!',
      actions: ['view_final_standings'],
      intent: 'season_over',
    });

    expect(systemPrompt).toContain('SEASON FINISHED');
    expect(systemPrompt).toContain('There is no next match');
    expect(systemPrompt).not.toContain('Temporada Completa');
    // The list it may choose from matches what the save can actually do.
    expect(systemPrompt).toContain('view_final_standings');
    expect(systemPrompt).not.toContain('play_match');
    expect(systemPrompt).not.toContain('new_season');
  });

  it('gives the model the fixture while the season is running', async () => {
    const state = midSeason();
    const { systemPrompt } = await askTheModel(state, { message: 'Bora!', actions: [], intent: 'play_match' });
    expect(systemPrompt).toContain(state.season.nextMatch.opponent);
    expect(systemPrompt).toContain('play_match');
    expect(systemPrompt).not.toContain('view_final_standings');
  });

  it('keeps only the suggestions the model was allowed to make', async () => {
    const { reply } = await askTheModel(finishedSeason(), {
      message: 'Campanha encerrada!',
      actions: ['new_season', 'play_match', 'view_final_standings'],
      intent: 'season_over',
    });
    expect(reply.actions).toEqual(['view_final_standings']);
    expect(reply.source).toBe('model');
  });
});
