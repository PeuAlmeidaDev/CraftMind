import { prisma } from "@/lib/prisma";
import { verifySession, AuthenticationError } from "@/lib/auth/verify-session";
import { apiSuccess, apiError } from "@/lib/api-response";
import { generateDailyTasks } from "@/lib/tasks/generate-daily";
import { getTodayDateBRT } from "@/lib/helpers/date-utils";

export async function POST(request: Request) {
  try {
    const { userId } = await verifySession(request);

    const today = getTodayDateBRT();

    // Check + geracao em transacao para evitar race condition
    const alreadyExists = await prisma.$transaction(async (tx) => {
      const existingCount = await tx.dailyTask.count({
        where: {
          userId,
          dueDate: today,
        },
      });

      if (existingCount > 0) {
        return true;
      }

      await generateDailyTasks(userId, tx);
      return false;
    });

    if (alreadyExists) {
      return apiError(
        "Tarefas do dia ja foram geradas",
        "TASKS_ALREADY_GENERATED",
        409
      );
    }

    // Buscar tarefas recem-criadas para retornar ao cliente
    const tasks = await prisma.dailyTask.findMany({
      where: {
        userId,
        dueDate: today,
      },
      include: {
        habit: {
          select: {
            name: true,
            category: true,
          },
        },
      },
      orderBy: [{ completed: "asc" }, { createdAt: "asc" }],
    });

    // Formatar tarefas
    const formattedTasks = tasks.map((task) => ({
      id: task.id,
      description: task.description,
      habitName: task.habit.name,
      habitCategory: task.habit.category,
      attributeGrants: task.attributeGrants,
      completed: task.completed,
      completedAt: task.completedAt,
    }));

    // Calcular resumo
    const total = formattedTasks.length;
    const completed = formattedTasks.filter((t) => t.completed).length;
    const pending = total - completed;
    const completionRate =
      total > 0 ? Math.round((completed / total) * 100) : 0;

    return apiSuccess(
      {
        tasks: formattedTasks,
        summary: { total, completed, pending, completionRate },
      },
      201
    );
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return apiError(error.message, error.code, error.statusCode);
    }

    console.error("[POST /api/tasks/generate]", error);
    return apiError("Erro interno do servidor", "INTERNAL_ERROR", 500);
  }
}
