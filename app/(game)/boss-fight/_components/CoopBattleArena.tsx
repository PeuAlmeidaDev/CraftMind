"use client";

import { useMemo } from "react";
import TurnTimer from "./TurnTimer";
import BossCard from "./BossCard";
import TeamPanel from "./TeamPanel";
import type { TeamPlayerInfo } from "./TeamPanel";
import CoopSkillBar from "./CoopSkillBar";
import type { CoopAvailableSkill } from "./CoopSkillBar";
import BattleLog from "../../battle/_components/BattleLog";
import type { TurnLogEntry } from "@/lib/battle/types";

type BossInfo = {
  name: string;
  currentHp: number;
  maxHp: number;
  statusEffects: { status: string; remainingTurns: number }[];
};

type CoopBattleArenaProps = {
  boss: BossInfo;
  team: TeamPlayerInfo[];
  events: TurnLogEntry[];
  turnNumber: number;
  turnTimeRemaining: number;
  actedPlayers: Set<string>;
  currentPlayerId: string;
  canAct: boolean;
  bossPlayerId: string;
  bossName: string;
  playerName: string;
  playerNames: Record<string, string>;
  bossIsHit: boolean;
  skills: CoopAvailableSkill[];
  teammates: { playerId: string; name: string; isAlive: boolean }[];
  onSkillUse: (skillId: string, targetId?: string) => void;
  onSkipTurn: () => void;
};

export default function CoopBattleArena({
  boss,
  team,
  events,
  turnNumber,
  turnTimeRemaining,
  actedPlayers,
  currentPlayerId,
  canAct,
  bossPlayerId,
  bossName,
  playerName,
  playerNames,
  bossIsHit,
  skills,
  teammates,
  onSkillUse,
  onSkipTurn,
}: CoopBattleArenaProps) {
  const nameMap = useMemo(() => ({ ...playerNames }), [playerNames]);

  return (
    <div className="mx-auto max-w-4xl px-4 py-4 space-y-4">
      {/* Turn timer (full width) */}
      <TurnTimer timeRemaining={turnTimeRemaining} maxTime={30} />

      {/* Turn indicator */}
      <p className="text-center text-sm font-semibold text-gray-400 tracking-wider uppercase">
        Turno {turnNumber}
      </p>

      {/* Boss card (center-top) */}
      <BossCard
        name={boss.name}
        currentHp={boss.currentHp}
        maxHp={boss.maxHp}
        statusEffects={boss.statusEffects}
        isHit={bossIsHit}
      />

      {/* Team panel (center) */}
      <TeamPanel
        team={team}
        currentPlayerId={currentPlayerId}
        actedPlayers={actedPlayers}
      />

      {/* Bottom row: skills placeholder + battle log */}
      <div className="flex flex-col lg:flex-row gap-4">
        {/* Skill bar */}
        <div className="flex-1">
          <div className="rounded-xl bg-[var(--bg-card)] border border-[var(--border-subtle)] p-4 min-h-[120px]">
            {canAct ? (
              <CoopSkillBar
                skills={skills}
                onSkillUse={onSkillUse}
                onSkipTurn={onSkipTurn}
                disabled={!canAct}
                teammates={teammates}
              />
            ) : (
              <div className="flex items-center justify-center min-h-[72px]">
                <p className="text-sm text-gray-500 italic">
                  Aguardando turno...
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Battle log */}
        <div className="flex-1">
          <BattleLog
            events={events}
            playerId={currentPlayerId}
            playerName={playerName}
            mobId={bossPlayerId}
            mobName={bossName}
            nameMap={nameMap}
          />
        </div>
      </div>
    </div>
  );
}
