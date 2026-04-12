# API Routes PvE + Distribuicao de Pontos

## Contexto

Backend completo: combat engine, IA, mobs, EXP/level. Falta conectar tudo via API routes para o frontend consumir.

## Decisoes

- Model PveBattle separado do Battle (PvP)
- Estado em memoria durante a batalha, salva no banco so ao fim
- PvE nao precisa de Socket.io (HTTP simples, turno a turno)

## 1. Model PveBattle (Prisma)

```prisma
model PveBattle {
  id        String  @id @default(cuid())
  userId    String
  mobId     String
  result    String?  // "VICTORY" | "DEFEAT" | "DRAW" | null (em andamento)
  expGained Int     @default(0)
  turns     Int     @default(0)
  log       Json    @default("[]")

  user User @relation(fields: [userId], references: [id])
  mob  Mob  @relation(fields: [mobId], references: [id])

  createdAt DateTime @default(now())
}
```

Relacoes reversas: `pveBattles PveBattle[]` em User e Mob.

## 2. Estado em memoria

```ts
// lib/battle/pve-store.ts
type PveBattleSession = {
  state: BattleState
  mobProfile: AiProfile
  mobId: string
  userId: string
}

const activeBattles = new Map<string, PveBattleSession>()
```

Funcoes: get, set, remove, hasActiveBattle(userId).

## 3. Endpoints

### POST /api/battle/pve/start
- Auth: verifySession
- Valida: jogador nao tem batalha ativa
- Matchmaking: getPlayerTier → rollMobTier → query mob aleatorio do tier
- Carrega character + equipped skills
- initBattle() → salva na memoria
- Response: { battleId, mob: { name, description, tier, hp, aiProfile }, player: { hp, skills }, state parcial }

### POST /api/battle/pve/action
- Auth: verifySession
- Body Zod: { battleId: string, skillId: string | null }
- Valida: batalha existe, pertence ao user, esta IN_PROGRESS
- chooseAction() para mob
- resolveTurn() com ambas acoes
- Se batalha terminou:
  - Calcula EXP (calculateMobExp → calculateExpGained)
  - processLevelUp se necessario
  - Atualiza Character no banco (currentExp, level, freePoints)
  - Salva PveBattle no banco
  - Remove da memoria
- Response: { events[], playerHp, mobHp, battleOver, result?, expGained?, levelsGained?, newLevel? }

### GET /api/battle/pve/state
- Auth: verifySession
- Query: battleId
- Retorna estado atual da memoria (HP, cooldowns, status, buffs, skills disponiveis)

### POST /api/character/distribute-points
- Auth: verifySession
- Body Zod: { distribution: Record<string, number> } (ex: { physicalAtk: 2, hp: 3 })
- distributePoints() para validar
- Atualiza Character no banco
- Response: { character atualizado }

### GET /api/battle/pve/history
- Auth: verifySession
- Query: page? (default 1)
- Ultimas 20 batalhas do jogador
- Response: { battles: [{ id, mobName, result, expGained, turns, createdAt }] }

## 4. Validacoes Zod

```ts
// lib/validations/battle.ts
startPveBattleSchema = {} // sem body necessario
pveBattleActionSchema = { battleId: string, skillId: string.nullable() }
distributePointsSchema = { distribution: record(string, number.int().positive()) }
```

## 5. Fora do escopo

- Frontend
- PvP (Socket.io)
- Rate limiting em batalha (futuro)
- Abandonar batalha (futuro — por agora, batalha fica na memoria ate timeout ou restart)
