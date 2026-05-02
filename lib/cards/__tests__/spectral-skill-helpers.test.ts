// lib/cards/__tests__/spectral-skill-helpers.test.ts
//
// Cobre `pickSpectralCardSource` — funcao pura de selecao do cristal Espectral
// que contribui com o 5o slot em batalha. Regra: filtra cards com purity 100,
// equipped e spectralSkillId nao-nulo, ordena por slotIndex ASC, retorna o
// primeiro (ou null).

import { describe, it, expect } from "vitest";
import {
  pickSpectralCardSource,
  type EquippedUserCardForSpectral,
} from "../spectral-skill-helpers";

type Overrides = Partial<EquippedUserCardForSpectral>;

function makeCard(overrides: Overrides = {}): EquippedUserCardForSpectral {
  // Usar 'in' para distinguir "nao informado" de "explicitamente null"
  const base = {
    id: overrides.id ?? "uc-1",
    userId: overrides.userId ?? "user-1",
    cardId: overrides.cardId ?? "card-1",
    equipped: "equipped" in overrides ? overrides.equipped : true,
    slotIndex: "slotIndex" in overrides ? overrides.slotIndex : 0,
    xp: 0,
    level: 1,
    purity: overrides.purity ?? 100,
    spectralSkillId:
      "spectralSkillId" in overrides ? overrides.spectralSkillId : "skill-1",
    createdAt: new Date(),
    updatedAt: new Date(),
    card: overrides.card ?? null,
    spectralSkill: overrides.spectralSkill ?? null,
  };
  return base as unknown as EquippedUserCardForSpectral;
}

describe("pickSpectralCardSource", () => {
  it("retorna null quando lista vazia", () => {
    expect(pickSpectralCardSource([])).toBeNull();
  });

  it("retorna null quando nenhuma carta tem purity 100", () => {
    const cards = [
      makeCard({ id: "a", purity: 90 }),
      makeCard({ id: "b", purity: 50 }),
    ];
    expect(pickSpectralCardSource(cards)).toBeNull();
  });

  it("retorna null quando purity 100 mas spectralSkillId nulo", () => {
    const cards = [makeCard({ id: "a", purity: 100, spectralSkillId: null })];
    expect(pickSpectralCardSource(cards)).toBeNull();
  });

  it("retorna a unica candidata quando ha exatamente uma", () => {
    const cards = [
      makeCard({ id: "a", purity: 90, spectralSkillId: null }),
      makeCard({ id: "spectral", purity: 100, slotIndex: 1, spectralSkillId: "skill-x" }),
    ];
    const result = pickSpectralCardSource(cards);
    expect(result?.id).toBe("spectral");
  });

  it("entre 3 espectrais equipadas, retorna a de menor slotIndex", () => {
    const cards = [
      makeCard({ id: "slot-2", purity: 100, slotIndex: 2 }),
      makeCard({ id: "slot-0", purity: 100, slotIndex: 0 }),
      makeCard({ id: "slot-1", purity: 100, slotIndex: 1 }),
    ];
    const result = pickSpectralCardSource(cards);
    expect(result?.id).toBe("slot-0");
  });

  it("ignora cards com equipped: false mesmo se purity 100", () => {
    const cards = [
      makeCard({ id: "a", purity: 100, equipped: false, slotIndex: null }),
      makeCard({ id: "b", purity: 100, equipped: true, slotIndex: 1 }),
    ];
    const result = pickSpectralCardSource(cards);
    expect(result?.id).toBe("b");
  });

  it("retorna a candidata mesmo que spectralSkill (relation) seja null — caller decide", () => {
    // pickSpectralCardSource nao verifica se a Skill foi carregada; apenas
    // filtra por purity/equipped/spectralSkillId. O caller (loadEquippedCards)
    // checa spectralSkill === null e faz skip silencioso com warn.
    const cards = [
      makeCard({
        id: "a",
        purity: 100,
        spectralSkillId: "skill-deleted",
        spectralSkill: null,
      }),
    ];
    const result = pickSpectralCardSource(cards);
    expect(result?.id).toBe("a");
    expect(result?.spectralSkill).toBeNull();
  });

  it("desempate por slotIndex quando ha cartas com slotIndex null defensivamente", () => {
    // slotIndex null vai pro fim
    const cards = [
      makeCard({ id: "null-slot", purity: 100, slotIndex: null, equipped: true }),
      makeCard({ id: "slot-0", purity: 100, slotIndex: 0 }),
    ];
    const result = pickSpectralCardSource(cards);
    expect(result?.id).toBe("slot-0");
  });
});
