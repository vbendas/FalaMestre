interface LiveDotProps {
  color?: string;
}

export function LiveDot({ color = '#FF3333' }: LiveDotProps) {
  return (
    <span
      className="inline-block rounded-full live-dot-pulse"
      style={{
        width: 6,
        height: 6,
        backgroundColor: color,
      }}
    />
  );
}
