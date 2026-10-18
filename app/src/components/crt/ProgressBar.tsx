import { cn } from '@/lib/utils';

interface ProgressBarProps {
  value: number;
  max?: number;
  height?: number;
  color?: string;
  className?: string;
  showLabel?: boolean;
}

export function ProgressBar({
  value,
  max = 100,
  height = 4,
  color,
  className,
}: ProgressBarProps) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100));
  const barColor =
    color || (pct > 60 ? '#00A859' : pct > 30 ? '#FFA500' : '#FF3333');

  return (
    <div
      className={cn('w-full rounded-full bg-[rgba(0,0,0,0.3)]', className)}
      style={{ height }}
    >
      <div
        className="rounded-full transition-all duration-300"
        style={{
          width: `${pct}%`,
          height: '100%',
          backgroundColor: barColor,
        }}
      />
    </div>
  );
}
