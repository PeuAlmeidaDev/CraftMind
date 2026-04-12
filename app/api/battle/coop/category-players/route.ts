import { NextRequest } from "next/server";
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

const VALID_CATEGORIES: HabitCategory[] = [
  "PHYSICAL",
  "INTELLECTUAL",
  "MENTAL",
  "SOCIAL",
  "SPIRITUAL",
];

const MAX_RESULTS = 20;

export async function GET(request: NextRequest) {
  try {
    const { userId } = await verifySession(request);

    const rl = await rateLimit(userId, { maxRequests: 10, window: "60 s" });
    if (!rl.success) {
      return apiError("Muitas requisicoes, aguarde", "RATE_LIMITED", 429);
    }

    // Validar query param category
    const categoryParam = request.nextUrl.searchParams.get("category");
    if (!categoryParam) {
      return apiError(
        "Parametro 'category' e obrigatorio",
        "MISSING_PARAM",
        400
      );
    }

    if (!VALID_CATEGORIES.includes(categoryParam as HabitCategory)) {
      return apiError(
        "Categoria invalida. Valores aceitos: PHYSICAL, INTELLECTUAL, MENTAL, SOCIAL, SPIRITUAL",
        "INVALID_PARAM",
        400
      );
    }

    const category = categoryParam as HabitCategory;
    const today = getTodayDateBRT();

    // Buscar usuarios (exceto o solicitante) que possuem tarefas hoje.
    // A filtragem exata (todas completas, count == DAILY_TASK_LIMIT,
    // categoria dominante) e feita em aplicacao apos a query.
    const usersWithCompletedTasks = await prisma.user.findMany({
      where: {
        id: { not: userId },
        dailyTasks: {
          some: {
            dueDate: today,
            completed: true,
          },
        },
      },
      select: {
        id: true,
        name: true,
        house: {
          select: { name: true },
        },
        character: {
          select: {
            level: true,
            characterSkills: {
              where: {
                createdAt: {
                  gte: today,
                },
              },
              orderBy: { createdAt: "desc" },
              take: 1,
              select: {
                skill: {
                  select: { name: true },
                },
              },
            },
          },
        },
        dailyTasks: {
          where: {
            dueDate: today,
          },
          select: {
            description: true,
            completed: true,
            habit: {
              select: { category: true },
            },
          },
        },
      },
    });

    // Filtrar: exatamente DAILY_TASK_LIMIT tarefas, todas completas,
    // e categoria dominante bate com a solicitada
    const matchingPlayers: {
      name: string;
      level: number;
      houseName: string | null;
      tasks: { description: string; category: HabitCategory }[];
      unlockedSkillName: string | null;
    }[] = [];

    for (const user of usersWithCompletedTasks) {
      // Deve ter exatamente DAILY_TASK_LIMIT tarefas hoje
      if (user.dailyTasks.length !== DAILY_TASK_LIMIT) {
        continue;
      }

      // Todas devem estar completas
      const allCompleted = user.dailyTasks.every((t) => t.completed);
      if (!allCompleted) {
        continue;
      }

      // Deve ter personagem
      if (!user.character) {
        continue;
      }

      // Calcular categoria dominante
      const categories: HabitCategory[] = user.dailyTasks.map(
        (t) => t.habit.category
      );
      const dominant = getDominantCategory(categories);

      if (dominant !== category) {
        continue;
      }

      // Skill desbloqueada hoje (a mais recente)
      const recentSkill = user.character.characterSkills[0] ?? null;
      const unlockedSkillName = recentSkill
        ? recentSkill.skill.name
        : null;

      matchingPlayers.push({
        name: user.name,
        level: user.character.level,
        houseName: user.house?.name ?? null,
        tasks: user.dailyTasks.map((t) => ({
          description: t.description,
          category: t.habit.category,
        })),
        unlockedSkillName,
      });

      // Limitar resultados
      if (matchingPlayers.length >= MAX_RESULTS) {
        break;
      }
    }

    return apiSuccess({
      players: matchingPlayers,
      totalCount: matchingPlayers.length,
    });
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return apiError(error.message, error.code, error.statusCode);
    }

    console.error("[GET /api/battle/coop/category-players]", error);
    return apiError("Erro interno do servidor", "INTERNAL_ERROR", 500);
  }
}
