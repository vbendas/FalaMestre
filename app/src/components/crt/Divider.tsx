import { cn } from '@/lib/utils';

interface DividerProps {
  label?: string;
  className?: string;
}

export function Divider({ label, className }: DividerProps) {
  if (!label) {
    return (
      <div className={cn('h-px bg-[rgba(255,223,0,0.15)]', className)} />
    );
  }

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <div className="flex-1 h-px bg-[rgba(255,223,0,0.3)]" />
      <span className="text-xs text-[rgba(255,223,0,0.55)] font-[family-name:var(--font-pixel)]">
        {label}
      </span>
      <div className="flex-1 h-px bg-[rgba(255,223,0,0.3)]" />
    </div>
  );
}
