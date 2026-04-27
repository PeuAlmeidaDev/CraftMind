"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import Image from "next/image";
import BattleLog from "../../battle/_components/BattleLog";
import SkillVfx from "../../battle/_components/SkillVfx";
import SkillBar from "../../battle/_components/SkillBar";
import { getHouseAssets } from "@/lib/houses/house-assets";
import type { HouseName } from "@/types/house";
import type {
  TurnLogEntry,
  PlayerState,
  BaseStats,
  ActiveStatusEffect,
} from "@/lib/battle/types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type SanitizedEnemyPlayer = {
  playerId: string;
  characterId: string;
  baseStats: BaseStats;
  currentHp: number;
  statusEffects: ActiveStatusEffect[];
};

type SkillInfo = {
  skillId: string;
  slotIndex: number;
  name: string;
  description: string;
  basePower: number;
  damageType: string;
  target: string;
  cooldown: number;
  accuracy: number;
};

type Pvp1v1BattleArenaProps = {
  myPlayer: PlayerState;
  enemyPlayer: SanitizedEnemyPlayer;
  currentPlayerId: string;
  turnNumber: number;
  events: TurnLogEntry[];
  turnTimeRemaining: number;
  canAct: boolean;
  actionSent: boolean;
  playerNames: Record<string, string>;
  playerAvatars: Record<string, string | null>;
  playerHouses: Record<string, string>;
  isEnemyDisconnected: boolean;
  onSkillUse: (skillId: string) => void;
  onSkipTurn: () => void;
};

// ---------------------------------------------------------------------------
// Status effect config (identical to BattleArena.tsx)
// ---------------------------------------------------------------------------

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  STUN: { label: "Atordoado", color: "#e0c85c" },
  FROZEN: { label: "Congelado", color: "#67e8f9" },
  BURN: { label: "Queimando", color: "#ff8a70" },
  POISON: { label: "Envenenado", color: "#7acf8a" },
  SLOW: { label: "Lento", color: "#60a5fa" },
};

// ---------------------------------------------------------------------------
// House badge colors for enemy card
// ---------------------------------------------------------------------------

const HOUSE_BADGE_COLORS: Record<string, string> = {
  ARION: "#e0c85c",
  LYCUS: "#67e8f9",
  NOCTIS: "#a78bfa",
  NEREID: "#7acf8a",
};

// ---------------------------------------------------------------------------
// Status border helpers (identical to BattleArena.tsx)
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
// Helpers (identical to BattleArena.tsx)
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
// Corner ticks decorator (identical to BattleArena.tsx)
// ---------------------------------------------------------------------------

function CornerTicks() {
  const tickStyle = "absolute w-[12px] h-[12px] pointer-events-none";
  const borderColor = "color-mix(in srgb, var(--gold) 40%, transparent)";
  return (
    <>
      <span
        className={`${tickStyle} top-0 left-0`}
        style={{ borderTop: `1px solid ${borderColor}`, borderLeft: `1px solid ${borderColor}` }}
      />
      <span
        className={`${tickStyle} top-0 right-0`}
        style={{ borderTop: `1px solid ${borderColor}`, borderRight: `1px solid ${borderColor}` }}
      />
      <span
        className={`${tickStyle} bottom-0 left-0`}
        style={{ borderBottom: `1px solid ${borderColor}`, borderLeft: `1px solid ${borderColor}` }}
      />
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

export default function Pvp1v1BattleArena({
  myPlayer,
  enemyPlayer,
  currentPlayerId,
  turnNumber,
  events,
  turnTimeRemaining,
  canAct,
  actionSent,
  playerNames,
  playerAvatars,
  playerHouses,
  isEnemyDisconnected,
  onSkillUse,
  onSkipTurn,
}: Pvp1v1BattleArenaProps) {
  const [playerShaking, setPlayerShaking] = useState(false);
  const [enemyShaking, setEnemyShaking] = useState(false);

  type VfxQueueItem = {
    skillName: string;
    target: "player" | "enemy";
  };

  const [vfxQueue, setVfxQueue] = useState<VfxQueueItem[]>([]);
  const activeVfx = vfxQueue[0] ?? null;

  const handleVfxComplete = useCallback(() => {
    setVfxQueue((prev) => prev.slice(1));
  }, []);

  type FloatingNumber = { id: number; value: number; type: "damage" | "heal" };
  const [playerFloats, setPlayerFloats] = useState<FloatingNumber[]>([]);
  const [enemyFloats, setEnemyFloats] = useState<FloatingNumber[]>([]);
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

  const addEnemyFloat = useCallback((value: number, type: "damage" | "heal") => {
    const id = ++floatCounter.current;
    setEnemyFloats((prev) => [...prev, { id, value, type }]);
    const timer = setTimeout(() => {
      setEnemyFloats((prev) => prev.filter((f) => f.id !== id));
      floatTimers.current.delete(timer);
    }, 1400);
    floatTimers.current.add(timer);
  }, []);

  // Derive state
  const isAlive = myPlayer.currentHp > 0;
  const canActNow = isAlive && !actionSent && canAct;

  // Timer
  const timerMax = 30;
  const timerPercent = (turnTimeRemaining / timerMax) * 100;

  // Derive skills (same shape as PvE AvailableSkill)
  const skills: SkillInfo[] = useMemo(() => {
    return myPlayer.equippedSkills.map((es) => ({
      skillId: es.skillId,
      slotIndex: es.slotIndex,
      name: es.skill.name,
      description: es.skill.description,
      basePower: es.skill.basePower,
      damageType: es.skill.damageType,
      target: es.skill.target,
      cooldown: myPlayer.cooldowns[es.skillId] ?? 0,
      accuracy: es.skill.accuracy,
    }));
  }, [myPlayer]);

  // Player info
  const playerName = playerNames[currentPlayerId] ?? "Voce";
  const playerAvatar = playerAvatars[currentPlayerId] ?? null;
  const playerHouse = playerHouses[currentPlayerId] ?? "NOCTIS";
  const playerInitial = playerName.charAt(0).toUpperCase();
  const playerHouseAssets = getHouseAssets(playerHouse as HouseName);

  // Enemy info
  const enemyName = playerNames[enemyPlayer.playerId] ?? "Adversario";
  const enemyAvatar = playerAvatars[enemyPlayer.playerId] ?? null;
  const enemyHouse = playerHouses[enemyPlayer.playerId] ?? "NOCTIS";
  const enemyInitial = enemyName.charAt(0).toUpperCase();
  const enemyIsDead = enemyPlayer.currentHp <= 0;
  const enemyHouseColor = HOUSE_BADGE_COLORS[enemyHouse] ?? "#999";

  // Name map for BattleLog
  const nameMap: Record<string, string> = useMemo(() => {
    return { ...playerNames };
  }, [playerNames]);

  // -------------------------------------------------------------------------
  // Detect new events and trigger shake + floats + VFX
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
        if (entry.targetId === currentPlayerId) {
          setPlayerShaking(true);
          addPlayerFloat(entry.damage!, "damage");
        }
        if (entry.targetId === enemyPlayer.playerId) {
          setEnemyShaking(true);
          addEnemyFloat(entry.damage!, "damage");
        }
      }

      if (hasHealing) {
        if (entry.targetId === currentPlayerId || entry.actorId === currentPlayerId) {
          addPlayerFloat(entry.healing!, "heal");
        } else if (entry.targetId === enemyPlayer.playerId || entry.actorId === enemyPlayer.playerId) {
          addEnemyFloat(entry.healing!, "heal");
        }
      }

      // Collect VFX for sequential queue
      const hasEffect = hasDamage || hasHealing || !!entry.buffApplied || !!entry.debuffApplied || !!entry.statusApplied;
      if (entry.skillName && hasEffect) {
        let target: "player" | "enemy" | undefined;

        if (entry.targetId) {
          target = entry.targetId === currentPlayerId
            ? "player"
            : entry.targetId === enemyPlayer.playerId
            ? "enemy"
            : undefined;
        } else if (entry.actorId) {
          target = entry.actorId === currentPlayerId
            ? "player"
            : entry.actorId === enemyPlayer.playerId
            ? "enemy"
            : undefined;
        }

        if (target) {
          newVfx.push({ skillName: entry.skillName, target });
        }
      }
    }

    // Deduplicate: one VFX per skillName+target combination
    const seen = new Set<string>();
    const uniqueVfx = newVfx.filter((v) => {
      const key = `${v.skillName}:${v.target}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    if (uniqueVfx.length > 0) {
      setVfxQueue((prev) => [...prev, ...uniqueVfx]);
    }

    const timer = setTimeout(() => {
      setPlayerShaking(false);
      setEnemyShaking(false);
    }, 500);

    return () => clearTimeout(timer);
  }, [events, currentPlayerId, enemyPlayer.playerId, addPlayerFloat, addEnemyFloat]);

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  // Map VFX target "enemy" -> "mob" for SkillVfx (it uses "player" | "mob")
  const vfxTargetEnemy = activeVfx?.target === "enemy" ? activeVfx.skillName : null;
  const vfxTargetPlayer = activeVfx?.target === "player" ? activeVfx.skillName : null;

  return (
    <div className="mx-auto max-w-4xl lg:max-w-6xl px-4 py-6">
      {/* Timer bar (PvP addition) */}
      <div
        className="mb-4"
        style={{
          background: "var(--bg-card)",
          border: "1px solid color-mix(in srgb, var(--gold) 13%, transparent)",
          padding: "8px 14px",
        }}
      >
        <div className="flex items-center justify-between mb-1">
          <span
            style={{
              fontFamily: "var(--font-cinzel)",
              fontSize: 9,
              letterSpacing: "0.35em",
              textTransform: "uppercase",
              color: "color-mix(in srgb, var(--gold) 80%, transparent)",
            }}
          >
            Turno {turnNumber}
          </span>
          <span
            style={{
              fontFamily: "var(--font-jetbrains)",
              fontSize: 10,
              letterSpacing: "0.18em",
              color: timerPercent > 60 ? "#7acf8a" : timerPercent > 30 ? "#e0c85c" : "#ff8a70",
            }}
          >
            {turnTimeRemaining}s
          </span>
        </div>
        <div
          style={{
            position: "relative",
            height: 4,
            border: "1px solid color-mix(in srgb, var(--gold) 13%, transparent)",
            overflow: "hidden",
            background: "var(--bg-primary)",
          }}
        >
          <div
            style={{
              position: "absolute",
              top: 0,
              bottom: 0,
              left: 0,
              width: `${timerPercent}%`,
              background:
                timerPercent > 60
                  ? "linear-gradient(90deg, #10b981 0%, #34d399 100%)"
                  : timerPercent > 30
                  ? "linear-gradient(90deg, #e0c85c 0%, #f5d76e 100%)"
                  : "linear-gradient(90deg, #b82b24 0%, #ff6a52 100%)",
              transition: "width 1000ms linear",
            }}
          />
        </div>
      </div>

      {/* ================================================================= */}
      {/* DESKTOP — player panel + enemy card                               */}
      {/* ================================================================= */}
      <div className="hidden lg:flex lg:flex-row lg:gap-4">
        {/* --- Player Panel (left ~45%) --- */}
        <div className="flex flex-col gap-3 w-[45%]">
          {/* Player info card */}
          <div
            className={`relative overflow-hidden ${playerShaking ? "animate-shake" : ""}`}
            style={{
              background: "linear-gradient(180deg, var(--bg-card) 0%, var(--bg-primary) 100%)",
              border: hasActiveStatus(myPlayer.statusEffects)
                ? getStatusBorderStyle(myPlayer.statusEffects)
                : "1px solid color-mix(in srgb, var(--gold) 13%, transparent)",
              padding: 18,
            }}
          >
            <CornerTicks />

            {/* House flag as ghost background */}
            {playerHouseAssets && (
              <Image
                src={playerHouseAssets.bandeira}
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
                {playerAvatar ? (
                  <img
                    src={playerAvatar}
                    alt={playerName}
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
                  {playerHouse}
                </span>
                <span
                  className="text-white truncate"
                  style={{
                    fontFamily: "var(--font-cormorant)",
                    fontSize: 26,
                    lineHeight: 1,
                  }}
                >
                  {playerName}
                </span>
              </div>
            </div>

            {/* HP + Status */}
            <div className="relative z-10 mt-[14px] flex flex-col gap-[10px]">
              <HpBar current={myPlayer.currentHp} max={myPlayer.baseStats.hp} variant="player" size="lg" />
              <StatusBadges effects={myPlayer.statusEffects} />
            </div>

            {/* Action status badge */}
            {isAlive && (
              <div className="relative z-10 mt-2">
                <span
                  className="uppercase"
                  style={{
                    fontFamily: "var(--font-jetbrains)",
                    fontSize: 8,
                    letterSpacing: "0.18em",
                    color: actionSent ? "#7acf8a" : "color-mix(in srgb, var(--gold) 60%, transparent)",
                    padding: "2px 6px",
                    border: `1px solid ${actionSent ? "color-mix(in srgb, #7acf8a 40%, transparent)" : "color-mix(in srgb, var(--gold) 20%, transparent)"}`,
                    background: actionSent ? "color-mix(in srgb, #7acf8a 8%, transparent)" : "transparent",
                  }}
                >
                  {actionSent ? "Acao enviada" : "Aguardando acao"}
                </span>
              </div>
            )}

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
              skillName={vfxTargetPlayer}
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
              skills={skills}
              onSkillUse={onSkillUse}
              onSkipTurn={onSkipTurn}
              disabled={!canActNow}
            />
          </div>

          {/* Battle Log */}
          <BattleLog
            events={events}
            nameMap={nameMap}
          />
        </div>

        {/* --- Enemy Card vertical/tall (right ~55%) --- */}
        <div
          className={`relative overflow-hidden w-[55%] flex flex-col ${
            enemyShaking ? "animate-shake" : ""
          }`}
          style={{
            background: "linear-gradient(180deg, var(--bg-card) 0%, var(--bg-primary) 100%)",
            border: hasActiveStatus(enemyPlayer.statusEffects)
              ? getStatusBorderStyle(enemyPlayer.statusEffects)
              : "1px solid color-mix(in srgb, #b82b24 20%, transparent)",
          }}
        >
          <CornerTicks />

          {/* Enemy portrait area */}
          <div className="relative h-[420px] overflow-hidden">
            {enemyAvatar ? (
              <img
                src={enemyAvatar}
                alt={enemyName}
                className="w-full h-full object-cover"
              />
            ) : (
              <div
                className="w-full h-full flex items-center justify-center"
                style={{
                  background: "linear-gradient(180deg, var(--bg-secondary) 0%, var(--bg-primary) 100%)",
                }}
              >
                <span
                  style={{
                    fontFamily: "var(--font-cinzel)",
                    fontSize: 80,
                    color: "color-mix(in srgb, #fff 10%, transparent)",
                  }}
                >
                  {enemyInitial}
                </span>
              </div>
            )}
            {/* Gradient overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent pointer-events-none" />
            {/* Name + house badge at bottom of image */}
            <div className="absolute bottom-0 left-0 right-0 px-5 pb-4">
              <div className="flex items-center gap-2">
                <span
                  className="text-white font-medium drop-shadow-lg"
                  style={{
                    fontFamily: "var(--font-cormorant)",
                    fontSize: 24,
                  }}
                >
                  {enemyName}
                </span>
                <span
                  className="shrink-0 uppercase"
                  style={{
                    fontFamily: "var(--font-cinzel)",
                    fontSize: 10,
                    letterSpacing: "0.3em",
                    color: enemyHouseColor,
                    padding: "2px 6px",
                    border: `1px solid color-mix(in srgb, ${enemyHouseColor} 40%, transparent)`,
                  }}
                >
                  {enemyHouse}
                </span>
              </div>
            </div>
          </div>

          {/* HP + Status + badges below image */}
          <div className="p-4 flex flex-col gap-[10px]">
            <HpBar current={enemyPlayer.currentHp} max={enemyPlayer.baseStats.hp} variant="mob" size="lg" />
            <StatusBadges effects={enemyPlayer.statusEffects} />

            {/* Disconnected badge */}
            {isEnemyDisconnected && (
              <span
                className="inline-flex items-center gap-[4px] uppercase animate-status-pulse self-start"
                style={{
                  fontFamily: "var(--font-jetbrains)",
                  fontSize: 9,
                  letterSpacing: "0.18em",
                  color: "#ff8a70",
                  padding: "2px 6px",
                  border: "1px solid color-mix(in srgb, #ff8a70 40%, transparent)",
                  background: "color-mix(in srgb, #ff8a70 8%, transparent)",
                }}
              >
                <span
                  className="rounded-full shrink-0"
                  style={{
                    width: 4,
                    height: 4,
                    background: "#ff8a70",
                    boxShadow: "0 0 3px #ff8a70",
                  }}
                />
                OFFLINE
              </span>
            )}
          </div>

          {/* Floating numbers */}
          {enemyFloats.map((f) => (
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
            skillName={vfxTargetEnemy}
            visible={activeVfx?.target === "enemy"}
            onComplete={handleVfxComplete}
          />

          {/* Dead overlay */}
          {enemyIsDead && (
            <div
              className="absolute inset-0 flex items-center justify-center z-20"
              style={{ background: "rgba(0,0,0,0.6)" }}
            >
              <span
                className="uppercase"
                style={{
                  fontFamily: "var(--font-cinzel)",
                  fontSize: 18,
                  letterSpacing: "0.3em",
                  color: "#ff8a70",
                }}
              >
                Derrotado
              </span>
            </div>
          )}
        </div>
      </div>

      {/* ================================================================= */}
      {/* MOBILE                                                            */}
      {/* ================================================================= */}
      <div className="flex flex-col gap-3 lg:hidden">
        {/* --- Player compact bar + skills --- */}
        <div
          className={`relative ${playerShaking ? "animate-shake" : ""}`}
          style={{
            background: "var(--bg-card)",
            border: hasActiveStatus(myPlayer.statusEffects)
              ? getStatusBorderStyle(myPlayer.statusEffects)
              : "1px solid color-mix(in srgb, var(--gold) 13%, transparent)",
            padding: 12,
          }}
        >
          <div className="flex items-center gap-2 mb-1">
            <span
              className="text-white truncate"
              style={{
                fontFamily: "var(--font-cormorant)",
                fontSize: 18,
              }}
            >
              {playerName}
            </span>
            {isAlive && (
              <span
                className="uppercase shrink-0"
                style={{
                  fontFamily: "var(--font-jetbrains)",
                  fontSize: 7,
                  letterSpacing: "0.18em",
                  color: actionSent ? "#7acf8a" : "color-mix(in srgb, var(--gold) 50%, transparent)",
                  padding: "1px 4px",
                  border: `1px solid ${actionSent ? "color-mix(in srgb, #7acf8a 30%, transparent)" : "color-mix(in srgb, var(--gold) 15%, transparent)"}`,
                }}
              >
                {actionSent ? "Agiu" : "Vez"}
              </span>
            )}
          </div>
          <HpBar current={myPlayer.currentHp} max={myPlayer.baseStats.hp} variant="player" size="compact" />
          <div className="mt-1">
            <StatusBadges effects={myPlayer.statusEffects} />
          </div>
          <div className="mt-3">
            <SkillBar
              skills={skills}
              onSkillUse={onSkillUse}
              onSkipTurn={onSkipTurn}
              disabled={!canActNow}
            />
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
            skillName={vfxTargetPlayer}
            visible={activeVfx?.target === "player"}
            onComplete={handleVfxComplete}
          />
        </div>

        {/* --- Enemy compact card --- */}
        <div
          className={`relative overflow-hidden ${enemyShaking ? "animate-shake" : ""}`}
          style={{
            background: "var(--bg-card)",
            border: hasActiveStatus(enemyPlayer.statusEffects)
              ? getStatusBorderStyle(enemyPlayer.statusEffects)
              : "1px solid color-mix(in srgb, #b82b24 20%, transparent)",
          }}
        >
          <div className="relative h-[180px] w-full overflow-hidden">
            {enemyAvatar ? (
              <img
                src={enemyAvatar}
                alt={enemyName}
                className="w-full h-full object-cover"
              />
            ) : (
              <div
                className="w-full h-full flex items-center justify-center"
                style={{
                  background: "linear-gradient(180deg, var(--bg-secondary) 0%, var(--bg-primary) 100%)",
                }}
              >
                <span
                  style={{
                    fontFamily: "var(--font-cinzel)",
                    fontSize: 48,
                    color: "color-mix(in srgb, #fff 10%, transparent)",
                  }}
                >
                  {enemyInitial}
                </span>
              </div>
            )}
            {/* Gradient overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent pointer-events-none" />
            {/* Name + house at bottom */}
            <div className="absolute bottom-0 left-0 right-0 px-3 pb-2">
              <div className="flex items-center gap-2">
                <span
                  className="text-white font-medium"
                  style={{
                    fontFamily: "var(--font-cormorant)",
                    fontSize: 18,
                  }}
                >
                  {enemyName}
                </span>
                <span
                  className="shrink-0 uppercase"
                  style={{
                    fontFamily: "var(--font-cinzel)",
                    fontSize: 9,
                    letterSpacing: "0.3em",
                    color: enemyHouseColor,
                    padding: "1px 4px",
                    border: `1px solid color-mix(in srgb, ${enemyHouseColor} 40%, transparent)`,
                  }}
                >
                  {enemyHouse}
                </span>
              </div>
            </div>
          </div>
          <div className="px-3 py-3 flex flex-col gap-[6px]">
            <HpBar current={enemyPlayer.currentHp} max={enemyPlayer.baseStats.hp} variant="mob" size="compact" />
            <StatusBadges effects={enemyPlayer.statusEffects} />
            {isEnemyDisconnected && (
              <span
                className="inline-flex items-center gap-[4px] uppercase animate-status-pulse"
                style={{
                  fontFamily: "var(--font-jetbrains)",
                  fontSize: 8,
                  letterSpacing: "0.18em",
                  color: "#ff8a70",
                  padding: "1px 4px",
                  border: "1px solid color-mix(in srgb, #ff8a70 40%, transparent)",
                  background: "color-mix(in srgb, #ff8a70 8%, transparent)",
                }}
              >
                <span
                  className="rounded-full shrink-0"
                  style={{
                    width: 4,
                    height: 4,
                    background: "#ff8a70",
                    boxShadow: "0 0 3px #ff8a70",
                  }}
                />
                OFFLINE
              </span>
            )}
          </div>
          {enemyFloats.map((f) => (
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
            skillName={vfxTargetEnemy}
            visible={activeVfx?.target === "enemy"}
            onComplete={handleVfxComplete}
          />

          {/* Dead overlay */}
          {enemyIsDead && (
            <div
              className="absolute inset-0 flex items-center justify-center z-20"
              style={{ background: "rgba(0,0,0,0.6)" }}
            >
              <span
                className="uppercase"
                style={{
                  fontFamily: "var(--font-cinzel)",
                  fontSize: 14,
                  letterSpacing: "0.3em",
                  color: "#ff8a70",
                }}
              >
                Derrotado
              </span>
            </div>
          )}
        </div>

        {/* --- Battle Log --- */}
        <BattleLog
          events={events}
          nameMap={nameMap}
        />
      </div>

      {/* Keyframes (identical to BattleArena.tsx) */}
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
      `}</style>
    </div>
  );
}
