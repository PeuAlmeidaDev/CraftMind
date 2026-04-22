# battle-multi/_components/ — Componentes da Batalha PvE Multi (1v3 / 1v5)

Componentes Client-side para a pagina `/battle-multi`.

## Componentes

| Arquivo | Descricao |
|---|---|
| `MultiBattleArena.tsx` | Layout responsivo com 3 mobs, player HP, skills, log. Gerencia targeting mode |
| `MultiMobCard.tsx` | Card individual do mob com HP, status, estados visuais (normal/targeting/defeated/shaking) |
| `MultiSkillBar.tsx` | Grid 2x2 de skills com logica de selecao de alvo para SINGLE_ENEMY |

## Componentes reutilizados do 1v1

- `BattleLog` de `../../battle/_components/BattleLog`
- `MobPlaceholder` de `../../battle/_components/MobPlaceholder`

## Convencoes

- Tipos importados de `../page.tsx`
- Cores via CSS variables do tema
- Animacoes via `<style jsx>` com @keyframes
- Targeting: skill SINGLE_ENEMY ativa modo de selecao, player clica no mob alvo
- Compact mode: usado no mobile e quando mobs > 3, cards menores com layout horizontal
- Layout 1v5: mobs divididos em duas linhas (3+2), segunda linha centralizada. No mobile a segunda linha usa max-w-[66%] para manter proporcao visual
