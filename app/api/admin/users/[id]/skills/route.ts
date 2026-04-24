import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiSuccess, apiError } from "@/lib/api-response";
import { z } from "zod";

type RouteParams = { params: Promise<{ id: string }> };

// POST — add skill to user's character
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id: userId } = await params;
    const character = await prisma.character.findUnique({ where: { userId } });
    if (!character) return apiError("Personagem nao encontrado", "NOT_FOUND", 404);

    const body = await request.json();
    const parsed = z.object({ skillId: z.string().min(1) }).safeParse(body);
    if (!parsed.success) {
      return apiError("Dados invalidos", "VALIDATION_ERROR", 422);
    }

    const skill = await prisma.skill.findUnique({ where: { id: parsed.data.skillId } });
    if (!skill) return apiError("Skill nao encontrada", "SKILL_NOT_FOUND", 404);

    // Check if already has this skill
    const existing = await prisma.characterSkill.findUnique({
      where: { characterId_skillId: { characterId: character.id, skillId: skill.id } },
    });
    if (existing) {
      return apiError("Usuario ja possui esta skill", "ALREADY_HAS_SKILL", 409);
    }

    await prisma.characterSkill.create({
      data: {
        characterId: character.id,
        skillId: skill.id,
        equipped: false,
      },
    });

    return apiSuccess({ added: true, skillName: skill.name });
  } catch (error) {
    console.error("[POST /api/admin/users/:id/skills]", error);
    return apiError("Erro interno do servidor", "INTERNAL_ERROR", 500);
  }
}

// DELETE — remove skill from user's character
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id: userId } = await params;
    const character = await prisma.character.findUnique({ where: { userId } });
    if (!character) return apiError("Personagem nao encontrado", "NOT_FOUND", 404);

    const url = new URL(request.url);
    const skillId = url.searchParams.get("skillId");
    if (!skillId) return apiError("skillId obrigatorio", "VALIDATION_ERROR", 422);

    const charSkill = await prisma.characterSkill.findUnique({
      where: { characterId_skillId: { characterId: character.id, skillId } },
    });
    if (!charSkill) {
      return apiError("Usuario nao possui esta skill", "NOT_FOUND", 404);
    }

    await prisma.characterSkill.delete({ where: { id: charSkill.id } });

    return apiSuccess({ removed: true });
  } catch (error) {
    console.error("[DELETE /api/admin/users/:id/skills]", error);
    return apiError("Erro interno do servidor", "INTERNAL_ERROR", 500);
  }
}
