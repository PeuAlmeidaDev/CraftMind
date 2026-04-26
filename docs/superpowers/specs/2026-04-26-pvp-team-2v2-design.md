# PvP Team 2v2 — Design Spec

**Data:** 2026-04-26
**Status:** Aprovado

## Resumo

PvP 2v2 onde 2 jogadores enfrentam 2 jogadores em turnos simultâneos. Cada jogador controla 1 personagem. Sem EXP — apenas W/L/D e ranking points.

## 1. Modelos Prisma

### PvpMode (enum)

```
SOLO_1V1, TEAM_2V2, TEAM_3V3, TEAM_5V5
```

### PvpStats

Stats de PvP separados por modo, vinculados ao Character.

| Campo | Tipo | Descrição |
|-------|------|-----------|
| id | String @id @default(cuid()) | |
| characterId | String | FK para Character |
| mode | PvpMode | Modo de jogo |
| wins | Int @default(0) | Vitórias |
| losses | Int @default(0) | Derrotas |
| draws | Int @default(0) | Empates |
| rankingPoints | Int @default(0) | Pontos de ranking (mínimo 0) |
| createdAt | DateTime @default(now()) | |
| updatedAt | DateTime @updatedAt | |

`@@unique([characterId, mode])` — 1 registro por modo por jogador.

### TeamBattle

Registro da partida em equipe.

| Campo | Tipo | Descrição |
|-------|------|-----------|
| id | String @id @default(cuid()) | |
| mode | PvpMode | Modo (TEAM_2V2 por agora) |
| winnerTeam | Int? | 1, 2 ou null (empate) |
| status | BattleStatus | IN_PROGRESS, FINISHED, CANCELLED |
| turns | Int @default(0) | Total de turnos |
| log | Json | Turn log completo |
| createdAt | DateTime @default(now()) | |
| finishedAt | DateTime? | |

### TeamBattleParticipant

Jogador participante da partida.

| Campo | Tipo | Descrição |
|-------|------|-----------|
| id | String @id @default(cuid()) | |
| teamBattleId | String | FK para TeamBattle |
| userId | String | FK para User |
| team | Int | 1 ou 2 |
| characterId | String | FK para Character |

## 2. Engine de combate

### Arquivo: `lib/battle/pvp-team-turn.ts`

**Estado:**

```typescript
type PvpTeamBattleState = {
  battleId: string;
  turnNumber: number;
  team1: PlayerState[];  // 2 jogadores
  team2: PlayerState[];  // 2 jogadores
  mode: "TEAM_2V2";
  turnLog: TurnLogEntry[];
  status: "IN_PROGRESS" | "FINISHED";
  winnerTeam: 1 | 2 | null;
};
```

### Função: `resolvePvpTeamTurn(state, actions[])`

1. Recebe 4 ações (1 por jogador vivo, null para skip/autoSkip)
2. Ordena por prioridade > speed > random (mesma lógica existente)
3. Para cada ação:
   - Checagem de incapacitação (STUN/FROZEN)
   - Aplica status damage (BURN/POISON)
   - Valida skill (existe, equipada, não em cooldown)
   - Resolve combo state
   - Checa accuracy
   - Calcula dano via `calculateDamage()`
   - Resolve targets conforme `skill.target`:
     - `SELF` → caster
     - `SINGLE_ALLY` → aliado escolhido (via targetIndex)
     - `ALL_ALLIES` → ambos do time
     - `SINGLE_ENEMY` → inimigo escolhido (via targetIndex)
     - `ALL_ENEMIES` → ambos do time oposto
     - `ALL` → todos os 4
   - Aplica efeitos via `applyEffects()`
   - Coloca skill em cooldown
   - Processa counter-attacks
4. `tickEndOfTurn()` em todos os vivos
5. `tickCooldowns()` em todos os vivos
6. Checa ON_EXPIRE deaths
7. Condições de fim:
   - Todos de um time HP <= 0 → outro time vence (`winnerTeam = 1 ou 2`)
   - MAX_TURNS (50) atingido → empate (`winnerTeam = null`)
8. Incrementa `turnNumber`

### Arquivo: `lib/battle/pvp-team-types.ts`

Tipos: `PvpTeamBattleState`, `PvpTeamAction`, `PvpTeamTurnResult`.

## 3. Matchmaking

### Arquivo: `server/stores/pvp-team-queue-store.ts`

Duas filas in-memory:

- **soloQueue:** jogadores individuais
- **duoQueue:** duplas pré-formadas

### Arquivo: `server/handlers/pvp-team-matchmaking.ts`

**Fila solo:**
1. Jogador emite `pvp-team:queue:join` com `{ characterId }`
2. Servidor valida stats/skills no banco (nunca confia no client)
3. Adiciona à fila solo
4. Quando 4 jogadores: shuffle + split em 2 times de 2
5. Emite `pvp-team:match:found` com info dos times
6. 30s para aceitar (`pvp-team:match:accept`)
7. Todos aceitam → cria batalha
8. Algum recusa/timeout → cancela, restantes voltam à fila

**Fila de dupla:**
1. Dupla formada via convite entra na fila como unidade
2. Quando 2 duplas: emparelha
3. Mesma confirmação de 30s

**Eventos:**
- `pvp-team:queue:join` — entrar na fila solo
- `pvp-team:queue:leave` — sair da fila
- `pvp-team:match:found` — match encontrado (server → client)
- `pvp-team:match:accept` — aceitar match
- `pvp-team:match:decline` — recusar match
- `pvp-team:match:cancelled` — match cancelado (server → client)

**Validações:**
- Não pode estar em outra batalha ativa (checa via active-battle)
- Não pode estar em outra fila

## 4. Convite de dupla

### Arquivo: `server/handlers/pvp-team-invite.ts`

Reutiliza o mesmo padrão do `coop-pve-invite.ts`:

1. Jogador emite `pvp-team:invite:send` com `{ friendId }`
2. Valida amizade no banco
3. Amigo recebe `pvp-team:invite:received`
4. Aceita → dupla entra na fila de duplas
5. Recusa → emissor notificado via `pvp-team:invite:declined`

**Eventos:**
- `pvp-team:invite:send` — enviar convite
- `pvp-team:invite:received` — convite recebido (server → convidado)
- `pvp-team:invite:accept` — aceitar convite
- `pvp-team:invite:decline` — recusar convite
- `pvp-team:invite:declined` — convite recusado (server → emissor)
- `pvp-team:invite:cancelled` — convite cancelado

## 5. Handlers de batalha

### Store: `server/stores/pvp-team-store.ts`

```typescript
type PvpTeamBattleSession = {
  state: PvpTeamBattleState;
  playerSockets: Map<string, string>;  // userId → socketId (4 entries)
  pendingActions: Map<string, PvpTeamAction>;  // userId → action
  turnTimer: ReturnType<typeof setTimeout> | null;
  disconnectedPlayers: Map<string, {
    disconnectTimer: ReturnType<typeof setTimeout>;
    gracePeriodMs: number;
  }>;
  autoSkipPlayers: Set<string>;  // userIds que desconectaram permanentemente
};
```

### Arquivo: `server/handlers/pvp-team-battle.ts`

**Turno:**
1. Timer de 30s por turno
2. Jogador envia `pvp-team:battle:action` com `{ battleId, skillId, targetIndex? }`
3. Armazena em `pendingActions`
4. Jogadores em `autoSkipPlayers` recebem `null` automaticamente
5. Quando 4 ações coletadas → `resolvePvpTeamTurn()`
6. Emite `pvp-team:battle:state` sanitizado para cada jogador
7. Se FINISHED → persiste resultado

**Sanitização:**
- Jogador vê seu time completo (buffs, cooldowns, combo, stages)
- Time inimigo: só `currentHp`, `statusEffects`, `baseStats`

**Desconexão:**
1. Jogador desconecta → 30s grace period
2. Reconecta → volta ao normal, recebe estado atualizado
3. Não reconecta → adicionado a `autoSkipPlayers`, faz skip todo turno
4. Time continua 1v2
5. Ambos do mesmo time desconectam → derrota do time

**Eventos:**
- `pvp-team:battle:action` — enviar ação
- `pvp-team:battle:state` — estado atualizado (server → client)
- `pvp-team:battle:end` — batalha finalizada (server → client)
- `pvp-team:battle:player-disconnected` — jogador desconectou
- `pvp-team:battle:player-reconnected` — jogador reconectou

## 6. Persistência e Ranking

**Ao finalizar (fire-and-forget com transaction):**

1. Criar `TeamBattle` com mode, winnerTeam, turns, log
2. Criar 4 `TeamBattleParticipant`
3. Upsert `PvpStats` de cada jogador (por `characterId + TEAM_2V2`):
   - Vitória: `wins += 1`, `rankingPoints += 25`
   - Derrota: `losses += 1`, `rankingPoints -= 15` (mínimo 0)
   - Empate: `draws += 1`, `rankingPoints += 5`

**Sem EXP** — nenhuma batalha PvP concede EXP.

## 7. API Routes

| Rota | Método | Descrição |
|------|--------|-----------|
| `/api/battle/pvp-team/history` | GET | Histórico paginado de batalhas 2v2 |

## 8. Arquivos novos

| Camada | Arquivo |
|--------|---------|
| Prisma | `PvpStats`, `TeamBattle`, `TeamBattleParticipant`, `PvpMode` enum (em schema.prisma) |
| Engine | `lib/battle/pvp-team-turn.ts` |
| Types | `lib/battle/pvp-team-types.ts` |
| Store | `server/stores/pvp-team-store.ts` |
| Queue | `server/stores/pvp-team-queue-store.ts` |
| Handlers | `server/handlers/pvp-team-matchmaking.ts` |
| Handlers | `server/handlers/pvp-team-battle.ts` |
| Handlers | `server/handlers/pvp-team-invite.ts` |
| API | `app/api/battle/pvp-team/history/route.ts` |
| Server | Registro dos novos handlers em `server/index.ts` |
