'use client';

import { DecisionOption } from '@/lib/types';

interface OptionButtonProps {
  option: DecisionOption;
  isDefault: boolean;
  isSelected: boolean;
  onSelect: () => void;
  disabled: boolean;
}

export function OptionButton({ option, isDefault, isSelected, onSelect, disabled }: OptionButtonProps) {
  const categoryBorder =
    option.category === 'mentality' || option.category === 'formation'
      ? 'border-[#FEDD00]'
      : option.category === 'substitution'
        ? 'border-[#3b82f6]'
        : isDefault
          ? 'border-white/30'
          : 'border-[#FEDD00]';

  return (
    <button
      onClick={onSelect}
      disabled={disabled}
      className={`
        pixel-btn w-full min-h-[44px] text-left px-4 py-3 rounded
        border-2 ${categoryBorder}
        bg-black/30 hover:bg-black/50
        transition-colors duration-150
        ${disabled ? 'opacity-50 pointer-events-none' : ''}
        ${isSelected ? 'option-press' : ''}
        ${isDefault && isSelected ? 'default-flash' : ''}
      `}
    >
      <div className="flex items-center gap-3">
        <span className="text-2xl">{option.icon}</span>
        <div>
          <p className="text-white font-[family-name:var(--font-retro)] text-sm">{option.label}</p>
          <p className="text-white/60 text-xs">{option.description}</p>
        </div>
      </div>
    </button>
  );
}
