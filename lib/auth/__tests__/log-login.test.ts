import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mocks — declarados antes do import do helper
// ---------------------------------------------------------------------------

const mockCreate = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    loginLog: { create: (...args: unknown[]) => mockCreate(...args) },
  },
}));

// ---------------------------------------------------------------------------
// Imports (apos vi.mock)
// ---------------------------------------------------------------------------

import { logLogin } from "../log-login";

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
  mockCreate.mockReset();
  mockCreate.mockResolvedValue({ id: "log-1" });
});

// ---------------------------------------------------------------------------
// Testes
// ---------------------------------------------------------------------------

describe("logLogin", () => {
  describe("caso feliz", () => {
    it("cria log com todos os campos quando todos cabem nos limites", async () => {
      await logLogin({
        userId: "user-abc",
        visitorId: "abc123-fingerprint",
        ip: "192.168.0.1",
        userAgent: "Mozilla/5.0 (Windows NT 10.0)",
      });

      expect(mockCreate).toHaveBeenCalledOnce();
      expect(mockCreate).toHaveBeenCalledWith({
        data: {
          userId: "user-abc",
          visitorId: "abc123-fingerprint",
          ip: "192.168.0.1",
          userAgent: "Mozilla/5.0 (Windows NT 10.0)",
        },
      });
    });

    it("aceita visitorId 'unknown' (default quando cliente nao envia)", async () => {
      await logLogin({
        userId: "user-x",
        visitorId: "unknown",
        ip: "10.0.0.1",
        userAgent: "test-agent",
      });

      expect(mockCreate).toHaveBeenCalledWith({
        data: {
          userId: "user-x",
          visitorId: "unknown",
          ip: "10.0.0.1",
          userAgent: "test-agent",
        },
      });
    });
  });

  describe("truncamento defensivo", () => {
    it("trunca userAgent maior que 500 chars", async () => {
      const longUserAgent = "A".repeat(800);

      await logLogin({
        userId: "u1",
        visitorId: "v1",
        ip: "1.1.1.1",
        userAgent: longUserAgent,
      });

      const callArgs = mockCreate.mock.calls[0][0] as { data: { userAgent: string } };
      expect(callArgs.data.userAgent.length).toBe(500);
      expect(callArgs.data.userAgent).toBe("A".repeat(500));
    });

    it("trunca ip maior que 45 chars (limite IPv6)", async () => {
      const longIp = "X".repeat(100);

      await logLogin({
        userId: "u1",
        visitorId: "v1",
        ip: longIp,
        userAgent: "agent",
      });

      const callArgs = mockCreate.mock.calls[0][0] as { data: { ip: string } };
      expect(callArgs.data.ip.length).toBe(45);
      expect(callArgs.data.ip).toBe("X".repeat(45));
    });

    it("trunca visitorId maior que 100 chars", async () => {
      const longVisitorId = "v".repeat(250);

      await logLogin({
        userId: "u1",
        visitorId: longVisitorId,
        ip: "1.1.1.1",
        userAgent: "agent",
      });

      const callArgs = mockCreate.mock.calls[0][0] as { data: { visitorId: string } };
      expect(callArgs.data.visitorId.length).toBe(100);
      expect(callArgs.data.visitorId).toBe("v".repeat(100));
    });

    it("nao trunca strings dentro do limite", async () => {
      await logLogin({
        userId: "u1",
        visitorId: "abc",
        ip: "1.1.1.1",
        userAgent: "short",
      });

      const callArgs = mockCreate.mock.calls[0][0] as {
        data: { visitorId: string; ip: string; userAgent: string };
      };
      expect(callArgs.data.visitorId).toBe("abc");
      expect(callArgs.data.ip).toBe("1.1.1.1");
      expect(callArgs.data.userAgent).toBe("short");
    });
  });

  describe("propagacao de erro", () => {
    it("propaga erro do Prisma — caller decide ignorar via .catch", async () => {
      const dbError = new Error("DB connection lost");
      mockCreate.mockRejectedValueOnce(dbError);

      await expect(
        logLogin({
          userId: "u1",
          visitorId: "v1",
          ip: "1.1.1.1",
          userAgent: "agent",
        })
      ).rejects.toThrow("DB connection lost");
    });
  });
});
