# server/ — Servidor Socket.io

## Arquitetura

Servidor Node.js standalone (nao faz parte do Next.js). Roda na porta 3001. O Next.js se comunica com ele via HTTP interno quando necessario; o browser conecta diretamente via `NEXT_PUBLIC_SOCKET_URL`.

## Arquivo principal

`server/index.ts` — inicializa o servidor HTTP + Socket.io, registra handlers de eventos.

## Endpoints HTTP

### GET /health

Liveness probe para Railway / load balancer. Retorna `{ "status": "ok" }` com status 200. Sem autenticacao.

### GET /internal/active-battle

Consulta se um usuario tem batalha ativa em qualquer store do servidor Socket.io (PvP, Boss, Coop PvE, PvP Team). Autenticado via `Authorization: Bearer <SOCKET_INTERNAL_SECRET>`.

Query param: `userId=<string>`

Resposta: `{ hasBattle: true, battleType: "pvp"|"boss"|"coop-pve"|"pvp-team", battleId: string }` ou `{ hasBattle: false }`

Usado pela API route `GET /api/battle/active` no Next.js.

### GET /internal/online-check

Consulta status online de multiplos usuarios via user-store. Autenticado via `Authorization: Bearer <SOCKET_INTERNAL_SECRET>`.

Query param: `userIds=id1,id2,id3` (max 50)

Resposta: `{ statuses: { [userId]: boolean } }`

Usado pela API route `GET /api/friends/online` no Next.js. Substituiu o mecanismo Socket.io `coop-pve:friends:online-check` no frontend para maior confiabilidade.

### POST /internal/notify

Emite evento Socket.io para um userId especifico. Autenticado via `Authorization: Bearer <SOCKET_INTERNAL_SECRET>`.

Payload: `{ targetUserId: string, event: string, payload: object }`

Usado pelo helper `lib/socket-emitter.ts` no lado do Next.js.

### POST /internal/broadcast-spectral

Broadcast global (`io.emit`) para TODOS os sockets conectados. Autenticado via `Authorization: Bearer <SOCKET_INTERNAL_SECRET>`.

Payload: `{ event: string, payload: object }`

Usado pelo helper `broadcastGlobal()` em `lib/socket-emitter.ts`. Atualmente disparado pelo evento `global:spectral-drop` quando alguem dropa um Cristal Espectral (purity 100) via API route do Next.js. O servidor Socket.io tambem emite o mesmo evento direto via `io.emit` quando o drop acontece dentro de um handler (ex: `coop-pve-battle.ts persistCoopPveResult`), evitando o roundtrip HTTP.

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
| `handlers/coop-pve-matchmaking.ts` | Fila e emparelhamento para Coop PvE 2v3/2v5/3v5 (2-3 players vs N mobs, stat scaling 3v5) |
| `handlers/coop-pve-battle.ts` | Acoes de batalha coop PvE (2v3/2v5/3v5), timer de turno, reconexao, persistencia |
| `handlers/coop-pve-invite.ts` | Convites de amigos para batalha coop PvE (send, accept, decline, online-check, disconnect cleanup) |
| `handlers/pvp-team-matchmaking.ts` | Fila solo e emparelhamento para PvP Team 2v2 (4 jogadores, shuffle + split em 2 times) |
| `handlers/pvp-team-battle.ts` | Acoes de batalha PvP Team 2v2, timer de turno, reconexao, auto-skip, persistencia (ranking points) |
| `handlers/pvp-team-invite.ts` | Convites de amigos para formar dupla PvP Team (send, accept -> duo queue, decline, online-check) |

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
| `stores/coop-pve-queue-store.ts` | Fila de batalha coop PvE in-memory por modo (Map CoopPveMode -> CoopPveQueueEntry[]). Match de 2 jogadores (2v3/2v5) ou 3 jogadores (3v5) no mesmo modo |
| `stores/coop-pve-battle-store.ts` | Batalhas coop PvE ativas in-memory (Map battleId -> CoopPveBattleSession). TTL 30min, cleanup 5min |
| `stores/coop-pve-invite-store.ts` | Convites pendentes de coop PvE in-memory (Map inviteId -> CoopPveInvite). TTL 30s por convite, 1 por sender |
| `stores/pvp-team-queue-store.ts` | Filas de PvP Team in-memory: soloQueue (jogadores individuais) e duoQueue (duplas pre-formadas). Match quando 4 na solo ou 2 duplas na duo |
| `stores/pvp-team-battle-store.ts` | Batalhas PvP Team ativas in-memory (Map battleId -> PvpTeamBattleSession). TTL 30min, cleanup 5min |
| `stores/pvp-team-invite-store.ts` | Convites pendentes de PvP Team duo in-memory (Map inviteId -> PvpTeamInvite). TTL 30s, 1 por sender |

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
| `coop-pve:queue:join` | `{ mode: "2v3" \| "2v5" \| "3v5" }` | Entrar na fila de coop PvE |
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
| `coop-pve:match:found` | `{ battleId, teammates, teammate, mobs, mode, acceptTimeoutMs }` | Match encontrado (teammates: array, teammate: primeiro para compatibilidade) |
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

### PvP Team — Cliente -> Servidor

| Evento | Payload | Descricao |
|---|---|---|
| `pvp-team:queue:join` | - | Entrar na fila solo PvP Team 2v2 |
| `pvp-team:queue:leave` | - | Sair da fila |
| `pvp-team:match:accept` | `{ battleId }` | Aceitar match PvP Team |
| `pvp-team:match:decline` | `{ battleId }` | Recusar match PvP Team |
| `pvp-team:battle:request-state` | - | Solicitar estado da batalha (ao carregar pagina) |
| `pvp-team:battle:action` | `{ battleId, skillId, targetIndex?, targetId? }` | Escolher skill no turno |

### PvP Team — Servidor -> Cliente

| Evento | Payload | Descricao |
|---|---|---|
| `pvp-team:queue:status` | `{ position, size }` | Status da posicao na fila |
| `pvp-team:queue:error` | `{ message }` | Erro na fila PvP Team |
| `pvp-team:queue:timeout` | `{ message }` | Tempo na fila expirou (5min) |
| `pvp-team:queue:left` | `{ message }` | Confirmacao de saida da fila |
| `pvp-team:match:found` | `{ battleId, myTeam, teammates, opponents, acceptTimeoutMs }` | Match encontrado |
| `pvp-team:match:accepted` | `{ accepted, total }` | Contagem de aceites |
| `pvp-team:match:timeout` | `{ message }` | Tempo para aceitar expirou |
| `pvp-team:match:cancelled` | `{ message }` | Match cancelado (decline/disconnect) |
| `pvp-team:battle:start` | `{ battleId }` | Batalha iniciada |
| `pvp-team:battle:state` | `{ state, events }` | Estado apos turno (inimigos sanitizados) |
| `pvp-team:battle:end` | `{ winnerTeam }` | Batalha encerrada (1, 2 ou null=empate) |
| `pvp-team:battle:error` | `{ message }` | Erro na batalha |
| `pvp-team:action:received` | `{ playerId, total, expected }` | Acao recebida de um jogador |
| `pvp-team:battle:player-disconnected` | `{ playerId, gracePeriodMs }` | Jogador desconectou |
| `pvp-team:battle:player-reconnected` | `{ playerId }` | Jogador reconectou |
| `pvp-team:battle:player-auto-skip` | `{ playerId, message }` | Jogador marcado como auto-skip permanente |

### PvP Team Invite — Cliente -> Servidor

| Evento | Payload | Descricao |
|---|---|---|
| `pvp-team:invite:send` | `{ targetUserId }` | Enviar convite para amigo |
| `pvp-team:invite:accept` | `{ inviteId }` | Aceitar convite (dupla entra na duo queue) |
| `pvp-team:invite:decline` | `{ inviteId }` | Recusar convite |
| `pvp-team:friends:online-check` | `{ userIds: string[] }` | Checar quais amigos estao online (max 50) |

### PvP Team Invite — Servidor -> Cliente

| Evento | Payload | Descricao |
|---|---|---|
| `pvp-team:invite:received` | `{ inviteId, from: { userId, name } }` | Convite recebido (para target) |
| `pvp-team:invite:sent` | `{ inviteId, targetUserId }` | Confirmacao de envio (para sender) |
| `pvp-team:invite:declined` | `{ inviteId }` | Convite recusado (para sender) |
| `pvp-team:invite:expired` | `{ inviteId }` | Convite expirou (30s TTL) |
| `pvp-team:invite:error` | `{ message }` | Erro generico no fluxo de convite |

### Amizade — Servidor -> Cliente (via /internal/notify)

| Evento | Payload | Descricao |
|---|---|---|
| `friend:request-received` | `{ friendshipId, sender: { id, name, level } }` | Pedido de amizade recebido (emitido pela API route POST /api/friends/request) |
| `friend:request-accepted` | `{ friendshipId, friend: { id, name, level } }` | Pedido de amizade aceito (emitido pela API route PUT /api/friends/request/[id]/accept) |

### Espectral — Servidor -> Cliente (broadcast global)

| Evento | Payload | Descricao |
|---|---|---|
| `global:spectral-drop` | `{ userId, userName, cardName, mobName }` | Emitido para TODOS os sockets quando alguem dropa um Cristal Espectral (purity 100). Disparado via `POST /internal/broadcast-spectral` (das API routes do Next.js) ou direto via `io.emit` (dos handlers do servidor). Cliente filtra eventos onde `userId === currentUserId` para nao mostrar toast pro proprio dropper. |

### Sessao — Servidor -> Cliente (anti multi-account)

| Evento | Payload | Descricao |
|---|---|---|
| `session:replaced` | `{ reason: string }` | Emitido para o socket antigo quando o MESMO `userId` abre uma nova conexao. Logo apos o emit, o servidor chama `socket.disconnect(true)` no socket antigo. Cliente deve mostrar feedback ao usuario (toast/alert), limpar tokens locais e redirecionar para `/login` para evitar reconexao em loop. Implementado em `server/index.ts` no `io.on("connection", ...)` antes do `registerSocket(userId, socket.id)`. |

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
| Turn timer (PvP Team) | 30s | Auto-skip para quem nao enviou |
| Queue timeout (PvP Team) | 5min | Remove jogador da fila |
| Match accept (PvP Team) | 30s | Cancela match se nem todos aceitaram |
| Reconnect grace (PvP Team) | 30s | Auto-skip permanente se nao reconectar |
| Session TTL (PvP Team) | 30min | Remove sessao inativa |
| Invite TTL (PvP Team) | 30s | Convite duo expira automaticamente |

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
