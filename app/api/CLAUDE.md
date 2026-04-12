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
│   └── [id]/
│       └── profile/route.ts  # GET (perfil publico de qualquer jogador: nome, casa, character, pvpStats — protegida, sem email/senha/exp)
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
└── battle/
    ├── route.ts          # POST iniciar batalha
    ├── pve/
    │   ├── start/route.ts    # POST (iniciar batalha PvE — protegida, matchmaking por tier, armazena estado em memoria)
    │   ├── action/route.ts   # POST (enviar acao do turno — protegida, resolve turno com IA, finaliza com EXP/level up)
    │   ├── state/route.ts    # GET (consultar estado atual da batalha — protegida, query param battleId)
    │   └── history/route.ts  # GET (historico paginado de batalhas PvE — protegida, 20 por pagina)
    └── coop/
        ├── eligible/route.ts  # GET (verificar elegibilidade para boss fight cooperativo — protegida, requer 5 tarefas completas no dia)
        └── history/route.ts   # GET (historico paginado de boss fights coop — protegida, default 20/page, max 50, apenas FINISHED)
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
