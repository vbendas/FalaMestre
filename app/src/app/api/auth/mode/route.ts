import { NextResponse } from 'next/server';
import { withApiRoute } from '@/lib/api-route';

/**
 * Tells the client whether auth is enforced.
 *
 * The client cannot work this out on its own: "no session" looks identical
 * whether auth is on and the player has not signed in, or auth is disabled in
 * dev and there will never be a session. Without this it sent a signed-out
 * player through onboarding to design a team the server then refused.
 *
 * It reads the same `AUTH_DISABLED` the server gates on, per request, so there
 * is one source of truth and no build-time copy to drift from it. The answer
 * carries no secret: whether the dev switch is on is already observable from
 * whether the game's routes answer 401.
 */
export const GET = withApiRoute('auth-mode', async () => {
  return NextResponse.json(
    { authDisabled: process.env.AUTH_DISABLED === 'true' },
    { headers: { 'Cache-Control': 'no-store' } }
  );
});
