"use client";

import Image from "next/image";
import MobPlaceholder from "../../battle/_components/MobPlaceholder";
import SkillVfx from "../../battle/_components/SkillVfx";
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
  vfxSkillName?: string | null;
  vfxVisible?: boolean;
  onVfxComplete?: () => void;
};

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STATUS_CONFIG: Record<string, { label: string; hex: string }> = {
  STUN: { label: "Atordoado", hex: "#e0c85c" },
  FROZEN: { label: "Congelado", hex: "#67e8f9" },
  BURN: { label: "Queimando", hex: "#ff8a70" },
  POISON: { label: "Envenenado", hex: "#7acf8a" },
  SLOW: { label: "Lento", hex: "#60a5fa" },
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
        const hex = config?.hex ?? "#9ca3af";

        return (
          <span
            key={effect.status}
            className="flex items-center gap-[3px] uppercase"
            style={{
              fontFamily: "var(--font-jetbrains)",
              fontSize: 8,
              letterSpacing: "0.18em",
              padding: "1px 5px",
              border: `1px solid color-mix(in srgb, ${hex} 40%, transparent)`,
              background: `color-mix(in srgb, ${hex} 8%, transparent)`,
              color: hex,
            }}
          >
            <span
              className="rounded-full shrink-0"
              style={{
                width: 4,
                height: 4,
                background: hex,
                boxShadow: `0 0 4px ${hex}`,
              }}
            />
            {label} {effect.remainingTurns}t
          </span>
        );
      })}
    </div>
  );
}

function MobHpBar({ current, max }: { current: number; max: number }) {
  const percent = max > 0 ? Math.max(0, Math.min(100, (current / max) * 100)) : 0;

  return (
    <div className="w-full">
      <div
        className="w-full h-[4px] overflow-hidden relative"
        style={{
          border: "1px solid color-mix(in srgb, #b82b24 27%, transparent)",
        }}
      >
        <div
          className="h-full relative"
          style={{
            width: `${percent}%`,
            background: "linear-gradient(90deg, #b82b24, #ff6a52)",
            boxShadow: "inset 0 0 4px color-mix(in srgb, #b82b24 53%, transparent)",
            transition: "width 500ms cubic-bezier(.2,.8,.2,1)",
          }}
        />
        {/* Mid-tick */}
        <span
          className="absolute top-0 bottom-0"
          style={{
            left: "50%",
            width: 1,
            background: "color-mix(in srgb, var(--gold) 13%, transparent)",
          }}
        />
      </div>
      <p
        className="text-center"
        style={{
          fontFamily: "var(--font-jetbrains)",
          fontSize: 8,
          letterSpacing: "0.12em",
          color: "color-mix(in srgb, var(--gold) 60%, transparent)",
          marginTop: 3,
        }}
      >
        {current}/{max}
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
      <div
        className="w-6 h-6 sm:w-8 sm:h-8 rounded-full overflow-hidden relative shrink-0"
        style={{
          background: "var(--bg-secondary)",
          border: "1px solid color-mix(in srgb, #b82b24 40%, transparent)",
        }}
      >
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
    <div
      className="w-6 h-6 sm:w-8 sm:h-8 rounded-full flex items-center justify-center shrink-0"
      style={{
        background: "var(--bg-secondary)",
        border: "1px solid color-mix(in srgb, #b82b24 40%, transparent)",
      }}
    >
      <span className="text-[10px] sm:text-xs text-white/30">
        {mob.name.charAt(0).toUpperCase()}
      </span>
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
  vfxSkillName = null,
  vfxVisible = false,
  onVfxComplete,
}: MultiMobCardProps) {
  const isTargetable = targeting && !mob.defeated;

  // Defeated state
  if (mob.defeated) {
    return (
      <div
        className={`relative overflow-hidden pointer-events-none ${
          compact ? "p-[12px_10px]" : ""
        }`}
        style={{
          background: "linear-gradient(180deg, var(--bg-card) 0%, var(--bg-primary) 100%)",
          border: "1px solid color-mix(in srgb, #b82b24 20%, transparent)",
          opacity: 0.35,
          filter: "grayscale(1)",
        }}
      >
        {!compact && <MobPlaceholder name={mob.name} tier={mob.tier} imageUrl={mob.imageUrl} />}
        <div
          className={
            compact
              ? "flex items-center gap-2"
              : "flex flex-col gap-[8px] items-center p-[12px_10px]"
          }
        >
          {compact && <CompactMobThumb mob={mob} />}
          <div className={compact ? "flex-1 min-w-0" : "w-full"}>
            <div className="flex items-center gap-1 justify-center">
              <span
                className="text-white truncate"
                style={{
                  fontFamily: "var(--font-cormorant)",
                  fontSize: compact ? 13 : 15,
                }}
              >
                {mob.name}
              </span>
              <span
                className="shrink-0"
                style={{
                  fontFamily: "var(--font-jetbrains)",
                  fontSize: 8,
                  letterSpacing: "0.18em",
                  color: "#ff8a70",
                }}
              >
                T{mob.tier}
              </span>
            </div>
            <MobHpBar current={0} max={mob.maxHp} />
          </div>
        </div>
        {/* Defeated overlay */}
        <div className="absolute inset-0 flex items-center justify-center bg-black/40">
          <span
            style={{
              fontFamily: "var(--font-cormorant)",
              fontSize: 36,
              color: "color-mix(in srgb, var(--gold) 67%, transparent)",
            }}
          >
            &#x2020;
          </span>
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
      className={`relative overflow-hidden ${shaking ? "animate-mob-shake" : ""} ${
        isTargetable ? "cursor-pointer animate-pulse-border" : ""
      }`}
      style={{
        background: "linear-gradient(180deg, var(--bg-card) 0%, var(--bg-primary) 100%)",
        border: isTargetable
          ? "1px solid var(--ember)"
          : "1px solid color-mix(in srgb, #b82b24 20%, transparent)",
        transform: isTargetable ? "translateY(-2px)" : "none",
        boxShadow: isTargetable
          ? "0 0 18px color-mix(in srgb, var(--ember) 27%, transparent)"
          : "none",
        transition: "all 180ms",
      }}
    >
      {/* ALVO badge */}
      {isTargetable && (
        <span
          style={{
            position: "absolute",
            top: -8,
            left: "50%",
            transform: "translateX(-50%)",
            fontFamily: "var(--font-cinzel)",
            fontSize: 8,
            letterSpacing: "0.3em",
            color: "var(--ember)",
            padding: "2px 6px",
            background: "var(--bg-primary)",
            border: "1px solid var(--ember)",
            zIndex: 10,
          }}
        >
          ALVO
        </span>
      )}

      {!compact && <MobPlaceholder name={mob.name} tier={mob.tier} imageUrl={mob.imageUrl} />}

      <div
        className={
          compact
            ? "flex items-center gap-2 p-[12px_10px]"
            : "flex flex-col gap-[8px] items-center p-[12px_10px]"
        }
      >
        {compact && <CompactMobThumb mob={mob} />}
        <div className={compact ? "flex-1 min-w-0" : "w-full"}>
          <div className="flex items-center gap-1 justify-center">
            <span
              className="text-white truncate"
              style={{
                fontFamily: "var(--font-cormorant)",
                fontSize: compact ? 13 : 15,
              }}
            >
              {mob.name}
            </span>
            <span
              className="shrink-0"
              style={{
                fontFamily: "var(--font-jetbrains)",
                fontSize: 8,
                letterSpacing: "0.18em",
                color: "#ff8a70",
              }}
            >
              T{mob.tier}
            </span>
          </div>
          <MobHpBar current={mob.hp} max={mob.maxHp} />
          <MobStatusBadges effects={mob.statusEffects} />
        </div>
      </div>

      {/* Skill VFX overlay */}
      {onVfxComplete && (
        <SkillVfx
          skillName={vfxSkillName ?? null}
          visible={vfxVisible}
          onComplete={onVfxComplete}
        />
      )}

      {/* Targeting indicator */}
      {isTargetable && (
        <div className="absolute top-2 right-2">
          <span
            className="block animate-target-pulse"
            style={{
              width: 8,
              height: 8,
              background: "var(--ember)",
              boxShadow: "0 0 6px var(--ember)",
            }}
          />
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
          0%, 100% { border-color: var(--ember); }
          50% { border-color: var(--accent-primary); }
        }
        @keyframes targetPulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
        :global(.animate-mob-shake) {
          animation: mobShake 0.4s ease-in-out;
        }
        :global(.animate-pulse-border) {
          animation: pulseBorder 1.2s ease-in-out infinite;
        }
        :global(.animate-target-pulse) {
          animation: targetPulse 1.2s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}
