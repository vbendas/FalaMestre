'use client';

import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useFriends, type Friend } from '@/contexts/FriendsContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Trophy, Swords, UserPlus, X, Search, Users, TrendingUp } from 'lucide-react';

interface FriendsListProps {
  onChallenge?: (friend: Friend) => void;
  onViewSquad?: (friend: Friend) => void;
}

export function FriendsList({ onChallenge, onViewSquad }: FriendsListProps) {
  const { friends, addFriend, removeFriend, isLoading } = useFriends();
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [newFriendName, setNewFriendName] = useState('');
  const [newFriendTeam, setNewFriendTeam] = useState('');
  const [addError, setAddError] = useState<string | null>(null);

  const filteredFriends = useMemo(() => {
    if (!searchQuery.trim()) return friends;
    const query = searchQuery.toLowerCase();
    return friends.filter(
      f => f.name.toLowerCase().includes(query) || f.team.toLowerCase().includes(query)
    );
  }, [friends, searchQuery]);

  const handleAddFriend = () => {
    if (!newFriendName.trim()) {
      setAddError('Digite o nome do amigo');
      return;
    }
    if (!newFriendTeam.trim()) {
      setAddError('Digite o time do amigo');
      return;
    }

    const success = addFriend({
      name: newFriendName.trim(),
      team: newFriendTeam.trim(),
      rating: 65 + Math.floor(Math.random() * 20), // Random rating 65-85
    });

    if (success) {
      setNewFriendName('');
      setNewFriendTeam('');
      setShowAddForm(false);
      setAddError(null);
    } else {
      setAddError('Este amigo já está na sua lista');
    }
  };

  const handleRemoveFriend = (friendId: string, friendName: string) => {
    if (confirm(`Remover ${friendName} da lista de amigos?`)) {
      removeFriend(friendId);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          className="w-8 h-8 border-2 border-[#FEDD00] border-t-transparent rounded-full"
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Search and Add */}
      <div className="flex gap-2">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar amigos..."
            className="pl-9 bg-white/10 border-white/20 text-white placeholder-white/40"
          />
        </div>
        <Button
          onClick={() => setShowAddForm(!showAddForm)}
          className="bg-[#009739] hover:bg-[#00b342]"
        >
          <UserPlus className="w-4 h-4" />
        </Button>
      </div>

      {/* Add Friend Form */}
      <AnimatePresence>
        {showAddForm && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <Card className="bg-white/5 border-white/20">
              <CardContent className="p-4 space-y-3">
                <Input
                  value={newFriendName}
                  onChange={(e) => setNewFriendName(e.target.value)}
                  placeholder="Nome do amigo"
                  className="bg-white/10 border-white/20 text-white placeholder-white/40"
                />
                <Input
                  value={newFriendTeam}
                  onChange={(e) => setNewFriendTeam(e.target.value)}
                  placeholder="Nome do time"
                  className="bg-white/10 border-white/20 text-white placeholder-white/40"
                />
                {addError && (
                  <p className="text-red-400 text-sm">{addError}</p>
                )}
                <div className="flex gap-2">
                  <Button
                    onClick={handleAddFriend}
                    className="flex-1 bg-[#009739] hover:bg-[#00b342]"
                  >
                    Adicionar
                  </Button>
                  <Button
                    onClick={() => {
                      setShowAddForm(false);
                      setAddError(null);
                      setNewFriendName('');
                      setNewFriendTeam('');
                    }}
                    variant="ghost"
                    className="text-white/60"
                  >
                    Cancelar
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Friends List */}
      {filteredFriends.length === 0 ? (
        <div className="text-center py-8 space-y-3">
          <Users className="w-12 h-12 mx-auto text-white/30" />
          <p className="text-white/60">
            {searchQuery ? 'Nenhum amigo encontrado' : 'Você ainda não tem amigos'}
          </p>
          {!searchQuery && (
            <Button
              onClick={() => setShowAddForm(true)}
              className="bg-[#009739] hover:bg-[#00b342]"
            >
              <UserPlus className="w-4 h-4 mr-2" />
              Adicionar amigo
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {filteredFriends.map((friend) => (
            <motion.div
              key={friend.id}
              layout
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, x: -100 }}
              className="bg-white/5 rounded-lg p-3 border border-white/10"
            >
              <div className="flex items-center gap-3">
                {/* Avatar */}
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#012169] to-[#009739] flex items-center justify-center text-white font-bold">
                  {friend.name.charAt(0).toUpperCase()}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-white font-medium truncate">{friend.name}</p>
                  <p className="text-white/50 text-xs truncate">{friend.team}</p>
                </div>

                {/* Rating */}
                <div className="text-right">
                  <div className="flex items-center gap-1 text-[#FEDD00]">
                    <TrendingUp className="w-3 h-3" />
                    <span className="font-bold">{friend.rating}</span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-1">
                  {onChallenge && (
                    <Button
                      size="sm"
                      onClick={() => onChallenge(friend)}
                      className="bg-purple-600 hover:bg-purple-700 p-2"
                    >
                      <Swords className="w-4 h-4" />
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleRemoveFriend(friend.id, friend.name)}
                    className="text-white/40 hover:text-red-400 p-2"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
