'use client';

import { useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { GameState } from '@/lib/types';
import { Share2, Download, Users, Trophy, TrendingUp } from 'lucide-react';
import html2canvas from 'html2canvas';

interface SquadShareCardProps {
  gameState: GameState;
  onClose?: () => void;
}

export function SquadShareCard({ gameState, onClose }: SquadShareCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const { user, squad } = gameState;

  // Calculate team stats
  const avgRating = squad.players.length > 0
    ? Math.round(squad.players.reduce((sum, p) => sum + (p.pac + p.sho + p.pas + p.dri + p.def + p.phy) / 6, 0) / squad.players.length)
    : 70;

  const topPlayers = [...squad.players]
    .sort((a, b) => {
      const ratingA = (a.pac + a.sho + a.pas + a.dri + a.def + a.phy) / 6;
      const ratingB = (b.pac + b.sho + b.pas + b.dri + b.def + b.phy) / 6;
      return ratingB - ratingA;
    })
    .slice(0, 5);

  const handleShare = useCallback(async () => {
    if (!cardRef.current) return;

    try {
      const canvas = await html2canvas(cardRef.current, {
        backgroundColor: '#012169',
        scale: 2,
      });

      // Convert to blob and share
      canvas.toBlob(async (blob) => {
        if (!blob) return;

        // For browsers that support sharing
        if (navigator.share && navigator.canShare) {
          const file = new File([blob], `squad_${user.team}.png`, { type: 'image/png' });
          
          if (navigator.canShare({ files: [file] })) {
            await navigator.share({
              title: `${user.team} - Elenco no Fala Mestre!`,
              text: `Confira o elenco do ${user.team}! Média: ${avgRating}/99`,
              files: [file],
            });
            return;
          }
        }

        // Fallback: download image
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `squad_${user.team.replace(/\s+/g, '_')}.png`;
        a.click();
        URL.revokeObjectURL(url);
      }, 'image/png');
    } catch (error) {
      console.error('[SquadShareCard] Share failed:', error);
    }
  }, [user.team, avgRating]);

  const handleDownload = useCallback(async () => {
    if (!cardRef.current) return;

    try {
      const canvas = await html2canvas(cardRef.current, {
        backgroundColor: '#012169',
        scale: 2,
      });

      const url = canvas.toDataURL('image/png');
      const a = document.createElement('a');
      a.href = url;
      a.download = `squad_${user.team.replace(/\s+/g, '_')}.png`;
      a.click();
    } catch (error) {
      console.error('[SquadShareCard] Download failed:', error);
    }
  }, [user.team]);

  return (
    <div className="space-y-4">
      {/* Preview Card */}
      <div 
        ref={cardRef}
        className="bg-gradient-to-br from-[#012169] to-[#001845] rounded-xl p-6 border-4 border-[#FEDD00]"
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-[#FEDD00] flex items-center justify-center">
              <span className="text-2xl font-black text-[#012169] pixel-text">
                {user.team.charAt(0)}
              </span>
            </div>
            <div>
              <h2 className="text-xl font-black text-white pixel-text">{user.team}</h2>
              <p className="text-white/60 text-xs">{squad.formation}</p>
            </div>
          </div>
          <div className="text-right">
            <div className="text-3xl font-black text-[#FEDD00] pixel-text">{avgRating}</div>
            <p className="text-white/60 text-xs">Média</p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="bg-white/10 rounded-lg p-2 text-center">
            <Users className="w-4 h-4 mx-auto text-white/60 mb-1" />
            <p className="text-white font-bold text-sm">{squad.players.length}</p>
            <p className="text-white/50 text-[10px]">Jogadores</p>
          </div>
          <div className="bg-white/10 rounded-lg p-2 text-center">
            <TrendingUp className="w-4 h-4 mx-auto text-white/60 mb-1" />
            <p className="text-white font-bold text-sm">{squad.morale}%</p>
            <p className="text-white/50 text-[10px]">Moral</p>
          </div>
          <div className="bg-white/10 rounded-lg p-2 text-center">
            <Trophy className="w-4 h-4 mx-auto text-white/60 mb-1" />
            <p className="text-white font-bold text-sm">{gameState.season.points}</p>
            <p className="text-white/50 text-[10px]">Pontos</p>
          </div>
        </div>

        {/* Top Players */}
        <div className="bg-white/5 rounded-lg p-3">
          <p className="text-white/60 text-xs font-bold mb-2">DESTAQUES</p>
          <div className="space-y-1.5">
            {topPlayers.map((player, idx) => {
              const rating = Math.round((player.pac + player.sho + player.pas + player.dri + player.def + player.phy) / 6);
              return (
                <div key={player.id} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-[#FEDD00] flex items-center justify-center text-[10px] font-bold text-[#012169]">
                      {idx + 1}
                    </span>
                    <span className="text-white text-sm truncate max-w-[120px]">{player.name}</span>
                  </div>
                  <span className="text-white/80 text-sm font-medium">{rating}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="mt-4 pt-3 border-t border-white/20 text-center">
          <p className="text-white/40 text-xs">
            Criado no <span className="text-[#FEDD00]">Fala Mestre!</span>
          </p>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3">
        <Button
          onClick={handleShare}
          className="flex-1 bg-[#009739] hover:bg-[#00b342] text-white font-bold"
        >
          <Share2 className="w-4 h-4 mr-2" />
          Compartilhar
        </Button>
        <Button
          onClick={handleDownload}
          variant="outline"
          className="border-2 border-white/30 text-white hover:bg-white/10"
        >
          <Download className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
