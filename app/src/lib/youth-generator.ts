import { YouthPlayer } from './types';
import { ECONOMY_CONSTANTS } from './constants';

const PERSONALITY_TRAITS = [
  'Profissionalismo',
  'Ambição',
  'Determinação',
  'Criatividade',
  'Liderança',
  ' Trabalho em Equipe',
  'Disciplina',
  'Mentalidade Vencedora',
  'Adaptabilidade',
  'Foco',
];

const FIRST_NAMES = [
  'Gabriel', 'Lucas', 'Matheus', 'Pedro', 'Bruno', 'Rafael', 'Diego', 'Carlos',
  'Gustavo', 'Fernando', 'João', 'Paulo', 'Rodrigo', 'Leonardo', 'André', 'Felipe',
  'Guilherme', 'Ricardo', 'Marcelo', 'Vinícius', 'Thiago', 'Daniel', 'Eduardo',
  'Caio', 'Samuel', 'Igor', 'Vitor', 'Bryan', 'Victor', 'Luan', 'Bryan', 'Yan',
  'Hugo', 'Breno', 'Kevin', 'Enzo', 'Luiz', 'Gustavo', 'Melquisedeque', 'José',
  'Raphael', 'Davi', 'Isaac', 'Nathan', 'Benjamin', 'Theo', 'Nicolas', 'Murilo',
];

const LAST_NAMES = [
  'Silva', 'Santos', 'Oliveira', 'Souza', 'Rodrigues', 'Ferreira', 'Alves', 'Pereira',
  'Lima', 'Gomes', 'Costa', 'Ribeiro', 'Martins', 'Carvalho', 'Luiz', 'Freitas',
  'Cardoso', 'Araujo', 'Melo', 'Barbosa', 'Lima', 'Correia', 'Monteiro', 'Nunes',
  'Cavalcanti', 'Dantas', 'Castro', 'Fernandes', 'Machado', 'Vieira', 'Almeida',
  'NASCIMENTO', 'Sampaio', 'Mendonça', 'Borges', 'Azevedo', 'Pinheiro', 'Rosa',
  'Correia', 'Carneiro', 'Farias', 'Marques', ' Pires ', 'Miranda', 'Teixeira',
];

const POSITIONS: Array<'GK' | 'DEF' | 'MID' | 'FWD'> = ['GK', 'DEF', 'MID', 'FWD'];

function randomBetween(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomElement<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function shuffleArray<T>(arr: T[]): T[] {
  const shuffled = [...arr];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

export function generateYouthPlayer(
  academyLevel: number,
  scoutLevel: number
): YouthPlayer {
  const position = randomElement(POSITIONS);
  
  const baseMinPotential = 75;
  const baseMaxPotential = 85;
  
  const academyBonus = Math.min(academyLevel, 50) * 0.3;
  const minPotential = Math.min(baseMinPotential + academyBonus, 90);
  const maxPotential = Math.min(baseMaxPotential + academyBonus, 95);
  
  const potential = randomBetween(
    Math.floor(minPotential),
    Math.floor(maxPotential)
  );
  
  const currentAbility = randomBetween(
    ECONOMY_CONSTANTS.YOUTH_MIN_CURRENT_ABILITY,
    ECONOMY_CONSTANTS.YOUTH_MAX_CURRENT_ABILITY
  );
  
  const personalityTraitCount = randomBetween(2, 4);
  const shuffledTraits = shuffleArray(PERSONALITY_TRAITS);
  const personalityTraits = shuffledTraits.slice(0, personalityTraitCount);
  
  let scoutStars = Math.round((potential / 20));
  const scoutAccuracyBonus = scoutLevel * 0.05;
  const starVariance = Math.floor(Math.random() * 2) - 1;
  scoutStars = Math.max(1, Math.min(5, scoutStars + starVariance + Math.floor(scoutAccuracyBonus)));
  
  const firstName = randomElement(FIRST_NAMES);
  const lastName = randomElement(LAST_NAMES);
  
  return {
    id: `youth_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    name: `${firstName} ${lastName}`,
    position,
    age: ECONOMY_CONSTANTS.YOUTH_INITIAL_AGE,
    potential,
    currentAbility,
    personalityTraits,
    scoutAssessment: scoutStars,
  };
}

export function generateYouthIntake(
  academyLevel: number,
  scoutLevel: number
): YouthPlayer[] {
  const basePlayerCount = 3;
  const academyBonus = Math.floor(academyLevel / 10);
  const playerCount = Math.min(basePlayerCount + academyBonus, 8);
  
  const players: YouthPlayer[] = [];
  for (let i = 0; i < playerCount; i++) {
    players.push(generateYouthPlayer(academyLevel, scoutLevel));
  }
  
  return players.sort((a, b) => b.potential - a.potential);
}

export function evaluateYouthPlayer(
  player: YouthPlayer,
  headOfYouthLevel: number = 0
): { stars: number; assessment: string } {
  let stars = Math.round(player.potential / 20);
  
  const hoydBonus = headOfYouthLevel * 0.02;
  stars = Math.max(1, Math.min(5, stars + Math.floor(hoydBonus)));
  
  let assessment = 'Decente';
  if (stars >= 4.5) assessment = 'Elite';
  else if (stars >= 3.5) assessment = 'Grande Promise';
  else if (stars >= 2.5) assessment = 'Bom';
  
  return { stars, assessment };
}

export function calculateYouthTrainingProgress(
  player: YouthPlayer,
  focus: 'technical' | 'physical' | 'tactical',
  facilitiesLevel: number
): number {
  const baseProgress = 1;
  const focusMultiplier = 1.2;
  
  const facilityBonus = facilitiesLevel * 0.01;
  
  let attributeBonus = 0;
  if (focus === 'technical') {
    attributeBonus = (player.position === 'FWD' || player.position === 'MID') ? 0.3 : 0.1;
  } else if (focus === 'physical') {
    attributeBonus = (player.position === 'DEF' || player.position === 'MID') ? 0.2 : 0.1;
  } else if (focus === 'tactical') {
    attributeBonus = player.position === 'MID' ? 0.3 : 0.1;
  }
  
  return baseProgress * focusMultiplier * (1 + facilityBonus + attributeBonus);
}