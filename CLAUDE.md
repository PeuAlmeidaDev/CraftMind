# Craft Mind — Raiz do Projeto

RPG de batalha por turnos competitivo (estilo Pokemon) onde hábitos saudáveis da vida real alimentam os atributos do personagem. Multiplayer online via Socket.io.

## Stack

- Next.js 15 (App Router) + TypeScript + Tailwind CSS v4
- PostgreSQL + Prisma ORM
- Socket.io 4 (servidor dedicado em `server/`)
- Zod (validação), bcryptjs (senhas), jose (JWT Edge), @upstash/ratelimit (rate limiting)

## Como rodar localmente

```bash
npm install
cp .env.example .env        # preencher variáveis
npx prisma migrate dev
npm run dev
```

O servidor Socket.io sobe separado: `node server/index.js` (porta 3001 por padrão).

## Variáveis de ambiente obrigatórias

| Variável | Descrição |
|---|---|
| `DATABASE_URL` | String de conexão PostgreSQL |
| `JWT_SECRET` | Segredo para assinar access tokens (min 32 chars) |
| `JWT_REFRESH_SECRET` | Segredo para refresh tokens |
| `UPSTASH_REDIS_REST_URL` | URL REST do Upstash Redis (rate limiting) |
| `UPSTASH_REDIS_REST_TOKEN` | Token do Upstash Redis |
| `SOCKET_SERVER_URL` | URL do servidor Socket.io (ex: http://localhost:3001) |
| `SOCKET_INTERNAL_SECRET` | Segredo compartilhado entre Next.js e Socket.io server para notificacoes internas (POST /internal/notify) |
| `NEXT_PUBLIC_SOCKET_URL` | URL pública do Socket.io exposta ao browser |
| `CLOUDINARY_CLOUD_NAME` | Nome do cloud Cloudinary (upload de avatar) |
| `CLOUDINARY_API_KEY` | API key do Cloudinary |
| `CLOUDINARY_API_SECRET` | API secret do Cloudinary |

## Convenções gerais

- Branches: `feat/<fase>-<descricao>`, `fix/<descricao>`, `chore/<descricao>`
- Commits em português, imperativo: "Adiciona sistema de hábitos"
- Sem `any` no TypeScript — tipar tudo explicitamente
- IDs públicos sempre via cuid2/UUID, nunca inteiros sequenciais
- Toda pasta relevante tem seu próprio `CLAUDE.md`
