// Testes de integracao para POST /api/cards/equip e POST /api/cards/unequip.
// Mockam prisma e auth para isolar a logica do route handler.

import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ---------------------------------------------------------------------------
// Mocks (declarados antes dos imports da rota)
// ---------------------------------------------------------------------------

const mockFindUnique = vi.fn();
const mockUpdateMany = vi.fn();
const mockUpdate = vi.fn();
const mockTx = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    userCard: {
      findUnique: (...args: unknown[]) => mockFindUnique(...args),
      updateMany: (...args: unknown[]) => mockUpdateMany(...args),
      update: (...args: unknown[]) => mockUpdate(...args),
    },
    $transaction: (fn: unknown) => mockTx(fn),
  },
}));

vi.mock("@/lib/auth/verify-session", async () => {
  const actual = await vi.importActual<typeof import("@/lib/auth/verify-session")>("@/lib/auth/verify-session");
  return {
    ...actual,
    verifySession: vi.fn(),
  };
});

vi.mock("@/lib/battle/pve-store", () => ({
  hasActiveBattle: vi.fn().mockReturnValue(null),
}));

// ---------------------------------------------------------------------------
// Imports apos mocks
// ---------------------------------------------------------------------------

import { POST as POST_EQUIP } from "../equip/route";
import { POST as POST_UNEQUIP } from "../unequip/route";
import { verifySession } from "@/lib/auth/verify-session";

const mockedVerifySession = vi.mocked(verifySession);

function makeReq(path: string, body: unknown): NextRequest {
  return new NextRequest(`http://localhost:3000/api/cards/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/cards/equip", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockTx.mockImplementation(async (fn: (tx: unknown) => unknown) => {
      // simula o callback recebendo um tx que delega para os mocks
      const tx = {
        userCard: {
          updateMany: mockUpdateMany,
          update: mockUpdate,
        },
      };
      return fn(tx);
    });
  });

  it("retorna 422 com payload invalido (slotIndex fora de 0-2)", async () => {
    mockedVerifySession.mockResolvedValue({ userId: "user_a" });

    const res = await POST_EQUIP(makeReq("equip", { userCardId: "uc_1", slotIndex: 5 }));
    expect(res.status).toBe(422);
  });

  it("retorna 422 sem userCardId", async () => {
    mockedVerifySession.mockResolvedValue({ userId: "user_a" });

    const res = await POST_EQUIP(makeReq("equip", { slotIndex: 0 }));
    expect(res.status).toBe(422);
  });

  it("retorna 404 quando userCardId nao existe", async () => {
    mockedVerifySession.mockResolvedValue({ userId: "user_a" });
    mockFindUnique.mockResolvedValue(null);

    const res = await POST_EQUIP(makeReq("equip", { userCardId: "uc_missing", slotIndex: 0 }));
    expect(res.status).toBe(404);
  });

  it("retorna 403 quando a carta pertence a outro usuario", async () => {
    mockedVerifySession.mockResolvedValue({ userId: "user_a" });
    mockFindUnique.mockResolvedValue({
      id: "uc_b",
      userId: "user_b",
      equipped: false,
      slotIndex: null,
    });

    const res = await POST_EQUIP(makeReq("equip", { userCardId: "uc_b", slotIndex: 0 }));
    expect(res.status).toBe(403);
    const body = (await res.json()) as { error: string };
    expect(body.error).toContain("nao pertence a voce");
  });

  it("equipa carta no slot 0 quando ele esta vazio", async () => {
    mockedVerifySession.mockResolvedValue({ userId: "user_a" });
    mockFindUnique.mockResolvedValue({
      id: "uc_a",
      userId: "user_a",
      equipped: false,
      slotIndex: null,
    });
    mockUpdateMany.mockResolvedValue({ count: 0 });
    mockUpdate.mockResolvedValue({});

    const res = await POST_EQUIP(makeReq("equip", { userCardId: "uc_a", slotIndex: 0 }));
    expect(res.status).toBe(200);
    expect(mockUpdateMany).toHaveBeenCalledWith({
      where: { userId: "user_a", slotIndex: 0 },
      data: { equipped: false, slotIndex: null },
    });
    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: "uc_a" },
      data: { equipped: true, slotIndex: 0 },
    });
  });

  it("equipar slot 0 ja ocupado desequipa a carta anterior", async () => {
    mockedVerifySession.mockResolvedValue({ userId: "user_a" });
    mockFindUnique.mockResolvedValue({
      id: "uc_new",
      userId: "user_a",
      equipped: false,
      slotIndex: null,
    });
    mockUpdateMany.mockResolvedValue({ count: 1 }); // havia uma carta no slot
    mockUpdate.mockResolvedValue({});

    const res = await POST_EQUIP(makeReq("equip", { userCardId: "uc_new", slotIndex: 0 }));
    expect(res.status).toBe(200);
    // updateMany rodou primeiro com slotIndex 0 -> liberou o slot
    expect(mockUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: "user_a", slotIndex: 0 } }),
    );
    // depois equipou a nova
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "uc_new" },
        data: { equipped: true, slotIndex: 0 },
      }),
    );
  });

  it("re-equipar carta movendo de slot 1 para slot 2 desequipa do slot anterior", async () => {
    mockedVerifySession.mockResolvedValue({ userId: "user_a" });
    mockFindUnique.mockResolvedValue({
      id: "uc_x",
      userId: "user_a",
      equipped: true,
      slotIndex: 1,
    });
    mockUpdateMany.mockResolvedValue({ count: 0 });
    mockUpdate.mockResolvedValue({});

    const res = await POST_EQUIP(makeReq("equip", { userCardId: "uc_x", slotIndex: 2 }));
    expect(res.status).toBe(200);
    // 2 update calls: 1) desequipar do slot 1, 2) equipar no slot 2
    expect(mockUpdate).toHaveBeenCalledTimes(2);
    expect(mockUpdate.mock.calls[0][0]).toMatchObject({
      where: { id: "uc_x" },
      data: { equipped: false, slotIndex: null },
    });
    expect(mockUpdate.mock.calls[1][0]).toMatchObject({
      where: { id: "uc_x" },
      data: { equipped: true, slotIndex: 2 },
    });
  });
});

describe("POST /api/cards/unequip", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("retorna 422 com slotIndex invalido", async () => {
    mockedVerifySession.mockResolvedValue({ userId: "user_a" });

    const res = await POST_UNEQUIP(makeReq("unequip", { slotIndex: 7 }));
    expect(res.status).toBe(422);
  });

  it("desequipa quando ha carta no slot", async () => {
    mockedVerifySession.mockResolvedValue({ userId: "user_a" });
    mockUpdateMany.mockResolvedValue({ count: 1 });

    const res = await POST_UNEQUIP(makeReq("unequip", { slotIndex: 1 }));
    expect(res.status).toBe(200);
    expect(mockUpdateMany).toHaveBeenCalledWith({
      where: { userId: "user_a", slotIndex: 1 },
      data: { equipped: false, slotIndex: null },
    });
  });

  it("retorna 200 mesmo se o slot ja esta vazio (no-op)", async () => {
    mockedVerifySession.mockResolvedValue({ userId: "user_a" });
    mockUpdateMany.mockResolvedValue({ count: 0 });

    const res = await POST_UNEQUIP(makeReq("unequip", { slotIndex: 2 }));
    expect(res.status).toBe(200);
  });
});
