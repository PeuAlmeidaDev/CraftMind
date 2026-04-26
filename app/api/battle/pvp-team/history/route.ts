import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  verifySession,
  AuthenticationError,
} from "@/lib/auth/verify-session";
import { apiSuccess, apiError } from "@/lib/api-response";

const PAGE_SIZE = 20;

type TeamBattleResult = "VICTORY" | "DEFEAT" | "DRAW";

type TeamBattleHistoryEntry = {
  id: string;
  result: TeamBattleResult;
  winnerTeam: number | null;
  myTeam: number;
  turns: number;
  teammates: string[];
  opponents: string[];
  createdAt: Date;
};

export async function GET(request: NextRequest) {
  try {
    const { userId } = await verifySession(request);

    const pageParam = request.nextUrl.searchParams.get("page");
    const page = Math.max(1, parseInt(pageParam ?? "1", 10) || 1);

    const where = {
      status: "FINISHED" as const,
      participants: {
        some: { userId },
      },
    };

    const [battles, total] = await Promise.all([
      prisma.teamBattle.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
        select: {
          id: true,
          winnerTeam: true,
          turns: true,
          createdAt: true,
          participants: {
            select: {
              userId: true,
              team: true,
              user: { select: { name: true } },
            },
          },
        },
      }),
      prisma.teamBattle.count({ where }),
    ]);

    const mapped: TeamBattleHistoryEntry[] = battles.map((battle) => {
      const myParticipant = battle.participants.find((p) => p.userId === userId);
      const myTeam = myParticipant?.team ?? 1;

      let result: TeamBattleResult;
      if (battle.winnerTeam === null) {
        result = "DRAW";
      } else if (battle.winnerTeam === myTeam) {
        result = "VICTORY";
      } else {
        result = "DEFEAT";
      }

      const teammates = battle.participants
        .filter((p) => p.team === myTeam && p.userId !== userId)
        .map((p) => p.user.name);

      const opponents = battle.participants
        .filter((p) => p.team !== myTeam)
        .map((p) => p.user.name);

      return {
        id: battle.id,
        result,
        winnerTeam: battle.winnerTeam,
        myTeam,
        turns: battle.turns,
        teammates,
        opponents,
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

    console.error("[GET /api/battle/pvp-team/history]", error);
    return apiError("Erro interno do servidor", "INTERNAL_ERROR", 500);
  }
}
