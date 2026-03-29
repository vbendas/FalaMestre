'use client';

import dynamic from 'next/dynamic';
import { MatchEvent } from '@/lib/types';

const ThreeMatchView = dynamic(
  () => import('@/components/vr/ThreeMatchView').then(mod => ({ default: mod.default })),
  { ssr: false }
);

const mockHomeTeam = {
  name: 'Flamengo',
  color: '#DC2626',
  formation: '4-3-3' as const,
  players: [
    { id: '1', name: 'GOLEIRO', number: 1, position: 'GK' },
    { id: '2', name: 'Lateral Esquerdo', number: 2, position: 'DEF' },
    { id: '3', name: 'Zagueiro 1', number: 3, position: 'DEF' },
    { id: '4', name: 'Zagueiro 2', number: 4, position: 'DEF' },
    { id: '5', name: 'Lateral Direito', number: 5, position: 'DEF' },
    { id: '6', name: 'Volante', number: 6, position: 'MID' },
    { id: '7', name: 'Meia 1', number: 7, position: 'MID' },
    { id: '8', name: 'Meia 2', number: 8, position: 'MID' },
    { id: '9', name: 'Ponta Esquerda', number: 9, position: 'FWD' },
    { id: '10', name: 'Centroavante', number: 10, position: 'FWD' },
    { id: '11', name: 'Ponta Direita', number: 11, position: 'FWD' },
  ],
};

const mockAwayTeam = {
  name: 'Palmeiras',
  color: '#2563EB',
  formation: '4-4-2' as const,
  players: [
    { id: '12', name: 'GOLEIRO', number: 1, position: 'GK' },
    { id: '13', name: 'Lateral Esquerdo', number: 2, position: 'DEF' },
    { id: '14', name: 'Zagueiro 1', number: 3, position: 'DEF' },
    { id: '15', name: 'Zagueiro 2', number: 4, position: 'DEF' },
    { id: '16', name: 'Lateral Direito', number: 5, position: 'DEF' },
    { id: '17', name: 'Meia 1', number: 6, position: 'MID' },
    { id: '18', name: 'Meia 2', number: 7, position: 'MID' },
    { id: '19', name: 'Meia 3', number: 8, position: 'MID' },
    { id: '20', name: 'Meia 4', number: 9, position: 'MID' },
    { id: '21', name: 'Atacante 1', number: 10, position: 'FWD' },
    { id: '22', name: 'Atacante 2', number: 11, position: 'FWD' },
  ],
};

const mockEvents: MatchEvent[] = [
  {
    id: '1',
    minute: 1,
    type: 'buildup',
    team: 'home',
    description: 'Match starting',
    commentary: 'O jogo começou!',
    intensity: 'medium',
    highlight: false,
    momentum: 0,
  },
  {
    id: '2',
    minute: 5,
    type: 'pressure',
    team: 'home',
    description: 'Home team attacking',
    commentary: 'Bruno Santos domina a bola no meio-campo',
    intensity: 'high',
    highlight: false,
    momentum: 10,
  },
  {
    id: '3',
    minute: 10,
    type: 'goal',
    team: 'home',
    description: 'Goal',
    commentary: 'Goooooooool!',
    intensity: 'dramatic',
    highlight: true,
    momentum: 50,
  },
];

export default function TestVRPage() {
  return (
    <div className="w-screen h-screen">
      <ThreeMatchView
        homeTeam={mockHomeTeam}
        awayTeam={mockAwayTeam}
        currentMinute={15}
        homeScore={1}
        awayScore={0}
        events={mockEvents}
        currentEvent="Bruno Santos domina a bola no meio-campo e avanza pelas extremas"
        onExitVR={() => console.log('Exit VR')}
      />
    </div>
  );
}
