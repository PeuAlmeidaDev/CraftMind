import { prisma } from "@/lib/prisma";
import { apiSuccess, apiError } from "@/lib/api-response";

export async function GET() {
  try {
    const skills = await prisma.skill.findMany({
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
      orderBy: [{ tier: "asc" }, { name: "asc" }],
    });

    return apiSuccess(skills);
  } catch (error) {
    console.error("[GET /api/skills]", error);
    return apiError("Erro interno do servidor", "INTERNAL_ERROR", 500);
  }
}
