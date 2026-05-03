// Integracao do helper applyCardDropAndStats com um PrismaClient mockado.
// Cobre os comportamentos do refator "multiplas copias permitidas":
//   1. Vitoria PvE incrementa MobKillStat.victories.
//   2. Com randomFn determinist1co, dispara drop e cria UserCard.
//   3. Segunda vitoria contra o mesmo mob CRIA outra UserCard (sem unique
//      constraint — multiplas copias sao permitidas).
//   4. Derrota incrementa defeats sem dropar.

import { describe, it, expect, vi } from "vitest";
import { applyCardDropAndStats } from "../drop";

type FakeCard = {
  id: string;
  mobId: string;
  name: string;
  rarity: string;
  dropChance: number;
  requiredStars: number;
};

type FakeUserCard = {
  id: string;
  userId: string;
  cardId: string;
  xp: number;
  level: number;
  purity?: number;
};

function makePrismaMock(opts: {
  mob: { id: string; tier: number; cards: FakeCard[] };
  initialUserCard?: FakeUserCard | null;
  initialUserCards?: FakeUserCard[];
}) {
  const seed: FakeUserCard[] = [];
  if (opts.initialUserCard) seed.push(opts.initialUserCard);
  if (opts.initialUserCards) seed.push(...opts.initialUserCards);
  const userCardStore: FakeUserCard[] = seed;

  const mobKillStatCalls = {
    upsert: vi.fn(),
  };
  const userCardCalls = {
    create: vi.fn(
      async ({ data }: { data: { userId: string; cardId: string; purity?: number } }) => {
        const created: FakeUserCard = {
          id: `uc_${userCardStore.length + 1}`,
          xp: 0,
          level: 1,
          ...data,
        };
        userCardStore.push(created);
        return created;
      },
    ),
  };
  const mobCalls = {
    findUnique: vi.fn(async () => ({ ...opts.mob, name: "Slime" })),
  };
  // spectralDropLog gerado dentro da transacao quando newPurity === 100.
  const spectralDropLogCalls = {
    create: vi.fn(async () => ({ id: "sdl_1" })),
  };

  return {
    prisma: {
      mobKillStat: mobKillStatCalls,
      userCard: userCardCalls,
      mob: mobCalls,
      spectralDropLog: spectralDropLogCalls,
    },
    userCardStore,
    mobKillStatCalls,
    userCardCalls,
    mobCalls,
  };
}

const SLIME_CARD: FakeCard = {
  id: "card_slime",
  mobId: "mob_slime",
  name: "Cristal do Slime",
  rarity: "COMUM",
  // dropChance generoso: rng=0.01 sempre passa, rng=0.99 nunca.
  dropChance: 5,
  requiredStars: 1,
};

const SAMPLE_MOB = {
  id: "mob_slime",
  tier: 1,
  cards: [SLIME_CARD],
};

describe("applyCardDropAndStats (integracao com Prisma mockado)", () => {
  it("vitoria incrementa victories e nao dropa quando rng nao dispara", async () => {
    const { prisma, mobKillStatCalls, userCardCalls } = makePrismaMock({
      mob: SAMPLE_MOB,
    });

    const out = await applyCardDropAndStats(prisma as never, {
      userId: "user_1",
      mobId: SAMPLE_MOB.id,
      result: "VICTORY",
      damageDealt: 250,
      randomFn: () => 0.99, // forcando "nao dropa"
    });

    expect(out.cardDropped).toBeNull();
    expect(mobKillStatCalls.upsert).toHaveBeenCalledOnce();
    const upsertCall = mobKillStatCalls.upsert.mock.calls[0][0];
    expect(upsertCall.create).toMatchObject({
      userId: "user_1",
      mobId: SAMPLE_MOB.id,
      victories: 1,
      defeats: 0,
      damageDealt: 250,
    });
    expect(upsertCall.update.victories).toEqual({ increment: 1 });
    expect(upsertCall.update.defeats).toEqual({ increment: 0 });
    expect(userCardCalls.create).not.toHaveBeenCalled();
  });

  it("vitoria com rng baixo cria UserCard e retorna a Card", async () => {
    const { prisma, userCardStore, userCardCalls } = makePrismaMock({
      mob: SAMPLE_MOB,
    });

    const out = await applyCardDropAndStats(prisma as never, {
      userId: "user_1",
      mobId: SAMPLE_MOB.id,
      result: "VICTORY",
      damageDealt: 100,
      randomFn: () => 0.01,
    });

    expect(out.cardDropped).not.toBeNull();
    expect(out.cardDropped?.id).toBe("card_slime");
    expect(userCardCalls.create).toHaveBeenCalledOnce();
    expect(userCardStore).toHaveLength(1);
    expect(userCardStore[0]).toMatchObject({
      userId: "user_1",
      cardId: "card_slime",
    });
  });

  it("segunda vitoria com rng baixo CRIA outra UserCard (multiplas copias permitidas)", async () => {
    const { prisma, userCardStore, userCardCalls } = makePrismaMock({
      mob: SAMPLE_MOB,
      initialUserCard: {
        id: "uc_existing",
        userId: "user_1",
        cardId: "card_slime",
        xp: 0,
        level: 1,
        purity: 50,
      },
    });

    const out = await applyCardDropAndStats(prisma as never, {
      userId: "user_1",
      mobId: SAMPLE_MOB.id,
      result: "VICTORY",
      damageDealt: 50,
      randomFn: () => 0.01,
    });

    expect(out.cardDropped).not.toBeNull();
    expect(out.cardDropped?.id).toBe("card_slime");
    expect(userCardCalls.create).toHaveBeenCalledOnce();
    // Store agora tem 2 copias do mesmo cardId.
    expect(userCardStore).toHaveLength(2);
    expect(userCardStore.every((u) => u.cardId === "card_slime")).toBe(true);
  });

  it("derrota incrementa defeats e nunca dropa", async () => {
    const { prisma, mobKillStatCalls, userCardCalls } = makePrismaMock({
      mob: SAMPLE_MOB,
    });

    const out = await applyCardDropAndStats(prisma as never, {
      userId: "user_1",
      mobId: SAMPLE_MOB.id,
      result: "DEFEAT",
      damageDealt: 30,
      randomFn: () => 0.01, // mesmo com rng baixo, derrota nao dropa
    });

    expect(out.cardDropped).toBeNull();
    const upsertCall = mobKillStatCalls.upsert.mock.calls[0][0];
    expect(upsertCall.create).toMatchObject({
      victories: 0,
      defeats: 1,
      damageDealt: 30,
    });
    expect(upsertCall.update.defeats).toEqual({ increment: 1 });
    expect(upsertCall.update.victories).toEqual({ increment: 0 });
    expect(userCardCalls.create).not.toHaveBeenCalled();
  });

  it("vitoria contra mob sem Card cadastrada nao quebra (retorna null)", async () => {
    const { prisma, userCardCalls } = makePrismaMock({
      mob: { id: "mob_no_card", tier: 1, cards: [] },
    });

    const out = await applyCardDropAndStats(prisma as never, {
      userId: "user_1",
      mobId: "mob_no_card",
      result: "VICTORY",
      damageDealt: 10,
      randomFn: () => 0.01,
    });

    expect(out.cardDropped).toBeNull();
    expect(userCardCalls.create).not.toHaveBeenCalled();
  });

  it("usa rng interno e dropa quando randomFn=()=>0", async () => {
    const { prisma } = makePrismaMock({ mob: SAMPLE_MOB });

    const out = await applyCardDropAndStats(prisma as never, {
      userId: "user_1",
      mobId: SAMPLE_MOB.id,
      result: "VICTORY",
      damageDealt: 0,
      randomFn: () => 0,
    });

    expect(out.cardDropped?.id).toBe("card_slime");
  });

  it("usa rng interno e nao dropa quando random > rate", async () => {
    const { prisma } = makePrismaMock({ mob: SAMPLE_MOB });

    const out = await applyCardDropAndStats(prisma as never, {
      userId: "user_1",
      mobId: SAMPLE_MOB.id,
      result: "VICTORY",
      damageDealt: 0,
      randomFn: () => 0.99,
    });

    expect(out.cardDropped).toBeNull();
  });

  it("primeira variante elegivel passa: cria UserCard NOVO mesmo se ja existe outra cobre desta variante", async () => {
    const SLIME_2S: FakeCard = {
      id: "card_slime_2s",
      mobId: "mob_slime",
      name: "Cristal do Slime (Heroico)",
      rarity: "INCOMUM",
      dropChance: 50,
      requiredStars: 2,
    };
    const TWO_VARIANTS_MOB = {
      id: "mob_slime",
      tier: 1,
      cards: [SLIME_CARD, SLIME_2S],
    };

    const { prisma, userCardStore, userCardCalls } = makePrismaMock({
      mob: TWO_VARIANTS_MOB,
      initialUserCards: [
        {
          id: "uc_2s_existing",
          userId: "user_1",
          cardId: "card_slime_2s",
          xp: 0,
          level: 1,
          purity: 50,
        },
      ],
    });

    const out = await applyCardDropAndStats(prisma as never, {
      userId: "user_1",
      mobId: TWO_VARIANTS_MOB.id,
      result: "VICTORY",
      damageDealt: 100,
      encounterStars: 2,
      // 0.01 -> 1.0; passa em ambas, mas a 2 estrelas e avaliada primeiro
      // (ordem decrescente). Cria UserCard novo dela.
      randomFn: () => 0.01,
    });

    expect(out.cardDropped?.id).toBe("card_slime_2s");
    expect(userCardCalls.create).toHaveBeenCalledOnce();
    expect(userCardStore).toHaveLength(2);
    expect(userCardStore.map((u) => u.cardId).sort()).toEqual([
      "card_slime_2s",
      "card_slime_2s",
    ]);
  });
});
