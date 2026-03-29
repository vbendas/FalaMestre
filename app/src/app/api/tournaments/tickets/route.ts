import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { tournamentTickets, gameStates } from '@/db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { getAuthenticatedUser, requireAuth } from '@/lib/auth-helpers';
import { SPECIAL_TOURNAMENTS, TICKET_EARNING_METHODS } from '@/lib/constants';

export async function GET(request: NextRequest) {
  try {
    const sessionUserId = await getAuthenticatedUser();
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    
    if (sessionUserId && userId && userId !== sessionUserId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    
    const targetUserId = userId || sessionUserId;
    
    if (!targetUserId) {
      return NextResponse.json({ error: 'User ID required' }, { status: 400 });
    }
    
    // Get user's tickets
    const tickets = await db.query.tournamentTickets.findMany({
      where: eq(tournamentTickets.userId, targetUserId),
    });
    
    // Get available tournaments
    const availableTournaments = Object.values(SPECIAL_TOURNAMENTS).map((t: { id: string }) => ({
      ...t,
      userTickets: tickets.filter((ticket: { tournamentId: string; earned: boolean; used: boolean }) => 
        ticket.tournamentId === t.id && ticket.earned && !ticket.used
      ).length
    }));

    return NextResponse.json({
      tickets: tickets.filter((t: { earned: boolean; used: boolean }) => t.earned && !t.used),
      tournaments: availableTournaments,
      ticketCount: tickets.filter((t: { earned: boolean; used: boolean }) => t.earned && !t.used).length
    });
    
  } catch (error) {
    console.error('Error fetching tickets:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Earn a ticket (triggered by certain achievements)
export async function POST(request: NextRequest) {
  try {
    const authError = await requireAuth();
    if (authError) {
      return authError;
    }
    
    const sessionUserId = await getAuthenticatedUser();
    if (!sessionUserId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    
    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }
    
    const { method } = body;
    
    if (!method || !TICKET_EARNING_METHODS[method as keyof typeof TICKET_EARNING_METHODS]) {
      return NextResponse.json({ error: 'Invalid method' }, { status: 400 });
    }
    
    const ticketConfig = TICKET_EARNING_METHODS[method as keyof typeof TICKET_EARNING_METHODS];
    
    // Insert ticket
    const ticket = await db.insert(tournamentTickets).values({
      userId: sessionUserId,
      tournamentId: 'pending', // Will be assigned when used
      earned: true,
      earnedAt: new Date().toISOString(),
      used: false,
    }).returning();
    
    return NextResponse.json({
      success: true,
      ticketsEarned: ticketConfig.tickets,
      message: ticketConfig.description,
      ticket: ticket[0]
    });
    
  } catch (error) {
    console.error('Error earning ticket:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}