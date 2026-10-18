import { cn } from '@/lib/utils';

interface StatCardProps {
  value: string | number;
  label: string;
  className?: string;
}

export function StatCard({ value, label, className }: StatCardProps) {
  return (
    <div className={cn('frosted-card p-2 text-center', className)}>
      <div className="text-[0.7rem] gold-glow-text font-[family-name:var(--font-pixel)]">
        {value}
      </div>
      <div className="section-title mt-1">{label}</div>
    </div>
  );
}
