'use client';

import { useState } from 'react';

export interface TeamFormData {
  name: string;
  primaryColor: string;
  secondaryColor: string;
  badgeStyle: 'shield' | 'circle' | 'crest' | 'diamond';
}

interface TeamCreationFormProps {
  onSubmit: (data: TeamFormData) => void;
  isLoading?: boolean;
}

const BADGE_STYLES = ['shield', 'circle', 'crest', 'diamond'] as const;

const DEFAULT_COLORS = [
  { name: 'Ouro', primary: '#FFD700', secondary: '#008000' },
  { name: 'Prata', primary: '#C0C0C0', secondary: '#000000' },
  { name: 'Roxa', primary: '#800080', secondary: '#FFFFFF' },
  { name: 'Azul', primary: '#0000FF', secondary: '#00FFFF' },
  { name: 'Vermelha', primary: '#FF0000', secondary: '#FFA500' },
  { name: 'Branca', primary: '#FFFFFF', secondary: '#FFD700' },
];

export function TeamCreationForm({ onSubmit, isLoading = false }: TeamCreationFormProps) {
  const [teamName, setTeamName] = useState('');
  const [primaryColor, setPrimaryColor] = useState('#FFD700');
  const [secondaryColor, setSecondaryColor] = useState('#008000');
  const [badgeStyle, setBadgeStyle] = useState<'shield' | 'circle' | 'crest' | 'diamond'>('shield');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!teamName.trim()) {
      newErrors.teamName = 'O nome do time é obrigatório';
    } else if (teamName.length < 3) {
      newErrors.teamName = 'O nome do time deve ter pelo menos 3 caracteres';
    } else if (teamName.length > 30) {
      newErrors.teamName = 'O nome do time não pode ter mais de 30 caracteres';
    }

    if (!primaryColor) {
      newErrors.primaryColor = 'Cor primária obrigatória';
    }

    if (!secondaryColor) {
      newErrors.secondaryColor = 'Cor secundária obrigatória';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    onSubmit({
      name: teamName.trim(),
      primaryColor,
      secondaryColor,
      badgeStyle,
    });
  };

  const handleColorPreset = (preset: typeof DEFAULT_COLORS[0]) => {
    setPrimaryColor(preset.primary);
    setSecondaryColor(preset.secondary);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 w-full max-w-md">
      {/* Team Name Input */}
      <div>
        <label htmlFor="teamName" className="block text-sm font-medium mb-2 text-yellow-400">
          Nome do Seu Time 🏟️
        </label>
        <input
          id="teamName"
          type="text"
          value={teamName}
          onChange={(e) => {
            setTeamName(e.target.value);
            if (errors.teamName) {
              setErrors({ ...errors, teamName: '' });
            }
          }}
          placeholder="Ex: Dragões do Cerrado"
          maxLength={30}
          disabled={isLoading}
          className={`w-full px-4 py-2 bg-[#1a1a2e] border-2 text-white rounded-lg focus:outline-none transition ${
            errors.teamName
              ? 'border-red-500 focus:border-red-600'
              : 'border-[#00d9ff] focus:border-yellow-400'
          } disabled:opacity-50`}
        />
        {errors.teamName && <p className="text-red-400 text-sm mt-1">{errors.teamName}</p>}
        <p className="text-gray-400 text-xs mt-1">{teamName.length}/30 caracteres</p>
      </div>

      {/* Badge Style Selection */}
      <div>
        <label className="block text-sm font-medium mb-3 text-yellow-400">Estilo do Brasão 🎯</label>
        <div className="grid grid-cols-4 gap-2">
          {BADGE_STYLES.map((style) => (
            <button
              key={style}
              type="button"
              onClick={() => setBadgeStyle(style)}
              disabled={isLoading}
              className={`py-2 px-2 rounded-lg border-2 text-xs font-bold transition capitalize ${
                badgeStyle === style
                  ? 'border-yellow-400 bg-yellow-400 text-black'
                  : 'border-[#00d9ff] bg-[#1a1a2e] text-white hover:border-yellow-400'
              } disabled:opacity-50`}
            >
              {style}
            </button>
          ))}
        </div>
      </div>

      {/* Color Presets */}
      <div>
        <label className="block text-sm font-medium mb-3 text-yellow-400">Esquema de Cores 🎨</label>
        <div className="grid grid-cols-3 gap-3">
          {DEFAULT_COLORS.map((preset) => (
            <button
              key={preset.name}
              type="button"
              onClick={() => handleColorPreset(preset)}
              disabled={isLoading}
              className={`p-3 rounded-lg border-2 transition ${
                primaryColor === preset.primary && secondaryColor === preset.secondary
                  ? 'border-yellow-400'
                  : 'border-[#00d9ff] hover:border-yellow-400'
              } disabled:opacity-50`}
            >
              <div className="flex gap-1 mb-1">
                <div
                  className="w-4 h-4 rounded-full border"
                  style={{ backgroundColor: preset.primary }}
                />
                <div
                  className="w-4 h-4 rounded-full border"
                  style={{ backgroundColor: preset.secondary }}
                />
              </div>
              <p className="text-xs text-white">{preset.name}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Custom Color Picker */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="primaryColor" className="block text-sm font-medium mb-2 text-yellow-400">
            Cor Primária
          </label>
          <div className="flex gap-2">
            <input
              id="primaryColor"
              type="color"
              value={primaryColor}
              onChange={(e) => setPrimaryColor(e.target.value)}
              disabled={isLoading}
              className="w-12 h-10 rounded-lg cursor-pointer disabled:opacity-50"
            />
            <input
              type="text"
              value={primaryColor}
              onChange={(e) => setPrimaryColor(e.target.value)}
              disabled={isLoading}
              className="flex-1 px-2 py-1 bg-[#1a1a2e] border-2 border-[#00d9ff] text-white rounded text-sm font-mono disabled:opacity-50"
            />
          </div>
        </div>

        <div>
          <label htmlFor="secondaryColor" className="block text-sm font-medium mb-2 text-yellow-400">
            Cor Secundária
          </label>
          <div className="flex gap-2">
            <input
              id="secondaryColor"
              type="color"
              value={secondaryColor}
              onChange={(e) => setSecondaryColor(e.target.value)}
              disabled={isLoading}
              className="w-12 h-10 rounded-lg cursor-pointer disabled:opacity-50"
            />
            <input
              type="text"
              value={secondaryColor}
              onChange={(e) => setSecondaryColor(e.target.value)}
              disabled={isLoading}
              className="flex-1 px-2 py-1 bg-[#1a1a2e] border-2 border-[#00d9ff] text-white rounded text-sm font-mono disabled:opacity-50"
            />
          </div>
        </div>
      </div>

      {/* Submit Button */}
      <button
        type="submit"
        disabled={isLoading || !teamName.trim()}
        className="w-full py-3 px-4 bg-gradient-to-r from-yellow-400 to-yellow-500 hover:from-yellow-500 hover:to-yellow-600 text-black font-bold rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed text-lg"
      >
        {isLoading ? 'Criando seu time...' : 'Criar Meu Time! ⚽'}
      </button>

      {/* Skip Option */}
      <p className="text-center text-gray-400 text-xs">
        Não consegue decidir? Nós escolhemos um para você! 👇
      </p>
    </form>
  );
}
