'use client';

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';

export interface Friend {
  id: string;
  name: string;
  team: string;
  avatar?: string;
  rating: number;
  addedAt: number;
  lastChallengeAt?: number;
}

interface FriendsContextType {
  friends: Friend[];
  pendingChallenges: Friend[];
  addFriend: (friend: Omit<Friend, 'id' | 'addedAt'>) => boolean;
  removeFriend: (friendId: string) => void;
  challengeFriend: (friendId: string) => Promise<{ won: boolean; score: string } | null>;
  isLoading: boolean;
}

const FriendsContext = createContext<FriendsContextType | undefined>(undefined);

const STORAGE_KEY = 'falastre_friends';

export function FriendsProvider({ children }: { children: ReactNode }) {
  const [friends, setFriends] = useState<Friend[]>([]);
  const [pendingChallenges, setPendingChallenges] = useState<Friend[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Load friends from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        setFriends(JSON.parse(stored));
      }
    } catch (e) {
      console.error('[FriendsContext] Failed to load friends:', e);
    }
    setIsLoading(false);
  }, []);

  // Save friends to localStorage whenever they change
  useEffect(() => {
    if (!isLoading) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(friends));
    }
  }, [friends, isLoading]);

  const addFriend = useCallback((friendData: Omit<Friend, 'id' | 'addedAt'>): boolean => {
    // Check if already friends
    const exists = friends.some(
      f => f.name.toLowerCase() === friendData.name.toLowerCase()
    );
    
    if (exists) {
      return false;
    }

    const newFriend: Friend = {
      ...friendData,
      id: `friend_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      addedAt: Date.now(),
    };

    setFriends(prev => [...prev, newFriend]);
    return true;
  }, [friends]);

  const removeFriend = useCallback((friendId: string) => {
    setFriends(prev => prev.filter(f => f.id !== friendId));
  }, []);

  const challengeFriend = useCallback(async (friendId: string): Promise<{ won: boolean; score: string } | null> => {
    const friend = friends.find(f => f.id === friendId);
    if (!friend) return null;

    // Update last challenge timestamp
    setFriends(prev => prev.map(f => 
      f.id === friendId 
        ? { ...f, lastChallengeAt: Date.now() }
        : f
    ));

    // Calculate challenge result based on rating difference
    // Simulated match with some randomness
    const playerRating = 75; // Could be dynamic based on user's squad
    const ratingDiff = playerRating - friend.rating;
    
    // Higher chance to win if player has higher rated squad
    const winChance = 0.5 + (ratingDiff / 200); // 0.35 to 0.65 range
    const won = Math.random() < winChance;

    // Generate realistic score
    const maxGoals = won ? 4 : 3;
    const playerGoals = won 
      ? Math.floor(Math.random() * maxGoals) + 1
      : Math.floor(Math.random() * 2);
    const friendGoals = won 
      ? Math.floor(Math.random() * playerGoals)
      : Math.floor(Math.random() * maxGoals) + 1;

    const score = `${playerGoals}x${friendGoals}`;

    return { won, score };
  }, [friends]);

  return (
    <FriendsContext.Provider value={{
      friends,
      pendingChallenges,
      addFriend,
      removeFriend,
      challengeFriend,
      isLoading,
    }}>
      {children}
    </FriendsContext.Provider>
  );
}

export function useFriends() {
  const context = useContext(FriendsContext);
  if (!context) {
    throw new Error('useFriends must be used within a FriendsProvider');
  }
  return context;
}
