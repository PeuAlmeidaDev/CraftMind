// Integracao do helper applyCardDropAndStats com um PrismaClient mockado.
// Cobre os comportamentos exigidos pela Task 3 do plano:
//   1. Vitoria PvE incrementa MobKillStat.victories.
//   2. Com Math.random mocado, dispara drop e cria UserCard.
//   3. Segunda vitoria contra o mesmo mob NAO duplica drop.
//   4. Derrota incrementa defeats sem dropar.

import { describe, it, expect, vi } from "vitest";
import { applyCardDropAndStats } from "../drop";

type FakeUserCard = { id: string; userId: string; cardId: string };

function makePrismaMock(opts: {
  mob: { id: string; tier: number; card: { id: string; name: string; rarity: string; mobId: string } | null };
  initialUserCard?: FakeUserCard | null;
}) {
  const userCardStore: FakeUserCard[] = opts.initialUserCard ? [opts.initialUserCard] : [];
  const mobKillStatCalls = {
    upsert: vi.fn(),
  };
  const userCardCalls = {
    findUnique: vi.fn(async ({ where }: { where: { userId_cardId: { userId: string; cardId: string } } }) => {
      const { userId, cardId } = where.userId_cardId;
      return userCardStore.find((u) => u.userId === userId && u.cardId === cardId) ?? null;
    }),
    create: vi.fn(async ({ data }: { data: { userId: string; cardId: string } }) => {
      const created: FakeUserCard = { id: `uc_${userCardStore.length + 1}`, ...data };
      userCardStore.push(created);
      return created;
    }),
  };
  const mobCalls = {
    findUnique: vi.fn(async () => opts.mob),
  };

  return {
    prisma: {
      mobKillStat: mobKillStatCalls,
      userCard: userCardCalls,
      mob: mobCalls,
    },
    userCardStore,
    mobKillStatCalls,
    userCardCalls,
    mobCalls,
  };
}

const SAMPLE_MOB = {
  id: "mob_slime",
  tier: 1,
  card: {
    id: "card_slime",
    name: "Cristal do Slime",
    rarity: "COMUM",
    mobId: "mob_slime",
  },
};

describe("applyCardDropAndStats (integracao com Prisma mockado)", () => {
  it("vitoria incrementa victories e nao dropa quando rng nao dispara", async () => {
    const { prisma, mobKillStatCalls, userCardCalls } = makePrismaMock({ mob: SAMPLE_MOB });

    const out = await applyCardDropAndStats(prisma as never, {
      userId: "user_1",
      mobId: SAMPLE_MOB.id,
      result: "VICTORY",
      damageDealt: 250,
      drop: false, // forcando rng = false
    });

    expect(out.cardDropped).toBeNull();
    expect(mobKillStatCalls.upsert).toHaveBeenCalledOnce();
    const upsertCall = mobKillStatCalls.upsert.mock.calls[0][0];
    expect(upsertCall.create).toMatchObject({ userId: "user_1", mobId: SAMPLE_MOB.id, victories: 1, defeats: 0, damageDealt: 250 });
    expect(upsertCall.update.victories).toEqual({ increment: 1 });
    expect(upsertCall.update.defeats).toEqual({ increment: 0 });
    expect(userCardCalls.create).not.toHaveBeenCalled();
  });

  it("vitoria com drop=true cria UserCard e retorna a Card", async () => {
    const { prisma, userCardStore, userCardCalls } = makePrismaMock({ mob: SAMPLE_MOB });

    const out = await applyCardDropAndStats(prisma as never, {
      userId: "user_1",
      mobId: SAMPLE_MOB.id,
      result: "VICTORY",
      damageDealt: 100,
      drop: true,
    });

    expect(out.cardDropped).not.toBeNull();
    expect(out.cardDropped?.id).toBe("card_slime");
    expect(userCardCalls.create).toHaveBeenCalledOnce();
    expect(userCardStore).toHaveLength(1);
    expect(userCardStore[0]).toMatchObject({ userId: "user_1", cardId: "card_slime" });
  });

  it("segunda vitoria com drop=true NAO duplica UserCard", async () => {
    const { prisma, userCardStore, userCardCalls } = makePrismaMock({
      mob: SAMPLE_MOB,
      initialUserCard: { id: "uc_existing", userId: "user_1", cardId: "card_slime" },
    });

    const out = await applyCardDropAndStats(prisma as never, {
      userId: "user_1",
      mobId: SAMPLE_MOB.id,
      result: "VICTORY",
      damageDealt: 50,
      drop: true,
    });

    expect(out.cardDropped).toBeNull();
    expect(userCardCalls.create).not.toHaveBeenCalled();
    expect(userCardStore).toHaveLength(1); // continua so com a copia existente
  });

  it("derrota incrementa defeats e nunca dropa", async () => {
    const { prisma, mobKillStatCalls, userCardCalls } = makePrismaMock({ mob: SAMPLE_MOB });

    const out = await applyCardDropAndStats(prisma as never, {
      userId: "user_1",
      mobId: SAMPLE_MOB.id,
      result: "DEFEAT",
      damageDealt: 30,
      drop: true, // mesmo com drop=true em DEFEAT, nao deve dropar
    });

    expect(out.cardDropped).toBeNull();
    const upsertCall = mobKillStatCalls.upsert.mock.calls[0][0];
    expect(upsertCall.create).toMatchObject({ victories: 0, defeats: 1, damageDealt: 30 });
    expect(upsertCall.update.defeats).toEqual({ increment: 1 });
    expect(upsertCall.update.victories).toEqual({ increment: 0 });
    expect(userCardCalls.create).not.toHaveBeenCalled();
  });

  it("vitoria contra mob sem Card cadastrada nao quebra (retorna null)", async () => {
    const { prisma, userCardCalls } = makePrismaMock({
      mob: { id: "mob_no_card", tier: 1, card: null },
    });

    const out = await applyCardDropAndStats(prisma as never, {
      userId: "user_1",
      mobId: "mob_no_card",
      result: "VICTORY",
      damageDealt: 10,
      drop: true,
    });

    expect(out.cardDropped).toBeNull();
    expect(userCardCalls.create).not.toHaveBeenCalled();
  });

  it("usa rollCardDrop interno quando `drop` nao e fornecido", async () => {
    // Mob tier 1 = 30%. Com randomFn = () => 0, sempre dropa.
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

  it("usa rollCardDrop interno e nao dropa quando random > rate", async () => {
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
});
