# Mobile Responsiveness Fixes — Spec

**Data:** 2026-05-03
**Branch sugerida:** `fix/responsividade-mobile`
**Tipo:** Bug fix / UX
**Escopo:** Frontend apenas (zero backend, zero migration)

---

## Contexto

O usuario reportou que toda funcionalidade nova esta sem responsividade adequada no celular. Tres problemas concretos foram reportados:

1. **Bug critico — modais nao rolam no mobile.** Em modais como o `InventoryCardModal`, o usuario consegue ver a parte de cima (imagem, nome) mas nao consegue acessar funcionalidades de baixo (ex: sacrificar copias pra ganhar XP). O modal nao rola.
2. **`battle-multi` (1v3 / 1v5) — overflow horizontal.** O usuario precisa rolar lateralmente pra alcancar os inimigos no celular.
3. **Demais paginas novas (`coop-pve`, `boss-fight`, `inventario`, `character`, `bestiary`)** — sem auditoria mobile sistematica. "Toda funcionalidade nova esta sem responsividade".

A causa raiz dos modais: pattern atual usa container externo `grid place-items-center` + dialog interno com `maxHeight: calc(100vh - 104px)` e scroll **interno** apenas na coluna direita. Quando o layout vira `flex-col` no mobile, a coluna esquerda (imagem aspect 3/4 = ~75vh) consome quase toda altura util, deixando a coluna rolavel quase invisivel — e o `place-items-center` corta o que sobrar.

A causa raiz do `battle-multi`: provavelmente `min-width` em `MultiMobCard compact`, `MultiSkillBar` ou no log que estoura 100vw em telas de 360px.

## Nao-objetivos

- Nao criar componente compartilhado `<Modal>` / `<Drawer>` (escopo minimo viavel).
- Nao redesenhar visual — apenas destravar uso no mobile.
- Nao mexer em rotas admin (`(admin)/`).
- Nao adicionar testes automatizados de visual (Playwright / visual regression).
- Nao reescrever layout — apenas ajustes pontuais.
- Nao mexer em backend, types, migrations.

## Abordagem

Abordagem A — "Cirurgica". Fix por arquivo, sem refactor / sem componente compartilhado. Mesmo pattern aplicado nos modais, ajustes pontuais nas paginas.

---

## Pattern de modal mobile-first

### Pattern atual (com bug)

```tsx
<div
  onClick={onClose}
  className="fixed inset-0 z-40 grid place-items-center px-4 pt-[80px] pb-6 sm:px-6"
>
  <div
    role="dialog"
    onClick={(e) => e.stopPropagation()}
    className="flex w-full max-w-[860px] flex-col"
    style={{ maxHeight: "calc(100vh - 104px)" }}
  >
    <header>...</header>

    <div className="flex flex-1 flex-col overflow-hidden md:flex-row">
      <aside>{/* imagem + nome */}</aside>
      <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-5">
        {/* conteudo rolavel */}
      </div>
    </div>
  </div>
</div>
```

Bug: `place-items-center` + `maxHeight` + scroll interno no filho — no mobile a coluna esquerda ocupa quase tudo e o scroll interno fica invisivel.

### Pattern novo

```tsx
<div
  onClick={onClose}
  className="fixed inset-0 z-40 overflow-y-auto px-4 pt-[80px] pb-6 sm:px-6"
>
  <div
    role="dialog"
    onClick={(e) => e.stopPropagation()}
    className="mx-auto flex w-full max-w-[860px] flex-col md:my-auto md:max-h-[calc(100vh-104px)]"
  >
    <header className="sticky top-0 z-10">{/* header com close */}</header>

    <div className="flex flex-1 flex-col md:flex-row md:overflow-hidden">
      <aside>{/* imagem + nome */}</aside>
      <div className="flex flex-1 flex-col gap-4 p-5 md:overflow-y-auto">
        {/* conteudo */}
      </div>
    </div>
  </div>
</div>
```

Mudancas chave:
- Container externo: `grid place-items-center` → `overflow-y-auto`. O scroll vai pro container, nao pro filho.
- Dialog: `maxHeight` removido no mobile, restrito apenas em `md:max-h-[calc(100vh-104px)]` + `md:my-auto` pra centralizar no desktop.
- Conteudo: `overflow-hidden` / `overflow-y-auto` movidos pra `md:` apenas. No mobile, o pai rola.
- Header: `sticky top-0 z-10` pra botao "fechar" continuar acessivel enquanto rola.

### Touch targets

Botao de fechar dos modais: `h-8 w-8` → `h-10 w-10 md:h-8 md:w-8`. Apple HIG / Material recomendam minimo 44x44 pra mobile.

### Sticky header — cuidado com background

Headers sticky precisam de `background` solido (nao transparente) pra nao deixar conteudo aparecer atras. Manter o gradiente/cor que ja esta no header.

---

## Modais a corrigir (13)

| Arquivo | Path |
|---|---|
| InventoryCardModal | `app/(game)/inventario/_components/InventoryCardModal.tsx` |
| BestiaryDetailModal | `app/(game)/bestiary/_components/BestiaryDetailModal.tsx` |
| CardPickerModal | `app/(game)/character/_components/CardPickerModal.tsx` |
| SpectralSkillSelectModal | `app/(game)/character/_components/SpectralSkillSelectModal.tsx` |
| SkillSelectModal | `app/(game)/character/_components/SkillSelectModal.tsx` |
| ShowcaseEditor | `app/(game)/character/_components/ShowcaseEditor.tsx` |
| Pvp1v1BattleResult | `app/(game)/pvp-1v1/_components/Pvp1v1BattleResult.tsx` |
| PvpTeamBattleResult | `app/(game)/pvp-team/_components/PvpTeamBattleResult.tsx` |
| CoopPveResult | `app/(game)/coop-pve/_components/CoopPveResult.tsx` |
| CoopBattleResult (boss) | `app/(game)/boss-fight/_components/CoopBattleResult.tsx` |
| PvpTeamMatchModal | `app/(game)/_components/PvpTeamMatchModal.tsx` |
| BossMatchModal | `app/(game)/_components/BossMatchModal.tsx` |
| InviteFriendModal (coop) | `app/(game)/coop-pve/_components/InviteFriendModal.tsx` |

### Modais que pulam (sao pequenos / nao tem problema)

- `app/(game)/_components/PvpTeamInviteNotification.tsx` (banner)
- `app/(game)/_components/CoopPveInviteNotification.tsx` (banner)
- `app/(game)/battle/_components/CardDropReveal.tsx` (overlay celula unica)
- `app/(game)/battle/_components/CardXpReveal.tsx` (overlay xp)
- `app/(admin)/admin/_components/confirm-modal.tsx` (admin nao requer mobile)

---

## Fixes nao-modais

### `battle-multi` (1v3 / 1v5)

Bloco mobile ja existe (`md:hidden` no `MultiBattleArena`, linha 596+) com layout 3+2 pra 1v5. O scroll horizontal vem de algum filho que estoura.

Investigacao no fix:
1. Auditar `MultiMobCard` em modo `compact` — procurar `min-width`, padding fixo, font-size em px que extrapole.
2. Auditar `MultiSkillBar` — grid 2x2 pode ter `min-width` por celula.
3. Auditar BattleLog — pode estar sem `min-w-0` em flex container ou ter texto grande sem `break-words`.
4. Garantir que o container raiz da page tem `overflow-x-hidden` ou que cada flex child tem `min-w-0`.

Fix: ajustes pontuais (reduzir padding, adicionar `min-w-0`, `truncate`, `text-[10px] sm:text-xs`). Sem reescrever layout.

### `coop-pve` (`/coop-pve`)

Auditar arena em viewport 360px:
- Mesmo padrao de overflow horizontal possivelmente.
- Skill bar e log seguem mesma logica do `battle-multi`.

### `boss-fight` (`/boss-fight`)

Auditar arena. 3v1, com 3 player cards + 1 boss grande.
- Player cards no mobile podem ter min-width
- Boss card pode ter aspect ratio que nao cabe

### `inventario` (page)

Grid de cartas ja e 2/3/4/6 cols. Auditar:
- `InventoryStats` no topo (4 cards) — provavelmente vira `grid-cols-2` no mobile.
- `InventoryFilters` — toggles + selects + search. Se nao empilhar ja, ajustar.

### `character` (page)

Auditar `CardSlots` — se cada slot tem `min-width` que estoura.

### `bestiary` (page)

Grid ja parece responsivo. Verificacao rapida apenas.

---

## Breakpoints

Manter consistencia com o que ja existe no projeto:
- `sm:` = 640px
- `md:` = 768px (separator mobile/desktop usado nos modais)
- `lg:` = 1024px

Viewports de teste:
- 360px x 800px (Galaxy S20 menor — pior caso real)
- 414px x 900px (iPhone 14 Pro Max — folga)

---

## Verificacao

### Manual

Para cada modal corrigido:
1. Abrir o modal em viewport 360px (Chrome DevTools)
2. Confirmar que rola ate o fim (scroll vertical funciona)
3. Confirmar que o botao "fechar" continua acessivel ao rolar (sticky)
4. Confirmar que nao tem scroll lateral indesejado
5. Confirmar que clicar fora fecha (preserva comportamento original)
6. Confirmar layout md+ inalterado (smoke test em viewport 1280px)

Para cada arena de batalha:
1. Abrir a pagina em viewport 360px
2. Confirmar zero scroll horizontal na arena
3. Executar 1 turno completo (selecionar skill, alvo, executar)
4. Confirmar log e player HP visiveis

### Automatica

`npx tsc --noEmit` ao fim de cada commit pra garantir que tipagem nao quebrou.

### Fora de escopo

- Browsers reais (iOS Safari / Android Chrome). Apenas DevTools. Se aparecer bug em device real, fix em ciclo separado.
- Visual regression / Playwright.

---

## Estrategia de commits

Branch nova `fix/responsividade-mobile` (separada da `feat/pvp-team-2v2`).

Commits agrupados por tema (cada commit isolado / facil de reverter):

1. `Fix: scroll de modais grandes no mobile (inventario, bestiary, character)`
2. `Fix: scroll de modais de resultado e match (pvp-1v1, pvp-team, coop, boss)`
3. `Fix: overflow horizontal em battle-multi 1v5`
4. `Fix: overflow / layout mobile em coop-pve e boss-fight`
5. `Fix: layout mobile do inventario (filtros e stats)`
6. `Fix: layout mobile dos slots de carta em character` (se necessario)

Estimativa: ~12-18 arquivos editados.

---

## Riscos e mitigacoes

| Risco | Mitigacao |
|---|---|
| Sticky header com background transparente deixa conteudo passar atras | Conferir background do header ao migrar pattern, garantir cor solida |
| Algum modal usa logica especifica (focus trap, keyboard) que quebra com novo pattern | Preservar todo handler de keyboard / focus existente — so muda CSS |
| Em desktop, mudar de `grid place-items-center` pra `overflow-y-auto + my-auto` pode mudar centralizacao se conteudo for muito curto | Testar em viewport 1280px que modal continua centralizado |
| Modais com layout diferente do padrao (ex: ShowcaseEditor) podem precisar de ajuste especifico | Auditar caso a caso — pattern e guideline, nao regra cega |
| Battle pages tem WebSocket / state real-time — fix CSS nao deve quebrar, mas conferir | Smoke test executando 1 turno apos fix |

---

## Definicao de pronto

- [ ] Todos os 13 modais listados rolam ate o fim no viewport 360px
- [ ] Botao fechar acessivel em todos os modais corrigidos
- [ ] `battle-multi` 1v5 sem scroll horizontal em 360px
- [ ] `coop-pve` e `boss-fight` sem scroll horizontal em 360px
- [ ] `inventario` filtros/stats empilhando bem em 360px
- [ ] `character` slots cabendo em 360px
- [ ] `npx tsc --noEmit` passa
- [ ] Layouts md+ preservados (smoke test 1280px)
- [ ] Branch `fix/responsividade-mobile` criada e commits agrupados conforme plano
