import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  verifySession,
  AuthenticationError,
} from "@/lib/auth/verify-session";
import { apiSuccess, apiError } from "@/lib/api-response";

const PAGE_SIZE = 20;

type BattleResult = "VICTORY" | "DEFEAT" | "DRAW";

type BattleHistoryEntry = {
  id: string;
  result: BattleResult;
  opponentName: string;
  createdAt: Date;
};

export async function GET(request: NextRequest) {
  try {
    const { userId } = await verifySession(request);

    const pageParam = request.nextUrl.searchParams.get("page");
    const page = Math.max(1, parseInt(pageParam ?? "1", 10) || 1);

    const where = {
      status: "FINISHED" as const,
      OR: [{ player1Id: userId }, { player2Id: userId }],
    };

    const [battles, total] = await Promise.all([
      prisma.battle.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
        select: {
          id: true,
          winnerId: true,
          createdAt: true,
          player1: { select: { id: true, name: true } },
          player2: { select: { id: true, name: true } },
        },
      }),
      prisma.battle.count({ where }),
    ]);

    const mapped: BattleHistoryEntry[] = battles.map((battle) => {
      const isPlayer1 = battle.player1.id === userId;
      const opponentName = isPlayer1
        ? battle.player2.name
        : battle.player1.name;

      let result: BattleResult;
      if (battle.winnerId === null) {
        result = "DRAW";
      } else if (battle.winnerId === userId) {
        result = "VICTORY";
      } else {
        result = "DEFEAT";
      }

      return {
        id: battle.id,
        result,
        opponentName,
        createdAt: battle.createdAt,
      };
    });

    return apiSuccess({
      battles: mapped,
      pagination: {
        page,
        pageSize: PAGE_SIZE,
        total,
        totalPages: Math.ceil(total / PAGE_SIZE),
      },
    });
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return apiError(error.message, error.code, error.statusCode);
    }

    console.error("[GET /api/battle/pvp/history]", error);
    return apiError("Erro interno do servidor", "INTERNAL_ERROR", 500);
  }
}
