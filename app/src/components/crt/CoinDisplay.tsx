interface CoinDisplayProps {
  amount: number | string;
  size?: 'sm' | 'md' | 'lg';
}

export function CoinDisplay({ amount, size = 'md' }: CoinDisplayProps) {
  const sizes = {
    sm: 'text-xs',
    md: 'text-[0.55rem]',
    lg: 'text-[0.7rem]',
  };

  const formatted =
    typeof amount === 'number' ? amount.toLocaleString('pt-BR') : amount;

  return (
    <span
      className={`${sizes[size]} gold-glow-text font-[family-name:var(--font-pixel)] inline-flex items-center gap-1`}
    >
      <span>💰</span>
      <span>{formatted}</span>
    </span>
  );
}
