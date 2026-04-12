import { prisma } from "@/lib/prisma";
import { apiSuccess, apiError } from "@/lib/api-response";

export async function GET() {
  try {
    const habits = await prisma.habit.findMany({
      select: {
        id: true,
        name: true,
        description: true,
        category: true,
      },
      orderBy: { category: "asc" },
    });

    return apiSuccess(habits);
  } catch (error) {
    console.error("[GET /api/habits]", error);

    return apiError("Erro interno do servidor", "INTERNAL_ERROR", 500);
  }
}
