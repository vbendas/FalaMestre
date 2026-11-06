'use client';

import { useEffect, useState } from 'react';

/**
 * Whether auth is enforced on this build, from `GET /api/auth/mode`.
 *
 * The client cannot work this out on its own: "no session" looks identical
 * whether auth is on and the player has not signed in, or auth is disabled in
 * dev and there will never be a session.
 *
 * `null` means the answer is not in yet. An unreadable answer resolves to
 * `false` (auth on), because the safe default is to ask the player to sign in
 * rather than start a save the server would refuse.
 *
 * @param enabled pass false to skip the request where the answer cannot matter
 *                — a signed-in player, for instance.
 */
export function useAuthMode(enabled = true): { authDisabled: boolean | null } {
  const [authDisabled, setAuthDisabled] = useState<boolean | null>(null);

  useEffect(() => {
    if (!enabled || authDisabled !== null) return;

    let cancelled = false;

    fetch('/api/auth/mode')
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (!cancelled) setAuthDisabled(data?.authDisabled === true);
      })
      .catch(() => {
        if (!cancelled) setAuthDisabled(false);
      });

    return () => {
      cancelled = true;
    };
  }, [enabled, authDisabled]);

  return { authDisabled };
}
