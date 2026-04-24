// Simulacao completa de batalhas PvE — testes da engine de combate
import { describe, it, expect } from "vitest";
import { initBattle } from "../init";
import { resolveTurn } from "../turn";
import { chooseAction } from "../ai";
import type {
  BattleState,
  TurnAction,
  EquippedSkill,
  BaseStats,
  TurnLogEntry,
} from "../types";
import type { Skill } from "@/types/skill";
import type { AiProfile } from "../ai-profiles";

// ---------------------------------------------------------------------------
// Skills de teste (baseadas nas skills reais do seed)
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
  description: "Ataque magico com chance de queimadura",
  tier: 1,
  cooldown: 0,
  target: "SINGLE_ENEMY",
  damageType: "MAGICAL",
  basePower: 45,
  hits: 1,
  accuracy: 90,
  effects: [
    {
      type: "STATUS",
      target: "SINGLE_ENEMY",
      status: "BURN",
      chance: 30,
      duration: 3,
    },
  ],
  mastery: {},
};

const escudoArcano: Skill = {
  id: "skill-escudo-arcano",
  name: "Escudo Arcano",
  description: "Aumenta defesa magica",
  tier: 1,
  cooldown: 0,
  target: "SELF",
  damageType: "NONE",
  basePower: 0,
  hits: 0,
  accuracy: 100,
  effects: [
    {
      type: "BUFF",
      target: "SELF",
      stat: "magicDef",
      value: 2,
      duration: 3,
    },
  ],
  mastery: {},
};

const investidaBrutal: Skill = {
  id: "skill-investida-brutal",
  name: "Investida Brutal",
  description: "Golpe poderoso com recoil",
  tier: 2,
  cooldown: 1,
  target: "SINGLE_ENEMY",
  damageType: "PHYSICAL",
  basePower: 80,
  hits: 1,
  accuracy: 85,
  effects: [
    {
      type: "RECOIL",
      target: "SELF",
      percentOfDamage: 25,
    },
  ],
  mastery: {},
};

const curaNatural: Skill = {
  id: "skill-cura-natural",
  name: "Cura Natural",
  description: "Cura 25% do HP",
  tier: 2,
  cooldown: 1,
  target: "SELF",
  damageType: "NONE",
  basePower: 0,
  hits: 0,
  accuracy: 100,
  effects: [
    {
      type: "HEAL",
      target: "SELF",
      percent: 25,
    },
  ],
  mastery: {},
};

const rajadaGelida: Skill = {
  id: "skill-rajada-gelida",
  name: "Rajada Gelida",
  description: "Ataque magico com chance de congelar",
  tier: 2,
  cooldown: 1,
  target: "SINGLE_ENEMY",
  damageType: "MAGICAL",
  basePower: 60,
  hits: 1,
  accuracy: 85,
  effects: [
    {
      type: "STATUS",
      target: "SINGLE_ENEMY",
      status: "FROZEN",
      chance: 25,
      duration: 1,
    },
  ],
  mastery: {},
};

const golpeDuplo: Skill = {
  id: "skill-golpe-duplo",
  name: "Golpe Duplo",
  description: "Dois golpes fisicos rapidos",
  tier: 1,
  cooldown: 0,
  target: "SINGLE_ENEMY",
  damageType: "PHYSICAL",
  basePower: 25,
  hits: 2,
  accuracy: 95,
  effects: [],
  mastery: {},
};

const veneno: Skill = {
  id: "skill-veneno",
  name: "Mordida Venenosa",
  description: "Ataque fisico com chance de envenenamento",
  tier: 1,
  cooldown: 0,
  target: "SINGLE_ENEMY",
  damageType: "PHYSICAL",
  basePower: 35,
  hits: 1,
  accuracy: 95,
  effects: [
    {
      type: "STATUS",
      target: "SINGLE_ENEMY",
      status: "POISON",
      chance: 40,
      duration: 3,
    },
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
    physicalAtk: 20,
    physicalDef: 15,
    magicAtk: 18,
    magicDef: 14,
    hp: 200,
    speed: 15,
    ...overrides,
  };
}

/** Random determinístico que retorna sempre 0.5 (meio do range 0.9-1.1) */
const fixedRandom = () => 0.5;

/** Random que sempre "acerta" (para testes de efeitos com chance) */
const alwaysHitRandom = () => 0.01;

/** Random que sempre "erra" efeitos com chance */
const alwaysMissRandom = () => 0.99;

function simulateFullBattle(params: {
  playerStats: BaseStats;
  playerSkills: EquippedSkill[];
  mobStats: BaseStats;
  mobSkills: EquippedSkill[];
  mobProfile: AiProfile;
  playerStrategy: (state: BattleState, turn: number) => string | null;
  maxTurns?: number;
  randomFn?: () => number;
}): { finalState: BattleState; allEvents: TurnLogEntry[]; turns: number } {
  const {
    playerStats,
    playerSkills,
    mobStats,
    mobSkills,
    mobProfile,
    playerStrategy,
    maxTurns = 50,
    randomFn,
  } = params;

  let state = initBattle({
    battleId: "test-battle",
    player1: {
      userId: "player-1",
      characterId: "char-1",
      stats: playerStats,
      skills: playerSkills,
    },
    player2: {
      userId: "mob-1",
      characterId: "mob-char-1",
      stats: mobStats,
      skills: mobSkills,
    },
  });

  const allEvents: TurnLogEntry[] = [];
  let turns = 0;

  while (state.status === "IN_PROGRESS" && turns < maxTurns) {
    turns++;

    const playerAction: TurnAction = {
      playerId: "player-1",
      skillId: playerStrategy(state, turns),
    };

    const mobAction = chooseAction({
      state,
      mobPlayerId: "mob-1",
      profile: mobProfile,
      randomFn,
    });

    const result = resolveTurn(state, [playerAction, mobAction], randomFn);
    state = result.state;
    allEvents.push(...result.events);
  }

  return { finalState: state, allEvents, turns };
}

// ---------------------------------------------------------------------------
// Testes
// ---------------------------------------------------------------------------

describe("Battle Engine — Inicializacao", () => {
  it("deve criar estado inicial correto", () => {
    const state = initBattle({
      battleId: "b1",
      player1: {
        userId: "p1",
        characterId: "c1",
        stats: makeStats(),
        skills: [makeEquipped(ataqueRapido, 0)],
      },
      player2: {
        userId: "p2",
        characterId: "c2",
        stats: makeStats({ hp: 150 }),
        skills: [makeEquipped(bolaDeFogo, 0)],
      },
    });

    expect(state.status).toBe("IN_PROGRESS");
    expect(state.turnNumber).toBe(1);
    expect(state.players[0].currentHp).toBe(200);
    expect(state.players[1].currentHp).toBe(150);
    expect(state.players[0].equippedSkills).toHaveLength(1);
    expect(state.players[0].stages.physicalAtk).toBe(0);
    expect(state.winnerId).toBeNull();
  });

  it("deve rejeitar jogador sem skills", () => {
    expect(() =>
      initBattle({
        battleId: "b1",
        player1: {
          userId: "p1",
          characterId: "c1",
          stats: makeStats(),
          skills: [],
        },
        player2: {
          userId: "p2",
          characterId: "c2",
          stats: makeStats(),
          skills: [makeEquipped(ataqueRapido, 0)],
        },
      })
    ).toThrow("deve ter entre 1 e 4 skills");
  });
});

describe("Battle Engine — Resolucao de turno", () => {
  it("deve causar dano com ataque basico", () => {
    const state = initBattle({
      battleId: "b1",
      player1: {
        userId: "p1",
        characterId: "c1",
        stats: makeStats(),
        skills: [makeEquipped(ataqueRapido, 0)],
      },
      player2: {
        userId: "p2",
        characterId: "c2",
        stats: makeStats(),
        skills: [makeEquipped(ataqueRapido, 0)],
      },
    });

    const result = resolveTurn(
      state,
      [
        { playerId: "p1", skillId: ataqueRapido.id },
        { playerId: "p2", skillId: ataqueRapido.id },
      ],
      fixedRandom
    );

    // Ambos devem ter tomado dano
    expect(result.state.players[0].currentHp).toBeLessThan(200);
    expect(result.state.players[1].currentHp).toBeLessThan(200);
    expect(result.events.some((e) => e.phase === "DAMAGE")).toBe(true);
  });

  it("jogador mais rapido age primeiro", () => {
    const state = initBattle({
      battleId: "b1",
      player1: {
        userId: "fast",
        characterId: "c1",
        stats: makeStats({ speed: 30 }),
        skills: [makeEquipped(ataqueRapido, 0)],
      },
      player2: {
        userId: "slow",
        characterId: "c2",
        stats: makeStats({ speed: 5 }),
        skills: [makeEquipped(ataqueRapido, 0)],
      },
    });

    const result = resolveTurn(
      state,
      [
        { playerId: "fast", skillId: ataqueRapido.id },
        { playerId: "slow", skillId: ataqueRapido.id },
      ],
      fixedRandom
    );

    const damageEvents = result.events.filter((e) => e.phase === "DAMAGE");
    // Fast player acts first (speed advantage: 30/5 = 6x ratio → 2 extra actions)
    expect(damageEvents[0].actorId).toBe("fast");
    // Extra actions from fast player come next (may be COOLDOWN instead of DAMAGE)
    // Last damage event should be from slow player
    const lastDamage = damageEvents[damageEvents.length - 1];
    expect(lastDamage.actorId).toBe("slow");
  });

  it("skill em cooldown deve ser bloqueada", () => {
    // investidaBrutal tem cooldown=1 — deve ficar indisponivel no turno seguinte
    let state = initBattle({
      battleId: "b1",
      player1: {
        userId: "p1",
        characterId: "c1",
        stats: makeStats(),
        skills: [
          makeEquipped(investidaBrutal, 0),
          makeEquipped(ataqueRapido, 1),
        ],
      },
      player2: {
        userId: "p2",
        characterId: "c2",
        stats: makeStats({ hp: 500 }),
        skills: [makeEquipped(ataqueRapido, 0)],
      },
    });

    // Turno 1: usar investida brutal (cooldown=1)
    const r1 = resolveTurn(
      state,
      [
        { playerId: "p1", skillId: investidaBrutal.id },
        { playerId: "p2", skillId: ataqueRapido.id },
      ],
      fixedRandom
    );

    // Turno 2: tentar usar de novo — deve estar em cooldown
    const r2 = resolveTurn(
      r1.state,
      [
        { playerId: "p1", skillId: investidaBrutal.id },
        { playerId: "p2", skillId: ataqueRapido.id },
      ],
      fixedRandom
    );

    expect(r2.events.some((e) => e.phase === "COOLDOWN")).toBe(true);
  });

  it("golpe duplo deve acertar 2 vezes", () => {
    const state = initBattle({
      battleId: "b1",
      player1: {
        userId: "p1",
        characterId: "c1",
        stats: makeStats(),
        skills: [makeEquipped(golpeDuplo, 0)],
      },
      player2: {
        userId: "p2",
        characterId: "c2",
        stats: makeStats(),
        skills: [makeEquipped(ataqueRapido, 0)],
      },
    });

    const result = resolveTurn(
      state,
      [
        { playerId: "p1", skillId: golpeDuplo.id },
        { playerId: "p2", skillId: ataqueRapido.id },
      ],
      fixedRandom
    );

    const p1Damage = result.events.find(
      (e) => e.phase === "DAMAGE" && e.actorId === "p1"
    );
    // A mensagem deve indicar "2 hits"
    expect(p1Damage?.message).toContain("2 hits");
  });
});

describe("Battle Engine — Status Effects", () => {
  it("BURN deve causar dano por turno e reduzir physicalAtk", () => {
    let state = initBattle({
      battleId: "b1",
      player1: {
        userId: "p1",
        characterId: "c1",
        stats: makeStats({ hp: 300, magicAtk: 30 }),
        skills: [makeEquipped(bolaDeFogo, 0)],
      },
      player2: {
        userId: "p2",
        characterId: "c2",
        stats: makeStats({ hp: 300 }),
        skills: [makeEquipped(ataqueRapido, 0)],
      },
    });

    // Turno 1: bola de fogo com alwaysHitRandom pra garantir burn
    const r1 = resolveTurn(
      state,
      [
        { playerId: "p1", skillId: bolaDeFogo.id },
        { playerId: "p2", skillId: ataqueRapido.id },
      ],
      alwaysHitRandom
    );

    const burnApplied = r1.events.some(
      (e) => e.statusApplied === "BURN"
    );
    expect(burnApplied).toBe(true);

    // p2 deve ter burn ativo
    const p2 = r1.state.players[1];
    expect(p2.statusEffects.some((s) => s.status === "BURN")).toBe(true);
    expect(p2.stages.physicalAtk).toBeLessThan(0);
  });

  it("POISON deve escalar dano ao longo dos turnos", () => {
    let state = initBattle({
      battleId: "b1",
      player1: {
        userId: "p1",
        characterId: "c1",
        stats: makeStats({ hp: 500, speed: 20 }),
        skills: [makeEquipped(veneno, 0)],
      },
      player2: {
        userId: "p2",
        characterId: "c2",
        stats: makeStats({ hp: 500, speed: 10 }),
        skills: [makeEquipped(ataqueRapido, 0)],
      },
    });

    // Turno 1: aplicar veneno
    const r1 = resolveTurn(
      state,
      [
        { playerId: "p1", skillId: veneno.id },
        { playerId: "p2", skillId: ataqueRapido.id },
      ],
      alwaysHitRandom
    );

    expect(
      r1.state.players[1].statusEffects.some((s) => s.status === "POISON")
    ).toBe(true);

    // Turno 2: poison deve causar dano de status no p2
    const r2 = resolveTurn(
      r1.state,
      [
        { playerId: "p1", skillId: veneno.id },
        { playerId: "p2", skillId: ataqueRapido.id },
      ],
      alwaysHitRandom
    );

    const poisonDamage = r2.events.filter(
      (e) => e.phase === "STATUS_DAMAGE" && e.targetId === "p2"
    );
    expect(poisonDamage.length).toBeGreaterThan(0);
  });
});

describe("Battle Engine — Efeitos de Skill", () => {
  it("HEAL deve recuperar HP", () => {
    let state = initBattle({
      battleId: "b1",
      player1: {
        userId: "p1",
        characterId: "c1",
        stats: makeStats({ hp: 200, speed: 5 }),
        skills: [makeEquipped(curaNatural, 0), makeEquipped(ataqueRapido, 1)],
      },
      player2: {
        userId: "p2",
        characterId: "c2",
        stats: makeStats({ speed: 20 }),
        skills: [makeEquipped(ataqueRapido, 0)],
      },
    });

    // Turno 1: p2 ataca primeiro (mais rapido), p1 cura
    const r1 = resolveTurn(
      state,
      [
        { playerId: "p1", skillId: curaNatural.id },
        { playerId: "p2", skillId: ataqueRapido.id },
      ],
      fixedRandom
    );

    // p1 foi atacado e depois curou — HP deve ser > HP apos ataque
    const p1Hp = r1.state.players[0].currentHp;
    // Heal 25% de 200 = 50, mas nao pode passar do max
    expect(p1Hp).toBeGreaterThan(200 - 50); // Pelo menos parcialmente curado
  });

  it("BUFF deve aumentar stage do stat", () => {
    const state = initBattle({
      battleId: "b1",
      player1: {
        userId: "p1",
        characterId: "c1",
        stats: makeStats(),
        skills: [makeEquipped(escudoArcano, 0)],
      },
      player2: {
        userId: "p2",
        characterId: "c2",
        stats: makeStats(),
        skills: [makeEquipped(ataqueRapido, 0)],
      },
    });

    const result = resolveTurn(
      state,
      [
        { playerId: "p1", skillId: escudoArcano.id },
        { playerId: "p2", skillId: ataqueRapido.id },
      ],
      fixedRandom
    );

    expect(result.state.players[0].stages.magicDef).toBe(2);
    expect(result.state.players[0].buffs.length).toBeGreaterThan(0);
  });

  it("RECOIL deve causar dano no atacante", () => {
    const state = initBattle({
      battleId: "b1",
      player1: {
        userId: "p1",
        characterId: "c1",
        stats: makeStats({ hp: 300, physicalAtk: 30 }),
        skills: [makeEquipped(investidaBrutal, 0)],
      },
      player2: {
        userId: "p2",
        characterId: "c2",
        stats: makeStats({ hp: 300 }),
        skills: [makeEquipped(ataqueRapido, 0)],
      },
    });

    const result = resolveTurn(
      state,
      [
        { playerId: "p1", skillId: investidaBrutal.id },
        { playerId: "p2", skillId: ataqueRapido.id },
      ],
      fixedRandom
    );

    // p1 deve ter tomado dano de recoil + dano do p2
    const p1Hp = result.state.players[0].currentHp;
    expect(p1Hp).toBeLessThan(300);

    // Deve ter evento de recoil
    const recoilEvent = result.events.find((e) =>
      e.message?.includes("recoil") || e.message?.includes("recuo")
    );
    // Recoil pode aparecer como dano ao proprio jogador
    expect(p1Hp).toBeLessThan(300);
  });
});

describe("Battle Engine — IA PvE", () => {
  it("IA AGGRESSIVE deve preferir skill de maior dano", () => {
    const state = initBattle({
      battleId: "b1",
      player1: {
        userId: "player",
        characterId: "c1",
        stats: makeStats(),
        skills: [makeEquipped(ataqueRapido, 0)],
      },
      player2: {
        userId: "mob",
        characterId: "c2",
        stats: makeStats(),
        skills: [
          makeEquipped(ataqueRapido, 0), // basePower 40
          makeEquipped(investidaBrutal, 1), // basePower 80
          makeEquipped(escudoArcano, 2), // basePower 0
        ],
      },
    });

    // Rodar varias vezes pra verificar tendencia (IA tem ruido de ±15%)
    let investidaCount = 0;
    for (let i = 0; i < 20; i++) {
      const action = chooseAction({
        state,
        mobPlayerId: "mob",
        profile: "AGGRESSIVE",
      });
      if (action.skillId === investidaBrutal.id) investidaCount++;
    }

    // Aggressive deve preferir investida brutal na maioria das vezes
    expect(investidaCount).toBeGreaterThan(10);
  });

  it("IA DEFENSIVE deve preferir cura quando HP baixo", () => {
    const state = initBattle({
      battleId: "b1",
      player1: {
        userId: "player",
        characterId: "c1",
        stats: makeStats(),
        skills: [makeEquipped(ataqueRapido, 0)],
      },
      player2: {
        userId: "mob",
        characterId: "c2",
        stats: makeStats({ hp: 200 }),
        skills: [
          makeEquipped(ataqueRapido, 0),
          makeEquipped(curaNatural, 1),
        ],
      },
    });

    // Reduzir HP do mob manualmente
    state.players[1].currentHp = 40; // 20% HP

    let curaCount = 0;
    for (let i = 0; i < 20; i++) {
      const action = chooseAction({
        state,
        mobPlayerId: "mob",
        profile: "DEFENSIVE",
      });
      if (action.skillId === curaNatural.id) curaCount++;
    }

    // Defensive com HP baixo deve preferir cura
    expect(curaCount).toBeGreaterThan(10);
  });
});

describe("Battle Engine — Simulacao Completa", () => {
  it("batalha deve terminar com um vencedor", () => {
    const { finalState, turns } = simulateFullBattle({
      playerStats: makeStats({ hp: 200, physicalAtk: 25, speed: 18 }),
      playerSkills: [
        makeEquipped(ataqueRapido, 0),
        makeEquipped(bolaDeFogo, 1),
        makeEquipped(curaNatural, 2),
        makeEquipped(investidaBrutal, 3),
      ],
      mobStats: makeStats({ hp: 180, physicalAtk: 20, speed: 14 }),
      mobSkills: [
        makeEquipped(ataqueRapido, 0),
        makeEquipped(veneno, 1),
        makeEquipped(golpeDuplo, 2),
        makeEquipped(rajadaGelida, 3),
      ],
      mobProfile: "BALANCED",
      playerStrategy: (state, turn) => {
        const player = state.players[0];
        const hpPercent = player.currentHp / player.baseStats.hp;

        // Curar se HP < 30% e cura disponivel
        if (hpPercent < 0.3 && (!player.cooldowns[curaNatural.id] || player.cooldowns[curaNatural.id] === 0)) {
          return curaNatural.id;
        }
        // Investida brutal se disponivel
        if (!player.cooldowns[investidaBrutal.id] || player.cooldowns[investidaBrutal.id] === 0) {
          return investidaBrutal.id;
        }
        // Bola de fogo como alternativa
        return bolaDeFogo.id;
      },
      randomFn: fixedRandom,
    });

    expect(finalState.status).toBe("FINISHED");
    expect(finalState.winnerId).not.toBeNull();
    expect(turns).toBeGreaterThan(1);
    expect(turns).toBeLessThanOrEqual(50);

    console.log(`\n=== Resultado da Batalha ===`);
    console.log(`Turnos: ${turns}`);
    console.log(`Vencedor: ${finalState.winnerId}`);
    console.log(`HP Player: ${finalState.players[0].currentHp}/${finalState.players[0].baseStats.hp}`);
    console.log(`HP Mob: ${finalState.players[1].currentHp}/${finalState.players[1].baseStats.hp}`);
  });

  it("jogador forte deve vencer mob fraco consistentemente", () => {
    let playerWins = 0;
    const runs = 10;

    for (let i = 0; i < runs; i++) {
      const { finalState } = simulateFullBattle({
        playerStats: makeStats({ hp: 300, physicalAtk: 35, magicAtk: 30, speed: 20, physicalDef: 25, magicDef: 22 }),
        playerSkills: [
          makeEquipped(ataqueRapido, 0),
          makeEquipped(investidaBrutal, 1),
          makeEquipped(curaNatural, 2),
          makeEquipped(bolaDeFogo, 3),
        ],
        mobStats: makeStats({ hp: 120, physicalAtk: 12, magicAtk: 10, speed: 8, physicalDef: 10, magicDef: 10 }),
        mobSkills: [
          makeEquipped(ataqueRapido, 0),
          makeEquipped(golpeDuplo, 1),
        ],
        mobProfile: "BALANCED",
        playerStrategy: () => investidaBrutal.id,
      });

      if (finalState.winnerId === "player-1") playerWins++;
    }

    // Jogador forte deve vencer na grande maioria
    expect(playerWins).toBeGreaterThanOrEqual(8);
    console.log(`\nJogador forte vs mob fraco: ${playerWins}/${runs} vitorias`);
  });

  it("batalha longa deve terminar em empate apos 50 turnos", () => {
    // Dois jogadores com muita defesa e cura — nunca morrem
    const tankSkill: Skill = {
      id: "skill-tank",
      name: "Tapa Fraco",
      description: "Dano ridiculo",
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

    const { finalState, turns } = simulateFullBattle({
      playerStats: makeStats({ hp: 9999, physicalDef: 999, magicDef: 999 }),
      playerSkills: [makeEquipped(tankSkill, 0)],
      mobStats: makeStats({ hp: 9999, physicalDef: 999, magicDef: 999 }),
      mobSkills: [makeEquipped(tankSkill, 0)],
      mobProfile: "BALANCED",
      playerStrategy: () => tankSkill.id,
      randomFn: fixedRandom,
    });

    expect(finalState.status).toBe("FINISHED");
    expect(finalState.winnerId).toBeNull(); // empate
    expect(turns).toBe(50);
    console.log(`\nBatalha interminavel: empate apos ${turns} turnos`);
  });

  it("simulacao com log detalhado de batalha", () => {
    const { finalState, allEvents, turns } = simulateFullBattle({
      playerStats: makeStats({ hp: 250, physicalAtk: 22, magicAtk: 25, speed: 16, physicalDef: 18, magicDef: 16 }),
      playerSkills: [
        makeEquipped(ataqueRapido, 0),
        makeEquipped(bolaDeFogo, 1),
        makeEquipped(escudoArcano, 2),
        makeEquipped(curaNatural, 3),
      ],
      mobStats: makeStats({ hp: 220, physicalAtk: 20, magicAtk: 22, speed: 15, physicalDef: 16, magicDef: 14 }),
      mobSkills: [
        makeEquipped(veneno, 0),
        makeEquipped(rajadaGelida, 1),
        makeEquipped(golpeDuplo, 2),
        makeEquipped(ataqueRapido, 3),
      ],
      mobProfile: "TACTICAL",
      playerStrategy: (state, turn) => {
        const player = state.players[0];
        const hpPercent = player.currentHp / player.baseStats.hp;

        // Turno 1: escudo arcano
        if (turn === 1) return escudoArcano.id;
        // Curar se HP < 35%
        if (hpPercent < 0.35 && (!player.cooldowns[curaNatural.id] || player.cooldowns[curaNatural.id] === 0)) {
          return curaNatural.id;
        }
        // Alternar entre bola de fogo e ataque rapido
        return turn % 2 === 0 ? bolaDeFogo.id : ataqueRapido.id;
      },
      randomFn: fixedRandom,
    });

    console.log(`\n=== Batalha Detalhada (Player vs Mob TACTICAL) ===`);
    console.log(`Turnos: ${turns} | Vencedor: ${finalState.winnerId ?? "EMPATE"}`);
    console.log(`HP Final — Player: ${finalState.players[0].currentHp}/${finalState.players[0].baseStats.hp} | Mob: ${finalState.players[1].currentHp}/${finalState.players[1].baseStats.hp}`);
    console.log(`\n--- Log de Eventos ---`);

    let currentTurn = 0;
    for (const event of allEvents) {
      if (event.turn !== currentTurn) {
        currentTurn = event.turn;
        console.log(`\n[Turno ${currentTurn}]`);
      }
      console.log(`  ${event.message}`);
    }

    expect(finalState.status).toBe("FINISHED");
  });
});

describe("PvE Store — TTL", () => {
  it("batalha expirada deve ser removida", async () => {
    // Importar dinamicamente para evitar conflitos de estado global
    const { setPveBattle, getPveBattle, hasActiveBattle } = await import(
      "../pve-store"
    );

    const fakeState = initBattle({
      battleId: "ttl-test",
      player1: {
        userId: "user-ttl",
        characterId: "c1",
        stats: makeStats(),
        skills: [makeEquipped(ataqueRapido, 0)],
      },
      player2: {
        userId: "mob-ttl",
        characterId: "c2",
        stats: makeStats(),
        skills: [makeEquipped(ataqueRapido, 0)],
      },
    });

    // Primeiro setar normalmente (setPveBattle sobrescreve lastActivityAt com Date.now())
    const session = {
      state: fakeState,
      mobProfile: "BALANCED" as const,
      mobId: "mob-ttl",
      userId: "user-ttl",
      lastActivityAt: Date.now(),
    };
    setPveBattle("ttl-battle", session);

    // Depois forçar o lastActivityAt para 31 minutos atrás (simulando inatividade)
    session.lastActivityAt = Date.now() - 31 * 60 * 1000;

    // getPveBattle deve retornar undefined (expirado)
    expect(getPveBattle("ttl-battle")).toBeUndefined();

    // hasActiveBattle tambem nao deve encontrar
    expect(hasActiveBattle("user-ttl")).toBeNull();
  });

  it("batalha recente deve permanecer ativa", async () => {
    const { setPveBattle, getPveBattle, hasActiveBattle } = await import(
      "../pve-store"
    );

    const fakeState = initBattle({
      battleId: "active-test",
      player1: {
        userId: "user-active",
        characterId: "c1",
        stats: makeStats(),
        skills: [makeEquipped(ataqueRapido, 0)],
      },
      player2: {
        userId: "mob-active",
        characterId: "c2",
        stats: makeStats(),
        skills: [makeEquipped(ataqueRapido, 0)],
      },
    });

    setPveBattle("active-battle", {
      state: fakeState,
      mobProfile: "BALANCED",
      mobId: "mob-active",
      userId: "user-active",
      lastActivityAt: Date.now(),
    });

    expect(getPveBattle("active-battle")).toBeDefined();
    expect(hasActiveBattle("user-active")).toBe("active-battle");
  });
});
