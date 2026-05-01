// lib/cards/__tests__/drop.test.ts
//
// Cobre os cenarios de drop de cristais com a nova API multi-variante:
//   - Drop em VICTORY com uma unica variante elegivel.
//   - Filtragem por encounterStars (variantes com requiredStars maior nao caem
//     em encontros de menor estrela).
//   - Ordem de avaliacao decrescente por requiredStars (raras primeiro).
//   - DEFEAT nunca dropa.
//
// O Prisma e mockado seguindo o padrao de drop-integration.test.ts (objeto plano
// com vi.fn() em cada metodo, cast `prisma as never` na chamada).

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

type FakeUserCard = { id: string; userId: string; cardId: string };

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
          ...data,
        };
        userCardStore.push(created);
        return created;
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
  rarity: "RARO",
  dropChance: 3,
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
    expect(userCard.create).not.toHaveBeenCalled();
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
      // 0.01 * 100 = 1, que e < 0.5? Nao. Mas vamos usar 0.001 para garantir
      // que a 3 estrelas (0.5%) passe no roll.
      randomFn: () => 0.001,
    });

    expect(out.cardDropped?.id).toBe("card_slime_3s");
    expect(out.cardDropped?.requiredStars).toBe(3);
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
    // Em DEFEAT nem o mob e buscado para drop — short circuit antes do findUnique.
    expect(mob.findUnique).not.toHaveBeenCalled();
    expect(userCard.findUnique).not.toHaveBeenCalled();
    expect(userCard.create).not.toHaveBeenCalled();
  });
});
