import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifySession, AuthenticationError } from "@/lib/auth/verify-session";
import { apiSuccess, apiError } from "@/lib/api-response";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await verifySession(request);

    const { id: targetUserId } = await params;

    const user = await prisma.user.findUnique({
      where: { id: targetUserId },
      select: {
        id: true,
        name: true,
        avatarUrl: true,
        house: {
          select: {
            name: true,
            animal: true,
          },
        },
        character: {
          select: {
            level: true,
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
      return apiError("Jogador nao encontrado", "USER_NOT_FOUND", 404);
    }

    const [pvpBattles, pvpWins, pvpDraws] = await Promise.all([
      prisma.battle.count({
        where: {
          OR: [{ player1Id: targetUserId }, { player2Id: targetUserId }],
          status: "FINISHED",
        },
      }),
      prisma.battle.count({
        where: { winnerId: targetUserId, status: "FINISHED" },
      }),
      prisma.battle.count({
        where: {
          OR: [{ player1Id: targetUserId }, { player2Id: targetUserId }],
          status: "FINISHED",
          winnerId: null,
        },
      }),
    ]);

    return apiSuccess({
      id: user.id,
      name: user.name,
      avatarUrl: user.avatarUrl,
      house: user.house,
      character: user.character,
      pvpStats: {
        totalBattles: pvpBattles,
        wins: pvpWins,
        losses: pvpBattles - pvpWins - pvpDraws,
        draws: pvpDraws,
      },
    });
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return apiError(error.message, error.code, error.statusCode);
    }

    console.error("[GET /api/user/[id]/profile]", error);
    return apiError("Erro interno do servidor", "INTERNAL_ERROR", 500);
  }
}
