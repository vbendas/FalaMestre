import { getServerSession } from 'next-auth';
import { authOptions } from './auth';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function getAuthenticatedUser() {
  const session = await getServerSession(authOptions);
  
  if (!session?.user?.id) {
    return null;
  }
  
  return session.user.id;
}

export async function requireAuth() {
  // Auth is on by default. Set AUTH_DISABLED=true only in dev.
  if (process.env.AUTH_DISABLED === 'true') {
    return null;
  }
  
  const userId = await getAuthenticatedUser();
  
  if (!userId) {
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
