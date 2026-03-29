'use client';

import { motion } from 'framer-motion';

interface FooterProps {
  teamColor?: string;
}

export function Footer({ teamColor }: FooterProps) {
  return (
    <motion.footer
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="mt-auto py-2"
    >
      {/* Accent line only */}
      <div
        className="h-1 w-full pixel-border-thin"
        style={{
          background: teamColor 
            ? `linear-gradient(90deg, transparent, ${teamColor}, transparent)`
            : 'linear-gradient(90deg, transparent, #FEDD00, transparent)'
        }}
      />
    </motion.footer>
  );
}
