"use client";

import type { CoopPveMobInfo } from "../page";
import MobPlaceholder from "../../battle/_components/MobPlaceholder";

type CoopPveMobRowProps = {
  mobs: CoopPveMobInfo[];
  targeting: boolean;
  onMobClick: (index: number) => void;
};

const TIER_COLORS: Record<number, string> = {
  1: "bg-gray-600 text-gray-200",
  2: "bg-emerald-700 text-emerald-100",
  3: "bg-blue-700 text-blue-100",
  4: "bg-purple-700 text-purple-100",
  5: "bg-amber-600 text-amber-100",
};

const STATUS_COLORS: Record<string, string> = {
  BURN: "bg-orange-600/80 text-orange-100",
  POISON: "bg-green-700/80 text-green-100",
  FROZEN: "bg-cyan-700/80 text-cyan-100",
  STUN: "bg-amber-600/80 text-amber-100",
  SLOW: "bg-indigo-700/80 text-indigo-100",
};

export default function CoopPveMobRow({ mobs, targeting, onMobClick }: CoopPveMobRowProps) {
  const isCompact = mobs.length > 3;

  return (
    <>
      <style>{`
        @keyframes coopMobPulse {
          0%, 100% { border-color: var(--accent-primary); box-shadow: 0 0 6px var(--accent-primary); }
          50% { border-color: var(--accent-secondary); box-shadow: 0 0 12px var(--accent-secondary); }
        }
        .coop-mob-targeting {
          animation: coopMobPulse 1.2s ease-in-out infinite;
        }
      `}</style>

      <div className={`flex justify-center gap-2 ${isCompact ? "gap-1.5" : "gap-3"}`}>
        {mobs.map((mob) => {
          const isDefeated = mob.defeated;
          const isTargetable = targeting && !isDefeated;
          const hpPercent = mob.maxHp > 0 ? (mob.hp / mob.maxHp) * 100 : 0;
          const hpColor =
            hpPercent > 50 ? "bg-emerald-500" : hpPercent > 25 ? "bg-yellow-500" : "bg-red-500";
          const tierBadge = TIER_COLORS[mob.tier] ?? TIER_COLORS[1];

          return (
            <div
              key={mob.playerId}
              onClick={() => {
                if (isTargetable) onMobClick(mob.index);
              }}
              className={`relative flex flex-col rounded-xl border overflow-hidden transition-all ${
                isCompact ? "w-28 md:w-32" : "w-36 md:w-44"
              } ${
                isDefeated
                  ? "opacity-40 grayscale pointer-events-none border-[var(--border-subtle)]"
                  : isTargetable
                  ? "coop-mob-targeting cursor-pointer hover:scale-105 border-[var(--accent-primary)]"
                  : "border-[var(--border-subtle)]"
              } bg-[var(--bg-card)]`}
            >
              {/* Mob image/placeholder */}
              {!isCompact ? (
                <div className="hidden md:block">
                  <MobPlaceholder name={mob.name} tier={mob.tier} imageUrl={mob.imageUrl} />
                </div>
              ) : (
                <div className="hidden md:block h-20 overflow-hidden rounded-t-lg">
                  <MobPlaceholder name={mob.name} tier={mob.tier} imageUrl={mob.imageUrl} />
                </div>
              )}

              {/* Info */}
              <div className="p-2 space-y-1.5">
                {/* Name + tier badge */}
                <div className="flex items-center justify-between gap-1">
                  <p className="text-xs font-semibold text-white truncate flex-1">
                    {mob.name}
                  </p>
                  <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold ${tierBadge}`}>
                    T{mob.tier}
                  </span>
                </div>

                {/* HP bar */}
                <div className="w-full h-2 rounded-full bg-gray-800 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${hpColor}`}
                    style={{ width: `${hpPercent}%` }}
                  />
                </div>
                <p className="text-[9px] text-gray-400 text-center">
                  {mob.hp}/{mob.maxHp}
                </p>

                {/* Status effects */}
                {mob.statusEffects.length > 0 && (
                  <div className="flex flex-wrap justify-center gap-0.5">
                    {mob.statusEffects.map((se, idx) => (
                      <span
                        key={`${se.status}-${idx}`}
                        className={`text-[8px] px-1 py-0.5 rounded animate-pulse ${
                          STATUS_COLORS[se.status] ?? "bg-gray-600 text-gray-200"
                        }`}
                      >
                        {se.status} {se.remainingTurns}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Defeated overlay */}
              {isDefeated && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                  <span className="text-xs font-bold text-red-400">Derrotado</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}
