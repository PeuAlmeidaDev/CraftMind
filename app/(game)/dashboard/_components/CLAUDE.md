# app/(game)/dashboard/_components/ — Componentes do Dashboard

## Arquivos

| Arquivo | Descricao |
|---|---|
| `constants.ts` | Constantes visuais compartilhadas: `ATTRIBUTE_META`, `CATEGORY_COLORS`, `CATEGORY_LABEL` |
| `ActivityCalendar.tsx` | Calendario de atividade com navegacao mensal e tooltips. Gerencia AbortController interno para cancelar fetches ao trocar mes |
| `EquippedSkillsPreview.tsx` | Grid 2x2 de habilidades equipadas com badge de tier e link para /character |

## Convencoes

- Componentes extraidos apenas quando >50 linhas e/ou reutilizaveis
- Componentes menores e acoplados ao dashboard (ProgressBar, AttributePanel, TaskCard, LevelExpBar, skeletons) permanecem inline em `page.tsx`
- Constantes em `constants.ts` sao importadas tanto pelo `page.tsx` quanto pelos componentes extraidos
- ActivityCalendar recebe `onMonthChange(year, month, signal)` com AbortSignal para cancelamento de fetches anteriores
