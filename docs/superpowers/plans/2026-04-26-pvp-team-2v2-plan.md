# PvP Team 2v2 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement 2v2 PvP battles where 2 players face 2 players with simultaneous turns, solo/duo queue, friend invite system, and ranking points.

**Architecture:** Engine separada (`pvp-team-turn.ts`) reutilizando funções existentes (damage, effects, status, skills). Socket.io handlers para matchmaking (solo + duo queue), batalha e convites. Novos models Prisma (PvpStats, TeamBattle, TeamBattleParticipant).

**Tech Stack:** TypeScript, Socket.io 4, Prisma ORM, PostgreSQL, Next.js App Router

---

## File Structure

| File | Responsibility |
|------|---------------|
| `prisma/schema.prisma` | Add PvpMode enum, PvpStats, TeamBattle, TeamBattleParticipant models |
| `lib/battle/pvp-team-types.ts` | Types: PvpTeamBattleState, PvpTeamAction, PvpTeamTurnResult, PvpTeamBattleConfig, PvpTeamBattleSession |
| `lib/battle/pvp-team-turn.ts` | initPvpTeamBattle(), resolvePvpTeamTurn() — engine 2v2 |
| `server/stores/pvp-team-queue-store.ts` | In-memory solo queue + duo queue |
| `server/stores/pvp-team-battle-store.ts` | In-memory battle sessions (Map<battleId, session>) with TTL |
| `server/stores/pvp-team-invite-store.ts` | In-memory duo invites (Map<inviteId, invite>) with TTL |
| `server/handlers/pvp-team-matchmaking.ts` | Solo queue + duo queue + match accept/decline |
| `server/handlers/pvp-team-battle.ts` | Turn actions, timer, disconnect/reconnect, persist results |
| `server/handlers/pvp-team-invite.ts` | Friend invite send/accept/decline for duo queue |
| `server/index.ts` | Register new handlers + reconnection + active-battle check |
| `app/api/battle/pvp-team/history/route.ts` | Paginated 2v2 battle history |

---

### Task 1: Prisma Schema — PvpMode, PvpStats, TeamBattle, TeamBattleParticipant

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add PvpMode enum and models to schema.prisma**

Add after the `CoopBattleParticipant` model (line ~481):

```prisma
// ============================================================
// PVP MODE — Modos de PvP (stats separados por modo)
// ============================================================

enum PvpMode {
  SOLO_1V1
  TEAM_2V2
  TEAM_3V3
  TEAM_5V5
}

// ============================================================
// PVP STATS — Estatísticas de PvP por modo (W/L/D + ranking)
// ============================================================

model PvpStats {
  id            String  @id @default(cuid())
  characterId   String
  mode          PvpMode
  wins          Int     @default(0)
  losses        Int     @default(0)
  draws         Int     @default(0)
  rankingPoints Int     @default(0)

  character Character @relation(fields: [characterId], references: [id], onDelete: Cascade)

  @@unique([characterId, mode])
  @@index([mode, rankingPoints])

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

// ============================================================
// TEAM BATTLE — Registro de batalha em equipe (2v2, 3v3, 5v5)
// ============================================================

model TeamBattle {
  id         String       @id @default(cuid())
  mode       PvpMode
  winnerTeam Int?         // 1, 2, ou null (empate)
  status     BattleStatus @default(IN_PROGRESS)
  turns      Int          @default(0)
  log        Json         @default("[]")

  participants TeamBattleParticipant[]

  createdAt  DateTime  @default(now())
  finishedAt DateTime?
}

// ============================================================
// TEAM BATTLE PARTICIPANT — Jogador em batalha de equipe
// ============================================================

model TeamBattleParticipant {
  id           String @id @default(cuid())
  teamBattleId String
  userId       String
  characterId  String
  team         Int    // 1 ou 2

  teamBattle TeamBattle @relation(fields: [teamBattleId], references: [id], onDelete: Cascade)
  user       User       @relation(fields: [userId], references: [id])

  @@unique([teamBattleId, userId])
  @@index([userId])

  createdAt DateTime @default(now())
}
```

- [ ] **Step 2: Add relations to Character and User models**

In the `Character` model (around line 140), add relation:

```prisma
  pvpStats       PvpStats[]
```

Add it after the `characterSkills` line.

In the `User` model, add relation:

```prisma
  teamBattleParticipants TeamBattleParticipant[]
```

Add it after the existing battle relations.

- [ ] **Step 3: Run migration**

```bash
npx prisma migrate dev --name add-pvp-team-models
```

Expected: Migration created and applied successfully, Prisma client regenerated.

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "Feat: Adiciona models PvpStats, TeamBattle e TeamBattleParticipant"
```

---

### Task 2: Types — pvp-team-types.ts

**Files:**
- Create: `lib/battle/pvp-team-types.ts`

- [ ] **Step 1: Create pvp-team-types.ts**

```typescript
// lib/battle/pvp-team-types.ts — Tipos para batalha PvP em equipe (2v2)

import type { PlayerState, TurnLogEntry, BaseStats, EquippedSkill } from "./types";

export type PvpTeamMode = "TEAM_2V2";

export type PvpTeamBattleState = {
  battleId: string;
  turnNumber: number;
  team1: PlayerState[];  // 2 jogadores
  team2: PlayerState[];  // 2 jogadores
  mode: PvpTeamMode;
  turnLog: TurnLogEntry[];
  status: "IN_PROGRESS" | "FINISHED";
  winnerTeam: 1 | 2 | null;  // null = empate
};

export type PvpTeamAction = {
  playerId: string;
  skillId: string | null;  // null = skip
  targetIndex?: number;     // SINGLE_ENEMY: index no time inimigo (0 ou 1)
  targetId?: string;        // SINGLE_ALLY: playerId do aliado
};

export type PvpTeamTurnResult = {
  state: PvpTeamBattleState;
  events: TurnLogEntry[];
};

export type PvpTeamPlayerConfig = {
  userId: string;
  characterId: string;
  stats: BaseStats;
  skills: EquippedSkill[];
};

export type PvpTeamBattleConfig = {
  battleId: string;
  team1: PvpTeamPlayerConfig[];  // 2 players
  team2: PvpTeamPlayerConfig[];  // 2 players
  mode: PvpTeamMode;
};

export type PvpTeamBattleSession = {
  battleId: string;
  state: PvpTeamBattleState;
  playerSockets: Map<string, string>;        // userId -> socketId (4 entries)
  playerNames: Map<string, string>;          // userId -> name
  playerAvatars: Map<string, string | null>; // userId -> avatarUrl
  playerHouses: Map<string, string>;         // userId -> houseName
  playerTeams: Map<string, 1 | 2>;           // userId -> team number
  pendingActions: Map<string, PvpTeamAction>;
  turnTimer: ReturnType<typeof setTimeout> | null;
  matchAccepted: Set<string>;
  matchTimer: ReturnType<typeof setTimeout> | null;
  disconnectedPlayers: Map<string, { disconnectTimer: ReturnType<typeof setTimeout> }>;
  autoSkipPlayers: Set<string>;              // players que desconectaram permanentemente
  lastActivityAt: number;
};
```

- [ ] **Step 2: Commit**

```bash
git add lib/battle/pvp-team-types.ts
git commit -m "Feat: Adiciona tipos para PvP Team 2v2"
```

---

### Task 3: Engine — pvp-team-turn.ts

**Files:**
- Create: `lib/battle/pvp-team-turn.ts`

- [ ] **Step 1: Create pvp-team-turn.ts with initPvpTeamBattle and resolvePvpTeamTurn**

```typescript
// lib/battle/pvp-team-turn.ts — Engine para batalha PvP Team 2v2

import type {
  BattleState,
  TurnLogEntry,
  PlayerState,
  Skill,
} from "./types";
import type {
  PvpTeamBattleState,
  PvpTeamAction,
  PvpTeamTurnResult,
  PvpTeamBattleConfig,
} from "./pvp-team-types";
import { clampStage } from "./utils";
import { getEffectiveStat, calculateDamage } from "./damage";
import { getComboModifier, putOnCooldown, tickCooldowns } from "./skills";
import { isIncapacitated, applyStatusDamage } from "./status";
import { applyEffects } from "./effects";
import { MAX_TURNS, STAGE_MULTIPLIERS } from "./constants";
import {
  createPlayerState,
  applyCounterTriggerEffects,
  tickEntitiesEndOfTurn,
} from "./shared-helpers";

// ---------------------------------------------------------------------------
// Helper: criar BattleState fake para adaptar funcoes existentes (applyEffects)
// ---------------------------------------------------------------------------

const DUMMY_PLAYER_ID = "__pvp_team_dummy__";

function makeDummyPlayer(): PlayerState {
  return {
    playerId: DUMMY_PLAYER_ID,
    characterId: DUMMY_PLAYER_ID,
    baseStats: { physicalAtk: 1, physicalDef: 1, magicAtk: 1, magicDef: 1, hp: 1, speed: 1 },
    currentHp: 1,
    stages: { physicalAtk: 0, physicalDef: 0, magicAtk: 0, magicDef: 0, speed: 0, accuracy: 0 },
    statusEffects: [],
    buffs: [],
    vulnerabilities: [],
    counters: [],
    cooldowns: {},
    combo: { skillId: null, stacks: 0 },
    equippedSkills: [],
  };
}

function makeFakeBattleState(
  entity1: PlayerState,
  entity2: PlayerState,
  battleId: string,
  turnNumber: number
): BattleState {
  const player2 = entity1.playerId === entity2.playerId ? makeDummyPlayer() : entity2;
  return {
    battleId,
    turnNumber,
    players: [entity1, player2] as [PlayerState, PlayerState],
    turnLog: [],
    status: "IN_PROGRESS",
    winnerId: null,
  };
}

// ---------------------------------------------------------------------------
// Helper: encontrar time e time oposto de um jogador
// ---------------------------------------------------------------------------

function getPlayerTeam(s: PvpTeamBattleState, playerId: string): { own: PlayerState[]; enemy: PlayerState[]; teamNum: 1 | 2 } | null {
  if (s.team1.some((p) => p.playerId === playerId)) {
    return { own: s.team1, enemy: s.team2, teamNum: 1 };
  }
  if (s.team2.some((p) => p.playerId === playerId)) {
    return { own: s.team2, enemy: s.team1, teamNum: 2 };
  }
  return null;
}

// ---------------------------------------------------------------------------
// initPvpTeamBattle
// ---------------------------------------------------------------------------

export function initPvpTeamBattle(config: PvpTeamBattleConfig): PvpTeamBattleState {
  if (config.team1.length !== 2) {
    throw new Error(`Team 1 deve ter 2 jogadores (recebeu ${config.team1.length})`);
  }
  if (config.team2.length !== 2) {
    throw new Error(`Team 2 deve ter 2 jogadores (recebeu ${config.team2.length})`);
  }

  const team1States = config.team1.map((p) => createPlayerState(p));
  const team2States = config.team2.map((p) => createPlayerState(p));

  return {
    battleId: config.battleId,
    turnNumber: 1,
    team1: team1States,
    team2: team2States,
    mode: config.mode,
    turnLog: [],
    status: "IN_PROGRESS",
    winnerTeam: null,
  };
}

// ---------------------------------------------------------------------------
// resolvePvpTeamTurn
// ---------------------------------------------------------------------------

export function resolvePvpTeamTurn(
  state: PvpTeamBattleState,
  actions: PvpTeamAction[],
  randomFn?: () => number
): PvpTeamTurnResult {
  // 0. Guard: batalha ja finalizada
  if (state.status === "FINISHED") {
    return { state, events: [] };
  }

  // 1. Deep clone
  const s = structuredClone(state);
  const events: TurnLogEntry[] = [];

  // 2. Coletar todos jogadores vivos
  const allPlayers = [...s.team1, ...s.team2];
  const alivePlayers = allPlayers.filter((p) => p.currentHp > 0);
  const alivePlayerIds = new Set(alivePlayers.map((p) => p.playerId));

  // 3. Validar acoes (1 por player vivo, ou null para skip)
  const validActions = actions.filter((a) => alivePlayerIds.has(a.playerId));
  const actionPlayerIds = new Set(validActions.map((a) => a.playerId));
  if (actionPlayerIds.size !== validActions.length) {
    throw new Error("Acoes duplicadas: cada jogador deve enviar exatamente 1 acao");
  }

  // Preencher acoes faltantes como skip
  for (const player of alivePlayers) {
    if (!actionPlayerIds.has(player.playerId)) {
      validActions.push({ playerId: player.playerId, skillId: null });
    }
  }

  // 4. Ordenar por prioridade > speed > random
  const sortedActions = [...validActions].sort((a, b) => {
    const playerA = allPlayers.find((p) => p.playerId === a.playerId);
    const playerB = allPlayers.find((p) => p.playerId === b.playerId);
    if (!playerA || !playerB) return 0;

    // Priority: checar buffs de PRIORITY_SHIFT
    const priorityA = playerA.buffs
      .filter((bf) => bf.stat === "priority")
      .reduce((sum, bf) => sum + bf.value, 0);
    const priorityB = playerB.buffs
      .filter((bf) => bf.stat === "priority")
      .reduce((sum, bf) => sum + bf.value, 0);
    if (priorityA !== priorityB) return priorityB - priorityA;

    // Speed
    const speedA = getEffectiveStat(playerA.baseStats.speed, playerA.stages.speed);
    const speedB = getEffectiveStat(playerB.baseStats.speed, playerB.stages.speed);
    if (speedA !== speedB) return speedB - speedA;

    // Random tiebreak
    return (randomFn ?? Math.random)() > 0.5 ? -1 : 1;
  });

  // 5. Resolver cada acao
  for (const action of sortedActions) {
    if (s.status === "FINISHED") break;

    const player = allPlayers.find((p) => p.playerId === action.playerId);
    if (!player || player.currentHp <= 0) continue;

    const teams = getPlayerTeam(s, player.playerId);
    if (!teams) continue;

    // a. Checar incapacitacao
    const incap = isIncapacitated(player);

    // b. Aplicar dano de status
    const statusEntries = applyStatusDamage(player, s.turnNumber);
    events.push(...statusEntries);

    // c. Se morreu por status
    if (player.currentHp <= 0) {
      events.push({
        turn: s.turnNumber,
        phase: "DEATH",
        targetId: player.playerId,
        message: `${player.playerId} foi derrotado por dano de status`,
      });
      checkTeamWipe(s, events);
      continue;
    }

    // d. Se incapacitado ou skip
    if (incap.incapacitated) {
      player.combo = { skillId: null, stacks: 0 };
      events.push({
        turn: s.turnNumber,
        phase: "INCAPACITATED",
        actorId: player.playerId,
        message: `${player.playerId} esta incapacitado por ${incap.reason}`,
      });
      continue;
    }

    if (action.skillId === null) {
      events.push({
        turn: s.turnNumber,
        phase: "SKIP",
        actorId: player.playerId,
        message: `${player.playerId} pulou o turno`,
      });
      continue;
    }

    // e. Validar skill
    const equipped = player.equippedSkills.find((es) => es.skillId === action.skillId);
    if (!equipped) {
      events.push({
        turn: s.turnNumber,
        phase: "INVALID",
        actorId: player.playerId,
        skillId: action.skillId,
        message: `${player.playerId} tentou usar skill invalida`,
      });
      continue;
    }

    if (player.cooldowns[action.skillId] && player.cooldowns[action.skillId] > 0) {
      events.push({
        turn: s.turnNumber,
        phase: "COOLDOWN",
        actorId: player.playerId,
        skillId: action.skillId,
        skillName: equipped.skill.name,
        message: `${player.playerId} tentou usar ${equipped.skill.name} mas esta em cooldown`,
      });
      continue;
    }

    const skill: Skill = equipped.skill;

    // f. Combo
    let comboOverride: { basePower: number; hits: number } | undefined;
    const comboResult = getComboModifier(player, skill);
    if (comboResult !== null) {
      player.combo = comboResult.newCombo;
      comboOverride = { basePower: comboResult.basePower, hits: comboResult.hits };
      events.push({
        turn: s.turnNumber,
        phase: "COMBO",
        actorId: player.playerId,
        skillId: skill.id,
        skillName: skill.name,
        comboStack: comboResult.newCombo.stacks,
        message: `${player.playerId} usa ${skill.name} em combo (stack ${comboResult.newCombo.stacks})`,
      });
    } else {
      player.combo = { skillId: action.skillId, stacks: 0 };
    }

    // g. Accuracy check
    const isSupportSelf =
      skill.damageType === "NONE" &&
      skill.basePower === 0 &&
      skill.target === "SELF";

    if (!isSupportSelf) {
      const stageMultiplier = STAGE_MULTIPLIERS[clampStage(player.stages.accuracy)];
      const hitChance = Math.min(100, Math.max(10, skill.accuracy * stageMultiplier));
      const hit = (randomFn ?? Math.random)() * 100 < hitChance;

      if (!hit) {
        events.push({
          turn: s.turnNumber,
          phase: "MISS",
          actorId: player.playerId,
          skillId: skill.id,
          skillName: skill.name,
          missed: true,
          message: `${player.playerId} usou ${skill.name} mas errou!`,
        });
        putOnCooldown(player, skill.id);
        player.combo = { skillId: null, stacks: 0 };
        continue;
      }
    }

    // h. Resolver alvos
    const targets = resolvePvpTeamTargets(s, player, skill, action, teams);

    // i. Para cada alvo: dano, counters, checar mortes
    for (const target of targets) {
      if (target.currentHp <= 0) continue;

      const dmgResult = calculateDamage({
        skill,
        attacker: player,
        defender: target,
        comboOverride,
        randomFn,
      });

      if (dmgResult.totalDamage > 0) {
        target.currentHp = Math.max(0, target.currentHp - dmgResult.totalDamage);
        events.push({
          turn: s.turnNumber,
          phase: "DAMAGE",
          actorId: player.playerId,
          targetId: target.playerId,
          skillId: skill.id,
          skillName: skill.name,
          damage: dmgResult.totalDamage,
          message: `${player.playerId} usa ${skill.name} e causa ${dmgResult.totalDamage} de dano em ${target.playerId} (${dmgResult.hits} hit${dmgResult.hits > 1 ? "s" : ""})`,
        });
      } else {
        events.push({
          turn: s.turnNumber,
          phase: "ACTION",
          actorId: player.playerId,
          targetId: target.playerId,
          skillId: skill.id,
          skillName: skill.name,
          message: `${player.playerId} usa ${skill.name} em ${target.playerId}`,
        });
      }

      // Processar counters do defensor
      const countersCopy = [...target.counters];
      for (const counter of countersCopy) {
        if (counter.remainingTurns > 0 && dmgResult.totalDamage > 0) {
          const counterDamage = Math.max(
            1,
            Math.floor(dmgResult.totalDamage * counter.powerMultiplier)
          );
          player.currentHp = Math.max(0, player.currentHp - counterDamage);
          events.push({
            turn: s.turnNumber,
            phase: "COUNTER",
            actorId: target.playerId,
            targetId: player.playerId,
            damage: counterDamage,
            counterTriggered: true,
            message: `${target.playerId} contra-ataca ${player.playerId} por ${counterDamage} de dano`,
          });

          if (counter.onTrigger) {
            applyCounterTriggerEffects(
              counter.onTrigger,
              target,
              player,
              s.turnNumber,
              events,
              randomFn
            );
          }
          break;
        }
      }

      // Checar se alvo morreu
      if (target.currentHp <= 0) {
        events.push({
          turn: s.turnNumber,
          phase: "DEATH",
          targetId: target.playerId,
          message: `${target.playerId} foi derrotado`,
        });
        checkTeamWipe(s, events);
      }

      // Checar se player morreu por counter
      if (player.currentHp <= 0) {
        events.push({
          turn: s.turnNumber,
          phase: "DEATH",
          targetId: player.playerId,
          message: `${player.playerId} foi derrotado por contra-ataque`,
        });
        checkTeamWipe(s, events);
        break;
      }
    }

    // j. Aplicar efeitos via adapter
    if (s.status !== "FINISHED" && player.currentHp > 0) {
      for (const target of targets) {
        if (target.currentHp <= 0) continue;

        const fakeState = makeFakeBattleState(
          player,
          target,
          s.battleId,
          s.turnNumber
        );

        const effectEntries = applyEffects({
          skill,
          casterId: player.playerId,
          state: fakeState,
          totalDamage: 0,
          turnNumber: s.turnNumber,
          randomFn,
        });
        events.push(...effectEntries);
      }
    }

    // k. Cooldown
    putOnCooldown(player, skill.id);

    if (s.status === "FINISHED") break;
  }

  // 6. Tick end of turn
  if (s.status !== "FINISHED") {
    const aliveEntities = allPlayers.filter((p) => p.currentHp > 0);
    tickEntitiesEndOfTurn(aliveEntities, s.turnNumber, events);

    // tickCooldowns
    for (const player of allPlayers) {
      if (player.currentHp > 0) {
        tickCooldowns(player);
      }
    }

    // Checar mortes por ON_EXPIRE
    checkTeamWipe(s, events);

    // 7. Incrementar turno
    if (s.status !== "FINISHED") {
      s.turnNumber += 1;

      if (s.turnNumber > MAX_TURNS) {
        s.status = "FINISHED";
        s.winnerTeam = null; // empate
        events.push({
          turn: s.turnNumber,
          phase: "DRAW",
          message: `Batalha PvP Team terminou em empate apos ${MAX_TURNS} turnos`,
        });
      }
    }
  }

  // 8. Consolidar turnLog
  s.turnLog = [...s.turnLog, ...events];
  return { state: s, events };
}

// ---------------------------------------------------------------------------
// checkTeamWipe — Verifica se todos de um time morreram
// ---------------------------------------------------------------------------

function checkTeamWipe(s: PvpTeamBattleState, events: TurnLogEntry[]): void {
  if (s.status === "FINISHED") return;

  const team1AllDead = s.team1.every((p) => p.currentHp <= 0);
  const team2AllDead = s.team2.every((p) => p.currentHp <= 0);

  if (team1AllDead && team2AllDead) {
    s.status = "FINISHED";
    s.winnerTeam = null; // empate (ambos morreram)
    events.push({
      turn: s.turnNumber,
      phase: "DRAW",
      message: "Ambos os times foram eliminados. Empate!",
    });
  } else if (team1AllDead) {
    s.status = "FINISHED";
    s.winnerTeam = 2;
    events.push({
      turn: s.turnNumber,
      phase: "DEATH",
      message: "Time 1 foi eliminado. Time 2 vence!",
    });
  } else if (team2AllDead) {
    s.status = "FINISHED";
    s.winnerTeam = 1;
    events.push({
      turn: s.turnNumber,
      phase: "DEATH",
      message: "Time 2 foi eliminado. Time 1 vence!",
    });
  }
}

// ---------------------------------------------------------------------------
// resolvePvpTeamTargets — Determina alvos de uma skill em PvP Team
// ---------------------------------------------------------------------------

function resolvePvpTeamTargets(
  s: PvpTeamBattleState,
  player: PlayerState,
  skill: Skill,
  action: PvpTeamAction,
  teams: { own: PlayerState[]; enemy: PlayerState[]; teamNum: 1 | 2 }
): PlayerState[] {
  const aliveOwn = teams.own.filter((p) => p.currentHp > 0);
  const aliveEnemy = teams.enemy.filter((p) => p.currentHp > 0);

  switch (skill.target) {
    case "SINGLE_ENEMY": {
      if (action.targetIndex !== undefined) {
        const target = teams.enemy[action.targetIndex];
        if (target && target.currentHp > 0) return [target];
        // Alvo morreu — nao redirecionar
        return [];
      }
      // Fallback: primeiro inimigo vivo
      return aliveEnemy.length > 0 ? [aliveEnemy[0]] : [];
    }

    case "ALL_ENEMIES":
      return aliveEnemy;

    case "SELF":
      return [player];

    case "SINGLE_ALLY": {
      if (action.targetId) {
        const target = aliveOwn.find((p) => p.playerId === action.targetId);
        if (target) return [target];
      }
      // Fallback: si mesmo
      return [player];
    }

    case "ALL_ALLIES":
      return aliveOwn;

    case "ALL":
      return [...aliveOwn, ...aliveEnemy];

    default:
      return [];
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/battle/pvp-team-turn.ts
git commit -m "Feat: Adiciona engine de combate PvP Team 2v2"
```

---

### Task 4: Stores — pvp-team-queue-store.ts, pvp-team-battle-store.ts, pvp-team-invite-store.ts

**Files:**
- Create: `server/stores/pvp-team-queue-store.ts`
- Create: `server/stores/pvp-team-battle-store.ts`
- Create: `server/stores/pvp-team-invite-store.ts`

- [ ] **Step 1: Create pvp-team-queue-store.ts**

```typescript
// server/stores/pvp-team-queue-store.ts — Store in-memory para filas de PvP Team 2v2

import type { BaseStats, EquippedSkill } from "../../lib/battle/types";

export type PvpTeamQueueEntry = {
  userId: string;
  socketId: string;
  characterId: string;
  stats: BaseStats;
  skills: EquippedSkill[];
  joinedAt: number;
};

export type PvpTeamDuoEntry = {
  player1: PvpTeamQueueEntry;
  player2: PvpTeamQueueEntry;
  joinedAt: number;
};

// Fila solo: jogadores individuais
const soloQueue: PvpTeamQueueEntry[] = [];

// Fila de duplas: pares pre-formados
const duoQueue: PvpTeamDuoEntry[] = [];

// ---------------------------------------------------------------------------
// Solo Queue
// ---------------------------------------------------------------------------

export function addToSoloQueue(entry: PvpTeamQueueEntry): boolean {
  if (isInAnyQueue(entry.userId)) return false;
  soloQueue.push(entry);
  return true;
}

export function removeFromSoloQueue(userId: string): boolean {
  const index = soloQueue.findIndex((e) => e.userId === userId);
  if (index === -1) return false;
  soloQueue.splice(index, 1);
  return true;
}

export function findSoloMatch(): PvpTeamQueueEntry[] | null {
  if (soloQueue.length < 4) return null;
  return soloQueue.splice(0, 4);
}

export function getSoloQueuePosition(userId: string): number | null {
  const index = soloQueue.findIndex((e) => e.userId === userId);
  return index === -1 ? null : index + 1;
}

export function getSoloQueueSize(): number {
  return soloQueue.length;
}

// ---------------------------------------------------------------------------
// Duo Queue
// ---------------------------------------------------------------------------

export function addToDuoQueue(duo: PvpTeamDuoEntry): boolean {
  if (isInAnyQueue(duo.player1.userId) || isInAnyQueue(duo.player2.userId)) return false;
  duoQueue.push(duo);
  return true;
}

export function removeFromDuoQueue(userId: string): boolean {
  const index = duoQueue.findIndex(
    (d) => d.player1.userId === userId || d.player2.userId === userId
  );
  if (index === -1) return false;
  duoQueue.splice(index, 1);
  return true;
}

export function findDuoMatch(): PvpTeamDuoEntry[] | null {
  if (duoQueue.length < 2) return null;
  return duoQueue.splice(0, 2);
}

export function getDuoQueuePosition(userId: string): number | null {
  const index = duoQueue.findIndex(
    (d) => d.player1.userId === userId || d.player2.userId === userId
  );
  return index === -1 ? null : index + 1;
}

export function getDuoQueueSize(): number {
  return duoQueue.length;
}

// ---------------------------------------------------------------------------
// Shared
// ---------------------------------------------------------------------------

export function isInAnyQueue(userId: string): boolean {
  if (soloQueue.some((e) => e.userId === userId)) return true;
  if (duoQueue.some((d) => d.player1.userId === userId || d.player2.userId === userId)) return true;
  return false;
}

export function removeFromAnyQueue(userId: string): void {
  removeFromSoloQueue(userId);
  removeFromDuoQueue(userId);
}
```

- [ ] **Step 2: Create pvp-team-battle-store.ts**

```typescript
// server/stores/pvp-team-battle-store.ts — Store in-memory para batalhas PvP Team ativas

import type { PvpTeamBattleSession } from "../../lib/battle/pvp-team-types";

const SESSION_TTL_MS = 30 * 60 * 1000; // 30 minutos
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000; // 5 minutos

const battles = new Map<string, PvpTeamBattleSession>();

// ---------------------------------------------------------------------------
// Cleanup periodico
// ---------------------------------------------------------------------------

setInterval(() => {
  const now = Date.now();
  for (const [battleId, session] of battles) {
    if (now - session.lastActivityAt > SESSION_TTL_MS) {
      cleanupSession(session);
      battles.delete(battleId);
      console.log(`[Socket.io] PvP Team battle ${battleId} removida por TTL`);
    }
  }
}, CLEANUP_INTERVAL_MS);

function cleanupSession(session: PvpTeamBattleSession): void {
  if (session.turnTimer) {
    clearTimeout(session.turnTimer);
    session.turnTimer = null;
  }
  if (session.matchTimer) {
    clearTimeout(session.matchTimer);
    session.matchTimer = null;
  }
  for (const entry of session.disconnectedPlayers.values()) {
    clearTimeout(entry.disconnectTimer);
  }
  session.disconnectedPlayers.clear();
}

// ---------------------------------------------------------------------------
// Funcoes exportadas
// ---------------------------------------------------------------------------

export function setPvpTeamBattle(battleId: string, session: PvpTeamBattleSession): void {
  battles.set(battleId, session);
}

export function getPvpTeamBattle(battleId: string): PvpTeamBattleSession | undefined {
  const session = battles.get(battleId);
  if (!session) return undefined;

  if (Date.now() - session.lastActivityAt > SESSION_TTL_MS) {
    cleanupSession(session);
    battles.delete(battleId);
    return undefined;
  }

  return session;
}

export function removePvpTeamBattle(battleId: string): void {
  const session = battles.get(battleId);
  if (!session) return;
  cleanupSession(session);
  battles.delete(battleId);
}

export function getPlayerPvpTeamBattle(
  userId: string
): { battleId: string; session: PvpTeamBattleSession } | undefined {
  for (const [battleId, session] of battles) {
    const isInSockets = session.playerSockets.has(userId);
    const isInTeam1 = session.state.team1.some((p) => p.playerId === userId);
    const isInTeam2 = session.state.team2.some((p) => p.playerId === userId);

    if (isInSockets || isInTeam1 || isInTeam2) {
      if (Date.now() - session.lastActivityAt > SESSION_TTL_MS) {
        cleanupSession(session);
        battles.delete(battleId);
        continue;
      }
      if (session.state.status === "FINISHED") continue;
      return { battleId, session };
    }
  }
  return undefined;
}

export function updatePvpTeamPlayerSocket(
  battleId: string,
  userId: string,
  socketId: string
): void {
  const session = battles.get(battleId);
  if (!session) return;
  if (session.playerSockets.has(userId)) {
    session.playerSockets.set(userId, socketId);
  }
}
```

- [ ] **Step 3: Create pvp-team-invite-store.ts**

```typescript
// server/stores/pvp-team-invite-store.ts — Store in-memory para convites PvP Team duo

export type PvpTeamInvite = {
  inviteId: string;
  senderId: string;
  senderSocketId: string;
  senderName: string;
  targetId: string;
  createdAt: number;
  timer: ReturnType<typeof setTimeout>;
};

const invites = new Map<string, PvpTeamInvite>();

export function setInvite(invite: PvpTeamInvite): void {
  invites.set(invite.inviteId, invite);
}

export function getInvite(inviteId: string): PvpTeamInvite | undefined {
  return invites.get(inviteId);
}

export function removeInvite(inviteId: string): void {
  const invite = invites.get(inviteId);
  if (!invite) return;
  clearTimeout(invite.timer);
  invites.delete(inviteId);
}

export function getInviteBySender(senderId: string): PvpTeamInvite | undefined {
  for (const invite of invites.values()) {
    if (invite.senderId === senderId) return invite;
  }
  return undefined;
}

export function getInviteByTarget(targetId: string): PvpTeamInvite | undefined {
  for (const invite of invites.values()) {
    if (invite.targetId === targetId) return invite;
  }
  return undefined;
}

export function removeInvitesBySender(senderId: string): void {
  for (const [inviteId, invite] of invites) {
    if (invite.senderId === senderId) {
      clearTimeout(invite.timer);
      invites.delete(inviteId);
    }
  }
}

export function removeInvitesByTarget(targetId: string): void {
  for (const [inviteId, invite] of invites) {
    if (invite.targetId === targetId) {
      clearTimeout(invite.timer);
      invites.delete(inviteId);
    }
  }
}
```

- [ ] **Step 4: Commit**

```bash
git add server/stores/pvp-team-queue-store.ts server/stores/pvp-team-battle-store.ts server/stores/pvp-team-invite-store.ts
git commit -m "Feat: Adiciona stores in-memory para PvP Team 2v2"
```

---

### Task 5: Handler — pvp-team-matchmaking.ts

**Files:**
- Create: `server/handlers/pvp-team-matchmaking.ts`

- [ ] **Step 1: Create pvp-team-matchmaking.ts**

Este handler gerencia a fila solo e aceite de match. Segue o mesmo padrão do `coop-pve-matchmaking.ts`.

Eventos handled:
- `pvp-team:queue:join` — entrar na fila solo
- `pvp-team:queue:leave` — sair da fila
- `pvp-team:match:accept` — aceitar match
- `pvp-team:match:decline` — recusar match
- `disconnect` — cleanup

O handler deve:
1. Validar que o player nao esta em nenhuma fila/batalha ativa (checar todos stores: `isInQueue`, `isInBossQueue`, `isInCoopPveQueue`, `isInAnyQueue`, `getPlayerBattle`, `getPlayerBossBattle`, `getPlayerCoopPveBattle`, `getPlayerPvpTeamBattle`)
2. Buscar character + skills do banco via Prisma
3. Adicionar a `soloQueue`
4. Tentar match: se 4 na fila solo, shuffle + split em 2 times de 2
5. Se match encontrado: criar `PvpTeamBattleSession` com estado via `initPvpTeamBattle`, emitir `pvp-team:match:found` para os 4 sockets, setar match accept timer (30s)
6. Se duo queue tambem tem match: checar `findDuoMatch()` quando uma nova dupla entra
7. Match accept: quando todos 4 aceitam → join sockets na room, emitir `pvp-team:battle:start`, iniciar turn timer. Persistir `TeamBattle` no banco com status IN_PROGRESS
8. Match decline: cancelar match, devolver quem aceitou para a fila

A implementacao completa segue o padrao de `coop-pve-matchmaking.ts` adaptado para 4 jogadores com 2 times.

Nao incluir codigo completo aqui — o agent implementador deve ler `server/handlers/coop-pve-matchmaking.ts` como referencia e adaptar para PvP Team. As diferencas-chave sao:
- 4 jogadores em vez de 2-3
- Dois times em vez de time vs mobs
- Sem busca de mobs do banco
- Sem calculo de tier
- `initPvpTeamBattle()` em vez de `initCoopPveBattle()`
- `setPvpTeamBattle()` em vez de `setCoopPveBattle()`
- Persistir `TeamBattle` + `TeamBattleParticipant` no banco ao aceitar

- [ ] **Step 2: Commit**

```bash
git add server/handlers/pvp-team-matchmaking.ts
git commit -m "Feat: Adiciona matchmaking handler para PvP Team 2v2"
```

---

### Task 6: Handler — pvp-team-battle.ts

**Files:**
- Create: `server/handlers/pvp-team-battle.ts`

- [ ] **Step 1: Create pvp-team-battle.ts**

Este handler gerencia o fluxo de batalha, turnos e persistencia. Segue o padrao de `coop-pve-battle.ts`.

Eventos handled:
- `pvp-team:battle:request-state` — solicitar estado (ao carregar pagina)
- `pvp-team:battle:action` — enviar acao do turno
- `disconnect` — grace period + auto-skip

Funcoes exportadas:
- `registerPvpTeamBattleHandlers(io, socket)`
- `handlePvpTeamReconnection(io, socket, userId)` — reconexao

Funcionalidade:
1. **request-state**: join socket na room, enviar estado sanitizado
2. **action**: validar payload (battleId, skillId, targetIndex?, targetId?), armazenar em pendingActions, quando 4 acoes coletadas (incluindo auto-skip) → `resolvePvpTeamTurn()`
3. **Turn timer (30s)**: se nao receber todas acoes, auto-skip para AFK
4. **Sanitizacao**: jogador ve seu time completo (buffs, cooldowns, combo, stages); time inimigo ve apenas `currentHp`, `statusEffects`, `baseStats`
5. **Disconnect**: 30s grace period → se nao reconecta, add a `autoSkipPlayers` (time continua 1v2). Se ambos do mesmo time desconectam → derrota
6. **Persistencia (fire-and-forget)**: ao finalizar, criar `TeamBattle` (status FINISHED, winnerTeam, turns, log), criar 4 `TeamBattleParticipant`, upsert `PvpStats` de cada jogador:
   - Vitoria: wins += 1, rankingPoints += 25
   - Derrota: losses += 1, rankingPoints -= 15 (minimo 0)
   - Empate: draws += 1, rankingPoints += 5

O agent implementador deve ler `server/handlers/coop-pve-battle.ts` como referencia. Diferencas-chave:
- Sem mobs/IA — todos sao jogadores humanos
- Sanitizacao mostra aliado completo mas inimigos limitados (em vez de mobs limitados)
- Persistencia atualiza `PvpStats` em vez de dar EXP
- Auto-skip permanente apos grace period (em vez de eliminar jogador)
- `readyPlayers` tracking para iniciar timer apenas quando todos carregaram

- [ ] **Step 2: Commit**

```bash
git add server/handlers/pvp-team-battle.ts
git commit -m "Feat: Adiciona battle handler para PvP Team 2v2"
```

---

### Task 7: Handler — pvp-team-invite.ts

**Files:**
- Create: `server/handlers/pvp-team-invite.ts`

- [ ] **Step 1: Create pvp-team-invite.ts**

Este handler gerencia convites de amigos para formar dupla no PvP Team. Segue o padrao de `coop-pve-invite.ts` mas simplificado (sempre 1 convite, sem grupos).

Eventos handled:
- `pvp-team:invite:send` — enviar convite (requer amizade ACCEPTED)
- `pvp-team:invite:accept` — aceitar → dupla entra na fila de duplas
- `pvp-team:invite:decline` — recusar
- `pvp-team:friends:online-check` — checar amigos online
- `disconnect` — cleanup de convites

Fluxo de aceite:
1. Target aceita convite
2. Buscar characters + skills de ambos no banco
3. Criar `PvpTeamDuoEntry` com dados dos 2 players
4. Adicionar na `duoQueue` via `addToDuoQueue()`
5. Checar `findDuoMatch()` — se outra dupla ja esta na fila → criar match

O agent implementador deve ler `server/handlers/coop-pve-invite.ts` como referencia. Diferencas-chave:
- Sem modos (sempre 2v2)
- Sem grupos (1 convite por sender)
- Ao aceitar: entra na duo queue em vez de criar batalha direto
- Reutilizar `isPlayerBusy()` adicionando checagem de `isInAnyQueue` e `getPlayerPvpTeamBattle`
- Ao encontrar duo match (2 duplas): seguir o mesmo fluxo do matchmaking (criar session, emitir match:found, match accept)

- [ ] **Step 2: Commit**

```bash
git add server/handlers/pvp-team-invite.ts
git commit -m "Feat: Adiciona invite handler para PvP Team 2v2"
```

---

### Task 8: Integração — server/index.ts + active-battle

**Files:**
- Modify: `server/index.ts`

- [ ] **Step 1: Add imports and handler registration**

Adicionar no topo de `server/index.ts`:

```typescript
import { registerPvpTeamMatchmakingHandlers } from "./handlers/pvp-team-matchmaking";
import { registerPvpTeamBattleHandlers, handlePvpTeamReconnection } from "./handlers/pvp-team-battle";
import { registerPvpTeamInviteHandlers } from "./handlers/pvp-team-invite";
import { getPlayerPvpTeamBattle } from "./stores/pvp-team-battle-store";
```

- [ ] **Step 2: Add active-battle check**

No endpoint `GET /internal/active-battle`, adicionar checagem do store PvP Team ANTES do return `hasBattle: false`:

```typescript
    const pvpTeamResult = getPlayerPvpTeamBattle(userId);
    if (pvpTeamResult) {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ hasBattle: true, battleType: "pvp-team", battleId: pvpTeamResult.battleId }));
      return;
    }
```

- [ ] **Step 3: Add reconnection handler**

No bloco `io.on("connection", ...)`, adicionar apos o `handleCoopPveReconnection`:

```typescript
  const pvpTeamReconnected = handlePvpTeamReconnection(io, socket, socket.data.userId);
  if (pvpTeamReconnected) {
    console.log(
      `[Socket.io] ${socket.data.userId} reconectou em PvP Team battle`
    );
  }
```

- [ ] **Step 4: Register handlers**

No bloco `io.on("connection", ...)`, adicionar apos o `registerCoopPveInviteHandlers`:

```typescript
  registerPvpTeamMatchmakingHandlers(io, socket);
  registerPvpTeamBattleHandlers(io, socket);
  registerPvpTeamInviteHandlers(io, socket);
```

- [ ] **Step 5: Commit**

```bash
git add server/index.ts
git commit -m "Feat: Integra handlers PvP Team 2v2 no servidor Socket.io"
```

---

### Task 9: API Route — pvp-team/history

**Files:**
- Create: `app/api/battle/pvp-team/history/route.ts`

- [ ] **Step 1: Create history route**

```typescript
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  verifySession,
  AuthenticationError,
} from "@/lib/auth/verify-session";
import { apiSuccess, apiError } from "@/lib/api-response";

const PAGE_SIZE = 20;

type TeamBattleResult = "VICTORY" | "DEFEAT" | "DRAW";

type TeamBattleHistoryEntry = {
  id: string;
  result: TeamBattleResult;
  winnerTeam: number | null;
  myTeam: number;
  turns: number;
  teammates: string[];
  opponents: string[];
  createdAt: Date;
};

export async function GET(request: NextRequest) {
  try {
    const { userId } = await verifySession(request);

    const pageParam = request.nextUrl.searchParams.get("page");
    const page = Math.max(1, parseInt(pageParam ?? "1", 10) || 1);

    const where = {
      status: "FINISHED" as const,
      participants: {
        some: { userId },
      },
    };

    const [battles, total] = await Promise.all([
      prisma.teamBattle.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
        select: {
          id: true,
          winnerTeam: true,
          turns: true,
          createdAt: true,
          participants: {
            select: {
              userId: true,
              team: true,
              user: { select: { name: true } },
            },
          },
        },
      }),
      prisma.teamBattle.count({ where }),
    ]);

    const mapped: TeamBattleHistoryEntry[] = battles.map((battle) => {
      const myParticipant = battle.participants.find((p) => p.userId === userId);
      const myTeam = myParticipant?.team ?? 1;

      let result: TeamBattleResult;
      if (battle.winnerTeam === null) {
        result = "DRAW";
      } else if (battle.winnerTeam === myTeam) {
        result = "VICTORY";
      } else {
        result = "DEFEAT";
      }

      const teammates = battle.participants
        .filter((p) => p.team === myTeam && p.userId !== userId)
        .map((p) => p.user.name);

      const opponents = battle.participants
        .filter((p) => p.team !== myTeam)
        .map((p) => p.user.name);

      return {
        id: battle.id,
        result,
        winnerTeam: battle.winnerTeam,
        myTeam,
        turns: battle.turns,
        teammates,
        opponents,
        createdAt: battle.createdAt,
      };
    });

    return apiSuccess({
      battles: mapped,
      pagination: {
        page,
        pageSize: PAGE_SIZE,
        total,
        totalPages: Math.ceil(total / PAGE_SIZE),
      },
    });
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return apiError(error.message, error.code, error.statusCode);
    }

    console.error("[GET /api/battle/pvp-team/history]", error);
    return apiError("Erro interno do servidor", "INTERNAL_ERROR", 500);
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add app/api/battle/pvp-team/history/route.ts
git commit -m "Feat: Adiciona rota de historico de batalhas PvP Team 2v2"
```

---

### Task 10: Update CLAUDE.md files

**Files:**
- Modify: `lib/battle/CLAUDE.md`
- Modify: `server/CLAUDE.md`
- Modify: `prisma/CLAUDE.md`
- Modify: `app/api/CLAUDE.md`

- [ ] **Step 1: Update lib/battle/CLAUDE.md**

Adicionar ao final da tabela de arquivos:

```
| `pvp-team-types.ts` | Tipos para batalha PvP Team (2v2): `PvpTeamBattleState`, `PvpTeamAction`, `PvpTeamTurnResult`, `PvpTeamBattleConfig`, `PvpTeamBattleSession` |
| `pvp-team-turn.ts` | `initPvpTeamBattle()` e `resolvePvpTeamTurn()` — orquestrador do turno PvP Team 2v2. Usa adapters (BattleState fake) como coop-turn.ts. 4 jogadores (2 times de 2), turnos simultaneos, resolucao por prioridade > speed > random |
```

Adicionar secao "Batalha PvP Team (2v2)" com descricao do fluxo.

- [ ] **Step 2: Update server/CLAUDE.md**

Adicionar handlers, stores e eventos na documentacao.

- [ ] **Step 3: Update prisma/CLAUDE.md**

Adicionar `PvpStats`, `TeamBattle`, `TeamBattleParticipant`, `PvpMode` enum.

- [ ] **Step 4: Update app/api/CLAUDE.md**

Adicionar rota `/api/battle/pvp-team/history`.

- [ ] **Step 5: Commit**

```bash
git add lib/battle/CLAUDE.md server/CLAUDE.md prisma/CLAUDE.md app/api/CLAUDE.md
git commit -m "Docs: Atualiza CLAUDE.md com documentacao do PvP Team 2v2"
```
