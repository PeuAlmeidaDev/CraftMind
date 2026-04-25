"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import Image from "next/image";
import BattleLog from "../../battle/_components/BattleLog";
import SkillVfx from "../../battle/_components/SkillVfx";
import MultiMobCard from "./MultiMobCard";
import MultiSkillBar from "./MultiSkillBar";
import { getHouseAssets } from "@/lib/houses/house-assets";
import type { HouseName } from "@/types/house";
import type {
  TurnLogEntry,
  AvailableSkill,
  ActiveStatusEffect,
  MultiMobInfo,
  PlayerProfile,
} from "../page";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type MultiBattleArenaProps = {
  mobs: MultiMobInfo[];
  profile: PlayerProfile;
  playerId: string | null;
  playerHp: number;
  playerMaxHp: number;
  playerStatusEffects: ActiveStatusEffect[];
  events: TurnLogEntry[];
  skills: AvailableSkill[];
  onAction: (skillId: string | null, targetIndex?: number) => void;
  onForfeit: () => void;
  acting: boolean;
};

// ---------------------------------------------------------------------------
// Status effect config
// ---------------------------------------------------------------------------

const STATUS_COLORS: Record<string, { label: string; hex: string }> = {
  STUN: { label: "STUN", hex: "#e0c85c" },
  FROZEN: { label: "FROZEN", hex: "#67e8f9" },
  BURN: { label: "BURN", hex: "#ff8a70" },
  POISON: { label: "POISON", hex: "#7acf8a" },
  SLOW: { label: "SLOW", hex: "#60a5fa" },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function StatusBadges({ effects }: { effects: ActiveStatusEffect[] }) {
  if (effects.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-1">
      {effects.map((effect) => {
        const config = STATUS_COLORS[effect.status];
        const label = config?.label ?? effect.status;
        const hex = config?.hex ?? "#9ca3af";

        return (
          <span
            key={effect.status}
            className="flex items-center gap-[5px] px-[6px] py-[2px] uppercase"
            style={{
              fontFamily: "var(--font-jetbrains), monospace",
              fontSize: "9px",
              letterSpacing: "0.18em",
              color: hex,
              border: `1px solid color-mix(in srgb, ${hex} 40%, transparent)`,
              background: `color-mix(in srgb, ${hex} 8%, transparent)`,
            }}
          >
            <span
              className="rounded-full inline-block"
              style={{
                width: "4px",
                height: "4px",
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

function HpBar({
  current,
  max,
  showLabel = true,
}: {
  current: number;
  max: number;
  showLabel?: boolean;
}) {
  const percent = max > 0 ? Math.max(0, Math.min(100, (current / max) * 100)) : 0;
  const isLow = percent <= 25;

  return (
    <div>
      {showLabel && (
        <div
          className="flex items-center gap-[6px] mb-[3px]"
          style={{
            fontFamily: "var(--font-jetbrains), monospace",
            fontSize: "10px",
            letterSpacing: "0.18em",
          }}
        >
          <span style={{ color: "color-mix(in srgb, var(--gold) 80%, transparent)" }}>
            HP
          </span>
          <span style={{ color: "#7acf8a" }}>
            {current} / {max}
          </span>
        </div>
      )}
      <div
        className="relative w-full h-[6px] overflow-hidden"
        style={{
          border: "1px solid color-mix(in srgb, #10b981 27%, transparent)",
        }}
      >
        {/* mid-tick */}
        <span
          className="absolute top-0 h-full pointer-events-none"
          style={{
            left: "50%",
            width: "1px",
            background: "color-mix(in srgb, var(--gold) 13%, transparent)",
          }}
        />
        {/* fill */}
        <div
          className={isLow ? "animate-hp-low" : ""}
          style={{
            height: "100%",
            width: `${percent}%`,
            background: "linear-gradient(90deg, #10b981, #34d399)",
            boxShadow: "inset 0 0 4px color-mix(in srgb, #10b981 53%, transparent)",
            transition: "width 500ms cubic-bezier(.2,.8,.2,1)",
          }}
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Corner ticks helper
// ---------------------------------------------------------------------------

function CornerTicks() {
  const tickStyle = {
    position: "absolute" as const,
    width: "12px",
    height: "12px",
    pointerEvents: "none" as const,
  };
  const gold40 = "color-mix(in srgb, var(--gold) 40%, transparent)";

  return (
    <>
      <span
        style={{
          ...tickStyle,
          top: 0,
          left: 0,
          borderTop: `1px solid ${gold40}`,
          borderLeft: `1px solid ${gold40}`,
        }}
      />
      <span
        style={{
          ...tickStyle,
          top: 0,
          right: 0,
          borderTop: `1px solid ${gold40}`,
          borderRight: `1px solid ${gold40}`,
        }}
      />
      <span
        style={{
          ...tickStyle,
          bottom: 0,
          left: 0,
          borderBottom: `1px solid ${gold40}`,
          borderLeft: `1px solid ${gold40}`,
        }}
      />
      <span
        style={{
          ...tickStyle,
          bottom: 0,
          right: 0,
          borderBottom: `1px solid ${gold40}`,
          borderRight: `1px solid ${gold40}`,
        }}
      />
    </>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function MultiBattleArena({
  mobs,
  profile,
  playerId,
  playerHp,
  playerMaxHp,
  playerStatusEffects,
  events,
  skills,
  onAction,
  onForfeit,
  acting,
}: MultiBattleArenaProps) {
  const [targetingMode, setTargetingMode] = useState(false);
  const [pendingSkillId, setPendingSkillId] = useState<string | null>(null);
  const [shakingMobs, setShakingMobs] = useState<Set<number>>(new Set());
  const [playerShaking, setPlayerShaking] = useState(false);
  const prevEventsLength = useRef(events.length);

  // VFX queue: processes effects sequentially, one at a time
  type VfxQueueItem = { skillName: string; target: "player" | number };
  const [vfxQueue, setVfxQueue] = useState<VfxQueueItem[]>([]);
  const activeVfx = vfxQueue[0] ?? null;
  const handleVfxComplete = useCallback(() => {
    setVfxQueue(prev => prev.slice(1));
  }, []);

  // -------------------------------------------------------------------------
  // Detect new damage events and trigger shake
  // -------------------------------------------------------------------------

  useEffect(() => {
    if (events.length <= prevEventsLength.current) {
      prevEventsLength.current = events.length;
      return;
    }

    const newEntries = events.slice(prevEventsLength.current);
    prevEventsLength.current = events.length;

    const hitMobIndices = new Set<number>();
    let playerHit = false;
    const newVfx: VfxQueueItem[] = [];

    for (const entry of newEntries) {
      const hasDamage = entry.damage !== undefined && entry.damage > 0;
      const hasHealing = entry.healing !== undefined && entry.healing > 0;

      // Collect all VFX into the queue
      const hasEffect = hasDamage || hasHealing || !!entry.buffApplied || !!entry.debuffApplied || !!entry.statusApplied;
      if (entry.skillName && hasEffect) {
        if (entry.targetId === playerId) {
          newVfx.push({ skillName: entry.skillName, target: "player" });
        } else if (entry.targetId) {
          for (const mob of mobs) {
            if (entry.targetId === `mob-${mob.index}` || entry.targetId === String(mob.index) || entry.targetId === mob.playerId) {
              newVfx.push({ skillName: entry.skillName, target: mob.index });
              break;
            }
          }
        }
      }

      if (!hasDamage) continue;

      if (entry.targetId === playerId) {
        playerHit = true;
      } else {
        // Try to find which mob was hit by matching targetId with mob index
        for (const mob of mobs) {
          if (entry.targetId === `mob-${mob.index}` || entry.targetId === String(mob.index)) {
            hitMobIndices.add(mob.index);
          }
        }
        // If we have damage events that target non-player, assume mobs based on context
        if (hitMobIndices.size === 0 && entry.targetId && entry.targetId !== playerId) {
          // Fallback: mark all alive mobs that could be targets
          for (const mob of mobs) {
            if (!mob.defeated && entry.targetId?.includes(String(mob.index))) {
              hitMobIndices.add(mob.index);
            }
          }
        }
      }
    }

    // Deduplicate: one VFX per skillName+target combination
    const seen = new Set<string>();
    const uniqueVfx = newVfx.filter(v => {
      const key = `${v.skillName}:${v.target}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    if (uniqueVfx.length > 0) {
      setVfxQueue(prev => [...prev, ...uniqueVfx]);
    }

    if (hitMobIndices.size > 0) {
      setShakingMobs(hitMobIndices);
    }
    if (playerHit) {
      setPlayerShaking(true);
    }

    const timer = setTimeout(() => {
      setShakingMobs(new Set());
      setPlayerShaking(false);
    }, 600);

    return () => clearTimeout(timer);
  }, [events, playerId, mobs]);

  // -------------------------------------------------------------------------
  // Targeting logic
  // -------------------------------------------------------------------------

  const handleSkillSelect = useCallback(
    (skillId: string, target: string) => {
      if (target === "SINGLE_ENEMY") {
        setTargetingMode(true);
        setPendingSkillId(skillId);
      } else {
        onAction(skillId);
      }
    },
    [onAction]
  );

  const handleMobClick = useCallback(
    (mobIndex: number) => {
      if (!targetingMode || !pendingSkillId) return;
      onAction(pendingSkillId, mobIndex);
      setTargetingMode(false);
      setPendingSkillId(null);
    },
    [targetingMode, pendingSkillId, onAction]
  );

  const handleCancelTargeting = useCallback(() => {
    setTargetingMode(false);
    setPendingSkillId(null);
  }, []);

  const handleSkipTurn = useCallback(() => {
    onAction(null);
  }, [onAction]);

  // -------------------------------------------------------------------------
  // Name map for battle log (mob playerIds -> names)
  // -------------------------------------------------------------------------

  const nameMap = useMemo(() => {
    const map: Record<string, string> = {};
    for (const mob of mobs) {
      if (mob.playerId) {
        map[mob.playerId] = mob.name;
      }
    }
    return map;
  }, [mobs]);

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <div className="mx-auto max-w-5xl px-2 sm:px-4 py-3 sm:py-6">
      {/* ================================================================= */}
      {/* DESKTOP (md+)                                                     */}
      {/* ================================================================= */}
      <div className="hidden md:flex md:flex-col md:gap-4">
        {/* Mob row(s) */}
        {mobs.length <= 3 ? (
          <div className="flex gap-3 lg:gap-4 justify-center">
            {mobs.map((mob) => (
              <div key={mob.index} className="flex-1 max-w-[240px]">
                <MultiMobCard
                  mob={mob}
                  targeting={targetingMode}
                  onClick={() => handleMobClick(mob.index)}
                  shaking={shakingMobs.has(mob.index)}
                  compact={false}
                  vfxSkillName={activeVfx?.target === mob.index ? activeVfx.skillName : null}
                  vfxVisible={activeVfx?.target === mob.index}
                  onVfxComplete={handleVfxComplete}
                />
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col gap-2 lg:gap-3 items-center">
            <div className="flex gap-2 lg:gap-3 justify-center">
              {mobs.slice(0, 3).map((mob) => (
                <div key={mob.index} className="max-w-[180px] min-w-[140px] flex-1">
                  <MultiMobCard
                    mob={mob}
                    targeting={targetingMode}
                    onClick={() => handleMobClick(mob.index)}
                    shaking={shakingMobs.has(mob.index)}
                    compact
                    vfxSkillName={activeVfx?.target === mob.index ? activeVfx.skillName : null}
                    vfxVisible={activeVfx?.target === mob.index}
                    onVfxComplete={handleVfxComplete}
                  />
                </div>
              ))}
            </div>
            <div className="flex gap-2 lg:gap-3 justify-center">
              {mobs.slice(3).map((mob) => (
                <div key={mob.index} className="max-w-[180px] min-w-[140px] flex-1">
                  <MultiMobCard
                    mob={mob}
                    targeting={targetingMode}
                    onClick={() => handleMobClick(mob.index)}
                    shaking={shakingMobs.has(mob.index)}
                    compact
                    vfxSkillName={activeVfx?.target === mob.index ? activeVfx.skillName : null}
                    vfxVisible={activeVfx?.target === mob.index}
                    onVfxComplete={handleVfxComplete}
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Player HP section */}
        <div
          className={`relative overflow-hidden p-[18px] ${
            playerShaking ? "animate-shake" : ""
          }`}
          style={{
            background: "linear-gradient(180deg, var(--bg-card) 0%, var(--bg-primary) 100%)",
            border: "1px solid color-mix(in srgb, var(--gold) 13%, transparent)",
          }}
        >
          <CornerTicks />

          {profile.house && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none opacity-15">
              <Image
                src={getHouseAssets(profile.house.name as HouseName).bandeira}
                alt=""
                width={64}
                height={82}
                className="object-contain"
              />
            </div>
          )}

          <div className="relative flex items-center gap-3 mb-3">
            {profile.avatarUrl ? (
              <Image
                src={profile.avatarUrl}
                alt={profile.name}
                width={48}
                height={48}
                className="rounded-full object-cover"
                style={{
                  border: "1px solid color-mix(in srgb, var(--gold) 40%, transparent)",
                  width: "48px",
                  height: "48px",
                }}
              />
            ) : (
              <div
                className="rounded-full flex items-center justify-center"
                style={{
                  width: "48px",
                  height: "48px",
                  background: "color-mix(in srgb, var(--accent-primary) 20%, transparent)",
                  border: "1px solid color-mix(in srgb, var(--gold) 40%, transparent)",
                }}
              >
                <span
                  className="font-bold"
                  style={{
                    fontFamily: "var(--font-cormorant), serif",
                    fontSize: "20px",
                    color: "var(--accent-primary)",
                  }}
                >
                  {profile.name.charAt(0).toUpperCase()}
                </span>
              </div>
            )}
            <div className="flex flex-col">
              <span
                className="text-white truncate"
                style={{
                  fontFamily: "var(--font-cormorant), serif",
                  fontSize: "20px",
                }}
              >
                {profile.name}
              </span>
              {profile.house && (
                <span
                  className="uppercase"
                  style={{
                    fontFamily: "var(--font-cinzel), serif",
                    fontSize: "9px",
                    letterSpacing: "0.3em",
                    color: "color-mix(in srgb, var(--gold) 80%, transparent)",
                  }}
                >
                  {profile.house.name}
                </span>
              )}
            </div>
          </div>

          <div className="relative">
            <HpBar current={playerHp} max={playerMaxHp} />
            <div className="mt-2">
              <StatusBadges effects={playerStatusEffects} />
            </div>
          </div>

          <SkillVfx
            skillName={activeVfx?.target === "player" ? activeVfx.skillName : null}
            visible={activeVfx?.target === "player" || false}
            onComplete={handleVfxComplete}
          />
        </div>

        {/* Skills + Log row */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <MultiSkillBar
              skills={skills}
              onSkillSelect={handleSkillSelect}
              onSkipTurn={handleSkipTurn}
              disabled={acting}
              targetingMode={targetingMode}
              pendingSkillId={pendingSkillId}
            />
            {targetingMode && (
              <button
                type="button"
                onClick={handleCancelTargeting}
                className="mt-2 w-full py-2 cursor-pointer transition-colors uppercase hover:opacity-80"
                style={{
                  fontFamily: "var(--font-cinzel), serif",
                  fontSize: "10px",
                  letterSpacing: "0.2em",
                  color: "#d96a52",
                  border: "1px solid #d96a5244",
                  background: "transparent",
                }}
              >
                Cancelar selecao de alvo
              </button>
            )}
            <button
              type="button"
              onClick={onForfeit}
              disabled={acting}
              className="mt-2 w-full py-2 cursor-pointer transition-colors disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-80"
              style={{
                fontFamily: "var(--font-garamond), serif",
                fontStyle: "italic",
                fontSize: "12px",
                color: "#d96a52",
                textDecoration: "underline",
                textDecorationColor: "#d96a5244",
                background: "transparent",
                border: "none",
              }}
            >
              Desistir da batalha
            </button>
          </div>
          <BattleLog events={events} playerId={playerId ?? undefined} playerName={profile.name} nameMap={nameMap} />
        </div>
      </div>

      {/* ================================================================= */}
      {/* MOBILE (<md)                                                      */}
      {/* ================================================================= */}
      <div className="flex flex-col gap-2 sm:gap-3 md:hidden">
        {/* Mob row(s) - compact */}
        {mobs.length <= 3 ? (
          <div className="flex gap-1.5 sm:gap-2">
            {mobs.map((mob) => (
              <div key={mob.index} className="flex-1 min-w-0">
                <MultiMobCard
                  mob={mob}
                  targeting={targetingMode}
                  onClick={() => handleMobClick(mob.index)}
                  shaking={shakingMobs.has(mob.index)}
                  compact
                />
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col gap-1.5 sm:gap-2 items-center">
            <div className="flex gap-1.5 sm:gap-2 justify-center w-full">
              {mobs.slice(0, 3).map((mob) => (
                <div key={mob.index} className="flex-1 min-w-0">
                  <MultiMobCard
                    mob={mob}
                    targeting={targetingMode}
                    onClick={() => handleMobClick(mob.index)}
                    shaking={shakingMobs.has(mob.index)}
                    compact
                    vfxSkillName={activeVfx?.target === mob.index ? activeVfx.skillName : null}
                    vfxVisible={activeVfx?.target === mob.index}
                    onVfxComplete={handleVfxComplete}
                  />
                </div>
              ))}
            </div>
            <div className="flex gap-1.5 sm:gap-2 justify-center w-full max-w-[66%]">
              {mobs.slice(3).map((mob) => (
                <div key={mob.index} className="flex-1 min-w-0">
                  <MultiMobCard
                    mob={mob}
                    targeting={targetingMode}
                    onClick={() => handleMobClick(mob.index)}
                    shaking={shakingMobs.has(mob.index)}
                    compact
                    vfxSkillName={activeVfx?.target === mob.index ? activeVfx.skillName : null}
                    vfxVisible={activeVfx?.target === mob.index}
                    onVfxComplete={handleVfxComplete}
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Player HP */}
        <div
          className={`relative overflow-hidden p-[10px] ${
            playerShaking ? "animate-shake" : ""
          }`}
          style={{
            background: "var(--bg-card)",
            border: "1px solid color-mix(in srgb, var(--gold) 13%, transparent)",
          }}
        >
          {profile.house && (
            <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none opacity-15">
              <Image
                src={getHouseAssets(profile.house.name as HouseName).bandeira}
                alt=""
                width={44}
                height={56}
                className="object-contain"
              />
            </div>
          )}
          <div className="relative flex items-center gap-2 mb-1">
            {profile.avatarUrl ? (
              <Image
                src={profile.avatarUrl}
                alt={profile.name}
                width={36}
                height={36}
                className="rounded-full object-cover"
                style={{
                  border: "1px solid color-mix(in srgb, var(--gold) 40%, transparent)",
                  width: "36px",
                  height: "36px",
                }}
              />
            ) : (
              <div
                className="rounded-full flex items-center justify-center"
                style={{
                  width: "36px",
                  height: "36px",
                  background: "color-mix(in srgb, var(--accent-primary) 20%, transparent)",
                  border: "1px solid color-mix(in srgb, var(--gold) 40%, transparent)",
                }}
              >
                <span
                  className="font-bold"
                  style={{
                    fontFamily: "var(--font-cormorant), serif",
                    fontSize: "14px",
                    color: "var(--accent-primary)",
                  }}
                >
                  {profile.name.charAt(0).toUpperCase()}
                </span>
              </div>
            )}
            <span
              className="text-white truncate"
              style={{
                fontFamily: "var(--font-cormorant), serif",
                fontSize: "16px",
              }}
            >
              {profile.name}
            </span>
          </div>
          <div className="relative">
            <HpBar current={playerHp} max={playerMaxHp} showLabel={false} />
            <div className="mt-1">
              <StatusBadges effects={playerStatusEffects} />
            </div>
          </div>
          <SkillVfx
            skillName={activeVfx?.target === "player" ? activeVfx.skillName : null}
            visible={activeVfx?.target === "player" || false}
            onComplete={handleVfxComplete}
          />
        </div>

        {/* Skills */}
        <div>
          <MultiSkillBar
            skills={skills}
            onSkillSelect={handleSkillSelect}
            onSkipTurn={handleSkipTurn}
            disabled={acting}
            targetingMode={targetingMode}
            pendingSkillId={pendingSkillId}
          />
          {targetingMode && (
            <button
              type="button"
              onClick={handleCancelTargeting}
              className="mt-2 w-full py-2 cursor-pointer transition-colors uppercase hover:opacity-80"
              style={{
                fontFamily: "var(--font-cinzel), serif",
                fontSize: "10px",
                letterSpacing: "0.2em",
                color: "#d96a52",
                border: "1px solid #d96a5244",
                background: "transparent",
              }}
            >
              Cancelar selecao de alvo
            </button>
          )}
          <button
            type="button"
            onClick={onForfeit}
            disabled={acting}
            className="mt-2 w-full py-2 cursor-pointer transition-colors disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-80"
            style={{
              fontFamily: "var(--font-garamond), serif",
              fontStyle: "italic",
              fontSize: "12px",
              color: "#d96a52",
              textDecoration: "underline",
              textDecorationColor: "#d96a5244",
              background: "transparent",
              border: "none",
            }}
          >
            Desistir da batalha
          </button>
        </div>

        {/* Battle Log */}
        <BattleLog events={events} playerId={playerId ?? undefined} playerName={profile.name} nameMap={nameMap} />
      </div>

      {/* Animations */}
      <style jsx>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          20% { transform: translateX(-6px); }
          40% { transform: translateX(6px); }
          60% { transform: translateX(-4px); }
          80% { transform: translateX(4px); }
        }
        :global(.animate-shake) {
          animation: shake 0.4s ease-in-out;
        }
        @keyframes hpLowPulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        :global(.animate-hp-low) {
          animation: hpLowPulse 0.9s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}
