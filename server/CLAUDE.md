# server/ — Servidor Socket.io

## Arquitetura

Servidor Node.js standalone (nao faz parte do Next.js). Roda na porta 3001. O Next.js se comunica com ele via HTTP interno quando necessario; o browser conecta diretamente via `NEXT_PUBLIC_SOCKET_URL`.

## Arquivo principal

`server/index.ts` — inicializa o servidor HTTP + Socket.io, registra handlers de eventos.

## Endpoints HTTP

### GET /health

Liveness probe para Railway / load balancer. Retorna `{ "status": "ok" }` com status 200. Sem autenticacao.

### POST /internal/notify

Emite evento Socket.io para um userId especifico. Autenticado via `Authorization: Bearer <SOCKET_INTERNAL_SECRET>`.

Payload: `{ targetUserId: string, event: string, payload: object }`

Usado pelo helper `lib/socket-emitter.ts` no lado do Next.js.

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
| `handlers/coop-pve-matchmaking.ts` | Fila e emparelhamento para Coop PvE 2v3/2v5 (2 players vs N mobs) |
| `handlers/coop-pve-battle.ts` | Acoes de batalha coop PvE, timer de turno, reconexao, persistencia |
| `handlers/coop-pve-invite.ts` | Convites de amigos para batalha coop PvE (send, accept, decline, online-check, disconnect cleanup) |

## Lib (helpers do servidor)

| Arquivo | Responsabilidade |
|---|---|
| `lib/prisma.ts` | Singleton do Prisma Client para o servidor Socket.io |
| `lib/convert-skills.ts` | `convertToEquippedSkills()`, `extractBaseStats()`, `CHARACTER_SKILLS_SELECT` — conversao de resultados Prisma para tipos da engine de batalha. Usado por `boss-matchmaking.ts` |

## Stores

| Arquivo | Responsabilidade |
|---|---|
| `stores/user-store.ts` | Mapa userId -> Set<socketId> para roteamento de eventos a usuarios online. Registrado/removido automaticamente em connect/disconnect |
| `stores/queue-store.ts` | Fila PvP in-memory (Map userId -> QueueEntry) |
| `stores/pvp-store.ts` | Batalhas PvP ativas in-memory (Map battleId -> PvpBattleSession) |
| `stores/boss-queue-store.ts` | Fila de boss fight in-memory por HabitCategory (Map category -> BossQueueEntry[]) |
| `stores/boss-battle-store.ts` | Batalhas coop ativas in-memory (Map battleId -> BossBattleSession). TTL 30min, cleanup 5min |
| `stores/coop-pve-queue-store.ts` | Fila de batalha coop PvE in-memory por modo (Map CoopPveMode -> CoopPveQueueEntry[]). Match de 2 jogadores no mesmo modo |
| `stores/coop-pve-battle-store.ts` | Batalhas coop PvE ativas in-memory (Map battleId -> CoopPveBattleSession). TTL 30min, cleanup 5min |
| `stores/coop-pve-invite-store.ts` | Convites pendentes de coop PvE in-memory (Map inviteId -> CoopPveInvite). TTL 30s por convite, 1 por sender |

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

### Coop PvE — Cliente -> Servidor

| Evento | Payload | Descricao |
|---|---|---|
| `coop-pve:queue:join` | `{ mode: "2v3" \| "2v5" }` | Entrar na fila de coop PvE |
| `coop-pve:queue:leave` | - | Sair da fila de coop PvE |
| `coop-pve:match:accept` | `{ battleId }` | Aceitar match de coop PvE |
| `coop-pve:match:decline` | `{ battleId }` | Recusar match de coop PvE |
| `coop-pve:battle:request-state` | - | Solicitar estado da batalha (ao carregar pagina) |
| `coop-pve:action` | `{ battleId, skillId, targetIndex?, targetId? }` | Escolher skill no turno |

### Coop PvE — Servidor -> Cliente

| Evento | Payload | Descricao |
|---|---|---|
| `coop-pve:queue:status` | `{ position, size, mode }` | Status da posicao na fila |
| `coop-pve:queue:error` | `{ message }` | Erro na fila coop PvE |
| `coop-pve:queue:timeout` | `{ message }` | Tempo na fila expirou (5min) |
| `coop-pve:queue:left` | `{ message }` | Confirmacao de saida da fila |
| `coop-pve:match:found` | `{ battleId, teammate, mobs, mode, acceptTimeoutMs }` | Match encontrado |
| `coop-pve:match:accepted` | `{ accepted, total }` | Contagem de aceites |
| `coop-pve:match:timeout` | `{ message }` | Tempo para aceitar expirou |
| `coop-pve:match:cancelled` | `{ message }` | Match cancelado (decline/disconnect) |
| `coop-pve:battle:start` | `{ battleId }` | Batalha iniciada |
| `coop-pve:battle:state` | `{ state, events }` | Estado apos turno (mobs sanitizados) |
| `coop-pve:battle:end` | `{ result }` | Batalha encerrada (VICTORY/DEFEAT) |
| `coop-pve:battle:error` | `{ message }` | Erro na batalha |
| `coop-pve:action:received` | `{ playerId, total, expected }` | Acao recebida de um jogador |
| `coop-pve:battle:player-disconnected` | `{ playerId, gracePeriodMs }` | Jogador desconectou |
| `coop-pve:battle:player-reconnected` | `{ playerId }` | Jogador reconectou |

### Coop PvE Invite — Cliente -> Servidor

| Evento | Payload | Descricao |
|---|---|---|
| `coop-pve:invite:send` | `{ targetUserId, mode: "2v3"\|"2v5" }` | Enviar convite para amigo |
| `coop-pve:invite:accept` | `{ inviteId }` | Aceitar convite (inicia batalha direto) |
| `coop-pve:invite:decline` | `{ inviteId }` | Recusar convite |
| `coop-pve:friends:online-check` | `{ userIds: string[] }` | Checar quais amigos estao online (max 50) |

### Coop PvE Invite — Servidor -> Cliente

| Evento | Payload | Descricao |
|---|---|---|
| `coop-pve:invite:received` | `{ inviteId, from: { userId, name }, mode }` | Convite recebido (para target) |
| `coop-pve:invite:sent` | `{ inviteId, targetUserId, mode }` | Confirmacao de envio (para sender) |
| `coop-pve:invite:declined` | `{ inviteId }` | Convite recusado (para sender) |
| `coop-pve:invite:expired` | `{ inviteId }` | Convite expirou (30s TTL) — emitido para ambos |
| `coop-pve:invite:error` | `{ message }` | Erro generico no fluxo de convite |

### Amizade — Servidor -> Cliente (via /internal/notify)

| Evento | Payload | Descricao |
|---|---|---|
| `friend:request-received` | `{ friendshipId, sender: { id, name, level } }` | Pedido de amizade recebido (emitido pela API route POST /api/friends/request) |
| `friend:request-accepted` | `{ friendshipId, friend: { id, name, level } }` | Pedido de amizade aceito (emitido pela API route PUT /api/friends/request/[id]/accept) |

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
| Turn timer (Coop PvE) | 30s | Auto-skip para quem nao enviou |
| Queue timeout (Coop PvE) | 5min | Remove jogador da fila |
| Match accept (Coop PvE) | 30s | Cancela match se ambos nao aceitaram |
| Reconnect grace (Coop PvE) | 30s | Se ambos desconectam -> derrota |
| Session TTL (Coop PvE) | 30min | Remove sessao inativa |
| Invite TTL (Coop PvE) | 30s | Convite expira automaticamente |

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
