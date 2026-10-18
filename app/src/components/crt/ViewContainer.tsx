import { cn } from '@/lib/utils';

interface ViewContainerProps {
  children: React.ReactNode;
  className?: string;
}

export function ViewContainer({ children, className }: ViewContainerProps) {
  return (
    <div
      className={cn(
        'flex-1 overflow-y-auto pixel-scrollbar p-3 flex flex-col gap-2',
        className
      )}
    >
      {children}
    </div>
  );
}
