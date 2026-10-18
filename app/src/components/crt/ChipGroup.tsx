import { cn } from '@/lib/utils';

interface ChipGroupProps<T extends string> {
  options: { value: T; label: string }[];
  selected: T;
  onSelect: (value: T) => void;
  className?: string;
}

export function ChipGroup<T extends string>({
  options,
  selected,
  onSelect,
  className,
}: ChipGroupProps<T>) {
  return (
    <div className={cn('flex gap-2 flex-wrap', className)}>
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onSelect(opt.value)}
          className={cn(
            'font-[family-name:var(--font-pixel)] text-[0.5rem] px-2 py-1 rounded-sm border transition-all',
            selected === opt.value
              ? 'bg-[#FFDF00] text-[#00381a] border-[#FFDF00]'
              : 'bg-transparent text-[#FFDF00] border-[rgba(255,223,0,0.4)] hover:bg-[rgba(255,223,0,0.1)]'
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
