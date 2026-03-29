'use client';

import { SessionProvider } from 'next-auth/react';
import { ReactNode } from 'react';
import { FriendsProvider } from '@/contexts/FriendsContext';

interface Props {
  children: ReactNode;
}

export function Providers({ children }: Props) {
  return (
    <SessionProvider>
      <FriendsProvider>
        {children}
      </FriendsProvider>
    </SessionProvider>
  );
}
