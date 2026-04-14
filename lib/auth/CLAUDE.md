# lib/auth/ — Autenticacao e Tokens

## Arquivos

| Arquivo | Responsabilidade |
|---|---|
| `password.ts` | Hash e verificacao de senhas com bcryptjs (12 rounds) |
| `jwt.ts` | Assinatura e verificacao de JWT (access + refresh) via jose (Edge-compatible) |
| `verify-session.ts` | Helper centralizado para extrair e verificar token de uma Request. Busca primeiro no header `Authorization: Bearer`, depois no cookie `access_token`. Lanca `AuthenticationError` com `code` e `statusCode` tipados |
| `refresh-token.ts` | Persistencia e rotacao segura de refresh tokens no banco. Exporta `createPersistedRefreshToken()`, `rotateRefreshToken()` e `revokeRefreshTokenByValue()`. Usa hash SHA-256 do token (nunca armazena o JWT raw). Implementa rotacao por familia — reuso de token revogado invalida toda a familia (deteccao de roubo). Rotacao usa `updateMany` atomico com `revoked: false` para evitar race condition |
| `set-auth-cookies.ts` | Helper centralizado para definir/limpar cookies de autenticacao. Exporta `setAccessTokenCookie()`, `setRefreshTokenCookie()` e `clearAuthCookies()`. Garante atributos consistentes (httpOnly, secure em prod, sameSite strict) em todas as rotas de auth |

## Decisoes de design

- **jose** em vez de jsonwebtoken para compatibilidade com Edge Runtime do Next.js.
- Access tokens expiram em 15 minutos; refresh tokens em 7 dias.
- Algoritmo HS256 com segredos distintos (`JWT_SECRET` e `JWT_REFRESH_SECRET`).
- Erros de verificacao mapeados para tipos proprios (`TokenExpiredError`, `InvalidTokenError`) para facilitar tratamento no caller.
- Refresh tokens sao persistidos no banco (model `RefreshToken`) com hash SHA-256. Rotacao por familia: cada login cria uma nova familia, e cada refresh emite novo token na mesma familia revogando o anterior. Reuso de token revogado invalida toda a familia (protecao contra roubo).
- `jwt.ts` exporta helpers `hashToken()` e `generateTokenFamily()` usados por `refresh-token.ts`.

## Variaveis de ambiente necessarias

| Variavel | Uso |
|---|---|
| `JWT_SECRET` | Assinar/verificar access tokens |
| `JWT_REFRESH_SECRET` | Assinar/verificar refresh tokens |

## Uso

```ts
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import {
  signAccessToken,
  signRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  TokenExpiredError,
  InvalidTokenError,
} from "@/lib/auth/jwt";

// Helper centralizado para rotas protegidas (substitui verificacao manual em cada rota)
import { verifySession, AuthenticationError } from "@/lib/auth/verify-session";
```

### verifySession — padrao para rotas protegidas

```ts
import { verifySession, AuthenticationError } from "@/lib/auth/verify-session";
import { apiSuccess, apiError } from "@/lib/api-response";

export async function GET(request: Request) {
  try {
    const { userId, email } = await verifySession(request);
    // ... logica da rota
    return apiSuccess(data);
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return apiError(error.message, error.code, error.statusCode);
    }
    return apiError("Erro interno do servidor", "INTERNAL_ERROR", 500);
  }
}
```

`AuthenticationError` possui `.code` (`MISSING_TOKEN` | `TOKEN_EXPIRED` | `INVALID_TOKEN`) e `.statusCode` (sempre 401).
