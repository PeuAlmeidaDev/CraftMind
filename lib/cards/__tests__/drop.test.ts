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
// Fase 2 — Espectral:
//   - UserCard NOVO com purity 100: grava SpectralDropLog na MESMA transacao
//     e retorna spectralDrop populado.
//   - UserCard NOVO com purity < 100: nao grava SpectralDropLog; spectralDrop=null.
//   - dispatchSpectralBroadcast: chama broadcastGlobal com payload correto;
//     fire-and-forget swallows erro de broadcast.
//
// O Prisma e mockado com objeto plano (vi.fn() em cada metodo) e cast
// `prisma as never` na chamada. Para tests de dispatchSpectralBroadcast,
// `@/lib/prisma` e `@/lib/socket-emitter` sao mockados via vi.mock no topo.

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// vi.mock precisa estar antes do import dinamico/static do modulo testado.
// Esses mocks afetam APENAS dispatchSpectralBroadcast — applyCardDropAndStats
// recebe seu proprio `client` por parametro e nao toca a singleton @/lib/prisma.
const mockUserFindUnique = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: (...args: unknown[]) => mockUserFindUnique(...args),
    },
  },
}));

const mockBroadcastGlobal = vi.fn();
vi.mock("@/lib/socket-emitter", () => ({
  broadcastGlobal: (...args: unknown[]) => mockBroadcastGlobal(...args),
  emitToUser: vi.fn(),
}));

import { applyCardDropAndStats, dispatchSpectralBroadcast } from "../drop";
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
  purity?: number;
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
    findUnique: vi.fn(async () => ({ ...opts.mob, name: "Slime" })),
  };

  // Fase 2: spectralDropLog e criado dentro da transacao quando newPurity === 100.
  const spectralDropLog = {
    create: vi.fn(async () => ({ id: "sdl_1" })),
  };

  // Fase 2: pendingCardDuplicate.create usado no fluxo de duplicata melhor.
  const pendingCardDuplicate = {
    create: vi.fn(async () => ({ id: "pend_1" })),
  };

  return {
    prisma: {
      mobKillStat,
      userCard,
      mob,
      spectralDropLog,
      pendingCardDuplicate,
    },
    userCardStore,
    mobKillStat,
    userCard,
    mob,
    spectralDropLog,
    pendingCardDuplicate,
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
      select: { id: true, xp: true, level: true, purity: true },
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

// ---------------------------------------------------------------------------
// Fase 2 — Espectral (purity === 100)
// ---------------------------------------------------------------------------

/**
 * RNG sequencial helper. Consome valores na ordem fornecida; quando esgota,
 * lanca para nao mascarar bugs (chamada inesperada ao rng).
 */
function seqRng(values: number[]): () => number {
  let i = 0;
  return () => {
    if (i >= values.length) {
      throw new Error(`seqRng: chamadas alem do esperado (idx=${i})`);
    }
    return values[i++];
  };
}

describe("applyCardDropAndStats — Fase 2 Espectral (purity === 100)", () => {
  // Sequencia de rng para forcar drop+purity=100:
  //   [0] check de dropChance: 0.001*100 = 0.1, passa em SLIME_1S (8%)
  //   [1] rollPurity bucket: 0.001 < 0.005 -> bucket 100..100
  //   [2] rollPurity valor:  0.001 -> 100 + floor(0.001*1) = 100
  const RNG_SPECTRAL = (): (() => number) => seqRng([0.001, 0.001, 0.001]);

  // Sequencia de rng para forcar drop+purity=55 (baseline-ish, NAO espectral):
  //   [0] check: 0.01*100 = 1, passa em SLIME_1S (8%)
  //   [1] bucket: 0.5 -> bucket 40..69 (cumulative 0.92)
  //   [2] valor: 0.5 -> 40 + floor(0.5*30) = 55
  const RNG_NORMAL_55 = (): (() => number) => seqRng([0.01, 0.5, 0.5]);

  it("UserCard NOVO com purity 100 grava SpectralDropLog na MESMA transacao", async () => {
    const { prisma, userCard, spectralDropLog, userCardStore } = makePrismaMock({
      mob: { id: "mob_slime", tier: 1, cards: [SLIME_1S] },
    });

    const out = await applyCardDropAndStats(prisma as never, {
      userId: "user_1",
      mobId: "mob_slime",
      result: "VICTORY",
      damageDealt: 100,
      randomFn: RNG_SPECTRAL(),
    });

    expect(out.cardDropped).not.toBeNull();
    expect(out.cardDropped?.purity).toBe(100);

    // SpectralDropLog DEVE ser criado na mesma transacao (mesmo prisma client).
    expect(spectralDropLog.create).toHaveBeenCalledOnce();
    const logCall = spectralDropLog.create.mock.calls[0][0] as {
      data: { userId: string; userCardId: string };
    };
    expect(logCall.data.userId).toBe("user_1");
    expect(logCall.data.userCardId).toBe(userCardStore[0].id);

    // E DEVE preceder o retorno (foi chamado antes do final do create).
    expect(userCard.create).toHaveBeenCalledOnce();
  });

  it("retorno inclui spectralDrop com userCardId, cardName e mobName", async () => {
    const { prisma, userCardStore } = makePrismaMock({
      mob: { id: "mob_slime", tier: 1, cards: [SLIME_1S] },
    });

    const out = await applyCardDropAndStats(prisma as never, {
      userId: "user_1",
      mobId: "mob_slime",
      result: "VICTORY",
      damageDealt: 50,
      randomFn: RNG_SPECTRAL(),
    });

    expect(out.spectralDrop).not.toBeNull();
    expect(out.spectralDrop?.userCardId).toBe(userCardStore[0].id);
    expect(out.spectralDrop?.cardName).toBe("Cristal do Slime (Comum)");
    // makePrismaMock fixa mob.name = "Slime"
    expect(out.spectralDrop?.mobName).toBe("Slime");
  });

  it("UserCard NOVO com purity < 100 NAO cria SpectralDropLog", async () => {
    const { prisma, spectralDropLog, userCardStore } = makePrismaMock({
      mob: { id: "mob_slime", tier: 1, cards: [SLIME_1S] },
    });

    const out = await applyCardDropAndStats(prisma as never, {
      userId: "user_1",
      mobId: "mob_slime",
      result: "VICTORY",
      damageDealt: 100,
      randomFn: RNG_NORMAL_55(),
    });

    expect(out.cardDropped).not.toBeNull();
    expect(out.cardDropped?.purity).toBe(55);
    expect(spectralDropLog.create).not.toHaveBeenCalled();
    expect(out.spectralDrop).toBeNull();
    expect(userCardStore[0].purity).toBe(55);
  });

  it("UserCard que NAO dropa nao mexe em SpectralDropLog", async () => {
    const { prisma, spectralDropLog } = makePrismaMock({
      mob: { id: "mob_slime", tier: 1, cards: [SLIME_1S] },
    });

    const out = await applyCardDropAndStats(prisma as never, {
      userId: "user_1",
      mobId: "mob_slime",
      result: "VICTORY",
      damageDealt: 100,
      // 0.99 > 0.08 -> nao passa no roll
      randomFn: () => 0.99,
    });

    expect(out.cardDropped).toBeNull();
    expect(out.spectralDrop).toBeNull();
    expect(spectralDropLog.create).not.toHaveBeenCalled();
  });

  it("DUPLICATA com nova purity 100 NAO cria SpectralDropLog (vai pra PendingCardDuplicate)", async () => {
    // O fluxo: existing.purity=50; nova rola 100 -> 100 > 50 -> cria pending,
    // NAO toca SpectralDropLog (broadcast acontece no resolve REPLACE).
    const { prisma, spectralDropLog, pendingCardDuplicate, userCard } =
      makePrismaMock({
        mob: { id: "mob_slime", tier: 1, cards: [SLIME_1S] },
        initialUserCards: [
          {
            id: "uc_existing",
            userId: "user_1",
            cardId: "card_slime_1s",
            xp: 0,
            level: 1,
            purity: 50,
          },
        ],
      });

    const out = await applyCardDropAndStats(prisma as never, {
      userId: "user_1",
      mobId: "mob_slime",
      result: "VICTORY",
      damageDealt: 100,
      randomFn: RNG_SPECTRAL(),
    });

    expect(out.pendingDuplicate).not.toBeNull();
    expect(out.pendingDuplicate?.newPurity).toBe(100);
    expect(out.cardDropped).toBeNull();
    expect(out.spectralDrop).toBeNull();
    expect(spectralDropLog.create).not.toHaveBeenCalled();
    expect(pendingCardDuplicate.create).toHaveBeenCalledOnce();
    expect(userCard.create).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// dispatchSpectralBroadcast — fire-and-forget helper que chama broadcastGlobal
// ---------------------------------------------------------------------------

describe("dispatchSpectralBroadcast", () => {
  beforeEach(() => {
    mockUserFindUnique.mockReset();
    mockBroadcastGlobal.mockReset();
  });

  let warnSpy: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
  });
  afterEach(() => {
    warnSpy.mockRestore();
  });

  it("chama broadcastGlobal com payload correto (userId, userName, cardName, mobName)", async () => {
    mockUserFindUnique.mockResolvedValue({ name: "Pedro" });
    mockBroadcastGlobal.mockResolvedValue(undefined);

    await dispatchSpectralBroadcast({
      userId: "user_42",
      spectralDrop: {
        userCardId: "uc_xyz",
        cardName: "Cristal do Slime (Lendario)",
        mobName: "Slime Real",
      },
    });

    expect(mockUserFindUnique).toHaveBeenCalledOnce();
    expect(mockUserFindUnique).toHaveBeenCalledWith({
      where: { id: "user_42" },
      select: { name: true },
    });

    expect(mockBroadcastGlobal).toHaveBeenCalledOnce();
    expect(mockBroadcastGlobal).toHaveBeenCalledWith("global:spectral-drop", {
      userId: "user_42",
      userName: "Pedro",
      cardName: "Cristal do Slime (Lendario)",
      mobName: "Slime Real",
    });
  });

  it("nao chama broadcastGlobal quando user nao existe", async () => {
    mockUserFindUnique.mockResolvedValue(null);

    await dispatchSpectralBroadcast({
      userId: "user_ghost",
      spectralDrop: {
        userCardId: "uc_xyz",
        cardName: "Card",
        mobName: "Mob",
      },
    });

    expect(mockUserFindUnique).toHaveBeenCalledOnce();
    expect(mockBroadcastGlobal).not.toHaveBeenCalled();
  });

  it("se broadcastGlobal falhar, NAO propaga (fire-and-forget) e loga via console.warn", async () => {
    mockUserFindUnique.mockResolvedValue({ name: "Pedro" });
    mockBroadcastGlobal.mockRejectedValue(new Error("network down"));

    await expect(
      dispatchSpectralBroadcast({
        userId: "user_42",
        spectralDrop: {
          userCardId: "uc_xyz",
          cardName: "Card",
          mobName: "Mob",
        },
      }),
    ).resolves.toBeUndefined();

    expect(warnSpy).toHaveBeenCalled();
    const allMsgs = warnSpy.mock.calls.map((c) => String(c[0])).join(" ");
    expect(allMsgs).toContain("dispatchSpectralBroadcast falhou");
  });

  it("se prisma.user.findUnique falhar, NAO propaga e loga via console.warn", async () => {
    mockUserFindUnique.mockRejectedValue(new Error("db down"));

    await expect(
      dispatchSpectralBroadcast({
        userId: "user_42",
        spectralDrop: {
          userCardId: "uc_xyz",
          cardName: "Card",
          mobName: "Mob",
        },
      }),
    ).resolves.toBeUndefined();

    expect(mockBroadcastGlobal).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalled();
  });
});
