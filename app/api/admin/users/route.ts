import { prisma } from "@/lib/prisma";
import { apiSuccess, apiError } from "@/lib/api-response";

export async function GET() {
  try {
    const users = await prisma.user.findMany({
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        email: true,
        avatarUrl: true,
        house: { select: { name: true } },
        character: {
          select: {
            id: true,
            level: true,
            characterSkills: {
              select: {
                id: true,
                skillId: true,
                equipped: true,
                slotIndex: true,
                skill: {
                  select: { id: true, name: true, tier: true, damageType: true },
                },
              },
              orderBy: { skill: { name: "asc" } },
            },
          },
        },
      },
    });

    return apiSuccess(users);
  } catch (error) {
    console.error("[GET /api/admin/users]", error);
    return apiError("Erro interno do servidor", "INTERNAL_ERROR", 500);
  }
}
