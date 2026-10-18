import { ReactNode } from 'react';

interface SectionTitleProps {
  children: ReactNode;
}

export function SectionTitle({ children }: SectionTitleProps) {
  return (
    <div className="section-title mb-2">
      {children}
    </div>
  );
}
