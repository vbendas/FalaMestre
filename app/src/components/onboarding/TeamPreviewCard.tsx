'use client';

import { TeamFormData } from './TeamCreationForm';
import { GlassCard } from '@/components/crt/GlassCard';

interface TeamPreviewCardProps {
  teamData: TeamFormData;
}

export function TeamPreviewCard({ teamData }: TeamPreviewCardProps) {
  const getBadgeShapeClass = (style: string) => {
    switch (style) {
      case 'circle':
        return 'rounded-full';
      case 'diamond':
        return 'rotate-45';
      case 'shield':
        return 'rounded-b-3xl';
      case 'crest':
        return 'rounded-lg';
      default:
        return 'rounded-lg';
    }
  };

  return (
    <div className="w-full max-w-sm">
      <GlassCard strong className="p-5">
        {/* Badge */}
        <div className="flex justify-center mb-4">
          <div
            className={`w-20 h-20 flex items-center justify-center font-bold text-xl border-4 border-[#FFDF00] ${getBadgeShapeClass(
              teamData.badgeStyle
            )}`}
            style={{
              backgroundColor: teamData.primaryColor,
              color: teamData.secondaryColor,
              boxShadow: '0 0 12px rgba(255,223,0,0.3)',
            }}
          >
            {teamData.name.substring(0, 3).toUpperCase()}
          </div>
        </div>

        {/* Team Name */}
        <div className="text-center mb-4">
          <h3 className="text-[0.65rem] gold-glow-text font-[family-name:var(--font-pixel)] mb-2">
            {teamData.name}
          </h3>
          <div className="flex justify-center gap-3">
            <div className="flex items-center gap-1">
              <div
                className="w-3 h-3 rounded-full border border-white/30"
                style={{ backgroundColor: teamData.primaryColor }}
              />
              <span className="text-[0.5rem] text-[rgba(255,223,0,0.55)] font-[family-name:var(--font-pixel)]">PRIMÁRIA</span>
            </div>
            <div className="flex items-center gap-1">
              <div
                className="w-3 h-3 rounded-full border border-white/30"
                style={{ backgroundColor: teamData.secondaryColor }}
              />
              <span className="text-[0.5rem] text-[rgba(255,223,0,0.55)] font-[family-name:var(--font-pixel)]">SECUNDÁRIA</span>
            </div>
          </div>
        </div>

        {/* Divider */}
        <div className="h-px bg-[rgba(255,223,0,0.15)] my-3" />

        {/* Info row */}
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-[rgba(0,0,0,0.3)] p-2 rounded text-center">
            <p className="text-[0.5rem] text-[rgba(255,223,0,0.4)] font-[family-name:var(--font-pixel)]">BRASÃO</p>
            <p className="text-[0.5rem] text-[#55e0a0] font-[family-name:var(--font-pixel)] mt-0.5 capitalize">{teamData.badgeStyle}</p>
          </div>
          <div className="bg-[rgba(0,0,0,0.3)] p-2 rounded text-center">
            <p className="text-[0.5rem] text-[rgba(255,223,0,0.4)] font-[family-name:var(--font-pixel)]">STATUS</p>
            <p className="text-[0.5rem] text-[#00A859] font-[family-name:var(--font-pixel)] mt-0.5">PRONTO!</p>
          </div>
        </div>
      </GlassCard>

      <p className="mt-3 text-center text-[0.5rem] text-[rgba(255,223,0,0.4)] font-[family-name:var(--font-pixel)]">
        Este é o brasão que representará seu time! ⚽
      </p>
    </div>
  );
}
