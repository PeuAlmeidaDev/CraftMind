// app/api/cards/unequip/route.ts — POST desequipa o cristal de um slot 0/1/2.
//
// Body: { slotIndex: 0 | 1 | 2 }
// - Sem-op silenciosa se o slot ja esta vazio (retorna 200 mesmo assim).

import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifySession, AuthenticationError } from "@/lib/auth/verify-session";
import { apiSuccess, apiError } from "@/lib/api-response";
import { hasActiveBattle } from "@/lib/battle/pve-store";
import { unequipCardSchema } from "@/lib/validations/cards";

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

    const parsed = unequipCardSchema.safeParse(body);
    if (!parsed.success) {
      return apiError("Dados invalidos", "VALIDATION_ERROR", 422, parsed.error.flatten());
    }

    const { slotIndex } = parsed.data;

    const result = await prisma.userCard.updateMany({
      where: { userId, slotIndex },
      data: { equipped: false, slotIndex: null },
    });

    return apiSuccess({ slotIndex, removed: result.count });
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return apiError(error.message, error.code, error.statusCode);
    }
    console.error("[POST /api/cards/unequip]", error);
    return apiError("Erro interno do servidor", "INTERNAL_ERROR", 500);
  }
}
