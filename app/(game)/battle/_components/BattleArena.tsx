"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Image from "next/image";
import MobPlaceholder from "./MobPlaceholder";
import SkillVfx from "./SkillVfx";
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
  onForfeit: () => void;
  acting: boolean;
  /** True quando o jogador tem ao menos 1 cristal Espectral (purity 100)
   *  equipado. Aplica overlay holografico animado no painel do player.
   *  Default false (sem overlay). */
  hasEquippedSpectral?: boolean;
};

// ---------------------------------------------------------------------------
// Status effect config
// ---------------------------------------------------------------------------

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  STUN: { label: "Atordoado", color: "#e0c85c" },
  FROZEN: { label: "Congelado", color: "#67e8f9" },
  BURN: { label: "Queimando", color: "#ff8a70" },
  POISON: { label: "Envenenado", color: "#7acf8a" },
  SLOW: { label: "Lento", color: "#60a5fa" },
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
  BURN: "#ff8a70",
  FROZEN: "#67e8f9",
  POISON: "#7acf8a",
  STUN: "#e0c85c",
  SLOW: "#60a5fa",
};

function getStatusBorderStyle(effects: ActiveStatusEffect[]): string {
  for (const s of STATUS_BORDER_PRIORITY) {
    if (effects.some((e) => e.status === s)) {
      return `1px solid color-mix(in srgb, ${STATUS_BORDER_COLOR[s]} 40%, transparent)`;
    }
  }
  return "1px solid color-mix(in srgb, var(--gold) 13%, transparent)";
}

function hasActiveStatus(effects: ActiveStatusEffect[]): boolean {
  return STATUS_BORDER_PRIORITY.some((s) => effects.some((e) => e.status === s));
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
        const hexColor = config?.color ?? "#999";

        return (
          <span
            key={effect.status}
            className="inline-flex items-center gap-[4px] uppercase animate-status-pulse"
            style={{
              fontFamily: "var(--font-jetbrains)",
              fontSize: 9,
              letterSpacing: "0.18em",
              color: hexColor,
              padding: "2px 6px",
              border: `1px solid color-mix(in srgb, ${hexColor} 40%, transparent)`,
              background: `color-mix(in srgb, ${hexColor} 8%, transparent)`,
            }}
          >
            <span
              className="rounded-full shrink-0"
              style={{
                width: 4,
                height: 4,
                background: hexColor,
                boxShadow: `0 0 3px ${hexColor}`,
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
  variant,
  size = "normal",
}: {
  current: number;
  max: number;
  variant: "player" | "mob";
  size?: "normal" | "compact" | "lg";
}) {
  const percent = max > 0 ? Math.max(0, Math.min(100, (current / max) * 100)) : 0;
  const pct01 = percent / 100;
  const low = pct01 <= 0.25 && pct01 > 0;
  const isPlayer = variant === "player";

  const fill = isPlayer
    ? "linear-gradient(90deg, #10b981 0%, #34d399 100%)"
    : "linear-gradient(90deg, #b82b24 0%, #ff6a52 100%)";

  const trackBorder = isPlayer
    ? "1px solid color-mix(in srgb, #10b981 27%, transparent)"
    : "1px solid color-mix(in srgb, #b82b24 27%, transparent)";

  const innerGlow = isPlayer
    ? "inset 0 0 4px rgba(16, 185, 129, 0.53)"
    : "inset 0 0 4px rgba(184, 43, 36, 0.53)";

  const height = size === "lg" ? 10 : size === "compact" ? 4 : 6;
  const hideLabel = size === "compact";

  return (
    <div style={{ width: "100%" }}>
      {!hideLabel && (
        <div
          className="flex justify-between uppercase"
          style={{
            fontFamily: "var(--font-jetbrains)",
            fontSize: 10,
            letterSpacing: "0.18em",
            marginBottom: 4,
          }}
        >
          <span style={{ color: "color-mix(in srgb, var(--gold) 80%, transparent)" }}>HP</span>
          <span style={{ color: isPlayer ? "#7acf8a" : "#ff8a70" }}>
            {current} / {max}
          </span>
        </div>
      )}
      <div
        style={{
          position: "relative",
          height,
          border: trackBorder,
          overflow: "hidden",
          background: "var(--bg-primary)",
        }}
      >
        <div
          className={low ? "animate-hp-low" : ""}
          style={{
            position: "absolute",
            top: 0,
            bottom: 0,
            left: 0,
            width: `${percent}%`,
            background: fill,
            boxShadow: innerGlow,
            transition: "width 500ms cubic-bezier(.2,.8,.2,1)",
          }}
        />
        <span
          style={{
            position: "absolute",
            top: 0,
            bottom: 0,
            left: "50%",
            width: 1,
            background: "color-mix(in srgb, var(--gold) 13%, transparent)",
          }}
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Corner ticks decorator
// ---------------------------------------------------------------------------

function CornerTicks() {
  const tickStyle = "absolute w-[12px] h-[12px] pointer-events-none";
  const borderColor = "color-mix(in srgb, var(--gold) 40%, transparent)";
  return (
    <>
      {/* top-left */}
      <span
        className={`${tickStyle} top-0 left-0`}
        style={{ borderTop: `1px solid ${borderColor}`, borderLeft: `1px solid ${borderColor}` }}
      />
      {/* top-right */}
      <span
        className={`${tickStyle} top-0 right-0`}
        style={{ borderTop: `1px solid ${borderColor}`, borderRight: `1px solid ${borderColor}` }}
      />
      {/* bottom-left */}
      <span
        className={`${tickStyle} bottom-0 left-0`}
        style={{ borderBottom: `1px solid ${borderColor}`, borderLeft: `1px solid ${borderColor}` }}
      />
      {/* bottom-right */}
      <span
        className={`${tickStyle} bottom-0 right-0`}
        style={{ borderBottom: `1px solid ${borderColor}`, borderRight: `1px solid ${borderColor}` }}
      />
    </>
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
  onForfeit,
  acting,
  hasEquippedSpectral = false,
}: BattleArenaProps) {
  const [playerShaking, setPlayerShaking] = useState(false);
  const [mobShaking, setMobShaking] = useState(false);

  type VfxQueueItem = {
    skillName: string;
    target: "player" | "mob";
  };

  const [vfxQueue, setVfxQueue] = useState<VfxQueueItem[]>([]);
  const activeVfx = vfxQueue[0] ?? null;

  const handleVfxComplete = useCallback(() => {
    setVfxQueue(prev => prev.slice(1));
  }, []);

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

    const newVfx: VfxQueueItem[] = [];

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

      // Collect VFX for sequential queue
      const hasEffect = hasDamage || hasHealing || !!entry.buffApplied || !!entry.debuffApplied || !!entry.statusApplied;
      if (entry.skillName && hasEffect) {
        let target: "player" | "mob" | undefined;

        if (entry.targetId) {
          target = entry.targetId === playerId ? "player" : entry.targetId === mobId ? "mob" : undefined;
        } else if (entry.actorId) {
          target = entry.actorId === playerId ? "player" : entry.actorId === mobId ? "mob" : undefined;
        }

        if (target) {
          newVfx.push({ skillName: entry.skillName, target });
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
      {/* DESKTOP — player panel + mob card                                 */}
      {/* ================================================================= */}
      <div className="hidden lg:flex lg:flex-row lg:gap-4">
        {/* --- Player Panel (esquerda ~45%) --- */}
        <div className="flex flex-col gap-3 w-[45%]">
          {/* Player info card */}
          <div
            className={`relative overflow-hidden ${playerShaking ? "animate-shake" : ""}`}
            style={{
              background: "linear-gradient(180deg, var(--bg-card) 0%, var(--bg-primary) 100%)",
              border: hasActiveStatus(playerStatusEffects)
                ? getStatusBorderStyle(playerStatusEffects)
                : "1px solid color-mix(in srgb, var(--gold) 13%, transparent)",
              padding: 18,
            }}
          >
            <CornerTicks />

            {/* Overlay holografico (so quando ha Espectral equipada). will-change
                no overlay, nao no card inteiro, para nao promover GPU layer
                desnecessario quando nao ha Espectral. */}
            {hasEquippedSpectral && (
              <span
                aria-hidden="true"
                className="spectral-overlay pointer-events-none absolute inset-0 z-[1]"
              />
            )}

            {/* Bandeira da casa como background */}
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
            <div className="relative z-10 flex items-center gap-[14px]">
              <div
                className="relative shrink-0 rounded-full overflow-hidden"
                style={{
                  width: 60,
                  height: 60,
                  border: "1px solid color-mix(in srgb, var(--gold) 40%, transparent)",
                  background: "var(--bg-secondary)",
                }}
              >
                {profile.avatarUrl ? (
                  <img
                    src={profile.avatarUrl}
                    alt={profile.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <span
                      className="text-2xl"
                      style={{
                        fontFamily: "var(--font-cinzel)",
                        color: "color-mix(in srgb, #fff 30%, transparent)",
                      }}
                    >
                      {playerInitial}
                    </span>
                  </div>
                )}
              </div>
              <div className="flex flex-col min-w-0">
                <span
                  className="uppercase"
                  style={{
                    fontFamily: "var(--font-cinzel)",
                    fontSize: 9,
                    letterSpacing: "0.3em",
                    color: "color-mix(in srgb, var(--gold) 80%, transparent)",
                  }}
                >
                  {profile.house?.name ?? "Casa"}
                </span>
                <span
                  className="text-white truncate"
                  style={{
                    fontFamily: "var(--font-cormorant)",
                    fontSize: 26,
                    lineHeight: 1,
                  }}
                >
                  {profile.name}
                </span>
              </div>
            </div>

            {/* HP + Status */}
            <div className="relative z-10 mt-[14px] flex flex-col gap-[10px]">
              <HpBar current={playerHp} max={playerMaxHp} variant="player" size="lg" />
              <StatusBadges effects={playerStatusEffects} />
            </div>

            {/* Floating numbers */}
            {playerFloats.map((f) => (
              <span
                key={f.id}
                className="absolute top-4 left-1/2 -translate-x-1/2 pointer-events-none z-30 animate-float-number italic"
                style={{
                  fontFamily: "var(--font-cormorant)",
                  fontSize: 36,
                  fontWeight: 500,
                  color: f.type === "damage" ? "#ff8a70" : "#7acf8a",
                  textShadow:
                    f.type === "damage"
                      ? "0 2px 8px rgba(255,138,112,0.53), 0 0 14px rgba(255,138,112,0.27)"
                      : "0 2px 8px rgba(122,207,138,0.53), 0 0 14px rgba(122,207,138,0.27)",
                }}
              >
                {f.type === "damage" ? `\u2212${f.value}` : `+${f.value}`}
              </span>
            ))}

            <SkillVfx
              skillName={activeVfx?.target === "player" ? activeVfx.skillName : null}
              visible={activeVfx?.target === "player"}
              onComplete={handleVfxComplete}
            />
          </div>

          {/* Skills container */}
          <div
            style={{
              background: "var(--bg-card)",
              border: "1px solid color-mix(in srgb, var(--gold) 13%, transparent)",
              padding: 16,
            }}
          >
            <SkillBar
              skills={availableSkills}
              onSkillUse={onSkillUse}
              onSkipTurn={onSkipTurn}
              disabled={acting}
            />
            <button
              type="button"
              onClick={onForfeit}
              disabled={acting}
              className="mt-2 w-full py-2 cursor-pointer transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              style={{
                fontFamily: "var(--font-garamond)",
                fontStyle: "italic",
                fontSize: 12,
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
          className={`relative overflow-hidden w-[55%] flex flex-col ${
            mobShaking ? "animate-shake" : ""
          }`}
          style={{
            background: "linear-gradient(180deg, var(--bg-card) 0%, var(--bg-primary) 100%)",
            border: hasActiveStatus(mobStatusEffects)
              ? getStatusBorderStyle(mobStatusEffects)
              : "1px solid color-mix(in srgb, #b82b24 20%, transparent)",
          }}
        >
          {/* Mob portrait */}
          <div className="relative h-[420px] overflow-hidden">
            <MobPlaceholder name={mob.name} tier={mob.tier} imageUrl={mob.imageUrl} />
            {/* Gradient overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent pointer-events-none" />
            {/* Name + tier badge at bottom of image */}
            <div className="absolute bottom-0 left-0 right-0 px-5 pb-4">
              <div className="flex items-center gap-2">
                <span
                  className="text-white font-medium drop-shadow-lg"
                  style={{
                    fontFamily: "var(--font-cormorant)",
                    fontSize: 24,
                  }}
                >
                  {mob.name}
                </span>
                <span
                  className="shrink-0 uppercase"
                  style={{
                    fontFamily: "var(--font-cinzel)",
                    fontSize: 10,
                    letterSpacing: "0.3em",
                    color: "#ff8a70",
                    padding: "2px 6px",
                    border: "1px solid #ff8a7066",
                  }}
                >
                  T{mob.tier}
                </span>
              </div>
            </div>
          </div>

          {/* HP + Status below image */}
          <div className="p-4 flex flex-col gap-[10px]">
            <HpBar current={mobHp} max={mobMaxHp} variant="mob" size="lg" />
            <StatusBadges effects={mobStatusEffects} />
          </div>

          {/* Floating numbers */}
          {mobFloats.map((f) => (
            <span
              key={f.id}
              className="absolute top-4 left-1/2 -translate-x-1/2 pointer-events-none z-30 animate-float-number italic"
              style={{
                fontFamily: "var(--font-cormorant)",
                fontSize: 36,
                fontWeight: 500,
                color: f.type === "damage" ? "#ff8a70" : "#7acf8a",
                textShadow:
                  f.type === "damage"
                    ? "0 2px 8px rgba(255,138,112,0.53), 0 0 14px rgba(255,138,112,0.27)"
                    : "0 2px 8px rgba(122,207,138,0.53), 0 0 14px rgba(122,207,138,0.27)",
              }}
            >
              {f.type === "damage" ? `\u2212${f.value}` : `+${f.value}`}
            </span>
          ))}

          <SkillVfx
            skillName={activeVfx?.target === "mob" ? activeVfx.skillName : null}
            visible={activeVfx?.target === "mob"}
            onComplete={handleVfxComplete}
          />
        </div>
      </div>

      {/* ================================================================= */}
      {/* MOBILE                                                            */}
      {/* ================================================================= */}
      <div className="flex flex-col gap-3 lg:hidden">
        {/* --- Player compact bar + skills --- */}
        <div
          className={`relative overflow-hidden ${playerShaking ? "animate-shake" : ""}`}
          style={{
            background: "var(--bg-card)",
            border: hasActiveStatus(playerStatusEffects)
              ? getStatusBorderStyle(playerStatusEffects)
              : "1px solid color-mix(in srgb, var(--gold) 13%, transparent)",
            padding: 12,
          }}
        >
          {hasEquippedSpectral && (
            <span
              aria-hidden="true"
              className="spectral-overlay pointer-events-none absolute inset-0 z-[1]"
            />
          )}
          <div className="flex items-center gap-2 mb-1">
            <span
              className="text-white truncate"
              style={{
                fontFamily: "var(--font-cormorant)",
                fontSize: 18,
              }}
            >
              {profile.name}
            </span>
          </div>
          <HpBar current={playerHp} max={playerMaxHp} variant="player" size="compact" />
          <div className="mt-1">
            <StatusBadges effects={playerStatusEffects} />
          </div>
          <div className="mt-3">
            <SkillBar
              skills={availableSkills}
              onSkillUse={onSkillUse}
              onSkipTurn={onSkipTurn}
              disabled={acting}
            />
            <button
              type="button"
              onClick={onForfeit}
              disabled={acting}
              className="mt-2 w-full py-2 cursor-pointer transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              style={{
                fontFamily: "var(--font-garamond)",
                fontStyle: "italic",
                fontSize: 12,
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
          {playerFloats.map((f) => (
            <span
              key={f.id}
              className="absolute top-2 left-1/2 -translate-x-1/2 pointer-events-none z-30 animate-float-number italic"
              style={{
                fontFamily: "var(--font-cormorant)",
                fontSize: 28,
                fontWeight: 500,
                color: f.type === "damage" ? "#ff8a70" : "#7acf8a",
                textShadow:
                  f.type === "damage"
                    ? "0 2px 8px rgba(255,138,112,0.53), 0 0 14px rgba(255,138,112,0.27)"
                    : "0 2px 8px rgba(122,207,138,0.53), 0 0 14px rgba(122,207,138,0.27)",
              }}
            >
              {f.type === "damage" ? `\u2212${f.value}` : `+${f.value}`}
            </span>
          ))}

          <SkillVfx
            skillName={activeVfx?.target === "player" ? activeVfx.skillName : null}
            visible={activeVfx?.target === "player"}
            onComplete={handleVfxComplete}
          />
        </div>

        {/* --- Mob compact card --- */}
        <div
          className={`relative overflow-hidden ${mobShaking ? "animate-shake" : ""}`}
          style={{
            background: "var(--bg-card)",
            border: hasActiveStatus(mobStatusEffects)
              ? getStatusBorderStyle(mobStatusEffects)
              : "1px solid color-mix(in srgb, #b82b24 20%, transparent)",
          }}
        >
          <div className="relative h-[180px] w-full overflow-hidden">
            <MobPlaceholder name={mob.name} tier={mob.tier} imageUrl={mob.imageUrl} />
            {/* Gradient overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent pointer-events-none" />
            {/* Name + tier at bottom */}
            <div className="absolute bottom-0 left-0 right-0 px-3 pb-2">
              <div className="flex items-center gap-2">
                <span
                  className="text-white font-medium"
                  style={{
                    fontFamily: "var(--font-cormorant)",
                    fontSize: 18,
                  }}
                >
                  {mob.name}
                </span>
                <span
                  className="shrink-0 uppercase"
                  style={{
                    fontFamily: "var(--font-cinzel)",
                    fontSize: 9,
                    letterSpacing: "0.3em",
                    color: "#ff8a70",
                    padding: "1px 4px",
                    border: "1px solid #ff8a7066",
                  }}
                >
                  T{mob.tier}
                </span>
              </div>
            </div>
          </div>
          <div className="px-3 py-3 flex flex-col gap-[6px]">
            <HpBar current={mobHp} max={mobMaxHp} variant="mob" size="compact" />
            <StatusBadges effects={mobStatusEffects} />
          </div>
          {mobFloats.map((f) => (
            <span
              key={f.id}
              className="absolute top-2 left-1/2 -translate-x-1/2 pointer-events-none z-30 animate-float-number italic"
              style={{
                fontFamily: "var(--font-cormorant)",
                fontSize: 28,
                fontWeight: 500,
                color: f.type === "damage" ? "#ff8a70" : "#7acf8a",
                textShadow:
                  f.type === "damage"
                    ? "0 2px 8px rgba(255,138,112,0.53), 0 0 14px rgba(255,138,112,0.27)"
                    : "0 2px 8px rgba(122,207,138,0.53), 0 0 14px rgba(122,207,138,0.27)",
              }}
            >
              {f.type === "damage" ? `\u2212${f.value}` : `+${f.value}`}
            </span>
          ))}

          <SkillVfx
            skillName={activeVfx?.target === "mob" ? activeVfx.skillName : null}
            visible={activeVfx?.target === "mob"}
            onComplete={handleVfxComplete}
          />
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

      {/* Keyframes */}
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
          animation: statusPulse 2s ease-in-out infinite;
        }
        @keyframes hpLowPulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        :global(.animate-hp-low) {
          animation: hpLowPulse 0.9s ease-in-out infinite;
        }
        /* Overlay holografico para painel com Espectral equipada.
           Intensidade media (visivel mas nao gritante). will-change no overlay
           para usar GPU compositor sem promover o card inteiro. */
        @keyframes spectralOverlayShift {
          0% {
            background-position: 0% 0%;
            filter: hue-rotate(0deg) saturate(1.3);
          }
          100% {
            background-position: 100% 100%;
            filter: hue-rotate(360deg) saturate(1.3);
          }
        }
        :global(.spectral-overlay) {
          will-change: filter, background-position;
          background: linear-gradient(
            120deg,
            color-mix(in srgb, var(--gold) 18%, transparent) 0%,
            color-mix(in srgb, var(--ember) 14%, transparent) 25%,
            color-mix(in srgb, var(--gold) 8%, transparent) 50%,
            color-mix(in srgb, var(--ember) 14%, transparent) 75%,
            color-mix(in srgb, var(--gold) 18%, transparent) 100%
          );
          background-size: 220% 220%;
          mix-blend-mode: screen;
          opacity: 0.65;
          animation: spectralOverlayShift 6s linear infinite;
        }
      `}</style>
    </div>
  );
}
