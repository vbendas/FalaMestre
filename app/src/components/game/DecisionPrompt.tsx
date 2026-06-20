'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { DecisionTurn, DecisionOption } from '@/lib/types';
import { CountdownTimer } from './CountdownTimer';
import { OptionButton } from './OptionButton';

interface DecisionPromptProps {
  turn: DecisionTurn;
  turnPrompt: string;
  segmentSummary: string;
  onDecision: (option: DecisionOption) => void;
  onTimeout: () => void;
}

type CategoryKey = 'mentality' | 'formation' | 'instruction';

interface CategoryCluster {
  key: CategoryKey;
  label: string;
  icon: string;
  options: DecisionOption[];
}

export function DecisionPrompt({
  turn,
  turnPrompt,
  segmentSummary,
  onDecision,
  onTimeout,
}: DecisionPromptProps) {
  const [timeRemaining, setTimeRemaining] = useState(turn.timerSeconds);
  const [selectedOption, setSelectedOption] = useState<DecisionOption | null>(null);
  const [hasTimedOut, setHasTimedOut] = useState(false);
  const [expandedCategory, setExpandedCategory] = useState<CategoryKey | null>(null);

  // Group options into clusters
  const { clusters, keepOption } = useMemo(() => {
    const grouped: Record<CategoryKey, DecisionOption[]> = {
      mentality: [],
      formation: [],
      instruction: [],
    };
    let keep: DecisionOption | null = null;

    for (const opt of turn.options) {
      if (opt.action === 'keep_setup') {
        keep = opt;
      } else if (opt.category === 'mentality') {
        grouped.mentality.push(opt);
      } else if (opt.category === 'formation') {
        grouped.formation.push(opt);
      } else if (opt.category === 'instruction') {
        grouped.instruction.push(opt);
      }
    }

    const cats: CategoryCluster[] = [];
    if (grouped.mentality.length > 0) {
      cats.push({ key: 'mentality', label: 'Mentalidade', icon: '⚔️', options: grouped.mentality });
    }
    if (grouped.formation.length > 0) {
      cats.push({ key: 'formation', label: 'Formação', icon: '📐', options: grouped.formation });
    }
    if (grouped.instruction.length > 0) {
      cats.push({ key: 'instruction', label: 'Táticas', icon: '🎯', options: grouped.instruction });
    }

    return { clusters: cats, keepOption: keep };
  }, [turn.options]);

  const handleSelect = useCallback(
    (option: DecisionOption) => {
      if (selectedOption || hasTimedOut) return;
      setSelectedOption(option);
    },
    [selectedOption, hasTimedOut],
  );

  const toggleCategory = useCallback(
    (key: CategoryKey) => {
      if (selectedOption || hasTimedOut) return;
      setExpandedCategory((prev) => (prev === key ? null : key));
    },
    [selectedOption, hasTimedOut],
  );

  useEffect(() => {
    if (selectedOption) {
      const timeout = setTimeout(() => onDecision(selectedOption), 200);
      return () => clearTimeout(timeout);
    }
  }, [selectedOption, onDecision]);

  useEffect(() => {
    if (selectedOption || hasTimedOut) return;
    const interval = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          setHasTimedOut(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [selectedOption, hasTimedOut]);

  useEffect(() => {
    if (hasTimedOut) {
      const timeout = setTimeout(() => onTimeout(), 600);
      return () => clearTimeout(timeout);
    }
  }, [hasTimedOut, onTimeout]);

  const isPulsing = timeRemaining <= 10;
  const defaultOption = turn.defaultOption;
  const disabled = !!selectedOption || hasTimedOut;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
        <motion.div
          initial={{ opacity: 0, y: 60 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          transition={{ duration: 0.35, ease: 'easeOut' }}
          className="pixel-card w-full max-w-[400px] mx-4 p-5 rounded-lg prompt-enter"
        >
          <CountdownTimer
            timeRemaining={timeRemaining}
            totalTime={turn.timerSeconds}
            isPulsing={isPulsing}
          />

          <div className="mt-3 mb-2">
            <p className="text-[#FEDD00] font-[family-name:var(--font-retro)] text-sm">
              {turn.label} — Min {turn.minute}&apos;
            </p>
          </div>

          {turnPrompt && (
            <p className="text-white font-[family-name:var(--font-retro)] text-sm mb-3">
              {turnPrompt}
            </p>
          )}

          {segmentSummary && (
            <p className="text-white/60 text-xs mb-3 line-clamp-2">{segmentSummary}</p>
          )}

          {/* Category clusters */}
          <div className="space-y-2">
            {clusters.map((cluster) => (
              <CategoryButton
                key={cluster.key}
                cluster={cluster}
                isExpanded={expandedCategory === cluster.key}
                disabled={disabled}
                defaultOption={defaultOption}
                selectedOption={selectedOption}
                onToggle={() => toggleCategory(cluster.key)}
                onSelect={handleSelect}
              />
            ))}

            {/* Keep setup — always visible as direct action */}
            {keepOption && (
              <OptionButton
                option={keepOption}
                isDefault={keepOption.id === defaultOption.id}
                isSelected={
                  selectedOption?.id === keepOption.id ||
                  (hasTimedOut && keepOption.id === defaultOption.id)
                }
                onSelect={() => handleSelect(keepOption)}
                disabled={disabled}
              />
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

// Inline cluster button component
function CategoryButton({
  cluster,
  isExpanded,
  disabled,
  defaultOption,
  selectedOption,
  onToggle,
  onSelect,
}: {
  cluster: CategoryCluster;
  isExpanded: boolean;
  disabled: boolean;
  defaultOption: DecisionOption;
  selectedOption: DecisionOption | null;
  onToggle: () => void;
  onSelect: (option: DecisionOption) => void;
}) {
  return (
    <div>
      {/* Cluster header — tappable to expand/collapse */}
      <button
        onClick={onToggle}
        disabled={disabled}
        className={`
          pixel-btn w-full min-h-[44px] text-left px-4 py-3 rounded
          border-2 border-[#FEDD00]/60
          bg-black/30 hover:bg-black/50
          transition-all duration-200
          flex items-center justify-between
          ${disabled ? 'opacity-50 pointer-events-none' : ''}
        `}
      >
        <div className="flex items-center gap-3">
          <span className="text-xl">{cluster.icon}</span>
          <span className="text-white font-[family-name:var(--font-retro)] text-sm">
            {cluster.label}
          </span>
          <span className="text-white/40 text-xs">({cluster.options.length})</span>
        </div>
        <motion.span
          animate={{ rotate: isExpanded ? 90 : 0 }}
          transition={{ duration: 0.2 }}
          className="text-white/60 text-lg"
        >
          ▸
        </motion.span>
      </button>

      {/* Expanded sub-options */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className="pl-4 pt-1 space-y-1">
              {cluster.options.map((option) => (
                <OptionButton
                  key={option.id}
                  option={option}
                  isDefault={option.id === defaultOption.id}
                  isSelected={
                    selectedOption?.id === option.id
                  }
                  onSelect={() => onSelect(option)}
                  disabled={disabled}
                />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
