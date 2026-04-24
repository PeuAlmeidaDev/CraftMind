import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiSuccess, apiError } from "@/lib/api-response";
import { z } from "zod";

const mobSkillsSchema = z.object({
  skills: z.array(
    z.object({
      skillId: z.string().min(1),
      slotIndex: z.number().int().min(0).max(3),
    })
  ).max(4),
});

type RouteParams = { params: Promise<{ id: string }> };

export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const mob = await prisma.mob.findUnique({ where: { id } });
    if (!mob) return apiError("Mob nao encontrado", "NOT_FOUND", 404);

    const body = await request.json();
    const parsed = mobSkillsSchema.safeParse(body);
    if (!parsed.success) {
      return apiError("Dados invalidos", "VALIDATION_ERROR", 422, parsed.error.flatten());
    }

    const slots = parsed.data.skills.map((s) => s.slotIndex);
    if (new Set(slots).size !== slots.length) {
      return apiError("Slots duplicados", "DUPLICATE_SLOTS", 422);
    }

    const skillIds = parsed.data.skills.map((s) => s.skillId);
    if (skillIds.length > 0) {
      const existingSkills = await prisma.skill.findMany({
        where: { id: { in: skillIds } },
        select: { id: true },
      });
      if (existingSkills.length !== skillIds.length) {
        return apiError("Uma ou mais skills nao encontradas", "SKILL_NOT_FOUND", 422);
      }
    }

    await prisma.$transaction([
      prisma.mobSkill.deleteMany({ where: { mobId: id } }),
      ...parsed.data.skills.map((s) =>
        prisma.mobSkill.create({
          data: { mobId: id, skillId: s.skillId, slotIndex: s.slotIndex },
        })
      ),
    ]);

    const updated = await prisma.mob.findUnique({
      where: { id },
      include: {
        skills: {
          include: { skill: true },
          orderBy: { slotIndex: "asc" },
        },
      },
    });

    return apiSuccess(updated);
  } catch (error) {
    console.error("[PUT /api/admin/mobs/:id/skills]", error);
    return apiError("Erro interno do servidor", "INTERNAL_ERROR", 500);
  }
}
