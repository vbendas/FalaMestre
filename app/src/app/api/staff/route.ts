import { NextRequest, NextResponse } from 'next/server';
import { StaffMember, StaffRole, StaffSpecialty } from '@/lib/types';
import { STAFF_WAGES } from '@/lib/constants';
import { getAuthenticatedUser, requireAuth } from '@/lib/auth-helpers';
import { withApiRoute, ApiContext } from '@/lib/api-route';
import { staffRequestSchema } from '@/lib/validations';
import { loadSave, commitSave, saveConflictResponse } from '@/lib/save-store';

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

/** What hiring at each tier costs. Keyed by tier, so a tier cannot be missed. */
const HIRE_COST: Record<'rookie' | 'professional' | 'elite', number> = {
  rookie: 50_000,
  professional: 200_000,
  elite: 1_000_000,
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

export const POST = withApiRoute('staff', async (
  request: NextRequest,
  { log, readBody }: ApiContext
) => {
  try {
    // Check authentication
    const authError = await requireAuth();
    if (authError) {
      return authError;
    }

    const sessionUserId = await getAuthenticatedUser();

    const bodyResult = await readBody(staffRequestSchema);
    if (!bodyResult.ok) {
      return bodyResult.response;
    }

    // Kept whole as well as destructured: `tier` is only on a hire, and
    // narrowing on `body.action` is what tells TypeScript that.
    const body = bodyResult.body;
    const { userId, action, role } = body;

    if (sessionUserId && userId && userId !== sessionUserId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const targetUserId = sessionUserId || userId;

    if (!targetUserId) {
      return NextResponse.json({ error: 'userId required' }, { status: 400 });
    }

    const save = await loadSave(targetUserId);

    if (!save) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const gameState = save.state;

    if (body.action === 'hire') {
      const { tier } = body;
      const hireCost = HIRE_COST[tier];

      if (gameState.user.money < hireCost) {
        return NextResponse.json({ error: 'Insufficient funds' }, { status: 400 });
      }

      const staffMember = generateStaffMember(role, tier);

      gameState.user.money -= hireCost;
      gameState.teamStats.totalSpent += hireCost;
      (gameState.staff as any)[role] = staffMember;

      const committed = await commitSave(targetUserId, gameState, save.version);
      if (!committed.ok) {
        log.warn('Staff action rejected: the save moved on while it was being processed', { action, role });
        return saveConflictResponse();
      }

      return NextResponse.json({
        success: true,
        action: 'hired',
        staff: staffMember,
        cost: hireCost,
        newBalance: gameState.user.money,
      });
    }

    // Only 'fire' is left: the schema admits exactly these two actions, so
    // there is no third case to fall through to.
    {
      const staffAny = gameState.staff as any;
      if (!staffAny[role]) {
        return NextResponse.json({ error: 'No staff in that role' }, { status: 400 });
      }

      staffAny[role] = null;

      const committed = await commitSave(targetUserId, gameState, save.version);
      if (!committed.ok) {
        log.warn('Staff action rejected: the save moved on while it was being processed', { action, role });
        return saveConflictResponse();
      }

      return NextResponse.json({
        success: true,
        action: 'fired',
        role,
        newBalance: gameState.user.money,
      });
    }

  } catch (error) {
    log.error('Error', { error });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
});