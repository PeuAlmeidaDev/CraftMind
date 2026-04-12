import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifySession, AuthenticationError } from "@/lib/auth/verify-session";
import { apiSuccess, apiError } from "@/lib/api-response";
import { completeTaskParamsSchema } from "@/lib/validations/tasks";
import {
  mapAttributeGrantsToColumns,
  type CharacterIncrementData,
} from "@/lib/helpers/attribute-mapping";
import { rollSkillUnlock } from "@/lib/helpers/skill-unlock";
import { getTodayDateBRT } from "@/lib/helpers/date-utils";
import type { UnlockedSkillInfo } from "@/types/task";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await verifySession(request);

    // Validar params
    const resolvedParams = await params;
    const parsed = completeTaskParamsSchema.safeParse(resolvedParams);

    if (!parsed.success) {
      return apiError(
        "Dados invalidos",
        "VALIDATION_ERROR",
        422,
        parsed.error.flatten()
      );
    }

    const { id: taskId } = parsed.data;

    // Buscar a tarefa
    const task = await prisma.dailyTask.findUnique({
      where: { id: taskId },
      select: {
        id: true,
        userId: true,
        habitId: true,
        description: true,
        tag: true,
        attributeGrants: true,
      },
    });

    if (!task) {
      return apiError("Tarefa nao encontrada", "TASK_NOT_FOUND", 404);
    }

    if (task.userId !== userId) {
      return apiError("Tarefa nao pertence a este usuario", "FORBIDDEN", 403);
    }

    // Mapear attributeGrants para colunas do Character
    const incrementData = mapAttributeGrantsToColumns(task.attributeGrants);

    // Data do dia BRT (para constraint unique por dia)
    const today = getTodayDateBRT();

    // Transacao atomica: marcar tarefa, criar log, atualizar atributos, desbloquear skill
    type TransactionResult = {
      completedTask: Record<string, unknown>;
      updatedCharacter: Record<string, unknown>;
      unlockedSkill: UnlockedSkillInfo | null;
    };

    let result: TransactionResult;

    try {
      result = await prisma.$transaction(async (tx) => {
        // 1. Marcar tarefa como completada (atomico — impede duplicacao por race condition)
        const updated = await tx.dailyTask.updateMany({
          where: { id: taskId, completed: false },
          data: { completed: true, completedAt: new Date() },
        });

        if (updated.count === 0) {
          throw new Error("ALREADY_COMPLETED");
        }

        // Buscar tarefa atualizada para retorno
        const completedTask = await tx.dailyTask.findUniqueOrThrow({
          where: { id: taskId },
          select: {
            id: true,
            description: true,
            completed: true,
            completedAt: true,
            attributeGrants: true,
            habit: {
              select: {
                name: true,
                category: true,
              },
            },
          },
        });

        // 2. Criar ou reutilizar registro no HabitLog com data do dia
        // Upsert necessario porque habitos podem repetir quando usuario tem < 5
        await tx.habitLog.upsert({
          where: {
            userId_habitId_date: { userId, habitId: task.habitId, date: today },
          },
          update: {},
          create: {
            userId,
            habitId: task.habitId,
            date: today,
            attributesGranted: task.attributeGrants as object,
          },
        });

        // 3. Atualizar atributos do Character com increment
        const characterUpdateData: Record<string, { increment: number }> = {};

        for (const [column, value] of Object.entries(incrementData) as Array<
          [keyof CharacterIncrementData, number]
        >) {
          characterUpdateData[column] = { increment: value };
        }

        const updatedCharacter = await tx.character.update({
          where: { userId },
          data: characterUpdateData,
          select: {
            id: true,
            physicalAtk: true,
            physicalDef: true,
            magicAtk: true,
            magicDef: true,
            hp: true,
            speed: true,
          },
        });

        // 4. Tentar desbloquear uma skill com base na tag da tarefa
        let unlockedSkill: UnlockedSkillInfo | null = null;

        if (rollSkillUnlock(task.tag)) {
          // Buscar ids das skills que o personagem ja possui
          const existingSkills = await tx.characterSkill.findMany({
            where: { characterId: updatedCharacter.id },
            select: { skillId: true },
          });

          const existingSkillIds = existingSkills.map((cs) => cs.skillId);

          // Buscar skills que o personagem ainda nao possui
          const availableSkills = await tx.skill.findMany({
            where: { id: { notIn: existingSkillIds } },
            select: {
              id: true,
              name: true,
              description: true,
              tier: true,
            },
          });

          if (availableSkills.length > 0) {
            // Selecionar uma skill aleatoria
            const randomIndex = Math.floor(
              Math.random() * availableSkills.length
            );
            const selectedSkill = availableSkills[randomIndex];

            // Criar registro de CharacterSkill (desbloqueada mas nao equipada)
            await tx.characterSkill.create({
              data: {
                characterId: updatedCharacter.id,
                skillId: selectedSkill.id,
                equipped: false,
                slotIndex: null,
              },
            });

            unlockedSkill = selectedSkill;
          }
        }

        return { completedTask, updatedCharacter, unlockedSkill };
      });
    } catch (error) {
      if (error instanceof Error && error.message === "ALREADY_COMPLETED") {
        return apiError("Tarefa ja completada", "TASK_ALREADY_COMPLETED", 409);
      }
      throw error;
    }

    return apiSuccess(
      {
        task: result.completedTask,
        attributesGained: task.attributeGrants,
        character: result.updatedCharacter,
        unlockedSkill: result.unlockedSkill,
      },
      200,
      "Tarefa completada com sucesso"
    );
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return apiError(error.message, error.code, error.statusCode);
    }

    console.error("[POST /api/tasks/[id]/complete]", error);
    return apiError("Erro interno do servidor", "INTERNAL_ERROR", 500);
  }
}
