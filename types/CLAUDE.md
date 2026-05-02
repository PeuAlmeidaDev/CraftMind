# types/ — Tipos TypeScript Compartilhados

## Proposito

Tipos usados em mais de uma camada (API, componentes, servidor Socket.io). Nunca importar tipos do Prisma diretamente nos componentes — mapear para tipos desta pasta.

## Arquivos e organizacao

| Arquivo | Conteudo |
|---|---|
| `api.ts` | `ApiSuccess<T>`, `ApiError` — tipos genericos de resposta da API |
| `house.ts` | `HouseName` (const object + union), `House` |
| `habit.ts` | `HabitCategory` (const object + union), `Habit`, `HabitSummary` |
| `character.ts` | `Character` (6 atributos + level, currentExp, freePoints), `AttributeGrants` (chaves JSON opcionais), `DistributableStat` (StatName sem accuracy), `PointDistribution` |
| `user.ts` | `UserPublic`, `UserWithHouse` (extends com house + habits) |
| `task.ts` | `DailyTask` (com `tag`), `CompletedTask`, `UnlockedSkillInfo`, `CompleteTaskResult` (com `unlockedSkill?`), `CompleteTaskResponse` |
| `skill.ts` | `DamageType`, `SkillTarget`, `EffectTarget`, `ComboEscalation`, `StatName`, `BuffPayload`, `DebuffPayload`, `StatusPayload`, `HealPayload`, `SelfDebuffPayload`, `VulnerabilityPayload`, `RecoilPayload`, `OnExpireTrigger`, `TaskTag`, `StatusEffect` (const objects + union), `SkillEffect` (discriminated union por `type`), `CounterTriggerPayload`, `OnExpirePayload`, `SkillMastery`, `Skill`, `CharacterSkillSlot` |
| `auth.ts` | `AuthResponse` (base), `RegisterResponse`, `LoginResponse` |
| `cards.ts` | `CardRarity`, `CardEffect` (discriminated union: `CardStatFlatEffect`, `CardStatPercentEffect`, `CardTriggerEffect`, `CardStatusResistEffect`), `TIER_TO_RARITY`, `BestiaryUnlockTier`, `BESTIARY_THRESHOLDS`, `BestiaryEntry`, `BestiaryCardInfo` (com `userCardPurity` e `cardArtUrlSpectral`), `BestiaryResponse`, `UserCardSummary` (com `purity`, `spectralSkillId?` e `card.cardArtUrl?` / `card.cardArtUrlSpectral?`), `PendingCardDuplicateSummary`, `PendingDuplicateDecision` (`REPLACE \| CONVERT`), `SpectralDropBroadcast` (payload do evento `global:spectral-drop`), `ShowcaseResponse` ({ userCardIds, cards }) |
| `index.ts` | Barrel export de todos os tipos |

## Convencoes

- Usar `type` para formas de dados (objetos, unioes) — nunca `interface`.
- Exportar tudo como named export — nunca default export.
- Enums como `const` objects + union type para compatibilidade com JSON:

```ts
export const HabitCategory = {
  PHYSICAL: 'PHYSICAL',
  INTELLECTUAL: 'INTELLECTUAL',
  MENTAL: 'MENTAL',
  SOCIAL: 'SOCIAL',
  SPIRITUAL: 'SPIRITUAL',
} as const
export type HabitCategory = typeof HabitCategory[keyof typeof HabitCategory]
```

- Tipos derivados do Prisma: usar `Prisma.UserGetPayload<...>` apenas em `lib/` — expor versao simplificada aqui.
- Sem `any` — tipar tudo explicitamente.
- Um arquivo por dominio.

## Importacao

Importar via barrel export quando conveniente:

```ts
import type { UserPublic, DailyTask } from "@/types";
```

Ou diretamente do arquivo de dominio:

```ts
import type { Character } from "@/types/character";
```

Os const objects (HouseName, HabitCategory) precisam de import de valor (nao `type`):

```ts
import { HouseNameEnum } from "@/types";
// ou
import { HouseName } from "@/types/house";
```

## StatName (valores validos)

| Valor | Descricao |
|---|---|
| `physicalAtk` | Ataque fisico |
| `physicalDef` | Defesa fisica |
| `magicAtk` | Ataque magico |
| `magicDef` | Defesa magica |
| `hp` | Pontos de vida |
| `speed` | Velocidade |
| `accuracy` | Precisao (stage de acerto) |

Usado em `BuffPayload`, `DebuffPayload` e `SelfDebuffPayload` no lugar de `string` para garantir type safety nos nomes de atributo.

## SkillTarget (valores validos)

| Valor | Descricao |
|---|---|
| `SELF` | Apenas o proprio usuario |
| `SINGLE_ALLY` | Um aliado (em modos com time) |
| `ALL_ALLIES` | Todos os aliados |
| `SINGLE_ENEMY` | Um inimigo |
| `ALL_ENEMIES` | Todos os inimigos |
| `ALL` | Todos em campo (aliados + inimigos) |

O jogo suporta modos 1v1, 3v3, 5v5 (PvP) e 1v3, 1v5 (PvE). Cada jogador controla 1 personagem.

## SkillEffect (discriminated union por `type`)

Todos os effect types suportados:

| type | Descricao | Campos principais |
|---|---|---|
| `BUFF` | Aumenta atributo do alvo | `target`, `stat`, `value`, `duration`, `chance?` |
| `DEBUFF` | Reduz atributo do alvo | `target`, `stat`, `value`, `duration`, `chance?` |
| `STATUS` | Aplica condicao de status | `target`, `status` (StatusEffect), `chance`, `duration` |
| `VULNERABILITY` | Aumenta dano recebido de um tipo | `target`, `damageType`, `percent`, `duration`, `chance?` |
| `PRIORITY_SHIFT` | Altera prioridade de acao | `target`, `stages`, `duration` |
| `COUNTER` | Contra-ataque automatico | `target`, `powerMultiplier`, `duration`, `onTrigger?` (CounterTriggerPayload[]) |
| `HEAL` | Cura percentual de HP | `target`, `percent` |
| `CLEANSE` | Remove efeitos negativos | `target`, `targets` ("DEBUFFS" / "STATUS" / "ALL") |
| `RECOIL` | Dano proprio baseado no dano causado | `target`, `percentOfDamage` |
| `SELF_DEBUFF` | Custo em atributo do proprio usuario | `target`, `stat`, `value`, `duration` |
| `COMBO` | Escala com usos consecutivos | `maxStacks`, `escalation` (ComboEscalation[]) |
| `ON_EXPIRE` | Dispara efeito quando buff/debuff expira | `trigger` (OnExpireTrigger), `effect` (OnExpirePayload) |

### COMBO

A mesma skill fica mais forte a cada uso consecutivo no combate. Se o jogador usar outra skill, o combo reseta. Estado de combo e rastreado em runtime pela engine de combate, nao persiste no banco.

### ON_EXPIRE

Efeito que dispara automaticamente quando um buff/debuff expira. O `trigger` (tipo `OnExpireTrigger` = `BuffPayload | DebuffPayload`) define o buff/debuff monitorado e o `effect` define o que acontece ao expirar. O `OnExpirePayload` e um subconjunto de SkillEffect (BUFF, DEBUFF, STATUS, HEAL, RECOIL) sem recursao. Os tipos base (`BuffPayload`, `DebuffPayload`, etc.) sao reutilizados entre `SkillEffect`, `CounterTriggerPayload` e `OnExpirePayload` para evitar duplicacao.

### COUNTER

O campo opcional `onTrigger` e um array de efeitos que disparam apenas quando o contra-ataque e ativado (o jogador recebeu dano enquanto o counter estava ativo). `CounterTriggerPayload` e um subconjunto de SkillEffect (BUFF, DEBUFF, STATUS, VULNERABILITY, HEAL, SELF_DEBUFF), sem recursao. Segue o mesmo padrao do `OnExpirePayload`.

## Mapeamento API -> Tipo

| Endpoint | Tipo de resposta |
|---|---|
| `GET /api/habits` | `ApiSuccess<Habit[]>` |
| `GET /api/tasks/daily` | `ApiSuccess<DailyTask[]>` |
| `POST /api/tasks/[id]/complete` | `CompleteTaskResponse` |
| `POST /api/auth/register` | `RegisterResponse` |
| `POST /api/auth/login` | `LoginResponse` |
