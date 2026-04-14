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
| `CharacterHeader.tsx` | Header com avatar (upload), nome, badge da casa (brasao via `next/image` quando disponivel, emoji como fallback), barra de EXP e pontos livres. Usa `getHouseAssets()` de `lib/houses/house-assets.ts` para resolver imagens. Bandeira da casa renderizada como decoracao de fundo com `opacity-[0.06]`. |

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
