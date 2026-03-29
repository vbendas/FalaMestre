'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, Share2, X } from 'lucide-react';
import { useFriends, type Friend } from '@/contexts/FriendsContext';
import { GameState } from '@/lib/types';
import { FriendsList } from './FriendsList';
import { ChallengeModal } from './ChallengeModal';
import { SquadShareCard } from './SquadShareCard';

interface SocialPanelProps {
  gameState: GameState;
  isOpen: boolean;
  onClose: () => void;
}

type Tab = 'friends' | 'share';

export function SocialPanel({ gameState, isOpen, onClose }: SocialPanelProps) {
  const [activeTab, setActiveTab] = useState<Tab>('friends');
  const [selectedFriend, setSelectedFriend] = useState<Friend | null>(null);
  const { friends } = useFriends();

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full sm:max-w-md bg-gradient-to-b from-[#012169] to-[#001845] rounded-t-3xl sm:rounded-2xl border-t-4 sm:border-4 border-[#FEDD00] overflow-hidden max-h-[85vh] flex flex-col"
          >
            {/* Header */}
            <div className="relative p-4 border-b border-white/10 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Users className="w-5 h-5 text-[#FEDD00]" />
                <h2 className="text-lg font-bold text-white pixel-text">Social</h2>
                {friends.length > 0 && (
                  <span className="bg-[#009739] text-white text-xs font-bold px-2 py-0.5 rounded-full">
                    {friends.length}
                  </span>
                )}
              </div>
              <button
                onClick={onClose}
                className="p-2 hover:bg-white/10 rounded-full transition-colors"
              >
                <X className="w-5 h-5 text-white/60" />
              </button>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-white/10">
              <button
                onClick={() => setActiveTab('friends')}
                className={`flex-1 py-3 text-sm font-medium transition-colors ${
                  activeTab === 'friends'
                    ? 'text-[#FEDD00] border-b-2 border-[#FEDD00]'
                    : 'text-white/60 hover:text-white'
                }`}
              >
                <Users className="w-4 h-4 mx-auto mb-1" />
                Amigos
              </button>
              <button
                onClick={() => setActiveTab('share')}
                className={`flex-1 py-3 text-sm font-medium transition-colors ${
                  activeTab === 'share'
                    ? 'text-[#FEDD00] border-b-2 border-[#FEDD00]'
                    : 'text-white/60 hover:text-white'
                }`}
              >
                <Share2 className="w-4 h-4 mx-auto mb-1" />
                Compartilhar
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4">
              {activeTab === 'friends' ? (
                <FriendsList
                  onChallenge={(friend) => setSelectedFriend(friend)}
                />
              ) : (
                <SquadShareCard gameState={gameState} />
              )}
            </div>

            {/* Challenge Modal */}
            {selectedFriend && (
              <ChallengeModal
                friend={selectedFriend}
                isOpen={!!selectedFriend}
                onClose={() => setSelectedFriend(null)}
                onResult={(won, score) => {
                  // Could post result to chat or add to messages
                  console.log(`Challenge result: ${won ? 'Won' : 'Lost'} ${score}`);
                }}
              />
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
