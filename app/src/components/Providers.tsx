'use client';

import { SessionProvider } from 'next-auth/react';
import { ReactNode } from 'react';
import { MotionConfig } from 'framer-motion';
import { FriendsProvider } from '@/contexts/FriendsContext';

interface Props {
  children: ReactNode;
}

export function Providers({ children }: Props) {
  return (
    <SessionProvider>
      <MotionConfig reducedMotion="user">
        <FriendsProvider>
          {children}
        </FriendsProvider>
      </MotionConfig>
    </SessionProvider>
  );
}
