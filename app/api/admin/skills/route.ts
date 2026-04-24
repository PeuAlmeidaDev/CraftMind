import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiSuccess, apiError } from "@/lib/api-response";
import { z } from "zod";

const skillSchema = z.object({
  name: z.string().min(1).max(50),
  description: z.string().min(1).max(500),
  tier: z.number().int().min(1).max(3),
  cooldown: z.number().int().min(0).max(5).default(0),
  target: z.enum(["SELF", "SINGLE_ALLY", "ALL_ALLIES", "SINGLE_ENEMY", "ALL_ENEMIES", "ALL"]),
  damageType: z.enum(["PHYSICAL", "MAGICAL", "NONE"]),
  basePower: z.number().int().min(0).max(9999),
  hits: z.number().int().min(1).max(5).default(1),
  accuracy: z.number().int().min(1).max(100).default(100),
  effects: z.unknown().default([]),
  mastery: z.unknown().default({}),
});

export async function GET() {
  try {
    const skills = await prisma.skill.findMany({
      orderBy: [{ tier: "asc" }, { name: "asc" }],
    });
    return apiSuccess(skills);
  } catch (error) {
    console.error("[GET /api/admin/skills]", error);
    return apiError("Erro interno do servidor", "INTERNAL_ERROR", 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = skillSchema.safeParse(body);

    if (!parsed.success) {
      return apiError("Dados invalidos", "VALIDATION_ERROR", 422, parsed.error.flatten());
    }

    const skill = await prisma.skill.create({
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

    return apiSuccess(skill, 201);
  } catch (error) {
    if (error instanceof Error && "code" in error && (error as { code: string }).code === "P2002") {
      return apiError("Ja existe uma skill com este nome", "DUPLICATE_NAME", 409);
    }
    console.error("[POST /api/admin/skills]", error);
    return apiError("Erro interno do servidor", "INTERNAL_ERROR", 500);
  }
}
