# components/ — Componentes React Reutilizáveis

## Nomenclatura

- PascalCase para arquivos e componentes: `HabitCard.tsx`, `BattlePanel.tsx`.
- Sufixo descritivo do papel: `*Card`, `*Panel`, `*Form`, `*Button`, `*Modal`, `*Badge`.
- Client Components com interatividade: adicionar `"use client"` na primeira linha.

## Props: sempre tipadas explicitamente

```ts
// correto
type HabitCardProps = {
  habitId: string
  name: string
  completed: boolean
  onComplete: (id: string) => void
}

// proibido
function HabitCard(props: any) { ... }
```

Nunca usar `any`. Exportar o tipo de props junto ao componente se for reutilizado externamente.

## Quando criar vs reutilizar

- Criar novo componente: lógica ou markup usado em 2+ lugares, ou bloco com mais de 40 linhas.
- Reutilizar: verificar esta pasta antes de criar — evitar duplicação de `Button`, `Card`, `Badge`.
- Componentes de UI genéricos (Button, Input, Badge) ficam em `components/ui/`.
- Componentes de domínio do jogo ficam na raiz de `components/`: `CharacterCard`, `HabitList`, `BattleLog`.

## Subpastas

| Pasta | Conteúdo |
|---|---|
| `components/ui/` | Primitivos de UI sem lógica de negócio |
| `components/battle/` | Componentes da tela de batalha |
| `components/habits/` | Componentes do sistema de hábitos |
| `components/character/` | Componentes da tela de personagem |

## Regras

- Nunca importar `prisma` em componentes — dados chegam via props ou fetch na página pai.
- Efeitos colaterais (fetch, socket) apenas em Client Components.
- Componentes Server Components não recebem callbacks como props.
