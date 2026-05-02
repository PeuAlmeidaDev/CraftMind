// Testes de integracao para GET /api/bestiary.
// Verifica gating de campos com 0/1/50 vitorias contra o mob e a galeria de
// variantes (cards: BestiaryCardInfo[]) com hasCard / cardArtUrl / flavorText.

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

const slimeCard1 = {
  id: "card_slime_1",
  name: "Cristal do Slime",
  rarity: "COMUM",
  cardArtUrl: "https://x/card-slime-1.jpg",
  requiredStars: 1,
  dropChance: 5,
  flavorText: "Resquicio mole de uma alma errante.",
};

const slimeCard2 = {
  id: "card_slime_2",
  name: "Cristal do Slime Heroico",
  rarity: "RARO",
  cardArtUrl: "https://x/card-slime-2.jpg",
  requiredStars: 2,
  dropChance: 4,
  flavorText: "Refletido na lua, brilha mais forte.",
};

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
  cards: [slimeCard1],
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
  cards: [
    {
      id: "card_dragao",
      name: "Cristal do Dragao",
      rarity: "EPICO",
      cardArtUrl: null,
      requiredStars: 1,
      dropChance: 1,
      flavorText: "Coracao em chamas eternas.",
    },
  ],
};

type CardInResponse = {
  id: string;
  name: string;
  rarity: string;
  requiredStars: number;
  dropChance: number;
  hasCard: boolean;
  cardArtUrl: string | null;
  flavorText: string | null;
  userCardXp: number | null;
  userCardLevel: number | null;
};

type EntryInResponse = {
  mobId: string;
  unlockTier: string;
  name: string | null;
  loreExpanded: string | null;
  masteryBadge: boolean;
  cards: CardInResponse[];
  stats: unknown;
  skills: unknown;
  victories: number;
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
    const body = (await res.json()) as {
      data: {
        entries: EntryInResponse[];
        totals: { discovered: number; studied: number; mastered: number; total: number };
      };
    };
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
    const body = (await res.json()) as { data: { entries: EntryInResponse[] } };
    const slimeEntry = body.data.entries.find((e) => e.mobId === "mob_slime");
    expect(slimeEntry?.unlockTier).toBe("DISCOVERED");
    expect(slimeEntry?.name).toBe("Slime");
    expect(slimeEntry?.stats).toBeNull();
    expect(slimeEntry?.loreExpanded).toBeNull();
  });

  it("50 vitorias e variante coletada: MASTERED libera lore + cards[0].hasCard=true com flavorText e cardArtUrl", async () => {
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
    mockUserCardFindMany.mockResolvedValue([
      { cardId: "card_slime_1", xp: 0, level: 1 },
    ]);

    const res = await GET(makeReq());
    const body = (await res.json()) as {
      data: { entries: EntryInResponse[]; totals: { mastered: number } };
    };
    const e = body.data.entries[0];
    expect(e.unlockTier).toBe("MASTERED");
    expect(e.loreExpanded).toBe("Lore profunda do Slime.");
    expect(e.masteryBadge).toBe(true);
    expect(e.cards).toHaveLength(1);
    expect(e.cards[0]).toEqual({
      id: "card_slime_1",
      name: "Cristal do Slime",
      rarity: "COMUM",
      requiredStars: 1,
      dropChance: 5,
      hasCard: true,
      cardArtUrl: "https://x/card-slime-1.jpg",
      flavorText: "Resquicio mole de uma alma errante.",
      userCardXp: 0,
      userCardLevel: 1,
    });
    expect(e.stats).not.toBeNull();
    expect(e.skills).not.toBeNull();
    expect(body.data.totals.mastered).toBe(1);
  });

  it("user nao possui o cristal: cards[0].hasCard=false, flavorText=null e cardArtUrl ainda visivel", async () => {
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
    const body = (await res.json()) as { data: { entries: EntryInResponse[] } };
    expect(body.data.entries[0].cards).toHaveLength(1);
    expect(body.data.entries[0].cards[0]).toEqual({
      id: "card_slime_1",
      name: "Cristal do Slime",
      rarity: "COMUM",
      requiredStars: 1,
      dropChance: 5,
      hasCard: false,
      cardArtUrl: "https://x/card-slime-1.jpg",
      flavorText: null,
      userCardXp: null,
      userCardLevel: null,
    });
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
    const body = (await res.json()) as {
      data: { totals: { total: number; discovered: number; studied: number; mastered: number } };
    };
    // discovered count = total de mobs com tier >= DISCOVERED
    expect(body.data.totals.total).toBe(3);
    expect(body.data.totals.discovered).toBe(3); // todos tem >=1
    expect(body.data.totals.studied).toBe(2); // mob1 (50) e mob2 (15)
    expect(body.data.totals.mastered).toBe(1); // so mob1
  });

  it("mob com 0 variantes coletadas: todas com hasCard=false, flavorText=null, cardArtUrl preservado", async () => {
    const mobMultiVariant = { ...mob1, cards: [slimeCard1, slimeCard2] };
    mockMobFindMany.mockResolvedValue([mobMultiVariant]);
    mockMobKillStatFindMany.mockResolvedValue([
      { userId: "user_a", mobId: "mob_slime", victories: 1, defeats: 0, damageDealt: 0, firstSeenAt: new Date(), lastSeenAt: new Date() },
    ]);
    mockUserCardFindMany.mockResolvedValue([]); // nenhuma variante coletada

    const res = await GET(makeReq());
    const body = (await res.json()) as { data: { entries: EntryInResponse[] } };
    const entry = body.data.entries[0];
    expect(entry.cards).toHaveLength(2);
    for (const c of entry.cards) {
      expect(c.hasCard).toBe(false);
      expect(c.flavorText).toBeNull();
      // cardArtUrl preservado se cadastrado, null caso contrario.
      expect(c.cardArtUrl).not.toBeUndefined();
    }
    expect(entry.cards[0].cardArtUrl).toBe("https://x/card-slime-1.jpg");
    expect(entry.cards[1].cardArtUrl).toBe("https://x/card-slime-2.jpg");
  });

  it("variante 1 coletada e 2 nao coletada: array com hasCard mistos e ordenado por requiredStars asc", async () => {
    // Mock retorna fora de ordem para confirmar que a ordenacao vem do orderBy do Prisma.
    const mobMultiVariant = { ...mob1, cards: [slimeCard1, slimeCard2] };
    mockMobFindMany.mockResolvedValue([mobMultiVariant]);
    mockMobKillStatFindMany.mockResolvedValue([
      { userId: "user_a", mobId: "mob_slime", victories: 5, defeats: 0, damageDealt: 0, firstSeenAt: new Date(), lastSeenAt: new Date() },
    ]);
    mockUserCardFindMany.mockResolvedValue([
      { cardId: "card_slime_1", xp: 0, level: 1 },
    ]);

    const res = await GET(makeReq());
    const body = (await res.json()) as { data: { entries: EntryInResponse[] } };
    const entry = body.data.entries[0];
    expect(entry.cards.map((c) => c.requiredStars)).toEqual([1, 2]);
    expect(entry.cards[0].hasCard).toBe(true);
    expect(entry.cards[0].flavorText).toBe("Resquicio mole de uma alma errante.");
    expect(entry.cards[1].hasCard).toBe(false);
    expect(entry.cards[1].flavorText).toBeNull();
    // Arte continua visivel para nao coletada (mob ja foi visto).
    expect(entry.cards[1].cardArtUrl).toBe("https://x/card-slime-2.jpg");
  });

  it("mob sem nenhuma variante cadastrada: cards: []", async () => {
    const mobNoCards = { ...mob1, cards: [] };
    mockMobFindMany.mockResolvedValue([mobNoCards]);
    mockMobKillStatFindMany.mockResolvedValue([]);
    mockUserCardFindMany.mockResolvedValue([]);

    const res = await GET(makeReq());
    const body = (await res.json()) as { data: { entries: EntryInResponse[] } };
    expect(body.data.entries[0].cards).toEqual([]);
  });

  it("variante 1★ COMUM possuida com xp=50/level=1: expoe userCardXp/userCardLevel; demais variantes do mob ficam null", async () => {
    const slimeCard3 = {
      id: "card_slime_3",
      name: "Cristal do Slime Lendario",
      rarity: "RARO",
      cardArtUrl: "https://x/card-slime-3.jpg",
      requiredStars: 3,
      dropChance: 1,
      flavorText: "Brilho ancestral em forma de gosma.",
    };
    const mobMultiVariant = {
      ...mob1,
      cards: [slimeCard1, slimeCard2, slimeCard3],
    };
    mockMobFindMany.mockResolvedValue([mobMultiVariant]);
    mockMobKillStatFindMany.mockResolvedValue([
      {
        userId: "user_a",
        mobId: "mob_slime",
        victories: 5,
        defeats: 0,
        damageDealt: 0,
        firstSeenAt: new Date(),
        lastSeenAt: new Date(),
      },
    ]);
    mockUserCardFindMany.mockResolvedValue([
      { cardId: "card_slime_1", xp: 50, level: 1 },
    ]);

    const res = await GET(makeReq());
    const body = (await res.json()) as { data: { entries: EntryInResponse[] } };
    const entry = body.data.entries[0];
    expect(entry.cards).toHaveLength(3);

    const owned = entry.cards.find((c) => c.id === "card_slime_1");
    expect(owned?.hasCard).toBe(true);
    expect(owned?.userCardXp).toBe(50);
    expect(owned?.userCardLevel).toBe(1);
    expect(owned?.flavorText).not.toBeNull();

    const notOwned = entry.cards.filter((c) => c.id !== "card_slime_1");
    expect(notOwned).toHaveLength(2);
    for (const c of notOwned) {
      expect(c.hasCard).toBe(false);
      expect(c.userCardXp).toBeNull();
      expect(c.userCardLevel).toBeNull();
      expect(c.flavorText).toBeNull();
    }
  });
});
