import type { HabitCategory } from "@prisma/client";

/**
 * Calcula a categoria dominante (mais frequente) em um array de HabitCategory.
 *
 * Em caso de empate, desempata aleatoriamente (ou via randomFn injetavel para testes).
 *
 * @throws {Error} se o array estiver vazio
 */
export function getDominantCategory(
  categories: HabitCategory[],
  randomFn?: () => number
): HabitCategory {
  if (categories.length === 0) {
    throw new Error("categories array is empty");
  }

  // Contar ocorrencias de cada categoria
  const counts = new Map<HabitCategory, number>();
  for (const category of categories) {
    counts.set(category, (counts.get(category) ?? 0) + 1);
  }

  // Encontrar contagem maxima
  let maxCount = 0;
  for (const count of counts.values()) {
    if (count > maxCount) {
      maxCount = count;
    }
  }

  // Filtrar categorias empatadas no maximo
  const tied: HabitCategory[] = [];
  for (const [category, count] of counts) {
    if (count === maxCount) {
      tied.push(category);
    }
  }

  // Se apenas 1 categoria dominante, retornar direto
  if (tied.length === 1) {
    return tied[0];
  }

  // Desempate aleatorio
  const random = randomFn ? randomFn() : Math.random();
  const index = Math.floor(random * tied.length);
  return tied[index];
}
