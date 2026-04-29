// Testes de integracao para GET /api/bestiary.
// Verifica gating de campos com 0/1/50 vitorias contra o mob.

import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockMobFindMany = vi.fn();
const mockMobKillStatFindMany = vi.fn();
const mockUserCardFindMany = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    mob: { findMany: (...args: unknown[]) => mockMobFindMany(...args) },
    mobKillStat: { findMany: (...args: unknown[]) => mockMobKillStatFindMany(...args) },
    userCard: { findMany: (...args: unknown[]) => mockUserCardFindMany(...args) },
  },
}));

vi.mock("@/lib/auth/verify-session", async () => {
  const actual = await vi.importActual<typeof import("@/lib/auth/verify-session")>("@/lib/auth/verify-session");
  return {
    ...actual,
    verifySession: vi.fn(),
  };
});

import { GET } from "../route";
import { verifySession } from "@/lib/auth/verify-session";

const mockedVerifySession = vi.mocked(verifySession);

function makeReq(): NextRequest {
  return new NextRequest("http://localhost:3000/api/bestiary", { method: "GET" });
}

const mob1 = {
  id: "mob_slime",
  name: "Slime",
  description: "gosma.",
  tier: 1,
  aiProfile: "BALANCED",
  imageUrl: "https://x/slime.jpg",
  loreExpanded: "Lore profunda do Slime.",
  curiosity: "Slimes nao tem ossos.",
  physicalAtk: 10,
  physicalDef: 12,
  magicAtk: 10,
  magicDef: 10,
  hp: 120,
  speed: 10,
  skills: [
    { skill: { name: "Ataque Rapido", tier: 1, damageType: "PHYSICAL" } },
  ],
  card: { id: "card_slime", rarity: "COMUM" },
};

const mob2 = {
  id: "mob_dragao",
  name: "Dragao",
  description: "voa e cospe fogo.",
  tier: 4,
  aiProfile: "AGGRESSIVE",
  imageUrl: "https://x/dragao.jpg",
  loreExpanded: "Lore do Dragao.",
  curiosity: "Curiosidade do Dragao.",
  physicalAtk: 70,
  physicalDef: 60,
  magicAtk: 65,
  magicDef: 55,
  hp: 550,
  speed: 58,
  skills: [
    { skill: { name: "Furia do Dragao", tier: 3, damageType: "PHYSICAL" } },
  ],
  card: { id: "card_dragao", rarity: "EPICO" },
};

describe("GET /api/bestiary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedVerifySession.mockResolvedValue({ userId: "user_a" });
  });

  it("user sem kills: tudo UNDISCOVERED, nao vaza nome", async () => {
    mockMobFindMany.mockResolvedValue([mob1, mob2]);
    mockMobKillStatFindMany.mockResolvedValue([]);
    mockUserCardFindMany.mockResolvedValue([]);

    const res = await GET(makeReq());
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: { entries: Array<{ unlockTier: string; name: string | null; loreExpanded: string | null }>; totals: { discovered: number; studied: number; mastered: number; total: number } } };
    expect(body.data.entries).toHaveLength(2);
    for (const e of body.data.entries) {
      expect(e.unlockTier).toBe("UNDISCOVERED");
      expect(e.name).toBeNull();
    }
    expect(body.data.totals.total).toBe(2);
    expect(body.data.totals.discovered).toBe(0);
    expect(body.data.totals.studied).toBe(0);
    expect(body.data.totals.mastered).toBe(0);
  });

  it("1 vitoria contra mob1: DISCOVERED com nome+imagem, sem stats nem lore", async () => {
    mockMobFindMany.mockResolvedValue([mob1, mob2]);
    mockMobKillStatFindMany.mockResolvedValue([
      {
        userId: "user_a",
        mobId: "mob_slime",
        victories: 1,
        defeats: 0,
        damageDealt: 100,
        firstSeenAt: new Date("2026-01-01"),
        lastSeenAt: new Date("2026-01-01"),
      },
    ]);
    mockUserCardFindMany.mockResolvedValue([]);

    const res = await GET(makeReq());
    const body = (await res.json()) as { data: { entries: Array<{ mobId: string; unlockTier: string; name: string | null; stats: unknown; loreExpanded: string | null }> } };
    const slimeEntry = body.data.entries.find((e) => e.mobId === "mob_slime");
    expect(slimeEntry?.unlockTier).toBe("DISCOVERED");
    expect(slimeEntry?.name).toBe("Slime");
    expect(slimeEntry?.stats).toBeNull();
    expect(slimeEntry?.loreExpanded).toBeNull();
  });

  it("50 vitorias: MASTERED libera lore, masteryBadge, e card.hasCard refletindo posse", async () => {
    mockMobFindMany.mockResolvedValue([mob1]);
    mockMobKillStatFindMany.mockResolvedValue([
      {
        userId: "user_a",
        mobId: "mob_slime",
        victories: 50,
        defeats: 5,
        damageDealt: 5000,
        firstSeenAt: new Date("2026-01-01"),
        lastSeenAt: new Date("2026-01-30"),
      },
    ]);
    mockUserCardFindMany.mockResolvedValue([{ cardId: "card_slime" }]);

    const res = await GET(makeReq());
    const body = (await res.json()) as { data: { entries: Array<{ unlockTier: string; loreExpanded: string | null; masteryBadge: boolean; card: { hasCard: boolean; rarity: string | null }; stats: unknown; skills: unknown }>; totals: { mastered: number } } };
    const e = body.data.entries[0];
    expect(e.unlockTier).toBe("MASTERED");
    expect(e.loreExpanded).toBe("Lore profunda do Slime.");
    expect(e.masteryBadge).toBe(true);
    expect(e.card).toEqual({ hasCard: true, rarity: "COMUM" });
    expect(e.stats).not.toBeNull();
    expect(e.skills).not.toBeNull();
    expect(body.data.totals.mastered).toBe(1);
  });

  it("user nao possui o cristal: card.hasCard=false e rarity=null mesmo em MASTERED", async () => {
    mockMobFindMany.mockResolvedValue([mob1]);
    mockMobKillStatFindMany.mockResolvedValue([
      {
        userId: "user_a",
        mobId: "mob_slime",
        victories: 50,
        defeats: 0,
        damageDealt: 1000,
        firstSeenAt: new Date(),
        lastSeenAt: new Date(),
      },
    ]);
    mockUserCardFindMany.mockResolvedValue([]); // sem cards

    const res = await GET(makeReq());
    const body = (await res.json()) as { data: { entries: Array<{ card: { hasCard: boolean; rarity: string | null } }> } };
    expect(body.data.entries[0].card).toEqual({ hasCard: false, rarity: null });
  });

  it("totals contam corretamente em mistura DISCOVERED/STUDIED/MASTERED", async () => {
    const mob3 = { ...mob2, id: "mob_lobo", name: "Lobo" };
    mockMobFindMany.mockResolvedValue([mob1, mob2, mob3]);
    mockMobKillStatFindMany.mockResolvedValue([
      // mob1 = MASTERED
      { userId: "u", mobId: "mob_slime", victories: 50, defeats: 0, damageDealt: 0, firstSeenAt: new Date(), lastSeenAt: new Date() },
      // mob2 = STUDIED
      { userId: "u", mobId: "mob_dragao", victories: 15, defeats: 0, damageDealt: 0, firstSeenAt: new Date(), lastSeenAt: new Date() },
      // mob3 = DISCOVERED
      { userId: "u", mobId: "mob_lobo", victories: 1, defeats: 0, damageDealt: 0, firstSeenAt: new Date(), lastSeenAt: new Date() },
    ]);
    mockUserCardFindMany.mockResolvedValue([]);

    const res = await GET(makeReq());
    const body = (await res.json()) as { data: { totals: { total: number; discovered: number; studied: number; mastered: number } } };
    // discovered count = total de mobs com tier >= DISCOVERED
    expect(body.data.totals.total).toBe(3);
    expect(body.data.totals.discovered).toBe(3); // todos tem >=1
    expect(body.data.totals.studied).toBe(2); // mob1 (50) e mob2 (15)
    expect(body.data.totals.mastered).toBe(1); // so mob1
  });
});
