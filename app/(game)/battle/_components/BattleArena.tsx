"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Image from "next/image";
import MobPlaceholder from "./MobPlaceholder";
import BattleLog from "./BattleLog";
import SkillBar from "./SkillBar";
import { getHouseAssets } from "@/lib/houses/house-assets";
import type { HouseName } from "@/types/house";
import type {
  TurnLogEntry,
  AvailableSkill,
  ActiveStatusEffect,
  MobInfo,
  PlayerProfile,
} from "../page";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type BattleArenaProps = {
  mob: MobInfo;
  profile: PlayerProfile;
  playerId: string | null;
  mobId: string | null;
  playerHp: number;
  playerMaxHp: number;
  mobHp: number;
  mobMaxHp: number;
  playerStatusEffects: ActiveStatusEffect[];
  mobStatusEffects: ActiveStatusEffect[];
  events: TurnLogEntry[];
  availableSkills: AvailableSkill[];
  onSkillUse: (skillId: string) => void;
  onSkipTurn: () => void;
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

const TIER_BADGE_COLORS: Record<number, string> = {
  1: "bg-gray-500/20 text-gray-400 border-gray-500/30",
  2: "bg-green-500/20 text-green-400 border-green-500/30",
  3: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  4: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  5: "bg-amber-500/20 text-amber-400 border-amber-500/30",
};

// ---------------------------------------------------------------------------
// Status border helpers
// ---------------------------------------------------------------------------

const STATUS_BORDER_PRIORITY = ["STUN", "FROZEN", "BURN", "POISON", "SLOW"] as const;
const STATUS_BORDER_COLOR: Record<string, string> = {
  BURN: "border-orange-500",
  FROZEN: "border-cyan-400",
  POISON: "border-green-500",
  STUN: "border-amber-400",
  SLOW: "border-blue-500",
};

function getStatusBorderClass(effects: ActiveStatusEffect[]): string {
  for (const s of STATUS_BORDER_PRIORITY) {
    if (effects.some((e) => e.status === s)) {
      return `${STATUS_BORDER_COLOR[s]} animate-status-pulse`;
    }
  }
  return "border-[var(--border-subtle)]";
}

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

function HpBar({
  current,
  max,
  variant,
  size = "normal",
}: {
  current: number;
  max: number;
  variant: "player" | "mob";
  size?: "normal" | "compact";
}) {
  const percent = max > 0 ? Math.max(0, Math.min(100, (current / max) * 100)) : 0;
  const barColor = variant === "player" ? "bg-emerald-500" : "bg-red-500";
  const trackColor = variant === "player" ? "bg-emerald-950/30" : "bg-red-950/30";
  const barHeight = size === "compact" ? "h-2.5" : "h-3";

  return (
    <div>
      <div className={`w-full ${barHeight} rounded-full ${trackColor} overflow-hidden`}>
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

export default function BattleArena({
  mob,
  profile,
  playerId,
  mobId,
  playerHp,
  playerMaxHp,
  mobHp,
  mobMaxHp,
  playerStatusEffects,
  mobStatusEffects,
  events,
  availableSkills,
  onSkillUse,
  onSkipTurn,
  acting,
}: BattleArenaProps) {
  const [playerShaking, setPlayerShaking] = useState(false);
  const [mobShaking, setMobShaking] = useState(false);

  type FloatingNumber = { id: number; value: number; type: "damage" | "heal" };
  const [playerFloats, setPlayerFloats] = useState<FloatingNumber[]>([]);
  const [mobFloats, setMobFloats] = useState<FloatingNumber[]>([]);
  const floatCounter = useRef(0);
  const prevEventsLength = useRef(events.length);

  const addPlayerFloat = useCallback((value: number, type: "damage" | "heal") => {
    const id = ++floatCounter.current;
    setPlayerFloats((prev) => [...prev, { id, value, type }]);
    setTimeout(() => setPlayerFloats((prev) => prev.filter((f) => f.id !== id)), 1400);
  }, []);

  const addMobFloat = useCallback((value: number, type: "damage" | "heal") => {
    const id = ++floatCounter.current;
    setMobFloats((prev) => [...prev, { id, value, type }]);
    setTimeout(() => setMobFloats((prev) => prev.filter((f) => f.id !== id)), 1400);
  }, []);

  const houseAssets = profile.house
    ? getHouseAssets(profile.house.name as HouseName)
    : null;

  const playerInitial = profile.name.charAt(0).toUpperCase();

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

    for (const entry of newEntries) {
      const hasDamage = entry.damage !== undefined && entry.damage > 0;
      const hasHealing = entry.healing !== undefined && entry.healing > 0;

      if (hasDamage && entry.targetId) {
        if (entry.targetId === playerId) {
          setPlayerShaking(true);
          addPlayerFloat(entry.damage!, "damage");
        }
        if (entry.targetId === mobId) {
          setMobShaking(true);
          addMobFloat(entry.damage!, "damage");
        }
      }

      if (hasHealing) {
        if (entry.targetId === playerId || entry.actorId === playerId) {
          addPlayerFloat(entry.healing!, "heal");
        } else if (entry.targetId === mobId || entry.actorId === mobId) {
          addMobFloat(entry.healing!, "heal");
        }
      }
    }

    const timer = setTimeout(() => {
      setPlayerShaking(false);
      setMobShaking(false);
    }, 500);

    return () => clearTimeout(timer);
  }, [events, playerId, mobId, addPlayerFloat, addMobFloat]);

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <div className="mx-auto max-w-4xl px-4 py-6">
      {/* ================================================================= */}
      {/* DESKTOP — cards lado a lado                                       */}
      {/* ================================================================= */}
      <div className="hidden lg:flex lg:flex-col lg:gap-4">
        <div className="grid grid-cols-2 gap-4">
          {/* --- Player Card (esquerda) --- */}
          <div
            className={`relative rounded-[14px] border ${getStatusBorderClass(playerStatusEffects)} overflow-hidden ${
              playerShaking ? "animate-shake" : ""
            }`}
            style={{
              background: "linear-gradient(to bottom, var(--bg-card), var(--bg-primary))",
            }}
          >
            {/* Header: player portrait */}
            <div className="relative h-48 overflow-hidden bg-[var(--bg-secondary)]">
              {profile.avatarUrl ? (
                <img
                  src={profile.avatarUrl}
                  alt={profile.name}
                  className="w-full h-full object-contain"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-[var(--bg-secondary)]">
                  <span
                    className="text-6xl text-white/30"
                    style={{ fontFamily: "var(--font-cinzel)" }}
                  >
                    {playerInitial}
                  </span>
                </div>
              )}
              <div className="absolute inset-0 bg-black/40 pointer-events-none" />
              <div className="absolute bottom-0 w-full bg-black/60 px-3 py-2">
                <span className="text-white font-semibold text-sm">{profile.name}</span>
              </div>
            </div>

            {/* Body: HP + status + skills */}
            <div className="relative overflow-hidden p-4 space-y-3">
              {houseAssets && (
                <Image
                  src={houseAssets.bandeira}
                  alt=""
                  width={140}
                  height={220}
                  className="absolute right-2 top-1/2 -translate-y-1/2 object-contain opacity-[0.06] pointer-events-none"
                  aria-hidden="true"
                />
              )}
              <div className="relative z-10 space-y-3">
                <HpBar current={playerHp} max={playerMaxHp} variant="player" />
                <StatusBadges effects={playerStatusEffects} />
                <SkillBar
                  skills={availableSkills}
                  onSkillUse={onSkillUse}
                  onSkipTurn={onSkipTurn}
                  disabled={acting}
                />
              </div>
            </div>

            {/* Floating numbers */}
            {playerFloats.map((f) => (
              <span
                key={f.id}
                className={`absolute top-4 left-1/2 -translate-x-1/2 font-bold text-lg pointer-events-none z-30 animate-float-number ${
                  f.type === "damage" ? "text-red-400" : "text-emerald-400"
                }`}
              >
                {f.type === "damage" ? `-${f.value}` : `+${f.value}`}
              </span>
            ))}
          </div>

          {/* --- Mob Card (direita) --- */}
          <div
            className={`relative rounded-[14px] border ${getStatusBorderClass(mobStatusEffects)} overflow-hidden ${
              mobShaking ? "animate-shake" : ""
            }`}
            style={{
              background: "linear-gradient(to bottom, var(--bg-card), var(--bg-primary))",
            }}
          >
            <div className="relative overflow-hidden rounded-t-[14px]">
              <MobPlaceholder name={mob.name} tier={mob.tier} />
              <div className="absolute bottom-0 w-full bg-black/60 px-3 py-2">
                <div className="flex items-center gap-2">
                  <span className="text-white font-semibold text-sm">{mob.name}</span>
                  <span
                    className={`text-[10px] font-semibold rounded-full px-2 py-0.5 border ${
                      TIER_BADGE_COLORS[mob.tier] ?? TIER_BADGE_COLORS[1]
                    }`}
                  >
                    T{mob.tier}
                  </span>
                </div>
              </div>
            </div>

            <div className="p-4 space-y-2">
              <HpBar current={mobHp} max={mobMaxHp} variant="mob" />
              <StatusBadges effects={mobStatusEffects} />
            </div>

            {/* Floating numbers */}
            {mobFloats.map((f) => (
              <span
                key={f.id}
                className={`absolute top-4 left-1/2 -translate-x-1/2 font-bold text-lg pointer-events-none z-30 animate-float-number ${
                  f.type === "damage" ? "text-red-400" : "text-emerald-400"
                }`}
              >
                {f.type === "damage" ? `-${f.value}` : `+${f.value}`}
              </span>
            ))}
          </div>
        </div>

        {/* --- Battle Log --- */}
        <BattleLog
          events={events}
          playerId={playerId ?? undefined}
          playerName={profile.name}
          mobId={mobId ?? undefined}
          mobName={mob.name}
        />
      </div>

      {/* ================================================================= */}
      {/* MOBILE                                                            */}
      {/* ================================================================= */}
      <div className="flex flex-col gap-3 lg:hidden">
        {/* --- Player compact bar + skills --- */}
        <div
          className={`relative bg-[var(--bg-card)] border ${getStatusBorderClass(playerStatusEffects)} rounded-lg p-3 ${
            playerShaking ? "animate-shake" : ""
          }`}
        >
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-semibold text-white truncate">{profile.name}</span>
          </div>
          <HpBar current={playerHp} max={playerMaxHp} variant="player" size="compact" />
          <StatusBadges effects={playerStatusEffects} />
          <div className="mt-3">
            <SkillBar
              skills={availableSkills}
              onSkillUse={onSkillUse}
              onSkipTurn={onSkipTurn}
              disabled={acting}
            />
          </div>
          {playerFloats.map((f) => (
            <span
              key={f.id}
              className={`absolute top-2 left-1/2 -translate-x-1/2 font-bold text-lg pointer-events-none z-30 animate-float-number ${
                f.type === "damage" ? "text-red-400" : "text-emerald-400"
              }`}
            >
              {f.type === "damage" ? `-${f.value}` : `+${f.value}`}
            </span>
          ))}
        </div>

        {/* --- Mob compact bar --- */}
        <div
          className={`relative bg-[var(--bg-card)] border ${getStatusBorderClass(mobStatusEffects)} rounded-lg p-3 ${
            mobShaking ? "animate-shake" : ""
          }`}
        >
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-semibold text-white truncate">{mob.name}</span>
            <span
              className={`text-[10px] font-semibold rounded-full px-2 py-0.5 border shrink-0 ${
                TIER_BADGE_COLORS[mob.tier] ?? TIER_BADGE_COLORS[1]
              }`}
            >
              T{mob.tier}
            </span>
          </div>
          <HpBar current={mobHp} max={mobMaxHp} variant="mob" size="compact" />
          <StatusBadges effects={mobStatusEffects} />
          {mobFloats.map((f) => (
            <span
              key={f.id}
              className={`absolute top-2 left-1/2 -translate-x-1/2 font-bold text-lg pointer-events-none z-30 animate-float-number ${
                f.type === "damage" ? "text-red-400" : "text-emerald-400"
              }`}
            >
              {f.type === "damage" ? `-${f.value}` : `+${f.value}`}
            </span>
          ))}
        </div>

        {/* --- Battle Log --- */}
        <BattleLog
          events={events}
          playerId={playerId ?? undefined}
          playerName={profile.name}
          mobId={mobId ?? undefined}
          mobName={mob.name}
        />
      </div>

      {/* Shake keyframes */}
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
        @keyframes floatNumber {
          0% { opacity: 0; transform: translate(-50%, 0); }
          15% { opacity: 1; }
          100% { opacity: 0; transform: translate(-50%, -30px); }
        }
        :global(.animate-float-number) {
          animation: floatNumber 1.4s ease-out forwards;
        }
        @keyframes statusPulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        :global(.animate-status-pulse) {
          animation: statusPulse 1.5s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}
