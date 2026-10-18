import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface ButtonProps {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
  variant?: 'primary' | 'outline' | 'control' | 'control-active' | 'control-red' | 'control-cyan';
  pulse?: boolean;
}

export function CrtButton({
  children,
  onClick,
  disabled,
  className,
  variant = 'primary',
  pulse,
}: ButtonProps) {
  const base = 'font-[family-name:var(--font-pixel)] tracking-wide transition-all active:scale-[0.97]';

  const variants = {
    primary:
      'bg-[#FFDF00] text-[#00381a] border-2 border-[#FFDF00] rounded-md hover:brightness-110',
    outline:
      'bg-transparent text-[#FFDF00] border border-[#FFDF00] rounded-md hover:bg-[#FFDF00] hover:text-[#00381a]',
    control:
      'bg-[rgba(0,25,12,0.85)] text-[#FFDF00] border-2 border-[#FFDF00] rounded-sm hover:bg-[rgba(255,223,0,0.1)]',
    'control-active':
      'bg-[#FFDF00] text-[#00381a] border-2 border-[#FFDF00] rounded-sm shadow-[0_0_8px_rgba(255,223,0,0.4)]',
    'control-red':
      'bg-[rgba(0,25,12,0.85)] text-[#FF3333] border-2 border-[#FF3333] rounded-sm hover:bg-[rgba(255,51,51,0.1)]',
    'control-cyan':
      'bg-[rgba(0,25,12,0.85)] text-[#55e0a0] border-2 border-[#55e0a0] rounded-sm hover:bg-[rgba(85,224,160,0.1)]',
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        base,
        variants[variant],
        disabled && 'opacity-40 cursor-not-allowed',
        pulse && 'pulse-glow',
        className
      )}
    >
      {children}
    </button>
  );
}
