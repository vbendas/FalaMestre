import { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { CoinDisplay } from './CoinDisplay';

interface ManagementLayoutProps {
  title: string;
  icon: string;
  money: number;
  onBack: () => void;
  children: ReactNode;
  className?: string;
}

export function ManagementLayout({
  title,
  icon,
  money,
  onBack,
  children,
  className,
}: ManagementLayoutProps) {
  return (
    <div className={cn('flex flex-col h-full', className)}>
      <div className="frosted-card flex items-center justify-between px-3 py-2 m-3 mb-0">
        <button
          onClick={onBack}
          className="text-[#FFDF00] text-xs hover:text-white transition-colors font-[family-name:var(--font-pixel)]"
        >
          ← VOLTAR
        </button>
        <h2 className="text-[0.55rem] gold-glow-text font-[family-name:var(--font-pixel)]">
          {icon} {title}
        </h2>
        <CoinDisplay amount={money} size="sm" />
      </div>
      <div className="flex-1 overflow-y-auto pixel-scrollbar p-3">
        {children}
      </div>
    </div>
  );
}
