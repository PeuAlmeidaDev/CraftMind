import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth/password";
import { signAccessToken } from "@/lib/auth/jwt";
import { createPersistedRefreshToken } from "@/lib/auth/refresh-token";
import { setRefreshTokenCookie, setAccessTokenCookie } from "@/lib/auth/set-auth-cookies";
import { authRateLimit, getClientIp } from "@/lib/rate-limit";
import { registerSchema } from "@/lib/validations/auth";
import { determineHouse } from "@/lib/helpers/determine-house";
import { apiSuccess, apiError } from "@/lib/api-response";

export async function POST(request: NextRequest) {
  try {
    // Rate limiting pelo IP
    const ip = getClientIp(request);

    const rateLimitResult = await authRateLimit(ip);

    if (!rateLimitResult.success) {
      const response = apiError(
        "Muitas tentativas. Tente novamente mais tarde.",
        "RATE_LIMIT_EXCEEDED",
        429
      );
      response.headers.set(
        "Retry-After",
        String(Math.ceil((rateLimitResult.reset - Date.now()) / 1000))
      );
      return response;
    }

    // Parse e validacao do body
    const body: unknown = await request.json().catch(() => null);

    if (!body) {
      return apiError("Body da requisicao invalido", "INVALID_BODY", 400);
    }

    const parsed = registerSchema.safeParse(body);

    if (!parsed.success) {
      return apiError(
        "Dados invalidos",
        "VALIDATION_ERROR",
        422,
        parsed.error.flatten()
      );
    }

    const { name, email, password, habitIds } = parsed.data;

    // Verificar se nome ou email ja estao em uso (queries paralelas)
    const [existingName, existingEmail] = await Promise.all([
      prisma.user.findUnique({
        where: { name },
        select: { id: true },
      }),
      prisma.user.findUnique({
        where: { email },
        select: { id: true },
      }),
    ]);

    if (existingName || existingEmail) {
      // Executar hash para equalizar timing independente do motivo da falha
      await hashPassword(password);
      return apiError("Nao foi possivel completar o registro", "REGISTER_FAILED", 422);
    }

    // Validar que todos os habitIds existem no banco
    const habits = await prisma.habit.findMany({
      where: { id: { in: habitIds } },
      select: { id: true, name: true },
    });

    if (habits.length !== habitIds.length) {
      const foundIds = new Set(habits.map((h) => h.id));
      const invalidIds = habitIds.filter((id) => !foundIds.has(id));
      return apiError(
        "Um ou mais habitos selecionados nao existem",
        "INVALID_HABIT_IDS",
        400,
        { invalidIds }
      );
    }

    // Determinar a casa com base nos habitos selecionados
    const houseName = determineHouse(habits);

    const house = await prisma.house.findUnique({
      where: { name: houseName },
      select: { id: true, name: true, animal: true, description: true },
    });

    if (!house) {
      console.error(`[POST /api/auth/register] Casa ${houseName} nao encontrada no banco`);
      return apiError("Erro interno do servidor", "INTERNAL_ERROR", 500);
    }

    // Criar usuario com casa e habitos em transacao atomica
    const passwordHash = await hashPassword(password);

    const { user, character } = await prisma.$transaction(async (tx) => {
      const createdUser = await tx.user.create({
        data: {
          name,
          email,
          passwordHash,
          houseId: house.id,
          habits: {
            create: habitIds.map((habitId) => ({
              habitId,
            })),
          },
        },
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
        },
      });

      const createdCharacter = await tx.character.create({
        data: { userId: createdUser.id },
        select: {
          id: true,
          physicalAtk: true,
          physicalDef: true,
          magicAtk: true,
          magicDef: true,
          hp: true,
          speed: true,
        },
      });

      // Equipar skills iniciais: "Ataque Rapido" (slot 0) e "Bola de Fogo" (slot 1)
      const [starterPhysical, starterMagical] = await Promise.all([
        tx.skill.findUnique({
          where: { name: "Ataque Rapido" },
          select: { id: true },
        }),
        tx.skill.findUnique({
          where: { name: "Bola de Fogo" },
          select: { id: true },
        }),
      ]);

      if (!starterPhysical || !starterMagical) {
        throw new Error(
          "Skills iniciais 'Ataque Rapido' e/ou 'Bola de Fogo' nao encontradas. Execute npx prisma db seed."
        );
      }

      await tx.characterSkill.createMany({
        data: [
          {
            characterId: createdCharacter.id,
            skillId: starterPhysical.id,
            equipped: true,
            slotIndex: 0,
          },
          {
            characterId: createdCharacter.id,
            skillId: starterMagical.id,
            equipped: true,
            slotIndex: 1,
          },
        ],
      });

      return { user: createdUser, character: createdCharacter };
    });

    // Gerar tokens
    const [accessToken, { token: refreshToken }] = await Promise.all([
      signAccessToken({ userId: user.id, email: user.email }),
      createPersistedRefreshToken({ userId: user.id }),
    ]);

    // Formatar habitos para resposta (remover nesting do UserHabit)
    const formattedHabits = user.habits.map((uh) => uh.habit);

    // Montar resposta com cookie de refresh token
    const response = apiSuccess(
      {
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          house: user.house,
          habits: formattedHabits,
        },
        character,
        accessToken,
      },
      201
    );

    setAccessTokenCookie(response, accessToken);
    setRefreshTokenCookie(response, refreshToken);

    return response;
  } catch (error) {
    console.error("[POST /api/auth/register]", error);

    return apiError("Erro interno do servidor", "INTERNAL_ERROR", 500);
  }
}
