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
  // If REQUIRE_AUTH is not set to 'true', skip authentication
  if (process.env.REQUIRE_AUTH !== 'true') {
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
  // First, check for authenticated session
  const sessionUserId = await getAuthenticatedUser();
  if (sessionUserId) {
    return sessionUserId;
  }
  
  // If auth is not required, return null to indicate localStorage fallback should be used
  if (process.env.REQUIRE_AUTH !== 'true') {
    return null;
  }
  
  return null;
}
