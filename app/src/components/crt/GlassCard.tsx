import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface GlassCardProps {
  children: ReactNode;
  className?: string;
  glow?: boolean;
  strong?: boolean;
  onClick?: () => void;
}

export function GlassCard({ children, className, glow, strong, onClick }: GlassCardProps) {
  return (
    <div
      className={cn(
        strong ? 'frosted-card-strong' : 'frosted-card',
        glow && 'hover:shadow-[0_0_12px_rgba(255,223,0,0.2)] transition-shadow',
        onClick && 'cursor-pointer',
        className
      )}
      onClick={onClick}
    >
      {children}
    </div>
  );
}
