# coop-pve/_components/ — Componentes da Batalha Coop PvE

Componentes Client-side (`"use client"`) usados exclusivamente pela pagina `/coop-pve`.

## Componentes

| Arquivo | Descricao |
|---|---|
| `CoopPveArena.tsx` | Layout principal da batalha: timer + mobs + team + skills + log. Gerencia targeting state. |
| `CoopPveSkillBar.tsx` | Grid 2x2 de skills com cooldowns, targeting message e skip turn. |
| `CoopPveMobRow.tsx` | Row de 3 ou 5 mob cards com HP, tier, status effects. Suporta targeting mode. |
| `CoopPveTeamPanel.tsx` | Panel com N player cards (2 ou 3 conforme modo): avatar, HP, casa, status badges. Suporta ally targeting. Layout compacto para 3 players. |
| `CoopPveResult.tsx` | Modal overlay de resultado (vitoria/derrota) com EXP e level up. |

## Convencoes

- Tipos importados de `../page.tsx` (CoopPveSkillInfo, CoopPveTeammateInfo, CoopPveMobInfo, SanitizedCoopPveState)
- Reutiliza `BattleLog` e `MobPlaceholder` de `../../battle/_components/`
- Cores via CSS variables do tema
- Animacoes via `<style>` inline com `@keyframes`
- Textos em portugues (sem acentos em strings do jogo por convencao)

## Fluxo de targeting

1. Player clica skill no SkillBar
2. Se target SINGLE_ENEMY: Arena seta targetingMode, mobs pulsam, click no mob envia action
3. Se target SINGLE_ALLY: Arena seta targetingMode, aliado pulsa, click no aliado envia action
4. Se ALL_ENEMIES/SELF/ALL_ALLIES: action enviada direto sem targeting
5. Botao "Cancelar" reseta targeting mode
