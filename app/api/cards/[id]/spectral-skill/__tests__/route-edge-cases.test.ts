// app/api/cards/[id]/spectral-skill/__tests__/route-edge-cases.test.ts
//
// Edge cases COMPLEMENTARES (nao duplicar route.test.ts existente). Cobre:
//   - PUT atualiza spectralSkillId quando ja existia outro (override)
//   - GET subsequente retorna o spectralSkillId atualizado
//   - PUT com body inteiramente vazio (string vazia / null) -> 400 ou 422

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
import { verifySession } from "@/lib/auth/verify-session";

const mockedVerifySession = vi.mocked(verifySession);

// cuids validos (formato cuid v1, 25 chars iniciando com 'c')
const VALID_USERCARD_ID = "ckusrcard0000000000000001";
const OLD_SKILL_ID = "ckaaa1111111111111111111a";
const NEW_SKILL_ID = "ckbbb2222222222222222222b";

function makePutReq(userCardId: string, body: unknown): NextRequest {
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

describe("PUT /api/cards/[id]/spectral-skill — atualizacao quando ja existia spectralSkillId", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedVerifySession.mockReset();
    mockUserCardFindUnique.mockReset();
    mockUserCardUpdate.mockReset();
    mockMobSkillFindFirst.mockReset();
  });

  it("substitui spectralSkillId existente por novo skillId valido (override)", async () => {
    mockedVerifySession.mockResolvedValue({ userId: "user-1" });
    // findUnique retorna a carta com spectralSkillId antigo (OLD_SKILL_ID)
    mockUserCardFindUnique.mockResolvedValue({
      id: VALID_USERCARD_ID,
      userId: "user-1",
      purity: 100,
      spectralSkillId: OLD_SKILL_ID,
      card: { mobId: "mob-1" },
    });
    // novo skillId pertence ao mob
    mockMobSkillFindFirst.mockResolvedValue({ id: "ms-novo" });
    mockUserCardUpdate.mockResolvedValue({
      id: VALID_USERCARD_ID,
      spectralSkillId: NEW_SKILL_ID,
    });

    const res = await PUT(
      makePutReq(VALID_USERCARD_ID, { skillId: NEW_SKILL_ID }),
      makeContext(VALID_USERCARD_ID),
    );

    expect(res.status).toBe(200);
    const json = (await res.json()) as {
      data: { ok: boolean; spectralSkillId: string };
    };
    expect(json.data.ok).toBe(true);
    expect(json.data.spectralSkillId).toBe(NEW_SKILL_ID);

    // update foi chamado com o NOVO id, sobrescrevendo o antigo
    expect(mockUserCardUpdate).toHaveBeenCalledWith({
      where: { id: VALID_USERCARD_ID },
      data: { spectralSkillId: NEW_SKILL_ID },
    });
    expect(mockUserCardUpdate).toHaveBeenCalledTimes(1);
  });

  it("GET subsequente retorna o spectralSkillId atualizado (currentSkillId reflete o ultimo PUT)", async () => {
    mockedVerifySession.mockResolvedValue({ userId: "user-1" });
    // Mock: GET retorna a carta com o novo id (simula estado pos-PUT)
    mockUserCardFindUnique.mockResolvedValue({
      id: VALID_USERCARD_ID,
      userId: "user-1",
      purity: 100,
      spectralSkillId: NEW_SKILL_ID,
      card: {
        mob: {
          id: "mob-1",
          skills: [
            {
              slotIndex: 0,
              skill: {
                id: NEW_SKILL_ID,
                name: "Nova Skill",
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
          ],
        },
      },
    });

    const res = await GET(makeGetReq(VALID_USERCARD_ID), makeContext(VALID_USERCARD_ID));
    expect(res.status).toBe(200);
    const json = (await res.json()) as {
      data: {
        currentSkillId: string | null;
        skills: { id: string }[];
      };
    };
    expect(json.data.currentSkillId).toBe(NEW_SKILL_ID);
    expect(json.data.skills.find((s) => s.id === NEW_SKILL_ID)).toBeDefined();
  });

  it("retorna 400 quando o body do PUT eh JSON invalido (null)", async () => {
    mockedVerifySession.mockResolvedValue({ userId: "user-1" });

    // body null serializa para "null" via JSON.stringify;
    // o handler trata isso como body invalido (apiError 400 INVALID_BODY)
    const req = new NextRequest(
      `http://localhost:3000/api/cards/${VALID_USERCARD_ID}/spectral-skill`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: "null",
      },
    );
    const res = await PUT(req, makeContext(VALID_USERCARD_ID));

    // Pode ser 400 (INVALID_BODY) ou 422 (Zod). Aceitamos ambos.
    expect([400, 422]).toContain(res.status);
    expect(mockUserCardUpdate).not.toHaveBeenCalled();
  });

  it("retorna 422 quando skillId eh string vazia (falha no .cuid())", async () => {
    mockedVerifySession.mockResolvedValue({ userId: "user-1" });

    const res = await PUT(
      makePutReq(VALID_USERCARD_ID, { skillId: "" }),
      makeContext(VALID_USERCARD_ID),
    );

    expect(res.status).toBe(422);
    expect(mockUserCardUpdate).not.toHaveBeenCalled();
  });
});
