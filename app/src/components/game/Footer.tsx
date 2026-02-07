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
      className="mt-auto py-6"
    >
      <div className="max-w-4xl mx-auto px-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-white/40 text-sm">Fala Mestre!</span>
            <span className="text-white/20">|</span>
            <span className="text-white/30 text-xs">Demo for Socios</span>
          </div>
          
          <div className="text-white/30 text-xs">
            v0.1.0
          </div>
        </div>
        
        {/* Accent line */}
        <div
          className="mt-3 h-1 w-full pixel-border-thin"
          style={{
            background: teamColor 
              ? `linear-gradient(90deg, transparent, ${teamColor}, transparent)`
              : 'linear-gradient(90deg, transparent, #FEDD00, transparent)'
          }}
        />
      </div>
    </motion.footer>
  );
}
