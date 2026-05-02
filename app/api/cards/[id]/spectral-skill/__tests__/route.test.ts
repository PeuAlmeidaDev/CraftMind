// app/api/cards/[id]/spectral-skill/__tests__/route.test.ts
//
// Cobre PUT /api/cards/[id]/spectral-skill em todos os edge cases:
//   - 401 sem auth
//   - 422 body invalido (skillId ausente / nao-string)
//   - 404 UserCard nao existe
//   - 403 ownership invalida
//   - 422 purity != 100
//   - 422 skillId nao pertence aos mob skills do mob de origem
//   - 200 happy path

import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ---------------------------------------------------------------------------
// Mocks (declarados antes dos imports da rota)
// ---------------------------------------------------------------------------

const mockUserCardFindUnique = vi.fn();
const mockUserCardUpdate = vi.fn();
const mockMobSkillFindFirst = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    userCard: {
      findUnique: (...args: unknown[]) => mockUserCardFindUnique(...args),
      update: (...args: unknown[]) => mockUserCardUpdate(...args),
    },
    mobSkill: {
      findFirst: (...args: unknown[]) => mockMobSkillFindFirst(...args),
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

import { GET, PUT } from "../route";
import { verifySession, AuthenticationError } from "@/lib/auth/verify-session";

const mockedVerifySession = vi.mocked(verifySession);

function makeReq(userCardId: string, body: unknown): NextRequest {
  return new NextRequest(
    `http://localhost:3000/api/cards/${userCardId}/spectral-skill`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  );
}

function makeGetReq(userCardId: string): NextRequest {
  return new NextRequest(
    `http://localhost:3000/api/cards/${userCardId}/spectral-skill`,
    { method: "GET" },
  );
}

function makeContext(id: string) {
  return { params: Promise.resolve({ id }) };
}

// cuid valido para skill (precisa passar no z.string().cuid())
const VALID_SKILL_ID = "ckabc1234567890123456789a"; // 25 chars, formato cuid v1
const VALID_USERCARD_ID = "ckusrcard0000000000000001";

describe("PUT /api/cards/[id]/spectral-skill", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedVerifySession.mockReset();
    mockUserCardFindUnique.mockReset();
    mockUserCardUpdate.mockReset();
    mockMobSkillFindFirst.mockReset();
  });

  it("retorna 401 sem autenticacao", async () => {
    mockedVerifySession.mockRejectedValue(
      new AuthenticationError("Token ausente", "UNAUTHENTICATED", 401),
    );

    const res = await PUT(
      makeReq(VALID_USERCARD_ID, { skillId: VALID_SKILL_ID }),
      makeContext(VALID_USERCARD_ID),
    );
    expect(res.status).toBe(401);
  });

  it("retorna 422 com body sem skillId", async () => {
    mockedVerifySession.mockResolvedValue({ userId: "user-1" });
    const res = await PUT(makeReq(VALID_USERCARD_ID, {}), makeContext(VALID_USERCARD_ID));
    expect(res.status).toBe(422);
  });

  it("retorna 422 com skillId nao-cuid", async () => {
    mockedVerifySession.mockResolvedValue({ userId: "user-1" });
    const res = await PUT(
      makeReq(VALID_USERCARD_ID, { skillId: "not-a-cuid" }),
      makeContext(VALID_USERCARD_ID),
    );
    expect(res.status).toBe(422);
  });

  it("retorna 404 quando UserCard nao existe", async () => {
    mockedVerifySession.mockResolvedValue({ userId: "user-1" });
    mockUserCardFindUnique.mockResolvedValue(null);

    const res = await PUT(
      makeReq(VALID_USERCARD_ID, { skillId: VALID_SKILL_ID }),
      makeContext(VALID_USERCARD_ID),
    );
    expect(res.status).toBe(404);
  });

  it("retorna 403 quando UserCard nao pertence ao usuario", async () => {
    mockedVerifySession.mockResolvedValue({ userId: "user-1" });
    mockUserCardFindUnique.mockResolvedValue({
      id: VALID_USERCARD_ID,
      userId: "outro-user",
      purity: 100,
      card: { mobId: "mob-1" },
    });

    const res = await PUT(
      makeReq(VALID_USERCARD_ID, { skillId: VALID_SKILL_ID }),
      makeContext(VALID_USERCARD_ID),
    );
    expect(res.status).toBe(403);
    const json = (await res.json()) as { error: string };
    expect(json.error).toMatch(/nao pertence/i);
  });

  it("retorna 422 quando UserCard.purity !== 100", async () => {
    mockedVerifySession.mockResolvedValue({ userId: "user-1" });
    mockUserCardFindUnique.mockResolvedValue({
      id: VALID_USERCARD_ID,
      userId: "user-1",
      purity: 90,
      card: { mobId: "mob-1" },
    });

    const res = await PUT(
      makeReq(VALID_USERCARD_ID, { skillId: VALID_SKILL_ID }),
      makeContext(VALID_USERCARD_ID),
    );
    expect(res.status).toBe(422);
    const json = (await res.json()) as { error: string };
    expect(json.error).toMatch(/Espectrais/);
  });

  it("retorna 422 quando skillId nao pertence aos mob skills do mob de origem", async () => {
    mockedVerifySession.mockResolvedValue({ userId: "user-1" });
    mockUserCardFindUnique.mockResolvedValue({
      id: VALID_USERCARD_ID,
      userId: "user-1",
      purity: 100,
      card: { mobId: "mob-1" },
    });
    mockMobSkillFindFirst.mockResolvedValue(null);

    const res = await PUT(
      makeReq(VALID_USERCARD_ID, { skillId: VALID_SKILL_ID }),
      makeContext(VALID_USERCARD_ID),
    );
    expect(res.status).toBe(422);
    const json = (await res.json()) as { error: string };
    expect(json.error).toMatch(/nao pertence ao mob/i);
    expect(mockUserCardUpdate).not.toHaveBeenCalled();
  });

  it("retorna 200 e atualiza spectralSkillId no happy path", async () => {
    mockedVerifySession.mockResolvedValue({ userId: "user-1" });
    mockUserCardFindUnique.mockResolvedValue({
      id: VALID_USERCARD_ID,
      userId: "user-1",
      purity: 100,
      card: { mobId: "mob-1" },
    });
    mockMobSkillFindFirst.mockResolvedValue({ id: "ms-1" });
    mockUserCardUpdate.mockResolvedValue({ id: VALID_USERCARD_ID });

    const res = await PUT(
      makeReq(VALID_USERCARD_ID, { skillId: VALID_SKILL_ID }),
      makeContext(VALID_USERCARD_ID),
    );
    expect(res.status).toBe(200);
    const json = (await res.json()) as { data: { ok: boolean; spectralSkillId: string } };
    expect(json.data.ok).toBe(true);
    expect(json.data.spectralSkillId).toBe(VALID_SKILL_ID);
    expect(mockUserCardUpdate).toHaveBeenCalledWith({
      where: { id: VALID_USERCARD_ID },
      data: { spectralSkillId: VALID_SKILL_ID },
    });
  });
});

describe("GET /api/cards/[id]/spectral-skill", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedVerifySession.mockReset();
    mockUserCardFindUnique.mockReset();
  });

  it("retorna 401 sem autenticacao", async () => {
    mockedVerifySession.mockRejectedValue(
      new AuthenticationError("Token ausente", "UNAUTHENTICATED", 401),
    );

    const res = await GET(makeGetReq(VALID_USERCARD_ID), makeContext(VALID_USERCARD_ID));
    expect(res.status).toBe(401);
  });

  it("retorna 404 quando UserCard nao existe", async () => {
    mockedVerifySession.mockResolvedValue({ userId: "user-1" });
    mockUserCardFindUnique.mockResolvedValue(null);

    const res = await GET(makeGetReq(VALID_USERCARD_ID), makeContext(VALID_USERCARD_ID));
    expect(res.status).toBe(404);
  });

  it("retorna 403 quando UserCard nao pertence ao usuario", async () => {
    mockedVerifySession.mockResolvedValue({ userId: "user-1" });
    mockUserCardFindUnique.mockResolvedValue({
      id: VALID_USERCARD_ID,
      userId: "outro",
      purity: 100,
      spectralSkillId: null,
      card: { mob: { id: "mob-1", skills: [] } },
    });

    const res = await GET(makeGetReq(VALID_USERCARD_ID), makeContext(VALID_USERCARD_ID));
    expect(res.status).toBe(403);
  });

  it("retorna 422 quando UserCard.purity !== 100", async () => {
    mockedVerifySession.mockResolvedValue({ userId: "user-1" });
    mockUserCardFindUnique.mockResolvedValue({
      id: VALID_USERCARD_ID,
      userId: "user-1",
      purity: 80,
      spectralSkillId: null,
      card: { mob: { id: "mob-1", skills: [] } },
    });

    const res = await GET(makeGetReq(VALID_USERCARD_ID), makeContext(VALID_USERCARD_ID));
    expect(res.status).toBe(422);
  });

  it("retorna 200 com lista de mob skills", async () => {
    mockedVerifySession.mockResolvedValue({ userId: "user-1" });
    mockUserCardFindUnique.mockResolvedValue({
      id: VALID_USERCARD_ID,
      userId: "user-1",
      purity: 100,
      spectralSkillId: "skill-x",
      card: {
        mob: {
          id: "mob-1",
          skills: [
            {
              slotIndex: 0,
              skill: {
                id: "s1",
                name: "Skill Um",
                description: "...",
                tier: 1,
                cooldown: 0,
                target: "SINGLE_ENEMY",
                damageType: "PHYSICAL",
                basePower: 30,
                hits: 1,
                accuracy: 100,
              },
            },
            {
              slotIndex: 1,
              skill: {
                id: "s2",
                name: "Skill Dois",
                description: "...",
                tier: 2,
                cooldown: 1,
                target: "SINGLE_ENEMY",
                damageType: "MAGICAL",
                basePower: 50,
                hits: 1,
                accuracy: 95,
              },
            },
          ],
        },
      },
    });

    const res = await GET(makeGetReq(VALID_USERCARD_ID), makeContext(VALID_USERCARD_ID));
    expect(res.status).toBe(200);
    const json = (await res.json()) as {
      data: {
        skills: { id: string; slotIndex: number }[];
        currentSkillId: string | null;
        mobId: string;
      };
    };
    expect(json.data.skills.length).toBe(2);
    expect(json.data.skills[0].id).toBe("s1");
    expect(json.data.currentSkillId).toBe("skill-x");
    expect(json.data.mobId).toBe("mob-1");
  });
});
