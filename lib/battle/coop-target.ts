// lib/battle/coop-target.ts — Resolucao de alvos para batalha cooperativa

import type { PlayerState } from "./types";
import type { SkillTarget } from "@/types/skill";

// ---------------------------------------------------------------------------
// chooseBossTarget — seleciona alvo prioritario do boss entre os players vivos
// ---------------------------------------------------------------------------

export function chooseBossTarget(
  team: PlayerState[],
  randomFn?: () => number
): string {
  const alive = team.filter((p) => p.currentHp > 0);
  if (alive.length === 0) {
    throw new Error("Nenhum player vivo no time para o boss atacar");
  }

  if (alive.length === 1) {
    return alive[0].playerId;
  }

  // 1. Menor HP percentual
  let minHpPercent = Infinity;
  for (const p of alive) {
    const pct = p.currentHp / p.baseStats.hp;
    if (pct < minHpPercent) {
      minHpPercent = pct;
    }
  }

  const lowestHp = alive.filter(
    (p) => p.currentHp / p.baseStats.hp === minHpPercent
  );

  if (lowestHp.length === 1) {
    return lowestHp[0].playerId;
  }

  // 2. Menos buffs defensivos (physicalDef ou magicDef como BUFF)
  const defensiveBuffCount = (player: PlayerState): number =>
    player.buffs.filter(
      (b) =>
        b.source === "BUFF" &&
        (b.stat === "physicalDef" || b.stat === "magicDef")
    ).length;

  let minDefBuffs = Infinity;
  for (const p of lowestHp) {
    const count = defensiveBuffCount(p);
    if (count < minDefBuffs) {
      minDefBuffs = count;
    }
  }

  const leastDefended = lowestHp.filter(
    (p) => defensiveBuffCount(p) === minDefBuffs
  );

  if (leastDefended.length === 1) {
    return leastDefended[0].playerId;
  }

  // 3. Random tiebreak
  const idx = Math.floor((randomFn ?? Math.random)() * leastDefended.length);
  return leastDefended[idx].playerId;
}

// ---------------------------------------------------------------------------
// resolveCoopTargets — resolve alvos com base no lado do caster e tipo de skill
// ---------------------------------------------------------------------------

export function resolveCoopTargets(params: {
  casterSide: "team" | "boss";
  caster: PlayerState;
  skillTarget: SkillTarget;
  team: PlayerState[];
  boss: PlayerState;
  targetId?: string;
  randomFn?: () => number;
}): PlayerState[] {
  const { casterSide, caster, skillTarget, team, boss, targetId, randomFn } =
    params;

  const aliveTeam = team.filter((p) => p.currentHp > 0);

  if (casterSide === "boss") {
    switch (skillTarget) {
      case "SINGLE_ENEMY": {
        const targetPlayerId = chooseBossTarget(aliveTeam, randomFn);
        const target = aliveTeam.find((p) => p.playerId === targetPlayerId);
        return target ? [target] : [];
      }
      case "ALL_ENEMIES":
        return aliveTeam;
      case "SELF":
        return [boss];
      case "SINGLE_ALLY":
        return [boss];
      case "ALL_ALLIES":
        return [boss];
      case "ALL":
        return [boss, ...aliveTeam];
      default:
        return aliveTeam;
    }
  }

  // casterSide === "team"
  switch (skillTarget) {
    case "SINGLE_ENEMY":
      return [boss];
    case "ALL_ENEMIES":
      return [boss];
    case "SELF":
      return [caster];
    case "SINGLE_ALLY": {
      if (targetId) {
        const target = aliveTeam.find((p) => p.playerId === targetId);
        if (target) return [target];
      }
      return [caster];
    }
    case "ALL_ALLIES":
      return aliveTeam;
    case "ALL":
      return [boss, ...aliveTeam];
    default:
      return [boss];
  }
}
