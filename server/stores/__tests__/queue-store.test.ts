import {
  addToQueue,
  removeFromQueue,
  findMatch,
  getQueueSize,
  isInQueue,
} from "../queue-store";
import type { QueueEntry } from "../queue-store";
import type { BaseStats, EquippedSkill } from "../../../lib/battle/types";
import type { Skill } from "../../../types/skill";

const minimalSkill: Skill = {
  id: "skill-test",
  name: "Golpe Teste",
  description: "Skill para testes",
  tier: 1,
  cooldown: 0,
  target: "SINGLE_ENEMY",
  damageType: "PHYSICAL",
  basePower: 30,
  hits: 1,
  accuracy: 100,
  effects: [],
  mastery: {},
};

function makeQueueEntry(userId: string, socketId?: string): QueueEntry {
  const stats: BaseStats = {
    physicalAtk: 10,
    physicalDef: 10,
    magicAtk: 10,
    magicDef: 10,
    hp: 100,
    speed: 10,
  };

  const skills: EquippedSkill[] = [
    { skillId: minimalSkill.id, slotIndex: 0, skill: minimalSkill },
  ];

  return {
    userId,
    socketId: socketId ?? `socket-${userId}`,
    characterId: `char-${userId}`,
    stats,
    skills,
    joinedAt: Date.now(),
  };
}

describe("queue-store", () => {
  const usedUserIds: string[] = [];

  function trackUser(userId: string): string {
    usedUserIds.push(userId);
    return userId;
  }

  afterEach(() => {
    for (const id of usedUserIds) {
      removeFromQueue(id);
    }
    usedUserIds.length = 0;
  });

  it("addToQueue + isInQueue retorna true", () => {
    const userId = trackUser("user-1");
    addToQueue(makeQueueEntry(userId));

    expect(isInQueue(userId)).toBe(true);
  });

  it("isInQueue retorna false para userId nao adicionado", () => {
    expect(isInQueue("user-inexistente")).toBe(false);
  });

  it("removeFromQueue retorna true se o usuario existia na fila", () => {
    const userId = trackUser("user-2");
    addToQueue(makeQueueEntry(userId));

    expect(removeFromQueue(userId)).toBe(true);
  });

  it("removeFromQueue retorna false se o usuario nao existia na fila", () => {
    expect(removeFromQueue("user-fantasma")).toBe(false);
  });

  it("findMatch retorna outro jogador e o remove da fila", () => {
    const userId1 = trackUser("user-3");
    const userId2 = trackUser("user-4");
    addToQueue(makeQueueEntry(userId1));
    addToQueue(makeQueueEntry(userId2));

    const match = findMatch(userId1);

    expect(match).not.toBeNull();
    expect(match!.userId).toBe(userId2);
    expect(isInQueue(userId2)).toBe(false);
  });

  it("findMatch retorna null se fila esta vazia", () => {
    const userId = trackUser("user-5");
    expect(findMatch(userId)).toBeNull();
  });

  it("findMatch retorna null se a fila so tem o proprio jogador", () => {
    const userId = trackUser("user-6");
    addToQueue(makeQueueEntry(userId));

    expect(findMatch(userId)).toBeNull();
  });

  it("getQueueSize reflete operacoes de add e remove", () => {
    const userId1 = trackUser("user-7");
    const userId2 = trackUser("user-8");

    expect(getQueueSize()).toBe(0);

    addToQueue(makeQueueEntry(userId1));
    expect(getQueueSize()).toBe(1);

    addToQueue(makeQueueEntry(userId2));
    expect(getQueueSize()).toBe(2);

    removeFromQueue(userId1);
    expect(getQueueSize()).toBe(1);
  });
});
