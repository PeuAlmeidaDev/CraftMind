import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifySession, AuthenticationError } from "@/lib/auth/verify-session";
import { apiSuccess, apiError } from "@/lib/api-response";
import { hasActiveBattle } from "@/lib/battle/pve-store";
import { equipSkillSchema } from "@/lib/validations/skill";

export async function PUT(request: NextRequest) {
  try {
    const { userId } = await verifySession(request);

    if (hasActiveBattle(userId)) {
      return apiError("Nao e possivel alterar loadout durante uma batalha ativa", "BATTLE_IN_PROGRESS", 409);
    }

    const body: unknown = await request.json();
    const parsed = equipSkillSchema.safeParse(body);

    if (!parsed.success) {
      return apiError(
        "Dados invalidos",
        "VALIDATION_ERROR",
        422,
        parsed.error.flatten()
      );
    }

    const { skillId, slotIndex } = parsed.data;

    const character = await prisma.character.findUnique({
      where: { userId },
      select: { id: true },
    });

    if (!character) {
      return apiError("Personagem nao encontrado", "CHARACTER_NOT_FOUND", 404);
    }

    const characterSkill = await prisma.characterSkill.findUnique({
      where: {
        characterId_skillId: {
          characterId: character.id,
          skillId,
        },
      },
    });

    if (!characterSkill) {
      return apiError("Skill nao desbloqueada", "SKILL_NOT_FOUND", 404);
    }

    const result = await prisma.$transaction(async (tx) => {
      const skillInTargetSlot = await tx.characterSkill.findUnique({
        where: {
          characterId_slotIndex: {
            characterId: character.id,
            slotIndex,
          },
        },
      });

      const isAlreadyEquipped = characterSkill.equipped;
      const targetSlotOccupied = skillInTargetSlot !== null;

      if (!isAlreadyEquipped && !targetSlotOccupied) {
        // Cenario 1: Equip simples — skill nao equipada + slot vazio
        return tx.characterSkill.update({
          where: { id: characterSkill.id },
          data: { equipped: true, slotIndex },
          include: { skill: true },
        });
      }

      if (!isAlreadyEquipped && targetSlotOccupied) {
        // Cenario 2: Swap — skill nao equipada + slot ocupado por outra
        await tx.characterSkill.update({
          where: { id: skillInTargetSlot.id },
          data: { equipped: false, slotIndex: null },
        });

        return tx.characterSkill.update({
          where: { id: characterSkill.id },
          data: { equipped: true, slotIndex },
          include: { skill: true },
        });
      }

      if (isAlreadyEquipped && !targetSlotOccupied) {
        // Cenario 3: Move — skill ja equipada em outro slot + slot destino vazio
        return tx.characterSkill.update({
          where: { id: characterSkill.id },
          data: { slotIndex },
          include: { skill: true },
        });
      }

      // Cenario 4: Move + Swap — skill equipada em slot A + slot B ocupado por outra
      // Skill do slot B vai para slot A, skill original vai para slot B
      const originalSlot = characterSkill.slotIndex;

      // Primeiro, liberar o slot da skill original para evitar conflito de unique constraint
      await tx.characterSkill.update({
        where: { id: characterSkill.id },
        data: { slotIndex: null },
      });

      // Mover a skill do slot destino para o slot original
      await tx.characterSkill.update({
        where: { id: skillInTargetSlot.id },
        data: { slotIndex: originalSlot },
      });

      // Mover a skill original para o slot destino
      return tx.characterSkill.update({
        where: { id: characterSkill.id },
        data: { slotIndex },
        include: { skill: true },
      });
    });

    return apiSuccess(result);
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return apiError(error.message, error.code, error.statusCode);
    }

    console.error("[PUT /api/character/skills/equip]", error);
    return apiError("Erro interno do servidor", "INTERNAL_ERROR", 500);
  }
}
