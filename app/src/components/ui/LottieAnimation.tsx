'use client';

import { useEffect, useRef, useState } from 'react';
import Lottie, { LottieRefCurrentProps } from 'lottie-react';

interface LottieAnimationProps {
  animationData: unknown;
  loop?: boolean;
  autoplay?: boolean;
  className?: string;
  style?: React.CSSProperties;
  onComplete?: () => void;
}

export function LottieAnimation({
  animationData,
  loop = true,
  autoplay = true,
  className = '',
  style = {},
  onComplete,
}: LottieAnimationProps) {
  const lottieRef = useRef<LottieRefCurrentProps>(null);

  return (
    <Lottie
      lottieRef={lottieRef}
      animationData={animationData}
      loop={loop}
      autoplay={autoplay}
      className={className}
      style={{ ...style, imageRendering: 'pixelated' }}
      rendererSettings={{
        preserveAspectRatio: 'xMidYMid slice',
        progressiveLoad: true,
        hideOnTransparent: true,
      }}
    />
  );
}

// Placeholder animation component until Lottie files are loaded
export function LoadingSpinner(props: Omit<LottieAnimationProps, 'animationData'>) {
  return (
    <div className="flex items-center justify-center w-full h-full">
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
        className="text-4xl"
      >
        ⚽
      </motion.div>
    </div>
  );
}

// Import motion from framer-motion for the placeholder
import { motion } from 'framer-motion';
