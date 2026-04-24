import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiSuccess, apiError } from "@/lib/api-response";
import { z } from "zod";

const mobUpdateSchema = z.object({
  name: z.string().min(1).max(50),
  description: z.string().min(1).max(500),
  tier: z.number().int().min(1).max(5),
  aiProfile: z.enum(["AGGRESSIVE", "DEFENSIVE", "TACTICAL", "BALANCED"]),
  physicalAtk: z.number().int().min(1).max(9999),
  physicalDef: z.number().int().min(1).max(9999),
  magicAtk: z.number().int().min(1).max(9999),
  magicDef: z.number().int().min(1).max(9999),
  hp: z.number().int().min(1).max(9999),
  speed: z.number().int().min(1).max(9999),
});

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const mob = await prisma.mob.findUnique({
      where: { id },
      include: {
        skills: {
          include: { skill: true },
          orderBy: { slotIndex: "asc" },
        },
      },
    });
    if (!mob) return apiError("Mob nao encontrado", "NOT_FOUND", 404);
    return apiSuccess(mob);
  } catch (error) {
    console.error("[GET /api/admin/mobs/:id]", error);
    return apiError("Erro interno do servidor", "INTERNAL_ERROR", 500);
  }
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const existing = await prisma.mob.findUnique({ where: { id } });
    if (!existing) return apiError("Mob nao encontrado", "NOT_FOUND", 404);

    const body = await request.json();
    const parsed = mobUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return apiError("Dados invalidos", "VALIDATION_ERROR", 422, parsed.error.flatten());
    }

    const mob = await prisma.mob.update({ where: { id }, data: parsed.data });
    return apiSuccess(mob);
  } catch (error) {
    if (error instanceof Error && "code" in error && (error as { code: string }).code === "P2002") {
      return apiError("Ja existe um mob com este nome", "DUPLICATE_NAME", 409);
    }
    console.error("[PUT /api/admin/mobs/:id]", error);
    return apiError("Erro interno do servidor", "INTERNAL_ERROR", 500);
  }
}

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const existing = await prisma.mob.findUnique({ where: { id } });
    if (!existing) return apiError("Mob nao encontrado", "NOT_FOUND", 404);

    const pveBattles = await prisma.pveBattle.count({ where: { mobId: id } });

    await prisma.$transaction([
      prisma.pveBattle.deleteMany({ where: { mobId: id } }),
      prisma.mobSkill.deleteMany({ where: { mobId: id } }),
      prisma.mob.delete({ where: { id } }),
    ]);

    return apiSuccess({ deleted: true, warnings: { pveBattlesRemoved: pveBattles } });
  } catch (error) {
    console.error("[DELETE /api/admin/mobs/:id]", error);
    return apiError("Erro interno do servidor", "INTERNAL_ERROR", 500);
  }
}
