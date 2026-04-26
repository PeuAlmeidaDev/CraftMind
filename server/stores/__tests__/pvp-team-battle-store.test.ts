import {
  setPvpTeamBattle,
  getPvpTeamBattle,
  removePvpTeamBattle,
  getPlayerPvpTeamBattle,
  updatePvpTeamPlayerSocket,
} from "../pvp-team-battle-store";
import type { PvpTeamBattleSession } from "../../../lib/battle/pvp-team-types";
import { initPvpTeamBattle } from "../../../lib/battle/pvp-team-turn";
import type { BaseStats, EquippedSkill } from "../../../lib/battle/types";
import type { Skill } from "../../../types/skill";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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
  return { physicalAtk: 20, physicalDef: 15, magicAtk: 10, magicDef: 10, hp: 200, speed: 12 };
}

function makeEquipped(skill: Skill, slot: number): EquippedSkill {
  return { skillId: skill.id, slotIndex: slot, skill };
}

function makeSession(battleId: string, userIds: [string, string, string, string]): PvpTeamBattleSession {
  const state = initPvpTeamBattle({
    battleId,
    team1: [
      { userId: userIds[0], characterId: `char-${userIds[0]}`, stats: makeStats(), skills: [makeEquipped(ataqueRapido, 0)] },
      { userId: userIds[1], characterId: `char-${userIds[1]}`, stats: makeStats(), skills: [makeEquipped(ataqueRapido, 0)] },
    ],
    team2: [
      { userId: userIds[2], characterId: `char-${userIds[2]}`, stats: makeStats(), skills: [makeEquipped(ataqueRapido, 0)] },
      { userId: userIds[3], characterId: `char-${userIds[3]}`, stats: makeStats(), skills: [makeEquipped(ataqueRapido, 0)] },
    ],
    mode: "TEAM_2V2",
  });

  const playerSockets = new Map<string, string>();
  const playerNames = new Map<string, string>();
  const playerAvatars = new Map<string, string | null>();
  const playerHouses = new Map<string, string>();
  const playerTeams = new Map<string, 1 | 2>();

  for (const uid of userIds) {
    playerSockets.set(uid, `socket-${uid}`);
    playerNames.set(uid, `Player ${uid}`);
    playerAvatars.set(uid, null);
    playerHouses.set(uid, "LYCUS");
  }
  playerTeams.set(userIds[0], 1);
  playerTeams.set(userIds[1], 1);
  playerTeams.set(userIds[2], 2);
  playerTeams.set(userIds[3], 2);

  return {
    battleId,
    state,
    playerSockets,
    playerNames,
    playerAvatars,
    playerHouses,
    playerTeams,
    pendingActions: new Map(),
    turnTimer: null,
    matchAccepted: new Set(),
    matchTimer: null,
    disconnectedPlayers: new Map(),
    autoSkipPlayers: new Set(),
    lastActivityAt: Date.now(),
  };
}

// ---------------------------------------------------------------------------
// Tracking para cleanup
// ---------------------------------------------------------------------------

const trackedBattleIds: string[] = [];

afterEach(() => {
  for (const id of trackedBattleIds) {
    removePvpTeamBattle(id);
  }
  trackedBattleIds.length = 0;
});

// ---------------------------------------------------------------------------
// Testes
// ---------------------------------------------------------------------------

describe("pvp-team-battle-store", () => {
  it("setPvpTeamBattle + getPvpTeamBattle retorna a session", () => {
    const session = makeSession("bt-1", ["u1", "u2", "u3", "u4"]);
    trackedBattleIds.push("bt-1");

    setPvpTeamBattle("bt-1", session);
    const retrieved = getPvpTeamBattle("bt-1");

    expect(retrieved).toBeDefined();
    expect(retrieved!.battleId).toBe("bt-1");
    expect(retrieved!.state.team1).toHaveLength(2);
    expect(retrieved!.state.team2).toHaveLength(2);
  });

  it("getPvpTeamBattle retorna undefined para battleId inexistente", () => {
    expect(getPvpTeamBattle("bt-inexistente")).toBeUndefined();
  });

  it("removePvpTeamBattle remove a session", () => {
    const session = makeSession("bt-2", ["u5", "u6", "u7", "u8"]);
    trackedBattleIds.push("bt-2");

    setPvpTeamBattle("bt-2", session);
    removePvpTeamBattle("bt-2");

    expect(getPvpTeamBattle("bt-2")).toBeUndefined();
  });

  it("removePvpTeamBattle nao lanca erro para battleId inexistente", () => {
    expect(() => removePvpTeamBattle("bt-ghost")).not.toThrow();
  });

  it("getPlayerPvpTeamBattle encontra session por userId do team1", () => {
    const session = makeSession("bt-3", ["u9", "u10", "u11", "u12"]);
    trackedBattleIds.push("bt-3");

    setPvpTeamBattle("bt-3", session);
    const result = getPlayerPvpTeamBattle("u9");

    expect(result).toBeDefined();
    expect(result!.battleId).toBe("bt-3");
  });

  it("getPlayerPvpTeamBattle encontra session por userId do team2", () => {
    const session = makeSession("bt-4", ["u13", "u14", "u15", "u16"]);
    trackedBattleIds.push("bt-4");

    setPvpTeamBattle("bt-4", session);
    const result = getPlayerPvpTeamBattle("u16");

    expect(result).toBeDefined();
    expect(result!.battleId).toBe("bt-4");
  });

  it("getPlayerPvpTeamBattle retorna undefined para userId nao participante", () => {
    expect(getPlayerPvpTeamBattle("ghost")).toBeUndefined();
  });

  it("getPlayerPvpTeamBattle ignora sessions FINISHED", () => {
    const session = makeSession("bt-5", ["u17", "u18", "u19", "u20"]);
    session.state.status = "FINISHED";
    trackedBattleIds.push("bt-5");

    setPvpTeamBattle("bt-5", session);
    const result = getPlayerPvpTeamBattle("u17");

    expect(result).toBeUndefined();
  });

  it("updatePvpTeamPlayerSocket atualiza o socketId de um jogador", () => {
    const session = makeSession("bt-6", ["u21", "u22", "u23", "u24"]);
    trackedBattleIds.push("bt-6");

    setPvpTeamBattle("bt-6", session);
    updatePvpTeamPlayerSocket("bt-6", "u21", "new-socket-u21");

    const retrieved = getPvpTeamBattle("bt-6");
    expect(retrieved!.playerSockets.get("u21")).toBe("new-socket-u21");
  });

  it("updatePvpTeamPlayerSocket ignora userId que nao esta no playerSockets", () => {
    const session = makeSession("bt-7", ["u25", "u26", "u27", "u28"]);
    trackedBattleIds.push("bt-7");

    setPvpTeamBattle("bt-7", session);
    updatePvpTeamPlayerSocket("bt-7", "ghost", "socket-ghost");

    const retrieved = getPvpTeamBattle("bt-7");
    expect(retrieved!.playerSockets.has("ghost")).toBe(false);
  });

  it("getPvpTeamBattle retorna undefined para session expirada (TTL)", () => {
    const session = makeSession("bt-8", ["u29", "u30", "u31", "u32"]);
    // Simular lastActivityAt ha 31 minutos
    session.lastActivityAt = Date.now() - 31 * 60 * 1000;
    trackedBattleIds.push("bt-8");

    setPvpTeamBattle("bt-8", session);
    const result = getPvpTeamBattle("bt-8");

    expect(result).toBeUndefined();
  });

  it("getPlayerPvpTeamBattle retorna undefined para session expirada (TTL)", () => {
    const session = makeSession("bt-9", ["u33", "u34", "u35", "u36"]);
    session.lastActivityAt = Date.now() - 31 * 60 * 1000;
    trackedBattleIds.push("bt-9");

    setPvpTeamBattle("bt-9", session);
    const result = getPlayerPvpTeamBattle("u33");

    expect(result).toBeUndefined();
  });
});
