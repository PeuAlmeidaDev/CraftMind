// lib/battle/__tests__/spectral-skill-integration.test.ts
//
// Testes de integracao do 5o slot espectral no pipeline COMPLETO de batalha.
// Cobre dano, cooldown, efeitos (BUFF/STATUS/COUNTER), multi-hit, accuracy/miss
// e propagacao para os 3 modos: 1v1 (resolveTurn), coop PvE (resolveCoopPveTurn)
// e PvP team 2v2 (resolvePvpTeamTurn).
//
// Spectral skill = 5o slot adicionado a equippedSkills via
// `BattlePlayerConfig.spectralSkill`. Engine deve trata-la igual a uma skill
// normal (cooldown, accuracy, combo) — esses testes garantem isso end-to-end.

import { describe, it, expect } from "vitest";
import { initBattle } from "../init";
import { resolveTurn } from "../turn";
import { initCoopPveBattle, resolveCoopPveTurn } from "../coop-pve-turn";
import { initPvpTeamBattle, resolvePvpTeamTurn } from "../pvp-team-turn";
import { getAvailableSkills } from "../skills";
import type { BaseStats, EquippedSkill } from "../types";
import type {
  CoopPvePlayerConfig,
  CoopPveMobConfig,
} from "../coop-pve-types";
import type { PvpTeamPlayerConfig } from "../pvp-team-types";
import type { Skill } from "@/types/skill";
import type { AiProfile } from "../ai-profiles";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeStats(overrides?: Partial<BaseStats>): BaseStats {
  return {
    physicalAtk: 30,
    physicalDef: 15,
    magicAtk: 25,
    magicDef: 14,
    hp: 500,
    speed: 20,
    ...overrides,
  };
}

function makeSkill(
  overrides: Partial<Skill> & Pick<Skill, "id" | "name" | "effects">,
): Skill {
  return {
    description: "Skill de teste",
    tier: 1,
    cooldown: 0,
    target: "SINGLE_ENEMY",
    damageType: "PHYSICAL",
    basePower: 40,
    hits: 1,
    accuracy: 100,
    mastery: {},
    ...overrides,
  };
}

function makeEquipped(skill: Skill, slot: number): EquippedSkill {
  return { skillId: skill.id, slotIndex: slot, skill };
}

const basicAttack: Skill = makeSkill({
  id: "basic-attack",
  name: "Ataque Basico",
  basePower: 20,
  effects: [],
});

const alwaysHit = () => 0.01;
const alwaysMiss = () => 0.99;

// ---------------------------------------------------------------------------
// Test 1 — Spectral skill causa dano via resolveTurn
// ---------------------------------------------------------------------------

describe("Spectral skill — pipeline completo (resolveTurn 1v1)", () => {
  it("aplica dano no oponente via 5o slot e gera TurnLogEntry com skillName correto", () => {
    const spectralBlast: Skill = makeSkill({
      id: "spectral-blast",
      name: "Explosao Espectral",
      basePower: 80,
      cooldown: 0,
      effects: [],
    });

    const state = initBattle({
      battleId: "b1",
      player1: {
        userId: "p1",
        characterId: "c1",
        stats: makeStats({ speed: 100 }),
        skills: [makeEquipped(basicAttack, 0)],
        spectralSkill: {
          skill: spectralBlast,
          sourceUserCardId: "uc-spectral-1",
        },
      },
      player2: {
        userId: "p2",
        characterId: "c2",
        stats: makeStats(),
        skills: [makeEquipped(basicAttack, 0)],
      },
    });

    const initialP2Hp = state.players[1].currentHp;

    const result = resolveTurn(
      state,
      [
        { playerId: "p1", skillId: spectralBlast.id },
        { playerId: "p2", skillId: basicAttack.id },
      ],
      alwaysHit,
    );

    // Dano aplicado no oponente
    expect(result.state.players[1].currentHp).toBeLessThan(initialP2Hp);

    // Evento de DAMAGE com skillName correto
    const damageEvent = result.events.find(
      (e) =>
        e.phase === "DAMAGE" &&
        e.actorId === "p1" &&
        e.skillId === spectralBlast.id,
    );
    expect(damageEvent).toBeDefined();
    expect(damageEvent?.skillName).toBe("Explosao Espectral");
    expect(damageEvent?.damage).toBeGreaterThan(0);
  });

  // -------------------------------------------------------------------------
  // Test 2 — Spectral skill aplica cooldown apos uso
  // -------------------------------------------------------------------------

  it("entra em cooldown apos uso e desaparece de getAvailableSkills; tick reduz e libera", () => {
    const spectralBlast: Skill = makeSkill({
      id: "spectral-blast-cd",
      name: "Espectro CD",
      basePower: 60,
      cooldown: 2,
      effects: [],
    });

    const state = initBattle({
      battleId: "b2",
      player1: {
        userId: "p1",
        characterId: "c1",
        stats: makeStats({ speed: 100, hp: 5000 }),
        skills: [makeEquipped(basicAttack, 0)],
        spectralSkill: {
          skill: spectralBlast,
          sourceUserCardId: "uc-spectral-2",
        },
      },
      player2: {
        userId: "p2",
        characterId: "c2",
        stats: makeStats({ hp: 5000 }),
        skills: [makeEquipped(basicAttack, 0)],
      },
    });

    // Turno 1: usa spectral
    const t1 = resolveTurn(
      state,
      [
        { playerId: "p1", skillId: spectralBlast.id },
        { playerId: "p2", skillId: basicAttack.id },
      ],
      alwaysHit,
    );

    // Cooldown ficou positivo apos o uso
    const cdAfterT1 = t1.state.players[0].cooldowns[spectralBlast.id];
    expect(cdAfterT1).toBeGreaterThan(0);

    // Spectral some de getAvailableSkills enquanto em cooldown
    const availT1 = getAvailableSkills(t1.state.players[0]);
    expect(availT1.find((es) => es.skillId === spectralBlast.id)).toBeUndefined();
    // Skill normal continua disponivel
    expect(availT1.find((es) => es.skillId === basicAttack.id)).toBeDefined();

    // Turno 2: tickCooldowns deve reduzir
    const t2 = resolveTurn(
      t1.state,
      [
        { playerId: "p1", skillId: basicAttack.id },
        { playerId: "p2", skillId: basicAttack.id },
      ],
      alwaysHit,
    );

    const cdAfterT2 = t2.state.players[0].cooldowns[spectralBlast.id];
    // tickCooldowns reduziu (pode ter caido para 0 e sido removido)
    if (cdAfterT2 !== undefined) {
      expect(cdAfterT2).toBeLessThan(cdAfterT1);
    }
  });

  // -------------------------------------------------------------------------
  // Test 3a — Spectral skill com BUFF aplica no caster
  // -------------------------------------------------------------------------

  it("BUFF: spectral skill com BUFF SELF aplica buff no caster", () => {
    const spectralBuff: Skill = makeSkill({
      id: "spectral-buff",
      name: "Buff Espectral",
      basePower: 0,
      damageType: "NONE",
      target: "SELF",
      cooldown: 0,
      effects: [
        {
          type: "BUFF",
          target: "SELF",
          stat: "physicalAtk",
          value: 2,
          duration: 3,
        },
      ],
    });

    const state = initBattle({
      battleId: "b3a",
      player1: {
        userId: "p1",
        characterId: "c1",
        stats: makeStats({ speed: 100 }),
        skills: [makeEquipped(basicAttack, 0)],
        spectralSkill: {
          skill: spectralBuff,
          sourceUserCardId: "uc-buff",
        },
      },
      player2: {
        userId: "p2",
        characterId: "c2",
        stats: makeStats(),
        skills: [makeEquipped(basicAttack, 0)],
      },
    });

    const result = resolveTurn(
      state,
      [
        { playerId: "p1", skillId: spectralBuff.id },
        { playerId: "p2", skillId: basicAttack.id },
      ],
      alwaysHit,
    );

    // Stage de physicalAtk de p1 aumentou (subiu +2 e desce 0 ate expirar)
    expect(result.state.players[0].stages.physicalAtk).toBeGreaterThan(0);
    // Buff registrado
    expect(result.state.players[0].buffs.length).toBeGreaterThanOrEqual(1);

    // Evento EFFECT
    const effectEvent = result.events.find(
      (e) => e.phase === "EFFECT" && e.targetId === "p1" && e.buffApplied,
    );
    expect(effectEvent).toBeDefined();
  });

  // -------------------------------------------------------------------------
  // Test 3b — Spectral skill com STATUS aplica no alvo
  // -------------------------------------------------------------------------

  it("STATUS: spectral skill com STATUS aplica status no alvo", () => {
    const spectralStun: Skill = makeSkill({
      id: "spectral-stun",
      name: "Stun Espectral",
      basePower: 30,
      target: "SINGLE_ENEMY",
      cooldown: 0,
      effects: [
        {
          type: "STATUS",
          target: "SINGLE_ENEMY",
          status: "BURN",
          chance: 100,
          duration: 3,
        },
      ],
    });

    const state = initBattle({
      battleId: "b3b",
      player1: {
        userId: "p1",
        characterId: "c1",
        stats: makeStats({ speed: 100 }),
        skills: [makeEquipped(basicAttack, 0)],
        spectralSkill: {
          skill: spectralStun,
          sourceUserCardId: "uc-stun",
        },
      },
      player2: {
        userId: "p2",
        characterId: "c2",
        stats: makeStats({ hp: 1000 }),
        skills: [makeEquipped(basicAttack, 0)],
      },
    });

    const result = resolveTurn(
      state,
      [
        { playerId: "p1", skillId: spectralStun.id },
        { playerId: "p2", skillId: basicAttack.id },
      ],
      alwaysHit,
    );

    // Status BURN aplicado em p2
    const p2Status = result.state.players[1].statusEffects.find(
      (s) => s.status === "BURN",
    );
    expect(p2Status).toBeDefined();
  });

  // -------------------------------------------------------------------------
  // Test 3c — Spectral skill com COUNTER ativa counter no caster
  // -------------------------------------------------------------------------

  it("COUNTER: spectral skill com COUNTER SELF ativa counter no caster", () => {
    const spectralCounter: Skill = makeSkill({
      id: "spectral-counter",
      name: "Counter Espectral",
      basePower: 0,
      damageType: "NONE",
      target: "SELF",
      cooldown: 0,
      effects: [
        {
          type: "COUNTER",
          target: "SELF",
          powerMultiplier: 0.5,
          duration: 3,
        },
      ],
    });

    const state = initBattle({
      battleId: "b3c",
      player1: {
        userId: "p1",
        characterId: "c1",
        stats: makeStats({ speed: 100 }),
        skills: [makeEquipped(basicAttack, 0)],
        spectralSkill: {
          skill: spectralCounter,
          sourceUserCardId: "uc-counter",
        },
      },
      player2: {
        userId: "p2",
        characterId: "c2",
        stats: makeStats(),
        skills: [makeEquipped(basicAttack, 0)],
      },
    });

    const result = resolveTurn(
      state,
      [
        { playerId: "p1", skillId: spectralCounter.id },
        { playerId: "p2", skillId: basicAttack.id },
      ],
      alwaysHit,
    );

    // Counter ativo em p1
    expect(result.state.players[0].counters.length).toBeGreaterThanOrEqual(1);
    expect(result.state.players[0].counters[0].powerMultiplier).toBe(0.5);
  });

  // -------------------------------------------------------------------------
  // Test 4 — Spectral skill multi-hit (hits: 3) gera dano cumulativo
  // -------------------------------------------------------------------------

  it("multi-hit: spectral skill com hits=3 calcula 3 hits e gera evento com dano agregado", () => {
    const spectralMulti: Skill = makeSkill({
      id: "spectral-multi",
      name: "Triplo Espectral",
      basePower: 30,
      hits: 3,
      cooldown: 0,
      effects: [],
    });

    // Comparar com mesma skill mas hits=1
    const spectralSingle: Skill = makeSkill({
      id: "spectral-single",
      name: "Singulo Espectral",
      basePower: 30,
      hits: 1,
      cooldown: 0,
      effects: [],
    });

    const stateMulti = initBattle({
      battleId: "b4-multi",
      player1: {
        userId: "p1",
        characterId: "c1",
        stats: makeStats({ speed: 100 }),
        skills: [makeEquipped(basicAttack, 0)],
        spectralSkill: {
          skill: spectralMulti,
          sourceUserCardId: "uc-multi",
        },
      },
      player2: {
        userId: "p2",
        characterId: "c2",
        stats: makeStats({ hp: 5000 }),
        skills: [makeEquipped(basicAttack, 0)],
      },
    });

    const stateSingle = initBattle({
      battleId: "b4-single",
      player1: {
        userId: "p1",
        characterId: "c1",
        stats: makeStats({ speed: 100 }),
        skills: [makeEquipped(basicAttack, 0)],
        spectralSkill: {
          skill: spectralSingle,
          sourceUserCardId: "uc-single",
        },
      },
      player2: {
        userId: "p2",
        characterId: "c2",
        stats: makeStats({ hp: 5000 }),
        skills: [makeEquipped(basicAttack, 0)],
      },
    });

    const resMulti = resolveTurn(
      stateMulti,
      [
        { playerId: "p1", skillId: spectralMulti.id },
        { playerId: "p2", skillId: basicAttack.id },
      ],
      alwaysHit,
    );
    const resSingle = resolveTurn(
      stateSingle,
      [
        { playerId: "p1", skillId: spectralSingle.id },
        { playerId: "p2", skillId: basicAttack.id },
      ],
      alwaysHit,
    );

    const dmgMultiEvent = resMulti.events.find(
      (e) => e.phase === "DAMAGE" && e.actorId === "p1",
    );
    const dmgSingleEvent = resSingle.events.find(
      (e) => e.phase === "DAMAGE" && e.actorId === "p1",
    );
    expect(dmgMultiEvent).toBeDefined();
    expect(dmgSingleEvent).toBeDefined();
    // Multi-hit causa MAIS dano (3x hits)
    expect(dmgMultiEvent?.damage ?? 0).toBeGreaterThan(dmgSingleEvent?.damage ?? 0);
    // Mensagem refere "3 hits"
    expect(dmgMultiEvent?.message).toContain("3 hit");
  });

  // -------------------------------------------------------------------------
  // Test 5 — Spectral skill com accuracy < 100 pode errar; cooldown ainda aplica
  // -------------------------------------------------------------------------

  it("accuracy: spectral skill com accuracy=50 erra com RNG forcado em miss; cooldown SE aplica", () => {
    const spectralLowAcc: Skill = makeSkill({
      id: "spectral-miss",
      name: "Espectro Impreciso",
      basePower: 50,
      accuracy: 50,
      cooldown: 2,
      effects: [],
    });

    const state = initBattle({
      battleId: "b5",
      player1: {
        userId: "p1",
        characterId: "c1",
        stats: makeStats({ speed: 100 }),
        skills: [makeEquipped(basicAttack, 0)],
        spectralSkill: {
          skill: spectralLowAcc,
          sourceUserCardId: "uc-miss",
        },
      },
      player2: {
        userId: "p2",
        characterId: "c2",
        stats: makeStats(),
        skills: [makeEquipped(basicAttack, 0)],
      },
    });

    const initialP2Hp = state.players[1].currentHp;

    // alwaysMiss garante hit chance 50% < 99% -> miss
    const result = resolveTurn(
      state,
      [
        { playerId: "p1", skillId: spectralLowAcc.id },
        { playerId: "p2", skillId: basicAttack.id },
      ],
      alwaysMiss,
    );

    // Evento MISS de p1 com a spectral
    const missEvent = result.events.find(
      (e) =>
        e.phase === "MISS" &&
        e.actorId === "p1" &&
        e.skillId === spectralLowAcc.id,
    );
    expect(missEvent).toBeDefined();
    expect(missEvent?.missed).toBe(true);

    // Dano da spectral NAO foi aplicado em p2 (mas p2 ainda usou basicAttack -
    // entao p1 perde HP, mas isso eh independente)
    // p2 ainda esta vivo com HP intacto da spectral (basicAttack do p2 ataca p1)
    // p2.currentHp deve estar igual ao inicial (ou +/- counters)
    expect(result.state.players[1].currentHp).toBe(initialP2Hp);

    // Cooldown SE aplica mesmo no miss
    expect(result.state.players[0].cooldowns[spectralLowAcc.id]).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Test 6 — Spectral skill em CoopPveTurn (2v3)
// ---------------------------------------------------------------------------

describe("Spectral skill — pipeline coop PvE (2v3)", () => {
  it("player com spectral ataca mob via 5o slot; dano aplicado", () => {
    const spectralBlast: Skill = makeSkill({
      id: "spectral-coop",
      name: "Espectro Coop",
      basePower: 80,
      cooldown: 0,
      effects: [],
    });

    const teamP1: CoopPvePlayerConfig = {
      userId: "p1",
      characterId: "c1",
      stats: makeStats({ speed: 200, hp: 1000 }),
      skills: [makeEquipped(basicAttack, 0)],
      spectralSkill: {
        skill: spectralBlast,
        sourceUserCardId: "uc-coop",
      },
    };
    const teamP2: CoopPvePlayerConfig = {
      userId: "p2",
      characterId: "c2",
      stats: makeStats({ speed: 50, hp: 1000 }),
      skills: [makeEquipped(basicAttack, 0)],
    };

    const mob: CoopPveMobConfig = {
      mobId: "mob-1",
      name: "Mob 1",
      tier: 1,
      aiProfile: "BALANCED" as AiProfile,
      stats: makeStats({ hp: 5000, speed: 1 }),
      skills: [makeEquipped(basicAttack, 0)],
    };

    const state = initCoopPveBattle({
      battleId: "coop-b1",
      mode: "2v3",
      team: [teamP1, teamP2],
      mobs: [
        { ...mob, mobId: "mob-1" },
        { ...mob, mobId: "mob-2" },
        { ...mob, mobId: "mob-3" },
      ],
    });

    // Confirma que o 5o slot foi anexado
    const p1State = state.team.find((p) => p.playerId === "p1");
    expect(p1State?.equippedSkills.length).toBe(2);
    expect(p1State?.equippedSkills[1].fromSpectralCard).toBe(true);

    const initialMobHp = state.mobs[0].currentHp;

    const result = resolveCoopPveTurn(
      state,
      [
        { playerId: "p1", skillId: spectralBlast.id, targetIndex: 0 },
        { playerId: "p2", skillId: basicAttack.id, targetIndex: 0 },
      ],
      alwaysHit,
    );

    // Mob 0 sofreu dano
    expect(result.state.mobs[0].currentHp).toBeLessThan(initialMobHp);

    // Evento de DAMAGE com skillName da spectral
    const damageEvent = result.events.find(
      (e) =>
        e.phase === "DAMAGE" &&
        e.actorId === "p1" &&
        e.skillId === spectralBlast.id,
    );
    expect(damageEvent).toBeDefined();
    expect(damageEvent?.skillName).toBe("Espectro Coop");
  });
});

// ---------------------------------------------------------------------------
// Test 7 — Spectral skill em PvpTeamTurn (2v2)
// ---------------------------------------------------------------------------

describe("Spectral skill — pipeline PvP team (2v2)", () => {
  it("player do time 1 usa spectral contra player do time 2; dano aplicado e cooldown ativo", () => {
    const spectralBlast: Skill = makeSkill({
      id: "spectral-pvp",
      name: "Espectro PvP",
      basePower: 80,
      cooldown: 2,
      effects: [],
    });

    const t1p1: PvpTeamPlayerConfig = {
      userId: "p1",
      characterId: "c1",
      stats: makeStats({ speed: 200, hp: 1000 }),
      skills: [makeEquipped(basicAttack, 0)],
      spectralSkill: {
        skill: spectralBlast,
        sourceUserCardId: "uc-pvp",
      },
    };
    const t1p2: PvpTeamPlayerConfig = {
      userId: "p2",
      characterId: "c2",
      stats: makeStats({ speed: 50, hp: 1000 }),
      skills: [makeEquipped(basicAttack, 0)],
    };
    const t2p1: PvpTeamPlayerConfig = {
      userId: "p3",
      characterId: "c3",
      stats: makeStats({ speed: 30, hp: 1000 }),
      skills: [makeEquipped(basicAttack, 0)],
    };
    const t2p2: PvpTeamPlayerConfig = {
      userId: "p4",
      characterId: "c4",
      stats: makeStats({ speed: 30, hp: 1000 }),
      skills: [makeEquipped(basicAttack, 0)],
    };

    const state = initPvpTeamBattle({
      battleId: "pvp-b1",
      mode: "TEAM_2V2",
      team1: [t1p1, t1p2],
      team2: [t2p1, t2p2],
    });

    // Confirma 5o slot
    const p1State = state.team1.find((p) => p.playerId === "p1");
    expect(p1State?.equippedSkills.length).toBe(2);
    expect(p1State?.equippedSkills[1].fromSpectralCard).toBe(true);

    const initialP3Hp = state.team2[0].currentHp;

    const result = resolvePvpTeamTurn(
      state,
      [
        { playerId: "p1", skillId: spectralBlast.id, targetIndex: 0 }, // ataca p3
        { playerId: "p2", skillId: basicAttack.id, targetIndex: 0 },
        { playerId: "p3", skillId: basicAttack.id, targetIndex: 0 },
        { playerId: "p4", skillId: basicAttack.id, targetIndex: 0 },
      ],
      alwaysHit,
    );

    // p3 sofreu dano (alvo da spectral de p1)
    const p3After = result.state.team2.find((p) => p.playerId === "p3");
    expect(p3After?.currentHp).toBeLessThan(initialP3Hp);

    // Cooldown da spectral ativo em p1
    const p1After = result.state.team1.find((p) => p.playerId === "p1");
    expect(p1After?.cooldowns[spectralBlast.id]).toBeGreaterThan(0);

    // Evento de DAMAGE com a spectral
    const damageEvent = result.events.find(
      (e) =>
        e.phase === "DAMAGE" &&
        e.actorId === "p1" &&
        e.skillId === spectralBlast.id,
    );
    expect(damageEvent).toBeDefined();
    expect(damageEvent?.skillName).toBe("Espectro PvP");
  });
});
