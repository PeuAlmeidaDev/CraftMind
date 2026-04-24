import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiSuccess, apiError } from "@/lib/api-response";
import { z } from "zod";

const skillUpdateSchema = z.object({
  name: z.string().min(1).max(50),
  description: z.string().min(1).max(500),
  tier: z.number().int().min(1).max(3),
  cooldown: z.number().int().min(0).max(5),
  target: z.enum(["SELF", "SINGLE_ALLY", "ALL_ALLIES", "SINGLE_ENEMY", "ALL_ENEMIES", "ALL"]),
  damageType: z.enum(["PHYSICAL", "MAGICAL", "NONE"]),
  basePower: z.number().int().min(0).max(9999),
  hits: z.number().int().min(1).max(5),
  accuracy: z.number().int().min(1).max(100),
  effects: z.unknown(),
  mastery: z.unknown(),
});

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const skill = await prisma.skill.findUnique({ where: { id } });
    if (!skill) return apiError("Skill nao encontrada", "NOT_FOUND", 404);
    return apiSuccess(skill);
  } catch (error) {
    console.error("[GET /api/admin/skills/:id]", error);
    return apiError("Erro interno do servidor", "INTERNAL_ERROR", 500);
  }
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const existing = await prisma.skill.findUnique({ where: { id } });
    if (!existing) return apiError("Skill nao encontrada", "NOT_FOUND", 404);

    const body = await request.json();
    const parsed = skillUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return apiError("Dados invalidos", "VALIDATION_ERROR", 422, parsed.error.flatten());
    }

    const skill = await prisma.skill.update({
      where: { id },
      data: {
        name: parsed.data.name,
        description: parsed.data.description,
        tier: parsed.data.tier,
        cooldown: parsed.data.cooldown,
        target: parsed.data.target,
        damageType: parsed.data.damageType,
        basePower: parsed.data.basePower,
        hits: parsed.data.hits,
        accuracy: parsed.data.accuracy,
        effects: parsed.data.effects as object,
        mastery: parsed.data.mastery as object,
      },
    });

    return apiSuccess(skill);
  } catch (error) {
    if (error instanceof Error && "code" in error && (error as { code: string }).code === "P2002") {
      return apiError("Ja existe uma skill com este nome", "DUPLICATE_NAME", 409);
    }
    console.error("[PUT /api/admin/skills/:id]", error);
    return apiError("Erro interno do servidor", "INTERNAL_ERROR", 500);
  }
}

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const existing = await prisma.skill.findUnique({ where: { id } });
    if (!existing) return apiError("Skill nao encontrada", "NOT_FOUND", 404);

    const [characterSkills, mobSkills, bossSkills] = await Promise.all([
      prisma.characterSkill.count({ where: { skillId: id } }),
      prisma.mobSkill.count({ where: { skillId: id } }),
      prisma.bossSkill.count({ where: { skillId: id } }),
    ]);

    await prisma.$transaction([
      prisma.mobSkill.deleteMany({ where: { skillId: id } }),
      prisma.bossSkill.deleteMany({ where: { skillId: id } }),
      prisma.characterSkill.deleteMany({ where: { skillId: id } }),
      prisma.skill.delete({ where: { id } }),
    ]);

    return apiSuccess({
      deleted: true,
      warnings: { characterSkills, mobSkills, bossSkills },
    });
  } catch (error) {
    console.error("[DELETE /api/admin/skills/:id]", error);
    return apiError("Erro interno do servidor", "INTERNAL_ERROR", 500);
  }
}
