# Boss Fight Cooperativo — Frontend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar o frontend completo do Boss Fight Cooperativo — botão no dashboard, fila persistente com Socket.io, dropdown de jogadores, modal de match e tela de batalha 3v1 em tempo real.

**Architecture:** Hook `useBossQueue` gerencia conexão Socket.io global no layout do jogo. Barra inferior flutuante + modal de match renderizam no layout (persistem entre páginas). Página `/boss-fight` é rota separada com arena centralizada (boss topo, 3 players horizontal, skills+log na base). API nova `/api/battle/coop/category-players` alimenta o dropdown.

**Tech Stack:** Next.js 15 App Router, TypeScript, Tailwind CSS v4, Socket.io Client, CSS variables de tema

---

## File Structure

```
app/(game)/
├── layout.tsx                              [MODIFY] — add BossQueueProvider, BossQueueBar, BossMatchModal
├── _hooks/
│   └── useBossQueue.ts                     [CREATE] — Socket.io hook + context for boss queue
├── _components/
│   ├── BossQueueBar.tsx                    [CREATE] — floating bottom bar
│   ├── BossQueuePlayersDropdown.tsx         [CREATE] — category players dropdown
│   └── BossMatchModal.tsx                  [CREATE] — match found modal
├── dashboard/
│   └── page.tsx                            [MODIFY] — add BossFightCard
├── boss-fight/
│   ├── page.tsx                            [CREATE] — coop battle page
│   └── _components/
│       ├── CoopBattleArena.tsx             [CREATE] — main arena layout
│       ├── BossCard.tsx                    [CREATE] — boss HP/status card
│       ├── TeamPanel.tsx                   [CREATE] — 3 player cards
│       ├── CoopSkillBar.tsx                [CREATE] — skills + ally target selector
│       ├── CoopBattleResult.tsx            [CREATE] — result modal with essence
│       └── TurnTimer.tsx                   [CREATE] — 30s countdown bar

app/api/battle/coop/
└── category-players/route.ts               [CREATE] — players of same category today
```

---

### Task 1: API — Category Players Endpoint

**Files:**
- Create: `app/api/battle/coop/category-players/route.ts`

- [ ] **Step 1: Read existing patterns**

Read these files to match the exact API pattern:
- `app/api/battle/coop/eligible/route.ts`
- `app/api/battle/coop/history/route.ts`
- `lib/helpers/date-utils.ts` — `getTodayDateBRT()`
- `lib/helpers/dominant-category.ts` — `getDominantCategory()`

- [ ] **Step 2: Create the route**

Create `app/api/battle/coop/category-players/route.ts`:

```typescript
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifySession, AuthenticationError } from "@/lib/auth/verify-session";
import { apiSuccess, apiError } from "@/lib/api-response";
import { rateLimit } from "@/lib/rate-limit";
import { getTodayDateBRT } from "@/lib/helpers/date-utils";
import { getDominantCategory } from "@/lib/helpers/dominant-category";
import { DAILY_TASK_LIMIT } from "@/lib/tasks/generate-daily";
import type { HabitCategory } from "@prisma/client";

const VALID_CATEGORIES: HabitCategory[] = [
  "PHYSICAL", "INTELLECTUAL", "MENTAL", "SOCIAL", "SPIRITUAL",
];

export async function GET(request: NextRequest) {
  try {
    const { userId } = await verifySession(request);

    const rl = await rateLimit(userId);
    if (!rl.success) {
      return apiError("Muitas requisições", "RATE_LIMITED", 429);
    }

    const category = request.nextUrl.searchParams.get("category");
    if (!category || !VALID_CATEGORIES.includes(category as HabitCategory)) {
      return apiError("Categoria inválida", "INVALID_CATEGORY", 400);
    }

    const today = getTodayDateBRT();

    // Buscar todos os users que completaram todas as tasks hoje
    const usersWithTasks = await prisma.user.findMany({
      where: {
        id: { not: userId }, // excluir o próprio jogador
        dailyTasks: {
          some: { dueDate: today },
        },
      },
      select: {
        id: true,
        name: true,
        house: { select: { name: true } },
        character: { select: { level: true } },
        dailyTasks: {
          where: { dueDate: today },
          select: {
            description: true,
            completed: true,
            habit: { select: { category: true } },
          },
        },
        // Skill desbloqueada hoje
        character: {
          select: {
            level: true,
            characterSkills: {
              where: {
                createdAt: { gte: today },
              },
              take: 1,
              orderBy: { createdAt: "desc" },
              select: {
                skill: { select: { name: true } },
              },
            },
          },
        },
      },
      take: 20,
    });

    // Filtrar: apenas quem completou TODAS as 5 tasks E tem a categoria dominante correta
    const players = usersWithTasks
      .filter((u) => {
        const completedTasks = u.dailyTasks.filter((t) => t.completed);
        if (completedTasks.length < DAILY_TASK_LIMIT) return false;
        const categories = completedTasks.map((t) => t.habit.category);
        const dominant = getDominantCategory(categories);
        return dominant === category;
      })
      .map((u) => ({
        name: u.name,
        level: u.character?.level ?? 1,
        houseName: u.house?.name ?? null,
        tasks: u.dailyTasks.map((t) => ({
          description: t.description,
          category: t.habit.category,
        })),
        unlockedSkillName: u.character?.characterSkills?.[0]?.skill?.name ?? null,
      }));

    return apiSuccess({ players, totalCount: players.length });
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return apiError(error.message, error.code, error.statusCode);
    }
    console.error("[GET /api/battle/coop/category-players]", error);
    return apiError("Erro interno do servidor", "INTERNAL_ERROR", 500);
  }
}
```

NOTE: The above code has a Prisma `select` conflict (two `character` keys). The code-generator must fix this by using a single `character` select that includes both `level` and `characterSkills`. Read the file after creation and fix if needed.

- [ ] **Step 3: Verify compilation**

Run: `npx tsc --noEmit`
Expected: No errors in the new file

- [ ] **Step 4: Commit**

```bash
git add app/api/battle/coop/category-players/route.ts
git commit -m "Adiciona endpoint de jogadores da mesma categoria"
```

---

### Task 2: Socket.io Hook — useBossQueue

**Files:**
- Create: `app/(game)/_hooks/useBossQueue.ts`

- [ ] **Step 1: Read existing patterns**

Read these files:
- `app/(game)/_hooks/useMusicPlayer.ts` — hook pattern
- `app/(game)/layout.tsx` — where hook will be used
- `server/handlers/boss-matchmaking.ts` — Socket.io events to handle
- `server/handlers/boss-battle.ts` — battle events

- [ ] **Step 2: Create the hook**

Create `app/(game)/_hooks/useBossQueue.ts` with:

**Context + Provider:**
- `BossQueueContext` with React.createContext
- `BossQueueProvider` component that wraps children
- `useBossQueue()` hook that reads context

**State managed:**
```typescript
type BossQueueState = {
  // Connection
  connected: boolean;

  // Queue
  inQueue: boolean;
  queueCategory: string | null;
  queuePosition: number;
  queueSize: number;
  queueTimeRemaining: number;

  // Match
  matchFound: boolean;
  matchData: {
    battleId: string;
    boss: { id: string; name: string; description: string; tier: number; category: string };
    teammates: { name: string; level: number }[];
    acceptTimeoutMs: number;
  } | null;
  matchAcceptTimeRemaining: number;

  // Battle redirect
  battleStarted: boolean;
  battleId: string | null;

  // Actions
  joinQueue: (category: string) => void;
  leaveQueue: () => void;
  acceptMatch: () => void;
  declineMatch: () => void;
};
```

**Socket.io connection:**
- Connect to `NEXT_PUBLIC_SOCKET_URL` with `auth: { token }` from localStorage
- Only connect when `joinQueue` is called (lazy connection)
- Disconnect when leaving queue AND no active battle

**Events listened:**
- `boss:queue:status` → update position/size
- `boss:queue:timeout` → reset queue state, show message
- `boss:match:found` → set matchFound, matchData, start accept timer
- `boss:match:cancelled` → reset match state
- `boss:match:accepted` → update accept count
- `boss:battle:start` → set battleStarted + battleId
- `boss:error` → log error, optionally reset state

**Timer management:**
- Queue timer: `setInterval` counting down from 300s (5min)
- Match accept timer: `setInterval` counting down from 30s
- Clear intervals on unmount

**Actions:**
- `joinQueue(category)`: emit `boss:queue:join`, set inQueue
- `leaveQueue()`: emit `boss:queue:leave`, clear state
- `acceptMatch()`: emit `boss:match:accept`
- `declineMatch()`: emit `boss:match:decline`, clear match state

- [ ] **Step 3: Verify compilation**

Run: `npx tsc --noEmit`

- [ ] **Step 4: Commit**

```bash
git add "app/(game)/_hooks/useBossQueue.ts"
git commit -m "Adiciona hook useBossQueue para fila de boss fight via Socket.io"
```

---

### Task 3: Floating Queue Bar + Match Modal

**Files:**
- Create: `app/(game)/_components/BossQueueBar.tsx`
- Create: `app/(game)/_components/BossQueuePlayersDropdown.tsx`
- Create: `app/(game)/_components/BossMatchModal.tsx`

- [ ] **Step 1: Read existing patterns**

Read these files:
- `app/(game)/battle/_components/BattleResult.tsx` — modal overlay pattern
- `app/(game)/layout.tsx` — CSS variable usage, z-index stacking
- `app/(game)/_hooks/useBossQueue.ts` (just created) — state shape

- [ ] **Step 2: Create BossQueueBar**

`BossQueueBar.tsx`:
- `"use client"` component
- Uses `useBossQueue()` hook
- Only renders when `inQueue === true`
- Fixed bottom bar: `fixed bottom-0 left-0 right-0 z-40`
- Background: `bg-gradient-to-r from-[var(--bg-card)] to-[#2a1a3e]` with purple border
- Left side: pulsing dot (CSS animation) + "Boss Fight — Procurando..." + category/count/timer
- Right side: "Ver Jogadores" button (toggles dropdown) + "Sair" button (red, calls leaveQueue)
- Timer format: `M:SS` countdown

- [ ] **Step 3: Create BossQueuePlayersDropdown**

`BossQueuePlayersDropdown.tsx`:
- `"use client"` component
- Props: `category: string`, `isOpen: boolean`, `onClose: () => void`
- Fetches `GET /api/battle/coop/category-players?category={category}` on open
- Positioned: `fixed bottom-[60px]` above the queue bar
- Background: dark card with purple border, max-height with scroll
- Per player: name + level + house, task chips (blue if matches category, gray otherwise), skill unlock name in orange
- Close on X button or clicking outside
- Loading state: skeleton pulse while fetching
- Cache: store result in state, refetch only if stale (>30s)

- [ ] **Step 4: Create BossMatchModal**

`BossMatchModal.tsx`:
- `"use client"` component
- Uses `useBossQueue()` hook
- Only renders when `matchFound === true`
- Fixed overlay: `fixed inset-0 z-50 bg-black/70` (same pattern as BattleResult)
- Content: centered card with:
  - "Match Encontrado!" in green
  - Boss card: name, tier, category, description
  - 3 teammate cards: name, level
  - Timer countdown: "Aceitar em: {seconds}s"
  - "Aceitar" button (green, calls acceptMatch) + "Recusar" button (red, calls declineMatch)
- Auto-close when timer reaches 0
- On `battleStarted === true`: redirect to `/boss-fight?battleId={battleId}` via `useRouter().push()`

- [ ] **Step 5: Verify compilation**

Run: `npx tsc --noEmit`

- [ ] **Step 6: Commit**

```bash
git add "app/(game)/_components/BossQueueBar.tsx" "app/(game)/_components/BossQueuePlayersDropdown.tsx" "app/(game)/_components/BossMatchModal.tsx"
git commit -m "Adiciona barra de fila flutuante, dropdown de jogadores e modal de match"
```

---

### Task 4: Integrate in Layout + Dashboard

**Files:**
- Modify: `app/(game)/layout.tsx`
- Modify: `app/(game)/dashboard/page.tsx`

- [ ] **Step 1: Read current files**

Read `app/(game)/layout.tsx` and `app/(game)/dashboard/page.tsx` fully.

- [ ] **Step 2: Modify layout.tsx**

Add to layout.tsx:
1. Import `BossQueueProvider` from `_hooks/useBossQueue`
2. Import `BossQueueBar` and `BossMatchModal`
3. Wrap the `<main>` content with `<BossQueueProvider>`:
   ```tsx
   <BossQueueProvider>
     <main className="pt-20 ...">
       {children}
     </main>
     <BossQueueBar />
     <BossMatchModal />
   </BossQueueProvider>
   ```
4. Add `pb-16` to main when queue is active (space for floating bar) — OR always add padding-bottom since the bar is fixed and overlays content

- [ ] **Step 3: Add BossFightCard to dashboard**

In `dashboard/page.tsx`:
1. Add state: `eligible`, `dominantCategory`, `categoryBreakdown`
2. Fetch `GET /api/battle/coop/eligible` in `fetchData()` alongside other fetches
3. Add `BossFightCard` inline component (same pattern as `PveBattleButton`):
   - When eligible: gradient purple card with "Boss Fight Disponível!", category badge, "Entrar na Fila" button
   - Button calls `joinQueue(dominantCategory)` from `useBossQueue()`
   - When already participated: gray card "Já participou hoje"
   - When not eligible (incomplete tasks): don't render
4. Render in sidebar, above or below `PveBattleButton`

- [ ] **Step 4: Verify compilation and test manually**

Run: `npx tsc --noEmit`
Manual: Load dashboard with 5/5 tasks → BossFightCard should appear

- [ ] **Step 5: Commit**

```bash
git add "app/(game)/layout.tsx" "app/(game)/dashboard/page.tsx"
git commit -m "Integra fila de boss fight no layout e dashboard"
```

---

### Task 5: Boss Fight Page — Arena Layout

**Files:**
- Create: `app/(game)/boss-fight/page.tsx`
- Create: `app/(game)/boss-fight/_components/CoopBattleArena.tsx`
- Create: `app/(game)/boss-fight/_components/BossCard.tsx`
- Create: `app/(game)/boss-fight/_components/TeamPanel.tsx`
- Create: `app/(game)/boss-fight/_components/TurnTimer.tsx`

- [ ] **Step 1: Read existing battle patterns**

Read these files:
- `app/(game)/battle/page.tsx` — battle state machine pattern
- `app/(game)/battle/_components/BattleArena.tsx` — arena layout
- `app/(game)/battle/_components/StatusParticles.tsx` — status effect rendering
- `app/(game)/battle/_components/AttackEffect.tsx` — hit visual

- [ ] **Step 2: Create page.tsx**

`app/(game)/boss-fight/page.tsx`:
- `"use client"` component
- Reads `battleId` from URL search params
- Connects to Socket.io (reuse connection from useBossQueue or create dedicated one)
- State machine: `phase: "LOADING" | "BATTLE" | "RESULT"`
- State: boss data, team data (3 players), turn events, battle result
- Listen to Socket.io events:
  - `boss:turn:waiting` → enable skill selection, start turn timer
  - `boss:turn:result` → update state, animate events
  - `boss:battle:end` → set result, switch to RESULT phase
  - `boss:action:received` → update "Agiu" indicator for teammate
  - `boss:battle:player-disconnected` / `boss:battle:player-reconnected`
- Send `boss:action` when player selects skill
- On mount: if no battleId, redirect to /dashboard

- [ ] **Step 3: Create TurnTimer**

`TurnTimer.tsx`:
- Props: `timeRemaining: number`, `maxTime: number`
- Renders: horizontal bar that shrinks from full to empty
- Color: green → yellow → red as time decreases
- Text: "{seconds}s" centered
- Animate width with CSS transition

- [ ] **Step 4: Create BossCard**

`BossCard.tsx`:
- Props: boss name, tier, category, currentHp, maxHp, statusEffects[]
- Card with red border, centered at top
- HP bar (red gradient)
- Status effect badges (pulsing, with remaining turns)
- Integrate StatusParticles for visual effects
- Shake animation when taking damage (via prop `isHit`)

- [ ] **Step 5: Create TeamPanel**

`TeamPanel.tsx`:
- Props: team[] (3 players with name, hp, maxHp, statusEffects, isCurrentPlayer, hasActed, isAlive)
- 3 cards horizontal (`flex gap-4 justify-center`)
- Current player card: thicker green border
- Dead player: opacity 0.4, "Morto" text in red
- "Agiu" badge (green) or "Pensando..." (yellow/amber) per player
- HP bars (green)
- Status effect badges

- [ ] **Step 6: Create CoopBattleArena**

`CoopBattleArena.tsx`:
- Props: all battle state from page.tsx
- Layout:
  - Top: TurnTimer (full width)
  - Center-top: BossCard
  - Center: TeamPanel
  - Bottom: skill bar (left) + battle log (right) in flex row
- Responsive: on mobile, stack vertically

- [ ] **Step 7: Verify compilation**

Run: `npx tsc --noEmit`

- [ ] **Step 8: Commit**

```bash
git add "app/(game)/boss-fight/"
git commit -m "Adiciona página de boss fight com arena cooperativa"
```

---

### Task 6: Coop Skill Bar + Battle Result

**Files:**
- Create: `app/(game)/boss-fight/_components/CoopSkillBar.tsx`
- Create: `app/(game)/boss-fight/_components/CoopBattleResult.tsx`

- [ ] **Step 1: Read existing skill bar**

Read `app/(game)/battle/_components/SkillBar.tsx` — reuse pattern exactly.

- [ ] **Step 2: Create CoopSkillBar**

`CoopSkillBar.tsx`:
- Same pattern as SkillBar but with SINGLE_ALLY support
- Props: skills[], onSkillUse(skillId, targetId?), onSkipTurn(), disabled, teammates[]
- Grid 2x2 for skills + Skip button
- When player clicks a SINGLE_ALLY skill:
  - Show `AllyTargetSelector` inline (list of alive teammates as buttons)
  - Player picks teammate → calls `onSkillUse(skillId, targetId)`
- For SINGLE_ENEMY / SELF / ALL / ALL_ENEMIES / ALL_ALLIES: no target selection needed, just call onSkillUse(skillId)
- Cooldown overlay, damage type colors, SFX — same as original SkillBar
- Disabled state when not player's turn or player is dead

- [ ] **Step 3: Create CoopBattleResult**

`CoopBattleResult.tsx`:
- Same pattern as BattleResult but with boss-specific info
- Props: result ("VICTORY" | "DEFEAT"), expGained, essenceGained, levelsGained, bossName
- VICTORY: trophy icon, green, "+{exp} EXP", "+1 Essência de Boss", level up if applicable
- DEFEAT: skull icon, red, "0 EXP"
- SFX on mount (reuse /sfx/victory.mp3 and /sfx/defeat.mp3)
- "Voltar ao Dashboard" button → router.push("/dashboard")

- [ ] **Step 4: Wire into page.tsx**

Update `boss-fight/page.tsx` to render:
- CoopSkillBar in the arena bottom-left
- CoopBattleResult as overlay when phase === "RESULT"
- BattleLog (import from battle/_components/BattleLog) in arena bottom-right

- [ ] **Step 5: Verify compilation**

Run: `npx tsc --noEmit`

- [ ] **Step 6: Commit**

```bash
git add "app/(game)/boss-fight/_components/CoopSkillBar.tsx" "app/(game)/boss-fight/_components/CoopBattleResult.tsx" "app/(game)/boss-fight/page.tsx"
git commit -m "Adiciona skill bar cooperativa e modal de resultado"
```

---

### Task 7: Polish + Music Context

**Files:**
- Modify: `app/(game)/layout.tsx` — music context for boss-fight
- Modify: `app/(game)/_hooks/useMusicPlayer.ts` — add boss-fight as battle context

- [ ] **Step 1: Update music context**

In `layout.tsx`, the music context logic (line ~50) uses:
```typescript
const musicContext = pathname.startsWith("/battle") ? "battle" : "ambient";
```

Update to also treat `/boss-fight` as battle:
```typescript
const musicContext = (pathname.startsWith("/battle") || pathname.startsWith("/boss-fight")) ? "battle" : "ambient";
```

- [ ] **Step 2: Add padding-bottom when queue active**

In layout.tsx, the `<main>` element needs `pb-16` when queue bar is visible to prevent content from being hidden behind the fixed bar. Add conditionally based on `useBossQueue().inQueue`.

- [ ] **Step 3: Verify manually**

Manual test:
1. Enter queue → bar appears at bottom
2. Navigate to /character → bar persists
3. Navigate to /battle → bar persists, music stays battle
4. Match found → modal appears
5. Accept → redirect to /boss-fight → battle music plays

- [ ] **Step 4: Commit**

```bash
git add "app/(game)/layout.tsx"
git commit -m "Adiciona contexto de música para boss-fight e padding para barra de fila"
```

---

## Verification Checklist

- [ ] Dashboard: 5/5 tasks → BossFightCard aparece com "Entrar na Fila"
- [ ] Clicar "Entrar na Fila" → barra inferior aparece com timer 5min
- [ ] Navegar entre páginas → barra persiste
- [ ] "Ver Jogadores" → dropdown com feed de atividade
- [ ] 3 usuários na fila → modal "Match Encontrado" nos 3
- [ ] Aceitar → redirect para /boss-fight
- [ ] Batalha: escolher skills, ver "Agiu/Pensando", turn timer 30s
- [ ] SINGLE_ALLY skill → seletor de aliado aparece
- [ ] Boss morre → "VITÓRIA!" com EXP + Essência
- [ ] Voltar ao dashboard → "Já participou hoje"
- [ ] Timeout 5min na fila → mensagem + removido da fila
- [ ] Recusar match → volta pra fila
- [ ] Music: boss-fight page toca battle tracks
