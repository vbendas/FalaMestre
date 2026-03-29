'use client';

import { motion } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import { StadiumSpinner, LoadingSpinner } from '@/components/ui/LoadingSpinner';

export function LoadingScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#012169] via-[#009739] to-[#006400] pixel-bg-dots">
      <Card className="w-full max-w-md pixel-card">
        <CardContent className="pt-8 pb-8 text-center">
          <motion.div
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: 'spring', stiffness: 260, damping: 20 }}
            className="w-24 h-24 mx-auto mb-6"
          >
            <StadiumSpinner className="w-full h-full" />
          </motion.div>
          
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-2xl font-bold mb-2 text-[#FEDD00] pixel-text"
          >
            Fala Mestre!
          </motion.h1>
          
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="text-white/60 mb-6 font-[family-name:var(--font-retro)]"
          >
            Preparando o campo...
          </motion.p>
          
          <motion.div
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ duration: 1.5, ease: 'easeInOut' }}
            className="h-2 bg-gradient-to-r from-transparent via-[#FEDD00] to-transparent max-w-[200px] mx-auto pixel-border-thin"
          />
          
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
            className="mt-6"
          >
            <LoadingSpinner size="sm" showText text="Conectando..." />
          </motion.div>
        </CardContent>
      </Card>
    </div>
  );
}
