'use client';

import { formatMoney } from '@/lib/economy';
import type { TournamentTicket, SpecialTournament } from '@/lib/types';
import { SPECIAL_TOURNAMENTS } from '@/lib/constants';

interface TournamentTicketsModalProps {
  tickets: TournamentTicket[];
  onClose: () => void;
}

export function TournamentTicketsModal({ tickets, onClose }: TournamentTicketsModalProps) {
  const tournaments = Object.values(SPECIAL_TOURNAMENTS);
  
  const userTicketCount = tickets.filter(t => t.earned && !t.used).length;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 rounded-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="p-4 border-b border-white/10">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-white font-bold text-lg">🎫 Torneios Especiais</h2>
              <p className="text-white/60 text-sm">Seus tickets: {userTicketCount}</p>
            </div>
            <button onClick={onClose} className="text-white/40 hover:text-white">
              ✕
            </button>
          </div>
        </div>

        <div className="p-4 space-y-4">
          {tournaments.map(tournament => {
            const hasAccess = userTicketCount >= tournament.entryTicketCost;
            const participants = tournament.participants || 0;
            
            return (
              <div
                key={tournament.id}
                className="bg-white/5 rounded-lg p-4 border border-white/10"
              >
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <h3 className="text-white font-bold">{tournament.name}</h3>
                    <p className="text-white/60 text-sm">{tournament.description}</p>
                  </div>
                  <span className="text-yellow-400">🏆</span>
                </div>
                
                <div className="flex justify-between items-center mt-3">
                  <div>
                    <p className="text-white/50 text-xs">Prêmio</p>
                    <p className="text-green-400 font-bold">
                      {tournament.prizeType === 'jersey' 
                        ? 'Camiseta Exclusiva'
                        : tournament.prizeType === 'fan_tokens'
                          ? `${tournament.prizeValue} Socios Points`
                          : formatMoney(tournament.prizeValue)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-white/50 text-xs">Participantes</p>
                    <p className="text-white">{participants}/{tournament.maxParticipants}</p>
                  </div>
                </div>
                
                <div className="mt-3 pt-3 border-t border-white/10">
                  {hasAccess ? (
                    <button className="w-full bg-yellow-400 hover:bg-yellow-300 text-black py-2 rounded-lg font-bold">
                      Participar
                    </button>
                  ) : (
                    <div className="text-center">
                      <p className="text-white/60 text-sm mb-2">
                        Requer {tournament.entryTicketCost} ticket{tournament.entryTicketCost > 1 ? 's' : ''}
                      </p>
                      <p className="text-white/40 text-xs">
                        Ganhe tickets vencendo partidas ou indicando amigos!
                      </p>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div className="p-4 border-t border-white/10">
          <h3 className="text-white font-bold mb-3">Como Ganhar Tickets:</h3>
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-white/70 text-sm">
              <span className="text-green-400">✓</span>
              <span>Vença 5 partidas consecutivas</span>
            </div>
            <div className="flex items-center gap-2 text-white/70 text-sm">
              <span className="text-green-400">✓</span>
              <span>Termine entre os 4 primeiros do Campeonato</span>
            </div>
            <div className="flex items-center gap-2 text-white/70 text-sm">
              <span className="text-green-400">✓</span>
              <span>Complete uma temporada sem derrotas</span>
            </div>
            <div className="flex items-center gap-2 text-white/70 text-sm">
              <span className="text-green-400">✓</span>
              <span>Indique um amigo que jogue 5 partidas</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}