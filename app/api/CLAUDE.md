# app/api/ — Route Handlers

## Estrutura de pastas

```
api/
├── auth/
│   ├── register/route.ts
│   ├── login/route.ts
│   ├── refresh/route.ts
│   ├── logout/route.ts
│   └── me/route.ts          # GET (dados do usuario autenticado: user, house, habits, character — protegida)
├── habits/
│   └── route.ts          # GET (listar todos os habitos — publica)
├── user/
│   ├── habits/route.ts   # GET (habitos do usuario logado — protegida)
│   ├── profile/route.ts  # GET (perfil do usuario: nome, email, casa, avatarUrl, character — protegida)
│   ├── avatar/route.ts   # POST (upload de avatar via Cloudinary — protegida, formData, max 5MB, JPEG/PNG/WebP)
│   ├── intro-seen/route.ts # PUT (marcar intro da casa como vista — protegida, sem body)
│   ├── showcase/route.ts # PUT (define vitrine publica do usuario logado — protegida, body { userCardIds: string[] } max 6, valida ownership e dedup)
│   ├── by-name/
│   │   └── [name]/
│   │       └── profile/route.ts  # GET (perfil publico por nome — protegida, mesmos dados de [id]/profile)
│   └── [id]/
│       ├── profile/route.ts   # GET (perfil publico de qualquer jogador: nome, casa, character, pvpStats — protegida, sem email/senha/exp)
│       └── showcase/route.ts  # GET (vitrine publica de outro jogador — protegida, retorna { userCardIds, cards } com ate 6 UserCards completos; sem 404 quando vazia)
├── tasks/
│   ├── daily/route.ts    # GET (listar tarefas do dia — protegida, somente leitura)
│   ├── generate/route.ts # POST (gerar tarefas do dia — protegida, 409 se ja existem)
│   └── [id]/
│       └── complete/route.ts  # POST (completar tarefa — protegida, transacao atomica, chance de desbloquear skill)
├── character/
│   ├── route.ts          # GET (atributos + skills equipadas do personagem — protegida)
│   ├── distribute-points/route.ts # POST (distribuir pontos livres nos stats — protegida, validacao via distributePoints)
│   └── skills/
│       ├── route.ts      # GET (listar todas as skills do personagem: equipped + unequipped — protegida)
│       ├── equip/route.ts   # PUT (equipar skill em slot 0-3, com swap/move — protegida)
│       └── unequip/route.ts # PUT (desequipar skill de um slot — protegida)
├── friends/
│   ├── route.ts              # GET (listar amigos aceitos — protegida)
│   ├── request/
│   │   └── route.ts          # POST (enviar pedido de amizade — protegida, 5 req/60s)
│   │   └── [id]/
│   │       ├── accept/route.ts   # PUT (aceitar pedido — protegida, somente receiver)
│   │       └── decline/route.ts  # PUT (recusar pedido — protegida, somente receiver)
│   ├── requests/
│   │   └── route.ts          # GET (listar pedidos pendentes recebidos — protegida)
│   ├── status/
│   │   └── [userId]/
│   │       └── route.ts      # GET (status da relacao com outro usuario: NONE/PENDING/ACCEPTED/DECLINED/BLOCKED + direction — protegida, 10 req/60s)
│   └── [id]/
│       └── route.ts          # DELETE (remover amizade aceita — protegida, sender ou receiver)
├── cards/
│   ├── route.ts          # GET (listar UserCards do usuario, inclui purity e spectralSkillId — protegida)
│   ├── equip/route.ts    # POST (equipar cristal em slot 0-2 — protegida)
│   ├── unequip/route.ts  # POST (desequipar cristal — protegida)
│   ├── [id]/
│   │   └── spectral-skill/route.ts       # PUT (escolher skill espectral do 5o slot — protegida; valida purity 100, ownership e que skillId pertence aos 4 mob skills do mob de origem; resposta { ok: true, spectralSkillId })
│   └── pending-duplicates/
│       ├── route.ts                      # GET (listar pendencias do usuario — protegida)
│       └── [id]/resolve/route.ts         # POST (resolver pendencia: decision REPLACE | CONVERT — protegida, transacao atomica, ownership validada)
└── battle/
    ├── route.ts          # POST iniciar batalha
    ├── active/route.ts   # GET (verificar se usuario tem batalha ativa em qualquer modo — protegida, consulta stores locais + Socket.io server)
    ├── pve/
    │   ├── start/route.ts    # POST (iniciar batalha PvE 1v1 — protegida, matchmaking por tier, sorteia `encounterStars` (1/2/3) e aplica multiplicador nos stats do mob em memoria; resposta inclui `encounterStars: number`)
    │   ├── action/route.ts   # POST (enviar acao do turno 1v1 — protegida, resolve turno com IA, finaliza com EXP/level up; passa `encounterStars` da sessao para o drop)
    │   ├── state/route.ts    # GET (consultar estado atual da batalha 1v1 — protegida, query param battleId)
    │   └── history/route.ts  # GET (historico paginado de batalhas PvE — protegida, 20 por pagina)
    ├── pve-multi/
    │   ├── start/route.ts    # POST (iniciar batalha PvE 1v3 — protegida, seleciona 3 mobs por tier, sorteia `encounterStars` por mob e aplica multiplicador nos stats; resposta inclui `encounterStars: Record<mobId, number>`)
    │   ├── action/route.ts   # POST (enviar acao do turno 1v3 — protegida, body: {battleId, skillId, targetIndex?}, rate limited, detecta timeout 1min; drop por mob morto usa `encounterStars[mobId]` da sessao com fallback 1)
    │   ├── state/route.ts    # GET (consultar estado sanitizado da batalha 1v3 — protegida, query param battleId, detecta timeout 1min)
    │   └── forfeit/route.ts  # POST (desistir da batalha PvE Multi — protegida, persiste DEFEAT no banco, remove da store)
    ├── coop/
    │   ├── eligible/route.ts  # GET (verificar elegibilidade para boss fight cooperativo — protegida, requer 5 tarefas completas no dia)
    │   └── history/route.ts   # GET (historico paginado de boss fights coop — protegida, default 20/page, max 50, apenas FINISHED)
    ├── coop-pve/
    │   └── history/route.ts   # GET (historico paginado de batalhas coop PvE 2v3/2v5 — protegida, default 20/page, max 50, apenas com resultado)
    └── pvp-team/
        └── history/route.ts   # GET (historico paginado de batalhas PvP Team 2v2 — protegida, default 20/page, inclui teammates e opponents)
```

## Formato de resposta padrão

```ts
// Sucesso
{ data: T, message?: string }

// Erro
{ error: string, code?: string }
```

Sempre retornar o status HTTP correto: 200, 201, 400, 401, 403, 404, 422, 429, 500.

## Autenticação nas rotas

- Rotas protegidas leem o cookie `access_token` e validam com `jose` (Edge-compatible).
- Usar helper `lib/auth.ts → verifySession(request)` que retorna `{ userId }` ou lança erro 401.
- Rotas de auth (`/api/auth/*`) são públicas — aplicar rate limiting via @upstash/ratelimit.

## Validação de input

- Todo body de POST/PATCH deve ser validado com Zod antes de qualquer operação.
- Em caso de falha de validação: retornar status 422 com `{ error: "Dados inválidos", details: zodError.flatten() }`.
- Nunca confiar em dados do cliente sem validação — nem IDs, nem enums.

## Regras gerais

- Nunca expor stack traces ou mensagens internas de erro ao cliente.
- Nunca usar SQL raw — sempre Prisma queries.
- Rotas de batalha devem verificar se o `userId` da sessão é participante da batalha antes de qualquer ação.
