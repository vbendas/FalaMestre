/**
 * The client's side of the versioned save (see src/lib/save-store.ts for the
 * server's). Kept free of server imports so the screens can use it.
 *
 * A guarded route answers 409 with `error: SAVE_CONFLICT_ERROR` when the save
 * changed between its read and its write. The screen's copy of the save is
 * then behind the real one, so the right response everywhere is the same:
 * tell the player, reload the save, and let them try again against it.
 */

/** The `error` string on a 409 from a guarded route. Mirrored by save-store. */
export const SAVE_CONFLICT_ERROR = 'Save conflict';

/** What the player is told when their action lost to another write. */
export const SAVE_CONFLICT_PLAYER_MESSAGE =
  'O jogo mudou enquanto você fazia isso: outra ação ou partida foi salva antes. Os dados foram atualizados, tente novamente.';

/** What the player is told when the request never reached the server. */
export const NETWORK_FAILURE_PLAYER_MESSAGE =
  'Não foi possível falar com o servidor. Nada foi alterado; verifique a conexão e tente novamente.';

export type ActionReply<T = Record<string, unknown>> =
  | { ok: true; status: number; body: T }
  | {
      ok: false;
      status: number;
      /** True for the 409 a guarded write answers when it lost its race. */
      conflict: boolean;
      /** What to show the player. */
      message: string;
      body: Record<string, unknown> | null;
    };

/**
 * Reads a route's reply into one of two shapes. A body that is not JSON is
 * treated as an empty one: a refusal is still a refusal.
 */
export async function readActionReply<T = Record<string, unknown>>(response: Response): Promise<ActionReply<T>> {
  let body: Record<string, unknown> | null = null;
  try {
    body = (await response.json()) as Record<string, unknown>;
  } catch {
    body = null;
  }
  if (response.ok) {
    return { ok: true, status: response.status, body: (body ?? {}) as T };
  }
  const conflict = response.status === 409 && body?.error === SAVE_CONFLICT_ERROR;
  const serverMessage =
    typeof body?.details === 'string'
      ? body.details
      : typeof body?.message === 'string'
        ? body.message
        : typeof body?.error === 'string'
          ? body.error
          : `O servidor recusou a ação (${response.status}).`;
  return {
    ok: false,
    status: response.status,
    conflict,
    message: conflict ? SAVE_CONFLICT_PLAYER_MESSAGE : serverMessage,
    body,
  };
}
