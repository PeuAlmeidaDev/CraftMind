import { getPlayerTier, rollMobTier, selectRandomMob } from "../matchmaking";

describe("getPlayerTier", () => {
  it("retorna tier 1 para level 1", () => {
    expect(getPlayerTier(1)).toBe(1);
  });

  it("retorna tier 1 para level 10", () => {
    expect(getPlayerTier(10)).toBe(1);
  });

  it("retorna tier 2 para level 11", () => {
    expect(getPlayerTier(11)).toBe(2);
  });

  it("retorna tier 5 para level 50", () => {
    expect(getPlayerTier(50)).toBe(5);
  });

  it("retorna tier 5 (clamped) para level 100", () => {
    expect(getPlayerTier(100)).toBe(5);
  });
});

describe("rollMobTier", () => {
  it("retorna mesmo tier quando roll < 0.6", () => {
    expect(rollMobTier(3, () => 0.3)).toBe(3);
  });

  it("retorna tier inferior quando roll >= 0.6 e < 0.85", () => {
    expect(rollMobTier(3, () => 0.7)).toBe(2);
  });

  it("retorna tier superior quando roll >= 0.85", () => {
    expect(rollMobTier(3, () => 0.9)).toBe(4);
  });

  it("clamp inferior em 1 quando tier ja e 1", () => {
    expect(rollMobTier(1, () => 0.7)).toBe(1);
  });

  it("clamp superior em 5 quando tier ja e 5", () => {
    expect(rollMobTier(5, () => 0.9)).toBe(5);
  });
});

describe("selectRandomMob", () => {
  it("retorna o unico mob quando lista tem 1 elemento", () => {
    const mob = { name: "Slime", tier: 1 };
    expect(selectRandomMob([mob], () => 0)).toBe(mob);
  });

  it("lanca erro quando lista esta vazia", () => {
    expect(() => selectRandomMob([], () => 0)).toThrow("Lista de mobs vazia");
  });
});
