'use client';

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, XCircle, Shuffle, Sparkles } from 'lucide-react';

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

const TEAM_NAME_SUGGESTIONS = [
  'Dragões do Cerrado', 'Leões da Savana', 'Tigres do Pantanal', 'Águias do Vale',
  'Panteras Negras', 'Fênix FC', 'Tempestade SC', 'Vikings BR', 'Tornado FC',
  'Relâmpagos FC', 'Imperadores', 'Cavaleiros FC', 'Gladiadores', 'Falcões SC',
  'Búfalos FC', 'Cobras NC', 'Tubarões FC', 'Lobos SC', 'Urso FC', 'Onça Pintada',
];

function getValidationState(teamName: string): 'empty' | 'invalid' | 'valid' {
  if (!teamName.trim()) return 'empty';
  if (teamName.length < 3 || teamName.length > 30) return 'invalid';
  return 'valid';
}

function getCharacterCountColor(current: number, max: number): string {
  const ratio = current / max;
  if (ratio >= 1) return 'text-red-400';
  if (ratio >= 0.9) return 'text-orange-400';
  if (ratio >= 0.7) return 'text-yellow-400';
  return 'text-gray-400';
}

export function TeamCreationForm({ onSubmit, isLoading = false }: TeamCreationFormProps) {
  const [teamName, setTeamName] = useState('');
  const [primaryColor, setPrimaryColor] = useState('#FFD700');
  const [secondaryColor, setSecondaryColor] = useState('#008000');
  const [badgeStyle, setBadgeStyle] = useState<'shield' | 'circle' | 'crest' | 'diamond'>('shield');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  const validationState = getValidationState(teamName);

  const validateField = useCallback((field: string, value: string) => {
    switch (field) {
      case 'teamName':
        if (!value.trim()) return 'O nome do time é obrigatório';
        if (value.length < 3) return 'Mínimo de 3 caracteres';
        if (value.length > 30) return 'Máximo de 30 caracteres';
        if (!/^[a-zA-ZÀ-ÿ\s]+$/.test(value.trim())) return 'Apenas letras e espaços';
        return '';
      default:
        return '';
    }
  }, []);

  const handleBlur = (field: string) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
    const error = validateField(field, field === 'teamName' ? teamName : '');
    setErrors((prev) => ({ ...prev, [field]: error }));
  };

  const handleTeamNameChange = (value: string) => {
    setTeamName(value);
    if (touched.teamName) {
      const error = validateField('teamName', value);
      setErrors((prev) => ({ ...prev, teamName: error }));
    }
  };

  const handleRandomSuggestion = () => {
    const randomName = TEAM_NAME_SUGGESTIONS[Math.floor(Math.random() * TEAM_NAME_SUGGESTIONS.length)];
    setTeamName(randomName);
    setTouched((prev) => ({ ...prev, teamName: true }));
    setErrors((prev) => ({ ...prev, teamName: '' }));
  };

  const handleRandomBadge = () => {
    const randomStyle = BADGE_STYLES[Math.floor(Math.random() * BADGE_STYLES.length)];
    setBadgeStyle(randomStyle);
  };

  const handleRandomColors = () => {
    const randomPreset = DEFAULT_COLORS[Math.floor(Math.random() * DEFAULT_COLORS.length)];
    setPrimaryColor(randomPreset.primary);
    setSecondaryColor(randomPreset.secondary);
  };

  const isFormValid = validationState === 'valid';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const teamNameError = validateField('teamName', teamName);
    if (teamNameError) {
      setErrors({ teamName: teamNameError });
      setTouched({ teamName: true });
      return;
    }

    onSubmit({
      name: teamName.trim(),
      primaryColor,
      secondaryColor,
      badgeStyle,
    });
  };

  const getInputBorderColor = () => {
    if (touched.teamName && errors.teamName) return 'border-red-500 focus:border-red-400';
    if (touched.teamName && validationState === 'valid') return 'border-green-500 focus:border-green-400';
    return 'border-[#00d9ff] focus:border-yellow-400';
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 w-full max-w-md">
      {/* Team Name Input */}
      <div>
        <label htmlFor="teamName" className="block text-sm font-medium mb-2 text-yellow-400">
          Nome do Seu Time
        </label>
        <div className="relative">
          <input
            id="teamName"
            type="text"
            value={teamName}
            onChange={(e) => handleTeamNameChange(e.target.value)}
            onBlur={() => handleBlur('teamName')}
            placeholder="Ex: Dragões do Cerrado"
            maxLength={30}
            disabled={isLoading}
            className={`w-full px-4 py-3 bg-[#1a1a2e] border-2 text-white rounded-lg focus:outline-none transition ${getInputBorderColor()} disabled:opacity-50 pr-10`}
          />
          <AnimatePresence mode="wait">
            {touched.teamName && (
              <motion.div
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0, opacity: 0 }}
                className="absolute right-3 top-1/2 -translate-y-1/2"
              >
                {validationState === 'valid' ? (
                  <CheckCircle className="w-5 h-5 text-green-500" />
                ) : errors.teamName ? (
                  <XCircle className="w-5 h-5 text-red-500" />
                ) : null}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <AnimatePresence>
          {touched.teamName && errors.teamName && (
            <motion.p
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -5 }}
              className="text-red-400 text-sm mt-1.5 flex items-center gap-1"
            >
              <XCircle className="w-3 h-3" />
              {errors.teamName}
            </motion.p>
          )}
        </AnimatePresence>

        <div className="flex justify-between items-center mt-2">
          <p className={`text-xs transition-colors ${getCharacterCountColor(teamName.length, 30)}`}>
            {teamName.length}/30 caracteres
          </p>
          <button
            type="button"
            onClick={handleRandomSuggestion}
            className="text-xs text-[#00d9ff] hover:text-yellow-400 transition-colors flex items-center gap-1"
          >
            <Sparkles className="w-3 h-3" />
            Suggestion
          </button>
        </div>
      </div>

      {/* Badge Style Selection */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <label className="block text-sm font-medium text-yellow-400">Estilo do Brasão</label>
          <button
            type="button"
            onClick={handleRandomBadge}
            className="text-xs text-[#00d9ff] hover:text-yellow-400 transition-colors flex items-center gap-1"
          >
            <Shuffle className="w-3 h-3" />
            Random
          </button>
        </div>
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
        <div className="flex items-center justify-between mb-3">
          <label className="block text-sm font-medium text-yellow-400">Esquema de Cores</label>
          <button
            type="button"
            onClick={handleRandomColors}
            className="text-xs text-[#00d9ff] hover:text-yellow-400 transition-colors flex items-center gap-1"
          >
            <Shuffle className="w-3 h-3" />
            Random
          </button>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {DEFAULT_COLORS.map((preset) => (
            <button
              key={preset.name}
              type="button"
              onClick={() => {
                setPrimaryColor(preset.primary);
                setSecondaryColor(preset.secondary);
              }}
              disabled={isLoading}
              className={`p-3 rounded-lg border-2 transition ${
                primaryColor === preset.primary && secondaryColor === preset.secondary
                  ? 'border-yellow-400 bg-yellow-400/20'
                  : 'border-[#00d9ff] hover:border-yellow-400'
              } disabled:opacity-50`}
            >
              <div className="flex gap-1 mb-1">
                <div
                  className="w-4 h-4 rounded-full border border-white/30"
                  style={{ backgroundColor: preset.primary }}
                />
                <div
                  className="w-4 h-4 rounded-full border border-white/30"
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
      <motion.button
        type="submit"
        disabled={isLoading || !isFormValid}
        whileHover={isFormValid && !isLoading ? { scale: 1.02 } : {}}
        whileTap={isFormValid && !isLoading ? { scale: 0.98 } : {}}
        className={`w-full py-3 px-4 font-bold rounded-lg transition text-lg ${
          isFormValid && !isLoading
            ? 'bg-gradient-to-r from-yellow-400 to-yellow-500 hover:from-yellow-500 hover:to-yellow-600 text-black'
            : 'bg-gray-600 text-gray-400 cursor-not-allowed'
        } disabled:cursor-not-allowed`}
      >
        {isLoading ? (
          <span className="flex items-center justify-center gap-2">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
              className="w-5 h-5 border-2 border-black border-t-transparent rounded-full"
            />
            Criando seu time...
          </span>
        ) : (
          'Criar Meu Time!'
        )}
      </motion.button>

      {/* Helper text */}
      <p className="text-center text-gray-400 text-xs">
        Pressione "Criar Meu Time!" quando estiver pronto
      </p>
    </form>
  );
}
