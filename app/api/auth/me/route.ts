import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifySession, AuthenticationError } from "@/lib/auth/verify-session";
import { apiSuccess, apiError } from "@/lib/api-response";

export async function GET(request: NextRequest) {
  try {
    const { userId } = await verifySession(request);

    const user = await prisma.user.findUnique({
      where: { id: userId },
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

    if (!user) {
      return apiError("Usuário não encontrado", "USER_NOT_FOUND", 404);
    }

    const habits = user.habits.map((uh) => uh.habit);

    return apiSuccess({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        house: user.house,
      },
      habits,
      character: user.character,
    });
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return apiError(error.message, error.code, error.statusCode);
    }

    console.error("[GET /api/auth/me]", error);
    return apiError("Erro interno do servidor", "INTERNAL_ERROR", 500);
  }
}
