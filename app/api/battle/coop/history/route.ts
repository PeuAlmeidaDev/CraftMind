import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifySession, AuthenticationError } from "@/lib/auth/verify-session";
import { apiSuccess, apiError } from "@/lib/api-response";

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 50;

export async function GET(request: NextRequest) {
  try {
    const { userId } = await verifySession(request);

    const pageParam = request.nextUrl.searchParams.get("page");
    const limitParam = request.nextUrl.searchParams.get("limit");

    const page = Math.max(1, parseInt(pageParam ?? "1", 10) || 1);
    const limit = Math.min(
      MAX_PAGE_SIZE,
      Math.max(1, parseInt(limitParam ?? String(DEFAULT_PAGE_SIZE), 10) || DEFAULT_PAGE_SIZE)
    );

    const where = {
      userId,
      coopBattle: { status: "FINISHED" },
    } as const;

    const [participants, total] = await Promise.all([
      prisma.coopBattleParticipant.findMany({
        where,
        orderBy: { coopBattle: { createdAt: "desc" } },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          dominantCategory: true,
          coopBattle: {
            select: {
              id: true,
              result: true,
              turns: true,
              expGained: true,
              createdAt: true,
              boss: {
                select: {
                  name: true,
                  description: true,
                  tier: true,
                  category: true,
                },
              },
            },
          },
        },
      }),
      prisma.coopBattleParticipant.count({ where }),
    ]);

    const battles = participants.map((participant) => ({
      id: participant.coopBattle.id,
      bossName: participant.coopBattle.boss.name,
      bossDescription: participant.coopBattle.boss.description,
      bossTier: participant.coopBattle.boss.tier,
      category: participant.coopBattle.boss.category,
      result: participant.coopBattle.result,
      turns: participant.coopBattle.turns,
      expGained: participant.coopBattle.expGained,
      dominantCategory: participant.dominantCategory,
      date: participant.coopBattle.createdAt,
    }));

    return apiSuccess({
      battles,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return apiError(error.message, error.code, error.statusCode);
    }

    console.error("[GET /api/battle/coop/history]", error);
    return apiError("Erro interno do servidor", "INTERNAL_ERROR", 500);
  }
}
