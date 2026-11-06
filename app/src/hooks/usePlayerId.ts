'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { generateUserId } from '@/lib/utils';
import { useAuthMode } from './useAuthMode';

/** localStorage key holding the id of an anonymous player's save. */
export const LOCAL_USER_ID_KEY = 'falaMestreUserId';

export interface PlayerIdentity {
  /** The id every save is keyed on, or null while it is still being resolved. */
  userId: string | null;
  /** False until the session has settled; no request should go out before then. */
  isResolved: boolean;
  isSignedIn: boolean;
  /**
   * True once we know auth is enforced and nobody is signed in. The caller
   * should send the player to /login rather than let them start playing: every
   * game route would refuse them.
   */
  requiresSignIn: boolean;
}

/**
 * Resolves which user id this browser's saves belong to.
 *
 * A signed-in player's save belongs to their account, so their id is the
 * session's user id — not whatever is sitting in localStorage, which is a
 * different id the server's ownership checks would refuse. Only a player on a
 * build with auth disabled falls back to the local id, generating one on first
 * visit as before.
 *
 * Nothing is reported until both the session and the auth mode have settled,
 * so the first load cannot go out under the local id and then be refused.
 */
export function usePlayerId(): PlayerIdentity {
  const { data: session, status } = useSession();
  const [userId, setUserId] = useState<string | null>(null);
  const [isResolved, setIsResolved] = useState(false);
  const [requiresSignIn, setRequiresSignIn] = useState(false);

  const sessionUserId = session?.user?.id ?? null;
  // Only a signed-out player needs the auth mode; for a signed-in one the
  // answer cannot change anything, so the request is skipped.
  const { authDisabled } = useAuthMode(status === 'unauthenticated');

  useEffect(() => {
    if (status === 'loading') return;

    if (status === 'authenticated' && sessionUserId) {
      setUserId(sessionUserId);
      setRequiresSignIn(false);
      setIsResolved(true);
      return;
    }

    // Nobody is signed in. Which way that falls depends on the auth mode.
    if (authDisabled === null) return;

    if (!authDisabled) {
      setUserId(null);
      setRequiresSignIn(true);
      setIsResolved(true);
      return;
    }

    let id: string | null = null;
    try {
      id = localStorage.getItem(LOCAL_USER_ID_KEY);
      if (!id) {
        id = generateUserId();
        localStorage.setItem(LOCAL_USER_ID_KEY, id);
      }
    } catch {
      // Storage can be unavailable (private mode); play on with a fresh id.
      id = id ?? generateUserId();
    }

    setUserId(id);
    setRequiresSignIn(false);
    setIsResolved(true);
  }, [status, sessionUserId, authDisabled]);

  return { userId, isResolved, isSignedIn: status === 'authenticated', requiresSignIn };
}
