# Backend Security & Code Quality Review

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Revisar todo o backend (~10K linhas) focando em segurança, código duplicado, métodos sem uso, e garantir que nenhuma correção quebre funcionalidades existentes.

**Architecture:** Review dividido em 5 áreas lógicas do backend. Cada área passa pelo fluxo: prompt-engineer gera prompt de review → code-generator executa o review e gera correções. Correções são conservadoras — só altera o que tem problema real.

**Tech Stack:** Next.js 15 API Routes, Socket.io 4, Prisma, JWT (jose), Zod, bcryptjs

---

## Fluxo por Área

```
prompt-engineer (gera prompt de review) → code-generator (executa review + gera fixes)
```

Cada task segue este ciclo:
1. Invocar `prompt-engineer` com contexto da área para gerar o prompt de review
2. Invocar `code-generator` com o prompt gerado para executar o review e aplicar correções
3. Verificar que o código compila sem erros após cada correção

---

## Task 1: Auth & Security Layer

**Escopo:** Sistema de autenticação, JWT, refresh tokens, rate limiting, middleware Edge.

**Arquivos:**
- `lib/auth/jwt.ts` (148 linhas) — sign/verify tokens
- `lib/auth/password.ts` (14 linhas) — bcrypt hash/verify
- `lib/auth/verify-session.ts` (90 linhas) — extrai e valida sessão
- `lib/auth/refresh-token.ts` (82 linhas) — rotação de tokens por família
- `lib/rate-limit.ts` (188 linhas) — rate limiting Upstash
- `middleware.ts` (94 linhas) — Edge JWT verification
- `app/api/auth/login/route.ts` (147 linhas)
- `app/api/auth/register/route.ts` (211 linhas)
- `app/api/auth/refresh/route.ts` (85 linhas)
- `app/api/auth/logout/route.ts` (35 linhas)
- `app/api/auth/me/route.ts` (73 linhas)

**Foco do review:**
- Vulnerabilidades de autenticação (token leaks, timing attacks, brute force)
- Refresh token rotation — detecção de roubo funcionando?
- Rate limiting cobrindo todas as rotas sensíveis?
- Headers de segurança (httpOnly, secure, sameSite nos cookies)
- Validação de input em login/register (injection, XSS)
- Código duplicado entre rotas de auth
- Métodos/funções exportados mas não usados

- [ ] **Step 1: Gerar prompt de review com prompt-engineer**

Invocar agent `prompt-engineer` com este briefing:
```
Gerar um prompt de code review de segurança para o sistema de autenticação do Craft Mind.
Contexto: Next.js 15 API Routes + jose (JWT Edge) + bcryptjs + @upstash/ratelimit.
Arquivos listados acima.
Foco: vulnerabilidades auth, token handling, rate limiting, cookies, input validation, código duplicado, métodos sem uso.
O prompt deve instruir o reviewer a NÃO quebrar funcionalidades — apenas corrigir problemas reais.
```

- [ ] **Step 2: Executar review com code-generator usando o prompt gerado**

- [ ] **Step 3: Verificar compilação**

Run: `npx tsc --noEmit 2>&1 | head -50`
Expected: sem erros novos

---

## Task 2: Battle Engine Core

**Escopo:** Motor de batalha compartilhado entre PvE, PvP e Coop.

**Arquivos:**
- `lib/battle/types.ts` (183 linhas)
- `lib/battle/constants.ts` (26 linhas)
- `lib/battle/utils.ts` (39 linhas)
- `lib/battle/init.ts` (21 linhas)
- `lib/battle/damage.ts` (88 linhas)
- `lib/battle/skills.ts` (55 linhas)
- `lib/battle/status.ts` (83 linhas)
- `lib/battle/effects.ts` (491 linhas)
- `lib/battle/turn.ts` (383 linhas)
- `lib/battle/shared-helpers.ts` (415 linhas)
- `lib/battle/ai-profiles.ts` (16 linhas)
- `lib/battle/ai-scoring.ts` (137 linhas)
- `lib/battle/ai.ts` (47 linhas)
- `lib/battle/index.ts` (30 linhas)
- `lib/battle/pve-store.ts` (70 linhas)

**Foco do review:**
- Funções duplicadas entre `turn.ts`, `shared-helpers.ts`, `effects.ts`
- Funções exportadas no `index.ts` que não são usadas em lugar nenhum
- Validação de input nas funções públicas (stats negativos, skills inválidas)
- Mutação acidental de estado (deep clone sendo feito corretamente?)
- Overflow/underflow em cálculos de dano e HP
- Código morto ou branches impossíveis
- Consistência de tipos entre arquivos

- [ ] **Step 1: Gerar prompt de review com prompt-engineer**

- [ ] **Step 2: Executar review com code-generator usando o prompt gerado**

- [ ] **Step 3: Verificar compilação**

Run: `npx tsc --noEmit 2>&1 | head -50`

---

## Task 3: Coop Boss Battle System

**Escopo:** Sistema 3v1 de boss fight cooperativo.

**Arquivos:**
- `lib/battle/coop-types.ts` (37 linhas)
- `lib/battle/coop-target.ts` (131 linhas)
- `lib/battle/coop-turn.ts` (594 linhas)
- `lib/battle/coop-store.ts` (76 linhas)
- `server/handlers/boss-matchmaking.ts` (738 linhas)
- `server/handlers/boss-battle.ts` (571 linhas)
- `server/stores/boss-battle-store.ts` (117 linhas)
- `server/stores/boss-queue-store.ts` (69 linhas)
- `server/lib/convert-skills.ts` (95 linhas)
- `app/api/battle/coop/eligible/route.ts` (96 linhas)
- `app/api/battle/coop/category-players/route.ts` (179 linhas)
- `app/api/battle/coop/history/route.ts` (87 linhas)

**Foco do review:**
- Duplicação entre `coop-store.ts` (lib) e `boss-battle-store.ts` (server) — stores duplicados?
- Race conditions no matchmaking (2 matches simultâneos pegando mesmo player)
- Memory leaks nos stores in-memory (cleanup funcionando? TTL correto?)
- Socket event validation (ações maliciosas via socket)
- Funções não utilizadas em `coop-turn.ts` e `shared-helpers.ts`
- Tratamento de desconexão/reconexão — edge cases
- Boss AI targeting — lógica consistente?

- [ ] **Step 1: Gerar prompt de review com prompt-engineer**

- [ ] **Step 2: Executar review com code-generator usando o prompt gerado**

- [ ] **Step 3: Verificar compilação**

Run: `npx tsc --noEmit 2>&1 | head -50`

---

## Task 4: PvP Battle & Matchmaking (Socket.io)

**Escopo:** Sistema PvP 1v1 em tempo real via Socket.io.

**Arquivos:**
- `server/index.ts` (123 linhas)
- `server/handlers/matchmaking.ts` (352 linhas)
- `server/handlers/battle.ts` (455 linhas)
- `server/stores/queue-store.ts` (40 linhas)
- `server/stores/pvp-store.ts` (62 linhas)
- `app/api/battle/pvp/history/route.ts` (89 linhas)

**Foco do review:**
- Socket auth bypass (JWT validation no handshake)
- Race conditions no matchmaking PvP
- Sanitização de dados enviados ao oponente (stats leaking?)
- Timer manipulation (cliente enviando ações após timeout?)
- Cleanup de batalhas abandonadas
- Código duplicado com boss-battle handlers
- Métodos exportados sem uso nos stores

- [ ] **Step 1: Gerar prompt de review com prompt-engineer**

- [ ] **Step 2: Executar review com code-generator usando o prompt gerado**

- [ ] **Step 3: Verificar compilação**

Run: `npx tsc --noEmit 2>&1 | head -50`

---

## Task 5: API Routes, Helpers & Validations

**Escopo:** Rotas REST restantes, helpers, validações Zod, sistema de tasks/EXP.

**Arquivos:**
- `app/api/character/route.ts` (68 linhas)
- `app/api/character/distribute-points/route.ts` (110 linhas)
- `app/api/character/skills/route.ts` (43 linhas)
- `app/api/character/skills/equip/route.ts` (130 linhas)
- `app/api/character/skills/unequip/route.ts` (73 linhas)
- `app/api/tasks/daily/route.ts` (58 linhas)
- `app/api/tasks/generate/route.ts` (88 linhas)
- `app/api/tasks/calendar/route.ts` (87 linhas)
- `app/api/tasks/[id]/complete/route.ts` (211 linhas)
- `app/api/user/profile/route.ts` (58 linhas)
- `app/api/user/[id]/profile/route.ts` (85 linhas)
- `app/api/user/habits/route.ts` (36 linhas)
- `app/api/user/avatar/route.ts` (64 linhas)
- `app/api/habits/route.ts` (22 linhas)
- `app/api/skills/route.ts` (29 linhas)
- `lib/tasks/generate-daily.ts` (162 linhas)
- `lib/exp/formulas.ts` (61 linhas)
- `lib/exp/level-up.ts` (104 linhas)
- `lib/exp/matchmaking.ts` (31 linhas)
- `lib/exp/constants.ts` (5 linhas)
- `lib/exp/index.ts` (4 linhas)
- `lib/helpers/determine-house.ts` (66 linhas)
- `lib/helpers/dominant-category.ts` (49 linhas)
- `lib/helpers/attribute-mapping.ts` (54 linhas)
- `lib/helpers/skill-unlock.ts` (34 linhas)
- `lib/helpers/date-utils.ts` (47 linhas)
- `lib/validations/auth.ts` (37 linhas)
- `lib/validations/battle.ts` (32 linhas)
- `lib/validations/skill.ts` (21 linhas)
- `lib/validations/tasks.ts` (7 linhas)
- `lib/api-response.ts` (55 linhas)
- `lib/cloudinary.ts` (9 linhas)
- `lib/prisma.ts` (8 linhas) + `server/lib/prisma.ts` (5 linhas)

**Foco do review:**
- **Prisma duplicado** — `lib/prisma.ts` vs `server/lib/prisma.ts` (instâncias duplicadas?)
- Input validation gaps (rotas sem Zod validation?)
- SQL injection via Prisma (raw queries?)
- File upload security (avatar — tipo, tamanho, path traversal)
- Authorization checks (rotas que deveriam ser protegidas mas não são?)
- Funções helper duplicadas ou não utilizadas
- Barrel exports (`index.ts`) com exports mortos
- Consistência nas respostas de erro (usando `apiError` em todos os lugares?)
- Task completion — race condition de completar mesma task 2x?

- [ ] **Step 1: Gerar prompt de review com prompt-engineer**

- [ ] **Step 2: Executar review com code-generator usando o prompt gerado**

- [ ] **Step 3: Verificar compilação**

Run: `npx tsc --noEmit 2>&1 | head -50`

---

## Task 6: Review Final — Cross-cutting Concerns

**Escopo:** Problemas que cruzam múltiplas áreas.

**Sem prompt-engineer** — este é um review manual de consolidação.

- [ ] **Step 1: Verificar imports circulares**

Run: `npx madge --circular lib/ server/ 2>&1` ou análise manual

- [ ] **Step 2: Verificar exports não utilizados globalmente**

Grep por funções exportadas em `lib/` e `server/` e verificar se são importadas em algum lugar.

- [ ] **Step 3: Compilação final completa**

Run: `npx tsc --noEmit`
Expected: 0 erros

- [ ] **Step 4: Commit de todas as correções**

```bash
git add -A
git commit -m "Refatora backend: correções de segurança, remove código duplicado e métodos sem uso"
```
