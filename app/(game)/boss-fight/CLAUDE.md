# boss-fight/ — Batalha Cooperativa contra Boss

Pagina de batalha coop 3v1 via Socket.io em tempo real. Cada turno tem timer de 30s.

## Estrutura

| Arquivo | Descricao |
|---|---|
| `page.tsx` | Client Component principal. Conecta ao socket (via `useBossQueue` hook), gerencia estado de batalha, timer de turno, e delega renderizacao para componentes filhos. |
| `_components/CoopBattleArena.tsx` | Layout da arena: TurnTimer + BossCard + TeamPanel + CoopSkillBar + BattleLog. Reutiliza `BattleLog` do PvE. |
| `_components/BossCard.tsx` | Card do boss com HP, status effects e shake animation. Reutiliza `StatusParticles` do PvE. |
| `_components/TeamPanel.tsx` | Painel dos 3 jogadores: avatar, HP, status, badges de "Agiu"/"Pensando..."/"Morto". |
| `_components/CoopSkillBar.tsx` | Grid 2x2 de skills com suporte a targeting (SINGLE_ALLY). Escape cancela selecao. |
| `_components/CoopBattleResult.tsx` | Modal de resultado (vitoria/derrota) com EXP, essencia e level up. |
| `_components/TurnTimer.tsx` | Barra de progresso do timer do turno com cores por faixa. |

## Convencoes

- Tipos de batalha importados de `@/lib/battle/types` (TurnLogEntry, PlayerState, etc.)
- Tipos locais (CoopAvailableSkill, TeamPlayerInfo) exportados dos componentes que os definem
- Socket.io: eventos `boss:battle:state`, `boss:action:received`, `boss:battle:end`, `boss:battle:error`
- Auth via `@/lib/client-auth` (getToken, authFetchOptions)
- Reutiliza `BattleLog` e `StatusParticles` do PvE (`../../battle/_components/`)

## Duplicacao conhecida com PvE

- `STATUS_CONFIG` duplicado em BattleArena, BossCard e TeamPanel
- `DAMAGE_TYPE_LABEL` e `playSfx` duplicados em SkillBar e CoopSkillBar
- Shake keyframes duplicados em BattleArena e BossCard
- Fade/scale-in keyframes duplicados em page.tsx (PvE) e CoopBattleResult
- TODO: extrair para modulos compartilhados quando houver mais estabilidade
