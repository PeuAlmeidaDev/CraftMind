// app/api/cards/equip/route.ts — POST equipa um cristal em um slot 0/1/2.
//
// Body: { userCardId: string, slotIndex: 0 | 1 | 2 }
// - Valida ownership da userCard.
// - Em transacao:
//   1. Desequipa qualquer carta atualmente no `slotIndex` do usuario.
//   2. Desequipa a propria carta (caso ja esteja em outro slot — re-equipar move).
//   3. Equipa a carta no slotIndex.
// - Bloqueia operacao se houver batalha PvE solo ativa (mesmo padrao das skills).

import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifySession, AuthenticationError } from "@/lib/auth/verify-session";
import { apiSuccess, apiError } from "@/lib/api-response";
import { hasActiveBattle } from "@/lib/battle/pve-store";
import { equipCardSchema } from "@/lib/validations/cards";

export async function POST(request: NextRequest) {
  try {
    const { userId } = await verifySession(request);

    if (hasActiveBattle(userId)) {
      return apiError(
        "Nao e possivel alterar cristais durante uma batalha ativa",
        "BATTLE_IN_PROGRESS",
        409,
      );
    }

    const body: unknown = await request.json().catch(() => null);
    if (!body) {
      return apiError("Body da requisicao invalido", "INVALID_BODY", 400);
    }

    const parsed = equipCardSchema.safeParse(body);
    if (!parsed.success) {
      return apiError("Dados invalidos", "VALIDATION_ERROR", 422, parsed.error.flatten());
    }

    const { userCardId, slotIndex } = parsed.data;

    const userCard = await prisma.userCard.findUnique({
      where: { id: userCardId },
      select: { id: true, userId: true, equipped: true, slotIndex: true },
    });

    if (!userCard) {
      return apiError("Cristal nao encontrado", "USER_CARD_NOT_FOUND", 404);
    }

    if (userCard.userId !== userId) {
      return apiError("Este cristal nao pertence a voce", "NOT_YOUR_CARD", 403);
    }

    await prisma.$transaction(async (tx) => {
      // 1. Desequipar qualquer carta atualmente no slot
      await tx.userCard.updateMany({
        where: { userId, slotIndex },
        data: { equipped: false, slotIndex: null },
      });

      // 2. Desequipar a propria carta de seu slot anterior (caso re-equipe)
      if (userCard.equipped && userCard.slotIndex !== null && userCard.slotIndex !== slotIndex) {
        await tx.userCard.update({
          where: { id: userCardId },
          data: { equipped: false, slotIndex: null },
        });
      }

      // 3. Equipar no slot solicitado
      await tx.userCard.update({
        where: { id: userCardId },
        data: { equipped: true, slotIndex },
      });
    });

    return apiSuccess({ userCardId, slotIndex });
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return apiError(error.message, error.code, error.statusCode);
    }
    console.error("[POST /api/cards/equip]", error);
    return apiError("Erro interno do servidor", "INTERNAL_ERROR", 500);
  }
}
