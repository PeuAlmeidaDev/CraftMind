import {
  addToSoloQueue,
  removeFromSoloQueue,
  findSoloMatch,
  getSoloQueuePosition,
  getSoloQueueSize,
  addToDuoQueue,
  removeFromDuoQueue,
  findDuoMatch,
  getDuoQueuePosition,
  getDuoQueueSize,
  isInAnyQueue,
  removeFromAnyQueue,
} from "../pvp-team-queue-store";
import type { PvpTeamQueueEntry, PvpTeamDuoEntry } from "../pvp-team-queue-store";
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

function makeEntry(userId: string): PvpTeamQueueEntry {
  return {
    userId,
    socketId: `socket-${userId}`,
    characterId: `char-${userId}`,
    stats: makeStats(),
    skills: [makeEquipped(ataqueRapido, 0)],
    joinedAt: Date.now(),
  };
}

function makeDuo(user1: string, user2: string): PvpTeamDuoEntry {
  return {
    player1: makeEntry(user1),
    player2: makeEntry(user2),
    joinedAt: Date.now(),
  };
}

// ---------------------------------------------------------------------------
// Cleanup: como os stores sao modulos singleton, precisamos limpar entre testes
// ---------------------------------------------------------------------------

afterEach(() => {
  // Remover todos os usuarios conhecidos de qualquer fila
  const knownIds = [
    "solo1", "solo2", "solo3", "solo4", "solo5", "solo6", "solo7", "solo8",
    "duo1a", "duo1b", "duo2a", "duo2b", "duo3a", "duo3b", "duo4a", "duo4b",
    "ghost",
  ];
  for (const id of knownIds) {
    removeFromAnyQueue(id);
  }
});

// ---------------------------------------------------------------------------
// Solo Queue
// ---------------------------------------------------------------------------

describe("pvp-team-queue-store — solo queue", () => {
  it("addToSoloQueue adiciona jogador com sucesso", () => {
    expect(addToSoloQueue(makeEntry("solo1"))).toBe(true);
    expect(getSoloQueueSize()).toBe(1);
  });

  it("addToSoloQueue retorna false se jogador ja esta em alguma fila", () => {
    addToSoloQueue(makeEntry("solo1"));
    expect(addToSoloQueue(makeEntry("solo1"))).toBe(false);
  });

  it("removeFromSoloQueue remove jogador existente", () => {
    addToSoloQueue(makeEntry("solo1"));
    expect(removeFromSoloQueue("solo1")).toBe(true);
    expect(getSoloQueueSize()).toBe(0);
  });

  it("removeFromSoloQueue retorna false se jogador nao esta na fila", () => {
    expect(removeFromSoloQueue("ghost")).toBe(false);
  });

  it("getSoloQueuePosition retorna posicao correta (1-based)", () => {
    addToSoloQueue(makeEntry("solo1"));
    addToSoloQueue(makeEntry("solo2"));
    addToSoloQueue(makeEntry("solo3"));

    expect(getSoloQueuePosition("solo1")).toBe(1);
    expect(getSoloQueuePosition("solo2")).toBe(2);
    expect(getSoloQueuePosition("solo3")).toBe(3);
  });

  it("getSoloQueuePosition retorna null se jogador nao esta na fila", () => {
    expect(getSoloQueuePosition("ghost")).toBeNull();
  });

  it("findSoloMatch retorna null quando menos de 4 jogadores", () => {
    addToSoloQueue(makeEntry("solo1"));
    addToSoloQueue(makeEntry("solo2"));
    addToSoloQueue(makeEntry("solo3"));

    expect(findSoloMatch()).toBeNull();
  });

  it("findSoloMatch retorna 4 jogadores e remove da fila quando >= 4", () => {
    addToSoloQueue(makeEntry("solo1"));
    addToSoloQueue(makeEntry("solo2"));
    addToSoloQueue(makeEntry("solo3"));
    addToSoloQueue(makeEntry("solo4"));

    const match = findSoloMatch();

    expect(match).not.toBeNull();
    expect(match).toHaveLength(4);
    expect(getSoloQueueSize()).toBe(0);
  });

  it("findSoloMatch deixa jogadores extras na fila", () => {
    addToSoloQueue(makeEntry("solo1"));
    addToSoloQueue(makeEntry("solo2"));
    addToSoloQueue(makeEntry("solo3"));
    addToSoloQueue(makeEntry("solo4"));
    addToSoloQueue(makeEntry("solo5"));

    const match = findSoloMatch();
    expect(match).toHaveLength(4);
    expect(getSoloQueueSize()).toBe(1);
    expect(getSoloQueuePosition("solo5")).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Duo Queue
// ---------------------------------------------------------------------------

describe("pvp-team-queue-store — duo queue", () => {
  it("addToDuoQueue adiciona dupla com sucesso", () => {
    expect(addToDuoQueue(makeDuo("duo1a", "duo1b"))).toBe(true);
    expect(getDuoQueueSize()).toBe(1);
  });

  it("addToDuoQueue retorna false se player1 ja esta em fila", () => {
    addToSoloQueue(makeEntry("duo1a"));
    expect(addToDuoQueue(makeDuo("duo1a", "duo1b"))).toBe(false);
  });

  it("addToDuoQueue retorna false se player2 ja esta em fila", () => {
    addToSoloQueue(makeEntry("duo1b"));
    expect(addToDuoQueue(makeDuo("duo1a", "duo1b"))).toBe(false);
  });

  it("removeFromDuoQueue remove dupla por userId do player1", () => {
    addToDuoQueue(makeDuo("duo1a", "duo1b"));
    expect(removeFromDuoQueue("duo1a")).toBe(true);
    expect(getDuoQueueSize()).toBe(0);
  });

  it("removeFromDuoQueue remove dupla por userId do player2", () => {
    addToDuoQueue(makeDuo("duo1a", "duo1b"));
    expect(removeFromDuoQueue("duo1b")).toBe(true);
    expect(getDuoQueueSize()).toBe(0);
  });

  it("removeFromDuoQueue retorna false se ninguem da dupla esta na fila", () => {
    expect(removeFromDuoQueue("ghost")).toBe(false);
  });

  it("getDuoQueuePosition retorna posicao correta (1-based) por qualquer membro", () => {
    addToDuoQueue(makeDuo("duo1a", "duo1b"));
    addToDuoQueue(makeDuo("duo2a", "duo2b"));

    expect(getDuoQueuePosition("duo1a")).toBe(1);
    expect(getDuoQueuePosition("duo1b")).toBe(1);
    expect(getDuoQueuePosition("duo2a")).toBe(2);
    expect(getDuoQueuePosition("duo2b")).toBe(2);
  });

  it("getDuoQueuePosition retorna null se jogador nao esta na fila", () => {
    expect(getDuoQueuePosition("ghost")).toBeNull();
  });

  it("findDuoMatch retorna null quando menos de 2 duplas", () => {
    addToDuoQueue(makeDuo("duo1a", "duo1b"));
    expect(findDuoMatch()).toBeNull();
  });

  it("findDuoMatch retorna 2 duplas e remove da fila", () => {
    addToDuoQueue(makeDuo("duo1a", "duo1b"));
    addToDuoQueue(makeDuo("duo2a", "duo2b"));

    const match = findDuoMatch();

    expect(match).not.toBeNull();
    expect(match).toHaveLength(2);
    expect(getDuoQueueSize()).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Shared: isInAnyQueue, removeFromAnyQueue
// ---------------------------------------------------------------------------

describe("pvp-team-queue-store — shared", () => {
  it("isInAnyQueue retorna true para jogador na solo queue", () => {
    addToSoloQueue(makeEntry("solo1"));
    expect(isInAnyQueue("solo1")).toBe(true);
  });

  it("isInAnyQueue retorna true para jogador na duo queue (player1)", () => {
    addToDuoQueue(makeDuo("duo1a", "duo1b"));
    expect(isInAnyQueue("duo1a")).toBe(true);
  });

  it("isInAnyQueue retorna true para jogador na duo queue (player2)", () => {
    addToDuoQueue(makeDuo("duo1a", "duo1b"));
    expect(isInAnyQueue("duo1b")).toBe(true);
  });

  it("isInAnyQueue retorna false para jogador fora de qualquer fila", () => {
    expect(isInAnyQueue("ghost")).toBe(false);
  });

  it("removeFromAnyQueue remove da solo queue", () => {
    addToSoloQueue(makeEntry("solo1"));
    removeFromAnyQueue("solo1");
    expect(isInAnyQueue("solo1")).toBe(false);
  });

  it("removeFromAnyQueue remove da duo queue", () => {
    addToDuoQueue(makeDuo("duo1a", "duo1b"));
    removeFromAnyQueue("duo1a");
    expect(isInAnyQueue("duo1a")).toBe(false);
    expect(isInAnyQueue("duo1b")).toBe(false);
  });

  it("removeFromAnyQueue nao lanca erro para jogador inexistente", () => {
    expect(() => removeFromAnyQueue("ghost")).not.toThrow();
  });
});
