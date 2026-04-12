"use client";

import StatusParticles from "../../battle/_components/StatusParticles";

type BossStatusEffect = {
  status: string;
  remainingTurns: number;
};

type BossCardProps = {
  name: string;
  currentHp: number;
  maxHp: number;
  statusEffects: BossStatusEffect[];
  isHit?: boolean;
};

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  STUN: { label: "Atordoado", color: "bg-amber-500/20 text-amber-400 border-amber-500/30" },
  FROZEN: { label: "Congelado", color: "bg-cyan-500/20 text-cyan-400 border-cyan-500/30" },
  BURN: { label: "Queimando", color: "bg-orange-500/20 text-orange-400 border-orange-500/30" },
  POISON: { label: "Envenenado", color: "bg-green-500/20 text-green-400 border-green-500/30" },
  SLOW: { label: "Lento", color: "bg-blue-500/20 text-blue-400 border-blue-500/30" },
};

export default function BossCard({
  name,
  currentHp,
  maxHp,
  statusEffects,
  isHit = false,
}: BossCardProps) {
  const hpPercent = maxHp > 0 ? Math.max(0, Math.min(100, (currentHp / maxHp) * 100)) : 0;

  return (
    <div
      className={`relative w-full max-w-md mx-auto rounded-xl border-2 border-red-500 overflow-hidden ${
        isHit ? "animate-boss-shake" : ""
      }`}
      style={{
        background: "linear-gradient(to bottom, var(--bg-card), var(--bg-primary))",
      }}
    >
      {/* Status particles overlay */}
      {statusEffects.map((se) => (
        <StatusParticles key={se.status} status={se.status} />
      ))}

      <div className="p-4 space-y-3">
        {/* Boss name */}
        <h2
          className="text-xl font-bold text-red-400 text-center"
          style={{ fontFamily: "var(--font-cinzel)" }}
        >
          {name}
        </h2>

        {/* HP bar */}
        <div>
          <div className="w-full h-4 rounded-full bg-red-950/30 overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${hpPercent}%`,
                background: "linear-gradient(to right, #dc2626, #ef4444)",
              }}
            />
          </div>
          <p className="text-xs text-gray-400 mt-1 text-center">
            {currentHp} / {maxHp} HP
          </p>
        </div>

        {/* Status effects */}
        {statusEffects.length > 0 && (
          <div className="flex flex-wrap items-center justify-center gap-1">
            {statusEffects.map((effect) => {
              const config = STATUS_CONFIG[effect.status];
              const label = config?.label ?? effect.status;
              const color = config?.color ?? "bg-gray-500/20 text-gray-400 border-gray-500/30";

              return (
                <span
                  key={effect.status}
                  className={`text-[10px] rounded-full px-2 py-0.5 border animate-pulse ${color}`}
                >
                  {label} ({effect.remainingTurns})
                </span>
              );
            })}
          </div>
        )}
      </div>

      <style jsx>{`
        @keyframes bossShake {
          0%, 100% { transform: translateX(0); }
          20% { transform: translateX(-6px); }
          40% { transform: translateX(6px); }
          60% { transform: translateX(-4px); }
          80% { transform: translateX(4px); }
        }
        :global(.animate-boss-shake) {
          animation: bossShake 0.4s ease-in-out;
        }
      `}</style>
    </div>
  );
}
