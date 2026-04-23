# lib/validations/ — Schemas Zod

## Arquivos

| Arquivo | Responsabilidade |
|---|---|
| `auth.ts` | Schemas de registro e login (`registerSchema`, `loginSchema`) |
| `tasks.ts` | Schema de validacao de params para completar tarefa (`completeTaskParamsSchema`) |
| `skill.ts` | Schemas de equip/unequip de skills (`equipSkillSchema`, `unequipSkillSchema`) |
| `battle.ts` | Schemas de batalha PvE: `pveBattleActionSchema` (battleId + skillId nullable), `distributePointsSchema` (distribuicao de pontos livres) |
| `pve-multi.ts` | Schemas de batalha PvE Multi: `pveMultiActionSchema` (battleId + skillId + targetIndex), `pveMultiForfeitSchema` (battleId para desistencia) |

## Convencoes

- Cada dominio (auth, habits, battle, etc.) tem seu proprio arquivo de schemas.
- Schemas sao exportados como `const` nomeados (ex: `registerSchema`) junto com seus tipos inferidos (`RegisterInput`).
- Usar `z.infer<typeof schema>` para derivar tipos — nunca duplicar tipos manualmente.
- Mensagens de erro em portugues, sem acentos (compatibilidade de encoding).
- Transformacoes (`.trim()`, `.toLowerCase()`) devem ser aplicadas no schema para normalizar antes de chegar ao banco.

## Uso

```ts
import { registerSchema, RegisterInput } from "@/lib/validations/auth";

const parsed = registerSchema.safeParse(body);
if (!parsed.success) {
  // parsed.error.flatten() para resposta ao cliente
}
const data: RegisterInput = parsed.data;
```
