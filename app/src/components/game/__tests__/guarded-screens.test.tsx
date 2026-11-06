import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { withSeed } from '@/lib/rng';
import { createInitialGameState, BRAZILIAN_TEAMS } from '@/lib/game-engine';
import { SAVE_CONFLICT_ERROR, SAVE_CONFLICT_PLAYER_MESSAGE } from '@/lib/save-conflict';
import type { GameState } from '@/lib/types';
import { SquadView } from '../SquadView';
import { StaffView } from '../StaffView';
import { FacilitiesView } from '../FacilitiesView';
import { StadiumView } from '../StadiumView';
import { YouthAcademyView } from '../YouthAcademyView';
import { ApostasView } from '../ApostasView';
import { InvestirView } from '../InvestirView';

/**
 * What the player sees when a guarded route refuses a write.
 *
 * Every save-changing route can now answer 409 "Save conflict" when the save
 * changed between its read and its write. These screens were written before
 * that: training never looked at the reply, so a refused session looked like
 * it worked; staff, facilities and stadium reloaded the page on success and
 * did nothing on a refusal; youth and formation went quiet; bets announced
 * success whatever the route said. The contract now, for every one of them:
 * the refusal is shown with its reason, the save is reloaded so the screen
 * shows what is really stored, and the same action is one press away.
 */

const USER_ID = 'user_abc123def';

function gameState(change?: (state: GameState) => void): GameState {
  const state = withSeed('fixture', () => createInitialGameState(USER_ID, BRAZILIAN_TEAMS[0].name));
  change?.(state);
  return state;
}

function jsonResponse(body: unknown, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: async () => body } as Response;
}

const conflict = () =>
  jsonResponse({ error: SAVE_CONFLICT_ERROR, message: 'The saved game changed while this action was being processed. Reload and try again.' }, 409);

let fetchMock: ReturnType<typeof vi.fn>;
let refresh: ReturnType<typeof vi.fn<() => Promise<void>>>;

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
  refresh = vi.fn<() => Promise<void>>(async () => undefined);
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

/** The JSON body of the n-th request fetch saw. */
function sentBody(n = 0): Record<string, unknown> {
  const init = fetchMock.mock.calls[n][1] as RequestInit;
  return JSON.parse(String(init.body));
}

async function expectConflictShown() {
  const alert = await screen.findByRole('alert');
  expect(alert).toHaveAttribute('data-notice-kind', 'conflict');
  expect(alert).toHaveTextContent(SAVE_CONFLICT_PLAYER_MESSAGE);
  expect(within(alert).getByText('Tentar novamente')).toBeInTheDocument();
  return alert;
}

// ---------------------------------------------------------------------------

describe('SquadView: training', () => {
  const state = gameState();
  const trainee = state.squad.players[0];

  function renderSquad(onTrainPlayer: (id: string, focus: string) => Promise<Response>) {
    render(
      <SquadView
        gameState={state}
        onViewChange={vi.fn()}
        userId={USER_ID}
        onTrainPlayer={onTrainPlayer as never}
        onRefreshSave={refresh}
      />
    );
  }

  async function openTrainingTab() {
    fireEvent.doubleClick(screen.getAllByText(trainee.name)[0]);
    fireEvent.click(await screen.findByText('🏋️ Treinar'));
  }

  it('a refused session is shown in the modal, the save is reloaded, and it can be sent again', async () => {
    const send = vi.fn().mockResolvedValueOnce(conflict()).mockResolvedValueOnce(jsonResponse({ success: true, message: 'Treinou!' }));
    renderSquad(send);
    await openTrainingTab();

    fireEvent.click(screen.getByText('Descanso'));

    const alert = await expectConflictShown();
    expect(send).toHaveBeenCalledWith(trainee.id, 'rest');
    expect(refresh).toHaveBeenCalledTimes(1);

    fireEvent.click(within(alert).getByText('Tentar novamente'));
    await waitFor(() => expect(send).toHaveBeenCalledTimes(2));
    expect(send).toHaveBeenLastCalledWith(trainee.id, 'rest');
    await screen.findByText('Treinou!');
    expect(refresh).toHaveBeenCalledTimes(2);
  });

  it('a session the route turned away for its own reason is shown with that reason', async () => {
    const send = vi.fn().mockResolvedValueOnce(
      jsonResponse({ error: 'Jogador exausto!', details: 'Fulano está com apenas 10% de energia.', code: 'PLAYER_EXHAUSTED' }, 400)
    );
    renderSquad(send);
    await openTrainingTab();

    fireEvent.click(screen.getByText('Técnico'));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveAttribute('data-notice-kind', 'error');
    expect(alert).toHaveTextContent('Fulano está com apenas 10% de energia.');
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it('a session that went through reloads the save and reports what happened', async () => {
    const send = vi.fn().mockResolvedValueOnce(jsonResponse({ success: true, message: `${trainee.name} treinou! +2 DRI` }));
    renderSquad(send);
    await openTrainingTab();

    fireEvent.click(screen.getByText('Técnico'));

    const status = await screen.findByRole('status');
    expect(status).toHaveTextContent('+2 DRI');
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('a request that never reached the server is shown as such, with a retry', async () => {
    const send = vi.fn().mockRejectedValueOnce(new TypeError('Failed to fetch'));
    renderSquad(send);
    await openTrainingTab();

    fireEvent.click(screen.getByText('Físico'));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveAttribute('data-notice-kind', 'error');
    expect(alert).toHaveTextContent('Não foi possível falar com o servidor');
    expect(within(alert).getByText('Tentar novamente')).toBeInTheDocument();
    expect(refresh).not.toHaveBeenCalled();
  });
});

describe('SquadView: formation', () => {
  it('a refused change keeps the saved formation, says so, and reloads the save', async () => {
    const state = gameState();
    fetchMock.mockResolvedValueOnce(conflict());
    render(<SquadView gameState={state} onViewChange={vi.fn()} userId={USER_ID} onRefreshSave={refresh} />);

    fireEvent.click(screen.getByText('Mudar →'));
    // The selector opens on the current formation; step to the next one and confirm it.
    const panel = (await screen.findByText('Escolher Formação')).closest('.pointer-events-auto') as HTMLElement;
    const [, , next] = within(panel).getAllByRole('button');
    fireEvent.click(next);
    fireEvent.click(screen.getByText('Confirmar'));

    await expectConflictShown();
    expect(fetchMock).toHaveBeenCalledWith('/api/squad/formation', expect.anything());
    const sent = sentBody();
    expect(sent.userId).toBe(USER_ID);
    expect(sent.formation).not.toBe(state.squad.formation);
    expect(refresh).toHaveBeenCalledTimes(1);
    // The header still shows what the save has, not what was picked.
    expect(screen.getByText(state.squad.formation)).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------

describe('StaffView', () => {
  it('a refused hire is shown, the save is reloaded, the page is not, and the hire can be retried', async () => {
    const reload = vi.fn();
    vi.stubGlobal('location', { ...window.location, reload });
    fetchMock.mockResolvedValueOnce(conflict()).mockResolvedValueOnce(jsonResponse({ success: true, staff: { name: 'Scout Carlos' } }));
    render(<StaffView gameState={gameState()} userId={USER_ID} onViewChange={vi.fn()} onRefreshSave={refresh} />);

    fireEvent.click(screen.getAllByText('Iniciante')[1]);

    const alert = await expectConflictShown();
    expect(sentBody()).toMatchObject({ userId: USER_ID, action: 'hire', role: 'scout', tier: 'rookie' });
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(reload).not.toHaveBeenCalled();

    fireEvent.click(within(alert).getByText('Tentar novamente'));
    await screen.findByText(/Scout Carlos contratado/);
    expect(sentBody(1)).toMatchObject({ action: 'hire', role: 'scout', tier: 'rookie' });
    expect(refresh).toHaveBeenCalledTimes(2);
    expect(reload).not.toHaveBeenCalled();
  });

  it('a refused dismissal is shown and the coach stays on screen', async () => {
    fetchMock.mockResolvedValueOnce(conflict());
    const state = gameState((s) => {
      s.staff.headCoach = { name: 'Técnico Fixo', level: 5, role: 'headCoach', specialty: 'tactical', weeklyWage: 100, hiredAt: 1 };
    });
    render(<StaffView gameState={state} userId={USER_ID} onViewChange={vi.fn()} onRefreshSave={refresh} />);

    fireEvent.click(screen.getByText('DEMITIR'));

    await expectConflictShown();
    expect(sentBody()).toMatchObject({ action: 'fire', role: 'headCoach' });
    expect(screen.getByText('Técnico Fixo')).toBeInTheDocument();
    expect(refresh).toHaveBeenCalledTimes(1);
  });
});

describe('FacilitiesView', () => {
  it('a refused upgrade is shown, the save is reloaded, and the upgrade can be retried', async () => {
    const reload = vi.fn();
    vi.stubGlobal('location', { ...window.location, reload });
    fetchMock.mockResolvedValueOnce(conflict()).mockResolvedValueOnce(jsonResponse({ success: true, newFacilityLevel: 1 }));
    const state = gameState((s) => { s.user.money = 5_000_000; });
    render(<FacilitiesView gameState={state} onViewChange={vi.fn()} onRefreshSave={refresh} />);

    fireEvent.click(screen.getAllByText('UPGRADE')[0]);

    const alert = await expectConflictShown();
    expect(sentBody()).toMatchObject({ userId: USER_ID, facilityType: 'trainingCenter' });
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(reload).not.toHaveBeenCalled();

    fireEvent.click(within(alert).getByText('Tentar novamente'));
    await screen.findByText(/Centro de Treinamento agora no nível 1/);
    expect(refresh).toHaveBeenCalledTimes(2);
  });
});

describe('StadiumView', () => {
  it('a refused upgrade is shown, the save is reloaded, and the upgrade can be retried', async () => {
    const reload = vi.fn();
    vi.stubGlobal('location', { ...window.location, reload });
    fetchMock.mockResolvedValueOnce(conflict()).mockResolvedValueOnce(jsonResponse({ success: true, newStadiumLevel: 1 }));
    render(<StadiumView gameState={gameState()} onViewChange={vi.fn()} onRefreshSave={refresh} />);

    fireEvent.click(screen.getByText('UPGRADE →'));

    const alert = await expectConflictShown();
    expect(sentBody()).toMatchObject({ userId: USER_ID });
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(reload).not.toHaveBeenCalled();

    fireEvent.click(within(alert).getByText('Tentar novamente'));
    await screen.findByText(/Estádio ampliado para o nível 1/);
    expect(refresh).toHaveBeenCalledTimes(2);
  });
});

// ---------------------------------------------------------------------------

describe('YouthAcademyView', () => {
  const prospect = {
    id: 'yp_1', name: 'Joãozinho', position: 'MID' as const, age: 16, potential: 80, currentAbility: 55,
    personalityTraits: ['Dedicado'], scoutAssessment: 4,
  };
  const withProspect = () => gameState((s) => {
    s.facilities.youthAcademy = 1;
    s.youthAcademy.playersAvailable = [prospect];
  });

  function prospectButtons() {
    const card = screen.getByText('Joãozinho').closest('.p-3') as HTMLElement;
    const buttons = within(card).getAllByRole('button');
    return { reject: buttons[0], sign: buttons[1] };
  }

  it('a refused signing keeps the prospect on screen, says so, and reloads the save', async () => {
    fetchMock.mockResolvedValueOnce(conflict());
    render(<YouthAcademyView gameState={withProspect()} userId={USER_ID} onViewChange={vi.fn()} onRefreshSave={refresh} />);

    fireEvent.click(prospectButtons().sign);

    await expectConflictShown();
    expect(fetchMock.mock.calls[0][0]).toBe(`/api/youth?userId=${USER_ID}`);
    expect(sentBody()).toMatchObject({ action: 'sign', playerId: 'yp_1' });
    expect(screen.getByText('Joãozinho')).toBeInTheDocument();
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it('a refused rejection keeps the prospect too', async () => {
    fetchMock.mockResolvedValueOnce(conflict());
    render(<YouthAcademyView gameState={withProspect()} userId={USER_ID} onViewChange={vi.fn()} onRefreshSave={refresh} />);

    fireEvent.click(prospectButtons().reject);

    await expectConflictShown();
    expect(sentBody()).toMatchObject({ action: 'reject', playerId: 'yp_1' });
    expect(screen.getByText('Joãozinho')).toBeInTheDocument();
  });

  it('a refused focus change leaves the focus as saved and says so', async () => {
    fetchMock.mockResolvedValueOnce(conflict());
    render(<YouthAcademyView gameState={withProspect()} userId={USER_ID} onViewChange={vi.fn()} onRefreshSave={refresh} />);

    fireEvent.click(screen.getByText('FÍSICO'));

    await expectConflictShown();
    expect(sentBody()).toMatchObject({ action: 'set-focus', focus: 'physical' });
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it('a signing that went through removes the prospect, reloads the save, and does not reload the page', async () => {
    const reload = vi.fn();
    vi.stubGlobal('location', { ...window.location, reload });
    fetchMock.mockResolvedValueOnce(jsonResponse({ success: true, action: 'signed' }));
    render(<YouthAcademyView gameState={withProspect()} userId={USER_ID} onViewChange={vi.fn()} onRefreshSave={refresh} />);

    fireEvent.click(prospectButtons().sign);

    await screen.findByText(/Joãozinho promovido/);
    expect(screen.queryByText('Joãozinho', { selector: 'span' })).toBeNull();
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(reload).not.toHaveBeenCalled();
  });

  it('a refused intake is shown and the page is not reloaded', async () => {
    const reload = vi.fn();
    vi.stubGlobal('location', { ...window.location, reload });
    fetchMock.mockResolvedValueOnce(conflict());
    render(<YouthAcademyView gameState={gameState((s) => { s.facilities.youthAcademy = 1; })} userId={USER_ID} onViewChange={vi.fn()} onRefreshSave={refresh} />);

    fireEvent.click(screen.getByText('GERAR NOVA TURMA'));

    await expectConflictShown();
    expect(sentBody()).toMatchObject({ action: 'generate' });
    expect(reload).not.toHaveBeenCalled();
    expect(refresh).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------

describe('InvestirView', () => {
  /**
   * The screen asks the server what the player owns as soon as it renders, so
   * every test here answers that GET first and queues the POST replies behind
   * it. It used to hold a hard-coded empty array instead, and reported no
   * active investments however many had been bought.
   */
  const EMPTY_PORTFOLIO = { investments: [], pendingYields: [], pendingYieldTotal: 0, activeCount: 0 };

  function owned(portfolio: Record<string, unknown> = EMPTY_PORTFOLIO, ...posts: Response[]) {
    const queue = [...posts];
    fetchMock.mockImplementation((_url: string, init?: RequestInit) => {
      if (init?.method !== 'POST') return Promise.resolve(jsonResponse(portfolio));
      return Promise.resolve(queue.shift() ?? jsonResponse({ success: true }));
    });
  }

  /** The JSON body of the n-th POST fetch saw, GETs skipped. */
  function postBody(n = 0): Record<string, unknown> {
    const posts = fetchMock.mock.calls.filter(
      (call) => (call[1] as RequestInit | undefined)?.method === 'POST'
    );
    return JSON.parse(String((posts[n][1] as RequestInit).body));
  }

  /** Opens the cheapest card (Clube de Torcedores, 50k) and presses invest. */
  function invest() {
    fireEvent.click(screen.getByText('Clube de Torcedores'));
    fireEvent.click(screen.getByText(/^Investir /));
  }

  it('a refused investment is shown with the server message, not the bare label', async () => {
    const alertSpy = vi.fn();
    vi.stubGlobal('alert', alertSpy);
    // The refusal a schema sends: the label alone used to be alert()ed, so
    // the player saw 'Validation failed' and nothing about what failed.
    owned(EMPTY_PORTFOLIO, jsonResponse(
      { error: 'Validation failed', message: 'option must be one of the available investments: clube_torcedores', field: 'option' },
      400
    ));
    render(<InvestirView gameState={gameState()} userId={USER_ID} onViewChange={vi.fn()} onRefreshSave={refresh} />);

    invest();

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveAttribute('data-notice-kind', 'error');
    expect(alert).toHaveTextContent('option must be one of the available investments: clube_torcedores');
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(alertSpy).not.toHaveBeenCalled();
  });

  it('an accepted investment is announced and the save reloaded', async () => {
    owned(EMPTY_PORTFOLIO, jsonResponse({ success: true, newBalance: 50_000 }));
    render(<InvestirView gameState={gameState()} userId={USER_ID} onViewChange={vi.fn()} onRefreshSave={refresh} />);

    invest();

    const status = await screen.findByRole('status');
    expect(status).toHaveTextContent('Investimento "Clube de Torcedores" realizado!');
    // The card's own id, not a tier it was flattened onto: the screen used
    // to post 'A', 'B' or 'C' and five of its seven cards came out as 'C'.
    expect(postBody()).toMatchObject({ option: 'clube_torcedores', userId: USER_ID });
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it('lists what the player owns, including rows from the retired tiers', async () => {
    owned({
      investments: [
        {
          id: 'row-1',
          option: 'marketing_digital',
          name: 'Marketing Digital',
          icon: '📱',
          amount: 200_000,
          yieldPerDay: 0,
          unlockDate: '2026-01-10T00:00:00.000Z',
          strategicBonus: { type: 'ticket_sales', value: 15, label: 'Receita de bilheteria' },
        },
        {
          // A row from the retired 'A' tier: it has to read as something
          // other than the bare letter it is stored as.
          id: 'row-2',
          option: 'A',
          name: 'Clube de Torcedores',
          icon: '💰',
          amount: 50_000,
          yieldPerDay: 10_000,
          unlockDate: '2026-01-04T00:00:00.000Z',
          strategicBonus: null,
        },
      ],
      pendingYields: [],
      pendingYieldTotal: 0,
      activeCount: 2,
    });
    render(<InvestirView gameState={gameState()} userId={USER_ID} onViewChange={vi.fn()} onRefreshSave={refresh} />);

    await waitFor(() => {
      expect(screen.getByTestId('active-investment-count')).toHaveTextContent('2');
    });
    // The owned list, not the catalogue below it: both name the product.
    const ownedPanel = screen.getByText('Seus Investimentos Ativos').closest('div')!;
    expect(within(ownedPanel).getByText(/📱 Marketing Digital/)).toBeInTheDocument();
    expect(within(ownedPanel).getByText(/💰 Clube de Torcedores/)).toBeInTheDocument();
    expect(within(ownedPanel).queryByText('A')).toBeNull();
  });

  it('claims the pending yield from the investment screen and reloads both', async () => {
    // There was nowhere in the game to do this: the only card with a claim
    // button lives on the dashboard behind props nothing passes, so the
    // money the daily cron generated could not be collected at all.
    owned(
      { investments: [], pendingYields: [{ id: 'y1', amount: 10_000 }], pendingYieldTotal: 10_000, activeCount: 0 },
      jsonResponse({ success: true, claimed: 10_000, expired: 0 })
    );
    render(<InvestirView gameState={gameState()} userId={USER_ID} onViewChange={vi.fn()} onRefreshSave={refresh} />);

    fireEvent.click(await screen.findByText('Receber Tudo'));

    const status = await screen.findByRole('status');
    expect(status).toHaveTextContent('Rendimento recebido');
    expect(postBody()).toMatchObject({ claimAll: true });
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it('offers no bonus on the cards whose bonus the game cannot deliver', async () => {
    // 'viral_events' and 'player_discovery' had no mechanic behind them.
    owned();
    render(<InvestirView gameState={gameState()} userId={USER_ID} onViewChange={vi.fn()} onRefreshSave={refresh} />);

    fireEvent.click(screen.getByText('Rede de Scouts'));

    // Both panels on the open card read 'Nenhum': no yield, no bonus.
    expect(screen.getAllByText('Nenhum')).toHaveLength(2);
    expect(screen.queryByText(/descobertas de jogadores/)).toBeNull();
  });
});

describe('ApostasView', () => {
  /**
   * The markets the server has open. The screen used to carry its own
   * hardcoded list and identify the prediction as `match-${week}`; that is
   * not a uuid, which is what `predictions.id` is, so every bet it sent was
   * refused at the route before the market was even looked up. It reads the
   * board from the server now, so these tests serve one.
   */
  const MARKETS = [
    {
      id: '11111111-1111-4111-8111-111111111111',
      matchId: 'm1',
      homeTeam: 'Casa FC',
      awayTeam: 'Fora FC',
      type: 'win_draw_loss',
      options: [
        { id: 'home', label: 'Vitória', odds: 1.8, totalBets: 0 },
        { id: 'draw', label: 'Empate', odds: 3.2, totalBets: 0 },
        { id: 'away', label: 'Derrota', odds: 2.5, totalBets: 0 },
      ],
      entryCost: 0,
      deadline: new Date(Date.now() + 3_600_000).toISOString(),
      status: 'open',
      createdAt: new Date().toISOString(),
    },
    {
      id: '22222222-2222-4222-8222-222222222222',
      matchId: 'm1',
      homeTeam: 'Casa FC',
      awayTeam: 'Fora FC',
      type: 'clean_sheet',
      options: [
        { id: 'yes', label: 'Sim', odds: 1.6, totalBets: 0 },
        { id: 'no', label: 'Não', odds: 2.4, totalBets: 0 },
      ],
      entryCost: 0,
      deadline: new Date(Date.now() + 3_600_000).toISOString(),
      status: 'open',
      createdAt: new Date().toISOString(),
    },
  ];

  /** Answers the board request, then renders and waits for the markets. */
  async function renderWithMarkets() {
    fetchMock.mockResolvedValueOnce(jsonResponse({ predictions: MARKETS }));
    render(<ApostasView gameState={gameState()} userId={USER_ID} onViewChange={vi.fn()} onRefreshSave={refresh} />);
    await screen.findByText('Vitória');
  }

  it('asks the server for the open markets and bets on one it sent back', async () => {
    await renderWithMarkets();
    fetchMock.mockResolvedValue(jsonResponse({ success: true, newBalance: 50_000 }));

    expect(String(fetchMock.mock.calls[0][0])).toContain('/api/predictions?status=open');

    fireEvent.click(screen.getByText('Vitória'));
    fireEvent.click(screen.getByText('APOSTAR'));

    await screen.findByRole('status');
    // The id of a real market, not one assembled from the fixture week.
    expect(sentBody(1)).toMatchObject({
      predictionId: MARKETS[0].id,
      optionId: 'home',
      userId: USER_ID,
    });
  });

  it('says so when there is nothing open, rather than offering markets that do not exist', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ predictions: [] }));
    render(<ApostasView gameState={gameState()} userId={USER_ID} onViewChange={vi.fn()} onRefreshSave={refresh} />);

    expect(await screen.findByText('Nenhum mercado aberto no momento.')).toBeInTheDocument();
    expect(screen.queryByText('APOSTAR')).toBeNull();
  });

  it('a refused bet is shown with the server reason, the balance is reloaded, and no success is claimed', async () => {
    const alertSpy = vi.fn();
    vi.stubGlobal('alert', alertSpy);
    await renderWithMarkets();
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ error: 'Insufficient funds. The balance changed while the bet was being placed.' }, 400)
    );

    fireEvent.click(screen.getByText('Vitória'));
    fireEvent.click(screen.getByText('APOSTAR'));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveAttribute('data-notice-kind', 'error');
    expect(alert).toHaveTextContent('The balance changed while the bet was being placed');
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(alertSpy).not.toHaveBeenCalled();
    expect(screen.queryByRole('status')).toBeNull();
    // The selection is kept, so the retry has something to send.
    expect(screen.getByText('1 aposta(s) selecionada(s)')).toBeInTheDocument();
  });

  it('bets that all went through are announced once, and the selection is cleared', async () => {
    await renderWithMarkets();
    fetchMock.mockResolvedValue(jsonResponse({ success: true, newBalance: 50_000 }));

    fireEvent.click(screen.getByText('Vitória'));
    fireEvent.click(screen.getByText('Sim'));
    fireEvent.click(screen.getByText('APOSTAR'));

    const status = await screen.findByRole('status');
    expect(status).toHaveTextContent('2 apostas realizadas.');
    await waitFor(() => expect(screen.queryByText(/aposta\(s\) selecionada/)).toBeNull());
    expect(refresh).toHaveBeenCalledTimes(2);
    // The board, the two bets, and the board again: the odds move with
    // every bet taken, so it is reread once they are in.
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });
});
