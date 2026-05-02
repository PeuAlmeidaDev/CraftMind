"use client";

import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import BattleLog from "../../battle/_components/BattleLog";
import PvpTeamSkillBar from "./PvpTeamSkillBar";
import PvpTeamEnemyPanel from "./PvpTeamEnemyPanel";
import PvpTeamAllyPanel from "./PvpTeamAllyPanel";
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
  fromSpectralCard?: boolean;
};

type TeammateInfo = {
  playerId: string;
  name: string;
  currentHp: number;
  maxHp: number;
  statusEffects: { status: string; remainingTurns: number }[];
  isAlive: boolean;
  avatarUrl: string | null;
  houseName: string;
};

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

type PvpTeamBattleArenaProps = {
  myTeam: PlayerState[];
  enemyTeam: SanitizedEnemyPlayer[];
  myTeamNumber: 1 | 2;
  currentPlayerId: string;
  turnNumber: number;
  events: TurnLogEntry[];
  turnTimeRemaining: number;
  canAct: boolean;
  actionSent: boolean;
  actionsReceived: { count: number; total: number };
  playerNames: Record<string, string>;
  playerAvatars: Record<string, string | null>;
  playerHouses: Record<string, string>;
  disconnectedPlayers: Set<string>;
  autoSkipPlayers: Set<string>;
  onSkillUse: (skillId: string, targetIndex?: number, targetId?: string) => void;
  onSkipTurn: () => void;
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function PvpTeamBattleArena({
  myTeam,
  enemyTeam,
  currentPlayerId,
  turnNumber,
  events,
  turnTimeRemaining,
  canAct,
  actionSent,
  actionsReceived,
  playerNames,
  playerAvatars,
  playerHouses,
  disconnectedPlayers,
  autoSkipPlayers,
  onSkillUse,
  onSkipTurn,
}: PvpTeamBattleArenaProps) {
  const [targetingMode, setTargetingMode] = useState<"SINGLE_ENEMY" | "SINGLE_ALLY" | null>(null);
  const [pendingSkillId, setPendingSkillId] = useState<string | null>(null);

  // VFX queue — sequential playback (same as CoopPveArena)
  type VfxQueueItem =
    | { skillName: string; target: "enemy"; enemyIndex: number }
    | { skillName: string; target: "player"; playerId: string };
  const [vfxQueue, setVfxQueue] = useState<VfxQueueItem[]>([]);
  const activeVfx = vfxQueue[0] ?? null;
  const handleVfxComplete = useCallback(() => {
    setVfxQueue((prev) => prev.slice(1));
  }, []);
  const prevEventsLength = useRef(events.length);

  // Derive current player state
  const currentPlayer = myTeam.find((p) => p.playerId === currentPlayerId);
  const isAlive = currentPlayer ? currentPlayer.currentHp > 0 : false;
  const hasActed = actionSent;
  const canActNow = isAlive && !hasActed && canAct;

  // Timer progress (30s default)
  const timerMax = 30;
  const timerPercent = (turnTimeRemaining / timerMax) * 100;
  const timerColor =
    timerPercent > 60 ? "bg-emerald-500" : timerPercent > 30 ? "bg-yellow-500" : "bg-red-500";

  // Derive skills for current player (includes 5o slot quando ha Espectral)
  const skills: SkillInfo[] = useMemo(() => {
    if (!currentPlayer) return [];
    return currentPlayer.equippedSkills.map((es) => ({
      skillId: es.skillId,
      slotIndex: es.slotIndex,
      name: es.skill.name,
      description: es.skill.description,
      basePower: es.skill.basePower,
      damageType: es.skill.damageType,
      target: es.skill.target,
      cooldown: currentPlayer.cooldowns[es.skillId] ?? 0,
      accuracy: es.skill.accuracy,
      fromSpectralCard: es.fromSpectralCard ?? false,
    }));
  }, [currentPlayer]);

  // Derive teammates info
  const teammates: TeammateInfo[] = useMemo(() => {
    return myTeam.map((p) => ({
      playerId: p.playerId,
      name: playerNames[p.playerId] ?? "Jogador",
      currentHp: p.currentHp,
      maxHp: p.baseStats.hp,
      statusEffects: p.statusEffects.map((se) => ({
        status: se.status,
        remainingTurns: se.remainingTurns,
      })),
      isAlive: p.currentHp > 0,
      avatarUrl: playerAvatars[p.playerId] ?? null,
      houseName: playerHouses[p.playerId] ?? "NOCTIS",
    }));
  }, [myTeam, playerNames, playerAvatars, playerHouses]);

  // Derive enemies info
  const enemies: EnemyInfo[] = useMemo(() => {
    return enemyTeam.map((p, idx) => ({
      playerId: p.playerId,
      name: playerNames[p.playerId] ?? "Adversario",
      currentHp: p.currentHp,
      maxHp: p.baseStats.hp,
      statusEffects: p.statusEffects.map((se) => ({
        status: se.status,
        remainingTurns: se.remainingTurns,
      })),
      isAlive: p.currentHp > 0,
      avatarUrl: playerAvatars[p.playerId] ?? null,
      houseName: playerHouses[p.playerId] ?? "NOCTIS",
      index: idx,
    }));
  }, [enemyTeam, playerNames, playerAvatars, playerHouses]);

  // Name map for BattleLog
  const nameMap: Record<string, string> = useMemo(() => {
    return { ...playerNames };
  }, [playerNames]);

  // Acted players set (for ally panel)
  const actedPlayers: Set<string> = useMemo(() => {
    const set = new Set<string>();
    if (actionSent) set.add(currentPlayerId);
    return set;
  }, [actionSent, currentPlayerId]);

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

      // Check if target is an enemy
      const targetEnemy = enemies.find((e) => e.playerId === targetId);
      if (targetEnemy) {
        newVfx.push({ skillName, target: "enemy", enemyIndex: targetEnemy.index });
        continue;
      }

      // Check if target is a teammate
      const targetTeammate = teammates.find((t) => t.playerId === targetId);
      if (targetTeammate) {
        newVfx.push({ skillName, target: "player", playerId: targetTeammate.playerId });
        continue;
      }
    }

    // Deduplicate: one VFX per skillName+target combination
    const seen = new Set<string>();
    const uniqueVfx = newVfx.filter((v) => {
      const key = `${v.skillName}:${v.target}:${"enemyIndex" in v ? v.enemyIndex : "playerId" in v ? v.playerId : ""}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    if (uniqueVfx.length > 0) {
      setVfxQueue((prev) => [...prev, ...uniqueVfx]);
    }
  }, [events, enemies, teammates]);

  // Handlers (targeting managed here, like CoopPveArena)
  const handleSkillSelect = useCallback(
    (skillId: string, target: string) => {
      if (target === "SINGLE_ENEMY") {
        setTargetingMode("SINGLE_ENEMY");
        setPendingSkillId(skillId);
      } else if (target === "SINGLE_ALLY") {
        setTargetingMode("SINGLE_ALLY");
        setPendingSkillId(skillId);
      } else {
        // ALL_ENEMIES, SELF, ALL_ALLIES — fire directly
        onSkillUse(skillId);
        setTargetingMode(null);
        setPendingSkillId(null);
      }
    },
    [onSkillUse],
  );

  const handleEnemyClick = useCallback(
    (enemyIndex: number) => {
      if (pendingSkillId && targetingMode === "SINGLE_ENEMY") {
        onSkillUse(pendingSkillId, enemyIndex);
        setTargetingMode(null);
        setPendingSkillId(null);
      }
    },
    [pendingSkillId, targetingMode, onSkillUse],
  );

  const handleAllyClick = useCallback(
    (playerId: string) => {
      if (pendingSkillId && targetingMode === "SINGLE_ALLY") {
        onSkillUse(pendingSkillId, undefined, playerId);
        setTargetingMode(null);
        setPendingSkillId(null);
      }
    },
    [pendingSkillId, targetingMode, onSkillUse],
  );

  const handleCancelTargeting = useCallback(() => {
    setTargetingMode(null);
    setPendingSkillId(null);
  }, []);

  const handleSkipTurn = useCallback(() => {
    onSkipTurn();
  }, [onSkipTurn]);

  return (
    <div className="flex flex-col gap-2 sm:gap-3 p-2 md:p-4 max-w-5xl mx-auto">
      {/* Turn timer bar (identical to CoopPveArena) */}
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

      {/* Enemy panel (top, like CoopPveMobRow) */}
      <PvpTeamEnemyPanel
        enemies={enemies}
        targeting={targetingMode === "SINGLE_ENEMY"}
        onEnemyClick={handleEnemyClick}
        vfxTarget={activeVfx?.target === "enemy" ? activeVfx.enemyIndex : null}
        vfxSkillName={activeVfx?.target === "enemy" ? activeVfx.skillName : null}
        onVfxComplete={handleVfxComplete}
        disconnectedPlayers={disconnectedPlayers}
        autoSkipPlayers={autoSkipPlayers}
      />

      {/* Team panel (like CoopPveTeamPanel) */}
      <PvpTeamAllyPanel
        teammates={teammates}
        currentPlayerId={currentPlayerId}
        actedPlayers={actedPlayers}
        targeting={targetingMode === "SINGLE_ALLY"}
        onAllyClick={handleAllyClick}
        vfxTargetPlayerId={activeVfx?.target === "player" ? activeVfx.playerId : null}
        vfxSkillName={activeVfx?.target === "player" ? activeVfx.skillName : null}
        onVfxComplete={handleVfxComplete}
        disconnectedPlayers={disconnectedPlayers}
        autoSkipPlayers={autoSkipPlayers}
      />

      {/* Bottom section: Skills + Log (identical layout to CoopPveArena) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 sm:gap-3">
        {/* Skills */}
        <div>
          <PvpTeamSkillBar
            skills={skills}
            onSkillSelect={handleSkillSelect}
            onSkipTurn={handleSkipTurn}
            disabled={!canActNow}
            targetingMode={targetingMode}
            pendingSkillId={pendingSkillId}
            onCancelTargeting={handleCancelTargeting}
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
