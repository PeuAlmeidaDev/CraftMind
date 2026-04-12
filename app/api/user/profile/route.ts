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
        avatarUrl: true,
        house: {
          select: {
            name: true,
            animal: true,
            description: true,
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
      return apiError("Usuario nao encontrado", "USER_NOT_FOUND", 404);
    }

    return apiSuccess({
      id: user.id,
      name: user.name,
      email: user.email,
      avatarUrl: user.avatarUrl,
      house: user.house,
      character: user.character,
    });
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return apiError(error.message, error.code, error.statusCode);
    }

    console.error("[GET /api/user/profile]", error);
    return apiError("Erro interno do servidor", "INTERNAL_ERROR", 500);
  }
}
