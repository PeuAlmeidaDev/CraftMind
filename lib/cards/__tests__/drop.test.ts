// lib/cards/__tests__/drop.test.ts
//
// Cobre o helper applyCardDropAndStats apos o refator de "multiplas copias":
//   - Drop em VICTORY com uma unica variante elegivel.
//   - Filtragem por encounterStars (variantes com requiredStars maior nao caem
//     em encontros de menor estrela).
//   - Ordem de avaliacao decrescente por requiredStars (raras primeiro).
//   - DEFEAT nunca dropa.
//   - Cada drop SEMPRE cria UserCard novo, mesmo quando o user ja tem copias
//     do mesmo cardId (sem pendency, sem conversao automatica em XP — a
//     conversao acontece manualmente via /api/cards/[id]/absorb).
//
// Espectral (purity === 100):
//   - UserCard NOVO com purity 100: grava SpectralDropLog na MESMA transacao
//     e retorna spectralDrop populado.
//   - UserCard NOVO com purity < 100: nao grava SpectralDropLog; spectralDrop=null.
//   - dispatchSpectralBroadcast: chama broadcastGlobal com payload correto;
//     fire-and-forget swallows erro de broadcast.

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// vi.mock precisa estar antes do import do modulo testado.
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

  const mob = {
    findUnique: vi.fn(async () => ({ ...opts.mob, name: "Slime" })),
  };

  // spectralDropLog e criado dentro da transacao quando newPurity === 100.
  const spectralDropLog = {
    create: vi.fn(async () => ({ id: "sdl_1" })),
  };

  return {
    prisma: {
      mobKillStat,
      userCard,
      mob,
      spectralDropLog,
    },
    userCardStore,
    mobKillStat,
    userCard,
    mob,
    spectralDropLog,
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
      randomFn: () => 0.001,
    });

    expect(out.cardDropped?.id).toBe("card_slime_3s");
    expect(out.cardDropped?.requiredStars).toBe(3);
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
    expect(mob.findUnique).not.toHaveBeenCalled();
    expect(userCard.create).not.toHaveBeenCalled();
  });
});

describe("applyCardDropAndStats — multiplas copias permitidas", () => {
  it("user ja tem 1 copia: novo drop cria UserCard ADICIONAL (sem pendency)", async () => {
    const { prisma, userCard, userCardStore } = makePrismaMock({
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
      randomFn: () => 0.01,
    });

    // Nova carta criada — alem da existente.
    expect(out.cardDropped?.id).toBe("card_slime_1s");
    expect(userCard.create).toHaveBeenCalledOnce();
    expect(userCardStore).toHaveLength(2);
    // Existing intacta + nova com mesmo cardId.
    expect(userCardStore.map((u) => u.cardId)).toEqual([
      "card_slime_1s",
      "card_slime_1s",
    ]);
  });

  it("user ja tem 5 copias: 6o drop cria a 6a copia normalmente", async () => {
    const initial: FakeUserCard[] = Array.from({ length: 5 }).map((_, i) => ({
      id: `uc_${i}`,
      userId: "user_1",
      cardId: "card_slime_1s",
      xp: 0,
      level: 1,
      purity: 50,
    }));
    const { prisma, userCard, userCardStore } = makePrismaMock({
      mob: { id: "mob_slime", tier: 1, cards: [SLIME_1S] },
      initialUserCards: initial,
    });

    const out = await applyCardDropAndStats(prisma as never, {
      userId: "user_1",
      mobId: "mob_slime",
      result: "VICTORY",
      damageDealt: 100,
      randomFn: () => 0.01,
    });

    expect(out.cardDropped).not.toBeNull();
    expect(userCard.create).toHaveBeenCalledOnce();
    expect(userCardStore).toHaveLength(6);
  });
});

// ---------------------------------------------------------------------------
// Espectral (purity === 100)
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

describe("applyCardDropAndStats — Espectral (purity === 100)", () => {
  // Sequencia de rng para forcar drop+purity=100:
  //   [0] check de dropChance: 0.001*100 = 0.1, passa em SLIME_1S (8%)
  //   [1] rollPurity bucket: 0.001 < 0.005 -> bucket 100..100
  //   [2] rollPurity valor:  0.001 -> 100 + floor(0.001*1) = 100
  const RNG_SPECTRAL = (): (() => number) => seqRng([0.001, 0.001, 0.001]);

  // Sequencia de rng para forcar drop+purity=55 (baseline-ish, NAO espectral)
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

    expect(spectralDropLog.create).toHaveBeenCalledOnce();
    const logCall = spectralDropLog.create.mock.calls[0][0] as {
      data: { userId: string; userCardId: string };
    };
    expect(logCall.data.userId).toBe("user_1");
    expect(logCall.data.userCardId).toBe(userCardStore[0].id);

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
      randomFn: () => 0.99,
    });

    expect(out.cardDropped).toBeNull();
    expect(out.spectralDrop).toBeNull();
    expect(spectralDropLog.create).not.toHaveBeenCalled();
  });

  it("user ja tem copia: drop com purity 100 cria UserCard ESPECTRAL novo + SpectralDropLog", async () => {
    // No novo modelo nao ha mais PendingCardDuplicate. Mesmo que o user ja
    // tenha copias do mesmo cardId, um drop com purity 100 cria UserCard novo
    // e dispara o log/broadcast normalmente.
    const { prisma, spectralDropLog, userCard } = makePrismaMock({
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

    expect(out.cardDropped).not.toBeNull();
    expect(out.cardDropped?.purity).toBe(100);
    expect(out.spectralDrop).not.toBeNull();
    expect(spectralDropLog.create).toHaveBeenCalledOnce();
    expect(userCard.create).toHaveBeenCalledOnce();
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
