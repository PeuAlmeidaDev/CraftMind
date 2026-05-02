# character/_components/ — Componentes da Tela do Personagem

## Proposito

Componentes Client usados exclusivamente na pagina `/character`. Todos usam `"use client"`.

## Componentes

| Arquivo | Descricao |
|---|---|
| `AttributePanel.tsx` | Mostra os 6 atributos do personagem. Dois modos: visualizacao (freePoints === 0) e distribuicao (freePoints > 0) com botoes +/- e preview. Chama `POST /api/character/distribute-points` ao confirmar. Cada stat tem botao `?` (componente interno `StatTooltip`) que abre tooltip explicativo. Estado controlado por `openStat: StatKey \| null` no proprio Panel; fecha com Esc, click fora ou novo click no botao. Textos definidos em `STAT_TOOLTIPS`. Modo visualizacao tambem expoe `<details>` "Como o dano e calculado?" no rodape. |
| `SkillLoadout.tsx` | Grid 2x2 com os 4 slots de skills equipadas. Slots ocupados mostram nome, tier badge, cooldown e tipo de dano, com botao X para desequipar. Slots vazios com borda tracejada e texto "Escolher skill". Callbacks: `onSlotClick(slotIndex)` e `onUnequip(slotIndex)`. |
| `SkillSelectModal.tsx` | Modal para selecionar uma skill para equipar num slot. Recebe lista de `CharacterSkillSlot[]`, filtra por tier (T1/T2/T3) e tipo de dano (Fisico/Magico/Suporte). Mostra badge de slot se a skill ja esta equipada em outro slot. Chama `onSelect(skillId, slotIndex)` ao clicar. |
| `SkillInventory.tsx` | Grid de referencia com todas as skills desbloqueadas (max 49). Mostra nome, tier badge, cooldown, tipo de dano, target, descricao, efeitos resumidos e badge de slot se equipada. Props: `skills: CharacterSkillSlot[]`. |
| `CharacterHeader.tsx` | Header responsivo: no mobile empilha verticalmente (flex-col, centralizado), no desktop 3 colunas em linha (flex-row). Avatar 64px mobile / 104px desktop com glow ember (upload mantido). Texto central (eyebrow Cinzel, nome Cormorant 24px/34px, motto Garamond italico, XP bar reta com ticks 25/50/75%). Medallion de nivel 64px/92px com 24 SVG ticks (viewBox fixo, escala via classe). Badge pontos livres com animacao freePulse. Watermark da casa em Cinzel 120px/240px opacity 4%. Padding wrapper interno `p-4 sm:px-7 sm:py-6` dentro do Panel. Usa `HOUSE_LORE` e `getPlayerTitle` de `lib/constants-house.ts`. |
| `CardSlots.tsx` | Grid horizontal com 3 slots de cristais (UserCard) equipados. Cada slot mostra arte do mob, badge `Lv N`, badge `% PURO` (ou `100% ESPECTRAL`), raridade, bonuses ja escalonados por purity x level (via `scaleEffectForDisplay`) com sub-rotulo `×mult` (suprime quando combinado=1.0) e `CardLevelBar` no rodape. Cristais Espectrais (purity 100) ganham botao **Definir/Trocar skill** (5o slot) que dispara `onSpectralSkillClick(userCardId)`. Hover overlay mostra valores escalonados em verde. Callbacks: `onSlotClick`, `onUnequip`, `onSpectralSkillClick?`. |
| `SpectralSkillSelectModal.tsx` | Modal de selecao da skill espectral (5o slot em batalha) para um Cristal Espectral. Faz `GET /api/cards/[id]/spectral-skill` ao abrir para listar as 4 skills do mob de origem (com tier/damageType/basePower/cooldown/accuracy/descricao); destaca a skill ja selecionada com badge "Atual". Confirma via `PUT /api/cards/[id]/spectral-skill { skillId }`. Visual com borda dourada (`var(--gold)`) sem hex hardcoded. Acessibilidade: focus trap, Escape, click backdrop. Disparado por `CardSlots.onSpectralSkillClick` (botao manual) e auto-aberto pela `character/page.tsx` ao equipar uma Espectral SEM `spectralSkillId`. |
| `CardPickerModal.tsx` | Modal para escolher cristal a equipar num slot. Lista candidatos com badges de raridade/tier/`Lv N`/`% PURO`, mini retrato do mob, nome, flavorText, `CardLevelBar` por candidato e bonuses ja escalonados (purity x level). Filtros por raridade (toggle). Focus trap + Escape. |
| `PendingDuplicatesModal.tsx` | Modal listando `PendingCardDuplicate`s do usuario (drops de duplicata com purity maior). Cada item mostra arte do mob, raridade, comparacao `Atual N% (Lv L) → Novo N%`, e dois botoes: **Substituir** (chama `POST /api/cards/pending-duplicates/[id]/resolve` com `REPLACE`, zera xp/level e adota a nova purity) ou **Converter em XP** (`CONVERT`, mantem purity atual e aplica `applyXpGain`). Update otimista — remove item da lista local apos sucesso e refaz fetch via callback `onResolved`. Focus trap + Escape. |
| `ShowcaseSlot.tsx` | Visual de uma slot da vitrine. Slot vazio (`card === null`): borda tracejada com label "Slot livre". Slot preenchido: arte do mob/carta + raridade + badge `Lv N · purity%`. Espectrais (purity 100) ganham glow dourado animado e particula leve. Quando `cardArtUrlSpectral` esta presente, usa essa imagem direto; caso contrario, fallback CSS holografico (hue-rotate + saturate) sobre `cardArtUrl` ou `mob.imageUrl`. |
| `ShowcaseEditor.tsx` | Modal do dono pra editar a vitrine. Lista o inventario clicavel (max 6 selecoes, ordem preservada). Pre-visualizacao da ordem com botoes pra remover. Chama `PUT /api/user/showcase` ao salvar. Esc fecha. Erros (422 ownership ou rede) exibidos no footer em vermelho. |

## Convencoes

- Props tipadas inline ou via `type Props` no mesmo arquivo.
- Importar tipos de `@/types/character`.
- Token JWT via `getToken()` de `@/lib/client-auth` (nunca `localStorage.getItem` inline).
- Todos os fetches autenticados usam `authFetchOptions()` de `@/lib/client-auth` para garantir `credentials: "include"` e header `Authorization`.
- export default function (um componente por arquivo).
- Sem `any`.
- CSS via Tailwind usando CSS variables do tema (`--bg-card`, `--border-subtle`, `--accent-primary`, `--bg-secondary`).

## Acessibilidade

- `SkillSelectModal` implementa focus trap, fecha com Escape, e usa `role="dialog"` + `aria-modal="true"`.
- Botoes interativos (`SkillLoadout` slots) respondem a Enter e Space via `onKeyDown`.
