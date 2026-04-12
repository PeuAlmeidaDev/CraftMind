import { calculatePvpExpGained } from "../formulas";

describe("calculatePvpExpGained", () => {
  it("retorna 50 EXP para vitoria contra oponente do mesmo nivel", () => {
    expect(calculatePvpExpGained("VICTORY", 10, 10)).toBe(50);
  });

  it("retorna 100 EXP para vitoria contra oponente +10 niveis acima", () => {
    expect(calculatePvpExpGained("VICTORY", 10, 20)).toBe(100);
  });

  it("retorna 25 EXP para vitoria contra oponente -10 niveis abaixo", () => {
    expect(calculatePvpExpGained("VICTORY", 20, 10)).toBe(25);
  });

  it("retorna 0 EXP para derrota", () => {
    expect(calculatePvpExpGained("DEFEAT", 10, 10)).toBe(0);
  });

  it("retorna 25 EXP para empate contra oponente do mesmo nivel", () => {
    expect(calculatePvpExpGained("DRAW", 10, 10)).toBe(25);
  });

  it("retorna pelo menos 1 EXP para vitoria mesmo com grande diferenca de nivel", () => {
    expect(calculatePvpExpGained("VICTORY", 100, 1)).toBeGreaterThanOrEqual(1);
  });

  it("retorna pelo menos 1 EXP para empate mesmo com grande diferenca de nivel", () => {
    expect(calculatePvpExpGained("DRAW", 100, 1)).toBeGreaterThanOrEqual(1);
  });
});
