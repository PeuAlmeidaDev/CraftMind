import { describe, it, expect } from "vitest";
import { initCoopBattle, resolveCoopTurn } from "@/lib/battle/coop-turn";
import type { BaseStats, EquippedSkill, PlayerState } from "@/lib/battle/types";
import type { CoopBattleState, CoopBattlePlayerConfig, CoopBossBattleConfig, CoopTurnAction } from "@/lib/battle/coop-types";
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

const basicAttack = makeSkill({
  id: "basic-attack",
  name: "Ataque Basico",
  basePower: 50,
  accuracy: 100,
});

const weakAttack = makeSkill({
  id: "weak-attack",
  name: "Ataque Fraco",
  basePower: 10,
  accuracy: 100,
});

const bossAttack = makeSkill({
  id: "boss-attack",
  name: "Boss Attack",
  basePower: 40,
  accuracy: 100,
});

/** Random deterministico (always hit, dano medio) */
const fixedRandom = () => 0.5;

/** Random que sempre acerta tudo (para garantir hits e efeitos) */
const alwaysHitRandom = () => 0.01;

function makePlayerConfig(
  userId: string,
  skills?: Skill[],
  statsOverrides?: Partial<BaseStats>
): CoopBattlePlayerConfig {
  const skillList = skills ?? [basicAttack];
  return {
    userId,
    characterId: `char-${userId}`,
    stats: makeStats(statsOverrides),
    skills: skillList.map((s, i) => makeEquipped(s, i)),
  };
}

function makeCoopConfig(overrides?: {
  team?: CoopBattlePlayerConfig[];
  boss?: CoopBattlePlayerConfig;
  battleId?: string;
}): CoopBossBattleConfig {
  return {
    battleId: overrides?.battleId ?? "coop-test",
    team: overrides?.team ?? [
      makePlayerConfig("p1"),
      makePlayerConfig("p2"),
      makePlayerConfig("p3"),
    ],
    boss: overrides?.boss ?? makePlayerConfig("boss", [bossAttack], { hp: 600, physicalAtk: 30, speed: 10 }),
  };
}

function makeTeamActions(
  state: CoopBattleState,
  skillId: string | null = basicAttack.id
): CoopTurnAction[] {
  return state.team.map((p) => ({
    playerId: p.playerId,
    skillId,
  }));
}

// ---------------------------------------------------------------------------
// initCoopBattle
// ---------------------------------------------------------------------------

describe("initCoopBattle", () => {
  it("cria CoopBattleState com 3 players e 1 boss", () => {
    const config = makeCoopConfig();
    const state = initCoopBattle(config);

    expect(state.team).toHaveLength(3);
    expect(state.boss.playerId).toBe("boss");
    expect(state.battleId).toBe("coop-test");
  });

  it("valida que team.length === 3", () => {
    const config = makeCoopConfig();
    const state = initCoopBattle(config);
    expect(state.team.length).toBe(3);
  });

  it("lanca erro se team nao tem 3 players (2 players)", () => {
    const config = makeCoopConfig({
      team: [makePlayerConfig("p1"), makePlayerConfig("p2")],
    });
    expect(() => initCoopBattle(config)).toThrow(
      "requer exatamente 3 jogadores"
    );
  });

  it("lanca erro se team nao tem 3 players (4 players)", () => {
    const config = makeCoopConfig({
      team: [
        makePlayerConfig("p1"),
        makePlayerConfig("p2"),
        makePlayerConfig("p3"),
        makePlayerConfig("p4"),
      ],
    });
    expect(() => initCoopBattle(config)).toThrow(
      "requer exatamente 3 jogadores"
    );
  });

  it("todos players comecam com HP cheio", () => {
    const config = makeCoopConfig();
    const state = initCoopBattle(config);

    for (const player of state.team) {
      expect(player.currentHp).toBe(player.baseStats.hp);
    }
    expect(state.boss.currentHp).toBe(state.boss.baseStats.hp);
  });

  it("todos players comecam com stages zerados", () => {
    const config = makeCoopConfig();
    const state = initCoopBattle(config);

    for (const player of [...state.team, state.boss]) {
      expect(player.stages).toEqual({
        physicalAtk: 0,
        physicalDef: 0,
        magicAtk: 0,
        magicDef: 0,
        speed: 0,
        accuracy: 0,
      });
    }
  });

  it("todos players comecam com cooldowns limpos", () => {
    const config = makeCoopConfig();
    const state = initCoopBattle(config);

    for (const player of [...state.team, state.boss]) {
      expect(player.cooldowns).toEqual({});
    }
  });

  it("status IN_PROGRESS e turnNumber 1", () => {
    const config = makeCoopConfig();
    const state = initCoopBattle(config);

    expect(state.status).toBe("IN_PROGRESS");
    expect(state.turnNumber).toBe(1);
  });

  it("winnerId comeca como null", () => {
    const config = makeCoopConfig();
    const state = initCoopBattle(config);
    expect(state.winnerId).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// resolveCoopTurn
// ---------------------------------------------------------------------------

describe("resolveCoopTurn", () => {
  it("retorna imediatamente se status FINISHED", () => {
    const config = makeCoopConfig();
    const state = initCoopBattle(config);
    state.status = "FINISHED";
    state.winnerId = "team";

    const actions = makeTeamActions(state);
    const result = resolveCoopTurn(state, actions, fixedRandom);

    expect(result.events).toHaveLength(0);
    expect(result.state.status).toBe("FINISHED");
  });

  it("valida que teamActions tem 3 acoes", () => {
    const state = initCoopBattle(makeCoopConfig());

    const twoActions: CoopTurnAction[] = [
      { playerId: "p1", skillId: basicAttack.id },
      { playerId: "p2", skillId: basicAttack.id },
    ];

    expect(() => resolveCoopTurn(state, twoActions, fixedRandom)).toThrow(
      "requer exatamente 3 acoes"
    );
  });

  it("rejeita acoes duplicadas (mesmo playerId)", () => {
    const state = initCoopBattle(makeCoopConfig());

    const dupActions: CoopTurnAction[] = [
      { playerId: "p1", skillId: basicAttack.id },
      { playerId: "p1", skillId: basicAttack.id },
      { playerId: "p2", skillId: basicAttack.id },
    ];

    expect(() => resolveCoopTurn(state, dupActions, fixedRandom)).toThrow(
      "duplicadas"
    );
  });

  it("rejeita acao de player que nao pertence ao time", () => {
    const state = initCoopBattle(makeCoopConfig());

    const badActions: CoopTurnAction[] = [
      { playerId: "p1", skillId: basicAttack.id },
      { playerId: "p2", skillId: basicAttack.id },
      { playerId: "outsider", skillId: basicAttack.id },
    ];

    expect(() => resolveCoopTurn(state, badActions, fixedRandom)).toThrow(
      "nao pertence ao time"
    );
  });

  it("turno basico: 3 players atacam boss, boss ataca player → HP muda", () => {
    const state = initCoopBattle(makeCoopConfig());
    const actions = makeTeamActions(state, basicAttack.id);

    const result = resolveCoopTurn(state, actions, fixedRandom);

    // Boss deve ter perdido HP (3 players atacaram)
    expect(result.state.boss.currentHp).toBeLessThan(state.boss.currentHp);

    // Pelo menos um player deve ter perdido HP (boss atacou alguem)
    const anyPlayerDamaged = result.state.team.some(
      (p, i) => p.currentHp < state.team[i].currentHp
    );
    expect(anyPlayerDamaged).toBe(true);

    // Deve haver eventos de DAMAGE
    const damageEvents = result.events.filter((e) => e.phase === "DAMAGE");
    expect(damageEvents.length).toBeGreaterThanOrEqual(2); // pelo menos 1 player + boss
  });

  it("player morto (HP <= 0) nao age", () => {
    const state = initCoopBattle(makeCoopConfig());

    // Matar p1 manualmente
    state.team[0].currentHp = 0;

    const actions: CoopTurnAction[] = [
      { playerId: "p1", skillId: basicAttack.id },
      { playerId: "p2", skillId: basicAttack.id },
      { playerId: "p3", skillId: basicAttack.id },
    ];

    const result = resolveCoopTurn(state, actions, fixedRandom);

    // p1 nao deve ter eventos de DAMAGE como ator
    const p1DamageAsActor = result.events.filter(
      (e) => e.phase === "DAMAGE" && e.actorId === "p1"
    );
    expect(p1DamageAsActor).toHaveLength(0);
  });

  it("boss morre → winnerId = 'team', status FINISHED", () => {
    // Boss com HP muito baixo, players com ataque forte
    const config = makeCoopConfig({
      boss: makePlayerConfig("boss", [bossAttack], { hp: 1, physicalAtk: 5, speed: 1 }),
      team: [
        makePlayerConfig("p1", [basicAttack], { physicalAtk: 50, speed: 30 }),
        makePlayerConfig("p2", [basicAttack], { physicalAtk: 50, speed: 25 }),
        makePlayerConfig("p3", [basicAttack], { physicalAtk: 50, speed: 20 }),
      ],
    });
    const state = initCoopBattle(config);
    const actions = makeTeamActions(state, basicAttack.id);

    const result = resolveCoopTurn(state, actions, fixedRandom);

    expect(result.state.status).toBe("FINISHED");
    expect(result.state.winnerId).toBe("team");
  });

  it("todos players morrem → winnerId = null, status FINISHED", () => {
    // Players com HP muito baixo, boss com ataque devastador (ALL_ENEMIES)
    const bossAoeSkill = makeSkill({
      id: "boss-aoe",
      name: "Boss AOE",
      basePower: 999,
      accuracy: 100,
      target: "ALL_ENEMIES",
    });

    const config = makeCoopConfig({
      boss: makePlayerConfig("boss", [bossAoeSkill], {
        hp: 5000,
        physicalAtk: 999,
        speed: 100, // boss age primeiro
      }),
      team: [
        makePlayerConfig("p1", [weakAttack], { hp: 1, speed: 1 }),
        makePlayerConfig("p2", [weakAttack], { hp: 1, speed: 1 }),
        makePlayerConfig("p3", [weakAttack], { hp: 1, speed: 1 }),
      ],
    });
    const state = initCoopBattle(config);
    const actions = makeTeamActions(state, weakAttack.id);

    const result = resolveCoopTurn(state, actions, alwaysHitRandom);

    expect(result.state.status).toBe("FINISHED");
    expect(result.state.winnerId).toBeNull();
  });

  it("skip turn (skillId null) → nenhum dano pelo player que pulou", () => {
    const state = initCoopBattle(makeCoopConfig());
    const bossHpBefore = state.boss.currentHp;

    const actions: CoopTurnAction[] = [
      { playerId: "p1", skillId: null },
      { playerId: "p2", skillId: null },
      { playerId: "p3", skillId: null },
    ];

    const result = resolveCoopTurn(state, actions, fixedRandom);

    // Nenhum player causou dano ao boss (todos pularam)
    const playerDamageEvents = result.events.filter(
      (e) =>
        e.phase === "DAMAGE" &&
        e.actorId !== "boss" &&
        e.targetId === "boss"
    );
    expect(playerDamageEvents).toHaveLength(0);

    // Deve ter eventos SKIP para os 3 players
    const skipEvents = result.events.filter((e) => e.phase === "SKIP");
    expect(skipEvents).toHaveLength(3);
  });

  it("ordem por speed: player com maior speed age primeiro", () => {
    const config = makeCoopConfig({
      team: [
        makePlayerConfig("slow", [basicAttack], { speed: 5 }),
        makePlayerConfig("fast", [basicAttack], { speed: 50 }),
        makePlayerConfig("medium", [basicAttack], { speed: 20 }),
      ],
      boss: makePlayerConfig("boss", [bossAttack], { hp: 2000, speed: 1 }),
    });
    const state = initCoopBattle(config);
    const actions: CoopTurnAction[] = [
      { playerId: "slow", skillId: basicAttack.id },
      { playerId: "fast", skillId: basicAttack.id },
      { playerId: "medium", skillId: basicAttack.id },
    ];

    const result = resolveCoopTurn(state, actions, fixedRandom);

    // Encontrar indices dos eventos de DAMAGE por ator
    const damageEvents = result.events.filter((e) => e.phase === "DAMAGE");
    const actorOrder = damageEvents.map((e) => e.actorId);

    // fast deve aparecer antes de medium, e medium antes de slow
    const fastIdx = actorOrder.indexOf("fast");
    const mediumIdx = actorOrder.indexOf("medium");
    const slowIdx = actorOrder.indexOf("slow");

    expect(fastIdx).toBeLessThan(mediumIdx);
    expect(mediumIdx).toBeLessThan(slowIdx);
  });

  it("nao muta o estado original (deep clone)", () => {
    const state = initCoopBattle(makeCoopConfig());
    const originalBossHp = state.boss.currentHp;
    const originalP1Hp = state.team[0].currentHp;

    const actions = makeTeamActions(state, basicAttack.id);
    resolveCoopTurn(state, actions, fixedRandom);

    // Estado original nao deve ter mudado
    expect(state.boss.currentHp).toBe(originalBossHp);
    expect(state.team[0].currentHp).toBe(originalP1Hp);
    expect(state.turnNumber).toBe(1);
  });

  it("turno incrementa apos resolucao quando batalha continua", () => {
    const state = initCoopBattle(makeCoopConfig());
    expect(state.turnNumber).toBe(1);

    const actions = makeTeamActions(state, basicAttack.id);
    const result = resolveCoopTurn(state, actions, fixedRandom);

    expect(result.state.turnNumber).toBe(2);
  });

  it("turnLog acumula eventos de turnos anteriores", () => {
    const config = makeCoopConfig({
      boss: makePlayerConfig("boss", [bossAttack], { hp: 5000 }),
    });
    const state = initCoopBattle(config);

    const actions = makeTeamActions(state, basicAttack.id);
    const r1 = resolveCoopTurn(state, actions, fixedRandom);
    expect(r1.state.turnLog.length).toBeGreaterThan(0);

    const r2 = resolveCoopTurn(r1.state, actions, fixedRandom);
    expect(r2.state.turnLog.length).toBeGreaterThan(r1.state.turnLog.length);
  });
});
