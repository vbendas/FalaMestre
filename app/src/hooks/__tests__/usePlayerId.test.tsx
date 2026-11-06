import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

// The hook's whole job is deciding which of three situations the player is in,
// so the session status and the auth mode are what these tests vary.
const session = vi.hoisted(() => ({
  data: null as { user: { id: string } } | null,
  status: 'loading' as 'loading' | 'authenticated' | 'unauthenticated',
}));

vi.mock('next-auth/react', () => ({
  useSession: () => ({ data: session.data, status: session.status }),
}));

import { usePlayerId, LOCAL_USER_ID_KEY } from '../usePlayerId';

const GOOGLE_USER = '109427834512345678901';

/** Answers /api/auth/mode, or fails the request when `mode` is null. */
function mockAuthMode(mode: { authDisabled: boolean } | null) {
  return vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
    expect(String(input)).toContain('/api/auth/mode');
    if (!mode) throw new Error('network down');
    return new Response(JSON.stringify(mode), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  });
}

/**
 * A working localStorage. The `localStorage` this test environment exposes is
 * a bare object with no getItem/setItem, which is the same shape the hook's
 * try/catch exists for, so these tests install a real one and assert on it.
 */
function installLocalStorage(): Map<string, string> {
  const entries = new Map<string, string>();
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key: string) => entries.get(key) ?? null,
      setItem: (key: string, value: string) => void entries.set(key, value),
      removeItem: (key: string) => void entries.delete(key),
      clear: () => entries.clear(),
    },
  });
  return entries;
}

describe('usePlayerId', () => {
  let fetchSpy: ReturnType<typeof vi.spyOn> | undefined;
  let stored: Map<string, string>;

  beforeEach(() => {
    stored = installLocalStorage();
    session.data = null;
    session.status = 'loading';
  });

  afterEach(() => {
    fetchSpy?.mockRestore();
    fetchSpy = undefined;
  });

  it('reports nothing while the session is still loading', () => {
    session.status = 'loading';

    const { result } = renderHook(() => usePlayerId());

    expect(result.current.userId).toBeNull();
    expect(result.current.isResolved).toBe(false);
    expect(result.current.requiresSignIn).toBe(false);
  });

  it('uses the session user id for a signed-in player, ignoring localStorage', async () => {
    stored.set(LOCAL_USER_ID_KEY, 'user_abc123xyz');
    session.status = 'authenticated';
    session.data = { user: { id: GOOGLE_USER } };
    fetchSpy = mockAuthMode({ authDisabled: false });

    const { result } = renderHook(() => usePlayerId());

    await waitFor(() => expect(result.current.isResolved).toBe(true));
    expect(result.current.userId).toBe(GOOGLE_USER);
    expect(result.current.isSignedIn).toBe(true);
    expect(result.current.requiresSignIn).toBe(false);
    // A signed-in player needs no auth-mode lookup at all.
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('asks for sign-in when auth is on and nobody is signed in, without minting a local id', async () => {
    session.status = 'unauthenticated';
    fetchSpy = mockAuthMode({ authDisabled: false });

    const { result } = renderHook(() => usePlayerId());

    await waitFor(() => expect(result.current.isResolved).toBe(true));
    expect(result.current.requiresSignIn).toBe(true);
    expect(result.current.userId).toBeNull();
    expect(stored.get(LOCAL_USER_ID_KEY)).toBeUndefined();
  });

  it('falls back to the local id when auth is disabled, generating one on a first visit', async () => {
    session.status = 'unauthenticated';
    fetchSpy = mockAuthMode({ authDisabled: true });

    const { result } = renderHook(() => usePlayerId());

    await waitFor(() => expect(result.current.isResolved).toBe(true));
    expect(result.current.requiresSignIn).toBe(false);
    expect(result.current.userId).toMatch(/^user_[a-z0-9]{9}$/);
    expect(stored.get(LOCAL_USER_ID_KEY)).toBe(result.current.userId);
  });

  it('keeps the local id it already had when auth is disabled', async () => {
    stored.set(LOCAL_USER_ID_KEY, 'user_abc123xyz');
    session.status = 'unauthenticated';
    fetchSpy = mockAuthMode({ authDisabled: true });

    const { result } = renderHook(() => usePlayerId());

    await waitFor(() => expect(result.current.userId).toBe('user_abc123xyz'));
  });

  it('treats an unreadable auth mode as auth being on', async () => {
    session.status = 'unauthenticated';
    fetchSpy = mockAuthMode(null);

    const { result } = renderHook(() => usePlayerId());

    await waitFor(() => expect(result.current.isResolved).toBe(true));
    expect(result.current.requiresSignIn).toBe(true);
    expect(result.current.userId).toBeNull();
  });
});
