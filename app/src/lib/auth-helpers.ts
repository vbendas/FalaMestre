import { getServerSession } from 'next-auth';
import { authOptions } from './auth';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { recordRefusal, REFUSAL_REASONS } from './request-context';

export async function getAuthenticatedUser() {
  const session = await getServerSession(authOptions);
  
  if (!session?.user?.id) {
    return null;
  }
  
  return session.user.id;
}

/**
 * The signed-in user's id plus the profile fields onboarding needs to create
 * their account row. Null when nobody is signed in.
 */
export async function getAuthenticatedSessionUser(): Promise<
  { id: string; email: string | null; name: string | null } | null
> {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return null;
  }

  return {
    id: session.user.id,
    email: session.user.email ?? null,
    name: session.user.name ?? null,
  };
}

/**
 * The signed-in-user gate. Returns a 401 to hand straight back, or null to
 * carry on. A refusal records itself as the request's refusal reason, so the
 * summary line says the request was turned away for auth without the route
 * having to log it.
 */
export async function requireAuth() {
  // Auth is on by default. Set AUTH_DISABLED=true only in dev.
  if (process.env.AUTH_DISABLED === 'true') {
    return null;
  }
  
  const userId = await getAuthenticatedUser();
  
  if (!userId) {
    recordRefusal(REFUSAL_REASONS.unauthorized);
    return NextResponse.json(
      { error: 'Unauthorized. Please sign in to continue.' },
      { status: 401 }
    );
  }
  
  return null;
}

export async function getRequestUserId(request: NextRequest): Promise<string | null> {
  const sessionUserId = await getAuthenticatedUser();
  if (sessionUserId) {
    return sessionUserId;
  }
  
  // If auth is disabled (dev only), return null for localStorage fallback
  if (process.env.AUTH_DISABLED === 'true') {
    return null;
  }
  
  return null;
}
