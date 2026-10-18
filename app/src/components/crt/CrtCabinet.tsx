'use client';

import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface CrtCabinetProps {
  children: ReactNode;
  className?: string;
}

export function CrtCabinet({ children, className }: CrtCabinetProps) {
  return (
    <div className="w-screen h-dvh bg-black">
      <div
        className={cn(
          'w-full h-full relative overflow-hidden bg-[#00381a]',
          'crt-effects crt-scanlines crt-vignette crt-grain crt-phosphor-glow crt-flicker',
          className
        )}
      >
        {children}
      </div>
    </div>
  );
}
