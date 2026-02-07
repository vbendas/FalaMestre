'use client';

import { TeamFormData } from './TeamCreationForm';

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
    <div className="w-full max-w-md">
      <h2 className="text-center text-lg font-bold text-yellow-400 mb-6">Sua Prévia do Time 👀</h2>

      <div className="bg-gradient-to-b from-[#1a1a2e] to-[#16213e] rounded-xl p-8 border-2 border-[#00d9ff] shadow-lg">
        {/* Badge */}
        <div className="flex justify-center mb-6">
          <div
            className={`w-24 h-24 flex items-center justify-center font-bold text-2xl border-4 border-yellow-400 ${getBadgeShapeClass(
              teamData.badgeStyle
            )}`}
            style={{
              backgroundColor: teamData.primaryColor,
              color: teamData.secondaryColor,
            }}
          >
            {teamData.name.substring(0, 3).toUpperCase()}
          </div>
        </div>

        {/* Team Name */}
        <div className="text-center mb-6">
          <h3 className="text-2xl font-bold text-white mb-2">{teamData.name}</h3>
          <div className="flex justify-center gap-4">
            <div className="flex items-center gap-2">
              <div
                className="w-4 h-4 rounded-full border-2 border-white"
                style={{ backgroundColor: teamData.primaryColor }}
              />
              <span className="text-xs text-gray-300">Primária</span>
            </div>
            <div className="flex items-center gap-2">
              <div
                className="w-4 h-4 rounded-full border-2 border-white"
                style={{ backgroundColor: teamData.secondaryColor }}
              />
              <span className="text-xs text-gray-300">Secundária</span>
            </div>
          </div>
        </div>

        {/* Badge Style Info */}
        <div className="bg-[#0f3460] p-4 rounded-lg text-center">
          <p className="text-xs text-gray-400 mb-1">Estilo do Brasão</p>
          <p className="text-sm font-bold text-[#00d9ff] capitalize">{teamData.badgeStyle}</p>
        </div>

        {/* Divider */}
        <div className="my-6 border-t border-[#00d9ff] opacity-30" />

        {/* Info Cards */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-[#0f3460] p-3 rounded text-center">
            <p className="text-xs text-gray-400">Esquema</p>
            <p className="text-sm font-bold text-white mt-1">Customizado</p>
          </div>
          <div className="bg-[#0f3460] p-3 rounded text-center">
            <p className="text-xs text-gray-400">Status</p>
            <p className="text-sm font-bold text-green-400 mt-1">Pronto!</p>
          </div>
        </div>
      </div>

      {/* Flavor Text */}
      <div className="mt-6 text-center">
        <p className="text-sm text-gray-300 italic">
          "Este é o brasão que representará seu time!" ⚽
        </p>
      </div>
    </div>
  );
}
