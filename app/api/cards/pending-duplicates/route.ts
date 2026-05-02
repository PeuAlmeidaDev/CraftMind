// app/api/cards/pending-duplicates/route.ts
//
// GET /api/cards/pending-duplicates — lista as pendencias do usuario autenticado.
//
// Pendencia eh criada quando um drop de duplicata de um cristal ja possuido
// rola purity MAIOR que a copia atual. O jogador resolve via
// POST /api/cards/pending-duplicates/[id]/resolve com decision REPLACE ou CONVERT.
//
// Sem expiracao — pendencias acumulam ate o jogador resolver.
//
// Resposta: PendingCardDuplicateSummary[] (ver types/cards.ts).
// Paginacao opcional via query params `?limit=N&offset=M`.

import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifySession, AuthenticationError } from "@/lib/auth/verify-session";
import { apiSuccess, apiError } from "@/lib/api-response";
import type { PendingCardDuplicateSummary, CardRarity } from "@/types/cards";

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

export async function GET(request: NextRequest) {
  try {
    const { userId } = await verifySession(request);

    // Paginacao opcional. Defaults conservadores para evitar payloads gigantes.
    const url = new URL(request.url);
    const rawLimit = Number.parseInt(url.searchParams.get("limit") ?? "", 10);
    const rawOffset = Number.parseInt(url.searchParams.get("offset") ?? "", 10);
    const limit = Number.isFinite(rawLimit)
      ? Math.min(MAX_LIMIT, Math.max(1, rawLimit))
      : DEFAULT_LIMIT;
    const offset = Number.isFinite(rawOffset) ? Math.max(0, rawOffset) : 0;

    const [pendings, total] = await Promise.all([
      prisma.pendingCardDuplicate.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset,
        include: {
          userCard: {
            include: {
              card: {
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
              },
            },
          },
        },
      }),
      prisma.pendingCardDuplicate.count({ where: { userId } }),
    ]);

    const data: PendingCardDuplicateSummary[] = pendings.map((p) => ({
      id: p.id,
      newPurity: p.newPurity,
      createdAt: p.createdAt.toISOString(),
      userCard: {
        id: p.userCard.id,
        xp: p.userCard.xp,
        level: p.userCard.level,
        purity: p.userCard.purity,
        card: {
          id: p.userCard.card.id,
          name: p.userCard.card.name,
          flavorText: p.userCard.card.flavorText,
          rarity: p.userCard.card.rarity as CardRarity,
          mob: p.userCard.card.mob,
        },
      },
    }));

    return apiSuccess({
      pendingDuplicates: data,
      pagination: { total, limit, offset },
    });
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return apiError(error.message, error.code, error.statusCode);
    }
    console.error("[GET /api/cards/pending-duplicates]", error);
    return apiError("Erro interno do servidor", "INTERNAL_ERROR", 500);
  }
}
