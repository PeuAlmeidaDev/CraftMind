import { prisma } from "@/lib/prisma";
import {
  verifySession,
  AuthenticationError,
} from "@/lib/auth/verify-session";
import { apiSuccess, apiError } from "@/lib/api-response";
import { rateLimit } from "@/lib/rate-limit";
import { getTodayDateBRT } from "@/lib/helpers/date-utils";
import { getDominantCategory } from "@/lib/helpers/dominant-category";
import { DAILY_TASK_LIMIT } from "@/lib/tasks/generate-daily";
import type { HabitCategory } from "@prisma/client";

export async function GET(request: Request) {
  try {
    const { userId } = await verifySession(request);

    const rl = await rateLimit(userId, { maxRequests: 10, window: "60 s" });
    if (!rl.success) {
      return apiError("Muitas requisicoes, aguarde", "RATE_LIMITED", 429);
    }

    const today = getTodayDateBRT();

    // Buscar tarefas do dia com categoria do habito
    const tasks = await prisma.dailyTask.findMany({
      where: {
        userId,
        dueDate: today,
      },
      include: {
        habit: {
          select: { category: true },
        },
      },
    });

    // Contar tarefas completas
    const completedTasks = tasks.filter((t) => t.completed);
    const completedCount = completedTasks.length;
    const totalCount = DAILY_TASK_LIMIT;

    // Se nao completou todas as tarefas, nao e elegivel
    if (completedCount < totalCount) {
      return apiSuccess({
        eligible: false as const,
        reason: "incomplete_tasks" as const,
        completedCount,
        totalCount,
      });
    }

    // Extrair categorias das tarefas completas
    const categories: HabitCategory[] = completedTasks.map(
      (t) => t.habit.category
    );

    const dominantCategory = getDominantCategory(categories);

    // Montar breakdown de categorias (apenas com count > 0)
    const categoryBreakdown: Partial<Record<HabitCategory, number>> = {};
    for (const category of categories) {
      categoryBreakdown[category] =
        (categoryBreakdown[category] ?? 0) + 1;
    }

    // Verificar se ja participou de boss fight cooperativo hoje
    const alreadyParticipated =
      await prisma.coopBattleParticipant.findFirst({
        where: {
          userId,
          coopBattle: { date: today },
        },
      });

    if (alreadyParticipated) {
      return apiSuccess({
        eligible: false as const,
        reason: "already_participated" as const,
      });
    }

    // Jogador e elegivel
    return apiSuccess({
      eligible: true as const,
      dominantCategory,
      categoryBreakdown,
    });
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return apiError(error.message, error.code, error.statusCode);
    }

    console.error("[GET /api/battle/coop/eligible]", error);
    return apiError("Erro interno do servidor", "INTERNAL_ERROR", 500);
  }
}
