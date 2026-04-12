import { processLevelUp, distributePoints } from "../level-up";
import { expToNextLevel } from "../formulas";
import { LEVEL_CAP, POINTS_PER_LEVEL, HP_POINTS_MULTIPLIER } from "../constants";

describe("processLevelUp", () => {
  it("sobe exatamente 1 nivel com EXP igual ao necessario", () => {
    const result = processLevelUp({ level: 1, currentExp: 100, freePoints: 0 });

    expect(result.levelsGained).toBe(1);
    expect(result.newLevel).toBe(2);
    expect(result.newExp).toBe(0);
    expect(result.newFreePoints).toBe(5);
  });

  it("sobe multiplos niveis quando EXP cobre mais de um level", () => {
    // expToNextLevel(1) = 100, expToNextLevel(2) = floor(100*1.15^1) = 114. Total: 214
    const result = processLevelUp({ level: 1, currentExp: 214, freePoints: 0 });

    expect(result.levelsGained).toBe(2);
    expect(result.newLevel).toBe(3);
    expect(result.newExp).toBe(0);
    expect(result.newFreePoints).toBe(10);
  });

  it("para no level cap e zera EXP restante", () => {
    const expNeeded = expToNextLevel(99);
    const result = processLevelUp({ level: 99, currentExp: expNeeded, freePoints: 0 });

    expect(result.newLevel).toBe(LEVEL_CAP);
    expect(result.newExp).toBe(0);
  });

  it("nao sobe nivel quando EXP e insuficiente", () => {
    const result = processLevelUp({ level: 1, currentExp: 50, freePoints: 3 });

    expect(result.levelsGained).toBe(0);
    expect(result.newLevel).toBe(1);
    expect(result.newExp).toBe(50);
    expect(result.newFreePoints).toBe(3);
  });

  it("acumula pontos livres existentes ao subir de nivel", () => {
    const result = processLevelUp({ level: 1, currentExp: 215, freePoints: 10 });

    expect(result.newFreePoints).toBe(20);
  });
});

describe("distributePoints", () => {
  it("distribui pontos validos e calcula remaining corretamente", () => {
    const result = distributePoints({
      freePoints: 10,
      distribution: { physicalAtk: 3, speed: 2 },
    });

    expect(result.valid).toBe(true);
    expect(result.statChanges.physicalAtk).toBe(3);
    expect(result.statChanges.speed).toBe(2);
    expect(result.remainingPoints).toBe(5);
  });

  it("multiplica HP pelo multiplicador de pontos", () => {
    const result = distributePoints({
      freePoints: 5,
      distribution: { hp: 2 },
    });

    expect(result.valid).toBe(true);
    expect(result.statChanges.hp).toBe(2 * HP_POINTS_MULTIPLIER);
    expect(result.remainingPoints).toBe(3);
  });

  it("rejeita accuracy como stat distribuivel", () => {
    const result = distributePoints({
      freePoints: 10,
      distribution: { accuracy: 1 },
    });

    expect(result.valid).toBe(false);
    expect(result.error).toBe("accuracy nao e um stat distribuivel");
  });

  it("rejeita stat inexistente", () => {
    const result = distributePoints({
      freePoints: 10,
      distribution: { banana: 1 },
    });

    expect(result.valid).toBe(false);
    expect(result.error).toBe("Stat invalido: banana");
  });

  it("rejeita valor negativo", () => {
    const result = distributePoints({
      freePoints: 10,
      distribution: { physicalAtk: -1 },
    });

    expect(result.valid).toBe(false);
  });

  it("rejeita quando total excede pontos disponiveis", () => {
    const result = distributePoints({
      freePoints: 5,
      distribution: { physicalAtk: 3, magicAtk: 3 },
    });

    expect(result.valid).toBe(false);
  });

  it("calcula remaining quando sobram pontos", () => {
    const result = distributePoints({
      freePoints: 15,
      distribution: { physicalAtk: 3, magicDef: 4 },
    });

    expect(result.valid).toBe(true);
    expect(result.remainingPoints).toBe(8);
  });
});
