"use client";

import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import type { SanitizedCoopPveState, CoopPveSkillInfo, CoopPveTeammateInfo, CoopPveMobInfo } from "../page";
import type { TurnLogEntry } from "../../battle/page";
import BattleLog from "../../battle/_components/BattleLog";
import CoopPveSkillBar from "./CoopPveSkillBar";
import CoopPveMobRow from "./CoopPveMobRow";
import CoopPveTeamPanel from "./CoopPveTeamPanel";

type CoopPveArenaProps = {
  battleState: SanitizedCoopPveState;
  currentPlayerId: string;
  turnTimeRemaining: number;
  actedPlayers: Set<string>;
  turnEvents: Array<Record<string, unknown>>;
  onAction: (skillId: string | null, targetIndex?: number, targetId?: string) => void;
};

export default function CoopPveArena({
  battleState,
  currentPlayerId,
  turnTimeRemaining,
  actedPlayers,
  turnEvents,
  onAction,
}: CoopPveArenaProps) {
  const [targetingMode, setTargetingMode] = useState<"SINGLE_ENEMY" | "SINGLE_ALLY" | null>(null);
  const [pendingSkillId, setPendingSkillId] = useState<string | null>(null);

  // VFX queue — sequential playback
  type VfxQueueItem =
    | { skillName: string; target: "mob"; mobIndex: number }
    | { skillName: string; target: "player"; playerId: string };
  const [vfxQueue, setVfxQueue] = useState<VfxQueueItem[]>([]);
  const activeVfx = vfxQueue[0] ?? null;
  const handleVfxComplete = useCallback(() => {
    setVfxQueue((prev) => prev.slice(1));
  }, []);
  const prevTurnEventsLength = useRef(turnEvents.length);

  // Derive current player state
  const currentPlayer = battleState.team.find((p) => p.playerId === currentPlayerId);
  const isAlive = currentPlayer ? currentPlayer.currentHp > 0 : false;
  const hasActed = actedPlayers.has(currentPlayerId);
  const canAct = isAlive && !hasActed && battleState.status === "IN_PROGRESS";

  // Timer progress (30s default)
  const timerMax = 30;
  const timerPercent = (turnTimeRemaining / timerMax) * 100;
  const timerColor =
    timerPercent > 60 ? "bg-emerald-500" : timerPercent > 30 ? "bg-yellow-500" : "bg-red-500";

  // Derive skills for current player
  const skills: CoopPveSkillInfo[] = useMemo(() => {
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
    }));
  }, [currentPlayer]);

  // Derive teammates info
  const teammates: CoopPveTeammateInfo[] = useMemo(() => {
    return battleState.team.map((p) => ({
      playerId: p.playerId,
      name: battleState.playerNames[p.playerId] ?? "Jogador",
      currentHp: p.currentHp,
      maxHp: p.baseStats.hp,
      statusEffects: p.statusEffects,
      isAlive: p.currentHp > 0,
      avatarUrl: battleState.playerAvatars[p.playerId] ?? null,
      houseName: battleState.playerHouses[p.playerId] ?? "NOCTIS",
    }));
  }, [battleState]);

  // Derive mobs info
  const mobs: CoopPveMobInfo[] = useMemo(() => {
    return battleState.mobs.map((m, idx) => ({
      playerId: m.playerId,
      name: m.name,
      tier: parseInt(m.mobId?.split("-tier-")[1] ?? "1", 10) || 1,
      hp: m.currentHp,
      maxHp: m.baseStats.hp,
      defeated: m.defeated,
      statusEffects: m.statusEffects,
      index: idx,
      imageUrl: m.imageUrl,
    }));
  }, [battleState.mobs]);

  // Name map for BattleLog
  const nameMap: Record<string, string> = useMemo(() => {
    return { ...battleState.playerNames, ...battleState.mobNames };
  }, [battleState.playerNames, battleState.mobNames]);

  // Detect new turn events and trigger VFX
  useEffect(() => {
    if (turnEvents.length <= prevTurnEventsLength.current) {
      prevTurnEventsLength.current = turnEvents.length;
      return;
    }

    const newEntries = turnEvents.slice(prevTurnEventsLength.current);
    prevTurnEventsLength.current = turnEvents.length;

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
      if (!hasDamage && !hasHealing) continue;

      // Check if target is a mob
      const targetMob = mobs.find((m) => m.playerId === targetId);
      if (targetMob) {
        newVfx.push({ skillName, target: "mob", mobIndex: targetMob.index });
        continue;
      }

      // Check if target is a teammate
      const targetTeammate = teammates.find((t) => t.playerId === targetId);
      if (targetTeammate) {
        newVfx.push({ skillName, target: "player", playerId: targetTeammate.playerId });
        continue;
      }
    }

    if (newVfx.length > 0) {
      setVfxQueue((prev) => [...prev, ...newVfx]);
    }
  }, [turnEvents, mobs, teammates]);

  // Handlers
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
        onAction(skillId);
        setTargetingMode(null);
        setPendingSkillId(null);
      }
    },
    [onAction],
  );

  const handleMobClick = useCallback(
    (mobIndex: number) => {
      if (pendingSkillId && targetingMode === "SINGLE_ENEMY") {
        onAction(pendingSkillId, mobIndex);
        setTargetingMode(null);
        setPendingSkillId(null);
      }
    },
    [pendingSkillId, targetingMode, onAction],
  );

  const handleAllyClick = useCallback(
    (playerId: string) => {
      if (pendingSkillId && targetingMode === "SINGLE_ALLY") {
        onAction(pendingSkillId, undefined, playerId);
        setTargetingMode(null);
        setPendingSkillId(null);
      }
    },
    [pendingSkillId, targetingMode, onAction],
  );

  const handleCancelTargeting = useCallback(() => {
    setTargetingMode(null);
    setPendingSkillId(null);
  }, []);

  const handleSkipTurn = useCallback(() => {
    onAction(null);
  }, [onAction]);

  return (
    <div className="flex flex-col gap-2 sm:gap-3 p-2 md:p-4 max-w-5xl mx-auto">
      {/* Turn timer bar */}
      <div className="rounded-lg bg-[var(--bg-card)] border border-[var(--border-subtle)] p-1.5 sm:p-2">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[11px] sm:text-xs font-semibold text-gray-400">
            Turno {battleState.turnNumber}
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

      {/* Mob row */}
      <CoopPveMobRow
        mobs={mobs}
        targeting={targetingMode === "SINGLE_ENEMY"}
        onMobClick={handleMobClick}
        vfxTarget={activeVfx?.target === "mob" ? activeVfx.mobIndex : null}
        vfxSkillName={activeVfx?.target === "mob" ? activeVfx.skillName : null}
        onVfxComplete={handleVfxComplete}
      />

      {/* Team panel */}
      <CoopPveTeamPanel
        teammates={teammates}
        currentPlayerId={currentPlayerId}
        actedPlayers={actedPlayers}
        targeting={targetingMode === "SINGLE_ALLY"}
        onAllyClick={handleAllyClick}
        vfxTargetPlayerId={activeVfx?.target === "player" ? activeVfx.playerId : null}
        vfxSkillName={activeVfx?.target === "player" ? activeVfx.skillName : null}
        onVfxComplete={handleVfxComplete}
      />

      {/* Bottom section: Skills + Log */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 sm:gap-3">
        {/* Skills */}
        <div>
          <CoopPveSkillBar
            skills={skills}
            onSkillSelect={handleSkillSelect}
            onSkipTurn={handleSkipTurn}
            disabled={!canAct}
            targetingMode={targetingMode}
            pendingSkillId={pendingSkillId}
            onCancelTargeting={handleCancelTargeting}
          />
        </div>

        {/* Battle log */}
        <div>
          <BattleLog
            events={turnEvents as unknown as TurnLogEntry[]}
            nameMap={nameMap}
          />
        </div>
      </div>
    </div>
  );
}
