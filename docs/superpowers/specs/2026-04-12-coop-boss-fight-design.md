# Boss Fight Cooperativo Diário — Design Spec

## Contexto

O Craft Mind tem dois loops de progressão: hábitos (pontos automáticos) e PvE (EXP + pontos livres). Atualmente não existe incentivo social — o jogador progride sozinho. O Boss Fight Cooperativo cria um evento diário que:
1. Recompensa jogadores que completam TODAS as metas do dia
2. Agrupa jogadores pela tag dominante dos hábitos, criando identidade coletiva
3. Introduz combate cooperativo (3v1) com estratégia real
4. Adiciona lore temática por categoria de hábito

## Visão Geral

Após completar todas as 5 metas diárias, o jogador desbloqueia acesso à Boss Fight do dia. O sistema identifica a **tag dominante** (categoria com mais tasks completadas) e coloca o jogador numa fila de matchmaking via Socket.io. Quando 3 jogadores da mesma tag se juntam, enfrentam juntos um boss com lore e skills temáticas. O combate é por turnos simultâneos em tempo real.

---

## 1. Elegibilidade e Tag Dominante

### Condição de acesso
- Jogador deve completar **todas as 5 DailyTasks** do dia
- Verificado via query: `DailyTask WHERE userId AND dueDate = today AND completed = true` → count === 5

### Cálculo da tag dominante
- Contar quantas tasks completadas pertencem a cada `HabitCategory` (via `Habit.category` do hábito vinculado)
- Categoria com maior contagem = tag dominante
- **Empate**: desempate aleatório entre as categorias empatadas

### Restrição
- O jogador só pode participar de **1 boss fight por dia** (mesmo que complete as metas cedo)
- Se o jogador já participou (win ou lose), não pode entrar na fila novamente naquele dia

---

## 2. Pool de Bosses

### Modelo Boss (novo)

Cada boss pertence a uma categoria de hábito e possui:
- `name` — nome único
- `description` — descrição visual/gameplay
- `lore` — texto narrativo temático (ex: "O Devorador de Mentes habita as profundezas da Biblioteca Proibida...")
- `category` — `HabitCategory` ao qual pertence
- `tier` — nível de dificuldade (1-5)
- `aiProfile` — perfil de IA (AGGRESSIVE, DEFENSIVE, TACTICAL, BALANCED)
- 6 stats base: `physicalAtk`, `physicalDef`, `magicAtk`, `magicDef`, `hp`, `speed`
- 4 skills equipadas (slots 0-3)

### Pool por categoria
- **2-3 bosses por categoria** (10-15 bosses total no lançamento)
- O sistema sorteia 1 boss do pool da categoria para cada batalha
- Stats dos bosses são significativamente maiores que mobs normais (precisam aguentar 3 players)

### Escalamento de stats do boss
Boss stats devem ser calibrados para 3 jogadores. Referência:
- HP do boss: ~3x o HP de um mob do mesmo tier (precisa sobreviver a 3 atacantes)
- Dano: similar a um mob forte (1 ação por turno, mas com skills AoE que atingem os 3)
- Defesa: alta o suficiente para que a batalha dure 10-20 turnos

### Skills do boss
- 4 skills, mix de:
  - 1-2 skills de dano AoE (`ALL_ENEMIES`) — atinge os 3 players
  - 1 skill de dano single-target forte (`SINGLE_ENEMY`)
  - 1 skill de suporte/buff (`SELF`)
- Podem usar skills existentes do pool de 49 ou skills exclusivas de boss (futuras)

---

## 3. Matchmaking (Socket.io)

### Fluxo completo

```
1. Player completa 5/5 tasks → UI mostra botão "Boss Fight"
2. Player clica → conecta Socket.io → entra na fila da tag dominante
3. Socket.io mantém filas por categoria (Map<HabitCategory, Player[]>)
4. Quando fila atinge 3 players:
   a. Emite boss:match:found para os 3 (30s para aceitar)
   b. Se todos aceitam → cria sala de batalha
   c. Se alguém recusa/timeout → quem aceitou volta pra fila
5. Sala criada → sorteia boss do pool → inicia batalha
```

### Eventos Socket.io

**Cliente → Servidor:**
| Evento | Payload | Descrição |
|---|---|---|
| `boss:queue:join` | `{ category: HabitCategory }` | Entra na fila |
| `boss:queue:leave` | — | Sai da fila |
| `boss:match:accept` | — | Aceita o match encontrado |
| `boss:match:decline` | — | Recusa o match |
| `boss:action` | `{ skillId: string \| null, targetId?: string }` | Ação do turno (targetId para SINGLE_ALLY) |

**Servidor → Cliente:**
| Evento | Payload | Descrição |
|---|---|---|
| `boss:queue:status` | `{ position: number, playersInQueue: number }` | Status da fila |
| `boss:match:found` | `{ players: PlayerPreview[], boss: BossPreview, timeToAccept: number }` | Match encontrado |
| `boss:match:cancelled` | `{ reason: string }` | Match cancelado (alguém recusou) |
| `boss:battle:start` | `{ battleId, boss, team, initialState }` | Batalha inicia |
| `boss:turn:waiting` | `{ timeRemaining: number }` | Aguardando ações dos players |
| `boss:turn:result` | `{ events: TurnLogEntry[], state: CoopBattleState }` | Resultado do turno |
| `boss:battle:end` | `{ result, expGained, rewards }` | Batalha terminou |

### Timeout da fila
- **5 minutos** de timeout. Se não encontrar 3 players em 5 min:
  - Servidor emite `boss:queue:timeout` com mensagem "Não foi possível encontrar jogadores suficientes"
  - Player é removido da fila automaticamente
  - Player pode entrar na fila novamente quantas vezes quiser (desde que ainda seja elegível)

### Fila em background
- O jogador pode navegar pelo app enquanto espera
- Notificação visual (badge/toast) quando match é encontrado
- Modal de aceitar sobrepõe qualquer tela

---

## 4. Engine de Combate Cooperativo

### Abordagem: engine separada, funções reutilizadas

Criar `resolveCoopTurn()` em `lib/battle/coop-turn.ts` — NÃO modifica o `resolveTurn()` existente.

### Tipos novos (`lib/battle/coop-types.ts`)

```typescript
type CoopBattleState = {
  battleId: string;
  turnNumber: number;
  team: PlayerState[];     // 3 players (reutiliza PlayerState existente)
  boss: PlayerState;       // boss como PlayerState (mesma estrutura)
  turnLog: TurnLogEntry[];
  status: "IN_PROGRESS" | "FINISHED";
  winnerId: string | null; // null = derrota, "team" = vitória
};

type CoopTurnAction = {
  playerId: string;
  skillId: string | null;
  targetId?: string;       // para SINGLE_ALLY (qual aliado buffar)
};

type CoopTurnResult = {
  state: CoopBattleState;
  events: TurnLogEntry[];
};
```

### Fluxo do turno (`resolveCoopTurn`)

```
1. Deep clone do estado
2. Coletar 3 ações dos players + 1 ação do boss (IA)
3. Ordenar as 4 ações por prioridade > speed > random
4. Para cada ação na ordem:
   a. Skip se batalha acabou ou ator está morto (HP ≤ 0)
   b. Checar incapacitação (STUN/FROZEN)
   c. Aplicar dano de status (BURN/POISON)
   d. Validar skill
   e. Resolver combo
   f. Check de accuracy
   g. Resolver targets (ver seção abaixo)
   h. Calcular e aplicar dano
   i. Processar counters
   j. Aplicar efeitos da skill
   k. Colocar skill em cooldown
   l. Checar fim de batalha
5. Tick de fim de turno (expirar buffs/status)
6. Tick de cooldowns
7. Checar mortes por ON_EXPIRE
8. Incrementar turno
```

### Target Resolution

**Boss atacando:**
| Skill Target | Resolução |
|---|---|
| `SINGLE_ENEMY` | IA escolhe 1 player vivo (lowest HP, ou sem buffs defensivos) |
| `ALL_ENEMIES` | Atinge todos os players vivos |
| `SELF` | Boss |
| `SINGLE_ALLY` | Boss (só tem ele no "time") |
| `ALL_ALLIES` | Boss |

**Player atacando:**
| Skill Target | Resolução |
|---|---|
| `SINGLE_ENEMY` | Sempre o boss (único inimigo) |
| `ALL_ENEMIES` | Boss |
| `SELF` | O próprio player |
| `SINGLE_ALLY` | Player escolhe qual aliado (via `targetId` na ação) |
| `ALL_ALLIES` | Todos os 3 players vivos |
| `ALL` | Boss + todos os 3 players |

### Funções reutilizadas (sem alteração)
- `calculateDamage()` — dano por hit
- `applyEffects()` — aplicar os 12 tipos de efeito
- `isIncapacitated()` — checar STUN/FROZEN
- `applyStatusDamage()` — dano de BURN/POISON
- `tickEndOfTurn()` — expirar buffs/status
- `getComboModifier()` — escala de combo
- `putOnCooldown()` / `tickCooldowns()` — cooldowns
- `scoreSkill()` / `chooseAction()` — IA do boss

### Player morto
- Player com HP ≤ 0 não age mais e não é alvo válido de `SINGLE_ENEMY`
- Aliados podem reviver com uma **skill de REVIVE** (efeito novo, separado de HEAL). HEAL cura players vivos; REVIVE ressuscita players mortos. Se nenhuma skill de revive existir no loadout do time, o player fica morto até o fim. Skills de revive serão adicionadas ao pool no futuro (novo effect type `REVIVE` com campo `hpPercent` indicando % de HP máximo com que o player volta).
- Se todos os 3 players morrerem → derrota

### Condições de fim
- **Vitória**: boss HP ≤ 0
- **Derrota**: todos os 3 players HP ≤ 0
- **Draw**: 200 turnos sem resolução (improvável com 3v1)

---

## 5. Timer e Sincronização

- **30 segundos** por turno para os 3 players escolherem ações
- Socket.io emite `boss:turn:waiting` com countdown
- Quando todos os players vivos enviarem ação OU timer expirar:
  - Players que não escolheram → auto-skip
  - Boss escolhe via IA
  - `resolveCoopTurn()` executa
  - Resultado emitido via `boss:turn:result`
- Se um player desconectar:
  - 60s para reconectar (mantém na batalha)
  - Após 60s: auto-skip em todos os turnos restantes (não é expulso, só perde ações)

---

## 6. Recompensas

### Vitória
- **EXP bônus**: `floor(bossExpBase * 1.5)` — 50% mais que um mob equivalente
  - `bossExpBase` = mesmo cálculo de mob: `floor((soma stats com hp/10) / 6)`
- **Essência de Boss**: 1 unidade por vitória
  - Novo campo no Character: `bossEssence: Int @default(0)`
  - Uso futuro: shop de itens, cosmetics, upgrades (a definir em spec separada)
- Todos os 3 players recebem a mesma recompensa (sem competição interna)

### Derrota
- 0 EXP, 0 essência
- Sem punição. Pode tentar novamente no dia seguinte.

### Restrição diária
- 1 boss fight por dia por jogador (win ou lose)

---

## 7. Schema Prisma (novos models)

```prisma
model Boss {
  id          String        @id @default(cuid())
  name        String        @unique
  description String
  lore        String
  category    HabitCategory
  tier        Int
  aiProfile   String

  physicalAtk Int
  physicalDef Int
  magicAtk    Int
  magicDef    Int
  hp          Int
  speed       Int

  skills       BossSkill[]
  coopBattles  CoopBattle[]

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

model BossSkill {
  id        String @id @default(cuid())
  bossId    String
  skillId   String
  slotIndex Int

  boss  Boss  @relation(fields: [bossId], references: [id], onDelete: Cascade)
  skill Skill @relation(fields: [skillId], references: [id])

  @@unique([bossId, skillId])
  @@unique([bossId, slotIndex])
}

model CoopBattle {
  id        String   @id @default(cuid())
  bossId    String
  date      DateTime @db.Date
  status    String   @default("MATCHING") // MATCHING, IN_PROGRESS, FINISHED, CANCELLED
  result    String?  // VICTORY, DEFEAT, DRAW
  turns     Int      @default(0)
  expGained Int      @default(0)
  log       Json     @default("[]")

  boss         Boss                    @relation(fields: [bossId], references: [id])
  participants CoopBattleParticipant[]

  @@index([date, status])

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

model CoopBattleParticipant {
  id               String        @id @default(cuid())
  coopBattleId     String
  userId           String
  dominantCategory HabitCategory

  coopBattle CoopBattle @relation(fields: [coopBattleId], references: [id], onDelete: Cascade)
  user       User       @relation(fields: [userId], references: [id])

  @@unique([coopBattleId, userId])
  @@index([userId])

  createdAt DateTime @default(now())
}
```

**Relações novas em models existentes:**
- `Skill` ganha `bossSkills BossSkill[]`
- `User` ganha `coopParticipations CoopBattleParticipant[]`

---

## 8. Estrutura de Arquivos (novos)

```
lib/battle/
  coop-types.ts          — CoopBattleState, CoopTurnAction, CoopTurnResult
  coop-turn.ts           — resolveCoopTurn() (engine cooperativa)
  coop-store.ts          — store em memória para batalhas coop ativas
  coop-target.ts         — resolução de targets para multi-player

server/
  boss-queue.ts          — filas de matchmaking por categoria
  boss-battle.ts         — handlers Socket.io para boss fight

app/api/battle/coop/
  eligible/route.ts      — GET: verifica se player pode entrar na boss fight
  history/route.ts       — GET: histórico de boss fights

prisma/
  seed-bosses.ts         — seed dos bosses iniciais (importado pelo seed.ts)
```

---

## 9. Verificação e Testes

### Testes unitários
- `resolveCoopTurn()` — cenários: 3v1 básico, player morre, boss morre, AoE em 3 targets, heal em aliado, empate de speed
- Target resolution — todos os 6 target types com 3 players
- Cálculo de tag dominante — empate, maioria clara, todas iguais
- EXP e recompensas — cálculo de essência

### Testes de integração
- Fluxo completo: completar 5 tasks → verificar elegibilidade → entrar na fila
- Socket.io: join queue → match found → accept → battle start
- Persistência: CoopBattle + CoopBattleParticipant criados corretamente

### Teste manual
- 3 tabs do browser, 3 usuários diferentes
- Completar tasks → entrar na fila → aceitar match → jogar turnos → verificar resultado
