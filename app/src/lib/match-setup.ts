/**
 * The random choices the match API routes make around a simulation: which
 * opponent comes next, how motivated that opponent is, and the filler league
 * table shown beside the user's own results.
 *
 * These live here, as small *synchronous* functions drawing from `random()`,
 * because of the constraint documented in rng.ts: `withSeed` restores the
 * previous source the moment its callback returns, so it cannot wrap an async
 * request handler — a seeded scope opened before an `await` is already gone by
 * the time the handler resumes, and concurrent requests would trample each
 * other's seed. Keeping each decision in a sync function lets a route call it
 * plainly (unseeded, exactly as before) while a test reproduces the same
 * choices with `withSeed('seed', () => rollOpponentMorale())`.
 */

import { random } from '@/lib/rng';

/** A league team, narrowed to what these helpers need. */
export interface NamedTeam {
  name: string;
}

/** Opponent motivation for a one-off simulated side: 55–84. */
export function rollOpponentMorale(): number {
  return 55 + Math.floor(random() * 30);
}

/** Picks a team uniformly at random. Throws on an empty list. */
export function pickTeam(teams: readonly NamedTeam[]): NamedTeam {
  if (teams.length === 0) {
    throw new Error('pickTeam() needs at least one team to choose from');
  }
  return teams[Math.floor(random() * teams.length)];
}

export interface NextFixture {
  opponent: string;
  isHome: boolean;
}

/**
 * Draws the next fixture: an opponent that is neither the user's own team nor
 * the side they just played, and a coin flip for home advantage.
 */
export function pickNextFixture(
  teams: readonly NamedTeam[],
  userTeam: string,
  previousOpponent: string
): NextFixture {
  const available = teams.filter((t) => t.name !== userTeam && t.name !== previousOpponent);
  // Fall back to anyone but the user if the exclusions emptied the list.
  const pool = available.length > 0 ? available : teams.filter((t) => t.name !== userTeam);
  return {
    opponent: pickTeam(pool).name,
    isHome: random() > 0.5,
  };
}

export interface SimulatedStanding {
  name: string;
  points: number;
}

/**
 * Invents a plausible points tally for every rival, used to place the user in
 * the table. Teams earlier in the list are treated as stronger.
 */
export function simulateRivalStandings(
  otherTeams: readonly NamedTeam[],
  week: number
): SimulatedStanding[] {
  return otherTeams.map((team, idx) => {
    // Teams have played a similar number of matches, with some variance.
    const matchesPlayed = Math.max(1, week - 1 + Math.floor(random() * 3) - 1);
    const teamStrength = 1 - idx / otherTeams.length; // 1.0 to 0.0
    const expectedPointsPerMatch = 1.2 + teamStrength * 0.8; // 1.2 to 2.0
    const randomFactor = 0.8 + random() * 0.4;
    return {
      name: team.name,
      points: Math.floor(matchesPlayed * expectedPointsPerMatch * randomFactor),
    };
  });
}
