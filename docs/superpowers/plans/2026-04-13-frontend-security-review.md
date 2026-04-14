# Frontend Security & Code Quality Review

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Revisar todo o frontend (~7,600 linhas) focando em segurança, código duplicado, métodos sem uso, memory leaks, e garantir que nenhuma correção quebre funcionalidades existentes.

**Architecture:** Review dividido em 5 áreas lógicas do frontend. Cada área passa pelo fluxo: prompt-engineer gera prompt de review → code-generator executa o review e gera correções. Correções são conservadoras — só altera o que tem problema real.

**Tech Stack:** Next.js 15 (App Router), React, TypeScript, Tailwind CSS v4, Socket.io client

---

## Fluxo por Área

```
prompt-engineer (gera prompt de review) → code-generator (executa review + gera fixes)
```

---

## Task 1: Auth Pages — Login & Register

**Escopo:** Páginas de autenticação, token handling, validação de formulários.

**Arquivos:**
- `app/(auth)/layout.tsx` (20 linhas)
- `app/(auth)/login/page.tsx` (192 linhas) — login com email/senha
- `app/(auth)/login/login-animations.css` — animações
- `app/(auth)/register/page.tsx` (703 linhas) — registro multi-step (3 etapas)

**Foco do review:**
- **Segurança de tokens**: access token no localStorage — XSS risk? Como mitigar?
- **Validação de input**: login/register validam no cliente? Consistente com Zod do backend?
- **Register gigante (703 linhas)**: componentes internos (`StepIndicator`, `HabitCard`, `PasswordRequirements`) devem ser extraídos?
- **Error handling**: rate limit (429), 401, 422 — tratados corretamente?
- **Redirect loops**: auth check no layout pode causar loop com middleware?
- **Código duplicado**: patterns de `clearAuthAndRedirect`, `getToken` repetidos?
- **Código morto**: constantes/funções declaradas mas não usadas

- [ ] **Step 1: Gerar prompt de review com prompt-engineer**
- [ ] **Step 2: Executar review com code-generator**
- [ ] **Step 3: Verificar compilação** — `npx tsc --noEmit`

---

## Task 2: Game Layout, Hooks & Providers

**Escopo:** Layout do jogo, hook de música, hook/provider de boss queue, socket.io client.

**Arquivos:**
- `app/(game)/layout.tsx` (326 linhas) — header, nav, music, boss queue provider, auth check
- `app/(game)/_hooks/useMusicPlayer.ts` (247 linhas) — áudio com fade in/out, context switch
- `app/(game)/_hooks/useBossQueue.tsx` (382 linhas) — socket.io, fila de boss, match accept/decline
- `app/(game)/_components/BossQueueBar.tsx` (88 linhas) — barra de status da fila
- `app/(game)/_components/BossMatchModal.tsx` (110 linhas) — modal de match encontrado
- `app/(game)/_components/BossQueuePlayersDropdown.tsx` (233 linhas) — dropdown de jogadores

**Foco do review:**
- **Memory leaks no music player**: cleanup de Audio elements e intervals ao trocar de rota?
- **Socket.io lifecycle**: socket é criado/destruído corretamente? Reconexão? Cleanup on unmount?
- **Layout gigante (326 linhas)**: lógica de auth, music, nav podem ser separadas?
- **Timer leaks**: intervals de fade do music player, countdown timers do boss queue — limpos no cleanup?
- **Race conditions**: socket events chegando antes do component mount? State updates após unmount?
- **Código duplicado**: patterns entre BossQueueBar, BossMatchModal, BossQueuePlayersDropdown
- **Código morto**: event handlers ou state nunca lidos

- [ ] **Step 1: Gerar prompt de review com prompt-engineer**
- [ ] **Step 2: Executar review com code-generator**
- [ ] **Step 3: Verificar compilação** — `npx tsc --noEmit`

---

## Task 3: Dashboard & Calendar

**Escopo:** Página principal do dashboard, task cards, calendário de atividades.

**Arquivos:**
- `app/(game)/dashboard/page.tsx` (922 linhas) — hub principal com tasks, stats, skills, calendar

**Foco do review:**
- **Página gigante (922 linhas)**: componentes internos que devem ser extraídos (`LevelExpBar`, `AttributePanel`, `EquippedSkillsPreview`, `PveBattleButton`, `BossFightCard`, `ActivityCalendar`, `TaskCard`)
- **Código duplicado**: `ATTRIBUTE_META` definido aqui E no layout — duplicação
- **Memory leaks**: calendar month change sem debounce? Fetches não cancelados no unmount?
- **Race conditions**: múltiplos fetches simultâneos no mount (tasks, profile, character, calendar, eligible)
- **Error handling**: todos os fetches tratam erros? 401 redireciona?
- **Código morto**: constantes/funções internas não usadas
- **Performance**: re-renders desnecessários? Calendar recalculando em cada render?

- [ ] **Step 1: Gerar prompt de review com prompt-engineer**
- [ ] **Step 2: Executar review com code-generator**
- [ ] **Step 3: Verificar compilação** — `npx tsc --noEmit`

---

## Task 4: Character Page & Components

**Escopo:** Página de personagem, painel de atributos, sistema de skills, house banner.

**Arquivos:**
- `app/(game)/character/page.tsx` (200+ linhas)
- `app/(game)/character/_components/CharacterHeader.tsx` (223 linhas) — avatar, XP, house badge
- `app/(game)/character/_components/AttributePanel.tsx` (201 linhas) — distribuir pontos
- `app/(game)/character/_components/SkillSelectModal.tsx` (209 linhas) — modal de seleção
- `app/(game)/character/_components/SkillLoadout.tsx` (95 linhas) — grid 2x2 de slots
- `app/(game)/character/_components/SkillInventory.tsx` (145 linhas) — grid de skills
- `app/(game)/character/_components/HouseBanner.tsx` (73 linhas) — card de casa

**Foco do review:**
- **Segurança**: distribute points — validação no client antes de enviar? Race condition de spam click?
- **Skill equip/unequip**: validação que skill pertence ao jogador? Loading states?
- **Avatar upload**: validação de tipo/tamanho no client? Preview? Error handling?
- **Código duplicado**: patterns de fetch repetidos, loading states, error handling
- **Código morto**: props aceitas mas não usadas, componentes exportados sem consumidor
- **Acessibilidade**: modais com focus trap? Keyboard navigation?

- [ ] **Step 1: Gerar prompt de review com prompt-engineer**
- [ ] **Step 2: Executar review com code-generator**
- [ ] **Step 3: Verificar compilação** — `npx tsc --noEmit`

---

## Task 5: Battle Pages & Components (PvE + Boss Coop)

**Escopo:** Páginas de batalha PvE e Boss Coop, componentes de batalha compartilhados.

**Arquivos:**
### PvE Battle
- `app/(game)/battle/page.tsx` (474 linhas) — page com fases IDLE/BATTLE/RESULT
- `app/(game)/battle/_components/BattleArena.tsx` (473 linhas) — arena principal
- `app/(game)/battle/_components/BattleIdle.tsx` (59 linhas) — tela inicial
- `app/(game)/battle/_components/SkillBar.tsx` (114 linhas) — barra de skills
- `app/(game)/battle/_components/BattleLog.tsx` (111 linhas) — log de eventos
- `app/(game)/battle/_components/BattleResult.tsx` (99 linhas) — resultado
- `app/(game)/battle/_components/DefeatSequence.tsx` (168 linhas) — animação de derrota
- `app/(game)/battle/_components/StatusParticles.tsx` (158 linhas) — partículas de status
- `app/(game)/battle/_components/AttackEffect.tsx` (76 linhas) — efeito de ataque
- `app/(game)/battle/_components/MobPlaceholder.tsx` (36 linhas) — placeholder de mob

### Boss Coop
- `app/(game)/boss-fight/page.tsx` (427 linhas) — page com socket.io
- `app/(game)/boss-fight/_components/CoopBattleArena.tsx` (118 linhas) — arena coop
- `app/(game)/boss-fight/_components/CoopSkillBar.tsx` (215 linhas) — skill bar coop
- `app/(game)/boss-fight/_components/CoopBattleResult.tsx` (146 linhas) — resultado coop
- `app/(game)/boss-fight/_components/TeamPanel.tsx` (170 linhas) — painel de equipe
- `app/(game)/boss-fight/_components/BossCard.tsx` (109 linhas) — card do boss
- `app/(game)/boss-fight/_components/TurnTimer.tsx` (32 linhas) — timer

**Foco do review:**
- **Socket.io segurança**: boss-fight page valida dados recebidos do socket antes de renderizar?
- **Memory leaks**: animações (DefeatSequence, StatusParticles) cleanup de timeouts/intervals?
- **Código duplicado entre PvE e Coop**: SkillBar vs CoopSkillBar, BattleResult vs CoopBattleResult, BattleArena vs CoopBattleArena — lógica compartilhável?
- **Types exportados da page**: `TurnLogEntry`, `AvailableSkill`, etc exportados de `battle/page.tsx` — usados pelos componentes filhos? Deveriam estar em `types/`?
- **Código morto**: componentes exportados sem importadores, props não usadas
- **StatusParticles**: animation loop com requestAnimationFrame ou setInterval? Cleanup?
- **BattleLog auto-scroll**: performance com muitos eventos?

- [ ] **Step 1: Gerar prompt de review com prompt-engineer**
- [ ] **Step 2: Executar review com code-generator**
- [ ] **Step 3: Verificar compilação** — `npx tsc --noEmit`

---

## Task 6: Types, Config & Cross-cutting

**Escopo:** Tipos globais, configurações, UI components compartilhados, CSS.

**Arquivos:**
- `types/skill.ts` (230 linhas), `types/task.ts` (58), `types/character.ts` (36), `types/habit.ts` (26), `types/house.ts` (18), `types/auth.ts` (17), `types/user.ts` (17), `types/api.ts` (13), `types/index.ts` (47)
- `components/ui/RPGButton.tsx` (113 linhas)
- `components/ui/RPGInput.tsx` (88 linhas)
- `components/ui/AlertBanner.tsx` (140 linhas)
- `lib/theme.ts` (70 linhas), `lib/houses/house-assets.ts` (28 linhas)
- `app/globals.css`, `next.config.ts`, `tsconfig.json`

**Foco do review:**
- **Types não usados**: tipos em `types/` que nenhum componente importa
- **Types inconsistentes**: tipos definidos inline nos componentes que deveriam usar os de `types/`
- **UI components**: acessibilidade, patterns de props, código morto
- **tsconfig**: strict mode OFF — deveria ser ON?
- **Theme**: `applyHouseTheme` manipula DOM diretamente — problemas com SSR?
- **CSS vars**: usadas consistentemente ou há cores hardcoded nos componentes?
- **Compilação final**: `npx tsc --noEmit` + verificação visual

- [ ] **Step 1: Executar review diretamente (sem prompt-engineer — escopo menor)**
- [ ] **Step 2: Verificar compilação final**
