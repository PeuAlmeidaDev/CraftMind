import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifySession, AuthenticationError } from "@/lib/auth/verify-session";
import { apiSuccess, apiError } from "@/lib/api-response";

const PAGE_SIZE = 20;

export async function GET(request: NextRequest) {
  try {
    const { userId } = await verifySession(request);

    const pageParam = request.nextUrl.searchParams.get("page");
    const page = Math.max(1, parseInt(pageParam ?? "1", 10) || 1);

    const battles = await prisma.pveBattle.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        result: true,
        expGained: true,
        turns: true,
        createdAt: true,
        mob: {
          select: {
            name: true,
            tier: true,
          },
        },
      },
    });

    return apiSuccess({
      battles,
      page,
      pageSize: PAGE_SIZE,
    });
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return apiError(error.message, error.code, error.statusCode);
    }

    console.error("[GET /api/battle/pve/history]", error);
    return apiError("Erro interno do servidor", "INTERNAL_ERROR", 500);
  }
}
