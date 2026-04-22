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
  const floatTimers = useRef<Set<ReturnType<typeof setTimeout>>>(new Set());
  const prevEventsLength = useRef(events.length);

  // Cleanup all floating number timers on unmount
  useEffect(() => {
    const timers = floatTimers.current;
    return () => {
      timers.forEach((t) => clearTimeout(t));
      timers.clear();
    };
  }, []);

  const addPlayerFloat = useCallback((value: number, type: "damage" | "heal") => {
    const id = ++floatCounter.current;
    setPlayerFloats((prev) => [...prev, { id, value, type }]);
    const timer = setTimeout(() => {
      setPlayerFloats((prev) => prev.filter((f) => f.id !== id));
      floatTimers.current.delete(timer);
    }, 1400);
    floatTimers.current.add(timer);
  }, []);

  const addMobFloat = useCallback((value: number, type: "damage" | "heal") => {
    const id = ++floatCounter.current;
    setMobFloats((prev) => [...prev, { id, value, type }]);
    const timer = setTimeout(() => {
      setMobFloats((prev) => prev.filter((f) => f.id !== id));
      floatTimers.current.delete(timer);
    }, 1400);
    floatTimers.current.add(timer);
  }, []);

  const houseAssets = profile?.house
    ? getHouseAssets(profile.house.name as HouseName)
    : null;

  const playerInitial = profile?.name?.charAt(0).toUpperCase() ?? "?";

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
    <div className="mx-auto max-w-4xl lg:max-w-6xl px-4 py-6">
      {/* ================================================================= */}
      {/* DESKTOP — player panel + mob card vertical                        */}
      {/* ================================================================= */}
      <div className="hidden lg:flex lg:flex-row lg:gap-4">
        {/* --- Player Panel (esquerda ~45%) --- */}
        <div className="flex flex-col gap-3 w-[45%]">
          {/* Player info card */}
          <div
            className={`relative rounded-[14px] border ${getStatusBorderClass(playerStatusEffects)} overflow-hidden ${
              playerShaking ? "animate-shake" : ""
            }`}
            style={{
              background: "linear-gradient(to bottom, var(--bg-card), var(--bg-primary))",
            }}
          >
            {/* Bandeira da casa como background do card inteiro */}
            {houseAssets && (
              <Image
                src={houseAssets.bandeira}
                alt=""
                width={100}
                height={160}
                className="absolute right-3 top-1/2 -translate-y-1/2 object-contain opacity-[0.07] pointer-events-none"
                aria-hidden="true"
              />
            )}

            {/* Player header: avatar + name + house */}
            <div className="relative z-10 flex items-center gap-3 p-4">
              <div className="relative w-14 h-14 rounded-xl overflow-hidden shrink-0 bg-[var(--bg-secondary)]">
                {profile.avatarUrl ? (
                  <img
                    src={profile.avatarUrl}
                    alt={profile.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <span
                      className="text-2xl text-white/30"
                      style={{ fontFamily: "var(--font-cinzel)" }}
                    >
                      {playerInitial}
                    </span>
                  </div>
                )}
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-white font-semibold text-sm truncate">{profile.name}</span>
                {profile.house && (
                  <span className="text-[11px] text-gray-400 truncate">{profile.house.name}</span>
                )}
              </div>
            </div>

            {/* HP + Status */}
            <div className="relative z-10 px-4 pb-4 space-y-2">
              <HpBar current={playerHp} max={playerMaxHp} variant="player" />
              <StatusBadges effects={playerStatusEffects} />
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

          {/* Skills */}
          <div
            className="rounded-[14px] border border-[var(--border-subtle)] p-4"
            style={{ background: "var(--bg-card)" }}
          >
            <SkillBar
              skills={availableSkills}
              onSkillUse={onSkillUse}
              onSkipTurn={onSkipTurn}
              disabled={acting}
            />
          </div>

          {/* Battle Log */}
          <BattleLog
            events={events}
            playerId={playerId ?? undefined}
            playerName={profile.name}
            mobId={mobId ?? undefined}
            mobName={mob.name}
          />
        </div>

        {/* --- Mob Card vertical/tall (direita ~55%) --- */}
        <div
          className={`relative rounded-[14px] border ${getStatusBorderClass(mobStatusEffects)} overflow-hidden w-[55%] flex flex-col ${
            mobShaking ? "animate-shake" : ""
          }`}
          style={{
            background: "linear-gradient(to bottom, var(--bg-card), var(--bg-primary))",
          }}
        >
          {/* Mob portrait — tall image */}
          <div className="relative h-[420px] overflow-hidden">
            <MobPlaceholder name={mob.name} tier={mob.tier} imageUrl={mob.imageUrl} />
            {/* Gradient overlay for name readability */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent pointer-events-none" />
            {/* Name + tier badge at bottom of image */}
            <div className="absolute bottom-0 left-0 right-0 px-5 pb-4">
              <div className="flex items-center gap-2">
                <span className="text-white font-bold text-xl drop-shadow-lg">{mob.name}</span>
                <span
                  className={`text-[11px] font-semibold rounded-full px-2.5 py-0.5 border backdrop-blur-sm ${
                    TIER_BADGE_COLORS[mob.tier] ?? TIER_BADGE_COLORS[1]
                  }`}
                >
                  T{mob.tier}
                </span>
              </div>
            </div>
          </div>

          {/* HP + Status below image */}
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
          className={`relative bg-[var(--bg-card)] border ${getStatusBorderClass(mobStatusEffects)} rounded-lg p-0 pb-3 ${
            mobShaking ? "animate-shake" : ""
          }`}
        >
          <div className="relative h-[180px] w-full overflow-hidden rounded-t-lg">
            <MobPlaceholder name={mob.name} tier={mob.tier} imageUrl={mob.imageUrl} />
          </div>
          <div className="px-3">
            <div className="flex items-center gap-2 mb-1 mt-2">
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
          </div>
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
