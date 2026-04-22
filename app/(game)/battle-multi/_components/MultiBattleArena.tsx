"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import Image from "next/image";
import BattleLog from "../../battle/_components/BattleLog";
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
  acting: boolean;
};

// ---------------------------------------------------------------------------
// Status effect config
// ---------------------------------------------------------------------------

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

function StatusBadges({ effects }: { effects: ActiveStatusEffect[] }) {
  if (effects.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-1">
      {effects.map((effect) => {
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
  );
}

function HpBar({ current, max }: { current: number; max: number }) {
  const percent = max > 0 ? Math.max(0, Math.min(100, (current / max) * 100)) : 0;

  let barColor = "bg-emerald-500";
  if (percent <= 25) barColor = "bg-red-500";
  else if (percent <= 50) barColor = "bg-yellow-500";

  return (
    <div>
      <div className="w-full h-3 rounded-full bg-emerald-950/30 overflow-hidden">
        <div
          className={`h-full rounded-full ${barColor} transition-all duration-500`}
          style={{ width: `${percent}%` }}
        />
      </div>
      <p className="text-xs text-gray-500 mt-1">
        HP: {current} / {max}
      </p>
    </div>
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
  acting,
}: MultiBattleArenaProps) {
  const [targetingMode, setTargetingMode] = useState(false);
  const [pendingSkillId, setPendingSkillId] = useState<string | null>(null);
  const [shakingMobs, setShakingMobs] = useState<Set<number>>(new Set());
  const [playerShaking, setPlayerShaking] = useState(false);
  const prevEventsLength = useRef(events.length);

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

    for (const entry of newEntries) {
      const hasDamage = entry.damage !== undefined && entry.damage > 0;
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
  // Name map for battle log (mob playerIds → names)
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
        {/* Mob row */}
        <div className={`flex gap-3 lg:gap-4 justify-center flex-wrap ${mobs.length > 3 ? "gap-2" : ""}`}>
          {mobs.map((mob) => (
            <div key={mob.index} className={`flex-1 ${mobs.length > 3 ? "max-w-[180px] min-w-[140px]" : "max-w-[240px]"}`}>
              <MultiMobCard
                mob={mob}
                targeting={targetingMode}
                onClick={() => handleMobClick(mob.index)}
                shaking={shakingMobs.has(mob.index)}
                compact={mobs.length > 3}
              />
            </div>
          ))}
        </div>

        {/* Player HP section */}
        <div
          className={`relative overflow-hidden rounded-xl border border-[var(--border-subtle)] p-4 ${
            playerShaking ? "animate-shake" : ""
          }`}
          style={{ background: "linear-gradient(to bottom, var(--bg-card), var(--bg-primary))" }}
        >
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
          <div className="relative flex items-center gap-3 mb-2">
            {profile.avatarUrl ? (
              <Image
                src={profile.avatarUrl}
                alt={profile.name}
                width={36}
                height={36}
                className="rounded-full border border-[var(--border-subtle)] object-cover"
              />
            ) : (
              <div className="w-9 h-9 rounded-full bg-[var(--accent-primary)]/20 border border-[var(--border-subtle)] flex items-center justify-center">
                <span className="text-sm font-bold text-[var(--accent-primary)]">
                  {profile.name.charAt(0).toUpperCase()}
                </span>
              </div>
            )}
            <span className="text-sm font-semibold text-white">{profile.name}</span>
            {profile.house && (
              <span className="text-[10px] text-gray-500 uppercase" style={{ fontFamily: "var(--font-cinzel), serif" }}>
                {profile.house.name}
              </span>
            )}
          </div>
          <div className="relative">
            <HpBar current={playerHp} max={playerMaxHp} />
            <div className="mt-2">
              <StatusBadges effects={playerStatusEffects} />
            </div>
          </div>
        </div>

        {/* Skills + Log row */}
        <div className="grid grid-cols-2 gap-3 lg:gap-4">
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
                className="mt-2 w-full py-2 text-xs text-red-400 hover:text-red-300 cursor-pointer transition-colors"
              >
                Cancelar selecao de alvo
              </button>
            )}
          </div>
          <BattleLog events={events} playerId={playerId ?? undefined} playerName={profile.name} nameMap={nameMap} />
        </div>
      </div>

      {/* ================================================================= */}
      {/* MOBILE (<md)                                                      */}
      {/* ================================================================= */}
      <div className="flex flex-col gap-2 sm:gap-3 md:hidden">
        {/* Mob row - compact */}
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

        {/* Player HP */}
        <div
          className={`relative overflow-hidden rounded-lg border border-[var(--border-subtle)] p-2 sm:p-3 ${
            playerShaking ? "animate-shake" : ""
          }`}
          style={{ background: "var(--bg-card)" }}
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
                width={28}
                height={28}
                className="rounded-full border border-[var(--border-subtle)] object-cover"
              />
            ) : (
              <div className="w-7 h-7 rounded-full bg-[var(--accent-primary)]/20 border border-[var(--border-subtle)] flex items-center justify-center">
                <span className="text-xs font-bold text-[var(--accent-primary)]">
                  {profile.name.charAt(0).toUpperCase()}
                </span>
              </div>
            )}
            <span className="text-xs sm:text-sm font-semibold text-white truncate">{profile.name}</span>
          </div>
          <div className="relative">
            <HpBar current={playerHp} max={playerMaxHp} />
            <div className="mt-1">
              <StatusBadges effects={playerStatusEffects} />
            </div>
          </div>
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
              className="mt-2 w-full py-2 text-xs text-red-400 hover:text-red-300 cursor-pointer transition-colors"
            >
              Cancelar selecao de alvo
            </button>
          )}
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
      `}</style>
    </div>
  );
}
