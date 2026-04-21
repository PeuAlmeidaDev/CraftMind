import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/auth/password";
import { signAccessToken } from "@/lib/auth/jwt";
import { createPersistedRefreshToken } from "@/lib/auth/refresh-token";
import { setRefreshTokenCookie, setAccessTokenCookie } from "@/lib/auth/set-auth-cookies";
import { authRateLimit, getClientIp } from "@/lib/rate-limit";
import { loginSchema } from "@/lib/validations/auth";
import { apiSuccess, apiError } from "@/lib/api-response";

export async function POST(request: NextRequest) {
  try {
    // Rate limiting pelo IP
    const ip = getClientIp(request);

    const rateLimitResult = await authRateLimit(ip);

    if (!rateLimitResult.success) {
      const retryAfterSeconds = Math.ceil((rateLimitResult.reset - Date.now()) / 1000);
      const response = apiError(
        "Muitas tentativas. Tente novamente mais tarde.",
        "RATE_LIMIT_EXCEEDED",
        429
      );
      response.headers.set("Retry-After", String(retryAfterSeconds));
      return response;
    }

    // Parse e validacao do body
    const body: unknown = await request.json().catch(() => null);

    if (!body) {
      return apiError("Body da requisicao invalido", "INVALID_BODY", 400);
    }

    const parsed = loginSchema.safeParse(body);

    if (!parsed.success) {
      return apiError("Dados invalidos", "VALIDATION_ERROR", 422);
    }

    const { email, password } = parsed.data;

    // Buscar usuario pelo email (apenas para verificar senha)
    const userAuth = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        passwordHash: true,
      },
    });

    // Dummy hash para prevenir timing-based email enumeration
    if (!userAuth) {
      await verifyPassword(password, "$2a$12$000000000000000000000uGHEGLhR4kp3n0PMnxrCZuuMOYmMYjLu");
      return apiError("Credenciais invalidas", "INVALID_CREDENTIALS", 401);
    }

    const passwordValid = await verifyPassword(password, userAuth.passwordHash);

    if (!passwordValid) {
      return apiError("Credenciais invalidas", "INVALID_CREDENTIALS", 401);
    }

    // Buscar dados completos do usuario (casa, habitos, character)
    const user = await prisma.user.findUnique({
      where: { id: userAuth.id },
      select: {
        id: true,
        name: true,
        email: true,
        house: {
          select: {
            id: true,
            name: true,
            animal: true,
            description: true,
          },
        },
        habits: {
          select: {
            habit: {
              select: {
                id: true,
                name: true,
                category: true,
              },
            },
          },
        },
        character: {
          select: {
            id: true,
            physicalAtk: true,
            physicalDef: true,
            magicAtk: true,
            magicDef: true,
            hp: true,
            speed: true,
          },
        },
      },
    });

    if (!user || !user.house || !user.character) {
      console.error(`[POST /api/auth/login] Dados incompletos para usuario ${userAuth.id}`);
      return apiError("Erro interno do servidor", "INTERNAL_ERROR", 500);
    }

    // Gerar tokens
    const [accessToken, { token: refreshToken }] = await Promise.all([
      signAccessToken({ userId: user.id, email: user.email }),
      createPersistedRefreshToken({ userId: user.id }),
    ]);

    // Formatar habitos para resposta (remover nesting do UserHabit)
    const formattedHabits = user.habits.map((uh) => uh.habit);

    // Montar resposta com cookie de refresh token
    const response = apiSuccess({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        house: user.house,
        habits: formattedHabits,
      },
      character: user.character,
      accessToken,
    });

    setAccessTokenCookie(response, accessToken);
    setRefreshTokenCookie(response, refreshToken);

    return response;
  } catch (error) {
    console.error("[POST /api/auth/login]", error);

    return apiError("Erro interno do servidor", "INTERNAL_ERROR", 500);
  }
}
