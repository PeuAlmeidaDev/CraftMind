import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifySession, AuthenticationError } from "@/lib/auth/verify-session";
import { apiSuccess, apiError } from "@/lib/api-response";

export async function GET(request: NextRequest) {
  try {
    const { userId } = await verifySession(request);

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, Number(searchParams.get("page")) || 1);
    const limit = Math.min(50, Math.max(1, Number(searchParams.get("limit")) || 20));
    const offset = (page - 1) * limit;

    const [battles, total] = await Promise.all([
      prisma.pveBattle.findMany({
        where: {
          userId,
          mode: { in: ["COOP_2V3", "COOP_2V5", "COOP_3V5"] },
          result: { not: null },
        },
        orderBy: { createdAt: "desc" },
        skip: offset,
        take: limit,
        select: {
          id: true,
          result: true,
          expGained: true,
          turns: true,
          mode: true,
          mobIds: true,
          teamMateId: true,
          createdAt: true,
        },
      }),
      prisma.pveBattle.count({
        where: {
          userId,
          mode: { in: ["COOP_2V3", "COOP_2V5", "COOP_3V5"] },
          result: { not: null },
        },
      }),
    ]);

    return apiSuccess({
      battles,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return apiError(error.message, error.code, error.statusCode);
    }
    console.error("[GET /api/battle/coop-pve/history]", error);
    return apiError("Erro interno do servidor", "INTERNAL_ERROR", 500);
  }
}
