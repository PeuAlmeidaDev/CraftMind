# lib/battle/ — Combat Engine

Engine de combate pura para batalhas por turnos estilo Pokemon. Sem side effects externos, sem acesso a banco, sem fetch. O estado e 100% serializavel (JSON-safe).

## Arquitetura

O estado original nunca e mutado. `resolveTurn` faz deep clone no topo e todas as sub-funcoes mutam apenas o clone. O resultado e retornado como novo estado.

## Estrutura de arquivos

| Arquivo | Responsabilidade |
|---|---|
| `types.ts` | Tipos de estado da engine (PlayerState, BattleState, etc.) — re-exporta tipos de `@/types/skill` |
| `constants.ts` | Constantes puras: stage multipliers, dano de status, limites |
| `utils.ts` | Funcoes utilitarias: clamp, random, getPlayer/getOpponent, deepClone, generateId |
| `init.ts` | `initBattle()` — cria estado inicial a partir de config dos jogadores |
| `damage.ts` | `calculateDamage()`, `getEffectiveStat()` — calculo de dano com stages, vulnerabilidades, multi-hit |
| `skills.ts` | Gerenciamento de cooldowns e combos: `getAvailableSkills`, `putOnCooldown`, `tickCooldowns`, `getComboModifier` |
| `status.ts` | Status effects: `isIncapacitated`, `applyStatusDamage`, `tickEndOfTurn` |
| `effects.ts` | `applyEffects()` — dispatcher que aplica os 12 tipos de efeito de skill |
| `turn.ts` | `resolveTurn()` — orquestrador principal que coordena todo o fluxo do turno |
| `ai-profiles.ts` | Perfis de IA para mobs PvE: AGGRESSIVE, DEFENSIVE, TACTICAL, BALANCED — modificadores por categoria (damage, support, control) |
| `ai-scoring.ts` | `scoreSkill()` — pontua uma skill com base no contexto de batalha, perfil de IA e ruido aleatorio |
| `ai.ts` | `chooseAction()` — seleciona a melhor skill disponivel para um mob usando scoring |
| `pve-store.ts` | Store em memoria (Map) para batalhas PvE ativas. Exporta `getPveBattle`, `setPveBattle`, `removePveBattle`, `hasActiveBattle`. Tipo `PveBattleSession` agrupa BattleState + AiProfile + mobId + userId |
| `coop-types.ts` | Tipos para batalha cooperativa (Boss Fight 3v1): `CoopBattleState`, `CoopTurnAction`, `CoopTurnResult`, `CoopBossBattleConfig` |
| `coop-target.ts` | Resolucao de alvos coop: `resolveCoopTargets` (adapta targets para 3v1), `chooseBossTarget` (prioridade: menor HP% > menos buffs defensivos > random) |
| `coop-turn.ts` | `initCoopBattle()` e `resolveCoopTurn()` — orquestrador completo do turno cooperativo. Usa adapters (BattleState fake) para reutilizar `applyEffects` e `chooseAction` existentes |
| `coop-store.ts` | Store em memoria (Map) para batalhas coop ativas. Exporta `getCoopBattle`, `setCoopBattle`, `removeCoopBattle`, `hasActiveCoopBattle`, `getCoopBattleByPlayerId`. TTL 30min, cleanup 5min |
| `index.ts` | Barrel export |

## Fluxo do resolveTurn

```
1. Deep clone do estado
2. Determinar ordem (prioridade > speed > random)
3. Para cada jogador na ordem:
   a. Skip se batalha acabou
   b. Checar incapacitacao (STUN/FROZEN)
   c. Aplicar dano de status (BURN/POISON)
   d. Validar skill (existe? em cooldown?)
   e. Resolver combo (escalar basePower/hits)
   f2. Check de accuracy (miss chance) — pula skills de suporte puro (SELF)
   f. Calcular e aplicar dano
   g. Processar counters do defensor
   h. Aplicar efeitos da skill
   i. Colocar skill em cooldown
   j. Checar fim de batalha
4. Tick de fim de turno (expirar buffs/status/vulns/counters)
5. Tick de cooldowns
6. Checar mortes por ON_EXPIRE
7. Incrementar turno se batalha continua
```

## Formula de dano

```
rawDamage = (basePower * (effectiveAtk / effectiveDef) * 0.5 + basePower * 0.1)
            * vulnMultiplier
            * randomMultiplier

effectiveStat = base * STAGE_MULTIPLIERS[stage]
finalDamage = max(1, floor(rawDamage))
```

Multi-hit: cada hit e calculado independentemente com seu proprio random multiplier.

## Stage Multipliers

| Stage | Multiplicador |
|---|---|
| -4 | 0.40 |
| -3 | 0.50 |
| -2 | 0.65 |
| -1 | 0.80 |
| 0 | 1.00 |
| +1 | 1.25 |
| +2 | 1.50 |
| +3 | 1.75 |
| +4 | 2.00 |

## Status Effects

| Status | Dano/Turno | Side Effect | Ao Expirar |
|---|---|---|---|
| STUN | - | Impede acao | - |
| FROZEN | - | Impede acao, +30% vuln fisico | - |
| BURN | 6% HP max | physicalAtk -1 stage | Reverte physicalAtk +1 |
| POISON | 4/6/8% HP max (escala) | - | - |
| SLOW | - | speed -2 stages | Reverte speed +2 |

## Tipos de Efeito (SkillEffect)

| Tipo | Descricao |
|---|---|
| BUFF | Aumenta um atributo do alvo por duracao limitada |
| DEBUFF | Reduz um atributo do alvo por duracao limitada |
| STATUS | Aplica condicao de status (stun, burn, etc.) |
| VULNERABILITY | Aumenta dano recebido de um tipo especifico |
| PRIORITY_SHIFT | Altera prioridade de acao no turno |
| COUNTER | Contra-ataque automatico quando recebe dano |
| HEAL | Cura percentual de HP |
| CLEANSE | Remove efeitos negativos (debuffs e/ou status) |
| RECOIL | Dano proprio baseado no dano causado |
| SELF_DEBUFF | Custo em atributo do proprio usuario |
| COMBO | Escala dano com usos consecutivos da mesma skill |
| ON_EXPIRE | Dispara efeito quando um buff/debuff monitorado expira |

## IA PvE

Sistema de decisao para mobs controlados por IA. Funcoes puras sem acesso a banco.

### Perfis de IA (AiProfile)

| Perfil | damage | support | control | Comportamento |
|---|---|---|---|---|
| AGGRESSIVE | 1.5 | 0.7 | 0.8 | Prioriza dano acima de tudo |
| DEFENSIVE | 0.7 | 1.5 | 0.9 | Prioriza cura e buffs defensivos |
| TACTICAL | 0.9 | 0.9 | 1.5 | Prioriza debuffs, status e vulnerabilidades |
| BALANCED | 1.0 | 1.0 | 1.0 | Sem preferencia — reage ao contexto |

### Fluxo de decisao (chooseAction)

1. Obter skills disponiveis (nao em cooldown)
2. Pontuar cada skill via `scoreSkill` considerando:
   - Classificacao da skill (damage/support/control)
   - Score base proporcional ao basePower
   - Bonus contextuais (HP do mob/oponente, buffs/debuffs ativos, vulnerabilidades, combos, status)
   - Modificador do perfil de IA aplicado a categoria dominante
   - Ruido aleatorio (+-15%) para variabilidade
3. Escolher skill com maior score
4. Se nenhuma skill disponivel: skip turn (skillId: null)

### Classificacao de skills

- **damage**: basePower > 0 && damageType !== "NONE"
- **support**: effects inclui HEAL, BUFF, CLEANSE ou COUNTER
- **control**: effects inclui DEBUFF, STATUS ou VULNERABILITY

Se uma skill pertence a multiplas categorias, o perfil com maior modificador determina a categoria dominante.

## Accuracy (precisao)

Cada skill tem um campo `accuracy` (1-100, % base de acerto). O stage `accuracy` (-4 a +4) modifica a chance em runtime via `STAGE_MULTIPLIERS`. Skills de suporte puro (damageType NONE, basePower 0, target SELF) nunca erram. Formula:

```
hitChance = clamp(skill.accuracy * STAGE_MULTIPLIERS[attacker.stages.accuracy], 10, 100)
```

- Cap maximo: 100% (stages positivos nao ultrapassam 100%)
- Cap minimo: 10% (sempre ha chance minima de acertar)
- No miss: cooldown e reset de combo ainda acontecem
- A IA penaliza skills com accuracy < 100 proporcionalmente (score *= accuracy/100)

## Batalha Cooperativa (Boss Fight 3v1)

Modo de batalha onde 3 jogadores enfrentam 1 boss controlado por IA. O estado usa `CoopBattleState` com `team: PlayerState[]` (3 players) + `boss: PlayerState` ao inves da tupla fixa `players: [PlayerState, PlayerState]`.

### Adapters para funcoes existentes

Varias funcoes existentes dependem de `BattleState` (tupla de 2). O coop usa adapters:

- **applyEffects**: cria `BattleState` fake `[caster, target]` para cada alvo e chama `applyEffects` normalmente. Como os objetos sao passados por referencia (deep clone ja feito no topo), as mutacoes se propagam automaticamente.
- **chooseAction (IA do boss)**: cria `BattleState` fake `[boss, targetPlayer]` e chama `chooseAction` com o player alvo selecionado por `chooseBossTarget`.
- **tickEndOfTurn**: reimplementado como `tickCoopEndOfTurn` internamente, iterando sobre `[boss, ...team]`.

### Fluxo do resolveCoopTurn

```
0. Guard: se status === "FINISHED" retornar imediatamente
1. Deep clone do estado
2. Validar acoes do time (3 acoes, playerIds validos, sem duplicatas)
3. Gerar acao do boss via IA (chooseBossTarget + chooseAction com fake state)
4. Montar 4 acoes (3 players + boss)
5. Ordenar por prioridade > speed > random
6. Para cada acao: incapacitacao, status damage, validar skill, combo, accuracy, resolver alvos, calcular dano por alvo, counters, aplicar efeitos via adapter, cooldown, checar fim
7. tickCoopEndOfTurn
8. tickCooldowns para cada entidade
9. Checar mortes por ON_EXPIRE
10. Incrementar turno
11. Checar MAX_TURNS (derrota se exceder)
```

### chooseBossTarget

Selecao de alvo do boss entre players vivos:
1. Menor HP percentual (currentHp / baseStats.hp)
2. Empate: menos buffs defensivos (physicalDef ou magicDef como BUFF)
3. Empate total: random

### CoopBattleState.winnerId

- `"team"` = time venceu (boss HP <= 0)
- `null` = derrota (todo o time morreu ou MAX_TURNS excedido)

## Convencoes

- Funcoes puras: sem side effects externos, sem acesso a banco, sem fetch
- Deep clone no topo de `resolveTurn` e `resolveCoopTurn`; sub-funcoes mutam o clone
- Tudo serializavel JSON: sem classes, sem funcoes no estado
- Sem `any` — TypeScript strict
- IDs gerados via `crypto.randomUUID()`
- `randomFn` opcional em funcoes que usam aleatoriedade (para testes deterministicos)
