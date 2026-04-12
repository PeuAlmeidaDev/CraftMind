import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifySession, AuthenticationError } from "@/lib/auth/verify-session";
import { apiSuccess, apiError } from "@/lib/api-response";

export async function GET(request: NextRequest) {
  try {
    const { userId } = await verifySession(request);

    const character = await prisma.character.findUnique({
      where: { userId },
      select: { id: true },
    });

    if (!character) {
      return apiError("Personagem nao encontrado", "CHARACTER_NOT_FOUND", 404);
    }

    const characterSkills = await prisma.characterSkill.findMany({
      where: { characterId: character.id },
      include: {
        skill: true,
      },
    });

    const equipped = characterSkills
      .filter((cs) => cs.equipped)
      .sort((a, b) => (a.slotIndex ?? 0) - (b.slotIndex ?? 0));

    const unequipped = characterSkills
      .filter((cs) => !cs.equipped)
      .sort((a, b) => a.skill.name.localeCompare(b.skill.name));

    return apiSuccess({ equipped, unequipped });
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return apiError(error.message, error.code, error.statusCode);
    }

    console.error("[GET /api/character/skills]", error);
    return apiError("Erro interno do servidor", "INTERNAL_ERROR", 500);
  }
}
