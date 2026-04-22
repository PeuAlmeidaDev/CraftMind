"use client";

import Image from "next/image";
import MobPlaceholder from "../../battle/_components/MobPlaceholder";
import type { MultiMobInfo, ActiveStatusEffect } from "../page";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type MultiMobCardProps = {
  mob: MultiMobInfo;
  targeting: boolean;
  onClick: () => void;
  shaking: boolean;
  compact?: boolean;
};

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TIER_BADGE_COLORS: Record<number, string> = {
  1: "bg-gray-500/20 text-gray-400 border-gray-500/30",
  2: "bg-green-500/20 text-green-400 border-green-500/30",
  3: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  4: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  5: "bg-amber-500/20 text-amber-400 border-amber-500/30",
};

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  STUN: { label: "Atordoado", color: "bg-amber-500/20 text-amber-400 border-amber-500/30" },
  FROZEN: { label: "Congelado", color: "bg-cyan-500/20 text-cyan-400 border-cyan-500/30" },
  BURN: { label: "Queimando", color: "bg-orange-500/20 text-orange-400 border-orange-500/30" },
  POISON: { label: "Envenenado", color: "bg-green-500/20 text-green-400 border-green-500/30" },
  SLOW: { label: "Lento", color: "bg-blue-500/20 text-blue-400 border-blue-500/30" },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function MobStatusBadges({ effects }: { effects: ActiveStatusEffect[] }) {
  if (effects.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1 mt-1">
      {effects.map((effect) => {
        const config = STATUS_CONFIG[effect.status];
        const label = config?.label ?? effect.status;
        const color = config?.color ?? "bg-gray-500/20 text-gray-400 border-gray-500/30";

        return (
          <span
            key={effect.status}
            className={`text-[9px] rounded-full px-1.5 py-0.5 border ${color}`}
          >
            {label} ({effect.remainingTurns})
          </span>
        );
      })}
    </div>
  );
}

function MobHpBar({ current, max }: { current: number; max: number }) {
  const percent = max > 0 ? Math.max(0, Math.min(100, (current / max) * 100)) : 0;

  return (
    <div>
      <div className="w-full h-2 sm:h-2.5 rounded-full bg-red-950/30 overflow-hidden">
        <div
          className="h-full rounded-full bg-red-500 transition-all duration-500"
          style={{ width: `${percent}%` }}
        />
      </div>
      <p className="text-[9px] sm:text-[10px] text-gray-500 mt-0.5">
        HP: {current} / {max}
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Compact thumbnail helper
// ---------------------------------------------------------------------------

function CompactMobThumb({ mob }: { mob: MultiMobInfo }) {
  if (mob.imageUrl) {
    return (
      <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-[var(--bg-secondary)] overflow-hidden relative shrink-0">
        <Image
          src={mob.imageUrl}
          alt={mob.name}
          width={32}
          height={32}
          className="object-cover w-full h-full"
        />
      </div>
    );
  }

  return (
    <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-[var(--bg-secondary)] flex items-center justify-center shrink-0">
      <span className="text-[10px] sm:text-xs text-white/30">{mob.name.charAt(0).toUpperCase()}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function MultiMobCard({
  mob,
  targeting,
  onClick,
  shaking,
  compact = false,
}: MultiMobCardProps) {
  const isTargetable = targeting && !mob.defeated;
  const tierBadge = TIER_BADGE_COLORS[mob.tier] ?? TIER_BADGE_COLORS[1];

  // Defeated state
  if (mob.defeated) {
    return (
      <div
        className={`relative rounded-xl border border-[var(--border-subtle)] overflow-hidden opacity-40 grayscale pointer-events-none ${
          compact ? "p-1.5 sm:p-2" : ""
        }`}
        style={{ background: "var(--bg-card)" }}
      >
        {!compact && <MobPlaceholder name={mob.name} tier={mob.tier} imageUrl={mob.imageUrl} />}
        <div className={compact ? "flex items-center gap-2" : "p-3"}>
          {compact && <CompactMobThumb mob={mob} />}
          <div className={compact ? "flex-1 min-w-0" : ""}>
            <div className="flex items-center gap-1">
              <span className={`font-semibold text-white truncate ${compact ? "text-[11px] sm:text-xs" : "text-sm"}`}>
                {mob.name}
              </span>
              <span className={`font-semibold rounded-full py-0.5 border shrink-0 ${compact ? "text-[8px] sm:text-[9px] px-1 sm:px-1.5" : "text-[9px] px-1.5"} ${tierBadge}`}>
                T{mob.tier}
              </span>
            </div>
            <MobHpBar current={0} max={mob.maxHp} />
          </div>
        </div>
        {/* Defeated overlay */}
        <div className="absolute inset-0 flex items-center justify-center bg-black/40">
          <span className="text-2xl">&#128128;</span>
        </div>
      </div>
    );
  }

  // Normal / targeting state
  return (
    <div
      role={isTargetable ? "button" : undefined}
      tabIndex={isTargetable ? 0 : undefined}
      onClick={isTargetable ? onClick : undefined}
      onKeyDown={
        isTargetable
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") onClick();
            }
          : undefined
      }
      className={`relative rounded-xl border overflow-hidden transition-all duration-200 ${
        shaking ? "animate-mob-shake" : ""
      } ${
        isTargetable
          ? "border-[var(--accent-secondary)] cursor-pointer hover:shadow-[0_0_12px_var(--accent-secondary)] animate-pulse-border"
          : "border-[var(--border-subtle)]"
      } ${compact ? "p-1.5 sm:p-2" : ""}`}
      style={{ background: "var(--bg-card)" }}
    >
      {!compact && <MobPlaceholder name={mob.name} tier={mob.tier} imageUrl={mob.imageUrl} />}

      <div className={compact ? "flex items-center gap-2" : "p-3"}>
        {compact && <CompactMobThumb mob={mob} />}
        <div className={compact ? "flex-1 min-w-0" : ""}>
          <div className="flex items-center gap-1">
            <span className={`font-semibold text-white truncate ${compact ? "text-[11px] sm:text-xs" : "text-sm"}`}>
              {mob.name}
            </span>
            <span className={`font-semibold rounded-full py-0.5 border shrink-0 ${compact ? "text-[8px] sm:text-[9px] px-1 sm:px-1.5" : "text-[9px] px-1.5"} ${tierBadge}`}>
              T{mob.tier}
            </span>
          </div>
          <MobHpBar current={mob.hp} max={mob.maxHp} />
          <MobStatusBadges effects={mob.statusEffects} />
        </div>
      </div>

      {/* Targeting indicator */}
      {isTargetable && (
        <div className="absolute top-2 right-2">
          <span className="text-xs text-[var(--accent-secondary)] animate-pulse">&#127919;</span>
        </div>
      )}

      <style jsx>{`
        @keyframes mobShake {
          0%, 100% { transform: translateX(0); }
          20% { transform: translateX(-4px); }
          40% { transform: translateX(4px); }
          60% { transform: translateX(-3px); }
          80% { transform: translateX(3px); }
        }
        @keyframes pulseBorder {
          0%, 100% { border-color: var(--accent-secondary); }
          50% { border-color: var(--accent-primary); }
        }
        :global(.animate-mob-shake) {
          animation: mobShake 0.4s ease-in-out;
        }
        :global(.animate-pulse-border) {
          animation: pulseBorder 1.2s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}
