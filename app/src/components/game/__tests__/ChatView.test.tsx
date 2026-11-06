import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { withSeed } from '@/lib/rng';
import { createInitialGameState, BRAZILIAN_TEAMS } from '@/lib/game-engine';
import { ChatView } from '../ChatView';
import type { GameState } from '@/lib/types';

const USER_ID = 'user_abc123def';

function gameState(): GameState {
  return withSeed('fixture', () => createInitialGameState(USER_ID, BRAZILIAN_TEAMS[0].name));
}

/**
 * The chat screen's contract with /api/conversation: the stored conversation
 * is what the player sees on open, a sent message reaches the route once and
 * the reply lands under it with its suggested actions, and a route that
 * cannot answer says so on screen instead of leaving the player waiting on a
 * reply that is never coming.
 */

const storedHistory = [
  { id: 'm1', role: 'user', content: 'Oi mestre', timestamp: '2026-10-29T12:00:00.000Z' },
  { id: 'm2', role: 'ai', content: 'Fala, treinador!', timestamp: '2026-10-29T12:00:01.000Z' },
];

function jsonResponse(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function renderChat(onViewChange = vi.fn()) {
  render(
    <ChatView gameState={gameState()} userId={USER_ID} onViewChange={onViewChange} />
  );
  return { onViewChange };
}

describe('ChatView', () => {
  it('shows the conversation the save already holds', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ exists: true, conversationHistory: storedHistory })
    );

    renderChat();

    expect(await screen.findByText('Oi mestre')).toBeInTheDocument();
    expect(screen.getByText('Fala, treinador!')).toBeInTheDocument();
    expect(fetchMock.mock.calls[0][0]).toBe(`/api/conversation?userId=${USER_ID}`);
  });

  it('sends a message and shows the reply with its suggested actions', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ exists: true, conversationHistory: [] }))
      .mockResolvedValueOnce(
        jsonResponse({
          response: 'O elenco está afiado.',
          actions: ['view_squad', 'play_match'],
          gameState: gameState(),
        })
      );

    renderChat();

    const box = await screen.findByLabelText('Mensagem para o mestre');
    fireEvent.change(box, { target: { value: 'Como está o time?' } });
    fireEvent.click(screen.getByRole('button', { name: /enviar/i }));

    expect(await screen.findByText('O elenco está afiado.')).toBeInTheDocument();
    expect(screen.getByText('Como está o time?')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ver elenco' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Jogar a partida' })).toBeInTheDocument();

    // One POST, with the typed message, and the box is empty again.
    const posts = fetchMock.mock.calls.filter((call) => call[1]?.method === 'POST');
    expect(posts).toHaveLength(1);
    expect(JSON.parse(posts[0][1].body)).toEqual({
      userId: USER_ID,
      message: 'Como está o time?',
    });
    expect((box as HTMLTextAreaElement).value).toBe('');
  });

  it('takes the player to the screen a suggested action names', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        exists: true,
        conversationHistory: [
          {
            id: 'm3',
            role: 'ai',
            content: 'Dá uma olhada no mercado.',
            timestamp: '2026-10-29T12:00:02.000Z',
            actions: ['transfer_market'],
          },
        ],
      })
    );

    const { onViewChange } = renderChat();

    fireEvent.click(await screen.findByRole('button', { name: 'Mercado' }));
    expect(onViewChange).toHaveBeenCalledWith('transfers');
  });

  it('drops a suggestion that goes nowhere instead of showing a raw key', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        exists: true,
        conversationHistory: [
          {
            id: 'm4',
            role: 'ai',
            content: 'Temporada encerrada.',
            timestamp: '2026-10-29T12:00:03.000Z',
            // What an old save, or a model that ignored the instruction,
            // can carry: a real key and one for a feature nobody built.
            actions: ['view_final_standings', 'new_season'],
          },
        ],
      })
    );

    renderChat();

    expect(await screen.findByRole('button', { name: 'Classificação final' })).toBeInTheDocument();
    expect(screen.queryByText('new_season')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /new_season/ })).not.toBeInTheDocument();
  });

  it('marks a reply the mock gave in a failed live model\'s place', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ exists: true, conversationHistory: [] }))
      .mockResolvedValueOnce(
        jsonResponse({ response: 'Resposta padrão.', actions: ['view_squad'], source: 'fallback' })
      );

    renderChat();

    fireEvent.change(await screen.findByLabelText('Mensagem para o mestre'), {
      target: { value: 'e aí?' },
    });
    fireEvent.click(screen.getByRole('button', { name: /enviar/i }));

    expect(await screen.findByText(/Resposta automática/)).toBeInTheDocument();
  });

  it('says nothing extra when the reply came from the model', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ exists: true, conversationHistory: [] }))
      .mockResolvedValueOnce(
        jsonResponse({ response: 'Tudo certo.', actions: ['view_squad'], source: 'model' })
      );

    renderChat();

    fireEvent.change(await screen.findByLabelText('Mensagem para o mestre'), {
      target: { value: 'e aí?' },
    });
    fireEvent.click(screen.getByRole('button', { name: /enviar/i }));

    await screen.findByText('Tudo certo.');
    expect(screen.queryByText(/Resposta automática/)).not.toBeInTheDocument();
  });

  it('warns that a reply the save could not keep will not survive a reload', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ exists: true, conversationHistory: [] }))
      .mockResolvedValueOnce(
        jsonResponse({ response: 'Tudo certo.', actions: ['view_squad'], persisted: false })
      );

    renderChat();

    fireEvent.change(await screen.findByLabelText('Mensagem para o mestre'), {
      target: { value: 'e aí?' },
    });
    fireEvent.click(screen.getByRole('button', { name: /enviar/i }));

    expect(await screen.findByText(/não foi possível salvar esta conversa/i)).toBeInTheDocument();
  });

  it('says nothing about saving when the exchange was saved', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ exists: true, conversationHistory: [] }))
      .mockResolvedValueOnce(
        jsonResponse({ response: 'Tudo certo.', actions: ['view_squad'], persisted: true })
      );

    renderChat();

    fireEvent.change(await screen.findByLabelText('Mensagem para o mestre'), {
      target: { value: 'e aí?' },
    });
    fireEvent.click(screen.getByRole('button', { name: /enviar/i }));

    await screen.findByText('Tudo certo.');
    expect(screen.queryByText(/não foi possível salvar/i)).not.toBeInTheDocument();
  });

  it('tells a player with no save to create their team', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ exists: false }))
      .mockResolvedValueOnce(
        jsonResponse({ error: 'No save for this user', code: 'no_save' }, 404)
      );

    renderChat();

    fireEvent.change(await screen.findByLabelText('Mensagem para o mestre'), {
      target: { value: 'oi' },
    });
    fireEvent.click(screen.getByRole('button', { name: /enviar/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/crie seu time/i);
  });

  it('says the assistant is unavailable and keeps the text when the send fails', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ exists: true, conversationHistory: [] }))
      .mockResolvedValueOnce(jsonResponse({ error: 'AI service unavailable' }, 503));

    renderChat();

    const box = await screen.findByLabelText('Mensagem para o mestre');
    fireEvent.change(box, { target: { value: 'E o próximo jogo?' } });
    fireEvent.click(screen.getByRole('button', { name: /enviar/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/indisponível/i);
    // The message is not left on screen as if it had been saved, and the
    // player still has what they typed.
    await waitFor(() =>
      expect((box as HTMLTextAreaElement).value).toBe('E o próximo jogo?')
    );
    expect(screen.queryByText('O mestre está pensando...')).not.toBeInTheDocument();
  });

  it('reports the rate limit the route enforces', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ exists: true, conversationHistory: [] }))
      .mockResolvedValueOnce(
        jsonResponse({ error: 'Too many requests', retryAfter: 30 }, 429)
      );

    renderChat();

    fireEvent.change(await screen.findByLabelText('Mensagem para o mestre'), {
      target: { value: 'oi' },
    });
    fireEvent.click(screen.getByRole('button', { name: /enviar/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent('30s');
  });

  it('refuses to send past the length the route accepts', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ exists: true, conversationHistory: [] }));

    renderChat();

    fireEvent.change(await screen.findByLabelText('Mensagem para o mestre'), {
      target: { value: 'a'.repeat(2001) },
    });

    expect(screen.getByText('2001/2000')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /enviar/i })).toBeDisabled();
    expect(fetchMock.mock.calls.filter((call) => call[1]?.method === 'POST')).toHaveLength(0);
  });
});
