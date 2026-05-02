// app/api/cards/route.ts — GET lista todas as UserCards do usuario autenticado.
//
// Resposta inclui Card (com effects, raridade, flavor) + Mob origem (id, nome, tier, imageUrl)
// para que o frontend mostre tudo em uma tela so.

import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifySession, AuthenticationError } from "@/lib/auth/verify-session";
import { apiSuccess, apiError } from "@/lib/api-response";

export async function GET(request: NextRequest) {
  try {
    const { userId } = await verifySession(request);

    const userCards = await prisma.userCard.findMany({
      where: { userId },
      orderBy: { createdAt: "asc" },
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

    const data = userCards.map((uc) => ({
      id: uc.id,
      equipped: uc.equipped,
      slotIndex: uc.slotIndex,
      xp: uc.xp,
      level: uc.level,
      purity: uc.purity,
      spectralSkillId: uc.spectralSkillId,
      card: {
        id: uc.card.id,
        name: uc.card.name,
        flavorText: uc.card.flavorText,
        rarity: uc.card.rarity,
        effects: uc.card.effects,
        mob: uc.card.mob,
      },
    }));

    return apiSuccess({ userCards: data });
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return apiError(error.message, error.code, error.statusCode);
    }
    console.error("[GET /api/cards]", error);
    return apiError("Erro interno do servidor", "INTERNAL_ERROR", 500);
  }
}
