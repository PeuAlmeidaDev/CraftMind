import { initBattle } from "../../lib/battle/init";
import { resolveTurn } from "../../lib/battle/turn";
import { calculatePvpExpGained } from "../../lib/exp/formulas";
import type {
  BattleState,
  EquippedSkill,
  BaseStats,
  TurnAction,
} from "../../lib/battle/types";
import type { Skill } from "../../types/skill";

// ---------------------------------------------------------------------------
// Skills de teste (constantes locais)
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

const bolaDeFogo: Skill = {
  id: "skill-bola-fogo",
  name: "Bola de Fogo",
  description: "Ataque magico",
  tier: 1,
  cooldown: 0,
  target: "SINGLE_ENEMY",
  damageType: "MAGICAL",
  basePower: 45,
  hits: 1,
  accuracy: 90,
  effects: [],
  mastery: {},
};

const investidaBrutal: Skill = {
  id: "skill-investida",
  name: "Investida Brutal",
  description: "Golpe forte com recoil",
  tier: 2,
  cooldown: 1,
  target: "SINGLE_ENEMY",
  damageType: "PHYSICAL",
  basePower: 80,
  hits: 1,
  accuracy: 85,
  effects: [
    { type: "RECOIL", target: "SELF", percentOfDamage: 25 },
  ],
  mastery: {},
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeEquipped(skill: Skill, slot: number): EquippedSkill {
  return { skillId: skill.id, slotIndex: slot, skill };
}

function makeStats(overrides?: Partial<BaseStats>): BaseStats {
  return {
    physicalAtk: 25,
    physicalDef: 15,
    magicAtk: 20,
    magicDef: 15,
    hp: 200,
    speed: 12,
    ...overrides,
  };
}

const fixedRandom = (): number => 0.5;

// ---------------------------------------------------------------------------
// Testes
// ---------------------------------------------------------------------------

describe("Fluxo de batalha PvP (integracao)", () => {
  it("fluxo completo: dois jogadores lutam ate FINISHED com winnerId definido", () => {
    const state = initBattle({
      battleId: "pvp-flow-1",
      player1: {
        userId: "player-a",
        characterId: "char-a",
        stats: makeStats(),
        skills: [
          makeEquipped(ataqueRapido, 0),
          makeEquipped(bolaDeFogo, 1),
        ],
      },
      player2: {
        userId: "player-b",
        characterId: "char-b",
        stats: makeStats(),
        skills: [
          makeEquipped(ataqueRapido, 0),
          makeEquipped(investidaBrutal, 1),
        ],
      },
    });

    let current: BattleState = state;
    let safetyCounter = 0;

    while (current.status === "IN_PROGRESS" && safetyCounter < 100) {
      const p1Skills = current.players[0].equippedSkills;
      const p2Skills = current.players[1].equippedSkills;

      const p1SkillId =
        p1Skills.find(
          (s) =>
            !current.players[0].cooldowns[s.skillId] ||
            current.players[0].cooldowns[s.skillId] <= 0
        )?.skillId ?? null;

      const p2SkillId =
        p2Skills.find(
          (s) =>
            !current.players[1].cooldowns[s.skillId] ||
            current.players[1].cooldowns[s.skillId] <= 0
        )?.skillId ?? null;

      const actions: [TurnAction, TurnAction] = [
        { playerId: current.players[0].playerId, skillId: p1SkillId },
        { playerId: current.players[1].playerId, skillId: p2SkillId },
      ];

      const result = resolveTurn(current, actions, fixedRandom);
      current = result.state;
      safetyCounter++;
    }

    expect(current.status).toBe("FINISHED");
    expect(current.winnerId).not.toBeNull();

    const loser = current.players.find(
      (p) => p.playerId !== current.winnerId
    );
    expect(loser).toBeDefined();
    expect(loser!.currentHp).toBeLessThanOrEqual(0);
  });

  it("calcula EXP correto apos vitoria e derrota", () => {
    const victoryExp = calculatePvpExpGained("VICTORY", 10, 10);
    const defeatExp = calculatePvpExpGained("DEFEAT", 10, 10);

    expect(victoryExp).toBe(50);
    expect(defeatExp).toBe(0);
  });

  it("empate por limite de turnos com stats absurdos", () => {
    const tankSkill: Skill = {
      id: "skill-tickle",
      name: "Cosquinha",
      description: "Dano minimo",
      tier: 1,
      cooldown: 0,
      target: "SINGLE_ENEMY",
      damageType: "PHYSICAL",
      basePower: 1,
      hits: 1,
      accuracy: 100,
      effects: [],
      mastery: {},
    };

    const tankStats = makeStats({
      hp: 9999,
      physicalDef: 999,
      magicDef: 999,
      physicalAtk: 1,
      magicAtk: 1,
    });

    const state = initBattle({
      battleId: "pvp-draw-1",
      player1: {
        userId: "tank-a",
        characterId: "char-tank-a",
        stats: tankStats,
        skills: [makeEquipped(tankSkill, 0)],
      },
      player2: {
        userId: "tank-b",
        characterId: "char-tank-b",
        stats: tankStats,
        skills: [makeEquipped(tankSkill, 0)],
      },
    });

    let current: BattleState = state;
    let safetyCounter = 0;

    while (current.status === "IN_PROGRESS" && safetyCounter < 200) {
      const actions: [TurnAction, TurnAction] = [
        { playerId: current.players[0].playerId, skillId: tankSkill.id },
        { playerId: current.players[1].playerId, skillId: tankSkill.id },
      ];

      const result = resolveTurn(current, actions, fixedRandom);
      current = result.state;
      safetyCounter++;
    }

    expect(current.status).toBe("FINISHED");
    expect(current.winnerId).toBeNull();

    const drawExp = calculatePvpExpGained("DRAW", 10, 10);
    expect(drawExp).toBe(25);
  });
});
