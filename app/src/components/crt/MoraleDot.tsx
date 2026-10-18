interface MoraleDotProps {
  value: number;
}

export function MoraleDot({ value }: MoraleDotProps) {
  const color =
    value > 65 ? '#00A859' : value > 35 ? '#FFA500' : '#FF3333';

  return (
    <span
      className="inline-block rounded-full"
      style={{
        width: 8,
        height: 8,
        backgroundColor: color,
        boxShadow: `0 0 4px ${color}`,
      }}
    />
  );
}
