"use client";

type TurnTimerProps = {
  timeRemaining: number;
  maxTime?: number;
};

export default function TurnTimer({ timeRemaining, maxTime = 30 }: TurnTimerProps) {
  const percent = maxTime > 0 ? Math.max(0, Math.min(100, (timeRemaining / maxTime) * 100)) : 0;

  const barColor =
    timeRemaining > 20
      ? "bg-emerald-500"
      : timeRemaining > 10
        ? "bg-amber-400"
        : "bg-red-500";

  return (
    <div className="relative w-full h-[6px] rounded-full bg-[var(--bg-secondary)] overflow-hidden">
      <div
        className={`h-full rounded-full ${barColor}`}
        style={{
          width: `${percent}%`,
          transition: "width 1s linear, background-color 0.3s ease",
        }}
      />
      <span className="absolute inset-0 flex items-center justify-center text-[10px] font-semibold text-white leading-none drop-shadow-sm">
        {timeRemaining}s
      </span>
    </div>
  );
}
