import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifySession, AuthenticationError } from "@/lib/auth/verify-session";
import { apiSuccess, apiError } from "@/lib/api-response";
import { distributePointsSchema } from "@/lib/validations/battle";
import { distributePoints } from "@/lib/exp/level-up";
import { hasActiveBattle } from "@/lib/battle/pve-store";

export async function POST(request: NextRequest) {
  try {
    const { userId } = await verifySession(request);

    if (hasActiveBattle(userId)) {
      return apiError(
        "Nao e possivel distribuir pontos durante uma batalha ativa",
        "BATTLE_IN_PROGRESS",
        409
      );
    }

    const body: unknown = await request.json().catch(() => null);

    if (!body) {
      return apiError("Body da requisicao invalido", "INVALID_BODY", 400);
    }

    const parsed = distributePointsSchema.safeParse(body);

    if (!parsed.success) {
      return apiError(
        "Dados invalidos",
        "VALIDATION_ERROR",
        422,
        parsed.error.flatten()
      );
    }

    const txResult = await prisma.$transaction(async (tx) => {
      const character = await tx.character.findUnique({
        where: { userId },
        select: { id: true, freePoints: true },
      });

      if (!character) {
        return { error: "NOT_FOUND" as const };
      }

      const result = distributePoints({
        freePoints: character.freePoints,
        distribution: parsed.data.distribution,
      });

      if (!result.valid) {
        return { error: "INVALID" as const, message: result.error };
      }

      const totalSpent = Object.values(parsed.data.distribution).reduce(
        (sum, v) => sum + v,
        0
      );

      const data: Record<string, { increment: number } | { decrement: number }> = {
        freePoints: { decrement: totalSpent },
      };

      for (const [stat, value] of Object.entries(result.statChanges)) {
        data[stat] = { increment: value };
      }

      const updatedCharacter = await tx.character.update({
        where: { id: character.id },
        data,
        select: {
          id: true,
          physicalAtk: true,
          physicalDef: true,
          magicAtk: true,
          magicDef: true,
          hp: true,
          speed: true,
          level: true,
          currentExp: true,
          freePoints: true,
        },
      });

      return { ok: true as const, data: updatedCharacter };
    });

    if ("error" in txResult) {
      if (txResult.error === "NOT_FOUND") {
        return apiError("Personagem nao encontrado", "CHARACTER_NOT_FOUND", 404);
      }
      return apiError(
        txResult.message ?? "Distribuicao invalida",
        "INVALID_DISTRIBUTION",
        400
      );
    }

    return apiSuccess(txResult.data);
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return apiError(error.message, error.code, error.statusCode);
    }

    console.error("[POST /api/character/distribute-points]", error);
    return apiError("Erro interno do servidor", "INTERNAL_ERROR", 500);
  }
}
