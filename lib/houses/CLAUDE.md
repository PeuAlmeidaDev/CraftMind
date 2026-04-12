# lib/houses/ — Assets e utilitarios de casas

## Proposito

Helpers puros (sem "use client") para resolver paths de imagens e metadados visuais das casas do jogo.

## Arquivos

| Arquivo | Descricao |
|---|---|
| `house-assets.ts` | Mapeia `HouseName` para paths de brasao e bandeira em `public/houses/`. Retorna `null` para casas sem imagens disponiveis. |

## Convencoes de imagens

- Pastas em `public/houses/{PastaCapitalizada}/` (ex: `Lycus`, `Arion`).
- Nomes de arquivo: `{lowercase}-brasao.png`, `{lowercase}-bandeira.png`.
- Ao adicionar imagens para uma nova casa, incluir o `HouseName` no set `HOUSES_WITH_ASSETS` em `house-assets.ts`.

## Casas com assets

- LYCUS (brasao + bandeira)
- ARION, NOCTIS, NEREID: pendentes (retornam `null`).
