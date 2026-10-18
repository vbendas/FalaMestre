import { cn } from '@/lib/utils';

interface ComparisonBarProps {
  homeValue: number;
  awayValue: number;
  label: string;
  homeLabel?: string;
  awayLabel?: string;
  className?: string;
}

export function ComparisonBar({
  homeValue,
  awayValue,
  label,
  className,
}: ComparisonBarProps) {
  const total = homeValue + awayValue || 1;
  const homePct = (homeValue / total) * 100;

  return (
    <div className={cn('flex items-center gap-2 text-xs', className)}>
      <span className="w-8 text-right text-[#FFDF00] font-[family-name:var(--font-pixel)]">
        {homeValue}
      </span>
      <div className="flex-1 flex h-1.5 rounded-sm overflow-hidden bg-[rgba(0,0,0,0.3)]">
        <div
          className="bg-[#00A859] transition-all duration-500 rounded-l-sm"
          style={{ width: `${homePct}%` }}
        />
        <div
          className="bg-[#3EA0D4] transition-all duration-500 rounded-r-sm"
          style={{ width: `${100 - homePct}%` }}
        />
      </div>
      <span className="w-8 text-[rgba(255,255,255,0.6)] font-[family-name:var(--font-pixel)]">
        {awayValue}
      </span>
    </div>
  );
}
