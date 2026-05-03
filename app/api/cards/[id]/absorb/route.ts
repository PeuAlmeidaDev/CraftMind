// app/api/cards/[id]/absorb/route.ts
//
// POST /api/cards/[id]/absorb
//   Body: { sourceUserCardIds: string[] }  // 1..50
//   `[id]` = userCardId do ALVO (recebe XP).
//
// Sacrifica cartas-fonte transferindo XP para o alvo. Cada source contribui
// `XP_PER_DUPLICATE_BY_RARITY[card.rarity]` (mesma tabela de duplicata legada).
// Sources sao deletados na mesma transacao.
//
// Validacoes:
//   - 401 sem auth
//   - 404 alvo inexistente
//   - 403 alvo de outro user
//   - 422 sourceUserCardIds vazio (Zod .min(1))
//   - 422 algum source === alvo
//   - 422 IDs duplicados no payload
//   - 422 algum source nao existe / nao pertence ao user
//   - 422 algum source.cardId !== alvo.cardId
//   - 422 algum source equipado (`equipped === true`)
//
// Resposta: AbsorbResponse (ver types/cards.ts).

import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifySession, AuthenticationError } from "@/lib/auth/verify-session";
import { apiSuccess, apiError } from "@/lib/api-response";
import { absorbSchema } from "@/lib/validations/cards";
import {
  XP_PER_DUPLICATE_BY_RARITY,
  getLevelFromXp,
} from "@/lib/cards/level";
import type { CardRarity, AbsorbResponse } from "@/types/cards";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { userId } = await verifySession(request);

    const { id: targetUserCardId } = await params;
    if (!targetUserCardId) {
      return apiError("ID do alvo e obrigatorio", "MISSING_ID", 400);
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return apiError("Body invalido", "INVALID_BODY", 422);
    }

    const parsed = absorbSchema.safeParse(body);
    if (!parsed.success) {
      return apiError(
        "Dados invalidos",
        "VALIDATION_ERROR",
        422,
        parsed.error.flatten(),
      );
    }
    const { sourceUserCardIds } = parsed.data;

    // Dedup defensivo (Zod nao garante unicidade) — evita contar XP em dobro.
    const uniqueSources = Array.from(new Set(sourceUserCardIds));
    if (uniqueSources.length !== sourceUserCardIds.length) {
      return apiError(
        "IDs de cartas-fonte duplicados no payload",
        "DUPLICATE_SOURCE_IDS",
        422,
      );
    }

    if (uniqueSources.includes(targetUserCardId)) {
      return apiError(
        "Carta alvo nao pode estar entre as fontes",
        "TARGET_IN_SOURCES",
        422,
      );
    }

    // Carrega alvo + Card.rarity (precisamos da raridade para calcular XP).
    const target = await prisma.userCard.findUnique({
      where: { id: targetUserCardId },
      select: {
        id: true,
        userId: true,
        cardId: true,
        xp: true,
        level: true,
        card: { select: { rarity: true } },
      },
    });

    if (!target) {
      return apiError("Carta alvo nao encontrada", "TARGET_NOT_FOUND", 404);
    }

    if (target.userId !== userId) {
      return apiError(
        "Esta carta nao pertence a voce",
        "FORBIDDEN",
        403,
      );
    }

    // Carrega todos os sources de uma vez. findMany filtra por userId — isso
    // ja garante ownership; checagem de count detecta IDs invalidos.
    const sources = await prisma.userCard.findMany({
      where: {
        id: { in: uniqueSources },
        userId,
      },
      select: {
        id: true,
        cardId: true,
        equipped: true,
        card: { select: { rarity: true } },
      },
    });

    if (sources.length !== uniqueSources.length) {
      return apiError(
        "Alguma carta fonte nao foi encontrada ou nao pertence a voce",
        "SOURCE_INVALID",
        422,
      );
    }

    for (const src of sources) {
      if (src.cardId !== target.cardId) {
        return apiError(
          "So eh possivel sacrificar copias do mesmo cristal",
          "SOURCE_DIFFERENT_CARD",
          422,
        );
      }
      if (src.equipped) {
        return apiError(
          "Desequipe a carta antes de sacrificar",
          "SOURCE_EQUIPPED",
          422,
        );
      }
    }

    // Calcula XP total — sources tem o mesmo cardId que o alvo (validado
    // acima), mas somamos por source para refletir paridade com o fluxo
    // legado de duplicata vira XP (1 XP_PER_DUPLICATE por source).
    let totalXp = 0;
    for (const src of sources) {
      const rarity = src.card.rarity as CardRarity;
      totalXp += XP_PER_DUPLICATE_BY_RARITY[rarity] ?? 0;
    }

    const safeCurrentXp =
      Number.isFinite(target.xp) && target.xp >= 0
        ? Math.floor(target.xp)
        : 0;
    const newXp = safeCurrentXp + totalXp;
    const newLevel = getLevelFromXp(newXp);
    const safePrevLevel = Math.max(1, Math.floor(target.level || 1));
    const leveledUp = newLevel > safePrevLevel;

    // Transacao: update do alvo + deleteMany dos sources.
    await prisma.$transaction(async (tx) => {
      await tx.userCard.update({
        where: { id: target.id },
        data: {
          xp: newXp,
          level: newLevel,
        },
      });
      await tx.userCard.deleteMany({
        where: {
          id: { in: uniqueSources },
          userId,
        },
      });
    });

    const payload: AbsorbResponse = {
      targetUserCardId: target.id,
      xpGained: totalXp,
      newXp,
      newLevel,
      leveledUp,
      sacrificed: sources.length,
    };

    return apiSuccess(payload);
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return apiError(error.message, error.code, error.statusCode);
    }
    console.error("[POST /api/cards/[id]/absorb]", error);
    return apiError("Erro interno do servidor", "INTERNAL_ERROR", 500);
  }
}
