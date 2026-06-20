'use client';

interface CountdownTimerProps {
  timeRemaining: number;
  totalTime: number;
  isPulsing: boolean;
}

export function CountdownTimer({ timeRemaining, totalTime, isPulsing }: CountdownTimerProps) {
  const percentage = Math.max(0, (timeRemaining / totalTime) * 100);

  const colorClass =
    timeRemaining > 15
      ? 'timer-bar-green'
      : timeRemaining > 8
        ? 'timer-bar-yellow'
        : 'timer-bar-red';

  const textColor =
    timeRemaining > 15
      ? 'text-green-400'
      : timeRemaining > 8
        ? 'text-yellow-400'
        : 'text-red-400';

  return (
    <div className="w-full space-y-1">
      <div className="w-full h-2 rounded-full bg-white/10 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-1000 ease-linear ${colorClass} ${isPulsing ? 'timer-pulse' : ''}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
      <p className={`text-lg font-[family-name:var(--font-retro)] text-right ${textColor}`}>
        {timeRemaining}s
      </p>
    </div>
  );
}
