import {
  getPvpBattle,
  setPvpBattle,
  removePvpBattle,
  getPlayerBattle,
} from "../pvp-store";
import type { PvpBattleSession } from "../pvp-store";
import { initBattle } from "../../../lib/battle/init";
import type { EquippedSkill, BaseStats } from "../../../lib/battle/types";
import type { Skill } from "../../../types/skill";

const ataqueRapido: Skill = {
  id: "skill-ataque-rapido",
  name: "Ataque Rapido",
  description: "Golpe fisico basico",
  tier: 1,
  cooldown: 0,
  target: "SINGLE_ENEMY",
  damageType: "PHYSICAL",
  basePower: 40,
  hits: 1,
  accuracy: 100,
  effects: [],
  mastery: {},
};

function makeStats(): BaseStats {
  return {
    physicalAtk: 20,
    physicalDef: 15,
    magicAtk: 10,
    magicDef: 10,
    hp: 200,
    speed: 12,
  };
}

function makeEquipped(skill: Skill, slot: number): EquippedSkill {
  return { skillId: skill.id, slotIndex: slot, skill };
}

function makePvpSession(userId1: string, userId2: string): {
  battleId: string;
  session: PvpBattleSession;
} {
  const battleId = `battle-${userId1}-${userId2}`;
  const state = initBattle({
    battleId,
    player1: {
      userId: userId1,
      characterId: `char-${userId1}`,
      stats: makeStats(),
      skills: [makeEquipped(ataqueRapido, 0)],
    },
    player2: {
      userId: userId2,
      characterId: `char-${userId2}`,
      stats: makeStats(),
      skills: [makeEquipped(ataqueRapido, 0)],
    },
  });

  const session: PvpBattleSession = {
    state,
    player1SocketId: `socket-${userId1}`,
    player2SocketId: `socket-${userId2}`,
    pendingActions: new Map(),
    turnTimer: null,
  };

  return { battleId, session };
}

describe("pvp-store", () => {
  const trackedBattleIds: string[] = [];

  afterEach(() => {
    for (const id of trackedBattleIds) {
      removePvpBattle(id);
    }
    trackedBattleIds.length = 0;
  });

  it("setPvpBattle + getPvpBattle retorna a session", () => {
    const { battleId, session } = makePvpSession("p1", "p2");
    trackedBattleIds.push(battleId);

    setPvpBattle(battleId, session);
    const retrieved = getPvpBattle(battleId);

    expect(retrieved).toBeDefined();
    expect(retrieved!.state.battleId).toBe(battleId);
  });

  it("getPvpBattle retorna undefined para battleId inexistente", () => {
    expect(getPvpBattle("battle-inexistente")).toBeUndefined();
  });

  it("removePvpBattle remove a session e getPvpBattle retorna undefined", () => {
    const { battleId, session } = makePvpSession("p3", "p4");
    trackedBattleIds.push(battleId);

    setPvpBattle(battleId, session);
    removePvpBattle(battleId);

    expect(getPvpBattle(battleId)).toBeUndefined();
  });

  it("getPlayerBattle encontra session pelo userId do player1", () => {
    const { battleId, session } = makePvpSession("p5", "p6");
    trackedBattleIds.push(battleId);

    setPvpBattle(battleId, session);
    const result = getPlayerBattle("p5");

    expect(result).toBeDefined();
    expect(result!.battleId).toBe(battleId);
  });

  it("getPlayerBattle encontra session pelo userId do player2", () => {
    const { battleId, session } = makePvpSession("p7", "p8");
    trackedBattleIds.push(battleId);

    setPvpBattle(battleId, session);
    const result = getPlayerBattle("p8");

    expect(result).toBeDefined();
    expect(result!.battleId).toBe(battleId);
  });

  it("getPlayerBattle retorna undefined se userId nao esta em batalha", () => {
    expect(getPlayerBattle("user-fantasma")).toBeUndefined();
  });
});
