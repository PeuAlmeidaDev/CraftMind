// app/api/cards/pending-duplicates/[id]/resolve/route.ts
//
// POST /api/cards/pending-duplicates/[id]/resolve
//   Body: { decision: "REPLACE" | "CONVERT" }
//
// Resolve uma pendencia de drop de duplicata com purity maior:
//   - REPLACE: zera xp/level da UserCard atual e adota a newPurity da pendencia.
//   - CONVERT: aplica `applyXpGain` na UserCard atual (mantem purity atual).
// Em ambos os casos a pendencia e apagada apos a resolucao (atomico via $transaction).
//
// Edge cases tratados:
//   - 401: nao autenticado
//   - 400: id ausente
//   - 404: pendencia inexistente
//   - 403: pendencia pertence a outro usuario
//   - 410: UserCard alvo foi deletada entre criacao e resolve (cleanup silencioso
//          da pendencia orfa via cascade do schema, mas tratamos explicitamente)
//   - 422: payload invalido (decision diferente de REPLACE/CONVERT)

import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifySession, AuthenticationError } from "@/lib/auth/verify-session";
import { apiSuccess, apiError } from "@/lib/api-response";
import { resolveDuplicateSchema } from "@/lib/validations/cards";
import { applyXpGain } from "@/lib/cards/level";
import type { CardRarity } from "@/types/cards";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { userId } = await verifySession(request);

    const { id: pendingId } = await params;
    if (!pendingId) {
      return apiError("ID da pendencia e obrigatorio", "MISSING_ID", 400);
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return apiError("Body invalido", "INVALID_BODY", 422);
    }

    const parsed = resolveDuplicateSchema.safeParse(body);
    if (!parsed.success) {
      return apiError(
        "Dados invalidos",
        "VALIDATION_ERROR",
        422,
        parsed.error.flatten(),
      );
    }
    const { decision } = parsed.data;

    // Buscar pendencia + userCard + card.rarity (necessario para CONVERT).
    const pending = await prisma.pendingCardDuplicate.findUnique({
      where: { id: pendingId },
      include: {
        userCard: {
          include: {
            card: { select: { id: true, rarity: true } },
          },
        },
      },
    });

    if (!pending) {
      return apiError("Pendencia nao encontrada", "NOT_FOUND", 404);
    }

    if (pending.userId !== userId) {
      return apiError(
        "Esta pendencia nao pertence a voce",
        "FORBIDDEN",
        403,
      );
    }

    // Edge case: UserCard removida entre criacao da pendencia e resolve.
    // Schema Cascade ja teria removido a pendencia, mas se houver alguma
    // race podemos cair aqui. Limpamos a pendencia orfa silenciosamente e
    // retornamos 410 Gone.
    if (!pending.userCard) {
      await prisma.pendingCardDuplicate
        .delete({ where: { id: pendingId } })
        .catch(() => {
          // ja apagado por cascade — ignorar
        });
      return apiError(
        "Cristal alvo nao existe mais",
        "USER_CARD_GONE",
        410,
      );
    }

    if (decision === "REPLACE") {
      // Substituir: zera xp/level e adota a newPurity da pendencia.
      const result = await prisma.$transaction(async (tx) => {
        const updatedCard = await tx.userCard.update({
          where: { id: pending.userCardId },
          data: {
            xp: 0,
            level: 1,
            purity: pending.newPurity,
          },
          select: { id: true, xp: true, level: true, purity: true },
        });
        await tx.pendingCardDuplicate.delete({ where: { id: pendingId } });
        return updatedCard;
      });

      return apiSuccess({
        decision: "REPLACE" as const,
        userCard: result,
      });
    }

    // CONVERT: aplica XP normal via applyXpGain (mantem purity atual).
    const xpResult = applyXpGain(
      pending.userCard.xp,
      pending.userCard.level,
      pending.userCard.card.rarity as CardRarity,
    );

    const result = await prisma.$transaction(async (tx) => {
      const updatedCard = await tx.userCard.update({
        where: { id: pending.userCardId },
        data: {
          xp: xpResult.newXp,
          level: xpResult.newLevel,
        },
        select: { id: true, xp: true, level: true, purity: true },
      });
      await tx.pendingCardDuplicate.delete({ where: { id: pendingId } });
      return updatedCard;
    });

    return apiSuccess({
      decision: "CONVERT" as const,
      userCard: result,
      xpGained: xpResult.xpGained,
      leveledUp: xpResult.leveledUp,
      newLevel: xpResult.newLevel,
    });
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return apiError(error.message, error.code, error.statusCode);
    }
    console.error("[POST /api/cards/pending-duplicates/[id]/resolve]", error);
    return apiError("Erro interno do servidor", "INTERNAL_ERROR", 500);
  }
}
