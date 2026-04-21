import type { HouseName } from "@prisma/client";

interface HabitWithName {
  name: string;
}

/**
 * Mapa de habitos para casas.
 * Cada habito pontua +1 para cada casa listada.
 * Habitos ausentes do mapa sao neutros (nao pontuam).
 */
const HABIT_TO_HOUSES: Record<string, HouseName[]> = {
  "Exercicio Fisico": ["LYCUS", "NOCTIS", "ARION"],
  "Yoga": ["NEREID"],
  "Artes Marciais": ["LYCUS", "ARION"],
  "Alongamento": ["ARION", "NEREID"],
  "Danca": ["NOCTIS"],
  "Leitura": ["LYCUS", "NOCTIS", "NEREID"],
  "Estudos Academicos": ["LYCUS", "NOCTIS", "ARION"],
  "Estudos de Tecnologia": ["LYCUS"],
  "Idiomas": ["LYCUS"],
  "Escrita Criativa": ["NOCTIS"],
  "Xadrez e Puzzles": ["NEREID"],
  "Meditacao": ["LYCUS", "NEREID"],
  "Respiracao": ["NEREID"],
  "Digital Detox": ["LYCUS"],
  "Planejamento do Dia": ["NOCTIS", "ARION"],
  "Voluntariado": ["ARION", "NEREID"],
  "Mentoria": ["NEREID"],
  "Manter Contato": ["LYCUS", "ARION", "NEREID"],
  "Ensinar Algo": ["NOCTIS", "ARION"],
  "Pratica da Religiao": ["LYCUS", "NOCTIS", "ARION"],
  "Gratidao": ["NOCTIS", "ARION"],
  "Contemplacao": ["NOCTIS"],
  "Leitura Filosofica": ["NEREID"],
};

const ALL_HOUSES: HouseName[] = ["ARION", "LYCUS", "NOCTIS", "NEREID"];

/**
 * Determina a casa do jogador com base nos habitos selecionados.
 *
 * Regras:
 * - Cada habito da +1 ponto para cada casa listada no mapa.
 * - Habitos nao listados (neutros) nao pontuam.
 * - A casa com mais pontos e atribuida.
 * - Empate: sorteio aleatorio entre as empatadas.
 * - Nenhum ponto (todos neutros): sorteio entre as 4 casas.
 *
 * @param habits Array de objetos com { name: string }
 * @param randomFn Funcao de random injetavel para testes (default: Math.random)
 */
export function determineHouse(
  habits: HabitWithName[],
  randomFn: () => number = Math.random
): HouseName {
  const scores: Record<HouseName, number> = {
    ARION: 0,
    LYCUS: 0,
    NOCTIS: 0,
    NEREID: 0,
  };

  for (const habit of habits) {
    const houses = HABIT_TO_HOUSES[habit.name];
    if (houses) {
      for (const house of houses) {
        scores[house] += 1;
      }
    }
  }

  const maxScore = Math.max(...Object.values(scores));

  // Se nenhum habito pontuou, sortear entre todas as casas
  if (maxScore === 0) {
    const index = Math.floor(randomFn() * ALL_HOUSES.length);
    return ALL_HOUSES[index];
  }

  // Filtrar casas com pontuacao maxima
  const topHouses = ALL_HOUSES.filter((house) => scores[house] === maxScore);

  if (topHouses.length === 1) {
    return topHouses[0];
  }

  // Empate: sorteio entre as empatadas
  const index = Math.floor(randomFn() * topHouses.length);
  return topHouses[index];
}
