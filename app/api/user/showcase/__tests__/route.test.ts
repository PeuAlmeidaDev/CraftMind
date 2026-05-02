// app/api/user/showcase/__tests__/route.test.ts
//
// Cobertura PUT /api/user/showcase:
// - 401 sem auth.
// - 422 com body nao-array.
// - 422 com mais de 6 IDs.
// - 422 quando algum ID nao pertence ao usuario.
// - 200 com IDs validos: upsert + dedup.
// - 200 com lista vazia.

import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockUserCardFindMany = vi.fn();
const mockShowcaseUpsert = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    userCard: {
      findMany: (...args: unknown[]) => mockUserCardFindMany(...args),
    },
    userShowcase: {
      upsert: (...args: unknown[]) => mockShowcaseUpsert(...args),
    },
  },
}));

vi.mock("@/lib/auth/verify-session", async () => {
  const actual = await vi.importActual<typeof import("@/lib/auth/verify-session")>(
    "@/lib/auth/verify-session",
  );
  return {
    ...actual,
    verifySession: vi.fn(),
  };
});

import { PUT } from "../route";
import { verifySession, AuthenticationError } from "@/lib/auth/verify-session";

const mockedVerifySession = vi.mocked(verifySession);

function makeReq(body: unknown): NextRequest {
  return new NextRequest("http://localhost:3000/api/user/showcase", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("PUT /api/user/showcase", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("retorna 401 sem auth", async () => {
    mockedVerifySession.mockRejectedValue(
      new AuthenticationError("Token invalido", "INVALID_TOKEN"),
    );

    const res = await PUT(makeReq({ userCardIds: ["uc_1"] }));
    expect(res.status).toBe(401);
  });

  it("retorna 422 com body nao-array", async () => {
    mockedVerifySession.mockResolvedValue({ userId: "user_a" });

    const res = await PUT(makeReq({ userCardIds: "nope" }));
    expect(res.status).toBe(422);
    const body = (await res.json()) as { code: string };
    expect(body.code).toBe("VALIDATION_ERROR");
  });

  it("retorna 422 com mais de 6 IDs", async () => {
    mockedVerifySession.mockResolvedValue({ userId: "user_a" });

    const res = await PUT(
      makeReq({
        userCardIds: ["a", "b", "c", "d", "e", "f", "g"],
      }),
    );
    expect(res.status).toBe(422);
  });

  it("retorna 422 quando algum ID nao pertence ao usuario", async () => {
    mockedVerifySession.mockResolvedValue({ userId: "user_a" });
    // Apenas 1 dos 2 IDs pertence -> ownership invalida
    mockUserCardFindMany.mockResolvedValue([{ id: "uc_1" }]);

    const res = await PUT(
      makeReq({ userCardIds: ["uc_1", "uc_OUTRO"] }),
    );
    expect(res.status).toBe(422);
    const body = (await res.json()) as { code: string };
    expect(body.code).toBe("INVALID_OWNERSHIP");
    expect(mockShowcaseUpsert).not.toHaveBeenCalled();
  });

  it("retorna 200 com IDs validos e faz upsert", async () => {
    mockedVerifySession.mockResolvedValue({ userId: "user_a" });
    mockUserCardFindMany.mockResolvedValue([
      { id: "uc_1" },
      { id: "uc_2" },
    ]);
    const updatedAt = new Date("2026-05-02T12:00:00.000Z");
    mockShowcaseUpsert.mockResolvedValue({
      userCardIds: ["uc_1", "uc_2"],
      updatedAt,
    });

    const res = await PUT(makeReq({ userCardIds: ["uc_1", "uc_2"] }));
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      data: { userCardIds: string[]; updatedAt: string };
    };
    expect(body.data.userCardIds).toEqual(["uc_1", "uc_2"]);
    expect(body.data.updatedAt).toBe(updatedAt.toISOString());
    expect(mockShowcaseUpsert).toHaveBeenCalledWith({
      where: { userId: "user_a" },
      create: { userId: "user_a", userCardIds: ["uc_1", "uc_2"] },
      update: { userCardIds: ["uc_1", "uc_2"] },
      select: { userCardIds: true, updatedAt: true },
    });
  });

  it("dedup IDs preservando ordem da primeira ocorrencia", async () => {
    mockedVerifySession.mockResolvedValue({ userId: "user_a" });
    mockUserCardFindMany.mockResolvedValue([{ id: "uc_1" }, { id: "uc_2" }]);
    const updatedAt = new Date("2026-05-02T12:00:00.000Z");
    mockShowcaseUpsert.mockResolvedValue({
      userCardIds: ["uc_1", "uc_2"],
      updatedAt,
    });

    const res = await PUT(
      makeReq({ userCardIds: ["uc_1", "uc_2", "uc_1"] }),
    );
    expect(res.status).toBe(200);
    expect(mockShowcaseUpsert.mock.calls[0][0].create.userCardIds).toEqual([
      "uc_1",
      "uc_2",
    ]);
  });

  it("aceita lista vazia (limpa a vitrine)", async () => {
    mockedVerifySession.mockResolvedValue({ userId: "user_a" });
    const updatedAt = new Date("2026-05-02T12:00:00.000Z");
    mockShowcaseUpsert.mockResolvedValue({
      userCardIds: [],
      updatedAt,
    });

    const res = await PUT(makeReq({ userCardIds: [] }));
    expect(res.status).toBe(200);
    // Sem ownership check quando array e vazio.
    expect(mockUserCardFindMany).not.toHaveBeenCalled();
    expect(mockShowcaseUpsert).toHaveBeenCalled();
  });
});
