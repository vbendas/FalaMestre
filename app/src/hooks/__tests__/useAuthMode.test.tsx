import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useAuthMode } from '../useAuthMode';

describe('useAuthMode', () => {
  let fetchSpy: ReturnType<typeof vi.spyOn> | undefined;

  afterEach(() => {
    fetchSpy?.mockRestore();
    fetchSpy = undefined;
  });

  function answer(body: unknown) {
    return vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(
        new Response(JSON.stringify(body), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        })
      );
  }

  it('reports auth disabled when the server says so', async () => {
    fetchSpy = answer({ authDisabled: true });

    const { result } = renderHook(() => useAuthMode());

    await waitFor(() => expect(result.current.authDisabled).toBe(true));
    expect(fetchSpy).toHaveBeenCalledWith('/api/auth/mode');
  });

  it('reports auth enforced when the server says so', async () => {
    fetchSpy = answer({ authDisabled: false });

    const { result } = renderHook(() => useAuthMode());

    await waitFor(() => expect(result.current.authDisabled).toBe(false));
  });

  it('resolves to auth enforced when the request fails', async () => {
    fetchSpy = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('offline'));

    const { result } = renderHook(() => useAuthMode());

    await waitFor(() => expect(result.current.authDisabled).toBe(false));
  });

  it('asks nothing when disabled, and stays unknown', async () => {
    fetchSpy = answer({ authDisabled: true });

    const { result } = renderHook(() => useAuthMode(false));

    await Promise.resolve();
    expect(result.current.authDisabled).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
