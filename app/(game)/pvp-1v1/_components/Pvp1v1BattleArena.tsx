"use client";

import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import Image from "next/image";
import BattleLog from "../../battle/_components/BattleLog";
import SkillVfx from "../../battle/_components/SkillVfx";
import Pvp1v1SkillBar from "./Pvp1v1SkillBar";
import type { TurnLogEntry, PlayerState, BaseStats, ActiveStatusEffect } from "@/lib/battle/types";

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
// Constants (same as CoopPveTeamPanel / PvpTeamEnemyPanel)
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
  // VFX queue — sequential playback (same as PvpTeamBattleArena)
  type VfxQueueItem =
    | { skillName: string; target: "enemy" }
    | { skillName: string; target: "player" };
  const [vfxQueue, setVfxQueue] = useState<VfxQueueItem[]>([]);
  const activeVfx = vfxQueue[0] ?? null;
  const handleVfxComplete = useCallback(() => {
    setVfxQueue((prev) => prev.slice(1));
  }, []);
  const prevEventsLength = useRef(events.length);

  // Derive state
  const isAlive = myPlayer.currentHp > 0;
  const canActNow = isAlive && !actionSent && canAct;

  // Timer progress (30s default)
  const timerMax = 30;
  const timerPercent = (turnTimeRemaining / timerMax) * 100;
  const timerColor =
    timerPercent > 60 ? "bg-emerald-500" : timerPercent > 30 ? "bg-yellow-500" : "bg-red-500";

  // Derive skills for current player
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

  // Derive enemy info
  const enemyName = playerNames[enemyPlayer.playerId] ?? "Adversario";
  const enemyAvatar = playerAvatars[enemyPlayer.playerId] ?? null;
  const enemyHouse = playerHouses[enemyPlayer.playerId] ?? "NOCTIS";
  const enemyIsDead = enemyPlayer.currentHp <= 0;
  const enemyHpPercent =
    enemyPlayer.baseStats.hp > 0
      ? (enemyPlayer.currentHp / enemyPlayer.baseStats.hp) * 100
      : 0;
  const enemyHpColor =
    enemyHpPercent > 50 ? "bg-emerald-500" : enemyHpPercent > 25 ? "bg-yellow-500" : "bg-red-500";
  const enemyHouseBadge = HOUSE_COLORS[enemyHouse] ?? "bg-gray-700/60 text-gray-300";

  // Derive player info
  const playerName = playerNames[currentPlayerId] ?? "Voce";
  const playerAvatar = playerAvatars[currentPlayerId] ?? null;
  const playerHouse = playerHouses[currentPlayerId] ?? "NOCTIS";
  const playerIsDead = myPlayer.currentHp <= 0;
  const playerHpPercent =
    myPlayer.baseStats.hp > 0
      ? (myPlayer.currentHp / myPlayer.baseStats.hp) * 100
      : 0;
  const playerHpColor =
    playerHpPercent > 50 ? "bg-emerald-500" : playerHpPercent > 25 ? "bg-yellow-500" : "bg-red-500";
  const playerHouseBadge = HOUSE_COLORS[playerHouse] ?? "bg-gray-700/60 text-gray-300";

  // Status badge for player
  const playerStatusBadge = playerIsDead
    ? { text: "Morto", color: "text-red-400" }
    : actionSent
    ? { text: "Agiu", color: "text-emerald-400" }
    : { text: "Sua vez", color: "text-[var(--accent-primary)]" };

  // Name map for BattleLog
  const nameMap: Record<string, string> = useMemo(() => {
    return { ...playerNames };
  }, [playerNames]);

  // Detect new turn events and trigger VFX
  useEffect(() => {
    if (events.length <= prevEventsLength.current) {
      prevEventsLength.current = events.length;
      return;
    }

    const newEntries = events.slice(prevEventsLength.current);
    prevEventsLength.current = events.length;

    const newVfx: VfxQueueItem[] = [];

    for (const rawEntry of newEntries) {
      const entry = rawEntry as Record<string, unknown>;
      const skillName = entry.skillName as string | undefined;
      const damage = entry.damage as number | undefined;
      const healing = entry.healing as number | undefined;
      const targetId = entry.targetId as string | undefined;

      if (!skillName) continue;
      const hasDamage = damage !== undefined && damage > 0;
      const hasHealing = healing !== undefined && healing > 0;
      const buffApplied = entry.buffApplied as unknown;
      const debuffApplied = entry.debuffApplied as unknown;
      const statusApplied = entry.statusApplied as unknown;
      const hasEffect = hasDamage || hasHealing || !!buffApplied || !!debuffApplied || !!statusApplied;
      if (!hasEffect) continue;

      if (targetId === enemyPlayer.playerId) {
        newVfx.push({ skillName, target: "enemy" });
      } else if (targetId === currentPlayerId) {
        newVfx.push({ skillName, target: "player" });
      }
    }

    // Deduplicate
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
  }, [events, enemyPlayer.playerId, currentPlayerId]);

  return (
    <div className="flex flex-col gap-2 sm:gap-3 p-2 md:p-4 max-w-5xl mx-auto">
      {/* Turn timer bar (identical to PvpTeamBattleArena / CoopPveArena) */}
      <div className="rounded-lg bg-[var(--bg-card)] border border-[var(--border-subtle)] p-1.5 sm:p-2">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[11px] sm:text-xs font-semibold text-gray-400">
            Turno {turnNumber}
          </span>
          <span className="text-[11px] sm:text-xs font-medium text-white">
            {turnTimeRemaining}s
          </span>
        </div>
        <div className="w-full h-2 rounded-full bg-gray-800 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-1000 ${timerColor}`}
            style={{ width: `${timerPercent}%` }}
          />
        </div>
      </div>

      {/* Enemy card (top — single card, like PvpTeamEnemyPanel but for 1 enemy) */}
      <div className="flex justify-center">
        <div
          className={`relative flex flex-col rounded-xl border overflow-hidden transition-all w-36 sm:w-44 md:w-52 ${
            enemyIsDead
              ? "opacity-40 grayscale pointer-events-none border-[var(--border-subtle)]"
              : "border-[var(--border-subtle)]"
          } bg-[var(--bg-card)]`}
        >
          {/* Avatar area */}
          <div className="hidden md:flex items-center justify-center h-24 bg-[var(--bg-primary)] border-b border-[var(--border-subtle)]">
            {enemyAvatar ? (
              <Image
                src={enemyAvatar}
                alt={enemyName}
                width={64}
                height={64}
                className="object-cover w-16 h-16 rounded-full border border-[var(--border-subtle)]"
              />
            ) : (
              <div className="w-16 h-16 rounded-full bg-[var(--bg-card)] border border-[var(--border-subtle)] flex items-center justify-center">
                <span className="text-xl font-bold text-gray-400">
                  {enemyName.charAt(0).toUpperCase()}
                </span>
              </div>
            )}
          </div>

          {/* Info */}
          <div className="p-1.5 sm:p-2 space-y-1.5">
            {/* Name + house badge */}
            <div className="flex items-center justify-between gap-1">
              <p className="text-xs font-semibold text-white truncate flex-1">
                {enemyName}
              </p>
              <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold ${enemyHouseBadge}`}>
                {enemyHouse}
              </span>
            </div>

            {/* Disconnected badge */}
            {isEnemyDisconnected && (
              <div className="flex flex-wrap gap-0.5">
                <span className="text-[8px] px-1 py-0.5 rounded bg-orange-600/80 text-orange-100 font-semibold">
                  OFFLINE
                </span>
              </div>
            )}

            {/* HP bar */}
            <div className="w-full h-2 rounded-full bg-gray-800 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${enemyHpColor}`}
                style={{ width: `${enemyHpPercent}%` }}
              />
            </div>
            <p className="text-[9px] text-gray-400 text-center">
              {enemyPlayer.currentHp}/{enemyPlayer.baseStats.hp}
            </p>

            {/* Status effects */}
            {enemyPlayer.statusEffects.length > 0 && (
              <div className="flex flex-wrap justify-center gap-0.5">
                {enemyPlayer.statusEffects.map((se, idx) => (
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

          {/* Skill VFX overlay */}
          <SkillVfx
            skillName={activeVfx?.target === "enemy" ? activeVfx.skillName : null}
            visible={activeVfx !== null && activeVfx.target === "enemy"}
            onComplete={handleVfxComplete}
          />

          {/* Dead overlay */}
          {enemyIsDead && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/50">
              <span className="text-xs font-bold text-red-400">Derrotado</span>
            </div>
          )}
        </div>
      </div>

      {/* Player card (bottom — single card, like PvpTeamAllyPanel but for 1 player) */}
      <div className="flex justify-center">
        <div
          className={`relative flex flex-col items-center rounded-xl border p-2 sm:p-3 transition-all w-36 sm:w-44 md:w-52 ${
            "border-[var(--accent-primary)]/60 bg-[var(--bg-card)]"
          } ${!isAlive ? "opacity-50 grayscale" : ""}`}
        >
          {/* Avatar */}
          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full overflow-hidden bg-[var(--bg-primary)] border border-[var(--border-subtle)] mb-1.5 sm:mb-2 flex items-center justify-center">
            {playerAvatar ? (
              <Image
                src={playerAvatar}
                alt={playerName}
                width={40}
                height={40}
                className="object-cover w-full h-full"
              />
            ) : (
              <span className="text-sm font-bold text-gray-400">
                {playerName.charAt(0).toUpperCase()}
              </span>
            )}
          </div>

          {/* Name */}
          <p className="text-[11px] sm:text-xs font-semibold text-white truncate max-w-full">
            {playerName}
          </p>

          {/* House badge */}
          <span className={`text-[8px] sm:text-[9px] px-1 sm:px-1.5 py-0.5 rounded mt-0.5 sm:mt-1 ${playerHouseBadge}`}>
            {playerHouse}
          </span>

          {/* HP bar */}
          <div className="w-full mt-1.5 sm:mt-2">
            <div className="w-full h-2 rounded-full bg-gray-800 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${playerHpColor}`}
                style={{ width: `${playerHpPercent}%` }}
              />
            </div>
            <p className="text-[8px] sm:text-[9px] text-gray-400 text-center mt-0.5">
              {myPlayer.currentHp}/{myPlayer.baseStats.hp}
            </p>
          </div>

          {/* Status effects */}
          {myPlayer.statusEffects.length > 0 && (
            <div className="flex flex-wrap justify-center gap-0.5 mt-1">
              {myPlayer.statusEffects.map((se, idx) => (
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

          {/* Skill VFX overlay */}
          <SkillVfx
            skillName={activeVfx?.target === "player" ? activeVfx.skillName : null}
            visible={activeVfx !== null && activeVfx.target === "player"}
            onComplete={handleVfxComplete}
          />

          {/* Status badge */}
          <p className={`text-[10px] font-medium mt-1.5 ${playerStatusBadge.color}`}>
            {playerStatusBadge.text}
          </p>
        </div>
      </div>

      {/* Bottom section: Skills + Log (identical layout to PvpTeamBattleArena) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 sm:gap-3">
        {/* Skills */}
        <div>
          <Pvp1v1SkillBar
            skills={skills}
            onSkillSelect={onSkillUse}
            onSkipTurn={onSkipTurn}
            disabled={!canActNow}
          />
        </div>

        {/* Battle log */}
        <div>
          <BattleLog
            events={events}
            nameMap={nameMap}
          />
        </div>
      </div>
    </div>
  );
}
