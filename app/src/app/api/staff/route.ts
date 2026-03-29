import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { gameStates } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { GameState, StaffMember, StaffRole, StaffSpecialty } from '@/lib/types';
import { STAFF_WAGES } from '@/lib/constants';

type GameStateRecordShape = {
  currentState: GameState;
};

const STAFF_NAMES = {
  headCoach: [
    'Técnico Silva', 'Técnico Santos', 'Técnico Oliveira', 'Técnico Souza',
    'Técnico Ferreira', 'Técnico Alves', 'Técnico Pereira', 'Técnico Lima',
  ],
  scout: [
    'Scout Carlos', 'Scout Roberto', 'Scout Mário', 'Scout Jorge',
    'Scout Paulo', 'Scout André', 'Scout Felipe', 'Scout Lucas',
  ],
  medicalStaff: [
    'Dr. Ricardo', 'Dr. Marcelo', 'Dr. Bruno', 'Dr. Gabriel',
    'Dr. Pedro', 'Dr. Rodrigo', 'Dr. Luiz', 'Dr. Rafael',
  ],
};

function randomElement<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function generateStaffMember(role: StaffRole, tier: 'rookie' | 'professional' | 'elite'): StaffMember {
  const levelRange = tier === 'rookie' ? [1, 10] : tier === 'professional' ? [11, 30] : [31, 50];
  const level = Math.floor(Math.random() * (levelRange[1] - levelRange[0] + 1)) + levelRange[0];
  
  const specialty: StaffSpecialty[] = 
    role === 'headCoach' ? ['development', 'technical', 'physical', 'tactical'] :
    role === 'scout' ? ['scouting', 'technical', 'tactical'] :
    ['injuryPrevention', 'medical', 'development'];
  
  const nameKey = role as keyof typeof STAFF_NAMES;
  const name = randomElement(STAFF_NAMES[nameKey]);
  
  const wageBase = STAFF_WAGES[role as keyof typeof STAFF_WAGES].base;
  const wagePerLevel = STAFF_WAGES[role as keyof typeof STAFF_WAGES].perLevel;
  const weeklyWage = Math.floor(wageBase + (level * wagePerLevel / 12));
  
  return {
    name,
    level,
    role,
    specialty: randomElement(specialty),
    weeklyWage,
    hiredAt: Date.now(),
  };
}

export async function POST(request: NextRequest) {
  try {
    let requestBody;
    try {
      requestBody = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const { userId, action, role, tier } = requestBody;

    if (!userId) {
      return NextResponse.json({ error: 'userId required' }, { status: 400 });
    }

    const gameStateRecord = await db.query.gameStates.findFirst({
      where: eq(gameStates.userId, userId),
    });

    if (!gameStateRecord) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const gameState = (gameStateRecord as GameStateRecordShape).currentState;
    
    const hireCost = tier === 'rookie' ? 50000 : tier === 'professional' ? 200000 : 1000000;
    const wageMultiplier = tier === 'rookie' ? 1 : tier === 'professional' ? 3 : 8;

    if (action === 'hire') {
      if (gameState.user.money < hireCost) {
        return NextResponse.json({ error: 'Insufficient funds' }, { status: 400 });
      }

      const validRoles: StaffRole[] = ['headCoach', 'scout', 'medicalStaff'];
      if (!validRoles.includes(role)) {
        return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
      }

      const staffMember = generateStaffMember(role, tier);
      
      gameState.user.money -= hireCost;
      gameState.teamStats.totalSpent += hireCost;
      (gameState.staff as any)[role] = staffMember;

      await db
        .update(gameStates)
        .set({ currentState: gameState, updatedAt: new Date() })
        .where(eq(gameStates.userId, userId));

      return NextResponse.json({
        success: true,
        action: 'hired',
        staff: staffMember,
        cost: hireCost,
        newBalance: gameState.user.money,
      });
    }

    if (action === 'fire') {
      const validRoles: StaffRole[] = ['headCoach', 'scout', 'medicalStaff'];
      if (!validRoles.includes(role)) {
        return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
      }

      const staffAny = gameState.staff as any;
      if (!staffAny[role]) {
        return NextResponse.json({ error: 'No staff in that role' }, { status: 400 });
      }

      staffAny[role] = null;

      await db
        .update(gameStates)
        .set({ currentState: gameState, updatedAt: new Date() })
        .where(eq(gameStates.userId, userId));

      return NextResponse.json({
        success: true,
        action: 'fired',
        role,
        newBalance: gameState.user.money,
      });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });

  } catch (error) {
    console.error('[Staff API] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}