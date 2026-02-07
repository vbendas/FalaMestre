export interface TeamData {
  name: string;
  city: string;
  stadium: string;
  logo: string; // path to SVG
  primaryColor: string; // hex color
  secondaryColor: string; // hex color
}

// Fictional PvE teams (IP-safe)
// Users create their own custom teams with custom names, colors, and badges
// These are the PvE opponents only
export const TEAMS: TeamData[] = [
  {
    name: 'Leões do Norte',
    city: 'Norte',
    stadium: 'Estádio do Norte',
    logo: '/teams/leoes.svg',
    primaryColor: '#FFD700', // Gold
    secondaryColor: '#008000' // Green
  },
  {
    name: 'Falcões de Aço',
    city: 'Aço',
    stadium: 'Arena de Aço',
    logo: '/teams/falcoes.svg',
    primaryColor: '#C0C0C0', // Silver
    secondaryColor: '#000000' // Black
  },
  {
    name: 'Trovão FC',
    city: 'Trovão',
    stadium: 'Estádio do Trovão',
    logo: '/teams/trovao.svg',
    primaryColor: '#800080', // Purple
    secondaryColor: '#FFFFFF' // White
  },
  {
    name: 'Maré Alta',
    city: 'Maré',
    stadium: 'Estádio da Maré',
    logo: '/teams/mare.svg',
    primaryColor: '#0000FF', // Blue
    secondaryColor: '#00FFFF' // Cyan
  },
  {
    name: 'Serra Brava',
    city: 'Serra',
    stadium: 'Estádio da Serra',
    logo: '/teams/serra.svg',
    primaryColor: '#FF0000', // Red
    secondaryColor: '#FFA500' // Orange
  },
  {
    name: 'Estrela do Sul',
    city: 'Sul',
    stadium: 'Estádio do Sul',
    logo: '/teams/estrela.svg',
    primaryColor: '#FFFFFF', // White
    secondaryColor: '#FFD700' // Gold
  }
];

// Backwards compatibility alias
export const BRAZILIAN_TEAMS = TEAMS;

export function getTeamData(teamName: string): TeamData | undefined {
  return TEAMS.find(t => t.name === teamName);
}

// Get a random team for matchmaking (excluding user's team)
export function getRandomOpponent(excludeTeamName?: string): TeamData {
  const availableTeams = excludeTeamName 
    ? TEAMS.filter(t => t.name !== excludeTeamName)
    : TEAMS;
  return availableTeams[Math.floor(Math.random() * availableTeams.length)];
}