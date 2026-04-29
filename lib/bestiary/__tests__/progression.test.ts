import { describe, it, expect } from "vitest";
import { getUnlockTier, buildBestiaryEntry } from "../progression";
import type { BestiaryMobInput, BestiaryKillStatInput } from "../progression";
import { CardRarityEnum, BestiaryUnlockTierEnum } from "@/types";

const baseMob: BestiaryMobInput = {
  id: "mob_1",
  name: "Slime",
  description: "Gosma mole.",
  tier: 1,
  aiProfile: "BALANCED",
  imageUrl: "https://example/slime.jpg",
  loreExpanded: "Lore profunda do Slime.",
  curiosity: "Sabia que Slimes nao tem ossos?",
  physicalAtk: 10,
  physicalDef: 12,
  magicAtk: 10,
  magicDef: 10,
  hp: 120,
  speed: 10,
  skills: [
    { name: "Ataque Rapido", tier: 1, damageType: "PHYSICAL" },
    { name: "Cura Vital", tier: 1, damageType: "NONE" },
  ],
};

function killStat(victories: number, overrides: Partial<BestiaryKillStatInput> = {}): BestiaryKillStatInput {
  return {
    victories,
    defeats: 0,
    damageDealt: victories * 50,
    firstSeenAt: new Date("2026-01-01T00:00:00Z"),
    lastSeenAt: new Date("2026-01-02T00:00:00Z"),
    ...overrides,
  };
}

describe("getUnlockTier", () => {
  it("0 vitorias -> UNDISCOVERED", () => {
    expect(getUnlockTier(0)).toBe(BestiaryUnlockTierEnum.UNDISCOVERED);
  });
  it("1 vitoria -> DISCOVERED", () => {
    expect(getUnlockTier(1)).toBe(BestiaryUnlockTierEnum.DISCOVERED);
  });
  it("9 vitorias -> ainda DISCOVERED", () => {
    expect(getUnlockTier(9)).toBe(BestiaryUnlockTierEnum.DISCOVERED);
  });
  it("10 vitorias -> STUDIED", () => {
    expect(getUnlockTier(10)).toBe(BestiaryUnlockTierEnum.STUDIED);
  });
  it("49 vitorias -> ainda STUDIED", () => {
    expect(getUnlockTier(49)).toBe(BestiaryUnlockTierEnum.STUDIED);
  });
  it("50 vitorias -> MASTERED", () => {
    expect(getUnlockTier(50)).toBe(BestiaryUnlockTierEnum.MASTERED);
  });
  it("100 vitorias -> MASTERED", () => {
    expect(getUnlockTier(100)).toBe(BestiaryUnlockTierEnum.MASTERED);
  });
});

describe("buildBestiaryEntry", () => {
  it("UNDISCOVERED nao expoe nome, stats nem skills", () => {
    const entry = buildBestiaryEntry({
      mob: baseMob,
      killStat: null,
      hasCard: false,
      cardRarity: null,
      cardArtUrl: null,
    });
    expect(entry.unlockTier).toBe(BestiaryUnlockTierEnum.UNDISCOVERED);
    expect(entry.name).toBeNull();
    expect(entry.tier).toBeNull();
    expect(entry.imageUrl).toBeNull();
    expect(entry.descriptionShort).toBeNull();
    expect(entry.personalStats).toBeNull();
    expect(entry.stats).toBeNull();
    expect(entry.skills).toBeNull();
    expect(entry.aiProfile).toBeNull();
    expect(entry.loreExpanded).toBeNull();
    expect(entry.curiosity).toBeNull();
    expect(entry.masteryBadge).toBe(false);
    expect(entry.victories).toBe(0);
  });

  it("DISCOVERED expoe nome/imagem/personalStats mas nao stats nem skills", () => {
    const entry = buildBestiaryEntry({
      mob: baseMob,
      killStat: killStat(1),
      hasCard: true,
      cardRarity: CardRarityEnum.COMUM,
      cardArtUrl: "https://example/card-slime.jpg",
    });
    expect(entry.unlockTier).toBe(BestiaryUnlockTierEnum.DISCOVERED);
    expect(entry.name).toBe("Slime");
    expect(entry.tier).toBe(1);
    expect(entry.imageUrl).toBe("https://example/slime.jpg");
    expect(entry.descriptionShort).toBe("Gosma mole.");
    expect(entry.personalStats).not.toBeNull();
    expect(entry.personalStats?.victories).toBe(1);
    expect(entry.stats).toBeNull();
    expect(entry.skills).toBeNull();
    expect(entry.aiProfile).toBeNull();
    expect(entry.loreExpanded).toBeNull();
    expect(entry.curiosity).toBeNull();
    expect(entry.masteryBadge).toBe(false);
    expect(entry.card).toEqual({
      hasCard: true,
      rarity: CardRarityEnum.COMUM,
      artUrl: "https://example/card-slime.jpg",
    });
  });

  it("STUDIED expoe stats/skills/aiProfile mas nao lore expandido", () => {
    const entry = buildBestiaryEntry({
      mob: baseMob,
      killStat: killStat(15),
      hasCard: false,
      cardRarity: null,
      cardArtUrl: null,
    });
    expect(entry.unlockTier).toBe(BestiaryUnlockTierEnum.STUDIED);
    expect(entry.stats).toEqual({
      physicalAtk: 10,
      physicalDef: 12,
      magicAtk: 10,
      magicDef: 10,
      hp: 120,
      speed: 10,
    });
    expect(entry.skills?.map((s) => s.name)).toEqual([
      "Ataque Rapido",
      "Cura Vital",
    ]);
    expect(entry.aiProfile).toBe("BALANCED");
    expect(entry.loreExpanded).toBeNull();
    expect(entry.curiosity).toBeNull();
    expect(entry.masteryBadge).toBe(false);
  });

  it("MASTERED libera loreExpanded/curiosity e seta masteryBadge", () => {
    const entry = buildBestiaryEntry({
      mob: baseMob,
      killStat: killStat(50),
      hasCard: true,
      cardRarity: CardRarityEnum.LENDARIO,
      cardArtUrl: null,
    });
    expect(entry.unlockTier).toBe(BestiaryUnlockTierEnum.MASTERED);
    expect(entry.loreExpanded).toBe("Lore profunda do Slime.");
    expect(entry.curiosity).toBe("Sabia que Slimes nao tem ossos?");
    expect(entry.masteryBadge).toBe(true);
    expect(entry.stats).not.toBeNull(); // herda STUDIED
    expect(entry.skills).not.toBeNull();
  });
});
