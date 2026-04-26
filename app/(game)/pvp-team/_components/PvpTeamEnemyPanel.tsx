"use client";

import Image from "next/image";
import SkillVfx from "../../battle/_components/SkillVfx";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type EnemyInfo = {
  playerId: string;
  name: string;
  currentHp: number;
  maxHp: number;
  statusEffects: { status: string; remainingTurns: number }[];
  isAlive: boolean;
  avatarUrl: string | null;
  houseName: string;
  index: number;
};

type PvpTeamEnemyPanelProps = {
  enemies: EnemyInfo[];
  targeting: boolean;
  onEnemyClick: (index: number) => void;
  vfxTarget?: number | null;
  vfxSkillName?: string | null;
  onVfxComplete?: () => void;
  disconnectedPlayers: Set<string>;
  autoSkipPlayers: Set<string>;
};

// ---------------------------------------------------------------------------
// Constants (same as CoopPveMobRow / CoopPveTeamPanel)
// ---------------------------------------------------------------------------

const HOUSE_COLORS: Record<string, string> = {
  NOCTIS: "bg-indigo-800/60 text-indigo-200",
  LYCUS: "bg-cyan-800/60 text-cyan-200",
  IGNIS: "bg-red-800/60 text-red-200",
  SOLARA: "bg-amber-800/60 text-amber-200",
};

const STATUS_COLORS: Record<string, string> = {
  BURN: "bg-orange-600/80 text-orange-100",
  POISON: "bg-green-700/80 text-green-100",
  FROZEN: "bg-cyan-700/80 text-cyan-100",
  STUN: "bg-amber-600/80 text-amber-100",
  SLOW: "bg-indigo-700/80 text-indigo-100",
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function PvpTeamEnemyPanel({
  enemies,
  targeting,
  onEnemyClick,
  vfxTarget = null,
  vfxSkillName = null,
  onVfxComplete,
  disconnectedPlayers,
  autoSkipPlayers,
}: PvpTeamEnemyPanelProps) {
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

      <div className="flex justify-start sm:justify-center overflow-x-auto pb-2 snap-x snap-mandatory scrollbar-hide gap-2 sm:gap-3">
        {enemies.map((enemy) => {
          const isDead = !enemy.isAlive;
          const isTargetable = targeting && !isDead;
          const hpPercent = enemy.maxHp > 0 ? (enemy.currentHp / enemy.maxHp) * 100 : 0;
          const hpColor =
            hpPercent > 50 ? "bg-emerald-500" : hpPercent > 25 ? "bg-yellow-500" : "bg-red-500";
          const houseBadge = HOUSE_COLORS[enemy.houseName] ?? "bg-gray-700/60 text-gray-300";
          const isDisconnected = disconnectedPlayers.has(enemy.playerId);
          const isAutoSkip = autoSkipPlayers.has(enemy.playerId);

          return (
            <div
              key={enemy.playerId}
              onClick={() => {
                if (isTargetable) onEnemyClick(enemy.index);
              }}
              className={`relative flex flex-col rounded-xl border overflow-hidden transition-all snap-center shrink-0 w-24 sm:w-36 md:w-44 ${
                isDead
                  ? "opacity-40 grayscale pointer-events-none border-[var(--border-subtle)]"
                  : isTargetable
                  ? "coop-mob-targeting cursor-pointer hover:scale-105 border-[var(--accent-primary)]"
                  : "border-[var(--border-subtle)]"
              } bg-[var(--bg-card)]`}
            >
              {/* Avatar area (like mob image area) */}
              <div className="hidden md:flex items-center justify-center h-24 bg-[var(--bg-primary)] border-b border-[var(--border-subtle)]">
                {enemy.avatarUrl ? (
                  <Image
                    src={enemy.avatarUrl}
                    alt={enemy.name}
                    width={64}
                    height={64}
                    className="object-cover w-16 h-16 rounded-full border border-[var(--border-subtle)]"
                  />
                ) : (
                  <div className="w-16 h-16 rounded-full bg-[var(--bg-card)] border border-[var(--border-subtle)] flex items-center justify-center">
                    <span className="text-xl font-bold text-gray-400">
                      {enemy.name.charAt(0).toUpperCase()}
                    </span>
                  </div>
                )}
              </div>

              {/* Info */}
              <div className="p-1.5 sm:p-2 space-y-1.5">
                {/* Name + house badge (like name + tier in CoopPveMobRow) */}
                <div className="flex items-center justify-between gap-1">
                  <p className="text-xs font-semibold text-white truncate flex-1">
                    {enemy.name}
                  </p>
                  <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold ${houseBadge}`}>
                    {enemy.houseName}
                  </span>
                </div>

                {/* Disconnected / Auto-skip badges */}
                {(isDisconnected || isAutoSkip) && (
                  <div className="flex flex-wrap gap-0.5">
                    {isDisconnected && (
                      <span className="text-[8px] px-1 py-0.5 rounded bg-orange-600/80 text-orange-100 font-semibold">
                        OFFLINE
                      </span>
                    )}
                    {isAutoSkip && !isDisconnected && (
                      <span className="text-[8px] px-1 py-0.5 rounded bg-gray-600/80 text-gray-200 font-semibold">
                        AUTO-SKIP
                      </span>
                    )}
                  </div>
                )}

                {/* HP bar (identical to CoopPveMobRow) */}
                <div className="w-full h-2 rounded-full bg-gray-800 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${hpColor}`}
                    style={{ width: `${hpPercent}%` }}
                  />
                </div>
                <p className="text-[9px] text-gray-400 text-center">
                  {enemy.currentHp}/{enemy.maxHp}
                </p>

                {/* Status effects (identical to CoopPveMobRow) */}
                {enemy.statusEffects.length > 0 && (
                  <div className="flex flex-wrap justify-center gap-0.5">
                    {enemy.statusEffects.map((se, idx) => (
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

              {/* Skill VFX overlay (identical to CoopPveMobRow) */}
              {onVfxComplete && (
                <SkillVfx
                  skillName={vfxTarget === enemy.index ? vfxSkillName : null}
                  visible={vfxTarget === enemy.index}
                  onComplete={onVfxComplete}
                />
              )}

              {/* Dead overlay (like "Derrotado" in CoopPveMobRow) */}
              {isDead && (
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
