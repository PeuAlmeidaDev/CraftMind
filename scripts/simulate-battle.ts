// scripts/simulate-battle.ts — Simulador completo de batalha
//
// Exercita TODAS as mecanicas da engine de combate:
// Status effects, buffs/debuffs, vulnerability, multi-hit, counter,
// heal, cleanse, recoil, self_debuff, combo, on_expire, priority_shift,
// cooldowns, IA adaptativa e limite de 50 turnos.
//
// Uso: npx tsx scripts/simulate-battle.ts

import { initBattle, resolveTurn, chooseAction, getAvailableSkills } from "../lib/battle";
import type {
  InitBattleConfig, EquippedSkill, TurnAction,
  BattleState, TurnResult, TurnLogEntry, Skill, PlayerState,
} from "../lib/battle";
import type { AiProfile } from "../lib/battle/ai-profiles";
import type { SkillEffect } from "../types/skill";

// ---------------------------------------------------------------------------
// Helper: criar skill mock
// ---------------------------------------------------------------------------

function makeSkill(
  overrides: Partial<Skill> & Pick<Skill, "id" | "name" | "basePower" | "damageType" | "target" | "tier" | "cooldown">
): Skill {
  return { description: "", hits: 1, accuracy: 100, effects: [], mastery: {}, ...overrides };
}

// ---------------------------------------------------------------------------
// Helper: barra de HP visual
// ---------------------------------------------------------------------------

function printBar(label: string, current: number, max: number, width: number = 20): string {
  const ratio = Math.max(0, current / max);
  const filled = Math.round(ratio * width);
  const empty = width - filled;
  const bar = "\u2588".repeat(filled) + "\u2591".repeat(empty);
  const pct = Math.round(ratio * 100);
  return `${label} [${bar}] ${current}/${max} (${pct}%)`;
}

// ---------------------------------------------------------------------------
// Helper: icone do evento
// ---------------------------------------------------------------------------

function eventIcon(phase: string): string {
  switch (phase) {
    case "DAMAGE": return "\u2694";
    case "HEAL": return "\u271A";
    case "DEATH": return "\u2620";
    case "STATUS_DAMAGE": return "\uD83D\uDD25";
    case "INCAPACITATED": return "\uD83D\uDCAB";
    case "COUNTER": return "\uD83D\uDEE1";
    case "COMBO": return "\uD83D\uDD04";
    case "DRAW": return "\uD83E\uDD1D";
    default: return "\u2022";
  }
}

// ---------------------------------------------------------------------------
// Helper: equip skill array
// ---------------------------------------------------------------------------

function equip(skills: Skill[]): EquippedSkill[] {
  return skills.map((skill, i) => ({
    skillId: skill.id,
    slotIndex: i,
    skill,
  }));
}

// ---------------------------------------------------------------------------
// Helper: rodar cenario generico
// ---------------------------------------------------------------------------

type ScenarioResult = {
  name: string;
  allEvents: TurnLogEntry[];
  finalState: BattleState;
};

function runScenario(params: {
  name: string;
  description: string;
  config: InitBattleConfig;
  p1Label: string;
  p2Label: string;
  chooseP1: (state: BattleState) => TurnAction;
  chooseP2: (state: BattleState) => TurnAction;
  maxTurns?: number;
}): ScenarioResult {
  const { name, description, config, p1Label, p2Label, chooseP1, chooseP2, maxTurns } = params;
  const allEvents: TurnLogEntry[] = [];

  console.log("\n" + "=".repeat(70));
  console.log(`  CENARIO: ${name}`);
  console.log(`  ${description}`);
  console.log("=".repeat(70));
  console.log(`  ${p1Label} — Skills: ${config.player1.skills.map((s) => s.skill.name).join(", ")}`);
  console.log(`  ${p2Label} — Skills: ${config.player2.skills.map((s) => s.skill.name).join(", ")}`);
  console.log("-".repeat(70));

  let state = initBattle(config);
  const limit = maxTurns ?? 60;
  let turns = 0;

  while (state.status === "IN_PROGRESS" && turns < limit) {
    turns++;
    console.log(`\n--- TURNO ${state.turnNumber} ---`);
    console.log(printBar(`  ${p1Label}`, state.players[0].currentHp, state.players[0].baseStats.hp));
    console.log(printBar(`  ${p2Label}`, state.players[1].currentHp, state.players[1].baseStats.hp));

    const a1 = chooseP1(state);
    const a2 = chooseP2(state);

    const sk1 = state.players[0].equippedSkills.find((s) => s.skillId === a1.skillId);
    const sk2 = state.players[1].equippedSkills.find((s) => s.skillId === a2.skillId);
    console.log(`  > ${p1Label} escolhe: ${sk1?.skill.name ?? "SKIP"}`);
    console.log(`  > ${p2Label} escolhe: ${sk2?.skill.name ?? "SKIP"}`);

    const result = resolveTurn(state, [a1, a2], () => 0.5);
    state = result.state;

    for (const event of result.events) {
      console.log(`  ${eventIcon(event.phase)} ${event.message}`);
    }
    allEvents.push(...result.events);
  }

  console.log();
  console.log("-".repeat(70));
  if (state.winnerId === null && state.status === "FINISHED") {
    console.log("  RESULTADO: EMPATE!");
  } else if (state.winnerId === config.player1.userId) {
    console.log(`  RESULTADO: ${p1Label} VENCEU!`);
  } else if (state.winnerId === config.player2.userId) {
    console.log(`  RESULTADO: ${p2Label} VENCEU!`);
  } else {
    console.log(`  RESULTADO: Batalha nao terminou em ${limit} turnos (status: ${state.status})`);
  }
  console.log(`  Turnos: ${state.turnNumber}`);
  console.log(`  HP final ${p1Label}: ${state.players[0].currentHp}/${state.players[0].baseStats.hp}`);
  console.log(`  HP final ${p2Label}: ${state.players[1].currentHp}/${state.players[1].baseStats.hp}`);
  console.log("=".repeat(70));

  return { name, allEvents, finalState: state };
}

// ---------------------------------------------------------------------------
// Helper: IA fixa por sequencia de skillIds
// ---------------------------------------------------------------------------

function fixedAction(playerId: string, sequence: (string | null)[]): (state: BattleState) => TurnAction {
  let idx = 0;
  return (_state: BattleState) => {
    const skillId = sequence[idx % sequence.length] ?? null;
    idx++;
    return { playerId, skillId };
  };
}

// ===========================================================================
// CENARIO 1: Status Effects
// ===========================================================================

function scenario1_StatusEffects(): ScenarioResult {
  // --- SUB-CENARIO 1A: POISON escalating (3 turnos: 4% -> 6% -> 8%) ---
  const poisonSting = makeSkill({
    id: "s1-poison", name: "Picada Venenosa", basePower: 20, damageType: "PHYSICAL",
    target: "SINGLE_ENEMY", tier: 1, cooldown: 0,
    effects: [{ type: "STATUS", target: "SINGLE_ENEMY", status: "POISON", chance: 100, duration: 3 } as SkillEffect],
  });
  const basicAtk = makeSkill({
    id: "s1-basic", name: "Ataque Basico", basePower: 25, damageType: "PHYSICAL",
    target: "SINGLE_ENEMY", tier: 1, cooldown: 0,
  });
  const guard = makeSkill({
    id: "s1-guard", name: "Guarda", basePower: 0, damageType: "NONE",
    target: "SELF", tier: 1, cooldown: 0,
    effects: [{ type: "BUFF", target: "SELF", stat: "physicalDef", value: 1, duration: 2 } as SkillEffect],
  });

  // P1 aplica poison no turno 1, depois so ataque basico para deixar o poison tickar
  // P2 so ataca para nao morrer rapido — queremos ver 3 ticks de poison
  const poisonResult = runScenario({
    name: "1A. POISON ESCALATING (4% -> 6% -> 8%)",
    description: "Poison aplicado no T1, observar 3 turnos de dano crescente antes de expirar",
    config: {
      battleId: "sc1a-poison",
      player1: {
        userId: "p1-poison", characterId: "c1",
        stats: { physicalAtk: 15, physicalDef: 15, magicAtk: 15, magicDef: 15, hp: 400, speed: 16 },
        skills: equip([poisonSting, basicAtk, basicAtk, basicAtk]),
      },
      player2: {
        userId: "p2-poison", characterId: "c2",
        stats: { physicalAtk: 15, physicalDef: 15, magicAtk: 15, magicDef: 15, hp: 400, speed: 14 },
        skills: equip([basicAtk, guard, basicAtk, guard]),
      },
    },
    p1Label: "Envenenador",
    p2Label: "Vitima    ",
    // T1: poison, T2-5: basic (para poison tickar T2=4%, T3=6%, T4=8%, T5=expirou)
    chooseP1: fixedAction("p1-poison", ["s1-poison", "s1-basic", "s1-basic", "s1-basic", "s1-basic"]),
    chooseP2: fixedAction("p2-poison", ["s1-basic", "s1-basic", "s1-basic", "s1-basic", "s1-basic"]),
    maxTurns: 5,
  });

  // --- SUB-CENARIO 1B: BURN (3 turnos de 6% + side effect -1 physicalAtk) ---
  const flameTouch = makeSkill({
    id: "s1-burn", name: "Toque Flamejante", basePower: 20, damageType: "MAGICAL",
    target: "SINGLE_ENEMY", tier: 1, cooldown: 0,
    effects: [{ type: "STATUS", target: "SINGLE_ENEMY", status: "BURN", chance: 100, duration: 3 } as SkillEffect],
  });

  const burnResult = runScenario({
    name: "1B. BURN (6% HP x3 turnos + -1 physicalAtk)",
    description: "Burn aplicado no T1, observar 3 ticks de 6% e physicalAtk reduzido",
    config: {
      battleId: "sc1b-burn",
      player1: {
        userId: "p1-burn", characterId: "c1",
        stats: { physicalAtk: 15, physicalDef: 15, magicAtk: 15, magicDef: 15, hp: 400, speed: 16 },
        skills: equip([flameTouch, basicAtk, basicAtk, basicAtk]),
      },
      player2: {
        userId: "p2-burn", characterId: "c2",
        stats: { physicalAtk: 15, physicalDef: 15, magicAtk: 15, magicDef: 15, hp: 400, speed: 14 },
        skills: equip([basicAtk, guard, basicAtk, guard]),
      },
    },
    p1Label: "Incendiario",
    p2Label: "Queimado   ",
    // T1: burn, T2-5: basic (burn ticka T2, T3, T4, expira no T4)
    chooseP1: fixedAction("p1-burn", ["s1-burn", "s1-basic", "s1-basic", "s1-basic", "s1-basic"]),
    chooseP2: fixedAction("p2-burn", ["s1-basic", "s1-basic", "s1-basic", "s1-basic", "s1-basic"]),
    maxTurns: 5,
  });

  // --- SUB-CENARIO 1C: FROZEN 2 turnos (perda de turno + 30% vuln fisica) ---
  const frostBite = makeSkill({
    id: "s1-frozen", name: "Mordida Glacial", basePower: 20, damageType: "MAGICAL",
    target: "SINGLE_ENEMY", tier: 1, cooldown: 0,
    effects: [{ type: "STATUS", target: "SINGLE_ENEMY", status: "FROZEN", chance: 100, duration: 2 } as SkillEffect],
  });
  const heavyPhysical = makeSkill({
    id: "s1-heavy", name: "Golpe Pesado", basePower: 50, damageType: "PHYSICAL",
    target: "SINGLE_ENEMY", tier: 1, cooldown: 0,
  });

  const frozenResult = runScenario({
    name: "1C. FROZEN 2 TURNOS (perda de acao + 30% vuln fisica)",
    description: "Frozen aplicado no T1 com duration 2. T2 e T3: vitima perde turno. Golpe fisico recebe +30% bonus",
    config: {
      battleId: "sc1c-frozen",
      player1: {
        userId: "p1-frozen", characterId: "c1",
        stats: { physicalAtk: 20, physicalDef: 15, magicAtk: 20, magicDef: 15, hp: 300, speed: 18 },
        skills: equip([frostBite, heavyPhysical, heavyPhysical, basicAtk]),
      },
      player2: {
        userId: "p2-frozen", characterId: "c2",
        stats: { physicalAtk: 18, physicalDef: 15, magicAtk: 18, magicDef: 15, hp: 300, speed: 14 },
        skills: equip([basicAtk, basicAtk, basicAtk, basicAtk]),
      },
    },
    p1Label: "Congelador",
    p2Label: "Congelado ",
    // T1: frozen, T2: golpe fisico (com bonus 30%), T3: golpe fisico (frozen deve ter expirado? depende), T4: basic
    chooseP1: fixedAction("p1-frozen", ["s1-frozen", "s1-heavy", "s1-heavy", "s1-basic"]),
    chooseP2: fixedAction("p2-frozen", ["s1-basic", "s1-basic", "s1-basic", "s1-basic"]),
    maxTurns: 4,
  });

  // --- SUB-CENARIO 1D: STUN (1 turno perda de acao) ---
  const stunStrike = makeSkill({
    id: "s1-stun", name: "Golpe Atordoante", basePower: 30, damageType: "PHYSICAL",
    target: "SINGLE_ENEMY", tier: 1, cooldown: 0,
    effects: [{ type: "STATUS", target: "SINGLE_ENEMY", status: "STUN", chance: 100, duration: 1 } as SkillEffect],
  });

  const stunResult = runScenario({
    name: "1D. STUN (1 turno perda de acao)",
    description: "Stun aplicado no T1, vitima perde T1. T2 vitima age normalmente",
    config: {
      battleId: "sc1d-stun",
      player1: {
        userId: "p1-stun", characterId: "c1",
        stats: { physicalAtk: 20, physicalDef: 15, magicAtk: 20, magicDef: 15, hp: 300, speed: 18 },
        skills: equip([stunStrike, basicAtk, basicAtk, basicAtk]),
      },
      player2: {
        userId: "p2-stun", characterId: "c2",
        stats: { physicalAtk: 18, physicalDef: 15, magicAtk: 18, magicDef: 15, hp: 300, speed: 14 },
        skills: equip([basicAtk, basicAtk, basicAtk, basicAtk]),
      },
    },
    p1Label: "Atordoador",
    p2Label: "Atordoado ",
    chooseP1: fixedAction("p1-stun", ["s1-stun", "s1-basic", "s1-stun"]),
    chooseP2: fixedAction("p2-stun", ["s1-basic", "s1-basic", "s1-basic"]),
    maxTurns: 3,
  });

  // --- SUB-CENARIO 1E: SLOW (2 turnos -2 speed stages) ---
  // P2 e mais rapido (speed 20 vs 14), mas P1 aplica SLOW no T1
  // Com SLOW (-2 stages = x0.65), P2 effectiveSpeed = 20*0.65=13 < 14 de P1
  // Entao P1 deve agir primeiro nos turnos 2 e 3
  const slowWave = makeSkill({
    id: "s1-slow", name: "Onda Letargica", basePower: 20, damageType: "MAGICAL",
    target: "SINGLE_ENEMY", tier: 1, cooldown: 0,
    effects: [{ type: "STATUS", target: "SINGLE_ENEMY", status: "SLOW", chance: 100, duration: 2 } as SkillEffect],
  });

  const slowResult = runScenario({
    name: "1E. SLOW (2 turnos -2 speed stages)",
    description: "P2 e mais rapido (20 vs 14). Slow aplicado no T1 faz P2 ficar com speed efetivo 13. P1 age primeiro nos T2-T3",
    config: {
      battleId: "sc1e-slow",
      player1: {
        userId: "p1-slow", characterId: "c1",
        stats: { physicalAtk: 15, physicalDef: 15, magicAtk: 15, magicDef: 15, hp: 300, speed: 14 },
        skills: equip([slowWave, basicAtk, basicAtk, basicAtk]),
      },
      player2: {
        userId: "p2-slow", characterId: "c2",
        stats: { physicalAtk: 15, physicalDef: 15, magicAtk: 15, magicDef: 15, hp: 300, speed: 20 },
        skills: equip([basicAtk, basicAtk, basicAtk, basicAtk]),
      },
    },
    p1Label: "Retardador",
    p2Label: "Retardado ",
    chooseP1: fixedAction("p1-slow", ["s1-slow", "s1-basic", "s1-basic", "s1-basic"]),
    chooseP2: fixedAction("p2-slow", ["s1-basic", "s1-basic", "s1-basic", "s1-basic"]),
    maxTurns: 4,
  });

  // Combinar todos os eventos dos sub-cenarios
  const allEvents = [
    ...poisonResult.allEvents,
    ...burnResult.allEvents,
    ...frozenResult.allEvents,
    ...stunResult.allEvents,
    ...slowResult.allEvents,
  ];

  return { name: "1. STATUS EFFECTS (todos)", allEvents, finalState: slowResult.finalState };
}

// ===========================================================================
// CENARIO 2: Buff / Debuff / Stages
// ===========================================================================

function scenario2_BuffDebuffStages(): ScenarioResult {
  const buffAtk = makeSkill({
    id: "s2-buff", name: "Fortalecer", basePower: 0, damageType: "NONE",
    target: "SELF", tier: 1, cooldown: 0,
    effects: [{ type: "BUFF", target: "SELF", stat: "physicalAtk", value: 2, duration: 3 } as SkillEffect],
  });
  const heavySlash = makeSkill({
    id: "s2-slash", name: "Golpe Pesado", basePower: 50, damageType: "PHYSICAL",
    target: "SINGLE_ENEMY", tier: 1, cooldown: 0,
  });
  const debuffDef = makeSkill({
    id: "s2-debuff", name: "Destruir Armadura", basePower: 0, damageType: "NONE",
    target: "SINGLE_ENEMY", tier: 1, cooldown: 0,
    effects: [{ type: "DEBUFF", target: "SINGLE_ENEMY", stat: "physicalDef", value: 2, duration: 3 } as SkillEffect],
  });
  const lightJab = makeSkill({
    id: "s2-jab", name: "Soco Rapido", basePower: 35, damageType: "PHYSICAL",
    target: "SINGLE_ENEMY", tier: 1, cooldown: 0,
  });

  // P2 uses basic attacks
  const punch = makeSkill({
    id: "s2-punch", name: "Murro", basePower: 40, damageType: "PHYSICAL",
    target: "SINGLE_ENEMY", tier: 1, cooldown: 0,
  });

  const config: InitBattleConfig = {
    battleId: "sc2-buff",
    player1: {
      userId: "p1-buff", characterId: "c1",
      stats: { physicalAtk: 20, physicalDef: 15, magicAtk: 10, magicDef: 10, hp: 200, speed: 16 },
      skills: equip([buffAtk, heavySlash, debuffDef, lightJab]),
    },
    player2: {
      userId: "p2-buff", characterId: "c2",
      stats: { physicalAtk: 18, physicalDef: 15, magicAtk: 10, magicDef: 10, hp: 200, speed: 14 },
      skills: equip([punch, punch, punch, punch]),
    },
  };

  // P1: buff atk -> debuff def inimigo -> golpe pesado -> golpe pesado -> repete
  return runScenario({
    name: "2. BUFF / DEBUFF / STAGES",
    description: "BUFF +physicalAtk, DEBUFF -physicalDef — verificar que stages afetam o dano",
    config,
    p1Label: "Estrategista",
    p2Label: "Bruto      ",
    chooseP1: fixedAction("p1-buff", ["s2-buff", "s2-debuff", "s2-slash", "s2-slash", "s2-buff", "s2-debuff", "s2-slash"]),
    chooseP2: fixedAction("p2-buff", ["s2-punch"]),
    maxTurns: 7,
  });
}

// ===========================================================================
// CENARIO 3: Vulnerability + Multi-hit
// ===========================================================================

function scenario3_VulnMultiHit(): ScenarioResult {
  const vulnApply = makeSkill({
    id: "s3-vuln", name: "Expor Fraqueza", basePower: 20, damageType: "PHYSICAL",
    target: "SINGLE_ENEMY", tier: 1, cooldown: 0,
    effects: [{
      type: "VULNERABILITY", target: "SINGLE_ENEMY",
      damageType: "PHYSICAL", percent: 40, duration: 3,
    } as SkillEffect],
  });
  const multiHit = makeSkill({
    id: "s3-multi", name: "Rajada de Golpes", basePower: 30, damageType: "PHYSICAL",
    target: "SINGLE_ENEMY", tier: 1, cooldown: 0, hits: 3,
  });
  const filler1 = makeSkill({
    id: "s3-f1", name: "Golpe Lateral", basePower: 35, damageType: "PHYSICAL",
    target: "SINGLE_ENEMY", tier: 1, cooldown: 0,
  });
  const filler2 = makeSkill({
    id: "s3-f2", name: "Chute", basePower: 30, damageType: "PHYSICAL",
    target: "SINGLE_ENEMY", tier: 1, cooldown: 0,
  });

  // P2 just attacks
  const p2atk = makeSkill({
    id: "s3-p2", name: "Ataque Normal", basePower: 40, damageType: "PHYSICAL",
    target: "SINGLE_ENEMY", tier: 1, cooldown: 0,
  });

  const config: InitBattleConfig = {
    battleId: "sc3-vuln",
    player1: {
      userId: "p1-vuln", characterId: "c1",
      stats: { physicalAtk: 22, physicalDef: 15, magicAtk: 10, magicDef: 10, hp: 200, speed: 16 },
      skills: equip([vulnApply, multiHit, filler1, filler2]),
    },
    player2: {
      userId: "p2-vuln", characterId: "c2",
      stats: { physicalAtk: 18, physicalDef: 15, magicAtk: 10, magicDef: 10, hp: 200, speed: 14 },
      skills: equip([p2atk, p2atk, p2atk, p2atk]),
    },
  };

  // T1: apply vuln, T2: multi-hit, T3: multi-hit again
  return runScenario({
    name: "3. VULNERABILITY + MULTI-HIT",
    description: "VULNERABILITY +40% PHYSICAL 3t, depois skill com hits:3",
    config,
    p1Label: "Debilitador",
    p2Label: "Alvo       ",
    chooseP1: fixedAction("p1-vuln", ["s3-vuln", "s3-multi", "s3-multi", "s3-f1"]),
    chooseP2: fixedAction("p2-vuln", ["s3-p2"]),
    maxTurns: 5,
  });
}

// ===========================================================================
// CENARIO 4: Counter + onTrigger
// ===========================================================================

function scenario4_Counter(): ScenarioResult {
  const counterSkill = makeSkill({
    id: "s4-counter", name: "Postura Retaliadora", basePower: 0, damageType: "NONE",
    target: "SELF", tier: 1, cooldown: 0,
    effects: [{
      type: "COUNTER", target: "SELF", powerMultiplier: 0.5, duration: 2,
      onTrigger: [{
        type: "DEBUFF", target: "SINGLE_ENEMY", stat: "physicalAtk", value: 1, duration: 2,
      }],
    } as SkillEffect],
  });
  const counterAtk = makeSkill({
    id: "s4-catk", name: "Golpe Firme", basePower: 40, damageType: "PHYSICAL",
    target: "SINGLE_ENEMY", tier: 1, cooldown: 0,
  });
  const counterFiller = makeSkill({
    id: "s4-fill", name: "Investida", basePower: 35, damageType: "PHYSICAL",
    target: "SINGLE_ENEMY", tier: 1, cooldown: 0,
  });
  const counterHeal = makeSkill({
    id: "s4-heal", name: "Cura Menor", basePower: 0, damageType: "NONE",
    target: "SELF", tier: 1, cooldown: 0,
    effects: [{ type: "HEAL", target: "SELF", percent: 15 } as SkillEffect],
  });

  // P2 attacks every turn to trigger the counter
  const heavyAtk = makeSkill({
    id: "s4-heavy", name: "Martelo", basePower: 55, damageType: "PHYSICAL",
    target: "SINGLE_ENEMY", tier: 1, cooldown: 0,
  });

  const config: InitBattleConfig = {
    battleId: "sc4-counter",
    player1: {
      userId: "p1-counter", characterId: "c1",
      stats: { physicalAtk: 18, physicalDef: 18, magicAtk: 10, magicDef: 10, hp: 250, speed: 16 },
      skills: equip([counterSkill, counterAtk, counterFiller, counterHeal]),
    },
    player2: {
      userId: "p2-counter", characterId: "c2",
      stats: { physicalAtk: 22, physicalDef: 14, magicAtk: 10, magicDef: 10, hp: 250, speed: 14 },
      skills: equip([heavyAtk, heavyAtk, heavyAtk, heavyAtk]),
    },
  };

  // P1: counter -> attack -> counter -> attack
  return runScenario({
    name: "4. COUNTER + onTrigger",
    description: "COUNTER 0.5x 2t com onTrigger DEBUFF -1 physicalAtk. Atacante bate e recebe contra-ataque",
    config,
    p1Label: "Defensor   ",
    p2Label: "Agressor   ",
    chooseP1: fixedAction("p1-counter", ["s4-counter", "s4-catk", "s4-counter", "s4-catk", "s4-catk"]),
    chooseP2: fixedAction("p2-counter", ["s4-heavy"]),
    maxTurns: 6,
  });
}

// ===========================================================================
// CENARIO 5: Heal + Cleanse
// ===========================================================================

function scenario5_HealCleanse(): ScenarioResult {
  // P1: aplica debuffs e status no P2, depois P2 usa cleanse e heal
  const burnAtk = makeSkill({
    id: "s5-burn", name: "Chama Viva", basePower: 35, damageType: "MAGICAL",
    target: "SINGLE_ENEMY", tier: 1, cooldown: 0,
    effects: [{ type: "STATUS", target: "SINGLE_ENEMY", status: "BURN", chance: 100, duration: 3 } as SkillEffect],
  });
  const debAtk = makeSkill({
    id: "s5-deb", name: "Intimidar", basePower: 0, damageType: "NONE",
    target: "SINGLE_ENEMY", tier: 1, cooldown: 0,
    effects: [{ type: "DEBUFF", target: "SINGLE_ENEMY", stat: "physicalAtk", value: 2, duration: 3 } as SkillEffect],
  });
  const slashP1 = makeSkill({
    id: "s5-slash", name: "Corte Rapido", basePower: 45, damageType: "PHYSICAL",
    target: "SINGLE_ENEMY", tier: 1, cooldown: 0,
  });
  const fillerP1 = makeSkill({
    id: "s5-fill", name: "Jab", basePower: 30, damageType: "PHYSICAL",
    target: "SINGLE_ENEMY", tier: 1, cooldown: 0,
  });

  // P2: endures then cleanses and heals
  const cleanseAll = makeSkill({
    id: "s5-cleanse", name: "Purificacao Total", basePower: 0, damageType: "NONE",
    target: "SELF", tier: 1, cooldown: 0,
    effects: [{ type: "CLEANSE", target: "SELF", targets: "ALL" } as SkillEffect],
  });
  const bigHeal = makeSkill({
    id: "s5-heal", name: "Cura Profunda", basePower: 0, damageType: "NONE",
    target: "SELF", tier: 1, cooldown: 0,
    effects: [{ type: "HEAL", target: "SELF", percent: 30 } as SkillEffect],
  });
  const atkP2 = makeSkill({
    id: "s5-atk", name: "Ataque Basico", basePower: 40, damageType: "PHYSICAL",
    target: "SINGLE_ENEMY", tier: 1, cooldown: 0,
  });
  const defP2 = makeSkill({
    id: "s5-def", name: "Guardar", basePower: 0, damageType: "NONE",
    target: "SELF", tier: 1, cooldown: 0,
    effects: [{ type: "BUFF", target: "SELF", stat: "physicalDef", value: 1, duration: 2 } as SkillEffect],
  });

  const config: InitBattleConfig = {
    battleId: "sc5-cleanse",
    player1: {
      userId: "p1-cleanse", characterId: "c1",
      stats: { physicalAtk: 20, physicalDef: 15, magicAtk: 20, magicDef: 15, hp: 200, speed: 16 },
      skills: equip([burnAtk, debAtk, slashP1, fillerP1]),
    },
    player2: {
      userId: "p2-cleanse", characterId: "c2",
      stats: { physicalAtk: 18, physicalDef: 15, magicAtk: 10, magicDef: 15, hp: 200, speed: 14 },
      skills: equip([cleanseAll, bigHeal, atkP2, defP2]),
    },
  };

  // P1: burn -> debuff -> slash -> slash
  // P2: atk (takes status) -> atk (suffers) -> cleanse -> heal
  return runScenario({
    name: "5. HEAL + CLEANSE",
    description: "Aplicar BURN + DEBUFF, depois CLEANSE ALL e HEAL 30%",
    config,
    p1Label: "Agressor ",
    p2Label: "Curandeiro",
    chooseP1: fixedAction("p1-cleanse", ["s5-burn", "s5-deb", "s5-slash", "s5-slash", "s5-slash"]),
    chooseP2: fixedAction("p2-cleanse", ["s5-atk", "s5-atk", "s5-cleanse", "s5-heal", "s5-atk"]),
    maxTurns: 6,
  });
}

// ===========================================================================
// CENARIO 6: Recoil + Self Debuff
// ===========================================================================

function scenario6_RecoilSelfDebuff(): ScenarioResult {
  const recklessSmash = makeSkill({
    id: "s6-reckless", name: "Impacto Brutal", basePower: 80, damageType: "PHYSICAL",
    target: "SINGLE_ENEMY", tier: 1, cooldown: 0,
    effects: [
      { type: "RECOIL", target: "SELF", percentOfDamage: 25 } as SkillEffect,
      { type: "SELF_DEBUFF", target: "SELF", stat: "physicalAtk", value: 1, duration: 2 } as SkillEffect,
    ],
  });
  const lightAtk = makeSkill({
    id: "s6-light", name: "Golpe Leve", basePower: 30, damageType: "PHYSICAL",
    target: "SINGLE_ENEMY", tier: 1, cooldown: 0,
  });
  const rest = makeSkill({
    id: "s6-rest", name: "Descanso", basePower: 0, damageType: "NONE",
    target: "SELF", tier: 1, cooldown: 0,
    effects: [{ type: "HEAL", target: "SELF", percent: 15 } as SkillEffect],
  });
  const filler6 = makeSkill({
    id: "s6-fill", name: "Empurrao", basePower: 25, damageType: "PHYSICAL",
    target: "SINGLE_ENEMY", tier: 1, cooldown: 0,
  });

  // P2 basic attacks
  const p2atk = makeSkill({
    id: "s6-p2", name: "Soco", basePower: 40, damageType: "PHYSICAL",
    target: "SINGLE_ENEMY", tier: 1, cooldown: 0,
  });

  const config: InitBattleConfig = {
    battleId: "sc6-recoil",
    player1: {
      userId: "p1-recoil", characterId: "c1",
      stats: { physicalAtk: 25, physicalDef: 14, magicAtk: 10, magicDef: 10, hp: 250, speed: 16 },
      skills: equip([recklessSmash, lightAtk, rest, filler6]),
    },
    player2: {
      userId: "p2-recoil", characterId: "c2",
      stats: { physicalAtk: 18, physicalDef: 15, magicAtk: 10, magicDef: 10, hp: 250, speed: 14 },
      skills: equip([p2atk, p2atk, p2atk, p2atk]),
    },
  };

  // P1: reckless -> rest -> reckless -> light -> reckless
  return runScenario({
    name: "6. RECOIL + SELF_DEBUFF",
    description: "RECOIL 25% do dano + SELF_DEBUFF -1 physicalAtk 2t",
    config,
    p1Label: "Berserker",
    p2Label: "Alvo     ",
    chooseP1: fixedAction("p1-recoil", ["s6-reckless", "s6-rest", "s6-reckless", "s6-light", "s6-reckless"]),
    chooseP2: fixedAction("p2-recoil", ["s6-p2"]),
    maxTurns: 6,
  });
}

// ===========================================================================
// CENARIO 7: Combo
// ===========================================================================

function scenario7_Combo(): ScenarioResult {
  const comboSkill = makeSkill({
    id: "s7-combo", name: "Sequencia Letal", basePower: 40, damageType: "PHYSICAL",
    target: "SINGLE_ENEMY", tier: 1, cooldown: 0,
    effects: [{
      type: "COMBO", maxStacks: 3,
      escalation: [
        { basePower: 40, hits: 1 },
        { basePower: 55, hits: 2 },
        { basePower: 70, hits: 3 },
      ],
    } as SkillEffect],
  });
  const breakCombo = makeSkill({
    id: "s7-break", name: "Chute Alto", basePower: 35, damageType: "PHYSICAL",
    target: "SINGLE_ENEMY", tier: 1, cooldown: 0,
  });
  const filler7a = makeSkill({
    id: "s7-f1", name: "Jab Rapido", basePower: 25, damageType: "PHYSICAL",
    target: "SINGLE_ENEMY", tier: 1, cooldown: 0,
  });
  const filler7b = makeSkill({
    id: "s7-f2", name: "Cotovelada", basePower: 30, damageType: "PHYSICAL",
    target: "SINGLE_ENEMY", tier: 1, cooldown: 0,
  });

  const p2atk = makeSkill({
    id: "s7-p2", name: "Ataque", basePower: 35, damageType: "PHYSICAL",
    target: "SINGLE_ENEMY", tier: 1, cooldown: 0,
  });

  const config: InitBattleConfig = {
    battleId: "sc7-combo",
    player1: {
      userId: "p1-combo", characterId: "c1",
      stats: { physicalAtk: 22, physicalDef: 15, magicAtk: 10, magicDef: 10, hp: 300, speed: 16 },
      skills: equip([comboSkill, breakCombo, filler7a, filler7b]),
    },
    player2: {
      userId: "p2-combo", characterId: "c2",
      stats: { physicalAtk: 18, physicalDef: 15, magicAtk: 10, magicDef: 10, hp: 300, speed: 14 },
      skills: equip([p2atk, p2atk, p2atk, p2atk]),
    },
  };

  // Combo x3, break, combo x3 to show reset
  return runScenario({
    name: "7. COMBO",
    description: "COMBO maxStacks:3 escalation [40/1, 55/2, 70/3]. Usar 3x seguidas, quebrar, recomecar",
    config,
    p1Label: "Combo Master",
    p2Label: "Saco de Areia",
    chooseP1: fixedAction("p1-combo", [
      "s7-combo", "s7-combo", "s7-combo", // stacks 1,2,3
      "s7-break",                          // reset combo
      "s7-combo", "s7-combo",              // stacks 1,2 novamente
    ]),
    chooseP2: fixedAction("p2-combo", ["s7-p2"]),
    maxTurns: 7,
  });
}

// ===========================================================================
// CENARIO 8: ON_EXPIRE
// ===========================================================================

function scenario8_OnExpire(): ScenarioResult {
  const onExpireSkill = makeSkill({
    id: "s8-expire", name: "Forca Temporaria", basePower: 0, damageType: "NONE",
    target: "SELF", tier: 1, cooldown: 0,
    effects: [{
      type: "ON_EXPIRE",
      trigger: { type: "BUFF", target: "SELF", stat: "physicalAtk", value: 2, duration: 2 },
      effect: { type: "DEBUFF", target: "SELF", stat: "speed", value: 1, duration: 2 },
    } as SkillEffect],
  });
  const slash8 = makeSkill({
    id: "s8-slash", name: "Corte Forte", basePower: 50, damageType: "PHYSICAL",
    target: "SINGLE_ENEMY", tier: 1, cooldown: 0,
  });
  const light8 = makeSkill({
    id: "s8-light", name: "Corte Rapido", basePower: 35, damageType: "PHYSICAL",
    target: "SINGLE_ENEMY", tier: 1, cooldown: 0,
  });
  const heal8 = makeSkill({
    id: "s8-heal", name: "Cura Leve", basePower: 0, damageType: "NONE",
    target: "SELF", tier: 1, cooldown: 0,
    effects: [{ type: "HEAL", target: "SELF", percent: 10 } as SkillEffect],
  });

  const p2atk = makeSkill({
    id: "s8-p2", name: "Ataque Basico", basePower: 35, damageType: "PHYSICAL",
    target: "SINGLE_ENEMY", tier: 1, cooldown: 0,
  });

  const config: InitBattleConfig = {
    battleId: "sc8-expire",
    player1: {
      userId: "p1-expire", characterId: "c1",
      stats: { physicalAtk: 20, physicalDef: 15, magicAtk: 10, magicDef: 10, hp: 250, speed: 16 },
      skills: equip([onExpireSkill, slash8, light8, heal8]),
    },
    player2: {
      userId: "p2-expire", characterId: "c2",
      stats: { physicalAtk: 18, physicalDef: 15, magicAtk: 10, magicDef: 10, hp: 250, speed: 14 },
      skills: equip([p2atk, p2atk, p2atk, p2atk]),
    },
  };

  // T1: apply ON_EXPIRE buff (2t), T2-3: slash (buffed), T4+: debuff kicks in
  return runScenario({
    name: "8. ON_EXPIRE",
    description: "BUFF +2 physicalAtk 2t com ON_EXPIRE -> DEBUFF -1 speed 2t ao expirar",
    config,
    p1Label: "Guerreiro",
    p2Label: "Alvo     ",
    chooseP1: fixedAction("p1-expire", ["s8-expire", "s8-slash", "s8-slash", "s8-light", "s8-light"]),
    chooseP2: fixedAction("p2-expire", ["s8-p2"]),
    maxTurns: 6,
  });
}

// ===========================================================================
// CENARIO 9: Priority Shift
// ===========================================================================

function scenario9_PriorityShift(): ScenarioResult {
  const prioritySkill = makeSkill({
    id: "s9-prio", name: "Impulso Rapido", basePower: 0, damageType: "NONE",
    target: "SELF", tier: 1, cooldown: 0,
    effects: [{
      type: "PRIORITY_SHIFT", target: "SELF", stages: 2, duration: 2,
    } as SkillEffect],
  });
  const strike9 = makeSkill({
    id: "s9-strike", name: "Golpe Certeiro", basePower: 45, damageType: "PHYSICAL",
    target: "SINGLE_ENEMY", tier: 1, cooldown: 0,
  });
  const filler9a = makeSkill({
    id: "s9-f1", name: "Tapa", basePower: 25, damageType: "PHYSICAL",
    target: "SINGLE_ENEMY", tier: 1, cooldown: 0,
  });
  const filler9b = makeSkill({
    id: "s9-f2", name: "Empurrao", basePower: 30, damageType: "PHYSICAL",
    target: "SINGLE_ENEMY", tier: 1, cooldown: 0,
  });

  // P2 is FASTER but P1 will use priority shift to go first
  const p2atk = makeSkill({
    id: "s9-p2", name: "Ataque Rapido", basePower: 40, damageType: "PHYSICAL",
    target: "SINGLE_ENEMY", tier: 1, cooldown: 0,
  });

  const config: InitBattleConfig = {
    battleId: "sc9-prio",
    player1: {
      userId: "p1-prio", characterId: "c1",
      stats: { physicalAtk: 20, physicalDef: 15, magicAtk: 10, magicDef: 10, hp: 200, speed: 10 }, // SLOW
      skills: equip([prioritySkill, strike9, filler9a, filler9b]),
    },
    player2: {
      userId: "p2-prio", characterId: "c2",
      stats: { physicalAtk: 18, physicalDef: 15, magicAtk: 10, magicDef: 10, hp: 200, speed: 20 }, // FAST
      skills: equip([p2atk, p2atk, p2atk, p2atk]),
    },
  };

  // T1: P1 uses priority shift (goes second this turn since it applies for NEXT turn order check)
  // T2-3: P1 should act first despite lower speed
  // T4+: priority wears off, P2 goes first again
  return runScenario({
    name: "9. PRIORITY_SHIFT",
    description: "P1 speed=10, P2 speed=20. P1 usa PRIORITY_SHIFT +2 para agir primeiro",
    config,
    p1Label: "Lento (P1)",
    p2Label: "Rapido(P2)",
    chooseP1: fixedAction("p1-prio", ["s9-prio", "s9-strike", "s9-strike", "s9-strike", "s9-f1"]),
    chooseP2: fixedAction("p2-prio", ["s9-p2"]),
    maxTurns: 6,
  });
}

// ===========================================================================
// CENARIO 10: Cooldowns
// ===========================================================================

function scenario10_Cooldowns(): ScenarioResult {
  const cd1Skill = makeSkill({
    id: "s10-cd1", name: "Golpe Forte (CD1)", basePower: 60, damageType: "PHYSICAL",
    target: "SINGLE_ENEMY", tier: 1, cooldown: 1,
  });
  const cd2Skill = makeSkill({
    id: "s10-cd2", name: "Devastacao (CD2)", basePower: 80, damageType: "PHYSICAL",
    target: "SINGLE_ENEMY", tier: 1, cooldown: 2,
  });
  const basicAtk10 = makeSkill({
    id: "s10-basic", name: "Ataque Basico", basePower: 30, damageType: "PHYSICAL",
    target: "SINGLE_ENEMY", tier: 1, cooldown: 0,
  });
  const weakAtk10 = makeSkill({
    id: "s10-weak", name: "Tapa Fraco", basePower: 20, damageType: "PHYSICAL",
    target: "SINGLE_ENEMY", tier: 1, cooldown: 0,
  });

  const p2atk = makeSkill({
    id: "s10-p2", name: "Murro", basePower: 35, damageType: "PHYSICAL",
    target: "SINGLE_ENEMY", tier: 1, cooldown: 0,
  });

  const config: InitBattleConfig = {
    battleId: "sc10-cd",
    player1: {
      userId: "p1-cd", characterId: "c1",
      stats: { physicalAtk: 22, physicalDef: 15, magicAtk: 10, magicDef: 10, hp: 300, speed: 16 },
      skills: equip([cd1Skill, cd2Skill, basicAtk10, weakAtk10]),
    },
    player2: {
      userId: "p2-cd", characterId: "c2",
      stats: { physicalAtk: 18, physicalDef: 15, magicAtk: 10, magicDef: 10, hp: 300, speed: 14 },
      skills: equip([p2atk, p2atk, p2atk, p2atk]),
    },
  };

  // T1: CD1 (goes on cd), T2: CD2 (cd1 still on cd), T3: basic (cd1 back, cd2 still on cd)
  // T4: CD1 again (cd2 back), T5: CD2 again
  // Sequence: T1 CD1, T2 CD2 (CD1 on cooldown), T3 try CD1 again (still on cd -> engine blocks),
  // T4 basic (cd1 back), T5 try CD2 (still on cd -> engine blocks), T6 CD1, T7 CD2
  let turnIdx10 = 0;
  const chooseP1 = (state: BattleState): TurnAction => {
    const player = state.players[0];
    const available = getAvailableSkills(player);

    // Log availability for visibility
    const cdInfo = Object.entries(player.cooldowns)
      .map(([id, cd]) => {
        const sk = player.equippedSkills.find((e) => e.skillId === id);
        return `${sk?.skill.name ?? id}(${cd}t)`;
      })
      .join(", ");
    if (cdInfo) console.log(`    [CD Info] Em cooldown: ${cdInfo}`);
    console.log(`    [CD Info] Disponiveis: ${available.map((s) => s.skill.name).join(", ")}`);

    // CD1=1 means: set to 1, tick to 0 at end of turn -> available next turn
    // CD2=2 means: set to 2, tick to 1 at end of turn -> still blocked next turn, tick to 0 -> available 2 turns later
    // To force a COOLDOWN event: use CD2 on T1, try CD2 on T2 (blocked!), use CD1 on T3
    const sequence: string[] = [
      "s10-cd2",   // T1: use Devastacao CD2 (set to 2, tick to 1)
      "s10-cd2",   // T2: TRY CD2 -> BLOCKED (still 1 turn left), tick to 0
      "s10-cd1",   // T3: use CD1 (available), CD2 now available too
      "s10-cd2",   // T4: use CD2 again
      "s10-cd2",   // T5: TRY CD2 -> BLOCKED again
      "s10-basic", // T6: basic
      "s10-cd2",   // T7: CD2 available again
    ];
    const skillId = sequence[turnIdx10 % sequence.length];
    turnIdx10++;
    return { playerId: "p1-cd", skillId };
  };

  return runScenario({
    name: "10. COOLDOWNS",
    description: "Skills com CD 1 e CD 2. Verificar indisponibilidade e retorno",
    config,
    p1Label: "Tactico  ",
    p2Label: "Constante",
    chooseP1,
    chooseP2: fixedAction("p2-cd", ["s10-p2"]),
    maxTurns: 7,
  });
}

// ===========================================================================
// CENARIO 11: IA Adaptativa
// ===========================================================================

function scenario11_AI(): ScenarioResult[] {
  // Same 4 skills for all 4 mobs
  const aiDamage = makeSkill({
    id: "ai-dmg", name: "Impacto Brutal", basePower: 55, damageType: "PHYSICAL",
    target: "SINGLE_ENEMY", tier: 1, cooldown: 0,
  });
  const aiHeal = makeSkill({
    id: "ai-heal", name: "Cura Restauradora", basePower: 0, damageType: "NONE",
    target: "SELF", tier: 1, cooldown: 0,
    effects: [{ type: "HEAL", target: "SELF", percent: 20 } as SkillEffect],
  });
  const aiDebuff = makeSkill({
    id: "ai-debuff", name: "Maldição de Fraqueza", basePower: 25, damageType: "MAGICAL",
    target: "SINGLE_ENEMY", tier: 1, cooldown: 0,
    effects: [
      { type: "DEBUFF", target: "SINGLE_ENEMY", stat: "physicalAtk", value: 1, duration: 2 } as SkillEffect,
      { type: "STATUS", target: "SINGLE_ENEMY", status: "SLOW", chance: 100, duration: 2 } as SkillEffect,
    ],
  });
  const aiBuff = makeSkill({
    id: "ai-buff", name: "Escudo Arcano", basePower: 0, damageType: "NONE",
    target: "SELF", tier: 1, cooldown: 0,
    effects: [{ type: "BUFF", target: "SELF", stat: "physicalDef", value: 1, duration: 3 } as SkillEffect],
  });

  const mobSkillSet = equip([aiDamage, aiHeal, aiDebuff, aiBuff]);

  // Player uses same skill every turn to keep it predictable
  const playerAtk = makeSkill({
    id: "ai-patk", name: "Ataque do Jogador", basePower: 40, damageType: "PHYSICAL",
    target: "SINGLE_ENEMY", tier: 1, cooldown: 0,
  });

  const profiles: AiProfile[] = ["AGGRESSIVE", "DEFENSIVE", "TACTICAL", "BALANCED"];
  const results: ScenarioResult[] = [];

  for (const profile of profiles) {
    const config: InitBattleConfig = {
      battleId: `sc11-${profile}`,
      player1: {
        userId: "p1-ai", characterId: "c1",
        stats: { physicalAtk: 20, physicalDef: 15, magicAtk: 15, magicDef: 15, hp: 150, speed: 16 },
        skills: equip([playerAtk, playerAtk, playerAtk, playerAtk]),
      },
      player2: {
        userId: `mob-${profile}`, characterId: "c2",
        stats: { physicalAtk: 18, physicalDef: 14, magicAtk: 16, magicDef: 14, hp: 150, speed: 14 },
        skills: mobSkillSet.map((s) => ({ ...s })), // clone
      },
    };

    const chooseP2 = (state: BattleState): TurnAction => {
      const action = chooseAction({
        state,
        mobPlayerId: `mob-${profile}`,
        profile,
        randomFn: () => 0.5, // deterministic
      });
      const sk = mobSkillSet.find((s) => s.skillId === action.skillId);
      console.log(`    [IA ${profile}] Escolheu: ${sk?.skill.name ?? "SKIP"}`);
      return action;
    };

    const result = runScenario({
      name: `11. IA ADAPTATIVA — ${profile}`,
      description: `Perfil ${profile}: mesmas 4 skills (dano/heal/debuff/buff), observar preferencias`,
      config,
      p1Label: "Jogador  ",
      p2Label: `Mob ${profile.slice(0, 4).padEnd(4)}`,
      chooseP1: fixedAction("p1-ai", ["ai-patk"]),
      chooseP2,
      maxTurns: 3,
    });
    results.push(result);
  }

  return results;
}

// ===========================================================================
// CENARIO 12: Limite 50 turnos
// ===========================================================================

function scenario12_DrawLimit(): ScenarioResult {
  const megaHeal = makeSkill({
    id: "s12-heal", name: "Mega Cura", basePower: 0, damageType: "NONE",
    target: "SELF", tier: 1, cooldown: 0,
    effects: [{ type: "HEAL", target: "SELF", percent: 50 } as SkillEffect],
  });
  const tinyAtk = makeSkill({
    id: "s12-atk", name: "Arranhao", basePower: 5, damageType: "PHYSICAL",
    target: "SINGLE_ENEMY", tier: 1, cooldown: 0,
  });
  const superDef = makeSkill({
    id: "s12-def", name: "Muralha", basePower: 0, damageType: "NONE",
    target: "SELF", tier: 1, cooldown: 0,
    effects: [{ type: "BUFF", target: "SELF", stat: "physicalDef", value: 2, duration: 3 } as SkillEffect],
  });
  const megaHeal2 = makeSkill({
    id: "s12-heal2", name: "Regeneracao", basePower: 0, damageType: "NONE",
    target: "SELF", tier: 1, cooldown: 0,
    effects: [{ type: "HEAL", target: "SELF", percent: 40 } as SkillEffect],
  });

  const config: InitBattleConfig = {
    battleId: "sc12-draw",
    player1: {
      userId: "p1-draw", characterId: "c1",
      stats: { physicalAtk: 5, physicalDef: 30, magicAtk: 5, magicDef: 30, hp: 500, speed: 16 },
      skills: equip([megaHeal, tinyAtk, superDef, megaHeal2]),
    },
    player2: {
      userId: "p2-draw", characterId: "c2",
      stats: { physicalAtk: 5, physicalDef: 30, magicAtk: 5, magicDef: 30, hp: 500, speed: 14 },
      skills: equip([megaHeal, tinyAtk, superDef, megaHeal2]),
    },
  };

  // Both heal every turn, never die
  return runScenario({
    name: "12. LIMITE 50 TURNOS",
    description: "Dois healers com stats altissimos. Verificar empate apos 50 turnos",
    config,
    p1Label: "Healer 1",
    p2Label: "Healer 2",
    chooseP1: fixedAction("p1-draw", ["s12-heal", "s12-def", "s12-heal2", "s12-heal"]),
    chooseP2: fixedAction("p2-draw", ["s12-heal", "s12-def", "s12-heal2", "s12-heal"]),
    maxTurns: 55, // enough room for the 50 turn limit
  });
}

// ===========================================================================
// CHECKLIST de mecanicas
// ===========================================================================

type MechanicCheck = {
  name: string;
  check: (allEvents: TurnLogEntry[]) => boolean;
};

function runChecklist(allEvents: TurnLogEntry[], finalStates: BattleState[]): void {
  console.log("\n" + "=".repeat(70));
  console.log("  CHECKLIST DE MECANICAS");
  console.log("=".repeat(70));

  const drawState = finalStates.find((s) => s.battleId === "sc12-draw");

  const checks: MechanicCheck[] = [
    {
      name: "STATUS: STUN — perda de turno",
      check: (ev) => ev.some((e) => e.phase === "INCAPACITATED" && e.message.includes("STUN")),
    },
    {
      name: "STATUS: FROZEN — perda de turno",
      check: (ev) => ev.some((e) => e.phase === "INCAPACITATED" && e.message.includes("FROZEN")),
    },
    {
      name: "STATUS: BURN — dano por turno",
      check: (ev) => ev.some((e) => e.phase === "STATUS_DAMAGE" && e.message.includes("queimadura")),
    },
    {
      name: "STATUS: POISON — dano por turno",
      check: (ev) => ev.some((e) => e.phase === "STATUS_DAMAGE" && e.message.includes("envenenamento")),
    },
    {
      name: "STATUS: SLOW — aplicado",
      check: (ev) => ev.some((e) => e.statusApplied === "SLOW"),
    },
    {
      name: "BUFF — aplicado",
      check: (ev) => ev.some((e) => e.buffApplied !== undefined && e.buffApplied.value > 0),
    },
    {
      name: "DEBUFF — aplicado",
      check: (ev) => ev.some((e) => e.debuffApplied !== undefined),
    },
    {
      name: "VULNERABILITY — aplicado",
      check: (ev) => ev.some((e) => e.message.includes("vulneravel")),
    },
    {
      name: "MULTI-HIT — mais de 1 hit",
      check: (ev) => ev.some((e) => e.phase === "DAMAGE" && e.message.includes("3 hits")),
    },
    {
      name: "COUNTER — contra-ataque disparado",
      check: (ev) => ev.some((e) => e.counterTriggered === true),
    },
    {
      name: "COUNTER onTrigger — efeito secundario",
      check: (ev) => ev.some((e) => e.phase === "COUNTER_TRIGGER"),
    },
    {
      name: "HEAL — cura aplicada",
      check: (ev) => ev.some((e) => e.healing !== undefined && e.healing > 0),
    },
    {
      name: "CLEANSE — efeitos removidos",
      check: (ev) => ev.some((e) => e.message.includes("limpa efeitos")),
    },
    {
      name: "RECOIL — dano de recuo",
      check: (ev) => ev.some((e) => e.message.includes("recuo")),
    },
    {
      name: "SELF_DEBUFF — auto-debuff aplicado",
      check: (ev) => ev.some((e) => e.message.includes("auto-debuff")),
    },
    {
      name: "COMBO — stack acumulado",
      check: (ev) => ev.some((e) => e.comboStack !== undefined && e.comboStack >= 2),
    },
    {
      name: "ON_EXPIRE — efeito disparado ao expirar",
      check: (ev) => ev.some((e) => e.phase === "ON_EXPIRE"),
    },
    {
      name: "PRIORITY_SHIFT — modificador de prioridade",
      check: (ev) => ev.some((e) => e.message.includes("prioridade")),
    },
    {
      name: "COOLDOWN — skill bloqueada por cooldown",
      check: (ev) => ev.some((e) => e.phase === "COOLDOWN"),
    },
    {
      name: "DRAW — empate por limite de turnos",
      check: (_ev) => drawState !== undefined && drawState.winnerId === null && drawState.status === "FINISHED",
    },
    {
      name: "DAMAGE — dano causado",
      check: (ev) => ev.some((e) => e.damage !== undefined && e.damage > 0),
    },
    {
      name: "DEATH — jogador derrotado",
      check: (ev) => ev.some((e) => e.phase === "DEATH"),
    },
  ];

  let passed = 0;
  let failed = 0;

  for (const c of checks) {
    const ok = c.check(allEvents);
    const icon = ok ? "\u2713" : "\u2717";
    console.log(`  ${icon} ${c.name}`);
    if (ok) passed++;
    else failed++;
  }

  console.log();
  console.log(`  Resultado: ${passed}/${passed + failed} mecanicas verificadas`);
  if (failed > 0) {
    console.log(`  ATENCAO: ${failed} mecanica(s) nao foram detectadas nos eventos!`);
  } else {
    console.log("  Todas as mecanicas foram exercitadas com sucesso!");
  }
  console.log("=".repeat(70));
}

// ===========================================================================
// MAIN
// ===========================================================================

function main(): void {
  console.log("\n" + "#".repeat(70));
  console.log("  SIMULADOR COMPLETO DE BATALHA — Craft Mind Engine");
  console.log("  Testando TODAS as mecanicas da engine de combate");
  console.log("#".repeat(70));

  const allEvents: TurnLogEntry[] = [];
  const allFinalStates: BattleState[] = [];

  // Cenario 1
  const r1 = scenario1_StatusEffects();
  allEvents.push(...r1.allEvents);
  allFinalStates.push(r1.finalState);

  // Cenario 2
  const r2 = scenario2_BuffDebuffStages();
  allEvents.push(...r2.allEvents);
  allFinalStates.push(r2.finalState);

  // Cenario 3
  const r3 = scenario3_VulnMultiHit();
  allEvents.push(...r3.allEvents);
  allFinalStates.push(r3.finalState);

  // Cenario 4
  const r4 = scenario4_Counter();
  allEvents.push(...r4.allEvents);
  allFinalStates.push(r4.finalState);

  // Cenario 5
  const r5 = scenario5_HealCleanse();
  allEvents.push(...r5.allEvents);
  allFinalStates.push(r5.finalState);

  // Cenario 6
  const r6 = scenario6_RecoilSelfDebuff();
  allEvents.push(...r6.allEvents);
  allFinalStates.push(r6.finalState);

  // Cenario 7
  const r7 = scenario7_Combo();
  allEvents.push(...r7.allEvents);
  allFinalStates.push(r7.finalState);

  // Cenario 8
  const r8 = scenario8_OnExpire();
  allEvents.push(...r8.allEvents);
  allFinalStates.push(r8.finalState);

  // Cenario 9
  const r9 = scenario9_PriorityShift();
  allEvents.push(...r9.allEvents);
  allFinalStates.push(r9.finalState);

  // Cenario 10
  const r10 = scenario10_Cooldowns();
  allEvents.push(...r10.allEvents);
  allFinalStates.push(r10.finalState);

  // Cenario 11 (retorna array)
  const r11s = scenario11_AI();
  for (const r of r11s) {
    allEvents.push(...r.allEvents);
    allFinalStates.push(r.finalState);
  }

  // Cenario 12
  const r12 = scenario12_DrawLimit();
  allEvents.push(...r12.allEvents);
  allFinalStates.push(r12.finalState);

  // Checklist final
  runChecklist(allEvents, allFinalStates);
}

main();
