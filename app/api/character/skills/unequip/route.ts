import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifySession, AuthenticationError } from "@/lib/auth/verify-session";
import { apiSuccess, apiError } from "@/lib/api-response";
import { hasActiveBattle } from "@/lib/battle/pve-store";
import { unequipSkillSchema } from "@/lib/validations/skill";

export async function PUT(request: NextRequest) {
  try {
    const { userId } = await verifySession(request);

    if (hasActiveBattle(userId)) {
      return apiError("Nao e possivel alterar loadout durante uma batalha ativa", "BATTLE_IN_PROGRESS", 409);
    }

    const body: unknown = await request.json();
    const parsed = unequipSkillSchema.safeParse(body);

    if (!parsed.success) {
      return apiError(
        "Dados invalidos",
        "VALIDATION_ERROR",
        422,
        parsed.error.flatten()
      );
    }

    const { slotIndex } = parsed.data;

    const character = await prisma.character.findUnique({
      where: { userId },
      select: { id: true },
    });

    if (!character) {
      return apiError("Personagem nao encontrado", "CHARACTER_NOT_FOUND", 404);
    }

    const characterSkill = await prisma.characterSkill.findUnique({
      where: {
        characterId_slotIndex: {
          characterId: character.id,
          slotIndex,
        },
      },
    });

    if (!characterSkill) {
      return apiError(
        "Nenhuma skill equipada neste slot",
        "SLOT_EMPTY",
        404
      );
    }

    const result = await prisma.$transaction(async (tx) => {
      return tx.characterSkill.update({
        where: { id: characterSkill.id },
        data: { equipped: false, slotIndex: null },
        include: { skill: true },
      });
    });

    return apiSuccess(result);
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return apiError(error.message, error.code, error.statusCode);
    }

    console.error("[PUT /api/character/skills/unequip]", error);
    return apiError("Erro interno do servidor", "INTERNAL_ERROR", 500);
  }
}
