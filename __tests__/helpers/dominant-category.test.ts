import { describe, it, expect } from "vitest";
import { getDominantCategory } from "@/lib/helpers/dominant-category";
import type { HabitCategory } from "@prisma/client";

// ---------------------------------------------------------------------------
// Testes — getDominantCategory
// ---------------------------------------------------------------------------

describe("getDominantCategory", () => {
  it("retorna categoria unica quando ha maioria clara", () => {
    const categories: HabitCategory[] = ["PHYSICAL", "PHYSICAL", "INTELLECTUAL"];
    const result = getDominantCategory(categories);
    expect(result).toBe("PHYSICAL");
  });

  it("retorna categoria correta com maioria absoluta (3 de 5)", () => {
    const categories: HabitCategory[] = [
      "MENTAL",
      "MENTAL",
      "MENTAL",
      "SOCIAL",
      "SPIRITUAL",
    ];
    const result = getDominantCategory(categories);
    expect(result).toBe("MENTAL");
  });

  it("empate: com randomFn fixo retorna categoria deterministica (primeira empatada)", () => {
    // randomFn retorna 0.0 → Math.floor(0.0 * 2) = 0 → primeiro empatado
    const categories: HabitCategory[] = ["PHYSICAL", "MENTAL"];
    const result = getDominantCategory(categories, () => 0.0);
    expect(result).toBe("PHYSICAL");
  });

  it("empate: com randomFn 0.99 retorna ultima categoria empatada", () => {
    // randomFn retorna 0.99 → Math.floor(0.99 * 2) = 1 → segundo empatado
    const categories: HabitCategory[] = ["PHYSICAL", "MENTAL"];
    const result = getDominantCategory(categories, () => 0.99);
    expect(result).toBe("MENTAL");
  });

  it("empate triplo: randomFn 0.5 seleciona categoria do meio", () => {
    // 3 categorias empatadas → Math.floor(0.5 * 3) = 1 → segunda
    const categories: HabitCategory[] = ["PHYSICAL", "INTELLECTUAL", "MENTAL"];
    const result = getDominantCategory(categories, () => 0.5);
    expect(result).toBe("INTELLECTUAL");
  });

  it("array com 1 elemento retorna esse elemento", () => {
    const categories: HabitCategory[] = ["SOCIAL"];
    const result = getDominantCategory(categories);
    expect(result).toBe("SOCIAL");
  });

  it("array vazio lanca Error", () => {
    expect(() => getDominantCategory([])).toThrow("categories array is empty");
  });

  it("todas as 5 categorias iguais retorna essa categoria", () => {
    const categories: HabitCategory[] = [
      "SPIRITUAL",
      "SPIRITUAL",
      "SPIRITUAL",
      "SPIRITUAL",
      "SPIRITUAL",
    ];
    const result = getDominantCategory(categories);
    expect(result).toBe("SPIRITUAL");
  });

  it("varias repeticoes da mesma categoria retorna corretamente", () => {
    const categories: HabitCategory[] = [
      "INTELLECTUAL",
      "INTELLECTUAL",
      "INTELLECTUAL",
      "INTELLECTUAL",
      "PHYSICAL",
      "MENTAL",
    ];
    const result = getDominantCategory(categories);
    expect(result).toBe("INTELLECTUAL");
  });
});
