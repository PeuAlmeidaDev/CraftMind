import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiSuccess, apiError } from "@/lib/api-response";

/** GET /api/admin/cards — lista todas as Cards (1 por mob), com info do mob para exibicao. */
export async function GET(_request: NextRequest) {
  try {
    const cards = await prisma.card.findMany({
      orderBy: [{ mob: { tier: "asc" } }, { name: "asc" }],
      include: {
        mob: {
          select: {
            id: true,
            name: true,
            tier: true,
            imageUrl: true,
          },
        },
      },
    });
    return apiSuccess(cards);
  } catch (error) {
    console.error("[GET /api/admin/cards]", error);
    return apiError("Erro interno do servidor", "INTERNAL_ERROR", 500);
  }
}
