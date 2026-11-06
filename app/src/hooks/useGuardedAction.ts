'use client';

import { useCallback, useRef, useState } from 'react';
import {
  readActionReply,
  NETWORK_FAILURE_PLAYER_MESSAGE,
  type ActionReply,
} from '@/lib/save-conflict';

/**
 * Runs an action against a guarded route and owns what the player sees of
 * the outcome.
 *
 * Every save-changing route can now refuse a write because the save changed
 * underneath it (409, see src/lib/save-conflict.ts). The screens were written
 * before that existed: some never looked at the reply, so a refused action
 * looked like it worked; others reacted only to success, so a refusal did
 * nothing and left the screen showing money or a squad the save no longer
 * had. This hook gives every screen the same behaviour instead:
 *
 *  - the save is reloaded after every reply, success or not, so the screen
 *    shows what is really saved;
 *  - a refusal is put in front of the player, with the reason, and the same
 *    action can be sent again against the fresh save with one press;
 *  - a success can carry a message of its own.
 *
 * The match screen does not use this: a finalize that loses has its own
 * handling (the fixture may have moved on) and keeps it.
 */

export type ActionNotice = {
  kind: 'conflict' | 'error' | 'success';
  message: string;
  /** Sends the same action again. Only on a refusal or a network failure. */
  retry?: () => Promise<boolean>;
};

export type RunOptions<T> = {
  /** Shown on success. Omit for a quiet success. */
  successMessage?: (body: T) => string | null;
  /** Runs on success, before the save is reloaded. */
  onSuccess?: (body: T) => void | Promise<void>;
};

export type UseGuardedActionReturn = {
  /** True while a run is in flight. */
  pending: boolean;
  notice: ActionNotice | null;
  dismiss: () => void;
  /**
   * Sends `send` and reports the outcome. Resolves true if the route accepted
   * the action. Rejections are reported on screen, never thrown.
   */
  run<T = Record<string, unknown>>(send: () => Promise<Response>, options?: RunOptions<T>): Promise<boolean>;
};

export function useGuardedAction(onRefreshSave?: () => void | Promise<void>): UseGuardedActionReturn {
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState<ActionNotice | null>(null);
  // The latest refresher, so a `run` captured by a retry button does not hold
  // a stale one after a re-render.
  const refreshRef = useRef(onRefreshSave);
  refreshRef.current = onRefreshSave;

  const dismiss = useCallback(() => setNotice(null), []);

  const run = useCallback(async function run<T = Record<string, unknown>>(
    send: () => Promise<Response>,
    options: RunOptions<T> = {}
  ): Promise<boolean> {
    setPending(true);
    setNotice(null);
    let reply: ActionReply<T> | null = null;
    try {
      reply = await readActionReply<T>(await send());
    } catch {
      reply = null;
    }

    const retry = () => run(send, options);

    if (!reply) {
      setPending(false);
      setNotice({ kind: 'error', message: NETWORK_FAILURE_PLAYER_MESSAGE, retry });
      return false;
    }

    if (reply.ok) {
      await options.onSuccess?.(reply.body);
    }
    // Reloaded on every reply. After a success the screen shows what the
    // server actually stored; after a refusal it shows the save that beat
    // this action, which is what the player needs to decide what to do next.
    try {
      await refreshRef.current?.();
    } catch {
      // The reply is still reported; the player can reload by hand.
    }
    setPending(false);

    if (reply.ok) {
      const message = options.successMessage?.(reply.body) ?? null;
      setNotice(message ? { kind: 'success', message } : null);
      return true;
    }

    setNotice({ kind: reply.conflict ? 'conflict' : 'error', message: reply.message, retry });
    return false;
  }, []);

  return { pending, notice, dismiss, run };
}
