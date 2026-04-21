# lib/helpers/ — Funcoes Puras de Logica de Negocio

## Proposito

Funcoes puras e testaveis que encapsulam regras de negocio do jogo. Nao acessam banco de dados, nao fazem I/O — recebem dados e retornam resultados.

## Arquivos

| Arquivo | Responsabilidade |
|---|---|
| `determine-house.ts` | Determina a casa do jogador com base nos habitos selecionados |
| `attribute-mapping.ts` | Mapeia chaves JSON de attributeGrants para colunas do Character no Prisma |
| `skill-unlock.ts` | Rola chance de desbloqueio de skill por tag da tarefa completada |
| `date-utils.ts` | Calculo centralizado de inicio/fim do dia em BRT (UTC-3) |
| `dominant-category.ts` | Calcula a categoria dominante (mais frequente) de um array de HabitCategory, com desempate aleatorio |
| `public-profile.ts` | Busca perfil publico de um jogador por userId (dados + pvpStats). Acessa banco via Prisma — excecao a regra de funcoes puras |

## determine-house.ts

Exporta `determineHouse(habits, randomFn?)` que recebe um array de objetos com `{ name: string }` e retorna o `HouseName` correspondente. A funcao usa um mapa interno `HABIT_TO_HOUSES` onde cada habito pontua +1 para cada casa listada. Habitos ausentes do mapa sao neutros (nao pontuam).

### Regras de alocacao

- Cada habito da +1 ponto para cada casa listada no mapa `HABIT_TO_HOUSES`.
- Habitos nao listados (neutros) nao pontuam.
- A casa com mais pontos e atribuida.
- Empate: sorteio aleatorio entre as empatadas (via `randomFn`).
- Nenhum ponto (todos neutros): sorteio entre as 4 casas.

### Uso

```ts
import { determineHouse } from "@/lib/helpers/determine-house";

const house = determineHouse([
  { name: "Exercicio Fisico" },
  { name: "Meditacao" },
  { name: "Leitura" },
]);
// Pontua LYCUS=3, NOCTIS=2, ARION=1, NEREID=2 -> house === "LYCUS"

// Com randomFn para testes deterministicos
const house2 = determineHouse([{ name: "Yoga" }], () => 0);
// house2 === "NEREID"
```

## attribute-mapping.ts

Exporta `mapAttributeGrantsToColumns(grants)` que recebe o JSON `attributeGrants` (de DailyTask ou Habit) e retorna um objeto com nomes de colunas do Character prontos para uso em `prisma.character.update`.

### Mapeamento de chaves

| Chave JSON | Coluna Character |
|---|---|
| `physicalAttack` | `physicalAtk` |
| `physicalDefense` | `physicalDef` |
| `magicAttack` | `magicAtk` |
| `magicDefense` | `magicDef` |
| `hp` | `hp` |
| `speed` | `speed` |

### Uso

```ts
import { mapAttributeGrantsToColumns } from "@/lib/helpers/attribute-mapping";

const incrementData = mapAttributeGrantsToColumns(task.attributeGrants);
// { physicalAtk: 2, hp: 5 }
```

Tambem exporta tipos: `CharacterIncrementData`, `AttributeGrants`.

## skill-unlock.ts

Exporta `rollSkillUnlock(tag)` que rola a chance de desbloqueio de skill com base na tag da tarefa completada. Tambem exporta o const object `SKILL_UNLOCK_CHANCE` com as chances por tag.

### Chances por tag

| Tag | Chance |
|---|---|
| LEARN | 18% |
| APPLY | 11% |
| REFLECT | 7% |
| PRACTICE | 4% |
| CONNECT | 7% |

Se a tag for `null` ou invalida, retorna `false` (chance zero).

### Uso

```ts
import { rollSkillUnlock } from "@/lib/helpers/skill-unlock";

const unlocked = rollSkillUnlock("LEARN"); // true ~18% das vezes
const noChance = rollSkillUnlock(null);    // sempre false
```

## date-utils.ts

Exporta funcoes para calcular inicio/fim do dia usando o fuso BRT (UTC-3 fixo, sem horario de verao). Todas as rotas de tarefas e logs devem usar estas funcoes em vez de calcular datas inline.

### Funcoes

| Funcao | Retorno | Uso |
|---|---|---|
| `getStartOfDayBRT()` | 00:00 BRT como Date UTC (ex: `2026-04-07T03:00:00.000Z`) | Limite inferior em queries `gte` de tarefas do dia |
| `getEndOfDayBRT()` | 00:00 BRT de amanha como Date UTC (startOfDay + 24h) | Limite superior em queries `lt` de tarefas do dia |
| `getTodayDateBRT()` | Meia-noite UTC do dia BRT (ex: `2026-04-07T00:00:00.000Z`) | Campo `date` do HabitLog e `dueDate` do DailyTask (constraint unique por dia) |

### Regra de offset

O offset e sempre -3 horas (BRT). O Brasil nao usa horario de verao desde 2019. Se agora e 02:30 UTC (23:30 BRT do dia 06), o "dia BRT" ainda e dia 06, nao dia 07.

### Uso

```ts
import { getStartOfDayBRT, getEndOfDayBRT, getTodayDateBRT } from "@/lib/helpers/date-utils";

// Para queries de range (listar tarefas do dia)
const startOfDay = getStartOfDayBRT();
const endOfDay = getEndOfDayBRT();

// Para campos date-only (HabitLog.date, DailyTask.dueDate)
const today = getTodayDateBRT();
```

## dominant-category.ts

Exporta `getDominantCategory(categories, randomFn?)` que recebe um array de `HabitCategory` e retorna a categoria com maior frequencia. Em caso de empate, desempata aleatoriamente (ou via `randomFn` injetavel para testes).

Lanca `Error("categories array is empty")` se o array estiver vazio.

### Uso

```ts
import { getDominantCategory } from "@/lib/helpers/dominant-category";

const dominant = getDominantCategory(["PHYSICAL", "PHYSICAL", "MENTAL"]);
// dominant === "PHYSICAL"

// Com randomFn para testes deterministicos
const dominant2 = getDominantCategory(["PHYSICAL", "MENTAL"], () => 0.99);
// Sempre retorna o ultimo empatado
```

## public-profile.ts

Exporta `getPublicProfile(userId)` que busca o perfil publico de um jogador incluindo dados basicos, casa, character e estatisticas PvP. Retorna `null` se o usuario nao for encontrado.

**Nota:** Este helper acessa o banco de dados via Prisma, sendo uma excecao a regra de funcoes puras desta pasta. Justificativa: centralizar a logica de perfil publico reutilizada por multiplas rotas (`/api/user/[id]/profile` e `/api/user/by-name/[name]/profile`).

### Interface de retorno: `PublicProfileData`

- `id`, `name`, `avatarUrl` — dados basicos do usuario
- `house` — `{ name, animal }` ou `null`
- `character` — `{ level, physicalAtk, physicalDef, magicAtk, magicDef, hp, speed }` ou `null`
- `pvpStats` — `{ totalBattles, wins, losses, draws }` (calculado a partir de Battle counts)

### Uso

```ts
import { getPublicProfile } from "@/lib/helpers/public-profile";

const profile = await getPublicProfile(userId);
if (!profile) {
  // usuario nao encontrado
}
```

## Convencoes

- Toda funcao nesta pasta deve ser pura (sem efeitos colaterais), exceto `public-profile.ts` que acessa banco (documentado acima).
- Tipos de entrada e saida sempre explicitos — sem `any`.
- Usar tipos do Prisma (`HabitCategory`, `HouseName`) para manter consistencia com o schema.
- Nomear arquivos pelo dominio da regra (ex: `determine-house.ts`, nao `house-utils.ts`).
