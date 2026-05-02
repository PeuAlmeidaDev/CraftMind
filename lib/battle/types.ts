// lib/battle/types.ts — Tipos de estado da engine de combate

import type {
  Skill,
  SkillEffect,
  StatusEffect,
  DamageType,
  CounterTriggerPayload,
  OnExpirePayload,
} from "@/types/skill";

// ---------------------------------------------------------------------------
// Stage state (modificadores temporarios de atributo durante batalha)
// ---------------------------------------------------------------------------

export type StageState = {
  physicalAtk: number;
  physicalDef: number;
  magicAtk: number;
  magicDef: number;
  speed: number;
  accuracy: number;
};

export type StageStat = keyof StageState;

// ---------------------------------------------------------------------------
// Efeitos ativos durante a batalha
// ---------------------------------------------------------------------------

export type ActiveStatusEffect = {
  status: StatusEffect;
  remainingTurns: number;
  turnsElapsed: number; // para escalacao do POISON (0, 1, 2)
};

export type BuffSource = "BUFF" | "DEBUFF" | "PRIORITY_SHIFT";

export type ActiveBuff = {
  id: string;
  source: BuffSource;
  stat: StageStat | "priority";
  value: number;
  remainingTurns: number;
  onExpire?: OnExpirePayload;
};

export type ActiveVulnerability = {
  id: string;
  damageType: DamageType;
  percent: number;
  remainingTurns: number;
};

export type ActiveCounter = {
  id: string;
  powerMultiplier: number;
  remainingTurns: number;
  onTrigger?: CounterTriggerPayload[];
};

// ---------------------------------------------------------------------------
// Combo tracking
// ---------------------------------------------------------------------------

export type ComboState = {
  skillId: string | null;
  stacks: number;
};

// ---------------------------------------------------------------------------
// Skill equipada (snapshot imutavel durante a batalha)
// ---------------------------------------------------------------------------
//
// `fromSpectralCard` marca o 5o slot bonus que vem de um Cristal Espectral
// (UserCard.purity === 100 com spectralSkillId definido). Skills normais nao
// setam essa flag (campo opcional, default undefined). Quando true, a skill
// esta sendo emprestada por um cristal e nao tem mastery aplicada (usa stats
// raw da Skill table). Ver `loadEquippedCardsAndApply` em
// `lib/cards/load-equipped.ts` para a fonte de dados e a regra de selecao
// (apenas o cristal Espectral equipado de menor `slotIndex` contribui).

export type EquippedSkill = {
  skillId: string;
  slotIndex: number;
  skill: Skill;
  fromSpectralCard?: boolean;
  /** UserCard.id de origem quando `fromSpectralCard === true`. */
  sourceUserCardId?: string;
};

// ---------------------------------------------------------------------------
// Estado de cada jogador durante a batalha
// ---------------------------------------------------------------------------

export type BaseStats = {
  physicalAtk: number;
  physicalDef: number;
  magicAtk: number;
  magicDef: number;
  hp: number;
  speed: number;
};

export type PlayerState = {
  playerId: string;
  characterId: string;
  baseStats: BaseStats;
  currentHp: number;
  stages: StageState;
  statusEffects: ActiveStatusEffect[];
  buffs: ActiveBuff[];
  vulnerabilities: ActiveVulnerability[];
  counters: ActiveCounter[];
  cooldowns: Record<string, number>; // skillId -> turnos restantes (0 = disponivel)
  combo: ComboState;
  // Array suporta 4 ou 5 elementos. O 5o (quando presente) eh sempre
  // `fromSpectralCard: true` e vem do UserCard com purity 100 de menor
  // slotIndex equipado. Append feito por `createPlayerState` em
  // `lib/battle/shared-helpers.ts` quando `BattlePlayerConfig.spectralSkill`
  // estiver definido.
  equippedSkills: EquippedSkill[];
};

// ---------------------------------------------------------------------------
// Acao do jogador no turno
// ---------------------------------------------------------------------------

export type TurnAction = {
  playerId: string;
  skillId: string | null; // null = skip turn
};

// ---------------------------------------------------------------------------
// Log de eventos do turno
// ---------------------------------------------------------------------------

export type TurnLogEntry = {
  turn: number;
  phase: string;
  actorId?: string;
  targetId?: string;
  skillId?: string;
  skillName?: string;
  damage?: number;
  damageType?: DamageType;
  healing?: number;
  statusApplied?: StatusEffect;
  statusDamage?: number;
  buffApplied?: { stat: string; value: number; duration: number };
  debuffApplied?: { stat: string; value: number; duration: number };
  counterTriggered?: boolean;
  missed?: boolean;
  comboStack?: number;
  message: string;
};

// ---------------------------------------------------------------------------
// Estado global da batalha
// ---------------------------------------------------------------------------

export type BattleStatus = "IN_PROGRESS" | "FINISHED";

export type BattleState = {
  battleId: string;
  turnNumber: number;
  players: [PlayerState, PlayerState];
  turnLog: TurnLogEntry[];
  status: BattleStatus;
  winnerId: string | null;
};

// ---------------------------------------------------------------------------
// Resultado de um turno resolvido
// ---------------------------------------------------------------------------

export type TurnResult = {
  state: BattleState;
  events: TurnLogEntry[];
};

// ---------------------------------------------------------------------------
// Config para initBattle
// ---------------------------------------------------------------------------

export type BattlePlayerConfig = {
  userId: string;
  characterId: string;
  stats: BaseStats;
  skills: EquippedSkill[];
  /** Quando definido, adiciona um 5o slot (espectral) ao final de
   *  `equippedSkills` com `fromSpectralCard: true`. A skill eh usada raw
   *  (sem mastery), cooldown inicial 0. Ver
   *  `lib/cards/load-equipped.ts → loadEquippedCardsAndApply`. */
  spectralSkill?: { skill: Skill; sourceUserCardId: string };
};

export type InitBattleConfig = {
  battleId: string;
  player1: BattlePlayerConfig;
  player2: BattlePlayerConfig;
};

// Re-export tipos de skill usados pela engine
export type { Skill, SkillEffect, StatusEffect, DamageType, CounterTriggerPayload, OnExpirePayload };
