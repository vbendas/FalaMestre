import { cn } from '@/lib/utils';

interface PitchBackgroundProps {
  className?: string;
  orientation?: 'horizontal' | 'vertical';
}

export function PitchBackground({
  className,
  orientation = 'horizontal',
}: PitchBackgroundProps) {
  return (
    <div
      className={cn(
        'absolute inset-0 opacity-30',
        orientation === 'horizontal' ? 'pitch-stripes' : 'pitch-stripes-vertical',
        className
      )}
    />
  );
}
