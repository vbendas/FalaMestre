interface NotificationBadgeProps {
  count: number;
}

export function NotificationBadge({ count }: NotificationBadgeProps) {
  if (count <= 0) return null;

  return (
    <span
      className="absolute -top-1 -right-1 rounded-full flex items-center justify-center text-white font-[family-name:var(--font-pixel)] live-dot-pulse"
      style={{
        backgroundColor: '#FF3333',
        width: 14,
        height: 14,
        fontSize: '0.35rem',
        boxShadow: '0 0 6px rgba(255,51,51,0.6)',
      }}
    >
      {count > 9 ? '9+' : count}
    </span>
  );
}
