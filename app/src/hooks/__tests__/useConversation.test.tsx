import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useConversation } from '../useConversation';

const USER_ID = 'user_abc123def';

/**
 * One message sent is one request. The guard that makes that true cannot be
 * the `isSending` state: a handler closes over the value from its render, so
 * two events delivered in the same task both read `false`. A browser does
 * deliver them that way — two Enter keydowns dispatched in one task produced
 * two POSTs and stored the message twice — which is what these cover.
 */

let fetchMock: ReturnType<typeof vi.fn>;
let releaseReply: (() => void) | null;

function jsonResponse(body: unknown, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: async () => body } as Response;
}

beforeEach(() => {
  releaseReply = null;
  fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
    if (init?.method !== 'POST') return jsonResponse({ exists: true, conversationHistory: [] });
    // Held open, so a second send happens while the first is in flight.
    return new Promise<Response>((resolve) => {
      releaseReply = () => resolve(jsonResponse({ response: 'ok', actions: [], persisted: true }));
    });
  });
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function posts() {
  return fetchMock.mock.calls.filter((call) => call[1]?.method === 'POST');
}

describe('useConversation', () => {
  it('sends once when the same message is sent twice in one task', async () => {
    const { result } = renderHook(() => useConversation(USER_ID));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    // Both calls happen before React can re-render, as two key events in one
    // task do.
    await act(async () => {
      void result.current.sendMessage('oi mestre');
      void result.current.sendMessage('oi mestre');
      await Promise.resolve();
    });

    expect(posts()).toHaveLength(1);
    expect(JSON.parse(posts()[0][1].body).message).toBe('oi mestre');
  });

  it('refuses a second message while a reply is still coming', async () => {
    const { result } = renderHook(() => useConversation(USER_ID));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      void result.current.sendMessage('primeira');
      await Promise.resolve();
    });
    await waitFor(() => expect(result.current.isSending).toBe(true));

    await act(async () => {
      const accepted = await result.current.sendMessage('segunda');
      expect(accepted).toBe(false);
    });
    expect(posts()).toHaveLength(1);

    // Once the reply lands, the next message goes through.
    await act(async () => {
      releaseReply?.();
      await Promise.resolve();
    });
    await waitFor(() => expect(result.current.isSending).toBe(false));
    await act(async () => {
      void result.current.sendMessage('segunda');
      await Promise.resolve();
    });
    expect(posts()).toHaveLength(2);
  });

  it('explains that there is no save yet instead of a generic failure', async () => {
    fetchMock.mockImplementation(async (_url: string, init?: RequestInit) =>
      init?.method === 'POST'
        ? jsonResponse({ error: 'No save for this user', code: 'no_save' }, 404)
        : jsonResponse({ exists: false })
    );

    const { result } = renderHook(() => useConversation(USER_ID));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    await act(async () => {
      await result.current.sendMessage('oi');
    });

    expect(result.current.error).toMatch(/ainda não tem um time/i);
    expect(result.current.messages).toHaveLength(0);
  });

  it('carries the unsaved flag through to the message', async () => {
    fetchMock.mockImplementation(async (_url: string, init?: RequestInit) =>
      init?.method === 'POST'
        ? jsonResponse({ response: 'resposta', actions: [], persisted: false })
        : jsonResponse({ exists: true, conversationHistory: [] })
    );

    const { result } = renderHook(() => useConversation(USER_ID));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    await act(async () => {
      await result.current.sendMessage('oi');
    });

    const reply = result.current.messages.at(-1);
    expect(reply?.role).toBe('ai');
    expect(reply?.persisted).toBe(false);
  });
});
