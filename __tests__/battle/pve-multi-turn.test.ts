import { describe, it, expect } from "vitest";
import {
  initMultiPveBattle,
  resolveMultiPveTurn,
} from "@/lib/battle/pve-multi-turn";
import type {
  BaseStats,
  EquippedSkill,
  PlayerState,
  ActiveCounter,
  ActiveStatusEffect,
} from "@/lib/battle/types";
import type {
  MobState,
  PveMultiBattleState,
} from "@/lib/battle/pve-multi-types";
import type { AiProfile } from "@/lib/battle/ai-profiles";
import type { Skill } from "@/types/skill";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeSkill(overrides?: Partial<Skill>): Skill {
  return {
    id: "test-skill",
    name: "Test Skill",
    description: "Skill de teste",
    tier: 1,
    cooldown: 0,
    target: "SINGLE_ENEMY",
    damageType: "PHYSICAL",
    basePower: 50,
    hits: 1,
    accuracy: 100,
    effects: [],
    mastery: {},
    ...overrides,
  };
}

function makeEquipped(skill: Skill, slot: number): EquippedSkill {
  return { skillId: skill.id, slotIndex: slot, skill };
}

function makeStats(overrides?: Partial<BaseStats>): BaseStats {
  return {
    physicalAtk: 20,
    physicalDef: 15,
    magicAtk: 18,
    magicDef: 14,
    hp: 200,
    speed: 15,
    ...overrides,
  };
}

const fixedRandom = () => 0.5;
const alwaysHitRandom = () => 0.01;

function makePlayerState(overrides?: Partial<PlayerState>): PlayerState {
  const skill = makeSkill();
  return {
    playerId: "player-1",
    characterId: "char-1",
    baseStats: makeStats(),
    currentHp: 200,
    stages: {
      physicalAtk: 0,
      physicalDef: 0,
      magicAtk: 0,
      magicDef: 0,
      speed: 0,
      accuracy: 0,
    },
    statusEffects: [],
    buffs: [],
    vulnerabilities: [],
    counters: [],
    cooldowns: {},
    combo: { skillId: null, stacks: 0 },
    equippedSkills: [makeEquipped(skill, 0)],
    ...overrides,
  };
}

function makeMobState(
  overrides?: Partial<MobState>,
  index: number = 0
): MobState {
  const mobSkill = makeSkill({
    id: `mob-skill-${index}`,
    name: `Mob Skill ${index}`,
    target: "SINGLE_ENEMY",
    basePower: 30,
    accuracy: 100,
  });
  return {
    playerId: `mob-player-${index}`,
    characterId: `mob-char-${index}`,
    baseStats: makeStats({ speed: 10 }),
    currentHp: 100,
    stages: {
      physicalAtk: 0,
      physicalDef: 0,
      magicAtk: 0,
      magicDef: 0,
      speed: 0,
      accuracy: 0,
    },
    statusEffects: [],
    buffs: [],
    vulnerabilities: [],
    counters: [],
    cooldowns: {},
    combo: { skillId: null, stacks: 0 },
    equippedSkills: [makeEquipped(mobSkill, 0)],
    mobId: `mob-${index}`,
    profile: "BALANCED" as AiProfile,
    defeated: false,
    ...overrides,
  };
}

function makeMultiBattleState(
  overrides?: Partial<PveMultiBattleState>
): PveMultiBattleState {
  return {
    battleId: "battle-1",
    player: makePlayerState(),
    mobs: [makeMobState({}, 0), makeMobState({}, 1), makeMobState({}, 2)],
    turnNumber: 1,
    status: "IN_PROGRESS",
    result: "PENDING",
    turnLog: [],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("initMultiPveBattle", () => {
  it("gera estado inicial correto (turnNumber 1, status IN_PROGRESS, result PENDING)", () => {
    const player = makePlayerState();
    const mobs: [MobState, MobState, MobState] = [
      makeMobState({}, 0),
      makeMobState({}, 1),
      makeMobState({}, 2),
    ];

    const state = initMultiPveBattle({
      battleId: "test-battle",
      player,
      mobs,
    });

    expect(state.turnNumber).toBe(1);
    expect(state.status).toBe("IN_PROGRESS");
    expect(state.result).toBe("PENDING");
    expect(state.battleId).toBe("test-battle");
    expect(state.turnLog).toEqual([]);
  });

  it("player e mobs sao armazenados corretamente", () => {
    const player = makePlayerState({ playerId: "p-custom" });
    const mobs: [MobState, MobState, MobState] = [
      makeMobState({ mobId: "m-a" }, 0),
      makeMobState({ mobId: "m-b" }, 1),
      makeMobState({ mobId: "m-c" }, 2),
    ];

    const state = initMultiPveBattle({
      battleId: "b-1",
      player,
      mobs,
    });

    expect(state.player.playerId).toBe("p-custom");
    expect(state.mobs[0].mobId).toBe("m-a");
    expect(state.mobs[1].mobId).toBe("m-b");
    expect(state.mobs[2].mobId).toBe("m-c");
  });

  it("nenhum mob comeca defeated", () => {
    const player = makePlayerState();
    const mobs: [MobState, MobState, MobState] = [
      makeMobState({}, 0),
      makeMobState({}, 1),
      makeMobState({}, 2),
    ];

    const state = initMultiPveBattle({
      battleId: "b-2",
      player,
      mobs,
    });

    expect(state.mobs[0].defeated).toBe(false);
    expect(state.mobs[1].defeated).toBe(false);
    expect(state.mobs[2].defeated).toBe(false);
  });
});

describe("resolveMultiPveTurn — acoes do player", () => {
  it("player ataca SINGLE_ENEMY: mob alvo toma dano, HP diminui", () => {
    const state = makeMultiBattleState();
    const initialHp = state.mobs[0].currentHp;

    const result = resolveMultiPveTurn(
      state,
      { skillId: "test-skill", targetIndex: 0 },
      alwaysHitRandom
    );

    expect(result.state.mobs[0].currentHp).toBeLessThan(initialHp);
  });

  it("player ataca ALL_ENEMIES: todos mobs vivos tomam dano", () => {
    const aoeSkill = makeSkill({
      id: "aoe-skill",
      name: "AOE Skill",
      target: "ALL_ENEMIES",
      basePower: 40,
    });
    const player = makePlayerState({
      equippedSkills: [makeEquipped(aoeSkill, 0)],
    });
    const state = makeMultiBattleState({ player });

    const mob0Hp = state.mobs[0].currentHp;
    const mob1Hp = state.mobs[1].currentHp;
    const mob2Hp = state.mobs[2].currentHp;

    const result = resolveMultiPveTurn(
      state,
      { skillId: "aoe-skill" },
      alwaysHitRandom
    );

    expect(result.state.mobs[0].currentHp).toBeLessThan(mob0Hp);
    expect(result.state.mobs[1].currentHp).toBeLessThan(mob1Hp);
    expect(result.state.mobs[2].currentHp).toBeLessThan(mob2Hp);
  });

  it("player usa SELF skill: nao toma dano direto da skill, mobs continuam agindo", () => {
    const selfSkill = makeSkill({
      id: "self-skill",
      name: "Self Buff",
      target: "SELF",
      damageType: "NONE",
      basePower: 0,
      effects: [
        {
          type: "BUFF",
          target: "SELF",
          stat: "physicalAtk",
          value: 1,
          duration: 3,
        },
      ],
    });
    const player = makePlayerState({
      equippedSkills: [makeEquipped(selfSkill, 0)],
      currentHp: 200,
    });
    const state = makeMultiBattleState({ player });

    const result = resolveMultiPveTurn(
      state,
      { skillId: "self-skill" },
      alwaysHitRandom
    );

    // Mobs agem e causam dano no player
    expect(result.state.player.currentHp).toBeLessThan(200);
  });

  it("skip turn (skillId null): player nao faz nada, mobs agem normalmente", () => {
    const state = makeMultiBattleState();
    const initialPlayerHp = state.player.currentHp;

    const result = resolveMultiPveTurn(
      state,
      { skillId: null },
      alwaysHitRandom
    );

    // Player nao atacou, entao mobs nao tomaram dano (exceto se mobs se auto-buffam)
    // Mas mobs atacam o player
    expect(result.state.player.currentHp).toBeLessThan(initialPlayerHp);

    // Verificar que houve evento SKIP
    const skipEvent = result.events.find(
      (e) => e.phase === "SKIP" && e.actorId === "player-1"
    );
    expect(skipEvent).toBeDefined();
  });
});

describe("resolveMultiPveTurn — validacoes", () => {
  it("targetIndex faltando para SINGLE_ENEMY gera evento INVALID", () => {
    const state = makeMultiBattleState();

    const result = resolveMultiPveTurn(
      state,
      { skillId: "test-skill" }, // sem targetIndex
      alwaysHitRandom
    );

    const invalidEvent = result.events.find((e) => e.phase === "INVALID");
    expect(invalidEvent).toBeDefined();
  });

  it("targetIndex apontando para mob defeated gera evento INVALID", () => {
    const state = makeMultiBattleState();
    state.mobs[1].defeated = true;
    state.mobs[1].currentHp = 0;

    const result = resolveMultiPveTurn(
      state,
      { skillId: "test-skill", targetIndex: 1 },
      alwaysHitRandom
    );

    const invalidEvent = result.events.find((e) => e.phase === "INVALID");
    expect(invalidEvent).toBeDefined();
  });

  it("skill em cooldown gera evento COOLDOWN", () => {
    const state = makeMultiBattleState();
    state.player.cooldowns["test-skill"] = 2;

    const result = resolveMultiPveTurn(
      state,
      { skillId: "test-skill", targetIndex: 0 },
      alwaysHitRandom
    );

    const cooldownEvent = result.events.find((e) => e.phase === "COOLDOWN");
    expect(cooldownEvent).toBeDefined();
  });
});

describe("resolveMultiPveTurn — mobs agindo", () => {
  it("mobs atacam o player apos turno do player (playerHp diminui)", () => {
    const state = makeMultiBattleState();
    const initialPlayerHp = state.player.currentHp;

    const result = resolveMultiPveTurn(
      state,
      { skillId: "test-skill", targetIndex: 0 },
      alwaysHitRandom
    );

    expect(result.state.player.currentHp).toBeLessThan(initialPlayerHp);
  });

  it("mob com STUN nao age", () => {
    const state = makeMultiBattleState();
    // Dar STUN a todos os 3 mobs para garantir que nenhum cause dano
    state.mobs[0].statusEffects = [
      { status: "STUN", remainingTurns: 2, turnsElapsed: 0 },
    ];
    state.mobs[1].statusEffects = [
      { status: "STUN", remainingTurns: 2, turnsElapsed: 0 },
    ];
    state.mobs[2].statusEffects = [
      { status: "STUN", remainingTurns: 2, turnsElapsed: 0 },
    ];

    const result = resolveMultiPveTurn(
      state,
      { skillId: "test-skill", targetIndex: 0 },
      alwaysHitRandom
    );

    // Mobs incapacitados nao devem causar DAMAGE no player
    const mobDamageEvents = result.events.filter(
      (e) =>
        e.phase === "DAMAGE" &&
        e.targetId === "player-1" &&
        e.actorId?.startsWith("mob-player")
    );
    expect(mobDamageEvents).toHaveLength(0);

    // Deve haver eventos INCAPACITATED para os mobs vivos
    const incapEvents = result.events.filter(
      (e) =>
        e.phase === "INCAPACITATED" && e.actorId?.startsWith("mob-player")
    );
    expect(incapEvents.length).toBeGreaterThan(0);
  });

  it("mob defeated nao age", () => {
    const state = makeMultiBattleState();
    state.mobs[0].defeated = true;
    state.mobs[0].currentHp = 0;
    state.mobs[1].defeated = true;
    state.mobs[1].currentHp = 0;
    // Apenas mob 2 esta vivo

    const initialPlayerHp = state.player.currentHp;

    const result = resolveMultiPveTurn(
      state,
      { skillId: "test-skill", targetIndex: 2 },
      alwaysHitRandom
    );

    // Verificar que mob 0 e 1 nao geraram evento de dano
    const mob0DamageEvents = result.events.filter(
      (e) => e.phase === "DAMAGE" && e.actorId === "mob-player-0"
    );
    const mob1DamageEvents = result.events.filter(
      (e) => e.phase === "DAMAGE" && e.actorId === "mob-player-1"
    );
    expect(mob0DamageEvents).toHaveLength(0);
    expect(mob1DamageEvents).toHaveLength(0);
  });

  it("mobs agem em ordem de speed DESC", () => {
    const mob0 = makeMobState({ baseStats: makeStats({ speed: 10 }) }, 0);
    const mob1 = makeMobState({ baseStats: makeStats({ speed: 20 }) }, 1);
    const mob2 = makeMobState({ baseStats: makeStats({ speed: 30 }) }, 2);
    const state = makeMultiBattleState({ mobs: [mob0, mob1, mob2] });

    const result = resolveMultiPveTurn(
      state,
      { skillId: null },
      alwaysHitRandom
    );

    // Encontrar eventos de DAMAGE dos mobs contra o player
    const mobActionEvents = result.events.filter(
      (e) =>
        (e.phase === "DAMAGE" || e.phase === "ACTION" || e.phase === "COMBO") &&
        e.actorId?.startsWith("mob-player") &&
        e.targetId === "player-1"
    );

    // Se temos pelo menos 2 eventos de mob acao, verificar ordem
    if (mobActionEvents.length >= 2) {
      const firstMobActorIdx = mobActionEvents.findIndex(
        (e) => e.actorId === "mob-player-2"
      );
      const secondMobActorIdx = mobActionEvents.findIndex(
        (e) => e.actorId === "mob-player-1"
      );
      const thirdMobActorIdx = mobActionEvents.findIndex(
        (e) => e.actorId === "mob-player-0"
      );

      // Speed 30 (mob-player-2) age antes de speed 20 (mob-player-1)
      if (firstMobActorIdx !== -1 && secondMobActorIdx !== -1) {
        expect(firstMobActorIdx).toBeLessThan(secondMobActorIdx);
      }
      // Speed 20 (mob-player-1) age antes de speed 10 (mob-player-0)
      if (secondMobActorIdx !== -1 && thirdMobActorIdx !== -1) {
        expect(secondMobActorIdx).toBeLessThan(thirdMobActorIdx);
      }
    }
  });
});

describe("resolveMultiPveTurn — vitoria e derrota", () => {
  it("matar todos 3 mobs resulta em VICTORY", () => {
    const strongSkill = makeSkill({
      id: "strong-skill",
      name: "Strong Skill",
      target: "ALL_ENEMIES",
      basePower: 500,
      accuracy: 100,
    });
    const player = makePlayerState({
      baseStats: makeStats({ physicalAtk: 100 }),
      equippedSkills: [makeEquipped(strongSkill, 0)],
    });
    const mobs: [MobState, MobState, MobState] = [
      makeMobState({ currentHp: 5, baseStats: makeStats({ hp: 5 }) }, 0),
      makeMobState({ currentHp: 5, baseStats: makeStats({ hp: 5 }) }, 1),
      makeMobState({ currentHp: 5, baseStats: makeStats({ hp: 5 }) }, 2),
    ];
    const state = makeMultiBattleState({ player, mobs });

    const result = resolveMultiPveTurn(
      state,
      { skillId: "strong-skill" },
      alwaysHitRandom
    );

    expect(result.state.status).toBe("FINISHED");
    expect(result.state.result).toBe("VICTORY");
    expect(result.state.mobs.every((m) => m.defeated)).toBe(true);
  });

  it("player morre por dano de mob resulta em DEFEAT", () => {
    const weakPlayer = makePlayerState({
      currentHp: 10,
      baseStats: makeStats({ hp: 10, physicalDef: 1 }),
    });
    const strongMob = makeMobState(
      {
        baseStats: makeStats({ physicalAtk: 100 }),
        equippedSkills: [
          makeEquipped(
            makeSkill({
              id: "mob-skill-0",
              name: "Mob Skill 0",
              basePower: 200,
              accuracy: 100,
            }),
            0
          ),
        ],
      },
      0
    );
    const state = makeMultiBattleState({
      player: weakPlayer,
      mobs: [strongMob, makeMobState({}, 1), makeMobState({}, 2)],
    });

    const result = resolveMultiPveTurn(
      state,
      { skillId: null },
      alwaysHitRandom
    );

    expect(result.state.status).toBe("FINISHED");
    expect(result.state.result).toBe("DEFEAT");
    expect(result.state.player.currentHp).toBeLessThanOrEqual(0);
  });

  it("player morre por dano de status (BURN) resulta em DEFEAT", () => {
    // Player com 1 HP e BURN ativo - status damage mata antes de agir
    const burnPlayer = makePlayerState({
      currentHp: 1,
      baseStats: makeStats({ hp: 200 }),
      statusEffects: [
        { status: "BURN", remainingTurns: 3, turnsElapsed: 0 },
      ],
    });
    const state = makeMultiBattleState({ player: burnPlayer });

    const result = resolveMultiPveTurn(
      state,
      { skillId: "test-skill", targetIndex: 0 },
      alwaysHitRandom
    );

    expect(result.state.status).toBe("FINISHED");
    expect(result.state.result).toBe("DEFEAT");
  });

  it("batalha ja FINISHED retorna sem mudancas", () => {
    const state = makeMultiBattleState({
      status: "FINISHED",
      result: "VICTORY",
    });

    const result = resolveMultiPveTurn(
      state,
      { skillId: "test-skill", targetIndex: 0 },
      alwaysHitRandom
    );

    expect(result.events).toEqual([]);
    expect(result.state.status).toBe("FINISHED");
    expect(result.state.result).toBe("VICTORY");
  });
});

describe("resolveMultiPveTurn — cooldowns", () => {
  it("skill com cooldown 2 fica em cooldown apos uso", () => {
    const cdSkill = makeSkill({
      id: "cd-skill",
      name: "Cooldown Skill",
      cooldown: 2,
      target: "SINGLE_ENEMY",
      accuracy: 100,
    });
    const player = makePlayerState({
      equippedSkills: [makeEquipped(cdSkill, 0)],
    });
    const state = makeMultiBattleState({ player });

    // Primeiro turno: usa a skill
    const result1 = resolveMultiPveTurn(
      state,
      { skillId: "cd-skill", targetIndex: 0 },
      alwaysHitRandom
    );

    // Segundo turno: tenta usar de novo, deve estar em cooldown
    const result2 = resolveMultiPveTurn(
      result1.state,
      { skillId: "cd-skill", targetIndex: 0 },
      alwaysHitRandom
    );

    const cooldownEvent = result2.events.find((e) => e.phase === "COOLDOWN");
    expect(cooldownEvent).toBeDefined();
  });
});

describe("resolveMultiPveTurn — counter", () => {
  it("player ataca mob com counter ativo: player toma counter damage", () => {
    const counterMob = makeMobState(
      {
        counters: [
          {
            id: "counter-1",
            powerMultiplier: 0.5,
            remainingTurns: 3,
          } as ActiveCounter,
        ],
      },
      0
    );
    const state = makeMultiBattleState({
      mobs: [counterMob, makeMobState({}, 1), makeMobState({}, 2)],
    });
    const initialPlayerHp = state.player.currentHp;

    const result = resolveMultiPveTurn(
      state,
      { skillId: "test-skill", targetIndex: 0 },
      alwaysHitRandom
    );

    // Player deve ter tomado counter damage
    const counterEvent = result.events.find(
      (e) => e.phase === "COUNTER" && e.targetId === "player-1"
    );
    expect(counterEvent).toBeDefined();
    expect(counterEvent!.damage).toBeGreaterThan(0);
  });

  it("mob ataca player com counter ativo: mob toma counter damage", () => {
    const player = makePlayerState({
      counters: [
        {
          id: "player-counter",
          powerMultiplier: 0.5,
          remainingTurns: 3,
        } as ActiveCounter,
      ],
    });
    // Dar stun aos mobs 1 e 2 para so mob 0 agir
    const mob0 = makeMobState({}, 0);
    const mob1 = makeMobState(
      { statusEffects: [{ status: "STUN", remainingTurns: 2, turnsElapsed: 0 }] },
      1
    );
    const mob2 = makeMobState(
      { statusEffects: [{ status: "STUN", remainingTurns: 2, turnsElapsed: 0 }] },
      2
    );
    const state = makeMultiBattleState({ player, mobs: [mob0, mob1, mob2] });

    const initialMob0Hp = state.mobs[0].currentHp;

    const result = resolveMultiPveTurn(
      state,
      { skillId: null },
      alwaysHitRandom
    );

    // Mob deve ter tomado counter damage
    const counterEvent = result.events.find(
      (e) =>
        e.phase === "COUNTER" &&
        e.actorId === "player-1" &&
        e.targetId === "mob-player-0"
    );
    expect(counterEvent).toBeDefined();
    expect(result.state.mobs[0].currentHp).toBeLessThan(initialMob0Hp);
  });
});

describe("resolveMultiPveTurn — edge cases", () => {
  it("ALL_ENEMIES quando 2 dos 3 mobs estao defeated: apenas o mob vivo toma dano", () => {
    const aoeSkill = makeSkill({
      id: "aoe-skill",
      name: "AOE Skill",
      target: "ALL_ENEMIES",
      basePower: 40,
      accuracy: 100,
    });
    const player = makePlayerState({
      equippedSkills: [makeEquipped(aoeSkill, 0)],
    });
    const state = makeMultiBattleState({ player });
    state.mobs[0].defeated = true;
    state.mobs[0].currentHp = 0;
    state.mobs[1].defeated = true;
    state.mobs[1].currentHp = 0;
    // Apenas mob 2 esta vivo
    const mob2InitialHp = state.mobs[2].currentHp;

    const result = resolveMultiPveTurn(
      state,
      { skillId: "aoe-skill" },
      alwaysHitRandom
    );

    // Mob 2 tomou dano
    expect(result.state.mobs[2].currentHp).toBeLessThan(mob2InitialHp);
    // Mobs 0 e 1 continuam com 0 HP
    expect(result.state.mobs[0].currentHp).toBe(0);
    expect(result.state.mobs[1].currentHp).toBe(0);
  });

  it("player mata ultimo mob com ALL_ENEMIES: result VICTORY, mobs mortos nao agem", () => {
    const aoeSkill = makeSkill({
      id: "aoe-kill",
      name: "AOE Kill",
      target: "ALL_ENEMIES",
      basePower: 500,
      accuracy: 100,
    });
    const player = makePlayerState({
      baseStats: makeStats({ physicalAtk: 100 }),
      equippedSkills: [makeEquipped(aoeSkill, 0)],
    });
    const state = makeMultiBattleState({ player });
    state.mobs[0].defeated = true;
    state.mobs[0].currentHp = 0;
    state.mobs[1].defeated = true;
    state.mobs[1].currentHp = 0;
    // Mob 2 com pouco HP
    state.mobs[2].currentHp = 5;
    state.mobs[2].baseStats.hp = 5;

    const result = resolveMultiPveTurn(
      state,
      { skillId: "aoe-kill" },
      alwaysHitRandom
    );

    expect(result.state.status).toBe("FINISHED");
    expect(result.state.result).toBe("VICTORY");

    // Mobs nao devem ter agido (sem eventos de DAMAGE de mobs contra player)
    const mobDamageOnPlayer = result.events.filter(
      (e) =>
        e.phase === "DAMAGE" &&
        e.actorId?.startsWith("mob-player") &&
        e.targetId === "player-1"
    );
    expect(mobDamageOnPlayer).toHaveLength(0);
  });
});
