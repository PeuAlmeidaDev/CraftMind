# app/(auth)/ — Rotas de Autenticação

## Rotas desta pasta

| Arquivo | Rota | Descrição |
|---|---|---|
| `login/page.tsx` | `/login` | Formulário de login |
| `register/page.tsx` | `/register` | Cadastro + seleção de hábitos + alocação de casa |

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
