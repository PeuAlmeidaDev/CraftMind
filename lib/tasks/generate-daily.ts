import { prisma } from "@/lib/prisma"
import { taskTemplates, type TaskTemplate } from "@/prisma/task-templates"
import type { Prisma, PrismaClient } from "@prisma/client"
import { getTodayDateBRT } from "@/lib/helpers/date-utils"

/** Tipo do transaction client do Prisma (compativel com PrismaClient para queries) */
type TransactionClient = Omit<PrismaClient, "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends">

/** Numero exato de tarefas diarias geradas por jogador */
export const DAILY_TASK_LIMIT = 5

/** Fisher-Yates shuffle — embaralha o array in-place e retorna a mesma referencia */
function fisherYatesShuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    const tmp = arr[i]
    arr[i] = arr[j]
    arr[j] = tmp
  }
  return arr
}

/**
 * Gera exatamente {@link DAILY_TASK_LIMIT} tarefas diarias para um usuario.
 *
 * Logica de selecao:
 * - >= 5 habitos: sorteia 5 habitos distintos, 1 template cada.
 * - < 5 habitos (mas > 0): usa todos os habitos e repete alguns para
 *   completar 5, garantindo templates (descricoes) diferentes por habito.
 * - 0 habitos: retorna silenciosamente.
 *
 * Idempotente: usa createMany com skipDuplicates (constraint userId+description+dueDate).
 */
export async function generateDailyTasks(userId: string, tx?: TransactionClient): Promise<void> {
  const db = tx ?? prisma

  // Buscar habitos do usuario com o nome do habito
  const userHabits = await db.userHabit.findMany({
    where: { userId },
    include: {
      habit: {
        select: { id: true, name: true },
      },
    },
  })

  if (userHabits.length === 0) {
    return
  }

  // Indexar templates por habitName para busca eficiente
  const templatesByHabit = new Map<string, TaskTemplate[]>()
  for (const template of taskTemplates) {
    const existing = templatesByHabit.get(template.habitName)
    if (existing) {
      existing.push(template)
    } else {
      templatesByHabit.set(template.habitName, [template])
    }
  }

  // Data do dia BRT (meia-noite UTC do dia em BRT)
  const today = getTodayDateBRT()

  // Filtrar habitos que possuem templates disponiveis
  const habitsWithTemplates = userHabits.filter((uh) => {
    const templates = templatesByHabit.get(uh.habit.name)
    if (!templates || templates.length === 0) {
      console.warn(
        `[generateDailyTasks] Nenhum template encontrado para o habito "${uh.habit.name}" (habitId: ${uh.habitId})`
      )
      return false
    }
    return true
  })

  if (habitsWithTemplates.length === 0) {
    return
  }

  // Montar lista de slots: cada slot e um { habitId, habitName }
  // Se >= DAILY_TASK_LIMIT habitos: sortear DAILY_TASK_LIMIT distintos
  // Se < DAILY_TASK_LIMIT: usar todos e repetir ciclicamente ate completar
  type HabitSlot = { habitId: string; habitName: string }
  const slots: HabitSlot[] = []

  if (habitsWithTemplates.length >= DAILY_TASK_LIMIT) {
    const shuffled = fisherYatesShuffle([...habitsWithTemplates])
    for (let i = 0; i < DAILY_TASK_LIMIT; i++) {
      slots.push({
        habitId: shuffled[i].habitId,
        habitName: shuffled[i].habit.name,
      })
    }
  } else {
    // Usar todos primeiro, depois repetir ciclicamente
    const shuffled = fisherYatesShuffle([...habitsWithTemplates])
    for (let i = 0; i < DAILY_TASK_LIMIT; i++) {
      const habit = shuffled[i % shuffled.length]
      slots.push({
        habitId: habit.habitId,
        habitName: habit.habit.name,
      })
    }
  }

  // Selecionar templates garantindo que o mesmo habito nunca repita descricao
  // usedTemplatesByHabit rastreia indices ja usados por habitName
  const usedTemplatesByHabit = new Map<string, Set<number>>()
  const tasksToCreate: Prisma.DailyTaskCreateManyInput[] = []

  for (const slot of slots) {
    const templates = templatesByHabit.get(slot.habitName)
    // templates existe pois filtramos habitsWithTemplates acima
    if (!templates || templates.length === 0) {
      continue
    }

    let usedIndices = usedTemplatesByHabit.get(slot.habitName)
    if (!usedIndices) {
      usedIndices = new Set<number>()
      usedTemplatesByHabit.set(slot.habitName, usedIndices)
    }

    // Se todos os templates ja foram usados, nao podemos gerar mais para este habito
    if (usedIndices.size >= templates.length) {
      continue
    }

    // Coletar indices disponiveis e embaralhar para selecao aleatoria
    const available: number[] = []
    for (let i = 0; i < templates.length; i++) {
      if (!usedIndices.has(i)) {
        available.push(i)
      }
    }
    fisherYatesShuffle(available)

    const selectedIndex = available[0]
    usedIndices.add(selectedIndex)
    const selected = templates[selectedIndex]

    tasksToCreate.push({
      userId,
      habitId: slot.habitId,
      description: selected.description,
      tag: selected.tag,
      attributeGrants: selected.attributeGrants as unknown as Prisma.InputJsonValue,
      dueDate: today,
      completed: false,
    })
  }

  if (tasksToCreate.length === 0) {
    return
  }

  await db.dailyTask.createMany({
    data: tasksToCreate,
    skipDuplicates: true,
  })
}
