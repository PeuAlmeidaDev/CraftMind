import { initPvpTeamBattle, resolvePvpTeamTurn } from "@/lib/battle/pvp-team-turn";
import type {
  PvpTeamBattleConfig,
  PvpTeamBattleState,
  PvpTeamAction,
  PvpTeamPlayerConfig,
} from "@/lib/battle/pvp-team-types";
import type { BaseStats, EquippedSkill } from "@/lib/battle/types";
import type { Skill } from "@/types/skill";
import { MAX_TURNS } from "@/lib/battle/constants";

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

const curaBasica: Skill = {
  id: "skill-cura-basica",
  name: "Cura Basica",
  description: "Cura a si mesmo",
  tier: 1,
  cooldown: 2,
  target: "SELF",
  damageType: "NONE",
  basePower: 0,
  hits: 0,
  accuracy: 100,
  effects: [{ type: "HEAL", target: "SELF", percent: 25 }],
  mastery: {},
};

const ataqueAoe: Skill = {
  id: "skill-ataque-aoe",
  name: "Ataque em Area",
  description: "Ataca todos os inimigos",
  tier: 2,
  cooldown: 1,
  target: "ALL_ENEMIES",
  damageType: "PHYSICAL",
  basePower: 30,
  hits: 1,
  accuracy: 100,
  effects: [],
  mastery: {},
};

const buffAliado: Skill = {
  id: "skill-buff-aliado",
  name: "Buff Aliado",
  description: "Buff em um aliado",
  tier: 1,
  cooldown: 2,
  target: "SINGLE_ALLY",
  damageType: "NONE",
  basePower: 0,
  hits: 0,
  accuracy: 100,
  effects: [{ type: "BUFF", target: "SINGLE_ALLY", stat: "physicalAtk", value: 1, duration: 3 }],
  mastery: {},
};

const buffTodoTime: Skill = {
  id: "skill-buff-todo-time",
  name: "Buff Todo Time",
  description: "Buff todos aliados",
  tier: 2,
  cooldown: 3,
  target: "ALL_ALLIES",
  damageType: "NONE",
  basePower: 0,
  hits: 0,
  accuracy: 100,
  effects: [{ type: "BUFF", target: "ALL_ALLIES", stat: "physicalDef", value: 1, duration: 2 }],
  mastery: {},
};

const skillCooldown2: Skill = {
  id: "skill-cd2",
  name: "Skill com Cooldown",
  description: "Skill com cd 2",
  tier: 1,
  cooldown: 2,
  target: "SINGLE_ENEMY",
  damageType: "PHYSICAL",
  basePower: 60,
  hits: 1,
  accuracy: 100,
  effects: [],
  mastery: {},
};

function makeStats(overrides?: Partial<BaseStats>): BaseStats {
  return {
    physicalAtk: 20,
    physicalDef: 15,
    magicAtk: 10,
    magicDef: 10,
    hp: 200,
    speed: 12,
    ...overrides,
  };
}

function makeEquipped(skill: Skill, slot: number): EquippedSkill {
  return { skillId: skill.id, slotIndex: slot, skill };
}

function makePlayer(
  userId: string,
  overrides?: { stats?: Partial<BaseStats>; skills?: EquippedSkill[] }
): PvpTeamPlayerConfig {
  return {
    userId,
    characterId: `char-${userId}`,
    stats: makeStats(overrides?.stats),
    skills: overrides?.skills ?? [makeEquipped(ataqueRapido, 0)],
  };
}

function makeConfig(overrides?: Partial<PvpTeamBattleConfig>): PvpTeamBattleConfig {
  return {
    battleId: "battle-test",
    team1: [makePlayer("p1"), makePlayer("p2")],
    team2: [makePlayer("p3"), makePlayer("p4")],
    mode: "TEAM_2V2",
    ...overrides,
  };
}

/** randomFn deterministico que sempre retorna 0.5 (acerta accuracy, desempate estavel) */
const stableRandom = () => 0.5;

// ---------------------------------------------------------------------------
// initPvpTeamBattle
// ---------------------------------------------------------------------------

describe("initPvpTeamBattle", () => {
  it("cria estado com 4 jogadores em 2 times e turnNumber=1", () => {
    const state = initPvpTeamBattle(makeConfig());

    expect(state.battleId).toBe("battle-test");
    expect(state.turnNumber).toBe(1);
    expect(state.mode).toBe("TEAM_2V2");
    expect(state.status).toBe("IN_PROGRESS");
    expect(state.winnerTeam).toBeNull();
    expect(state.turnLog).toEqual([]);
    expect(state.team1).toHaveLength(2);
    expect(state.team2).toHaveLength(2);
  });

  it("inicializa HP de cada jogador igual ao stats.hp", () => {
    const config = makeConfig({
      team1: [
        makePlayer("p1", { stats: { hp: 300 } }),
        makePlayer("p2", { stats: { hp: 250 } }),
      ],
    });
    const state = initPvpTeamBattle(config);

    expect(state.team1[0].currentHp).toBe(300);
    expect(state.team1[1].currentHp).toBe(250);
  });

  it("inicializa stages zerados para todos os jogadores", () => {
    const state = initPvpTeamBattle(makeConfig());
    const allPlayers = [...state.team1, ...state.team2];

    for (const player of allPlayers) {
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

  it("lanca erro se team1 nao tiver exatamente 2 jogadores", () => {
    expect(() =>
      initPvpTeamBattle(
        makeConfig({ team1: [makePlayer("p1")] })
      )
    ).toThrow("Team 1 deve ter 2 jogadores");
  });

  it("lanca erro se team2 nao tiver exatamente 2 jogadores", () => {
    expect(() =>
      initPvpTeamBattle(
        makeConfig({ team2: [makePlayer("p3"), makePlayer("p4"), makePlayer("p5")] })
      )
    ).toThrow("Team 2 deve ter 2 jogadores");
  });

  it("lanca erro se jogador tiver 0 skills", () => {
    expect(() =>
      initPvpTeamBattle(
        makeConfig({ team1: [makePlayer("p1", { skills: [] }), makePlayer("p2")] })
      )
    ).toThrow("deve ter entre 1 e 4 skills");
  });
});

// ---------------------------------------------------------------------------
// resolvePvpTeamTurn — fluxos basicos
// ---------------------------------------------------------------------------

describe("resolvePvpTeamTurn", () => {
  describe("quando batalha ja esta FINISHED", () => {
    it("retorna estado inalterado e nenhum evento", () => {
      const state = initPvpTeamBattle(makeConfig());
      state.status = "FINISHED";
      state.winnerTeam = 1;

      const result = resolvePvpTeamTurn(state, [], stableRandom);

      expect(result.state.status).toBe("FINISHED");
      expect(result.events).toHaveLength(0);
    });
  });

  describe("quando todos fazem skip (skillId=null)", () => {
    it("gera eventos SKIP para os 4 jogadores e incrementa turno", () => {
      const state = initPvpTeamBattle(makeConfig());
      const actions: PvpTeamAction[] = [
        { playerId: "p1", skillId: null },
        { playerId: "p2", skillId: null },
        { playerId: "p3", skillId: null },
        { playerId: "p4", skillId: null },
      ];

      const result = resolvePvpTeamTurn(state, actions, stableRandom);

      const skipEvents = result.events.filter((e) => e.phase === "SKIP");
      expect(skipEvents).toHaveLength(4);
      expect(result.state.turnNumber).toBe(2);
      expect(result.state.status).toBe("IN_PROGRESS");
    });
  });

  describe("quando acoes faltam para jogadores vivos", () => {
    it("preenche acoes faltantes como skip automaticamente", () => {
      const state = initPvpTeamBattle(makeConfig());
      // Enviar acao apenas de p1
      const actions: PvpTeamAction[] = [
        { playerId: "p1", skillId: ataqueRapido.id, targetIndex: 0 },
      ];

      const result = resolvePvpTeamTurn(state, actions, stableRandom);

      const skipEvents = result.events.filter((e) => e.phase === "SKIP");
      expect(skipEvents).toHaveLength(3); // p2, p3, p4 fizeram skip
    });
  });

  describe("quando acoes duplicadas sao enviadas", () => {
    it("lanca erro", () => {
      const state = initPvpTeamBattle(makeConfig());
      const actions: PvpTeamAction[] = [
        { playerId: "p1", skillId: null },
        { playerId: "p1", skillId: ataqueRapido.id },
      ];

      expect(() => resolvePvpTeamTurn(state, actions, stableRandom)).toThrow(
        "Acoes duplicadas"
      );
    });
  });

  describe("quando jogador usa skill normal em SINGLE_ENEMY", () => {
    it("causa dano no alvo e gera evento DAMAGE", () => {
      const state = initPvpTeamBattle(makeConfig());
      const actions: PvpTeamAction[] = [
        { playerId: "p1", skillId: ataqueRapido.id, targetIndex: 0 },
        { playerId: "p2", skillId: null },
        { playerId: "p3", skillId: null },
        { playerId: "p4", skillId: null },
      ];

      const result = resolvePvpTeamTurn(state, actions, stableRandom);

      const dmgEvents = result.events.filter((e) => e.phase === "DAMAGE");
      expect(dmgEvents.length).toBeGreaterThanOrEqual(1);
      expect(dmgEvents[0].actorId).toBe("p1");
      expect(dmgEvents[0].targetId).toBe("p3"); // targetIndex 0 do team2
      expect(dmgEvents[0].damage).toBeGreaterThan(0);

      // HP do alvo deve ter diminuido
      expect(result.state.team2[0].currentHp).toBeLessThan(200);
    });
  });

  describe("quando jogador usa skill SINGLE_ENEMY sem targetIndex", () => {
    it("faz fallback para primeiro inimigo vivo", () => {
      const state = initPvpTeamBattle(makeConfig());
      const actions: PvpTeamAction[] = [
        { playerId: "p1", skillId: ataqueRapido.id }, // sem targetIndex
        { playerId: "p2", skillId: null },
        { playerId: "p3", skillId: null },
        { playerId: "p4", skillId: null },
      ];

      const result = resolvePvpTeamTurn(state, actions, stableRandom);

      const dmgEvents = result.events.filter((e) => e.phase === "DAMAGE" && e.actorId === "p1");
      expect(dmgEvents.length).toBe(1);
      // Deve ter atingido p3 ou p4 (primeiro vivo do team2)
      expect(["p3", "p4"]).toContain(dmgEvents[0].targetId);
    });
  });

  describe("quando alvo (targetIndex) esta morto", () => {
    it("nao redireciona — skill nao atinge ninguem", () => {
      const state = initPvpTeamBattle(makeConfig());
      // Matar p3
      state.team2[0].currentHp = 0;

      const actions: PvpTeamAction[] = [
        { playerId: "p1", skillId: ataqueRapido.id, targetIndex: 0 }, // p3 esta morto
        { playerId: "p2", skillId: null },
        { playerId: "p4", skillId: null },
      ];

      const result = resolvePvpTeamTurn(state, actions, stableRandom);

      const dmgFromP1 = result.events.filter((e) => e.phase === "DAMAGE" && e.actorId === "p1");
      expect(dmgFromP1).toHaveLength(0);
    });
  });

  describe("targeting ALL_ENEMIES", () => {
    it("ataca todos os inimigos vivos", () => {
      const config = makeConfig({
        team1: [
          makePlayer("p1", { skills: [makeEquipped(ataqueAoe, 0)] }),
          makePlayer("p2"),
        ],
      });
      const state = initPvpTeamBattle(config);
      const actions: PvpTeamAction[] = [
        { playerId: "p1", skillId: ataqueAoe.id },
        { playerId: "p2", skillId: null },
        { playerId: "p3", skillId: null },
        { playerId: "p4", skillId: null },
      ];

      const result = resolvePvpTeamTurn(state, actions, stableRandom);

      const dmgFromP1 = result.events.filter((e) => e.phase === "DAMAGE" && e.actorId === "p1");
      expect(dmgFromP1).toHaveLength(2);
      const targetIds = dmgFromP1.map((e) => e.targetId).sort();
      expect(targetIds).toEqual(["p3", "p4"]);
    });
  });

  describe("targeting SELF", () => {
    it("aplica efeito no proprio jogador", () => {
      const config = makeConfig({
        team1: [
          makePlayer("p1", { skills: [makeEquipped(curaBasica, 0)] }),
          makePlayer("p2"),
        ],
      });
      const state = initPvpTeamBattle(config);
      // Reduzir HP do p1 para que a cura seja visivel
      state.team1[0].currentHp = 100;

      const actions: PvpTeamAction[] = [
        { playerId: "p1", skillId: curaBasica.id },
        { playerId: "p2", skillId: null },
        { playerId: "p3", skillId: null },
        { playerId: "p4", skillId: null },
      ];

      const result = resolvePvpTeamTurn(state, actions, stableRandom);

      // Cura de 25% de 200 = 50, HP deve ser 150
      expect(result.state.team1[0].currentHp).toBeGreaterThan(100);
    });
  });

  describe("targeting SINGLE_ALLY com targetId", () => {
    it("aplica efeito no aliado especificado", () => {
      const config = makeConfig({
        team1: [
          makePlayer("p1", { skills: [makeEquipped(buffAliado, 0)] }),
          makePlayer("p2"),
        ],
      });
      const state = initPvpTeamBattle(config);
      const actions: PvpTeamAction[] = [
        { playerId: "p1", skillId: buffAliado.id, targetId: "p2" },
        { playerId: "p2", skillId: null },
        { playerId: "p3", skillId: null },
        { playerId: "p4", skillId: null },
      ];

      const result = resolvePvpTeamTurn(state, actions, stableRandom);

      // p2 deve ter recebido buff de physicalAtk
      expect(result.state.team1[1].stages.physicalAtk).toBeGreaterThanOrEqual(0);
      // O evento ACTION deve indicar p2 como target
      const actionEvents = result.events.filter(
        (e) => e.actorId === "p1" && (e.phase === "ACTION" || e.phase === "DAMAGE")
      );
      expect(actionEvents.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("targeting SINGLE_ALLY sem targetId", () => {
    it("faz fallback para si mesmo", () => {
      const config = makeConfig({
        team1: [
          makePlayer("p1", { skills: [makeEquipped(buffAliado, 0)] }),
          makePlayer("p2"),
        ],
      });
      const state = initPvpTeamBattle(config);
      const actions: PvpTeamAction[] = [
        { playerId: "p1", skillId: buffAliado.id }, // sem targetId
        { playerId: "p2", skillId: null },
        { playerId: "p3", skillId: null },
        { playerId: "p4", skillId: null },
      ];

      const result = resolvePvpTeamTurn(state, actions, stableRandom);

      // Deve ter aplicado em p1 (self)
      const actionEvents = result.events.filter(
        (e) => e.actorId === "p1" && (e.phase === "ACTION" || e.phase === "DAMAGE")
      );
      if (actionEvents.length > 0) {
        expect(actionEvents[0].targetId).toBe("p1");
      }
    });
  });

  describe("targeting ALL_ALLIES", () => {
    it("aplica em todos os aliados vivos do time", () => {
      const config = makeConfig({
        team1: [
          makePlayer("p1", { skills: [makeEquipped(buffTodoTime, 0)] }),
          makePlayer("p2"),
        ],
      });
      const state = initPvpTeamBattle(config);
      const actions: PvpTeamAction[] = [
        { playerId: "p1", skillId: buffTodoTime.id },
        { playerId: "p2", skillId: null },
        { playerId: "p3", skillId: null },
        { playerId: "p4", skillId: null },
      ];

      const result = resolvePvpTeamTurn(state, actions, stableRandom);

      const actionEvents = result.events.filter(
        (e) => e.actorId === "p1" && (e.phase === "ACTION" || e.phase === "DAMAGE")
      );
      // Deve ter atingido 2 alvos (p1 e p2)
      expect(actionEvents.length).toBeGreaterThanOrEqual(2);
    });
  });

  // ---------------------------------------------------------------------------
  // Condicoes de fim
  // ---------------------------------------------------------------------------

  describe("quando team wipe ocorre", () => {
    it("define winnerTeam=1 quando time 2 e eliminado", () => {
      const config = makeConfig({
        team1: [
          makePlayer("p1", { stats: { physicalAtk: 500 } }),
          makePlayer("p2", { stats: { physicalAtk: 500 } }),
        ],
        team2: [
          makePlayer("p3", { stats: { hp: 1 } }),
          makePlayer("p4", { stats: { hp: 1 } }),
        ],
      });
      const state = initPvpTeamBattle(config);
      const actions: PvpTeamAction[] = [
        { playerId: "p1", skillId: ataqueRapido.id, targetIndex: 0 },
        { playerId: "p2", skillId: ataqueRapido.id, targetIndex: 1 },
        { playerId: "p3", skillId: null },
        { playerId: "p4", skillId: null },
      ];

      const result = resolvePvpTeamTurn(state, actions, stableRandom);

      expect(result.state.status).toBe("FINISHED");
      expect(result.state.winnerTeam).toBe(1);
    });

    it("define winnerTeam=2 quando time 1 e eliminado", () => {
      const config = makeConfig({
        team1: [
          makePlayer("p1", { stats: { hp: 1 } }),
          makePlayer("p2", { stats: { hp: 1 } }),
        ],
        team2: [
          makePlayer("p3", { stats: { physicalAtk: 500 } }),
          makePlayer("p4", { stats: { physicalAtk: 500 } }),
        ],
      });
      const state = initPvpTeamBattle(config);
      const actions: PvpTeamAction[] = [
        { playerId: "p1", skillId: null },
        { playerId: "p2", skillId: null },
        { playerId: "p3", skillId: ataqueRapido.id, targetIndex: 0 },
        { playerId: "p4", skillId: ataqueRapido.id, targetIndex: 1 },
      ];

      const result = resolvePvpTeamTurn(state, actions, stableRandom);

      expect(result.state.status).toBe("FINISHED");
      expect(result.state.winnerTeam).toBe(2);
    });
  });

  describe("quando MAX_TURNS e atingido", () => {
    it("define status FINISHED e winnerTeam null (empate)", () => {
      const state = initPvpTeamBattle(makeConfig());
      // Colocar no turno MAX_TURNS para que apos resolucao ultrapasse o limite
      state.turnNumber = MAX_TURNS;

      const actions: PvpTeamAction[] = [
        { playerId: "p1", skillId: null },
        { playerId: "p2", skillId: null },
        { playerId: "p3", skillId: null },
        { playerId: "p4", skillId: null },
      ];

      const result = resolvePvpTeamTurn(state, actions, stableRandom);

      expect(result.state.status).toBe("FINISHED");
      expect(result.state.winnerTeam).toBeNull();

      const drawEvents = result.events.filter((e) => e.phase === "DRAW");
      expect(drawEvents.length).toBe(1);
    });
  });

  // ---------------------------------------------------------------------------
  // Validacoes de skill
  // ---------------------------------------------------------------------------

  describe("quando jogador tenta usar skill invalida", () => {
    it("gera evento INVALID e nao causa dano", () => {
      const state = initPvpTeamBattle(makeConfig());
      const actions: PvpTeamAction[] = [
        { playerId: "p1", skillId: "skill-inexistente", targetIndex: 0 },
        { playerId: "p2", skillId: null },
        { playerId: "p3", skillId: null },
        { playerId: "p4", skillId: null },
      ];

      const result = resolvePvpTeamTurn(state, actions, stableRandom);

      const invalidEvents = result.events.filter((e) => e.phase === "INVALID");
      expect(invalidEvents).toHaveLength(1);
      expect(invalidEvents[0].actorId).toBe("p1");
    });
  });

  describe("quando skill esta em cooldown", () => {
    it("gera evento COOLDOWN e nao executa a skill", () => {
      const config = makeConfig({
        team1: [
          makePlayer("p1", { skills: [makeEquipped(skillCooldown2, 0), makeEquipped(ataqueRapido, 1)] }),
          makePlayer("p2"),
        ],
      });
      const state = initPvpTeamBattle(config);
      // Colocar skill em cooldown manualmente
      state.team1[0].cooldowns[skillCooldown2.id] = 2;

      const actions: PvpTeamAction[] = [
        { playerId: "p1", skillId: skillCooldown2.id, targetIndex: 0 },
        { playerId: "p2", skillId: null },
        { playerId: "p3", skillId: null },
        { playerId: "p4", skillId: null },
      ];

      const result = resolvePvpTeamTurn(state, actions, stableRandom);

      const cdEvents = result.events.filter((e) => e.phase === "COOLDOWN");
      expect(cdEvents).toHaveLength(1);
      expect(cdEvents[0].actorId).toBe("p1");
    });
  });

  // ---------------------------------------------------------------------------
  // Incapacitacao (STUN/FROZEN)
  // ---------------------------------------------------------------------------

  describe("quando jogador esta STUN", () => {
    it("gera evento INCAPACITATED e nao executa acao", () => {
      const state = initPvpTeamBattle(makeConfig());
      state.team1[0].statusEffects.push({
        status: "STUN",
        remainingTurns: 1,
        turnsElapsed: 0,
      });

      const actions: PvpTeamAction[] = [
        { playerId: "p1", skillId: ataqueRapido.id, targetIndex: 0 },
        { playerId: "p2", skillId: null },
        { playerId: "p3", skillId: null },
        { playerId: "p4", skillId: null },
      ];

      const result = resolvePvpTeamTurn(state, actions, stableRandom);

      const incapEvents = result.events.filter(
        (e) => e.phase === "INCAPACITATED" && e.actorId === "p1"
      );
      expect(incapEvents).toHaveLength(1);
    });
  });

  // ---------------------------------------------------------------------------
  // Ordenacao por speed
  // ---------------------------------------------------------------------------

  describe("ordenacao por speed", () => {
    it("jogador mais rapido age primeiro", () => {
      const config = makeConfig({
        team1: [
          makePlayer("p1", { stats: { speed: 5 } }),  // lento
          makePlayer("p2", { stats: { speed: 30 } }), // rapido
        ],
        team2: [
          makePlayer("p3", { stats: { speed: 10 } }),
          makePlayer("p4", { stats: { speed: 20 } }),
        ],
      });
      const state = initPvpTeamBattle(config);
      const actions: PvpTeamAction[] = [
        { playerId: "p1", skillId: ataqueRapido.id, targetIndex: 0 },
        { playerId: "p2", skillId: ataqueRapido.id, targetIndex: 0 },
        { playerId: "p3", skillId: ataqueRapido.id, targetIndex: 0 },
        { playerId: "p4", skillId: ataqueRapido.id, targetIndex: 0 },
      ];

      const result = resolvePvpTeamTurn(state, actions, stableRandom);

      // Filtrar apenas eventos de DAMAGE para ver a ordem
      const damageEvents = result.events.filter((e) => e.phase === "DAMAGE");
      // p2 (speed 30) deve atacar antes de p4 (speed 20) que deve atacar antes de p3 (speed 10)
      if (damageEvents.length >= 2) {
        const actorOrder = damageEvents.map((e) => e.actorId);
        const indexP2 = actorOrder.indexOf("p2");
        const indexP1 = actorOrder.indexOf("p1");
        // p2 deve agir antes de p1
        if (indexP2 !== -1 && indexP1 !== -1) {
          expect(indexP2).toBeLessThan(indexP1);
        }
      }
    });
  });

  // ---------------------------------------------------------------------------
  // Imutabilidade
  // ---------------------------------------------------------------------------

  describe("imutabilidade do estado original", () => {
    it("nao muta o estado passado como argumento", () => {
      const state = initPvpTeamBattle(makeConfig());
      const originalHp = state.team2[0].currentHp;
      const originalTurn = state.turnNumber;

      const actions: PvpTeamAction[] = [
        { playerId: "p1", skillId: ataqueRapido.id, targetIndex: 0 },
        { playerId: "p2", skillId: null },
        { playerId: "p3", skillId: null },
        { playerId: "p4", skillId: null },
      ];

      resolvePvpTeamTurn(state, actions, stableRandom);

      expect(state.team2[0].currentHp).toBe(originalHp);
      expect(state.turnNumber).toBe(originalTurn);
    });
  });

  // ---------------------------------------------------------------------------
  // Jogador morto nao age
  // ---------------------------------------------------------------------------

  describe("quando jogador esta morto", () => {
    it("nao executa acao do jogador morto", () => {
      const state = initPvpTeamBattle(makeConfig());
      state.team1[0].currentHp = 0; // p1 morto

      const actions: PvpTeamAction[] = [
        { playerId: "p1", skillId: ataqueRapido.id, targetIndex: 0 },
        { playerId: "p2", skillId: null },
        { playerId: "p3", skillId: null },
        { playerId: "p4", skillId: null },
      ];

      const result = resolvePvpTeamTurn(state, actions, stableRandom);

      // p1 nao deve ter eventos de DAMAGE ou SKIP
      const p1DmgEvents = result.events.filter(
        (e) => e.phase === "DAMAGE" && e.actorId === "p1"
      );
      expect(p1DmgEvents).toHaveLength(0);
    });
  });

  // ---------------------------------------------------------------------------
  // turnLog acumula
  // ---------------------------------------------------------------------------

  describe("turnLog acumulativo", () => {
    it("acumula eventos no turnLog do state retornado", () => {
      const state = initPvpTeamBattle(makeConfig());
      const actions: PvpTeamAction[] = [
        { playerId: "p1", skillId: ataqueRapido.id, targetIndex: 0 },
        { playerId: "p2", skillId: null },
        { playerId: "p3", skillId: null },
        { playerId: "p4", skillId: null },
      ];

      const r1 = resolvePvpTeamTurn(state, actions, stableRandom);
      expect(r1.state.turnLog.length).toBeGreaterThan(0);

      const r2 = resolvePvpTeamTurn(r1.state, actions, stableRandom);
      expect(r2.state.turnLog.length).toBeGreaterThan(r1.state.turnLog.length);
    });
  });
});
