# lib/ — Utilitários e Helpers

## Arquivos desta pasta

| Arquivo | Responsabilidade |
|---|---|
| `prisma.ts` | Singleton do Prisma Client |
| `cloudinary.ts` | Configuracao do Cloudinary SDK v2 (upload de avatar). Requer `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` |
| `auth/password.ts` | Hash e verificação de senhas com bcryptjs (12 rounds) |
| `auth/jwt.ts` | Assinatura e verificação de JWT (access + refresh) via jose |
| `auth/verify-session.ts` | Helper centralizado para extrair e verificar token de uma Request (header Authorization ou cookie access_token). Lanca `AuthenticationError` tipado |
| `api-response.ts` | Helpers `apiSuccess()` e `apiError()` para respostas JSON padronizadas em Route Handlers |
| `cookies.ts` | Helpers para ler/escrever cookies de sessão (Next.js `cookies()`) |
| `rate-limit.ts` | Rate limiting via @upstash/ratelimit (sliding window). Lazy init — se Upstash nao estiver configurado, opera como no-op com `console.warn`. Exporta `rateLimit()` generico e `authRateLimit()` pre-configurado para rotas de auth (5 req/60s) |
| `house.ts` | Lógica de alocação de casa com base nos hábitos selecionados |
| `battle.ts` | Cálculo de dano, ordem de turno, resolução de habilidades |
| `helpers/determine-house.ts` | Funcao pura que determina a casa do jogador pela categoria dominante dos habitos |
| `helpers/attribute-mapping.ts` | Mapeia chaves JSON de attributeGrants para colunas do Character no Prisma |
| `helpers/skill-unlock.ts` | Rola chance de desbloqueio de skill por tag da tarefa (`rollSkillUnlock`, `SKILL_UNLOCK_CHANCE`) |
| `helpers/date-utils.ts` | Calculo centralizado de inicio/fim do dia em BRT (UTC-3). Exporta `getStartOfDayBRT()`, `getEndOfDayBRT()`, `getTodayDateBRT()`. Usado por todas as rotas de tarefas e logs |
| `helpers/dominant-category.ts` | Calcula categoria dominante de um array de HabitCategory com desempate aleatorio. Funcao pura, apenas type import de @prisma/client. Exporta `getDominantCategory()` |
| `theme.ts` | Mapa de temas visuais por casa (HouseTheme, HOUSE_THEMES, getHouseTheme, applyHouseTheme). Sem `"use client"` — chamado de Client Components |
| `validations/auth.ts` | Schemas Zod para registro e login (reusaveis entre Route Handlers e Server Actions) |
| `validations/battle.ts` | Schemas Zod para batalha PvE (`pveBattleActionSchema`, `distributePointsSchema`) e tipos inferidos |
| `validations/tasks.ts` | Schema Zod para validacao de params ao completar tarefa |
| `exp/` | Funcoes puras para EXP, level up, distribuicao de pontos e matchmaking PvE. Ver `exp/CLAUDE.md` |
| `tasks/generate-daily.ts` | Gera exatamente 5 tarefas diarias (`DAILY_TASK_LIMIT`) para um usuario. Busca UserHabits, seleciona 5 habitos aleatorios (Fisher-Yates shuffle). Se o usuario tem < 5 habitos, repete habitos ciclicamente com templates (descricoes) diferentes. Cria DailyTasks via `createMany` com `skipDuplicates` (idempotente pela constraint `userId+description+dueDate`). Chamada pela rota POST `/api/tasks/generate`. Exporta `DAILY_TASK_LIMIT`. |

## Prisma singleton — uso obrigatório

```ts
// lib/prisma.ts
import { PrismaClient } from '@prisma/client'
const globalForPrisma = globalThis as unknown as { prisma: PrismaClient }
export const prisma = globalForPrisma.prisma ?? new PrismaClient()
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
```

Importar sempre de `lib/prisma`: `import { prisma } from '@/lib/prisma'`. Nunca instanciar `new PrismaClient()` fora deste arquivo.

## Regras gerais

- Funções puras sem efeitos colaterais sempre que possível.
- Funções que acessam banco: sempre `async`, sempre retornam tipos explícitos de `types/`.
- `auth.ts` usa `jose` (Edge Runtime compatible) — não usar `jsonwebtoken` em Route Handlers do Edge.
- `jsonwebtoken` pode ser usado apenas no servidor Socket.io (`server/`) que roda em Node puro.
- Sem lógica de apresentação aqui — apenas lógica de negócio e infraestrutura.
