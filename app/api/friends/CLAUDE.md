# app/api/friends/ — Sistema de Amizade

## Rotas

| Metodo | Rota | Descricao |
|---|---|---|
| `POST` | `/api/friends/request` | Enviar pedido de amizade (body: `{ targetUserId }`) |
| `GET` | `/api/friends/requests` | Listar pedidos pendentes recebidos |
| `PUT` | `/api/friends/request/[id]/accept` | Aceitar pedido de amizade |
| `PUT` | `/api/friends/request/[id]/decline` | Recusar pedido de amizade |
| `DELETE` | `/api/friends/[id]` | Remover amizade aceita |
| `GET` | `/api/friends` | Listar todos os amigos |
| `GET` | `/api/friends/status/[userId]` | Status da relacao com outro usuario (NONE, PENDING, ACCEPTED, DECLINED, BLOCKED + direction) |

## Autenticacao

Todas as rotas sao protegidas via `verifySession(request)` de `lib/auth/verify-session.ts`.

## Rate limiting

- `POST /api/friends/request` — 5 req / 60s por usuario (mais restritivo)
- Demais rotas — 10 req / 60s por usuario

## Validacao

- Body do `POST /api/friends/request` validado com Zod (`friendRequestSchema` em `lib/validations/friends.ts`)
- Params de rota ([id]) validados por existencia no banco

## Regras de negocio

- Nao pode enviar pedido para si mesmo
- Nao pode existir Friendship PENDING ou ACCEPTED duplicada (em qualquer direcao)
- Se existir DECLINED, deleta a antiga e permite reenvio
- Se existir BLOCKED, retorna 403
- Apenas o receiver pode aceitar/recusar pedidos
- Apenas sender ou receiver podem remover amizade aceita
- DELETE so funciona em friendships com status ACCEPTED

## Notificacoes em tempo real

Apos sucesso das operacoes de banco, as rotas emitem eventos Socket.io via `emitToUser()` de `lib/socket-emitter.ts` (fire-and-forget):

| Rota | Evento emitido | Destino | Payload |
|---|---|---|---|
| `POST /request` | `friend:request-received` | receiverId | `{ friendshipId, sender: { id, name, level } }` |
| `PUT /request/[id]/accept` | `friend:request-accepted` | senderId original | `{ friendshipId, friend: { id, name, level } }` |

Se o usuario destino estiver offline, nenhum erro ocorre.

## Formato de resposta

Segue padrao `apiSuccess`/`apiError` de `lib/api-response.ts`.
