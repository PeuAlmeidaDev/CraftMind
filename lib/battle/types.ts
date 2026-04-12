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

export type EquippedSkill = {
  skillId: string;
  slotIndex: number;
  skill: Skill;
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
};

export type InitBattleConfig = {
  battleId: string;
  player1: BattlePlayerConfig;
  player2: BattlePlayerConfig;
};

// Re-export tipos de skill usados pela engine
export type { Skill, SkillEffect, StatusEffect, DamageType, CounterTriggerPayload, OnExpirePayload };
