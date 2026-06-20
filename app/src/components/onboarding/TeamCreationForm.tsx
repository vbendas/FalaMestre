'use client';

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, XCircle, Shuffle, Sparkles } from 'lucide-react';
import { GlassCard } from '@/components/crt/GlassCard';
import { CrtButton } from '@/components/crt/CrtButton';
import { SectionTitle } from '@/components/crt/SectionTitle';

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

  const inputBorderClass =
    touched.teamName && errors.teamName
      ? 'border-[#FF3333] focus:border-[#FF3333] focus:shadow-[0_0_8px_rgba(255,51,51,0.3)]'
      : touched.teamName && validationState === 'valid'
        ? 'border-[#00A859] focus:border-[#00A859] focus:shadow-[0_0_8px_rgba(0,168,89,0.3)]'
        : 'border-[rgba(255,223,0,0.4)] focus:border-[#FFDF00] focus:shadow-[0_0_8px_rgba(255,223,0,0.3)]';

  return (
    <form onSubmit={handleSubmit} className="space-y-4 w-full">
      {/* Team Name */}
      <GlassCard className="p-3">
        <div className="flex items-center justify-between mb-2">
          <SectionTitle>NOME DO TIME</SectionTitle>
          <button
            type="button"
            onClick={handleRandomSuggestion}
            className="text-[0.5rem] text-[#55e0a0] hover:text-[#FFDF00] transition-colors flex items-center gap-1 font-[family-name:var(--font-pixel)]"
          >
            <Sparkles className="w-3 h-3" />
            SUGESTÃO
          </button>
        </div>
        <div className="relative">
          <input
            type="text"
            value={teamName}
            onChange={(e) => handleTeamNameChange(e.target.value)}
            onBlur={() => handleBlur('teamName')}
            placeholder="Ex: Dragões do Cerrado"
            maxLength={30}
            disabled={isLoading}
            className={`w-full h-9 px-3 pr-10 rounded-md bg-[rgba(255,223,0,0.08)] border text-[#FFDF00] caret-[#FFDF00] font-[family-name:var(--font-pixel)] text-[0.5rem] placeholder:text-[rgba(255,223,0,0.3)] outline-none transition-all ${inputBorderClass} disabled:opacity-40`}
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
                  <CheckCircle className="w-4 h-4 text-[#00A859]" />
                ) : errors.teamName ? (
                  <XCircle className="w-4 h-4 text-[#FF3333]" />
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
              className="text-[0.5rem] text-[#FF3333] mt-1 flex items-center gap-1 font-[family-name:var(--font-pixel)]"
            >
              {errors.teamName}
            </motion.p>
          )}
        </AnimatePresence>

        <p className="text-[0.5rem] text-[rgba(255,223,0,0.4)] font-[family-name:var(--font-pixel)] mt-1">
          {teamName.length}/30
        </p>
      </GlassCard>

      {/* Badge Style */}
      <GlassCard className="p-3">
        <div className="flex items-center justify-between mb-2">
          <SectionTitle>ESTILO DO BRASÃO</SectionTitle>
          <button
            type="button"
            onClick={handleRandomBadge}
            className="text-[0.5rem] text-[#55e0a0] hover:text-[#FFDF00] transition-colors flex items-center gap-1 font-[family-name:var(--font-pixel)]"
          >
            <Shuffle className="w-3 h-3" />
            RANDOM
          </button>
        </div>
        <div className="grid grid-cols-4 gap-2">
          {BADGE_STYLES.map((style) => (
            <button
              key={style}
              type="button"
              onClick={() => setBadgeStyle(style)}
              disabled={isLoading}
              className={`py-2 px-1 rounded-sm border text-[0.5rem] font-[family-name:var(--font-pixel)] transition-all capitalize ${
                badgeStyle === style
                  ? 'border-[#FFDF00] bg-[#FFDF00] text-[#00381a]'
                  : 'border-[rgba(255,223,0,0.4)] bg-transparent text-[#FFDF00] hover:border-[#FFDF00]'
              } disabled:opacity-40`}
            >
              {style}
            </button>
          ))}
        </div>
      </GlassCard>

      {/* Color Presets */}
      <GlassCard className="p-3">
        <div className="flex items-center justify-between mb-2">
          <SectionTitle>ESQUEMA DE CORES</SectionTitle>
          <button
            type="button"
            onClick={handleRandomColors}
            className="text-[0.5rem] text-[#55e0a0] hover:text-[#FFDF00] transition-colors flex items-center gap-1 font-[family-name:var(--font-pixel)]"
          >
            <Shuffle className="w-3 h-3" />
            RANDOM
          </button>
        </div>
        <div className="grid grid-cols-6 gap-2">
          {DEFAULT_COLORS.map((preset) => {
            const isSelected = primaryColor === preset.primary && secondaryColor === preset.secondary;
            return (
              <button
                key={preset.name}
                type="button"
                onClick={() => {
                  setPrimaryColor(preset.primary);
                  setSecondaryColor(preset.secondary);
                }}
                disabled={isLoading}
                className={`p-2 rounded-sm border transition-all ${
                  isSelected
                    ? 'border-[#FFDF00] shadow-[0_0_8px_rgba(255,223,0,0.3)]'
                    : 'border-[rgba(255,223,0,0.2)] hover:border-[rgba(255,223,0,0.5)]'
                } disabled:opacity-40`}
              >
                <div className="flex gap-0.5 mb-1 justify-center">
                  <div
                    className="w-3 h-3 rounded-full border border-white/20"
                    style={{ backgroundColor: preset.primary }}
                  />
                  <div
                    className="w-3 h-3 rounded-full border border-white/20"
                    style={{ backgroundColor: preset.secondary }}
                  />
                </div>
                <p className="text-[0.5rem] text-[rgba(255,223,0,0.55)] font-[family-name:var(--font-pixel)]">
                  {preset.name}
                </p>
              </button>
            );
          })}
        </div>
      </GlassCard>

      {/* Custom Colors */}
      <GlassCard className="p-3">
        <SectionTitle>CORES CUSTOMIZADAS</SectionTitle>
        <div className="grid grid-cols-2 gap-3 mt-2">
          <div>
            <label className="text-[0.5rem] text-[rgba(255,223,0,0.55)] font-[family-name:var(--font-pixel)] block mb-1">
              PRIMÁRIA
            </label>
            <div className="flex gap-2 items-center">
              <input
                type="color"
                value={primaryColor}
                onChange={(e) => setPrimaryColor(e.target.value)}
                disabled={isLoading}
                className="w-8 h-7 rounded cursor-pointer disabled:opacity-40 bg-transparent"
              />
              <input
                type="text"
                value={primaryColor}
                onChange={(e) => setPrimaryColor(e.target.value)}
                disabled={isLoading}
                className="flex-1 px-2 py-1 bg-[rgba(255,223,0,0.08)] border border-[rgba(255,223,0,0.3)] text-[#FFDF00] rounded-sm text-[0.5rem] font-mono outline-none disabled:opacity-40"
              />
            </div>
          </div>
          <div>
            <label className="text-[0.5rem] text-[rgba(255,223,0,0.55)] font-[family-name:var(--font-pixel)] block mb-1">
              SECUNDÁRIA
            </label>
            <div className="flex gap-2 items-center">
              <input
                type="color"
                value={secondaryColor}
                onChange={(e) => setSecondaryColor(e.target.value)}
                disabled={isLoading}
                className="w-8 h-7 rounded cursor-pointer disabled:opacity-40 bg-transparent"
              />
              <input
                type="text"
                value={secondaryColor}
                onChange={(e) => setSecondaryColor(e.target.value)}
                disabled={isLoading}
                className="flex-1 px-2 py-1 bg-[rgba(255,223,0,0.08)] border border-[rgba(255,223,0,0.3)] text-[#FFDF00] rounded-sm text-[0.5rem] font-mono outline-none disabled:opacity-40"
              />
            </div>
          </div>
        </div>
      </GlassCard>

      {/* Submit */}
      <button
        type="submit"
        disabled={isLoading || !isFormValid}
        className={`w-full py-3 rounded-md font-[family-name:var(--font-pixel)] text-[0.55rem] transition-all ${
          isFormValid && !isLoading
            ? 'bg-[#FFDF00] text-[#00381a] border-2 border-[#FFDF00] pulse-glow hover:brightness-110 active:scale-[0.97]'
            : 'bg-[rgba(255,223,0,0.1)] text-[rgba(255,223,0,0.3)] border-2 border-[rgba(255,223,0,0.2)] cursor-not-allowed'
        } disabled:cursor-not-allowed`}
      >
        {isLoading ? (
          <span className="flex items-center justify-center gap-2">
            <span className="w-3 h-3 border-2 border-[#00381a] border-t-transparent rounded-full animate-spin" />
            CRIANDO...
          </span>
        ) : (
          '⚽ CRIAR MEU TIME!'
        )}
      </button>
    </form>
  );
}
