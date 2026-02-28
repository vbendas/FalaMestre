export interface Formation {
  id: string;
  name: string;
  shortName: string;
  defenders: number;
  midfielders: number;
  attackers: number;
  goalkeepers: number;
  balance: {
    attack: number;
    defense: number;
  };
  description: string;
  positions: Array<{ x: number; y: number; role: string }>;
}

export const FORMATIONS: Record<string, Formation> = {
  '4-3-3': {
    id: '4-3-3',
    name: '4-3-3 Clássico',
    shortName: '4-3-3',
    defenders: 4,
    midfielders: 3,
    attackers: 3,
    goalkeepers: 1,
    balance: { attack: 7, defense: 5 },
    description: 'Ofensivo e dominante. Ideal para times com atacantes velozes.',
    positions: [
      { x: 50, y: 90, role: 'GK' },
      { x: 15, y: 70, role: 'LB' }, { x: 38, y: 65, role: 'CB' }, { x: 62, y: 65, role: 'CB' }, { x: 85, y: 70, role: 'RB' },
      { x: 20, y: 45, role: 'CM' }, { x: 50, y: 40, role: 'CM' }, { x: 80, y: 45, role: 'CM' },
      { x: 15, y: 20, role: 'LW' }, { x: 50, y: 10, role: 'ST' }, { x: 85, y: 20, role: 'RW' },
    ],
  },
  '4-4-2': {
    id: '4-4-2',
    name: '4-4-2 Equilibrado',
    shortName: '4-4-2',
    defenders: 4,
    midfielders: 4,
    attackers: 2,
    goalkeepers: 1,
    balance: { attack: 5, defense: 7 },
    description: 'Sólido e competitivo. Bom contra-ataque.',
    positions: [
      { x: 50, y: 90, role: 'GK' },
      { x: 15, y: 70, role: 'LB' }, { x: 38, y: 65, role: 'CB' }, { x: 62, y: 65, role: 'CB' }, { x: 85, y: 70, role: 'RB' },
      { x: 15, y: 45, role: 'LM' }, { x: 38, y: 40, role: 'CM' }, { x: 62, y: 40, role: 'CM' }, { x: 85, y: 45, role: 'RM' },
      { x: 35, y: 15, role: 'ST' }, { x: 65, y: 15, role: 'ST' },
    ],
  },
  '4-5-1': {
    id: '4-5-1',
    name: '4-5-1 Defensivo',
    shortName: '4-5-1',
    defenders: 4,
    midfielders: 5,
    attackers: 1,
    goalkeepers: 1,
    balance: { attack: 4, defense: 8 },
    description: 'Cauteloso. Protege a defesa e explora contra-ataques.',
    positions: [
      { x: 50, y: 90, role: 'GK' },
      { x: 15, y: 70, role: 'LB' }, { x: 38, y: 65, role: 'CB' }, { x: 62, y: 65, role: 'CB' }, { x: 85, y: 70, role: 'RB' },
      { x: 15, y: 45, role: 'LM' }, { x: 35, y: 50, role: 'CDM' }, { x: 50, y: 40, role: 'CM' }, { x: 65, y: 50, role: 'CM' }, { x: 85, y: 45, role: 'RM' },
      { x: 50, y: 15, role: 'ST' },
    ],
  },
  '3-5-2': {
    id: '3-5-2',
    name: '3-5-2 Controle',
    shortName: '3-5-2',
    defenders: 3,
    midfielders: 5,
    attackers: 2,
    goalkeepers: 1,
    balance: { attack: 6, defense: 6 },
    description: 'Controle do meio-campo. Excelente para times técnicos.',
    positions: [
      { x: 50, y: 90, role: 'GK' },
      { x: 25, y: 70, role: 'CB' }, { x: 50, y: 65, role: 'CB' }, { x: 75, y: 70, role: 'CB' },
      { x: 10, y: 50, role: 'LWB' }, { x: 30, y: 45, role: 'CM' }, { x: 50, y: 35, role: 'CM' }, { x: 70, y: 45, role: 'CM' }, { x: 90, y: 50, role: 'RWB' },
      { x: 35, y: 15, role: 'ST' }, { x: 65, y: 15, role: 'ST' },
    ],
  },
  '3-4-3': {
    id: '3-4-3',
    name: '3-4-3 Ofensivo',
    shortName: '3-4-3',
    defenders: 3,
    midfielders: 4,
    attackers: 3,
    goalkeepers: 1,
    balance: { attack: 8, defense: 4 },
    description: 'MUITO OFENSIVO! Pressão alta e muitos ataques.',
    positions: [
      { x: 50, y: 90, role: 'GK' },
      { x: 25, y: 70, role: 'CB' }, { x: 50, y: 65, role: 'CB' }, { x: 75, y: 70, role: 'CB' },
      { x: 20, y: 50, role: 'CM' }, { x: 45, y: 45, role: 'CM' }, { x: 55, y: 45, role: 'CM' }, { x: 80, y: 50, role: 'CM' },
      { x: 15, y: 20, role: 'LW' }, { x: 50, y: 10, role: 'ST' }, { x: 85, y: 20, role: 'RW' },
    ],
  },
  '5-3-2': {
    id: '5-3-2',
    name: '5-3-2 Ultra-Defensivo',
    shortName: '5-3-2',
    defenders: 5,
    midfielders: 3,
    attackers: 2,
    goalkeepers: 1,
    balance: { attack: 3, defense: 9 },
    description: 'MUITO DEFENSIVO! Para jogos fora de casa contra favoritos.',
    positions: [
      { x: 50, y: 90, role: 'GK' },
      { x: 10, y: 70, role: 'LWB' }, { x: 30, y: 65, role: 'CB' }, { x: 50, y: 65, role: 'CB' }, { x: 70, y: 65, role: 'CB' }, { x: 90, y: 70, role: 'RWB' },
      { x: 25, y: 45, role: 'CM' }, { x: 50, y: 40, role: 'CM' }, { x: 75, y: 45, role: 'CM' },
      { x: 35, y: 15, role: 'ST' }, { x: 65, y: 15, role: 'ST' },
    ],
  },
};

export function getFormationOptions(): Formation[] {
  return Object.values(FORMATIONS);
}

export function getFormationById(id: string): Formation | undefined {
  return FORMATIONS[id];
}

export function calculateFormationFit(
  players: Array<{ position: string }>,
  formationId: string
): number {
  const formation = FORMATIONS[formationId];
  if (!formation) return 0;

  const positionCounts = players.reduce((acc, p) => {
    acc[p.position] = (acc[p.position] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  // Simple calculation based on position availability
  const defScore = Math.min((positionCounts['DEF'] || 0) / formation.defenders, 1);
  const midScore = Math.min((positionCounts['MID'] || 0) / formation.midfielders, 1);
  const fwdScore = Math.min((positionCounts['FWD'] || 0) / formation.attackers, 1);
  const gkScore = positionCounts['GK'] ? 1 : 0;

  return Math.round((defScore * 30 + midScore * 30 + fwdScore * 30 + gkScore * 10));
}

export function suggestBestFormation(
  players: Array<{ position: string }>
): string {
  const positionCounts = players.reduce((acc, p) => {
    acc[p.position] = (acc[p.position] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  // Rule-based suggestion
  if ((positionCounts['FWD'] || 0) >= 3 && (positionCounts['MID'] || 0) >= 4) {
    return '4-3-3';
  }
  if ((positionCounts['DEF'] || 0) >= 5) {
    return '3-5-2';
  }
  if ((positionCounts['MID'] || 0) >= 5) {
    return '4-5-1';
  }
  return '4-4-2';
}
