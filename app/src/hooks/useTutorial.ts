'use client';

import { useState, useEffect, useCallback } from 'react';

export type TutorialFeature = 'chat' | 'squad' | 'match' | 'training' | 'market' | 'vr';

interface TutorialState {
  completedTutorials: TutorialFeature[];
  currentTutorial: TutorialFeature | null;
  isActive: boolean;
  hasSeenOnboarding: boolean;
}

const STORAGE_KEY = 'falaMestre_tutorial_state';

function getInitialState(): TutorialState {
  if (typeof window === 'undefined') {
    return {
      completedTutorials: [],
      currentTutorial: null,
      isActive: false,
      hasSeenOnboarding: false,
    };
  }

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (e) {
    console.warn('Failed to load tutorial state:', e);
  }

  return {
    completedTutorials: [],
    currentTutorial: null,
    isActive: false,
    hasSeenOnboarding: false,
  };
}

function saveState(state: TutorialState) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    console.warn('Failed to save tutorial state:', e);
  }
}

export function useTutorial() {
  const [state, setState] = useState<TutorialState>(getInitialState);

  useEffect(() => {
    saveState(state);
  }, [state]);

  const startTutorial = useCallback((feature: TutorialFeature) => {
    setState((prev) => ({
      ...prev,
      currentTutorial: feature,
      isActive: true,
    }));
  }, []);

  const completeTutorial = useCallback((feature: TutorialFeature) => {
    setState((prev) => {
      if (prev.completedTutorials.includes(feature)) {
        return { ...prev, currentTutorial: null, isActive: false };
      }
      return {
        ...prev,
        completedTutorials: [...prev.completedTutorials, feature],
        currentTutorial: null,
        isActive: false,
      };
    });
  }, []);

  const skipTutorial = useCallback(() => {
    setState((prev) => ({
      ...prev,
      currentTutorial: null,
      isActive: false,
    }));
  }, []);

  const markOnboardingSeen = useCallback(() => {
    setState((prev) => ({
      ...prev,
      hasSeenOnboarding: true,
    }));
  }, []);

  const resetTutorial = useCallback((feature?: TutorialFeature) => {
    if (feature) {
      setState((prev) => ({
        ...prev,
        completedTutorials: prev.completedTutorials.filter((f) => f !== feature),
      }));
    } else {
      setState({
        completedTutorials: [],
        currentTutorial: null,
        isActive: false,
        hasSeenOnboarding: false,
      });
    }
  }, []);

  const isTutorialCompleted = useCallback(
    (feature: TutorialFeature) => state.completedTutorials.includes(feature),
    [state.completedTutorials]
  );

  const shouldShowTutorial = useCallback(
    (feature: TutorialFeature) => {
      return !state.completedTutorials.includes(feature) && !state.isActive;
    },
    [state.completedTutorials, state.isActive]
  );

  return {
    ...state,
    startTutorial,
    completeTutorial,
    skipTutorial,
    markOnboardingSeen,
    resetTutorial,
    isTutorialCompleted,
    shouldShowTutorial,
  };
}

// Predefined tutorial configs for each feature
export const TUTORIAL_CONFIGS: Record<TutorialFeature, { steps: number; title: string }> = {
  chat: { steps: 2, title: 'Chat Tutorial' },
  squad: { steps: 3, title: 'Squad Tutorial' },
  match: { steps: 4, title: 'Match Tutorial' },
  training: { steps: 3, title: 'Training Tutorial' },
  market: { steps: 2, title: 'Market Tutorial' },
  vr: { steps: 3, title: 'VR Tutorial' },
};
