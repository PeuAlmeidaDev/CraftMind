# app/(game)/ — Rotas Protegidas do Jogo

## Rotas desta pasta

| Arquivo | Rota | Fase | Descrição |
|---|---|---|---|
| `dashboard/page.tsx` | `/dashboard` | 3 | Hábitos diários e progresso |
| `character/page.tsx` | `/character` | 5 | Tela do personagem com atributos e habilidades |
| `battle/page.tsx` | `/battle` | 6-7 | Tela de batalha por turnos |
| `lobby/page.tsx` | `/lobby` | 8 | Matchmaking e sala de espera |
| `pvp-1v1/page.tsx` | `/pvp-1v1` | 7 | Batalha PvP 1v1 em tempo real (lobby + arena + resultado) |

## Proteção de acesso

O `(game)/layout.tsx` é Client Component (`"use client"`). Ele lê o `access_token` do `localStorage`, busca o perfil do usuario via `GET /api/user/profile`, e redireciona para `/login` se nao houver token ou se a API retornar 401. Tambem renderiza o header/navbar com nome do jogador, badge da casa e botao de logout.

A primeira camada de protecao e o middleware (`middleware.ts` na raiz), que valida o cookie `access_token` e redireciona para `/login` em rotas protegidas. O layout serve como segunda camada no client-side.

## Estrutura de páginas

- `page.tsx`: Client Component (`"use client"`) — busca dados via fetch com `Authorization: Bearer <token>` do localStorage.
- Componentes interativos (batalha, formulários de hábito): `"use client"` em arquivos separados em `components/`.
- Socket.io: inicializado apenas em Client Components da rota `/battle`, `/lobby`, `/pvp-1v1`, `/pvp-team`, `/boss-fight`, `/coop-pve`.
- Providers de queue (Pvp1v1QueueProvider, PvpTeamQueueProvider, BossQueueProvider) ficam no layout para persistir estado entre navegacoes.

## Convenções de dados

- Dados do jogador logado: buscados via `GET /api/user/profile` no layout, e via rotas especificas nas paginas (ex: `GET /api/tasks/daily` no dashboard).
- Nunca expor o objeto Prisma bruto para o cliente — mapear para tipos em `types/`.
- Mutações de hábitos e batalha: sempre via API Routes (`/api/*`), nunca Prisma direto no Client Component.
- Tratar 401 em toda resposta de fetch: limpar localStorage + cookie e redirecionar para `/login`.
