'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Settings, X, Sun, Moon, Type, Contrast, Zap, Monitor } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AccessibilitySettings {
  fontSize: 'small' | 'medium' | 'large';
  highContrast: boolean;
  reducedMotion: boolean;
}

interface SettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AccessibilitySettings;
  onSettingsChange: (settings: AccessibilitySettings) => void;
}

export function SettingsPanel({
  isOpen,
  onClose,
  settings,
  onSettingsChange,
}: SettingsPanelProps) {
  const handleFontSizeChange = (fontSize: AccessibilitySettings['fontSize']) => {
    onSettingsChange({ ...settings, fontSize });
    document.documentElement.setAttribute('data-font-size', fontSize);
  };

  const handleHighContrastToggle = () => {
    const newValue = !settings.highContrast;
    onSettingsChange({ ...settings, highContrast: newValue });
    document.documentElement.classList.toggle('high-contrast', newValue);
  };

  const handleReducedMotionToggle = () => {
    const newValue = !settings.reducedMotion;
    onSettingsChange({ ...settings, reducedMotion: newValue });
    document.documentElement.classList.toggle('reduce-motion', newValue);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-start justify-end"
          onClick={onClose}
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          
          {/* Panel */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-sm h-full bg-[#012169] border-l-4 border-[#FEDD00] overflow-y-auto"
          >
            {/* Header */}
            <div className="sticky top-0 bg-[#012169] border-b-2 border-white/10 p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Settings className="w-5 h-5 text-[#FEDD00]" />
                <h2 className="text-lg font-bold text-white">Configurações</h2>
              </div>
              <button
                onClick={onClose}
                className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                aria-label="Fechar configurações"
              >
                <X className="w-5 h-5 text-white/60" />
              </button>
            </div>

            {/* Content */}
            <div className="p-4 space-y-6">
              {/* Font Size */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Type className="w-5 h-5 text-white/60" />
                  <span className="text-white font-medium">Tamanho da Fonte</span>
                </div>
                <div className="flex gap-2">
                  {(['small', 'medium', 'large'] as const).map((size) => (
                    <button
                      key={size}
                      onClick={() => handleFontSizeChange(size)}
                      aria-pressed={settings.fontSize === size}
                      className={cn(
                        'flex-1 py-3 px-4 rounded-lg font-medium text-sm transition-all',
                        settings.fontSize === size
                          ? 'bg-[#FEDD00] text-[#012169]'
                          : 'bg-white/10 text-white/70 hover:bg-white/20'
                      )}
                    >
                      {size === 'small' ? 'P' : size === 'medium' ? 'M' : 'G'}
                    </button>
                  ))}
                </div>
              </div>

              {/* High Contrast */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Contrast className="w-5 h-5 text-white/60" />
                  <div>
                    <span className="text-white font-medium block">Alto Contraste</span>
                    <span className="text-white/50 text-xs">Melhor visibilidade</span>
                  </div>
                </div>
                <button
                  onClick={handleHighContrastToggle}
                  role="switch"
                  aria-checked={settings.highContrast}
                  className={cn(
                    'w-14 h-8 rounded-full p-1 transition-colors',
                    settings.highContrast ? 'bg-[#009739]' : 'bg-white/20'
                  )}
                >
                  <motion.div
                    animate={{ x: settings.highContrast ? 24 : 0 }}
                    transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                    className="w-6 h-6 bg-white rounded-full shadow-lg"
                  />
                </button>
              </div>

              {/* Reduced Motion */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Zap className="w-5 h-5 text-white/60" />
                  <div>
                    <span className="text-white font-medium block">Movimentos Reduzidos</span>
                    <span className="text-white/50 text-xs">Menor animações</span>
                  </div>
                </div>
                <button
                  onClick={handleReducedMotionToggle}
                  role="switch"
                  aria-checked={settings.reducedMotion}
                  className={cn(
                    'w-14 h-8 rounded-full p-1 transition-colors',
                    settings.reducedMotion ? 'bg-[#009739]' : 'bg-white/20'
                  )}
                >
                  <motion.div
                    animate={{ x: settings.reducedMotion ? 24 : 0 }}
                    transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                    className="w-6 h-6 bg-white rounded-full shadow-lg"
                  />
                </button>
              </div>

              {/* About */}
              <div className="pt-4 border-t border-white/10">
                <div className="flex items-center gap-2 text-white/40 text-xs">
                  <Monitor className="w-4 h-4" />
                  <span>Fala Mestre! v0.1.0</span>
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// Hook to manage accessibility settings
export function useAccessibilitySettings() {
  const [settings, setSettings] = useState<AccessibilitySettings>({
    fontSize: 'medium',
    highContrast: false,
    reducedMotion: false,
  });

  useEffect(() => {
    // Load from localStorage
    const stored = localStorage.getItem('accessibilitySettings');
    if (stored) {
      const parsed = JSON.parse(stored);
      setSettings(parsed);
      
      // Apply to document
      document.documentElement.setAttribute('data-font-size', parsed.fontSize);
      document.documentElement.classList.toggle('high-contrast', parsed.highContrast);
      document.documentElement.classList.toggle('reduce-motion', parsed.reducedMotion);
    }
  }, []);

  const updateSettings = (newSettings: AccessibilitySettings) => {
    setSettings(newSettings);
    localStorage.setItem('accessibilitySettings', JSON.stringify(newSettings));
  };

  return { settings, updateSettings };
}

// CSS for accessibility modes - add to globals.css or component
export const accessibilityStyles = `
  /* High Contrast Mode */
  .high-contrast {
    --background: #000000;
    --foreground: #FFFFFF;
    --primary: #FFFF00;
    --secondary: #00FFFF;
  }
  
  /* Font Size Modes */
  [data-font-size="small"] {
    font-size: 14px;
  }
  
  [data-font-size="medium"] {
    font-size: 16px;
  }
  
  [data-font-size="large"] {
    font-size: 18px;
  }
  
  /* Reduced Motion */
  .reduce-motion *,
  .reduce-motion *::before,
  .reduce-motion *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
`;
