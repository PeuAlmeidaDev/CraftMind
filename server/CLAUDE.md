# server/ — Servidor Socket.io

## Arquitetura

Servidor Node.js standalone (nao faz parte do Next.js). Roda na porta 3001. O Next.js se comunica com ele via HTTP interno quando necessario; o browser conecta diretamente via `NEXT_PUBLIC_SOCKET_URL`.

## Arquivo principal

`server/index.ts` — inicializa o servidor HTTP + Socket.io, registra handlers de eventos.

## Autenticacao de conexao

Toda conexao deve enviar o `access_token` no handshake:

```ts
// cliente
const socket = io(SOCKET_URL, { auth: { token: accessToken } })

// servidor — middleware obrigatorio antes de aceitar qualquer evento
io.use((socket, next) => {
  const token = socket.handshake.auth.token
  const payload = verifyToken(token) // usa jsonwebtoken (Node puro)
  if (!payload) return next(new Error('Unauthorized'))
  socket.data.userId = payload.userId
  next()
})
```

## Handlers

| Arquivo | Responsabilidade |
|---|---|
| `handlers/matchmaking.ts` | Fila e emparelhamento PvP 1v1 |
| `handlers/battle.ts` | Acoes de batalha PvP, timer de turno, reconexao, persistencia |
| `handlers/boss-matchmaking.ts` | Fila e emparelhamento para Boss Fight 3v1 por HabitCategory |
| `handlers/boss-battle.ts` | Acoes de boss battle, timer de turno, reconexao, persistencia coop |

## Lib (helpers do servidor)

| Arquivo | Responsabilidade |
|---|---|
| `lib/prisma.ts` | Singleton do Prisma Client para o servidor Socket.io |
| `lib/convert-skills.ts` | `convertToEquippedSkills()`, `extractBaseStats()`, `CHARACTER_SKILLS_SELECT` — conversao de resultados Prisma para tipos da engine de batalha. Usado por `boss-matchmaking.ts` |

## Stores

| Arquivo | Responsabilidade |
|---|---|
| `stores/queue-store.ts` | Fila PvP in-memory (Map userId -> QueueEntry) |
| `stores/pvp-store.ts` | Batalhas PvP ativas in-memory (Map battleId -> PvpBattleSession) |
| `stores/boss-queue-store.ts` | Fila de boss fight in-memory por HabitCategory (Map category -> BossQueueEntry[]) |
| `stores/boss-battle-store.ts` | Batalhas coop ativas in-memory (Map battleId -> BossBattleSession). TTL 30min, cleanup 5min |

## Eventos disponiveis

### PvP — Cliente -> Servidor

| Evento | Payload | Descricao |
|---|---|---|
| `matchmaking:join` | `{ characterId, stats, skills }` | Entrar na fila PvP |
| `matchmaking:cancel` | - | Sair da fila PvP |
| `battle:action` | `{ battleId, skillId }` | Escolher habilidade no turno PvP |

### PvP — Servidor -> Cliente

| Evento | Payload | Descricao |
|---|---|---|
| `matchmaking:waiting` | `{ message }` | Aguardando oponente na fila |
| `matchmaking:found` | `{ battleId }` | Match PvP encontrado |
| `matchmaking:error` | `{ message }` | Erro no matchmaking |
| `battle:state` | `{ state, events }` | Estado da batalha apos turno |
| `battle:end` | `{ winnerId }` | Batalha PvP encerrada |
| `battle:player-disconnected` | `{ playerId, gracePeriodMs }` | Jogador desconectou |
| `battle:player-reconnected` | `{ playerId }` | Jogador reconectou |

### Boss Fight — Cliente -> Servidor

| Evento | Payload | Descricao |
|---|---|---|
| `boss:queue:join` | `{ category: HabitCategory }` | Entrar na fila de boss fight |
| `boss:queue:leave` | - | Sair da fila de boss fight |
| `boss:match:accept` | `{ battleId }` | Aceitar match de boss fight |
| `boss:match:decline` | `{ battleId }` | Recusar match de boss fight |
| `boss:action` | `{ battleId, skillId, targetId? }` | Escolher habilidade no turno coop |

### Boss Fight — Servidor -> Cliente

| Evento | Payload | Descricao |
|---|---|---|
| `boss:queue:status` | `{ position, size, category }` | Status da posicao na fila |
| `boss:queue:error` | `{ message }` | Erro na fila de boss |
| `boss:queue:timeout` | `{ message }` | Tempo na fila expirou (5min) |
| `boss:queue:left` | `{ message }` | Confirmacao de saida da fila |
| `boss:match:found` | `{ battleId, boss, teammates, acceptTimeoutMs }` | Match encontrado, aguardando aceite |
| `boss:match:accepted` | `{ accepted, total }` | Contagem de aceites |
| `boss:match:timeout` | `{ message }` | Tempo para aceitar expirou |
| `boss:match:cancelled` | `{ message }` | Match cancelado (decline ou disconnect) |
| `boss:battle:start` | `{ battleId, state }` | Batalha iniciada (estado sanitizado) |
| `boss:battle:state` | `{ state, events }` | Estado apos turno (boss sanitizado) |
| `boss:battle:end` | `{ result, winnerId }` | Boss battle encerrada |
| `boss:battle:error` | `{ message }` | Erro na boss battle |
| `boss:action:received` | `{ playerId, total, expected }` | Acao recebida de um jogador |
| `boss:battle:player-disconnected` | `{ playerId, gracePeriodMs }` | Jogador desconectou da boss battle |
| `boss:battle:player-reconnected` | `{ playerId }` | Jogador reconectou na boss battle |

## Timers

| Timer | Duracao | Descricao |
|---|---|---|
| Turn timer (PvP) | 30s | Auto-skip se jogador nao enviou acao |
| Turn timer (Boss) | 30s | Auto-skip para quem nao enviou |
| Queue timeout (Boss) | 5min | Remove jogador da fila |
| Match accept (Boss) | 30s | Cancela match se nem todos aceitaram |
| Reconnect grace (PvP) | 30s | Derrota por WO se nao reconectar |
| Reconnect grace (Boss) | 30s | Batalha continua com os outros 2 |
| Session TTL (Boss) | 30min | Remove sessao inativa |

## Fluxo da Boss Fight

1. Jogador completa 5 tarefas diarias da categoria dominante
2. Entra na fila via `boss:queue:join` com a categoria
3. Servidor verifica elegibilidade (tarefas, categoria dominante, participacao diaria)
4. Ao reunir 3 jogadores na mesma categoria, sorteia boss do banco
5. Emite `boss:match:found` — jogadores tem 30s para aceitar
6. Se todos aceitam: cria sala, persiste no banco, inicia batalha
7. Cada turno: 3 acoes dos jogadores + acao do boss via IA
8. Victoria (boss HP <= 0): EXP * 1.5 + bossEssence para cada player
9. Derrota (time morreu ou MAX_TURNS): 0 EXP

## Regras de seguranca

- Validar payload de todos os eventos recebidos com type guards manuais (nao Zod).
- Verificar que `socket.data.userId` e participante da batalha antes de processar acoes.
- Stats e skills sempre verificados no banco via Prisma — nunca confiar no client.
- Nunca emitir dados de um jogador para o socket do outro sem verificacao explicita.
- Boss: esconder stages, buffs internos, cooldowns e combo do time (sanitizacao).
- Persistir resultado final da batalha no banco via Prisma (fire-and-forget com .catch).
