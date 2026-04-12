# lib/exp/ — Sistema de EXP e Level

Modulo de funcoes puras para calculo de experiencia, level up e matchmaking PvE.

## Arquivos

| Arquivo | Responsabilidade |
|---|---|
| `constants.ts` | Constantes do sistema: LEVEL_CAP (100), EXP_GROWTH_RATE (1.15), BASE_EXP_REQUIRED (100), POINTS_PER_LEVEL (5), HP_POINTS_MULTIPLIER (10) |
| `formulas.ts` | `expToNextLevel(level)` — EXP necessario para o proximo nivel. `calculateMobExp(mob)` — EXP base de um mob pelos stats. `calculateExpGained(baseExp, playerLevel, mobTier)` — EXP final com penalidade por nivel |
| `level-up.ts` | `processLevelUp({ level, currentExp, freePoints })` — processa subidas de nivel em loop. `distributePoints({ freePoints, distribution })` — valida e aplica distribuicao de pontos livres |
| `matchmaking.ts` | `getPlayerTier(level)` — tier do jogador (1-5). `rollMobTier(playerTier, randomFn?)` — sorteia tier do mob (60% igual, 25% inferior, 15% superior). `selectRandomMob(mobs, randomFn?)` — seleciona mob aleatorio |
| `index.ts` | Barrel export de todas as funcoes e constantes |

## Formulas

- **EXP para proximo nivel**: `floor(100 * 1.15^(level-1))`
- **EXP base do mob**: `floor((physicalAtk + physicalDef + magicAtk + magicDef + hp/10 + speed) / 6)`
- **Penalidade por nivel**: se jogador esta acima do nivel esperado do mob (tier * 10), multiplica por `max(0.10, 1 - diff * 0.05)`. Minimo 1 EXP.
- **Pontos por level up**: 5 pontos livres por nivel. HP recebe multiplicador x10 (1 ponto = +10 HP).

## Convencoes

- Todas as funcoes sao **puras**: sem acesso a banco, sem fetch, sem side effects.
- Funcoes com aleatoriedade recebem `randomFn?: () => number` opcional (default: `Math.random`).
- Stats distribuiveis: physicalAtk, physicalDef, magicAtk, magicDef, hp, speed. "accuracy" NAO e distribuivel.
- Nunca mutar parametros de entrada — usar variaveis locais.
