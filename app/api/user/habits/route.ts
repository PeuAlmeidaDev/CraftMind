import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifySession, AuthenticationError } from "@/lib/auth/verify-session";
import { apiSuccess, apiError } from "@/lib/api-response";

export async function GET(request: NextRequest) {
  try {
    const { userId } = await verifySession(request);

    // Buscar habitos do usuario
    const userHabits = await prisma.userHabit.findMany({
      where: { userId },
      select: {
        habit: {
          select: {
            id: true,
            name: true,
            description: true,
            category: true,
          },
        },
      },
    });

    const habits = userHabits.map((uh) => uh.habit);

    return apiSuccess(habits);
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return apiError(error.message, error.code, error.statusCode);
    }

    console.error("[GET /api/user/habits]", error);
    return apiError("Erro interno do servidor", "INTERNAL_ERROR", 500);
  }
}
