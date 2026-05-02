// app/api/user/[id]/showcase/route.ts
//
// GET /api/user/[id]/showcase — vitrine publica de um jogador.
//
// Requer autenticacao (qualquer usuario logado pode ver vitrine de outro).
// Retorna ate 6 UserCards completos na ordem definida pelo dono.
//
// Edge cases:
//   - 401 se sem auth.
//   - 422 se ID do usuario nao for cuid.
//   - SEM 404: vitrine ausente retorna { userCardIds: [], cards: [] } com 200.
//   - UserCardIds que nao existem mais (ex: deletados) sao filtrados
//     silenciosamente do array `cards` para nao quebrar a renderizacao.

import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { verifySession, AuthenticationError } from "@/lib/auth/verify-session";
import { apiSuccess, apiError } from "@/lib/api-response";
import type { ShowcaseResponse, UserCardSummary, CardEffect, CardRarity } from "@/types/cards";

const paramsSchema = z.object({
  id: z.string().cuid("ID do usuario deve ser um CUID valido"),
});

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    await verifySession(request);

    const resolved = await params;
    const parsed = paramsSchema.safeParse(resolved);
    if (!parsed.success) {
      return apiError("ID de usuario invalido", "VALIDATION_ERROR", 422);
    }
    const targetUserId = parsed.data.id;

    const showcase = await prisma.userShowcase.findUnique({
      where: { userId: targetUserId },
      select: { userCardIds: true },
    });

    if (!showcase || showcase.userCardIds.length === 0) {
      const empty: ShowcaseResponse = { userCardIds: [], cards: [] };
      return apiSuccess(empty);
    }

    // Carregar UserCards completos (escopo: target user owna).
    const userCards = await prisma.userCard.findMany({
      where: {
        userId: targetUserId,
        id: { in: showcase.userCardIds },
      },
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
    });

    // Indexar por id para preservar ordem definida em userCardIds.
    const byId = new Map(userCards.map((uc) => [uc.id, uc] as const));
    const ordered: UserCardSummary[] = [];
    for (const id of showcase.userCardIds) {
      const uc = byId.get(id);
      if (!uc) continue;
      ordered.push({
        id: uc.id,
        equipped: uc.equipped,
        slotIndex: uc.slotIndex,
        xp: uc.xp,
        level: uc.level,
        purity: uc.purity,
        card: {
          id: uc.card.id,
          name: uc.card.name,
          flavorText: uc.card.flavorText,
          rarity: uc.card.rarity as CardRarity,
          effects: uc.card.effects as unknown as CardEffect[],
          cardArtUrl: uc.card.cardArtUrl,
          cardArtUrlSpectral: uc.card.cardArtUrlSpectral,
          mob: uc.card.mob,
        },
      });
    }

    const data: ShowcaseResponse = {
      userCardIds: showcase.userCardIds,
      cards: ordered,
    };
    return apiSuccess(data);
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return apiError(error.message, error.code, error.statusCode);
    }
    console.error("[GET /api/user/[id]/showcase]", error);
    return apiError("Erro interno do servidor", "INTERNAL_ERROR", 500);
  }
}
