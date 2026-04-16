# Perfil de jogador por nome + unicidade de nome

**Data:** 2026-04-16
**Escopo:** Backend only (sem frontend)

## Objetivo

Permitir buscar o perfil publico de outro jogador pelo nome (username), e garantir que nomes sejam unicos no banco de dados.

## Mudancas

### 1. Schema Prisma — unicidade do nome

Adicionar `@unique` ao campo `name` do model `User`:

```prisma
name String @unique
```

Gerar migration Prisma. Duplicatas ja foram resolvidas manualmente.

### 2. Validacao no registro — checar nome duplicado

No `POST /api/auth/register`, apos validar o body com Zod, verificar se ja existe um usuario com o mesmo nome antes de criar:

```ts
const existingName = await prisma.user.findUnique({
  where: { name },
  select: { id: true },
});

if (existingName) {
  return apiError("Nome de usuario ja esta em uso", "NAME_ALREADY_EXISTS", 422);
}
```

Manter a checagem de email existente separada, com mensagem generica (como esta hoje). A checagem de nome pode ser explicita pois nome e publico.

### 3. Nova rota — `GET /api/user/by-name/[name]/profile`

**Localizacao:** `app/api/user/by-name/[name]/profile/route.ts`

**Comportamento:**
- Rota protegida (requer autenticacao via `verifySession`)
- Valida o parametro `name` com Zod (string, min 1, max 50, trim)
- Busca usuario por `prisma.user.findUnique({ where: { name } })`
- Retorna os mesmos campos do perfil publico existente (`/api/user/[id]/profile`):
  - `id`, `name`, `avatarUrl`
  - `house` (name, animal)
  - `character` (level, physicalAtk, physicalDef, magicAtk, magicDef, hp, speed)
  - `pvpStats` (totalBattles, wins, losses, draws)
- **Nao retorna:** email, senha, exp, freePoints, bossEssence
- 404 se jogador nao encontrado
- 422 se nome invalido

**Resposta (200):**
```json
{
  "data": {
    "id": "cuid...",
    "name": "NomeDoJogador",
    "avatarUrl": "https://...",
    "house": { "name": "NOCTIS", "animal": "Corvo" },
    "character": {
      "level": 5,
      "physicalAtk": 15,
      "physicalDef": 12,
      "magicAtk": 18,
      "magicDef": 14,
      "hp": 140,
      "speed": 13
    },
    "pvpStats": {
      "totalBattles": 10,
      "wins": 6,
      "losses": 3,
      "draws": 1
    }
  }
}
```

### 4. Refatorar query de perfil publico

A logica de buscar perfil publico + pvpStats e identica entre `[id]/profile` e `by-name/[name]/profile`. Extrair para um helper compartilhado em `lib/helpers/public-profile.ts`:

```ts
export async function getPublicProfile(userId: string) {
  // query do user + pvpStats (mesma logica atual)
}
```

Ambas as rotas chamam esse helper — a unica diferenca e como resolvem o userId (por id direto vs findUnique por name).

## Fora de escopo

- Frontend / pagina de perfil de outros jogadores
- Busca parcial / autocomplete de nomes
- Case-insensitive search (pode ser adicionado depois)
