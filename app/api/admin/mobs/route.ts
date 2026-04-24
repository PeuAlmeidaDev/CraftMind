import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiSuccess, apiError } from "@/lib/api-response";
import { z } from "zod";

const mobSchema = z.object({
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

export async function GET() {
  try {
    const mobs = await prisma.mob.findMany({
      orderBy: [{ tier: "asc" }, { name: "asc" }],
      include: {
        skills: {
          include: { skill: true },
          orderBy: { slotIndex: "asc" },
        },
      },
    });
    return apiSuccess(mobs);
  } catch (error) {
    console.error("[GET /api/admin/mobs]", error);
    return apiError("Erro interno do servidor", "INTERNAL_ERROR", 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = mobSchema.safeParse(body);
    if (!parsed.success) {
      return apiError("Dados invalidos", "VALIDATION_ERROR", 422, parsed.error.flatten());
    }

    const d = parsed.data;
    const mob = await prisma.mob.create({
      data: {
        name: d.name,
        description: d.description,
        tier: d.tier,
        aiProfile: d.aiProfile,
        physicalAtk: d.physicalAtk,
        physicalDef: d.physicalDef,
        magicAtk: d.magicAtk,
        magicDef: d.magicDef,
        hp: d.hp,
        speed: d.speed,
      },
    });
    return apiSuccess(mob, 201);
  } catch (error) {
    if (error instanceof Error && "code" in error && (error as { code: string }).code === "P2002") {
      return apiError("Ja existe um mob com este nome", "DUPLICATE_NAME", 409);
    }
    console.error("[POST /api/admin/mobs]", error);
    return apiError("Erro interno do servidor", "INTERNAL_ERROR", 500);
  }
}
