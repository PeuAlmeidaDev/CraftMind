import { determineHouse } from "@/lib/helpers/determine-house";

function makeHabits(...names: string[]) {
  return names.map((name) => ({ name }));
}

describe("determineHouse", () => {
  describe("quando ha uma casa dominante clara", () => {
    it("retorna LYCUS quando maioria dos habitos pontua para LYCUS", () => {
      // Estudos de Tecnologia (LYCUS), Idiomas (LYCUS), Digital Detox (LYCUS)
      const result = determineHouse(
        makeHabits("Estudos de Tecnologia", "Idiomas", "Digital Detox")
      );
      expect(result).toBe("LYCUS");
    });

    it("retorna NEREID quando maioria dos habitos pontua para NEREID", () => {
      // Yoga (NEREID), Respiracao (NEREID), Mentoria (NEREID)
      const result = determineHouse(
        makeHabits("Yoga", "Respiracao", "Mentoria")
      );
      expect(result).toBe("NEREID");
    });

    it("retorna NOCTIS quando maioria dos habitos pontua para NOCTIS", () => {
      // Danca (NOCTIS), Escrita Criativa (NOCTIS), Contemplacao (NOCTIS)
      const result = determineHouse(
        makeHabits("Danca", "Escrita Criativa", "Contemplacao")
      );
      expect(result).toBe("NOCTIS");
    });

    it("retorna ARION quando maioria dos habitos pontua para ARION", () => {
      // Alongamento (ARION, NEREID), Planejamento do Dia (NOCTIS, ARION), Ensinar Algo (NOCTIS, ARION), Gratidao (NOCTIS, ARION)
      // ARION = 4, NOCTIS = 3, NEREID = 1
      const result = determineHouse(
        makeHabits("Alongamento", "Planejamento do Dia", "Ensinar Algo", "Gratidao")
      );
      expect(result).toBe("ARION");
    });
  });

  describe("quando ha empate", () => {
    it("sorteia entre as casas empatadas com random baixo", () => {
      // Exercicio Fisico (LYCUS, NOCTIS, ARION) -> empate triplo, 1 ponto cada
      // ALL_HOUSES filtrado por score = [ARION, LYCUS, NOCTIS]
      // randomFn = 0.0 -> floor(0.0 * 3) = 0 -> ARION
      const result = determineHouse(
        makeHabits("Exercicio Fisico"),
        () => 0.0
      );
      expect(result).toBe("ARION");
    });

    it("sorteia o ultimo empatado com random alto", () => {
      // Exercicio Fisico (LYCUS, NOCTIS, ARION) -> empate triplo
      // ALL_HOUSES filtrado = [ARION, LYCUS, NOCTIS]
      // randomFn = 0.99 -> floor(0.99 * 3) = 2 -> NOCTIS
      const result = determineHouse(
        makeHabits("Exercicio Fisico"),
        () => 0.99
      );
      expect(result).toBe("NOCTIS");
    });
  });

  describe("quando todos os habitos sao neutros", () => {
    it("sorteia entre as 4 casas com random baixo", () => {
      // Journaling e Silencio Intencional nao estao no mapa
      // randomFn = 0.0 -> ARION (index 0 de ALL_HOUSES)
      const result = determineHouse(
        makeHabits("Journaling", "Silencio Intencional"),
        () => 0.0
      );
      expect(result).toBe("ARION");
    });

    it("sorteia NEREID com random alto e habitos neutros", () => {
      // randomFn = 0.99 -> floor(0.99 * 4) = 3 -> NEREID
      const result = determineHouse(
        makeHabits("Journaling"),
        () => 0.99
      );
      expect(result).toBe("NEREID");
    });
  });

  describe("quando habitos sao mistos (pontuam + neutros)", () => {
    it("ignora habitos neutros e conta apenas os que pontuam", () => {
      // Yoga (NEREID) + Journaling (neutro) + Silencio Intencional (neutro)
      const result = determineHouse(
        makeHabits("Yoga", "Journaling", "Silencio Intencional")
      );
      expect(result).toBe("NEREID");
    });
  });

  describe("quando habitos pontuam para multiplas casas", () => {
    it("conta +1 para cada casa do habito", () => {
      // Manter Contato (LYCUS, ARION, NEREID) + Estudos de Tecnologia (LYCUS)
      // LYCUS = 2, ARION = 1, NEREID = 1
      const result = determineHouse(
        makeHabits("Manter Contato", "Estudos de Tecnologia")
      );
      expect(result).toBe("LYCUS");
    });
  });

  describe("com array vazio", () => {
    it("sorteia entre as 4 casas", () => {
      const result = determineHouse([], () => 0.5);
      // floor(0.5 * 4) = 2 -> NOCTIS (index 2 de ALL_HOUSES)
      expect(result).toBe("NOCTIS");
    });
  });
});
