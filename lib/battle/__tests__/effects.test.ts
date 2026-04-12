import { initBattle } from "../init";
import { resolveTurn } from "../turn";
import type { BattleState, EquippedSkill, BaseStats, TurnLogEntry } from "../types";
import type { Skill } from "@/types/skill";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeEquipped(skill: Skill, slot: number): EquippedSkill {
  return { skillId: skill.id, slotIndex: slot, skill };
}

function makeStats(overrides?: Partial<BaseStats>): BaseStats {
  return { physicalAtk: 20, physicalDef: 15, magicAtk: 18, magicDef: 14, hp: 200, speed: 15, ...overrides };
}

function makeSkill(overrides: Partial<Skill> & Pick<Skill, "id" | "name" | "effects">): Skill {
  return { description: "Skill de teste", tier: 1, cooldown: 0, target: "SINGLE_ENEMY", damageType: "PHYSICAL", basePower: 40, hits: 1, accuracy: 100, mastery: {}, ...overrides };
}

const fixedRandom = () => 0.5;
const alwaysHitRandom = () => 0.01;

// ---------------------------------------------------------------------------
// Skills de teste
// ---------------------------------------------------------------------------

const basicAttack: Skill = makeSkill({
  id: "basic-attack",
  name: "Ataque Basico",
  effects: [],
});

const debuffSkill: Skill = makeSkill({
  id: "debuff-skill",
  name: "Debuff Defesa",
  damageType: "NONE",
  basePower: 0,
  target: "SELF",
  effects: [
    { type: "DEBUFF", target: "SINGLE_ENEMY", stat: "physicalDef", value: 2, duration: 2 },
  ],
});

const vulnSkill: Skill = makeSkill({
  id: "vuln-skill",
  name: "Vulnerabilidade Magica",
  damageType: "NONE",
  basePower: 0,
  target: "SELF",
  effects: [
    { type: "VULNERABILITY", target: "SINGLE_ENEMY", damageType: "MAGICAL", percent: 50, duration: 3 },
  ],
});

const prioritySkill: Skill = makeSkill({
  id: "priority-skill",
  name: "Prioridade",
  damageType: "NONE",
  basePower: 0,
  target: "SELF",
  effects: [
    { type: "PRIORITY_SHIFT", target: "SELF", stages: 2, duration: 2 },
  ],
});

const counterSkill: Skill = makeSkill({
  id: "counter-skill",
  name: "Contra-Ataque",
  damageType: "NONE",
  basePower: 0,
  target: "SELF",
  effects: [
    { type: "COUNTER", target: "SELF", powerMultiplier: 0.5, duration: 2 },
  ],
});

const counterWithTrigger: Skill = makeSkill({
  id: "counter-trigger-skill",
  name: "Contra-Ataque com Debuff",
  damageType: "NONE",
  basePower: 0,
  target: "SELF",
  effects: [
    {
      type: "COUNTER",
      target: "SELF",
      powerMultiplier: 0.5,
      duration: 2,
      onTrigger: [
        { type: "DEBUFF", target: "SINGLE_ENEMY", stat: "speed", value: 1, duration: 2 },
      ],
    },
  ],
});

const cleanseSkill: Skill = makeSkill({
  id: "cleanse-skill",
  name: "Purificacao",
  damageType: "NONE",
  basePower: 0,
  target: "SELF",
  effects: [
    { type: "CLEANSE", target: "SELF", targets: "ALL" },
  ],
});

const selfDebuffSkill: Skill = makeSkill({
  id: "self-debuff-skill",
  name: "Golpe com Custo",
  damageType: "PHYSICAL",
  basePower: 40,
  effects: [
    { type: "SELF_DEBUFF", target: "SELF", stat: "speed", value: 1, duration: 2 },
  ],
});

const comboSkill: Skill = makeSkill({
  id: "combo-skill",
  name: "Combo",
  damageType: "PHYSICAL",
  basePower: 40,
  effects: [
    { type: "COMBO", maxStacks: 3, escalation: [{ basePower: 40, hits: 1 }, { basePower: 60, hits: 1 }, { basePower: 80, hits: 2 }] },
  ],
});

const onExpireSkill: Skill = makeSkill({
  id: "on-expire-skill",
  name: "Buff Explosivo",
  damageType: "NONE",
  basePower: 0,
  target: "SELF",
  effects: [
    {
      type: "ON_EXPIRE",
      trigger: { type: "BUFF", target: "SELF", stat: "physicalAtk", value: 2, duration: 1 },
      effect: { type: "DEBUFF", target: "SELF", stat: "physicalAtk", value: 1, duration: 2 },
    },
  ],
});

const stunSkill: Skill = makeSkill({
  id: "stun-skill",
  name: "Atordoamento",
  damageType: "NONE",
  basePower: 0,
  target: "SELF",
  effects: [
    { type: "STATUS", target: "SINGLE_ENEMY", status: "STUN", chance: 100, duration: 1 },
  ],
});

const frozenSkill: Skill = makeSkill({
  id: "frozen-skill",
  name: "Congelamento",
  damageType: "NONE",
  basePower: 0,
  target: "SELF",
  effects: [
    { type: "STATUS", target: "SINGLE_ENEMY", status: "FROZEN", chance: 100, duration: 1 },
  ],
});

// ---------------------------------------------------------------------------
// Helpers de batalha
// ---------------------------------------------------------------------------

function createBattle(p1Skills: Skill[], p2Skills: Skill[], p1Stats?: Partial<BaseStats>, p2Stats?: Partial<BaseStats>): BattleState {
  return initBattle({
    battleId: "test-battle",
    player1: {
      userId: "p1",
      characterId: "char-p1",
      stats: makeStats(p1Stats),
      skills: p1Skills.map((s, i) => makeEquipped(s, i)),
    },
    player2: {
      userId: "p2",
      characterId: "char-p2",
      stats: makeStats(p2Stats),
      skills: p2Skills.map((s, i) => makeEquipped(s, i)),
    },
  });
}

function findEvents(events: TurnLogEntry[], phase: string): TurnLogEntry[] {
  return events.filter((e) => e.phase === phase);
}

// ---------------------------------------------------------------------------
// Testes
// ---------------------------------------------------------------------------

describe("Effects — skill effects integration", () => {
  // 1. DEBUFF: aplica, stage diminui; apos expirar, stage reverte
  it("DEBUFF: reduz physicalDef stage e reverte ao expirar", () => {
    const state = createBattle([debuffSkill, basicAttack], [basicAttack]);

    // Turno 1: p1 usa debuff, p2 usa basicAttack
    const t1 = resolveTurn(
      state,
      [
        { playerId: "p1", skillId: debuffSkill.id },
        { playerId: "p2", skillId: basicAttack.id },
      ],
      alwaysHitRandom
    );

    const p2AfterT1 = t1.state.players.find((p) => p.playerId === "p2")!;
    expect(p2AfterT1.stages.physicalDef).toBe(-2);

    // Turno 2: skip ambos (tick 2)
    const t2 = resolveTurn(
      t1.state,
      [
        { playerId: "p1", skillId: null },
        { playerId: "p2", skillId: null },
      ],
      fixedRandom
    );

    const p2AfterT2 = t2.state.players.find((p) => p.playerId === "p2")!;
    expect(p2AfterT2.stages.physicalDef).toBe(-2);

    // Turno 3: skip ambos (tick 3 — debuff expira, duration 2 + 1 interno = 3 ticks)
    const t3 = resolveTurn(
      t2.state,
      [
        { playerId: "p1", skillId: null },
        { playerId: "p2", skillId: null },
      ],
      fixedRandom
    );

    const p2AfterT3 = t3.state.players.find((p) => p.playerId === "p2")!;
    expect(p2AfterT3.stages.physicalDef).toBe(0);

    const expireEvents = findEvents(t3.events, "BUFF_EXPIRE");
    expect(expireEvents.length).toBeGreaterThanOrEqual(1);
  });

  // 2. VULNERABILITY: dano magico maior com vuln ativa
  it("VULNERABILITY: dano magico aumenta com vulnerabilidade ativa", () => {
    const magicAttack: Skill = makeSkill({
      id: "magic-attack",
      name: "Ataque Magico",
      damageType: "MAGICAL",
      basePower: 40,
      effects: [],
    });

    // Simulacao SEM vulnerabilidade
    const stateNoVuln = createBattle([magicAttack], [magicAttack]);
    const t1NoVuln = resolveTurn(
      stateNoVuln,
      [
        { playerId: "p1", skillId: magicAttack.id },
        { playerId: "p2", skillId: magicAttack.id },
      ],
      fixedRandom
    );
    const damageNoVuln = findEvents(t1NoVuln.events, "DAMAGE").find((e) => e.actorId === "p1")!;

    // Simulacao COM vulnerabilidade
    const stateVuln = createBattle([vulnSkill, magicAttack], [magicAttack]);
    // Turno 1: p1 aplica vuln em p2
    const t1Vuln = resolveTurn(
      stateVuln,
      [
        { playerId: "p1", skillId: vulnSkill.id },
        { playerId: "p2", skillId: magicAttack.id },
      ],
      alwaysHitRandom
    );
    // Turno 2: p1 ataca com magia (p2 tem vuln magica +50%)
    const t2Vuln = resolveTurn(
      t1Vuln.state,
      [
        { playerId: "p1", skillId: magicAttack.id },
        { playerId: "p2", skillId: magicAttack.id },
      ],
      fixedRandom
    );
    const damageWithVuln = findEvents(t2Vuln.events, "DAMAGE").find((e) => e.actorId === "p1")!;

    expect(damageWithVuln.damage!).toBeGreaterThan(damageNoVuln.damage!);
  });

  // 3. PRIORITY_SHIFT: jogador lento age primeiro no turno seguinte
  it("PRIORITY_SHIFT: jogador lento age primeiro com prioridade", () => {
    // p1 tem speed 5 (lento), p2 tem speed 30 (rapido)
    const state = createBattle(
      [prioritySkill, basicAttack],
      [basicAttack],
      { speed: 5 },
      { speed: 30 }
    );

    // Turno 1: p1 usa priority shift (skill SELF, sempre acerta)
    const t1 = resolveTurn(
      state,
      [
        { playerId: "p1", skillId: prioritySkill.id },
        { playerId: "p2", skillId: basicAttack.id },
      ],
      fixedRandom
    );

    // Turno 2: p1 usa basicAttack — deve agir primeiro por ter priority +2
    const t2 = resolveTurn(
      t1.state,
      [
        { playerId: "p1", skillId: basicAttack.id },
        { playerId: "p2", skillId: basicAttack.id },
      ],
      fixedRandom
    );

    // Verificar que p1 agiu antes de p2 nos eventos de DAMAGE
    const damageEvents = findEvents(t2.events, "DAMAGE");
    const p1DamageIndex = t2.events.indexOf(damageEvents.find((e) => e.actorId === "p1")!);
    const p2DamageIndex = t2.events.indexOf(damageEvents.find((e) => e.actorId === "p2")!);
    expect(p1DamageIndex).toBeLessThan(p2DamageIndex);
  });

  // 4. COUNTER: atacante sofre dano de contra-ataque
  it("COUNTER: atacante sofre dano refletido", () => {
    // p2 tem speed maior para agir primeiro e ativar counter antes de p1 atacar
    const state = initBattle({
      battleId: "test",
      player1: { userId: "p1", characterId: "c1", stats: makeStats({ speed: 5 }), skills: [makeEquipped(basicAttack, 0)] },
      player2: { userId: "p2", characterId: "c2", stats: makeStats({ speed: 30 }), skills: [makeEquipped(counterSkill, 0), makeEquipped(basicAttack, 1)] },
    });

    // Turno 1: p2 ativa counter (age primeiro por speed), p1 ataca e sofre contra-ataque
    const t1 = resolveTurn(
      state,
      [
        { playerId: "p1", skillId: basicAttack.id },
        { playerId: "p2", skillId: counterSkill.id },
      ],
      fixedRandom
    );

    const counterEvents = findEvents(t1.events, "COUNTER");
    expect(counterEvents.length).toBe(1);
    expect(counterEvents[0].targetId).toBe("p1");
    expect(counterEvents[0].damage!).toBeGreaterThan(0);

    const p1 = t1.state.players.find((p) => p.playerId === "p1")!;
    expect(p1.currentHp).toBeLessThan(200);
  });

  // 5. COUNTER onTrigger: atacante sofre debuff de speed
  it("COUNTER onTrigger: atacante recebe debuff de speed ao ativar counter", () => {
    // p2 tem speed maior para agir primeiro e ativar counter
    const state = initBattle({
      battleId: "test",
      player1: { userId: "p1", characterId: "c1", stats: makeStats({ speed: 5 }), skills: [makeEquipped(basicAttack, 0)] },
      player2: { userId: "p2", characterId: "c2", stats: makeStats({ speed: 30 }), skills: [makeEquipped(counterWithTrigger, 0), makeEquipped(basicAttack, 1)] },
    });

    // Turno 1: p2 ativa counter (age primeiro por speed), p1 ataca e sofre counter + trigger
    const t1 = resolveTurn(
      state,
      [
        { playerId: "p1", skillId: basicAttack.id },
        { playerId: "p2", skillId: counterWithTrigger.id },
      ],
      fixedRandom
    );

    const triggerEvents = findEvents(t1.events, "COUNTER_TRIGGER");
    expect(triggerEvents.length).toBeGreaterThanOrEqual(1);

    const p1 = t1.state.players.find((p) => p.playerId === "p1")!;
    expect(p1.stages.speed).toBe(-1);
  });

  // 6. CLEANSE: remove debuffs do jogador
  it("CLEANSE: remove debuffs e reverte stages", () => {
    const state = createBattle([debuffSkill, basicAttack], [cleanseSkill, basicAttack]);

    // Turno 1: p1 aplica debuff em p2
    const t1 = resolveTurn(
      state,
      [
        { playerId: "p1", skillId: debuffSkill.id },
        { playerId: "p2", skillId: basicAttack.id },
      ],
      alwaysHitRandom
    );

    const p2AfterDebuff = t1.state.players.find((p) => p.playerId === "p2")!;
    expect(p2AfterDebuff.stages.physicalDef).toBe(-2);

    // Turno 2: p2 usa cleanse
    const t2 = resolveTurn(
      t1.state,
      [
        { playerId: "p1", skillId: null },
        { playerId: "p2", skillId: cleanseSkill.id },
      ],
      fixedRandom
    );

    const p2AfterCleanse = t2.state.players.find((p) => p.playerId === "p2")!;
    expect(p2AfterCleanse.stages.physicalDef).toBe(0);
    expect(p2AfterCleanse.buffs.filter((b) => b.source === "DEBUFF").length).toBe(0);
  });

  // 7. SELF_DEBUFF: caster perde speed stage
  it("SELF_DEBUFF: caster perde stage de speed ao usar skill", () => {
    const state = createBattle([selfDebuffSkill], [basicAttack]);

    const t1 = resolveTurn(
      state,
      [
        { playerId: "p1", skillId: selfDebuffSkill.id },
        { playerId: "p2", skillId: basicAttack.id },
      ],
      fixedRandom
    );

    const p1 = t1.state.players.find((p) => p.playerId === "p1")!;
    expect(p1.stages.speed).toBe(-1);
  });

  // 8. COMBO: dano turno 2 > turno 1 (stack crescente)
  it("COMBO: dano aumenta com stacks consecutivos", () => {
    const state = createBattle([comboSkill], [basicAttack]);

    // Turno 1: p1 usa combo (stack 1 = basePower 40)
    const t1 = resolveTurn(
      state,
      [
        { playerId: "p1", skillId: comboSkill.id },
        { playerId: "p2", skillId: basicAttack.id },
      ],
      fixedRandom
    );

    const damageTurn1 = findEvents(t1.events, "DAMAGE").find((e) => e.actorId === "p1")!;

    // Turno 2: p1 usa combo de novo (stack 2 = basePower 60)
    const t2 = resolveTurn(
      t1.state,
      [
        { playerId: "p1", skillId: comboSkill.id },
        { playerId: "p2", skillId: basicAttack.id },
      ],
      fixedRandom
    );

    const damageTurn2 = findEvents(t2.events, "DAMAGE").find((e) => e.actorId === "p1")!;

    expect(damageTurn2.damage!).toBeGreaterThan(damageTurn1.damage!);
  });

  // 9. COMBO reseta: trocar skill volta para stack 1
  it("COMBO: trocar de skill reseta o combo", () => {
    const state = createBattle([comboSkill, basicAttack], [basicAttack]);

    // Turno 1: p1 usa combo (stack 1)
    const t1 = resolveTurn(
      state,
      [
        { playerId: "p1", skillId: comboSkill.id },
        { playerId: "p2", skillId: basicAttack.id },
      ],
      fixedRandom
    );

    // Turno 2: p1 usa basicAttack (reseta combo)
    const t2 = resolveTurn(
      t1.state,
      [
        { playerId: "p1", skillId: basicAttack.id },
        { playerId: "p2", skillId: basicAttack.id },
      ],
      fixedRandom
    );

    // Turno 3: p1 usa combo de novo (stack 1 novamente)
    const t3 = resolveTurn(
      t2.state,
      [
        { playerId: "p1", skillId: comboSkill.id },
        { playerId: "p2", skillId: basicAttack.id },
      ],
      fixedRandom
    );

    const damageTurn1 = findEvents(t1.events, "DAMAGE").find((e) => e.actorId === "p1")!;
    const damageTurn3 = findEvents(t3.events, "DAMAGE").find((e) => e.actorId === "p1")!;

    // Dano deve ser igual pois ambos estao no stack 1
    // (HP do defensor pode diferir, mas o dano da formula depende de stats+power, nao de HP)
    expect(damageTurn3.damage!).toBe(damageTurn1.damage!);
  });

  // 10. ON_EXPIRE: buff expira e dispara efeito (evento ON_EXPIRE)
  it("ON_EXPIRE: buff monitorado dispara efeito ao expirar", () => {
    const state = createBattle([onExpireSkill, basicAttack], [basicAttack]);

    // Turno 1: p1 usa onExpireSkill — aplica buff physicalAtk +2, duration 1
    // Interno: remainingTurns = 1 + 1 = 2
    const t1 = resolveTurn(
      state,
      [
        { playerId: "p1", skillId: onExpireSkill.id },
        { playerId: "p2", skillId: basicAttack.id },
      ],
      alwaysHitRandom
    );

    const p1AfterT1 = t1.state.players.find((p) => p.playerId === "p1")!;
    expect(p1AfterT1.stages.physicalAtk).toBe(2);

    // Turno 2: skip — buff tick (remainingTurns 2->1 no T1 end, 1->0 no T2 end = expira)
    const t2 = resolveTurn(
      t1.state,
      [
        { playerId: "p1", skillId: null },
        { playerId: "p2", skillId: null },
      ],
      fixedRandom
    );

    const onExpireEvents = findEvents(t2.events, "ON_EXPIRE");
    expect(onExpireEvents.length).toBeGreaterThanOrEqual(1);

    // Buff +2 expirou (reverte -2), ON_EXPIRE aplica debuff -1
    // Stage final: 2 - 2 (revert) - 1 (debuff) = -1
    const p1AfterT2 = t2.state.players.find((p) => p.playerId === "p1")!;
    expect(p1AfterT2.stages.physicalAtk).toBe(-1);
  });

  // 11. STUN: jogador incapacitado (evento INCAPACITATED)
  it("STUN: jogador afetado fica incapacitado no turno seguinte", () => {
    const state = createBattle([stunSkill, basicAttack], [basicAttack]);

    // Turno 1: p1 aplica stun em p2
    const t1 = resolveTurn(
      state,
      [
        { playerId: "p1", skillId: stunSkill.id },
        { playerId: "p2", skillId: basicAttack.id },
      ],
      alwaysHitRandom
    );

    // Turno 2: p2 tenta agir mas esta stunado
    const t2 = resolveTurn(
      t1.state,
      [
        { playerId: "p1", skillId: null },
        { playerId: "p2", skillId: basicAttack.id },
      ],
      alwaysHitRandom
    );

    const incapEvents = findEvents(t2.events, "INCAPACITATED");
    expect(incapEvents.length).toBe(1);
    expect(incapEvents[0].actorId).toBe("p2");
  });

  // 12. FROZEN: jogador incapacitado
  it("FROZEN: jogador afetado fica incapacitado no turno seguinte", () => {
    const state = createBattle([frozenSkill, basicAttack], [basicAttack]);

    // Turno 1: p1 aplica frozen em p2
    const t1 = resolveTurn(
      state,
      [
        { playerId: "p1", skillId: frozenSkill.id },
        { playerId: "p2", skillId: basicAttack.id },
      ],
      alwaysHitRandom
    );

    // Turno 2: p2 tenta agir mas esta congelado
    const t2 = resolveTurn(
      t1.state,
      [
        { playerId: "p1", skillId: null },
        { playerId: "p2", skillId: basicAttack.id },
      ],
      alwaysHitRandom
    );

    const incapEvents = findEvents(t2.events, "INCAPACITATED");
    expect(incapEvents.length).toBe(1);
    expect(incapEvents[0].actorId).toBe("p2");
  });

  // 13. FROZEN: dano fisico aumentado (+30% vuln)
  it("FROZEN: dano fisico aumentado em 30% contra alvo congelado", () => {
    const state = createBattle([frozenSkill, basicAttack], [basicAttack]);

    // Simulacao base: dano fisico sem frozen
    const stateBase = createBattle([basicAttack], [basicAttack]);
    const tBase = resolveTurn(
      stateBase,
      [
        { playerId: "p1", skillId: basicAttack.id },
        { playerId: "p2", skillId: basicAttack.id },
      ],
      fixedRandom
    );
    const baseDamage = findEvents(tBase.events, "DAMAGE").find((e) => e.actorId === "p1")!.damage!;

    // Turno 1: p1 aplica frozen em p2
    const t1 = resolveTurn(
      state,
      [
        { playerId: "p1", skillId: frozenSkill.id },
        { playerId: "p2", skillId: basicAttack.id },
      ],
      alwaysHitRandom
    );

    // Turno 2: p1 ataca com dano fisico, p2 esta frozen (incapacitado + vuln fisica 30%)
    const t2 = resolveTurn(
      t1.state,
      [
        { playerId: "p1", skillId: basicAttack.id },
        { playerId: "p2", skillId: basicAttack.id },
      ],
      fixedRandom
    );

    const frozenDamage = findEvents(t2.events, "DAMAGE").find((e) => e.actorId === "p1")!.damage!;

    expect(frozenDamage).toBeGreaterThan(baseDamage);
  });
});
