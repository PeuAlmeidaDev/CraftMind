# character/_components/ — Componentes da Tela do Personagem

## Proposito

Componentes Client usados exclusivamente na pagina `/character`. Todos usam `"use client"`.

## Componentes

| Arquivo | Descricao |
|---|---|
| `AttributePanel.tsx` | Mostra os 6 atributos do personagem. Dois modos: visualizacao (freePoints === 0) e distribuicao (freePoints > 0) com botoes +/- e preview. Chama `POST /api/character/distribute-points` ao confirmar. |
| `SkillLoadout.tsx` | Grid 2x2 com os 4 slots de skills equipadas. Slots ocupados mostram nome, tier badge, cooldown e tipo de dano, com botao X para desequipar. Slots vazios com borda tracejada e texto "Escolher skill". Callbacks: `onSlotClick(slotIndex)` e `onUnequip(slotIndex)`. |
| `SkillSelectModal.tsx` | Modal para selecionar uma skill para equipar num slot. Recebe lista de `CharacterSkillSlot[]`, filtra por tier (T1/T2/T3) e tipo de dano (Fisico/Magico/Suporte). Mostra badge de slot se a skill ja esta equipada em outro slot. Chama `onSelect(skillId, slotIndex)` ao clicar. |
| `SkillInventory.tsx` | Grid de referencia com todas as skills desbloqueadas (max 49). Mostra nome, tier badge, cooldown, tipo de dano, target, descricao, efeitos resumidos e badge de slot se equipada. Props: `skills: CharacterSkillSlot[]`. |
| `CharacterHeader.tsx` | Header responsivo: no mobile empilha verticalmente (flex-col, centralizado), no desktop 3 colunas em linha (flex-row). Avatar 64px mobile / 104px desktop com glow ember (upload mantido). Texto central (eyebrow Cinzel, nome Cormorant 24px/34px, motto Garamond italico, XP bar reta com ticks 25/50/75%). Medallion de nivel 64px/92px com 24 SVG ticks (viewBox fixo, escala via classe). Badge pontos livres com animacao freePulse. Watermark da casa em Cinzel 120px/240px opacity 4%. Padding wrapper interno `p-4 sm:px-7 sm:py-6` dentro do Panel. Usa `HOUSE_LORE` e `getPlayerTitle` de `lib/constants-house.ts`. |
| `CardSlots.tsx` | Grid horizontal com 3 slots de cristais (UserCard) equipados. Cada slot mostra arte do mob, badge `Lv N`, raridade, bonuses ja escalonados pelo level (via `scaleEffectForDisplay`) com sub-rotulo `×mult` (suprime quando Lv1) e `CardLevelBar` no rodape. Hover overlay mostra valores escalonados em verde. Callbacks: `onSlotClick`, `onUnequip`. |
| `CardPickerModal.tsx` | Modal para escolher cristal a equipar num slot. Lista candidatos com badges de raridade/tier/`Lv N`, mini retrato do mob, nome, flavorText, `CardLevelBar` por candidato e bonuses ja escalonados. Filtros por raridade (toggle). Focus trap + Escape. |

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
