# Mobile Responsiveness Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Corrigir bug de scroll dos modais no mobile, overflow horizontal em batalhas multi-mob e responsividade geral das paginas novas.

**Architecture:** Fix cirurgico arquivo-por-arquivo (sem componente compartilhado). Modais migrados pra pattern mobile-first (scroll no container externo + header sticky + maxHeight so em md+). Paginas de batalha auditadas pra eliminar `min-width` que estoura 100vw.

**Tech Stack:** Next.js 15 App Router, Tailwind CSS v4, React 19. Sem alteracao de backend / dados / migrations.

**Spec:** `docs/superpowers/specs/2026-05-03-mobile-responsiveness-fixes-design.md`

---

## Pattern Reference — Canonical Modal Transformation

Esta secao define a transformacao deterministica aplicada em cada modal. Todas as Tasks de modal (Tasks 2-14) referenciam este pattern.

### Antes (com bug)

```tsx
<div
  onClick={onClose}
  className="fixed inset-0 z-40 grid place-items-center px-4 pt-[80px] pb-6 sm:px-6"
  style={{ background: "rgba(5, 3, 10, 0.85)", backdropFilter: "blur(6px)" }}
>
  <div
    ref={dialogRef}
    role="dialog"
    aria-modal="true"
    onClick={(e) => e.stopPropagation()}
    className="flex w-full max-w-[860px] flex-col"
    style={{ maxHeight: "calc(100vh - 104px)", /* ... */ }}
  >
    <header className="flex items-center justify-between border-b px-5 py-4">
      {/* ... */}
      <button className="flex h-8 w-8 ...">×</button>
    </header>

    <div className="flex flex-1 flex-col overflow-hidden md:flex-row">
      <aside>{/* imagem / col esquerda */}</aside>
      <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-5">
        {/* conteudo */}
      </div>
    </div>
  </div>
</div>
```

### Depois (mobile-first)

```tsx
<div
  onClick={onClose}
  className="fixed inset-0 z-40 overflow-y-auto px-4 pt-[80px] pb-6 sm:px-6"
  style={{ background: "rgba(5, 3, 10, 0.85)", backdropFilter: "blur(6px)" }}
>
  <div
    ref={dialogRef}
    role="dialog"
    aria-modal="true"
    onClick={(e) => e.stopPropagation()}
    className="mx-auto flex w-full max-w-[860px] flex-col md:my-auto md:max-h-[calc(100vh-104px)]"
    style={{ /* ... mantem o restante do style sem maxHeight */ }}
  >
    <header
      className="sticky top-0 z-10 flex items-center justify-between border-b px-5 py-4"
      style={{ background: "var(--bg-secondary)" }}
    >
      {/* ... */}
      <button className="flex h-10 w-10 md:h-8 md:w-8 ...">×</button>
    </header>

    <div className="flex flex-1 flex-col md:flex-row md:overflow-hidden">
      <aside>{/* imagem / col esquerda */}</aside>
      <div className="flex flex-1 flex-col gap-4 p-5 md:overflow-y-auto">
        {/* conteudo */}
      </div>
    </div>
  </div>
</div>
```

### Regras de transformacao

1. **Container externo:**
   - Trocar `grid place-items-center` por `overflow-y-auto`
   - Trocar `flex items-center justify-center` por `overflow-y-auto`
   - Manter `fixed inset-0`, padding, background, backdropFilter
2. **Dialog interno:**
   - Adicionar `mx-auto md:my-auto`
   - Mover `maxHeight` (style) pra Tailwind `md:max-h-[calc(100vh-104px)]` (ou mantem o calc original se for diferente; aplicar so em md+)
   - Remover `maxHeight` do `style` inline
3. **Header:**
   - Adicionar `sticky top-0 z-10`
   - Garantir `background` solido (CSS variable, nao transparente). Se o header nao tem background, adicionar `style={{ background: "var(--bg-secondary)" }}` (ou bg-card, conforme o tema do modal)
4. **Botao fechar:**
   - `h-8 w-8` → `h-10 w-10 md:h-8 md:w-8`
5. **Conteudo (filho do dialog):**
   - `overflow-hidden` → `md:overflow-hidden` (so em md+)
   - `overflow-y-auto` (na coluna interna) → `md:overflow-y-auto` (so em md+)
   - No mobile o pai (container externo) rola.

### Modais sem layout 2-coluna

Para modais que ja sao single-column centered (ex: `Pvp1v1BattleResult`, `BossMatchModal`):
- Aplicar regras 1-4 (container externo + sticky header + close button)
- Regra 5 nao se aplica (nao ha duas colunas / scroll interno)
- Garantir que o body do modal nao tem `maxHeight` no mobile

### Acessibilidade preservada

NAO mexer em:
- Handlers de keyboard (`Escape`, `Tab` focus trap)
- `role="dialog"`, `aria-modal`, `aria-label`
- `useRef` / `useEffect` de focus management
- Logica de close on backdrop click

### Verificacao manual padrao (executada em cada Task de modal)

1. Subir dev: `npm run dev` (se ainda nao estiver rodando)
2. Chrome DevTools → Toggle device toolbar → Custom 360 x 800
3. Logar e abrir o modal alvo
4. Confirmar que o modal rola ate o fim (ate o ultimo botao/secao visivel)
5. Confirmar que o botao "fechar" continua acessivel ao rolar
6. Confirmar zero scroll horizontal
7. Trocar viewport pra 1280px → confirmar que layout desktop esta inalterado (modal centralizado, scroll interno na coluna direita)
8. Fechar modal clicando no backdrop pra confirmar que click-out ainda funciona
9. Pressionar Escape pra confirmar que keyboard close funciona

---

## Task 0: Setup — Branch nova

**Files:** Nenhum

- [ ] **Step 1: Criar branch a partir da atual**

```bash
git checkout -b fix/responsividade-mobile
```

- [ ] **Step 2: Confirmar branch limpa**

```bash
git status
```
Expected: `On branch fix/responsividade-mobile` + `nothing to commit` (exceto a `M .gitignore` em working copy do user, ignorar).

---

## Task 1: Garantir dev server rodando

**Files:** Nenhum

- [ ] **Step 1: Subir Next.js**

```bash
npm run dev
```

Em outro terminal (ou via `&` no PowerShell), subir tambem o socket server:

```bash
node server/index.js
```

- [ ] **Step 2: Confirmar acesso em `http://localhost:3000`**

Expected: pagina de login carrega sem erro de console.

---

## Task 2: Fix InventoryCardModal (bug critico reportado)

**Files:**
- Modify: `app/(game)/inventario/_components/InventoryCardModal.tsx`

Linhas relevantes (ler primeiro pra confirmar):
- Linha 228-236: container externo
- Linha 237-254: dialog
- Linha 256-309: header (com botao fechar linha 295-308)
- Linha 312: `<div className="flex flex-1 flex-col overflow-hidden md:flex-row">`
- Linha 390: `<div className="flex flex-1 flex-col gap-4 overflow-y-auto p-5">`

- [ ] **Step 1: Ler o arquivo pra confirmar contexto atual**

```bash
# usar Read tool no arquivo, focar nos blocos identificados
```

- [ ] **Step 2: Aplicar transformacao do Pattern Reference**

Mudancas exatas:

(a) Linha 230 — container externo:

Antes:
```tsx
className="fixed inset-0 z-40 grid place-items-center px-4 pt-[80px] pb-6 sm:px-6"
```

Depois:
```tsx
className="fixed inset-0 z-40 overflow-y-auto px-4 pt-[80px] pb-6 sm:px-6"
```

(b) Linhas 244-253 — dialog interno:

Antes:
```tsx
className={`flex w-full max-w-[860px] flex-col outline-none ${rarityClass}`}
style={{
  maxHeight: "calc(100vh - 104px)",
  background: "linear-gradient(180deg, var(--bg-secondary) 0%, var(--bg-primary) 100%)",
  border: "1px solid var(--rarity-color)",
  boxShadow: spectral
    ? "0 30px 80px var(--bg-primary), 0 0 50px rgba(244, 196, 90, 0.45)"
    : "0 30px 80px var(--bg-primary), 0 0 30px var(--rarity-glow)",
}}
```

Depois:
```tsx
className={`mx-auto flex w-full max-w-[860px] flex-col outline-none md:my-auto md:max-h-[calc(100vh-104px)] ${rarityClass}`}
style={{
  background: "linear-gradient(180deg, var(--bg-secondary) 0%, var(--bg-primary) 100%)",
  border: "1px solid var(--rarity-color)",
  boxShadow: spectral
    ? "0 30px 80px var(--bg-primary), 0 0 50px rgba(244, 196, 90, 0.45)"
    : "0 30px 80px var(--bg-primary), 0 0 30px var(--rarity-glow)",
}}
```

(c) Linhas 256-259 — header com sticky:

Antes:
```tsx
<header
  className="flex items-center justify-between border-b px-5 py-4"
  style={{ borderColor: "color-mix(in srgb, var(--gold) 14%, transparent)" }}
>
```

Depois:
```tsx
<header
  className="sticky top-0 z-10 flex items-center justify-between border-b px-5 py-4"
  style={{
    borderColor: "color-mix(in srgb, var(--gold) 14%, transparent)",
    background: "linear-gradient(180deg, var(--bg-secondary) 0%, var(--bg-primary) 100%)",
  }}
>
```

(d) Linhas 295-308 — botao fechar (touch target):

Antes:
```tsx
className="flex h-8 w-8 cursor-pointer items-center justify-center text-lg transition-colors"
```

Depois:
```tsx
className="flex h-10 w-10 cursor-pointer items-center justify-center text-lg transition-colors md:h-8 md:w-8"
```

(e) Linha 312 — wrapper do conteudo:

Antes:
```tsx
<div className="flex flex-1 flex-col overflow-hidden md:flex-row">
```

Depois:
```tsx
<div className="flex flex-1 flex-col md:flex-row md:overflow-hidden">
```

(f) Linha 390 — coluna direita scrollavel:

Antes:
```tsx
<div className="flex flex-1 flex-col gap-4 overflow-y-auto p-5">
```

Depois:
```tsx
<div className="flex flex-1 flex-col gap-4 p-5 md:overflow-y-auto">
```

- [ ] **Step 3: Type check**

```bash
npx tsc --noEmit
```

Expected: `0 errors` (ou pelo menos nenhum erro novo introduzido neste arquivo).

- [ ] **Step 4: Verificacao manual em viewport 360x800**

Seguir o procedimento "Verificacao manual padrao" do Pattern Reference. Caso especifico: abrir `/inventario`, clicar em uma carta que tenha duplicatas → confirmar que a secao "Sacrificar pra essa carta" e o botao "Sacrificar" estao acessiveis ao rolar.

- [ ] **Step 5: Commit**

```bash
git add app/(game)/inventario/_components/InventoryCardModal.tsx
git commit -m "Fix: scroll do InventoryCardModal no mobile"
```

---

## Task 3: Fix BestiaryDetailModal

**Files:**
- Modify: `app/(game)/bestiary/_components/BestiaryDetailModal.tsx`

Linhas relevantes (mesmo pattern do InventoryCardModal):
- Linha 245-253: container externo + dialog (`grid place-items-center` + `maxHeight: calc(100vh - 104px)`)
- Linha 273-276: header
- Linha 320-333: botao fechar (`h-8 w-8`)
- Linha 337: wrapper conteudo (`overflow-hidden md:flex-row`)
- Linha 462: coluna direita scrollavel

- [ ] **Step 1: Ler o arquivo nas linhas indicadas**

- [ ] **Step 2: Aplicar transformacao**

(a) Linha 247 — container externo:

Antes: `className="fixed inset-0 z-40 grid place-items-center px-4 pt-[80px] pb-6 sm:px-6"`

Depois: `className="fixed inset-0 z-40 overflow-y-auto px-4 pt-[80px] pb-6 sm:px-6"`

(b) Linhas 254-271 — dialog interno:

- Adicionar `mx-auto md:my-auto md:max-h-[calc(100vh-104px)]` no className
- Remover `maxHeight: "calc(100vh - 104px)"` do style

(c) Linhas 273-276 — header:

Adicionar `sticky top-0 z-10` no className. Trocar style pra incluir background:
```tsx
style={{
  borderColor: "color-mix(in srgb, var(--gold) 14%, transparent)",
  background: "linear-gradient(180deg, var(--bg-secondary) 0%, var(--bg-primary) 100%)",
}}
```

(d) Linha 324 — botao fechar:

`h-8 w-8` → `h-10 w-10 md:h-8 md:w-8`

(e) Linha 337 — wrapper:

`flex flex-1 flex-col overflow-hidden md:flex-row` → `flex flex-1 flex-col md:flex-row md:overflow-hidden`

(f) Linha 462 — coluna direita:

`flex flex-1 flex-col gap-5 overflow-y-auto p-5` → `flex flex-1 flex-col gap-5 p-5 md:overflow-y-auto`

- [ ] **Step 3: Type check**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Verificacao manual**

Seguir Verificacao manual padrao em `/bestiary`. Abrir um mob com varias variantes coletadas → rolar ate "Curiosidade" no fim. Tambem testar modal vazio (mob desconhecido).

- [ ] **Step 5: Commit**

```bash
git add app/(game)/bestiary/_components/BestiaryDetailModal.tsx
git commit -m "Fix: scroll do BestiaryDetailModal no mobile"
```

---

## Task 4: Fix CardPickerModal

**Files:**
- Modify: `app/(game)/character/_components/CardPickerModal.tsx`

Linhas relevantes:
- Linha 168: `className="fixed inset-0 z-50 grid place-items-center p-6"`
- Linha 184: `maxHeight: "calc(100vh - 48px)"`

Layout: provavelmente single-column ou 2-col simples (ler arquivo).

- [ ] **Step 1: Ler arquivo completo**

```bash
# Read tool em app/(game)/character/_components/CardPickerModal.tsx
```

- [ ] **Step 2: Aplicar transformacao**

(a) Linha 168 — container externo:

Antes: `className="fixed inset-0 z-50 grid place-items-center p-6"`

Depois: `className="fixed inset-0 z-50 overflow-y-auto p-6"`

(b) Dialog interno (linha 184 area):

- Adicionar `mx-auto md:my-auto md:max-h-[calc(100vh-48px)]` no className do dialog
- Remover `maxHeight: "calc(100vh - 48px)"` do style

(c) Header (procurar — primeiro bloco apos a abertura do dialog):

Adicionar `sticky top-0 z-10` + garantir background solido.

(d) Botao fechar (procurar `h-8 w-8` ou similar):

Aplicar `h-10 w-10 md:h-8 md:w-8`.

(e) Se houver layout `md:flex-row` com scroll interno:

Mover `overflow-hidden` / `overflow-y-auto` pra `md:` only.

Se for single-column sem scroll interno, regras (e) nao se aplicam.

- [ ] **Step 3: Type check**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Verificacao manual**

Em `/character`, clicar em um slot vazio → modal de selecao de carta abre. Rolar a lista ate o fim. Filtrar por raridade / tipo se houver controles. Confirmar que botao confirmar (se existir) fica acessivel.

- [ ] **Step 5: Commit**

```bash
git add app/(game)/character/_components/CardPickerModal.tsx
git commit -m "Fix: scroll do CardPickerModal no mobile"
```

---

## Task 5: Fix SkillSelectModal

**Files:**
- Modify: `app/(game)/character/_components/SkillSelectModal.tsx`

Linhas relevantes:
- Linha 118: `className="fixed inset-0 z-50 grid place-items-center p-6"`
- Linha 134: `maxHeight: "calc(100vh - 48px)"`

- [ ] **Step 1: Ler arquivo completo**

- [ ] **Step 2: Aplicar transformacao** (mesmas regras da Task 4)

(a) Container externo: `grid place-items-center` → `overflow-y-auto`

(b) Dialog: adicionar `mx-auto md:my-auto md:max-h-[calc(100vh-48px)]`, remover `maxHeight` do style

(c) Header: adicionar `sticky top-0 z-10` + background solido

(d) Botao fechar: `h-10 w-10 md:h-8 md:w-8`

(e) Se houver scroll interno em sublista de skills, mover pra `md:overflow-y-auto`

- [ ] **Step 3: Type check**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Verificacao manual**

Em `/character`, clicar em um slot de skill → modal abre. Rolar lista. Confirmar selecao + botao confirmar acessiveis.

- [ ] **Step 5: Commit**

```bash
git add app/(game)/character/_components/SkillSelectModal.tsx
git commit -m "Fix: scroll do SkillSelectModal no mobile"
```

---

## Task 6: Fix SpectralSkillSelectModal

**Files:**
- Modify: `app/(game)/character/_components/SpectralSkillSelectModal.tsx`

Linhas relevantes:
- Linha 203: `className="fixed inset-0 z-50 grid place-items-center p-6"`

- [ ] **Step 1: Ler arquivo completo (focar nos blocos do modal)**

- [ ] **Step 2: Aplicar transformacao** (mesmas regras das Tasks 4-5)

(a) Container externo

(b) Dialog (procurar maxHeight no style — aplicar mesma migracao pra `md:`)

(c) Header sticky

(d) Botao fechar com touch target maior

(e) Scrolls internos pra `md:` only

- [ ] **Step 3: Type check**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Verificacao manual**

Em `/inventario`, clicar numa carta Espectral → modal de detalhes abre → clicar "Definir/Trocar skill espectral" → SpectralSkillSelectModal abre por cima. Rolar lista de skills. Confirmar selecao.

- [ ] **Step 5: Commit**

```bash
git add app/(game)/character/_components/SpectralSkillSelectModal.tsx
git commit -m "Fix: scroll do SpectralSkillSelectModal no mobile"
```

---

## Task 7: Fix ShowcaseEditor

**Files:**
- Modify: `app/(game)/character/_components/ShowcaseEditor.tsx`

Linhas relevantes:
- Linha 127: `className="fixed inset-0 z-[80] flex items-center justify-center px-4"`

(Nota: este modal usa `flex items-center justify-center` em vez de `grid place-items-center` — mesma transformacao se aplica.)

- [ ] **Step 1: Ler arquivo completo**

- [ ] **Step 2: Aplicar transformacao**

(a) Container externo:
Antes: `className="fixed inset-0 z-[80] flex items-center justify-center px-4"`
Depois: `className="fixed inset-0 z-[80] overflow-y-auto px-4 py-6"`

(Adicionar `py-6` pra dar respiro vertical, ja que removemos `items-center`.)

(b) Dialog: adicionar `mx-auto md:my-auto md:max-h-[calc(100vh-48px)]` (ajustar valor se houver maxHeight diferente)

(c) Header: sticky + background

(d) Botao fechar: touch target

(e) Scrolls internos: mover pra `md:`

- [ ] **Step 3: Type check**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Verificacao manual**

Em `/character/[id]/showcase` (sendo o dono), clicar "Editar vitrine" → ShowcaseEditor abre. Selecionar/trocar cartas. Confirmar que botao salvar fica acessivel ao rolar.

- [ ] **Step 5: Commit**

```bash
git add app/(game)/character/_components/ShowcaseEditor.tsx
git commit -m "Fix: scroll do ShowcaseEditor no mobile"
```

---

## Task 8: Fix Pvp1v1BattleResult

**Files:**
- Modify: `app/(game)/pvp-1v1/_components/Pvp1v1BattleResult.tsx`

Linhas relevantes:
- Linha 37: `className="fixed inset-0 z-50 grid place-items-center"`

(Modal de resultado — geralmente single-column, sem scroll interno em coluna.)

- [ ] **Step 1: Ler arquivo completo**

- [ ] **Step 2: Aplicar transformacao**

(a) Container externo:
Antes: `className="fixed inset-0 z-50 grid place-items-center"`
Depois: `className="fixed inset-0 z-50 overflow-y-auto px-4 py-6"`

(Adicionar padding pra evitar dialog colado nas bordas no mobile.)

(b) Dialog: adicionar `mx-auto md:my-auto`. Se houver `maxHeight` no style, mover pra `md:max-h-[...]`. Senao, deixar.

(c) Se houver header com botao fechar: aplicar sticky + touch target. Se for so botao "Voltar/Continuar" no fim, manter.

- [ ] **Step 3: Type check**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Verificacao manual**

Iniciar batalha PvP 1v1, jogar ate o fim. Modal de resultado aparece — rolar conteudo (XP, level up, drops). Confirmar que botoes finais sao acessiveis.

- [ ] **Step 5: Commit**

```bash
git add app/(game)/pvp-1v1/_components/Pvp1v1BattleResult.tsx
git commit -m "Fix: scroll do Pvp1v1BattleResult no mobile"
```

---

## Task 9: Fix PvpTeamBattleResult

**Files:**
- Modify: `app/(game)/pvp-team/_components/PvpTeamBattleResult.tsx`

Linhas relevantes:
- Linha 37: `className="fixed inset-0 z-50 grid place-items-center"`

- [ ] **Step 1: Ler arquivo completo**

- [ ] **Step 2: Aplicar transformacao** (mesmas regras da Task 8)

(a) Container externo: `grid place-items-center` → `overflow-y-auto px-4 py-6`

(b) Dialog: `mx-auto md:my-auto`

(c) Header (se houver): sticky + touch target

- [ ] **Step 3: Type check**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Verificacao manual**

Mesmo procedimento da Task 8, no PvP Team 2v2.

- [ ] **Step 5: Commit**

```bash
git add app/(game)/pvp-team/_components/PvpTeamBattleResult.tsx
git commit -m "Fix: scroll do PvpTeamBattleResult no mobile"
```

---

## Task 10: Fix CoopPveResult

**Files:**
- Modify: `app/(game)/coop-pve/_components/CoopPveResult.tsx`

Linhas relevantes:
- Linha 24: `className="fixed inset-0 z-50 grid place-items-center"`

- [ ] **Step 1: Ler arquivo completo**

- [ ] **Step 2: Aplicar transformacao** (mesmas regras das Tasks 8-9)

- [ ] **Step 3: Type check**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Verificacao manual**

Iniciar coop PvE, jogar ate o fim. Modal de resultado — rolar.

- [ ] **Step 5: Commit**

```bash
git add app/(game)/coop-pve/_components/CoopPveResult.tsx
git commit -m "Fix: scroll do CoopPveResult no mobile"
```

---

## Task 11: Fix CoopBattleResult (boss-fight)

**Files:**
- Modify: `app/(game)/boss-fight/_components/CoopBattleResult.tsx`

Linhas relevantes:
- Linha 62: `<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 animate-coop-fade-in">`

(Variacao: usa `flex items-center justify-center` + `bg-black/70` direto + animacao.)

- [ ] **Step 1: Ler arquivo completo**

- [ ] **Step 2: Aplicar transformacao**

(a) Container externo:
Antes: `<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 animate-coop-fade-in">`
Depois: `<div className="fixed inset-0 z-50 overflow-y-auto bg-black/70 px-4 py-6 animate-coop-fade-in">`

(b) Dialog: adicionar `mx-auto md:my-auto`

(c) Se houver maxHeight no dialog: mover pra `md:`

- [ ] **Step 3: Type check**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Verificacao manual**

Iniciar boss fight 3v1, jogar ate o fim. Modal de resultado — rolar.

- [ ] **Step 5: Commit**

```bash
git add app/(game)/boss-fight/_components/CoopBattleResult.tsx
git commit -m "Fix: scroll do CoopBattleResult no mobile"
```

---

## Task 12: Fix PvpTeamMatchModal

**Files:**
- Modify: `app/(game)/_components/PvpTeamMatchModal.tsx`

Linhas relevantes:
- Linha 33: `<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">`

- [ ] **Step 1: Ler arquivo completo**

- [ ] **Step 2: Aplicar transformacao** (mesmas regras da Task 11)

(a) Container externo: `flex items-center justify-center bg-black/70` → `overflow-y-auto bg-black/70 px-4 py-6`

(b) Dialog: `mx-auto md:my-auto`

- [ ] **Step 3: Type check**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Verificacao manual**

Entrar na fila do PvP Team 2v2 com um amigo. Modal de match aparece — confirmar que esta visivel e botoes (aceitar/rejeitar) acessiveis.

- [ ] **Step 5: Commit**

```bash
git add app/(game)/_components/PvpTeamMatchModal.tsx
git commit -m "Fix: layout mobile do PvpTeamMatchModal"
```

---

## Task 13: Fix BossMatchModal

**Files:**
- Modify: `app/(game)/_components/BossMatchModal.tsx`

Linhas relevantes:
- Linha 33: `<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">`

- [ ] **Step 1: Ler arquivo completo**

- [ ] **Step 2: Aplicar transformacao** (mesmas regras da Task 12)

- [ ] **Step 3: Type check**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Verificacao manual**

Entrar na fila do boss fight 3v1. Modal de match — confirmar visivel + botoes acessiveis.

- [ ] **Step 5: Commit**

```bash
git add app/(game)/_components/BossMatchModal.tsx
git commit -m "Fix: layout mobile do BossMatchModal"
```

---

## Task 14: Fix InviteFriendModal (coop)

**Files:**
- Modify: `app/(game)/coop-pve/_components/InviteFriendModal.tsx`

Linhas relevantes:
- Linha 175: `className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"`

- [ ] **Step 1: Ler arquivo completo**

- [ ] **Step 2: Aplicar transformacao** (mesmas regras das Tasks 12-13)

- [ ] **Step 3: Type check**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Verificacao manual**

Em `/coop-pve`, abrir lobby e clicar "Convidar amigo". Lista de amigos rola ate o fim. Botao convidar acessivel.

- [ ] **Step 5: Commit**

```bash
git add app/(game)/coop-pve/_components/InviteFriendModal.tsx
git commit -m "Fix: layout mobile do InviteFriendModal"
```

---

## Task 15: Fix battle-multi overflow horizontal (1v3 / 1v5)

**Files:**
- Modify: `app/(game)/battle-multi/_components/MultiBattleArena.tsx`
- Modify: `app/(game)/battle-multi/_components/MultiMobCard.tsx` (provavel)
- Modify: `app/(game)/battle-multi/_components/MultiSkillBar.tsx` (provavel)
- Modify: `app/(game)/battle-multi/page.tsx` (se houver container raiz)

Bloco mobile ja existe em `MultiBattleArena.tsx` linhas 596-647 (layout 3+2). Investigar quem estoura 100vw.

- [ ] **Step 1: Reproduzir o bug em viewport 360px**

Iniciar batalha 1v5 (PvE multi via `/battle-multi`). Em 360px, observar:
- Onde aparece o scroll horizontal? (toolbar do navegador deve mostrar)
- Qual elemento tem largura > 360?

Usar Chrome DevTools → Inspect → procurar por width vermelho na arvore.

- [ ] **Step 2: Auditar `MultiMobCard` em modo `compact`**

Ler `app/(game)/battle-multi/_components/MultiMobCard.tsx` completo. Procurar:
- `min-width:`, `minWidth:` no style
- `min-w-[Xpx]` no className
- Padding fixo grande (ex: `p-4` em compact)
- Font-size fixo grande

Se encontrar, reduzir ou tornar responsivo (ex: `p-2 sm:p-3`).

- [ ] **Step 3: Auditar `MultiSkillBar`**

Ler `app/(game)/battle-multi/_components/MultiSkillBar.tsx` completo. Procurar:
- Grid 2x2 com `min-width` por celula
- Texto de skill name sem `truncate` ou `break-words`
- Padding interno grande

Aplicar `min-w-0` em flex children, `truncate` em texto longo, padding responsivo.

- [ ] **Step 4: Garantir `min-w-0` em flex containers**

No `MultiBattleArena.tsx`, todo `flex` filho que pode ter conteudo grande precisa de `min-w-0` pra nao expandir alem do pai. Auditar:
- Linha 599: `<div className="flex gap-1.5 sm:gap-2">` — filhos ja tem `flex-1 min-w-0` ✓
- Linha 614, 630: similares ✓
- Verificar se containers superiores (player HP, log) tem mesmo cuidado

- [ ] **Step 5: Verificar overflow do container raiz da page**

Ler `app/(game)/battle-multi/page.tsx`. Se o root tem `overflow-x` que permite scroll, considerar adicionar `overflow-x-hidden` no root ou em algum container intermediario (mas APENAS se necessario — pode esconder bug de outro elemento).

- [ ] **Step 6: Type check**

```bash
npx tsc --noEmit
```

- [ ] **Step 7: Verificacao manual em viewport 360px**

1. `/battle-multi` em 1v5
2. Confirmar zero scroll horizontal
3. Selecionar uma skill SINGLE_ENEMY → ativar targeting → clicar em mob → executar turno
4. Confirmar que log atualiza, HP do mob alvo cai, animacao roda
5. Trocar pra 1v3, repetir

- [ ] **Step 8: Commit**

```bash
git add app/(game)/battle-multi/
git commit -m "Fix: overflow horizontal em battle-multi 1v3 e 1v5"
```

---

## Task 16: Fix coop-pve arena (overflow + layout mobile)

**Files:**
- Modify: arquivos em `app/(game)/coop-pve/_components/` (auditar quais)

- [ ] **Step 1: Listar componentes da arena coop-pve**

```bash
# Glob: app/(game)/coop-pve/_components/*.tsx
```

- [ ] **Step 2: Reproduzir layout em viewport 360px**

Iniciar coop PvE com 2 amigos (ou em modo dev se houver). Em 360px:
- Player cards (3 jogadores) cabem?
- Mob cards cabem?
- Skill bar cabe?
- Log cabe?

- [ ] **Step 3: Aplicar fixes pontuais**

Para cada componente que estoura:
- Adicionar `min-w-0` em flex children
- Reduzir padding/font no mobile
- Se tiver `min-width` fixo, trocar por valor menor ou remover

- [ ] **Step 4: Se nao houver branch mobile-specific, criar**

Se a arena coop-pve nao tem `md:hidden` block como o `MultiBattleArena`, considerar criar — mas APENAS se ajustes pontuais nao resolverem (escopo minimo viavel).

- [ ] **Step 5: Type check**

```bash
npx tsc --noEmit
```

- [ ] **Step 6: Verificacao manual**

`/coop-pve` em 360px. Sem scroll horizontal. Executar 1 turno completo.

- [ ] **Step 7: Commit**

```bash
git add app/(game)/coop-pve/
git commit -m "Fix: layout mobile do coop-pve"
```

---

## Task 17: Fix boss-fight arena (overflow + layout mobile)

**Files:**
- Modify: arquivos em `app/(game)/boss-fight/_components/` (auditar quais)

- [ ] **Step 1: Listar componentes da arena boss-fight**

```bash
# Glob: app/(game)/boss-fight/_components/*.tsx
```

- [ ] **Step 2: Reproduzir layout em viewport 360px**

Iniciar boss fight 3v1. Em 360px:
- 3 player cards + 1 boss grande cabem?
- Skill bar cabe?
- Log cabe?

- [ ] **Step 3: Aplicar fixes pontuais** (mesma estrategia da Task 16)

- [ ] **Step 4: Type check**

```bash
npx tsc --noEmit
```

- [ ] **Step 5: Verificacao manual**

`/boss-fight` em 360px. Sem scroll horizontal. Executar 1 turno completo (atacar, healer healing, revive se possivel).

- [ ] **Step 6: Commit**

```bash
git add app/(game)/boss-fight/
git commit -m "Fix: layout mobile do boss-fight 3v1"
```

---

## Task 18: Fix inventario page (filtros + stats no topo)

**Files:**
- Modify: `app/(game)/inventario/_components/InventoryStats.tsx`
- Modify: `app/(game)/inventario/_components/InventoryFilters.tsx`
- Modify: `app/(game)/inventario/page.tsx` (se houver layout root a ajustar)

- [ ] **Step 1: Reproduzir em viewport 360px**

`/inventario` em 360px. Observar:
- Os 4 cards do `InventoryStats` cabem? (provavelmente quebra em 4 colunas estreitas)
- O `InventoryFilters` empilha bem? (toggles raridade, select pureza, select equipada, search, ordenacao, botao reset)
- A grid de cartas (2/3/4/6 cols) ja deve estar OK

- [ ] **Step 2: Ajustar `InventoryStats`**

Ler arquivo. Se o grid esta `grid-cols-4`, mudar pra `grid-cols-2 md:grid-cols-4`. Reduzir tamanho dos numeros se necessario (`text-3xl md:text-4xl` por ex).

- [ ] **Step 3: Ajustar `InventoryFilters`**

Ler arquivo. Garantir:
- Toggles de raridade quebram em multiple linhas no mobile (`flex-wrap`)
- Selects ficam full-width no mobile (`w-full sm:w-auto`)
- Search input full-width no mobile
- Botao reset acessivel (talvez quebra de linha)

- [ ] **Step 4: Type check**

```bash
npx tsc --noEmit
```

- [ ] **Step 5: Verificacao manual**

`/inventario` em 360px. Aplicar filtros, mudar ordenacao, buscar. Nada deve cortar.

- [ ] **Step 6: Commit**

```bash
git add app/(game)/inventario/
git commit -m "Fix: layout mobile do inventario (filtros e stats)"
```

---

## Task 19: Fix character page (CardSlots e SkillSlots)

**Files:**
- Modify: arquivos em `app/(game)/character/_components/` (auditar quais)
- Modify: `app/(game)/character/page.tsx` (se necessario)

- [ ] **Step 1: Listar componentes da pagina character**

```bash
# Glob: app/(game)/character/_components/*.tsx
```

- [ ] **Step 2: Reproduzir em viewport 360px**

`/character` em 360px. Observar:
- CardSlots (5 slots de cartas) cabem em uma linha? Ou empilham?
- SkillSlots (4 slots de skills)?
- HouseBanner cabe?
- Atributos / habitos sidebar cabe?

- [ ] **Step 3: Auditar CardSlots e ajustar**

Ler `CardSlots.tsx`. Se 5 slots em linha estouram (cada slot ~70px + gap = 5 * 70 + 4 * 8 = 382px), considerar:
- Reduzir tamanho do slot no mobile (`w-[60px] sm:w-[80px]`)
- OU empilhar em 2 linhas (3 + 2)

- [ ] **Step 4: Auditar SkillSlots**

Mesma analise. Provavelmente 4 slots cabem em uma linha estreita.

- [ ] **Step 5: Type check**

```bash
npx tsc --noEmit
```

- [ ] **Step 6: Verificacao manual**

`/character` em 360px. Equipar/desequipar cartas, equipar/desequipar skills. Sem scroll horizontal.

- [ ] **Step 7: Commit**

```bash
git add app/(game)/character/
git commit -m "Fix: layout mobile do character (slots de cartas e skills)"
```

---

## Task 20: Auditar bestiary page (provavelmente nada)

**Files:**
- Modify: arquivos em `app/(game)/bestiary/_components/` (so se necessario)

- [ ] **Step 1: Reproduzir em viewport 360px**

`/bestiary` em 360px. A grid de mobs ja deve ser responsiva. Filtros no topo cabem?

- [ ] **Step 2: Se tudo OK, marcar task como completed sem commit**

Reportar "bestiary OK em 360px, sem ajustes necessarios".

- [ ] **Step 3: Se algo quebrar, ajustar e commitar**

```bash
git add app/(game)/bestiary/
git commit -m "Fix: layout mobile do bestiary (filtros)"
```

---

## Task 21: Verificacao final cross-page

**Files:** Nenhum

- [ ] **Step 1: Type check final**

```bash
npx tsc --noEmit
```

Expected: `0 errors`.

- [ ] **Step 2: Smoke test desktop (1280x800)**

Abrir cada pagina/modal corrigido em 1280x800 e confirmar layout desktop preservado:
- `/inventario` + abrir modal de carta (2 colunas, scroll interno na direita)
- `/bestiary` + abrir modal de mob (idem)
- `/character` + abrir CardPicker, SkillSelect, SpectralSkillSelect, ShowcaseEditor
- `/character/[id]/showcase` + ShowcaseEditor
- `/battle-multi` 1v5
- `/coop-pve`, `/boss-fight` (entrar em batalha)
- Modais de match (PvpTeam, Boss) e InviteFriend

- [ ] **Step 3: Smoke test mobile (360x800)**

Mesmas paginas/modais em 360x800. Confirmar todos rolam, zero overflow horizontal, botoes acessiveis.

- [ ] **Step 4: Resumo final**

Reportar:
- Numero total de arquivos modificados
- Numero total de commits
- Lista de bugs nao resolvidos (se houver)
- Recomendacoes pra futuras melhorias (ex: criar componente Modal compartilhado)

- [ ] **Step 5: Push da branch**

```bash
git push -u origin fix/responsividade-mobile
```

(Confirmar com o usuario antes de criar PR.)

---

## Self-Review

**Spec coverage:**
- Pattern de modal mobile-first → Pattern Reference + Tasks 2-14 ✓
- 13 modais listados → Tasks 2-14 (13 tasks) ✓
- battle-multi overflow → Task 15 ✓
- coop-pve / boss-fight → Tasks 16-17 ✓
- inventario page → Task 18 ✓
- character (slots) → Task 19 ✓
- bestiary auditoria → Task 20 ✓
- Verificacao manual em 360px e 1280px → Pattern Reference + Tasks ✓
- `tsc --noEmit` → cada task tem step de type check ✓
- Branch nova `fix/responsividade-mobile` → Task 0 ✓
- Commits agrupados → na pratica saiu 1 commit por task (mais granular que o spec sugeria, mas mais facil de reverter) ✓

**Placeholder scan:**
- Nenhum "TBD"/"TODO" no plano ✓
- Tasks 4-7, 16-19 instruem "ler arquivo primeiro" pra confirmar — isso nao e placeholder, e investigacao necessaria pra arquivos cujos detalhes nao foram lidos durante o brainstorming. As regras de transformacao sao deterministicas o suficiente.

**Type consistency:**
- Nenhuma tipagem nova ou refactor de funcao — apenas CSS. N/A.

**Gaps identificados:** Nenhum.
