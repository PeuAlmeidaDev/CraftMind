import { describe, it, expect } from "vitest";
import {
  assembleHouseStandardEntries,
  ESTANDARTE_WEIGHTS,
  type HouseStandardRawData,
} from "@/lib/ranking/houses";
import type { HouseName } from "@prisma/client";

const ALL_HOUSES = ["ARION", "LYCUS", "NOCTIS", "NEREID"] as const satisfies readonly HouseName[];

function makeRaw(overrides: Partial<HouseStandardRawData> = {}): HouseStandardRawData {
  return {
    houses: ALL_HOUSES.map((name) => ({ name, animal: name, membersCount: 1 })),
    pvp1v1Winners: [],
    pvpTeamWinners: [],
    habitLogHouses: [],
    pveWinners: [],
    ...overrides,
  };
}

describe("assembleHouseStandardEntries", () => {
  it("retorna sempre 4 entries (uma por casa)", () => {
    const result = assembleHouseStandardEntries(makeRaw());
    expect(result).toHaveLength(4);
    const names = result.map((e) => e.house).sort();
    expect(names).toEqual(["ARION", "LYCUS", "NEREID", "NOCTIS"]);
  });

  it("preenche rank de 1 a 4 sem buracos", () => {
    const result = assembleHouseStandardEntries(makeRaw());
    expect(result.map((e) => e.rank)).toEqual([1, 2, 3, 4]);
  });

  it("score e zero quando nao ha eventos", () => {
    const result = assembleHouseStandardEntries(makeRaw());
    for (const entry of result) {
      expect(entry.score).toBe(0);
      expect(entry.totalEvents).toBe(0);
    }
  });

  describe("formula per capita", () => {
    it("divide a soma de pontos pelo numero de membros", () => {
      // ARION: 100 membros, 10 vitorias 1v1 -> 10*30/100 = 3.0
      // LYCUS:  10 membros,  5 vitorias 1v1 -> 5*30/10  = 15.0
      const result = assembleHouseStandardEntries(
        makeRaw({
          houses: [
            { name: "ARION", animal: "Leao", membersCount: 100 },
            { name: "LYCUS", animal: "Lobo", membersCount: 10 },
            { name: "NOCTIS", animal: "Coruja", membersCount: 50 },
            { name: "NEREID", animal: "Sereia", membersCount: 50 },
          ],
          pvp1v1Winners: [
            ...Array(10).fill("ARION"),
            ...Array(5).fill("LYCUS"),
          ],
        }),
      );

      const arion = result.find((e) => e.house === "ARION")!;
      const lycus = result.find((e) => e.house === "LYCUS")!;
      expect(arion.score).toBeCloseTo(3.0);
      expect(lycus.score).toBeCloseTo(15.0);
      // Casa pequena com menos vitorias absolutas vence a casa grande:
      expect(lycus.rank).toBe(1);
      expect(arion.rank).toBe(2);
    });

    it("usa Math.max(membersCount, 1) para evitar divisao por zero", () => {
      // Casa vazia (0 membros) com eventos: nao explode, divide por 1.
      const result = assembleHouseStandardEntries(
        makeRaw({
          houses: [
            { name: "ARION", animal: "Leao", membersCount: 0 },
            { name: "LYCUS", animal: "Lobo", membersCount: 1 },
            { name: "NOCTIS", animal: "Coruja", membersCount: 1 },
            { name: "NEREID", animal: "Sereia", membersCount: 1 },
          ],
          pvp1v1Winners: ["ARION"],
        }),
      );
      const arion = result.find((e) => e.house === "ARION")!;
      expect(arion.score).toBe(ESTANDARTE_WEIGHTS.WIN_1V1);
      expect(Number.isFinite(arion.score)).toBe(true);
    });
  });

  describe("pesos por evento", () => {
    it("WIN_1V1=30, WIN_TEAM=25, HABIT=1, WIN_PVE=10", () => {
      const result = assembleHouseStandardEntries(
        makeRaw({
          houses: ALL_HOUSES.map((name) => ({ name, animal: name, membersCount: 1 })),
          pvp1v1Winners: ["ARION"],
          pvpTeamWinners: ["LYCUS"],
          habitLogHouses: ["NOCTIS"],
          pveWinners: ["NEREID"],
        }),
      );

      const byHouse = Object.fromEntries(result.map((e) => [e.house, e]));
      expect(byHouse.ARION.score).toBe(30);
      expect(byHouse.LYCUS.score).toBe(25);
      expect(byHouse.NOCTIS.score).toBe(1);
      expect(byHouse.NEREID.score).toBe(10);
    });

    it("ignora eventos com casa null (jogador sem houseId)", () => {
      const result = assembleHouseStandardEntries(
        makeRaw({
          pvp1v1Winners: [null, null, "ARION"],
        }),
      );
      const arion = result.find((e) => e.house === "ARION")!;
      expect(arion.totalEvents).toBe(1);
      expect(arion.score).toBe(ESTANDARTE_WEIGHTS.WIN_1V1);
    });
  });

  describe("ordering e tiebreak", () => {
    it("ordena por score desc", () => {
      const result = assembleHouseStandardEntries(
        makeRaw({
          pvp1v1Winners: [
            ...Array(3).fill("ARION"),
            ...Array(2).fill("LYCUS"),
            "NOCTIS",
          ],
        }),
      );
      const ranks = result.map((e) => e.house);
      // Todos com 1 membro, score = pontos brutos
      // ARION: 90, LYCUS: 60, NOCTIS: 30, NEREID: 0
      expect(ranks).toEqual(["ARION", "LYCUS", "NOCTIS", "NEREID"]);
    });

    it("desempata por totalEvents desc", () => {
      // Duas casas com mesmo score per capita mas eventos diferentes.
      // ARION: 1 win 1v1 (30 pts) -> 30 / 1 = 30, events=1
      // LYCUS: 30 habitos        (30 pts) -> 30 / 1 = 30, events=30
      const result = assembleHouseStandardEntries(
        makeRaw({
          houses: [
            { name: "ARION", animal: "Leao", membersCount: 1 },
            { name: "LYCUS", animal: "Lobo", membersCount: 1 },
            { name: "NOCTIS", animal: "Coruja", membersCount: 1 },
            { name: "NEREID", animal: "Sereia", membersCount: 1 },
          ],
          pvp1v1Winners: ["ARION"],
          habitLogHouses: Array(30).fill("LYCUS"),
        }),
      );
      const arion = result.find((e) => e.house === "ARION")!;
      const lycus = result.find((e) => e.house === "LYCUS")!;
      expect(arion.score).toBe(30);
      expect(lycus.score).toBe(30);
      // LYCUS tem mais eventos -> rank melhor
      expect(lycus.rank).toBeLessThan(arion.rank);
    });

    it("tiebreak final por ordem alfabetica do nome", () => {
      // Tudo zero — tiebreak por nome
      const result = assembleHouseStandardEntries(makeRaw());
      const ranks = result.map((e) => e.house);
      expect(ranks).toEqual(["ARION", "LYCUS", "NEREID", "NOCTIS"]);
    });

    it("e deterministico: mesma entrada -> mesma saida", () => {
      const raw = makeRaw({
        pvp1v1Winners: ["ARION", "LYCUS", "ARION"],
        habitLogHouses: ["NOCTIS", "NEREID", "NEREID"],
      });
      const r1 = assembleHouseStandardEntries(raw);
      const r2 = assembleHouseStandardEntries(raw);
      expect(r1).toEqual(r2);
    });
  });

  describe("casa vazia (membersCount=0)", () => {
    it("entra no resultado mesmo sem membros, com score 0", () => {
      const result = assembleHouseStandardEntries(
        makeRaw({
          houses: [
            { name: "ARION", animal: "Leao", membersCount: 0 },
            { name: "LYCUS", animal: "Lobo", membersCount: 1 },
            { name: "NOCTIS", animal: "Coruja", membersCount: 1 },
            { name: "NEREID", animal: "Sereia", membersCount: 1 },
          ],
        }),
      );
      const arion = result.find((e) => e.house === "ARION")!;
      expect(arion.membersCount).toBe(0);
      expect(arion.score).toBe(0);
      expect(arion.totalEvents).toBe(0);
    });
  });
});
