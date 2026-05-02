import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifySession, AuthenticationError } from "@/lib/auth/verify-session";
import { apiSuccess, apiError } from "@/lib/api-response";
import { loadEquippedCardsAndApply } from "@/lib/cards/load-equipped";
import type { BaseStats } from "@/lib/battle/types";
import type { BonusStats } from "@/types/character";

export async function GET(request: NextRequest) {
  try {
    const { userId } = await verifySession(request);

    const character = await prisma.character.findUnique({
      where: { userId },
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
        characterSkills: {
          where: { equipped: true },
          orderBy: { slotIndex: "asc" },
          select: {
            slotIndex: true,
            equipped: true,
            skill: {
              select: {
                id: true,
                name: true,
                description: true,
                tier: true,
                cooldown: true,
                target: true,
                damageType: true,
                basePower: true,
                hits: true,
                accuracy: true,
                effects: true,
                mastery: true,
              },
            },
          },
        },
      },
    });

    if (!character) {
      return apiError("Personagem nao encontrado", "CHARACTER_NOT_FOUND", 404);
    }

    const { characterSkills, ...characterAttributes } = character;

    const baseStats: BaseStats = {
      physicalAtk: characterAttributes.physicalAtk,
      physicalDef: characterAttributes.physicalDef,
      magicAtk: characterAttributes.magicAtk,
      magicDef: characterAttributes.magicDef,
      hp: characterAttributes.hp,
      speed: characterAttributes.speed,
    };

    const equipped = await loadEquippedCardsAndApply(prisma, userId, baseStats);
    const effective = equipped.baseStats;

    const bonusStats: BonusStats = {
      physicalAtk: effective.physicalAtk - baseStats.physicalAtk,
      physicalDef: effective.physicalDef - baseStats.physicalDef,
      magicAtk: effective.magicAtk - baseStats.magicAtk,
      magicDef: effective.magicDef - baseStats.magicDef,
      hp: effective.hp - baseStats.hp,
      speed: effective.speed - baseStats.speed,
    };

    return apiSuccess({
      character: { ...characterAttributes, bonusStats },
      skills: characterSkills,
    });
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return apiError(error.message, error.code, error.statusCode);
    }

    console.error("[GET /api/character]", error);
    return apiError("Erro interno do servidor", "INTERNAL_ERROR", 500);
  }
}
