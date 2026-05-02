# app/(auth)/ — Rotas de Autenticação

## Rotas desta pasta

| Arquivo | Rota | Descrição |
|---|---|---|
| `login/page.tsx` | `/login` | Formulário de login |
| `register/page.tsx` | `/register` | Cadastro + seleção de hábitos + alocação de casa |

## Componentes extraidos

| Arquivo | Descrição |
|---|---|
| `register/_components/StepIndicator.tsx` | Indicador de progresso de 3 etapas do cadastro |
| `register/_components/HabitCard.tsx` | Card de habito com checkbox visual para selecao |
| `register/_components/PasswordRequirements.tsx` | Indicador visual dos requisitos de senha |

## Hooks compartilhados

| Arquivo | Descrição |
|---|---|
| `_lib/use-fingerprint.ts` | Hook `useFingerprint(): { visitorId, ready }` (anti multi-account). Carrega FingerprintJS via dynamic import, cacheia em `localStorage["cm:visitorId"]`. Em qualquer falha (ad blocker, lib bloqueada) retorna `{ visitorId: "unknown", ready: true }` — nunca lanca pro componente. Login e Register usam para incluir `visitorId` no body do POST e desabilitam o submit enquanto `ready === false` |

## Padrões obrigatórios

- Formulários são Client Components (`"use client"`) — chamam API Routes via fetch.
- Nunca processar login/registro direto no Server Action sem validação Zod.
- Após login bem-sucedido: redirecionar para `/dashboard` via `router.push`.
- Se usuário já autenticado acessar `/login` ou `/register`: redirecionar para `/dashboard`.
- Verificar cookie de sessão no layout ou no início de cada `page.tsx` (Server Component).

## Fluxo de cadastro (Fase 2)

1. Usuário preenche nome, e-mail, senha.
2. Usuário seleciona categorias de hábitos de interesse (Físicos, Intelectuais, Mentais, Sociais, Espirituais).
3. Sistema aloca automaticamente a casa com base nos hábitos predominantes (Arion, Lycus, Noctis, Nereid).
4. POST para `/api/auth/register` — retorna access token + refresh token em cookies httpOnly.

## Segurança

- Senha: bcryptjs com 12 rounds mínimo — nunca armazenar plain text.
- Rate limiting em `/api/auth/register` e `/api/auth/login` via @upstash/ratelimit.
- Cookies: `httpOnly: true`, `secure: true` (produção), `sameSite: "strict"`.
- Retornar mensagens de erro genéricas ao cliente (não vazar se e-mail existe ou não).

## Gestao de tokens pos-login

O backend seta cookies httpOnly (`access_token`, `refresh_token`) via `Set-Cookie` na resposta.
O frontend tambem salva o `accessToken` em `localStorage` porque as paginas `(game)/` ainda
leem dele para montar o header `Authorization: Bearer`. **Nunca** setar `document.cookie`
manualmente no frontend — isso criaria um cookie duplicado sem `httpOnly`, anulando a protecao.
Quando todas as paginas `(game)/` migrarem para cookie-only, remover o `localStorage`.
