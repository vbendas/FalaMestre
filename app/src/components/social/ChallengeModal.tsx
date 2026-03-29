'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useFriends, type Friend } from '@/contexts/FriendsContext';
import { Button } from '@/components/ui/button';
import { Trophy, Swords, X, RotateCcw } from 'lucide-react';

interface ChallengeModalProps {
  friend: Friend;
  isOpen: boolean;
  onClose: () => void;
  onResult?: (won: boolean, score: string) => void;
}

export function ChallengeModal({ friend, isOpen, onClose, onResult }: ChallengeModalProps) {
  const { challengeFriend } = useFriends();
  const [isChallenging, setIsChallenging] = useState(false);
  const [result, setResult] = useState<{ won: boolean; score: string } | null>(null);

  const handleChallenge = async () => {
    setIsChallenging(true);
    
    // Simulate challenge delay
    await new Promise(r => setTimeout(r, 1500));
    
    const challengeResult = await challengeFriend(friend.id);
    
    if (challengeResult) {
      setResult(challengeResult);
      onResult?.(challengeResult.won, challengeResult.score);
    }
    
    setIsChallenging(false);
  };

  const handleClose = () => {
    setResult(null);
    onClose();
  };

  const handleRematch = () => {
    setResult(null);
    handleChallenge();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
          onClick={handleClose}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm bg-gradient-to-b from-[#012169] to-[#001845] rounded-2xl border-4 border-[#FEDD00] overflow-hidden"
          >
            {/* Header */}
            <div className="relative p-6 text-center bg-gradient-to-r from-purple-900/50 to-transparent">
              <button
                onClick={handleClose}
                className="absolute top-4 right-4 p-2 hover:bg-white/10 rounded-full transition-colors"
              >
                <X className="w-5 h-5 text-white/60" />
              </button>
              
              <div className="text-6xl mb-4">⚽</div>
              <h2 className="text-xl font-bold text-white pixel-text">
                Desafio
              </h2>
              <p className="text-white/60 text-sm mt-1">
                vs {friend.name}
              </p>
            </div>

            {/* Content */}
            <div className="p-6">
              {!result ? (
                /* Challenge in progress */
                <div className="text-center space-y-6">
                  <div className="flex items-center justify-center gap-4">
                    {/* Player team */}
                    <div className="text-center">
                      <div className="w-16 h-16 rounded-full bg-[#009739] flex items-center justify-center text-2xl font-black text-white pixel-text">
                        ?
                      </div>
                      <p className="text-white/80 text-sm mt-2">Você</p>
                    </div>

                    {/* VS */}
                    <div className="text-2xl font-black text-[#FEDD00] pixel-text">VS</div>

                    {/* Friend team */}
                    <div className="text-center">
                      <div className="w-16 h-16 rounded-full bg-purple-600 flex items-center justify-center text-2xl font-black text-white">
                        {friend.name.charAt(0)}
                      </div>
                      <p className="text-white/80 text-sm mt-2">{friend.name}</p>
                    </div>
                  </div>

                  {isChallenging ? (
                    <div className="space-y-3">
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                        className="w-8 h-8 mx-auto border-2 border-[#FEDD00] border-t-transparent rounded-full"
                      />
                      <p className="text-white/60">Simulando partida...</p>
                    </div>
                  ) : (
                    <Button
                      onClick={handleChallenge}
                      className="w-full h-12 bg-[#009739] hover:bg-[#00b342] text-white font-bold"
                    >
                      <Swords className="w-5 h-5 mr-2" />
                      Iniciar Desafio
                    </Button>
                  )}
                </div>
              ) : (
                /* Result */
                <div className="text-center space-y-6">
                  {/* Result icon */}
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', damping: 10, stiffness: 200 }}
                  >
                    {result.won ? (
                      <div className="text-6xl">🏆</div>
                    ) : (
                      <div className="text-6xl">😔</div>
                    )}
                  </motion.div>

                  {/* Result text */}
                  <div>
                    <p className={`text-2xl font-black pixel-text ${result.won ? 'text-[#FEDD00]' : 'text-white/80'}`}>
                      {result.won ? 'Vitória!' : 'Derrota'}
                    </p>
                    <p className="text-white/60 text-sm mt-1">
                      {result.won ? 'Parabéns, você venceu!' : 'Não foi dessa vez...'}
                    </p>
                  </div>

                  {/* Score */}
                  <div className="bg-white/10 rounded-xl p-4">
                    <p className="text-4xl font-black text-white pixel-text">
                      {result.score}
                    </p>
                    <p className="text-white/40 text-xs mt-1">Placar final</p>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-3">
                    <Button
                      onClick={handleClose}
                      className="flex-1 bg-white/10 hover:bg-white/20 text-white"
                    >
                      Fechar
                    </Button>
                    <Button
                      onClick={handleRematch}
                      className="flex-1 bg-purple-600 hover:bg-purple-700 text-white"
                    >
                      <RotateCcw className="w-4 h-4 mr-2" />
                      Revanche
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
