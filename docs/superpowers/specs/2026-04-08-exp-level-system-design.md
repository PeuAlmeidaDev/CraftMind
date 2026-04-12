# Sistema de EXP/Level

## Contexto

O jogo tem dois sistemas de progressao paralelos:
1. **Habitos** — pontos fixos automaticos em stats especificos (ja implementado)
2. **Batalha PvE** — EXP por vitoria, level up concede 5 pontos LIVRES para distribuir

O jogador sente a evolucao de duas formas: habitos fortalecem automaticamente, batalhas dao liberdade de customizar.

## Decisoes tomadas

- Level cap: 100 (curva ingreme, ultimos levels muito dificeis)
- EXP por mob: proporcional aos stats do mob
- Reducao de EXP: -5% por level acima do "level esperado" do mob, minimo 10%
- Distribuicao de pontos: livre total (5 pontos em qualquer combinacao de 6 stats)
- Matchmaking: mob sorteado por range de tiers com pesos (60% atual, 25% abaixo, 15% acima)
- Mobs serao adicionados manualmente (seed/admin), sem geracao procedural

## 1. Modelo de dados

### Campos novos no Character (Prisma)

```prisma
level      Int @default(1)   // 1-100
currentExp Int @default(0)   // EXP acumulada no level atual
freePoints Int @default(0)   // pontos pendentes para distribuir
```

expToNextLevel NAO fica no banco — e calculado via formula.

## 2. Curva de EXP

```ts
function expToNextLevel(level: number): number {
  return Math.floor(100 * Math.pow(1.15, level - 1));
}
```

| Level | EXP necessaria | Acumulada aprox. |
|---|---|---|
| 1→2 | 100 | 100 |
| 5→6 | 175 | 650 |
| 10→11 | 352 | 2,030 |
| 20→21 | 1,424 | 10,893 |
| 50→51 | 23,667 | ~175,000 |
| 99→100 | ~1,091,000 | ~8M |

## 3. EXP por mob

```ts
function calculateMobExp(mob: { physicalAtk, physicalDef, magicAtk, magicDef, hp, speed }): number {
  return Math.floor((mob.physicalAtk + mob.physicalDef + mob.magicAtk + mob.magicDef + mob.hp / 10 + mob.speed) / 6);
}
```

HP dividido por 10 porque e uma ordem de grandeza maior que os outros stats.

| Mob | EXP base |
|---|---|
| Slime (T1) | ~10 |
| Golem (T2) | ~23 |
| Cavaleiro (T3) | ~39 |
| Dragao (T4) | ~60 |
| Arauto (T5) | ~87 |

## 4. Reducao de EXP por diferenca de level

```ts
function calculateExpGained(baseExp: number, playerLevel: number, mobTier: number): number {
  const mobExpectedLevel = mobTier * 10;
  const levelDiff = playerLevel - mobExpectedLevel;
  if (levelDiff <= 0) return baseExp; // EXP cheia se player esta no level ou abaixo
  const multiplier = Math.max(0.10, 1 - levelDiff * 0.05);
  return Math.max(1, Math.floor(baseExp * multiplier));
}
```

-5% por level acima do esperado. Minimo 10% da EXP base. Minimo 1 EXP absoluto.

## 5. Level up

```ts
function processLevelUp(character: { level, currentExp, freePoints }): { levelsGained, newLevel, newExp, newFreePoints } {
  let levelsGained = 0;
  while (character.currentExp >= expToNextLevel(character.level) && character.level < 100) {
    character.currentExp -= expToNextLevel(character.level);
    character.level += 1;
    character.freePoints += 5;
    levelsGained += 1;
  }
  // Cap: se level 100, EXP para de acumular
  if (character.level >= 100) {
    character.currentExp = 0;
  }
  return { levelsGained, newLevel: character.level, newExp: character.currentExp, newFreePoints: character.freePoints };
}
```

Pode subir multiplos levels de uma vez.

## 6. Distribuicao de pontos

- 5 pontos livres por level up, acumulaveis
- 6 stats: physicalAtk, physicalDef, magicAtk, magicDef, hp, speed
- Distribuicao livre total (pode colocar 5 em um stat so)
- Cada ponto = +1 no stat (hp recebe +10 por ponto para manter proporcao? ou +1 igual aos outros?)

**Decisao sobre HP**: +1 ponto livre = +10 HP (para manter proporcionalidade com os outros stats que comecam em 10 e HP comeca em 100).

## 7. Matchmaking PvE (sorteio de mob)

```ts
function getPlayerTier(level: number): number {
  return Math.max(1, Math.min(5, Math.ceil(level / 10)));
}

function rollMobTier(playerTier: number): number {
  const roll = Math.random();
  if (roll < 0.60) return playerTier;                              // 60% tier atual
  if (roll < 0.85) return Math.max(1, playerTier - 1);            // 25% tier abaixo
  return Math.min(5, playerTier + 1);                               // 15% tier acima
}
```

Sorteia o tier, depois sorteia aleatoriamente um mob daquele tier no banco.

## 8. Estrutura de arquivos

```
lib/exp/
  constants.ts      — EXP_BASE_MULTIPLIER, LEVEL_CAP, POINTS_PER_LEVEL, HP_POINTS_MULTIPLIER
  formulas.ts       — expToNextLevel(), calculateMobExp(), calculateExpGained()
  level-up.ts       — processLevelUp(), distributePoints()
  matchmaking.ts    — getPlayerTier(), rollMobTier(), selectRandomMob()
  index.ts          — barrel export
```

Funcoes puras sem side effects (mesmo padrao de lib/battle/).
selectRandomMob() recebe array de mobs do tier e retorna um aleatorio — a query ao banco fica no caller (API route).

## 9. Fora do escopo

- API routes (proximo passo apos esta implementacao)
- Frontend
- EXP por PvP (futuro)
- Sistema de prestigio apos level 100 (futuro)
- Respec de pontos distribuidos (futuro)
