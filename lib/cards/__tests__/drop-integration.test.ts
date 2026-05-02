// Integracao do helper applyCardDropAndStats com um PrismaClient mockado.
// Cobre os comportamentos exigidos pela Task 3 (versao multi-variante):
//   1. Vitoria PvE incrementa MobKillStat.victories.
//   2. Com randomFn determinist1co, dispara drop e cria UserCard.
//   3. Segunda vitoria contra o mesmo mob converte duplicata em XP/level.
//   4. Derrota incrementa defeats sem dropar.
//
// Migrado de `drop: true/false` (booleano) para `randomFn` (override de RNG):
//   drop=true  -> randomFn = () => 0.01 (sempre passa em dropChance >= ~1%)
//   drop=false -> randomFn = () => 0.99 (nunca passa em dropChance <= 99%)

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
    expect(out.xpGained).toBeNull();
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
    expect(userCardCalls.update).not.toHaveBeenCalled();
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
    expect(out.xpGained).toBeNull();
    expect(userCardCalls.create).toHaveBeenCalledOnce();
    expect(userCardStore).toHaveLength(1);
    expect(userCardStore[0]).toMatchObject({
      userId: "user_1",
      cardId: "card_slime",
    });
  });

  it("segunda vitoria com rng baixo NAO duplica UserCard — converte em XP", async () => {
    const { prisma, userCardStore, userCardCalls } = makePrismaMock({
      mob: SAMPLE_MOB,
      initialUserCard: {
        id: "uc_existing",
        userId: "user_1",
        cardId: "card_slime",
        xp: 0,
        level: 1,
      },
    });

    const out = await applyCardDropAndStats(prisma as never, {
      userId: "user_1",
      mobId: SAMPLE_MOB.id,
      result: "VICTORY",
      damageDealt: 50,
      randomFn: () => 0.01,
    });

    expect(out.cardDropped).toBeNull();
    expect(out.xpGained).not.toBeNull();
    expect(out.xpGained?.card.id).toBe("card_slime");
    expect(out.xpGained?.xp).toBe(XP_PER_DUPLICATE_BY_RARITY.COMUM);
    expect(out.xpGained?.newXp).toBe(50);
    expect(out.xpGained?.newLevel).toBe(1);
    expect(out.xpGained?.leveledUp).toBe(false);

    expect(userCardCalls.create).not.toHaveBeenCalled();
    expect(userCardCalls.update).toHaveBeenCalledOnce();
    expect(userCardCalls.update).toHaveBeenCalledWith({
      where: { id: "uc_existing" },
      data: { xp: 50, level: 1 },
    });
    expect(userCardStore).toHaveLength(1); // continua so com a copia existente
    expect(userCardStore[0]).toMatchObject({
      id: "uc_existing",
      xp: 50,
      level: 1,
    });
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
    expect(out.xpGained).toBeNull();
    const upsertCall = mobKillStatCalls.upsert.mock.calls[0][0];
    expect(upsertCall.create).toMatchObject({
      victories: 0,
      defeats: 1,
      damageDealt: 30,
    });
    expect(upsertCall.update.defeats).toEqual({ increment: 1 });
    expect(upsertCall.update.victories).toEqual({ increment: 0 });
    expect(userCardCalls.create).not.toHaveBeenCalled();
    expect(userCardCalls.update).not.toHaveBeenCalled();
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
    expect(out.xpGained).toBeNull();
    expect(userCardCalls.create).not.toHaveBeenCalled();
    expect(userCardCalls.update).not.toHaveBeenCalled();
  });

  it("usa rng interno (Math.random) e dropa quando randomFn=()=>0", async () => {
    const { prisma } = makePrismaMock({ mob: SAMPLE_MOB });

    const out = await applyCardDropAndStats(prisma as never, {
      userId: "user_1",
      mobId: SAMPLE_MOB.id,
      result: "VICTORY",
      damageDealt: 0,
      randomFn: () => 0,
    });

    expect(out.cardDropped?.id).toBe("card_slime");
    expect(out.xpGained).toBeNull();
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
    expect(out.xpGained).toBeNull();
  });

  it("primeira variante elegivel duplicada vira XP e iter para — variantes menores nao sao tocadas", async () => {
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
      // (ordem decrescente). Como e duplicata, vira XP e iter PARA — a
      // 1 estrela nao deve ser nem consultada via findUnique.
      randomFn: () => 0.01,
    });

    expect(out.cardDropped).toBeNull();
    expect(out.xpGained?.card.id).toBe("card_slime_2s");
    expect(out.xpGained?.xp).toBe(XP_PER_DUPLICATE_BY_RARITY.INCOMUM);

    // findUnique chamado UMA unica vez — apenas para a 2 estrelas.
    expect(userCardCalls.findUnique).toHaveBeenCalledOnce();
    expect(userCardCalls.findUnique).toHaveBeenCalledWith({
      where: {
        userId_cardId: { userId: "user_1", cardId: "card_slime_2s" },
      },
      select: { id: true, xp: true, level: true },
    });

    expect(userCardCalls.update).toHaveBeenCalledOnce();
    expect(userCardCalls.create).not.toHaveBeenCalled();
    expect(userCardStore).toHaveLength(1);
    expect(userCardStore[0]).toMatchObject({
      id: "uc_2s_existing",
      xp: 100,
      level: 2,
    });
  });
});
