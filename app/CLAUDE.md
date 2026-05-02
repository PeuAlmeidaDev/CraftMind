# app/ — Convenções do App Router

## Estrutura de rotas

| Pasta | Rota | Propósito |
|---|---|---|
| `(auth)/` | `/login`, `/register` | Fluxo de autenticação (sem layout do jogo) |
| `(game)/` | `/dashboard`, `/battle`, `/character` | Rotas protegidas do jogo |
| `api/` | `/api/*` | Route Handlers — ver `api/CLAUDE.md` |
| `privacy/` | `/privacy` | Politica de privacidade publica (LGPD: dados coletados em login, retencao 90 dias, contato). Server Component sem layout do jogo nem auth |

## Server vs Client Components

- **Server Component por padrão**: busca de dados, leitura de sessão via cookies, renderização estática.
- **Adicionar `"use client"` apenas quando**: usar hooks React (useState, useEffect), eventos de browser, Socket.io client, ou componentes de UI interativos.
- Nunca importar `prisma` dentro de Client Components.

## Layouts

- `app/layout.tsx`: layout raiz — providers globais (fontes, ThemeProvider se houver).
- `app/(auth)/layout.tsx`: layout centrado sem navbar do jogo.
- `app/(game)/layout.tsx`: layout com navbar, verifica sessão ativa; redireciona para `/login` se não autenticado.

## Convenções de arquivo

- `page.tsx`: componente de página (Server Component por padrão).
- `loading.tsx`: skeleton/loading state automático do React Suspense.
- `error.tsx`: boundary de erro da rota — sempre `"use client"`.
- `actions.ts`: Server Actions da rota (se houver).

## Proteção de rotas

- **Middleware (`middleware.ts` na raiz)** protege rotas `/dashboard`, `/character`, `/battle`, `/lobby` via JWT no header `Authorization: Bearer <token>`. Redireciona para `/login` se não autenticado. Também redireciona usuários autenticados de `/login` e `/register` para `/dashboard`.
- O middleware seta o header `x-user-id` nas requests autenticadas para uso em Server Components.
- Verificar sessão no layout de `(game)/` via cookie `httpOnly` como camada adicional. Nunca verificar autenticação apenas no cliente.

## Tema visual

- Variáveis CSS custom definidas em `globals.css` (dark RPG theme).
- Usar `var(--bg-primary)`, `var(--bg-card)`, `var(--accent-primary)`, etc. em vez de cores hardcoded quando possível.
- Fonte padrão: Inter (carregada via `next/font/google` no layout raiz).
- **Tema dinâmico por casa**: o layout `(game)/layout.tsx` chama `applyHouseTheme()` de `lib/theme.ts` após carregar o perfil do usuário. Isso sobrescreve as 6 CSS variables do `:root` com a paleta da casa. Os valores em `globals.css` (NOCTIS) servem como fallback SSR/pré-JS.
