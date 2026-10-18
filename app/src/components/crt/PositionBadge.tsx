import { cn } from '@/lib/utils';

const POSITION_COLORS: Record<string, string> = {
  GK: '#FFA500',
  DEF: '#3EA0D4',
  MID: '#55e0a0',
  FWD: '#FF3333',
};

interface PositionBadgeProps {
  position: string;
  className?: string;
}

export function PositionBadge({ position, className }: PositionBadgeProps) {
  const normalized = position.toUpperCase().replace(/^GOLEIRO$/, 'GK');
  const pos = normalized as keyof typeof POSITION_COLORS;
  const color = POSITION_COLORS[pos] || '#FFA500';

  return (
    <span
      className={cn(
        'inline-flex items-center justify-center rounded-sm text-white font-[family-name:var(--font-pixel)] leading-none',
        className
      )}
      style={{
        backgroundColor: color,
        fontSize: '0.4rem',
        padding: '2px 5px',
        minWidth: '28px',
      }}
    >
      {normalized}
    </span>
  );
}

export { POSITION_COLORS };
