// lib/cards/__tests__/drop.test.ts
//
// Cobre os cenarios de drop de cristais com a API multi-variante e a politica
// de duplicata-vira-XP:
//   - Drop em VICTORY com uma unica variante elegivel.
//   - Filtragem por encounterStars (variantes com requiredStars maior nao caem
//     em encontros de menor estrela).
//   - Ordem de avaliacao decrescente por requiredStars (raras primeiro).
//   - DEFEAT nunca dropa.
//   - Duplicata: a primeira variante que passa no roll, se ja pertence ao user,
//     e convertida em XP/level no UserCard existente e a iteracao para.
//
// O Prisma e mockado com objeto plano (vi.fn() em cada metodo) e cast
// `prisma as never` na chamada.

import { describe, it, expect, vi } from "vitest";
import { applyCardDropAndStats } from "../drop";
import { XP_PER_DUPLICATE_BY_RARITY } from "../level";

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
};

function makePrismaMock(opts: {
  mob: { id: string; tier: number; cards: FakeCard[] };
  initialUserCards?: FakeUserCard[];
}) {
  const userCardStore: FakeUserCard[] = opts.initialUserCards
    ? [...opts.initialUserCards]
    : [];

  const mobKillStat = {
    upsert: vi.fn(async () => undefined),
  };

  const userCard = {
    findUnique: vi.fn(
      async ({
        where,
      }: {
        where: { userId_cardId: { userId: string; cardId: string } };
      }) => {
        const { userId, cardId } = where.userId_cardId;
        return (
          userCardStore.find((u) => u.userId === userId && u.cardId === cardId) ??
          null
        );
      },
    ),
    create: vi.fn(
      async ({ data }: { data: { userId: string; cardId: string } }) => {
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
    update: vi.fn(
      async ({
        where,
        data,
      }: {
        where: { id: string };
        data: { xp?: number; level?: number };
      }) => {
        const target = userCardStore.find((u) => u.id === where.id);
        if (!target) {
          throw new Error(`UserCard not found: ${where.id}`);
        }
        if (typeof data.xp === "number") target.xp = data.xp;
        if (typeof data.level === "number") target.level = data.level;
        return target;
      },
    ),
  };

  const mob = {
    findUnique: vi.fn(async () => opts.mob),
  };

  return {
    prisma: { mobKillStat, userCard, mob },
    userCardStore,
    mobKillStat,
    userCard,
    mob,
  };
}

const SLIME_1S: FakeCard = {
  id: "card_slime_1s",
  mobId: "mob_slime",
  name: "Cristal do Slime (Comum)",
  rarity: "COMUM",
  dropChance: 8,
  requiredStars: 1,
};

const SLIME_2S: FakeCard = {
  id: "card_slime_2s",
  mobId: "mob_slime",
  name: "Cristal do Slime (Heroico)",
  rarity: "INCOMUM",
  dropChance: 50,
  requiredStars: 2,
};

const SLIME_3S: FakeCard = {
  id: "card_slime_3s",
  mobId: "mob_slime",
  name: "Cristal do Slime (Lendario)",
  rarity: "LENDARIO",
  dropChance: 0.5,
  requiredStars: 3,
};

describe("applyCardDropAndStats — multi variantes", () => {
  it("VICTORY com 1 variante elegivel e rng=0.01 dropa a card", async () => {
    const { prisma, userCard, userCardStore } = makePrismaMock({
      mob: { id: "mob_slime", tier: 1, cards: [SLIME_1S] },
    });

    const out = await applyCardDropAndStats(prisma as never, {
      userId: "user_1",
      mobId: "mob_slime",
      result: "VICTORY",
      damageDealt: 100,
      randomFn: () => 0.01,
    });

    expect(out.cardDropped?.id).toBe("card_slime_1s");
    expect(out.xpGained).toBeNull();
    expect(userCard.create).toHaveBeenCalledOnce();
    expect(userCardStore).toHaveLength(1);
    expect(userCardStore[0]).toMatchObject({
      userId: "user_1",
      cardId: "card_slime_1s",
    });
  });

  it("VICTORY com 1 variante elegivel e rng=0.99 NAO dropa", async () => {
    const { prisma, userCard } = makePrismaMock({
      mob: { id: "mob_slime", tier: 1, cards: [SLIME_1S] },
    });

    const out = await applyCardDropAndStats(prisma as never, {
      userId: "user_1",
      mobId: "mob_slime",
      result: "VICTORY",
      damageDealt: 100,
      randomFn: () => 0.99,
    });

    expect(out.cardDropped).toBeNull();
    expect(out.xpGained).toBeNull();
    expect(userCard.create).not.toHaveBeenCalled();
    expect(userCard.update).not.toHaveBeenCalled();
  });

  it("VICTORY com 3 variantes, encounterStars=1: apenas a Comum e avaliada", async () => {
    const { prisma, userCard, userCardStore } = makePrismaMock({
      mob: {
        id: "mob_slime",
        tier: 1,
        cards: [SLIME_1S, SLIME_2S, SLIME_3S],
      },
    });

    const out = await applyCardDropAndStats(prisma as never, {
      userId: "user_1",
      mobId: "mob_slime",
      result: "VICTORY",
      damageDealt: 100,
      encounterStars: 1,
      randomFn: () => 0.01,
    });

    // Em encounterStars=1 so a variante 1 estrela e elegivel; ela passa no
    // roll (0.01 * 100 = 1 < 8) e dropa.
    expect(out.cardDropped?.id).toBe("card_slime_1s");
    expect(out.cardDropped?.requiredStars).toBe(1);
    expect(out.xpGained).toBeNull();
    expect(userCard.create).toHaveBeenCalledOnce();
    expect(userCardStore).toHaveLength(1);
    expect(userCardStore[0].cardId).toBe("card_slime_1s");
  });

  it("VICTORY com 3 variantes, encounterStars=3: avalia 3->2->1 e dropa a 3 estrelas", async () => {
    const { prisma, userCard, userCardStore } = makePrismaMock({
      mob: {
        id: "mob_slime",
        tier: 1,
        cards: [SLIME_1S, SLIME_2S, SLIME_3S],
      },
    });

    const out = await applyCardDropAndStats(prisma as never, {
      userId: "user_1",
      mobId: "mob_slime",
      result: "VICTORY",
      damageDealt: 100,
      encounterStars: 3,
      // rng = 0.001 -> 0.1, que e menor que 0.5 (dropChance da 3 estrelas).
      randomFn: () => 0.001,
    });

    expect(out.cardDropped?.id).toBe("card_slime_3s");
    expect(out.cardDropped?.requiredStars).toBe(3);
    expect(out.xpGained).toBeNull();
    // findUnique deve ter sido chamado uma unica vez (apenas a 3 estrelas
    // passou pelo roll e foi avaliada para duplicata).
    expect(userCard.findUnique).toHaveBeenCalledOnce();
    expect(userCard.create).toHaveBeenCalledOnce();
    expect(userCardStore).toHaveLength(1);
    expect(userCardStore[0].cardId).toBe("card_slime_3s");
  });

  it("DEFEAT nunca dropa, mesmo com rng=0", async () => {
    const { prisma, userCard, mob } = makePrismaMock({
      mob: {
        id: "mob_slime",
        tier: 1,
        cards: [SLIME_1S, SLIME_2S, SLIME_3S],
      },
    });

    const out = await applyCardDropAndStats(prisma as never, {
      userId: "user_1",
      mobId: "mob_slime",
      result: "DEFEAT",
      damageDealt: 30,
      encounterStars: 3,
      randomFn: () => 0,
    });

    expect(out.cardDropped).toBeNull();
    expect(out.xpGained).toBeNull();
    // Em DEFEAT nem o mob e buscado para drop — short circuit antes do findUnique.
    expect(mob.findUnique).not.toHaveBeenCalled();
    expect(userCard.findUnique).not.toHaveBeenCalled();
    expect(userCard.create).not.toHaveBeenCalled();
    expect(userCard.update).not.toHaveBeenCalled();
  });
});

describe("applyCardDropAndStats — duplicata vira XP", () => {
  it("variante COMUM duplicada (xp=0/level=1) ganha 50 XP, sem level up", async () => {
    const { prisma, userCard, userCardStore } = makePrismaMock({
      mob: { id: "mob_slime", tier: 1, cards: [SLIME_1S] },
      initialUserCards: [
        {
          id: "uc_existing",
          userId: "user_1",
          cardId: "card_slime_1s",
          xp: 0,
          level: 1,
        },
      ],
    });

    const out = await applyCardDropAndStats(prisma as never, {
      userId: "user_1",
      mobId: "mob_slime",
      result: "VICTORY",
      damageDealt: 100,
      randomFn: () => 0.01, // 1 < 8 -> passa no roll da COMUM
    });

    expect(out.cardDropped).toBeNull();
    expect(out.xpGained).not.toBeNull();
    expect(out.xpGained?.card.id).toBe("card_slime_1s");
    expect(out.xpGained?.xp).toBe(XP_PER_DUPLICATE_BY_RARITY.COMUM);
    expect(out.xpGained?.newXp).toBe(50);
    expect(out.xpGained?.newLevel).toBe(1);
    expect(out.xpGained?.leveledUp).toBe(false);

    expect(userCard.update).toHaveBeenCalledOnce();
    const updateCall = userCard.update.mock.calls[0][0];
    expect(updateCall).toMatchObject({
      where: { id: "uc_existing" },
      data: { xp: 50, level: 1 },
    });
    expect(userCard.create).not.toHaveBeenCalled();

    // Store reflete o update.
    expect(userCardStore[0]).toMatchObject({
      id: "uc_existing",
      xp: 50,
      level: 1,
    });
  });

  it("variante LENDARIO duplicada (xp=0/level=1) ganha 800 XP e sobe para Lv4", async () => {
    const { prisma, userCard, userCardStore } = makePrismaMock({
      mob: { id: "mob_slime", tier: 1, cards: [SLIME_3S] },
      initialUserCards: [
        {
          id: "uc_lendario",
          userId: "user_1",
          cardId: "card_slime_3s",
          xp: 0,
          level: 1,
        },
      ],
    });

    const out = await applyCardDropAndStats(prisma as never, {
      userId: "user_1",
      mobId: "mob_slime",
      result: "VICTORY",
      damageDealt: 200,
      encounterStars: 3,
      // 0.001 -> 0.1 < 0.5 (dropChance da LENDARIA)
      randomFn: () => 0.001,
    });

    expect(out.cardDropped).toBeNull();
    expect(out.xpGained).not.toBeNull();
    expect(out.xpGained?.xp).toBe(XP_PER_DUPLICATE_BY_RARITY.LENDARIO);
    expect(out.xpGained?.newXp).toBe(800);
    expect(out.xpGained?.newLevel).toBe(4);
    expect(out.xpGained?.leveledUp).toBe(true);

    expect(userCard.update).toHaveBeenCalledOnce();
    const updateCall = userCard.update.mock.calls[0][0];
    expect(updateCall).toMatchObject({
      where: { id: "uc_lendario" },
      data: { xp: 800, level: 4 },
    });
    expect(userCardStore[0]).toMatchObject({ xp: 800, level: 4 });
  });

  it("primeira variante elegivel passa no roll e e duplicata: itera para na INCOMUM, nao avalia COMUM", async () => {
    const { prisma, userCard } = makePrismaMock({
      mob: { id: "mob_slime", tier: 1, cards: [SLIME_1S, SLIME_2S] },
      initialUserCards: [
        {
          id: "uc_comum",
          userId: "user_1",
          cardId: "card_slime_1s",
          xp: 0,
          level: 1,
        },
        {
          id: "uc_incomum",
          userId: "user_1",
          cardId: "card_slime_2s",
          xp: 0,
          level: 1,
        },
      ],
    });

    const out = await applyCardDropAndStats(prisma as never, {
      userId: "user_1",
      mobId: "mob_slime",
      result: "VICTORY",
      damageDealt: 100,
      encounterStars: 2,
      // 0.01 -> 1.0; passa em ambas (8% e 50%), mas a INCOMUM e avaliada
      // primeiro (ordem decrescente de stars).
      randomFn: () => 0.01,
    });

    expect(out.cardDropped).toBeNull();
    expect(out.xpGained?.card.id).toBe("card_slime_2s");
    expect(out.xpGained?.xp).toBe(XP_PER_DUPLICATE_BY_RARITY.INCOMUM);
    expect(out.xpGained?.newXp).toBe(100);
    expect(out.xpGained?.newLevel).toBe(2);
    expect(out.xpGained?.leveledUp).toBe(true);

    // findUnique chamado UMA vez — apenas para a 2 estrelas, nao para a 1
    // estrela (iteracao parou na primeira variante que passou no roll).
    expect(userCard.findUnique).toHaveBeenCalledOnce();
    expect(userCard.findUnique).toHaveBeenCalledWith({
      where: { userId_cardId: { userId: "user_1", cardId: "card_slime_2s" } },
      select: { id: true, xp: true, level: true },
    });
    expect(userCard.update).toHaveBeenCalledOnce();
    expect(userCard.create).not.toHaveBeenCalled();
  });

  it("primeira variante elegivel passa no roll e nao e duplicata: cria UserCard normalmente", async () => {
    const { prisma, userCard, userCardStore } = makePrismaMock({
      mob: { id: "mob_slime", tier: 1, cards: [SLIME_1S, SLIME_2S] },
      initialUserCards: [
        {
          id: "uc_comum",
          userId: "user_1",
          cardId: "card_slime_1s",
          xp: 0,
          level: 1,
        },
      ],
    });

    const out = await applyCardDropAndStats(prisma as never, {
      userId: "user_1",
      mobId: "mob_slime",
      result: "VICTORY",
      damageDealt: 100,
      encounterStars: 2,
      randomFn: () => 0.01, // passa em ambas, INCOMUM avaliada primeiro
    });

    expect(out.cardDropped?.id).toBe("card_slime_2s");
    expect(out.xpGained).toBeNull();
    expect(userCard.create).toHaveBeenCalledOnce();
    expect(userCard.update).not.toHaveBeenCalled();
    // Store: uc_comum existente + novo uc_2 da INCOMUM.
    expect(userCardStore.map((u) => u.cardId).sort()).toEqual([
      "card_slime_1s",
      "card_slime_2s",
    ]);
  });
});
