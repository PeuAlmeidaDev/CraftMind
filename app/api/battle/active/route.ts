import { NextRequest } from "next/server";
import { verifySession, AuthenticationError } from "@/lib/auth/verify-session";
import { apiSuccess, apiError } from "@/lib/api-response";
import { hasActiveBattle } from "@/lib/battle/pve-store";
import { hasActiveMultiBattle } from "@/lib/battle/pve-multi-store";

type ActiveBattleResponse =
  | { hasBattle: true; battleType: "pve" | "pve-multi" | "pvp" | "boss" | "coop-pve"; battleId: string }
  | { hasBattle: false };

type SocketServerResponse =
  | { hasBattle: true; battleType: "pvp" | "boss" | "coop-pve"; battleId: string }
  | { hasBattle: false };

export async function GET(request: NextRequest) {
  try {
    const { userId } = await verifySession(request);

    // 1. Verificar stores locais (processo Next.js)
    const pveBattleId = hasActiveBattle(userId);
    if (pveBattleId) {
      return apiSuccess<ActiveBattleResponse>({
        hasBattle: true,
        battleType: "pve",
        battleId: pveBattleId,
      });
    }

    const pveMultiBattleId = hasActiveMultiBattle(userId);
    if (pveMultiBattleId) {
      return apiSuccess<ActiveBattleResponse>({
        hasBattle: true,
        battleType: "pve-multi",
        battleId: pveMultiBattleId,
      });
    }

    // 2. Consultar servidor Socket.io para batalhas remotas (PvP, Boss, Coop PvE)
    const socketServerUrl = process.env.SOCKET_SERVER_URL;
    const socketInternalSecret = process.env.SOCKET_INTERNAL_SECRET;

    if (socketServerUrl && socketInternalSecret) {
      try {
        const response = await fetch(
          `${socketServerUrl}/internal/active-battle?userId=${encodeURIComponent(userId)}`,
          {
            method: "GET",
            headers: {
              Authorization: `Bearer ${socketInternalSecret}`,
            },
          }
        );

        if (response.ok) {
          const data = (await response.json()) as SocketServerResponse;
          if (data.hasBattle) {
            return apiSuccess<ActiveBattleResponse>({
              hasBattle: true,
              battleType: data.battleType,
              battleId: data.battleId,
            });
          }
        }
      } catch (networkError) {
        // Socket.io server offline — tratar graciosamente
        console.warn("[GET /api/battle/active] Socket.io server inacessivel:", networkError);
      }
    }

    // 3. Nenhuma batalha ativa encontrada
    return apiSuccess<ActiveBattleResponse>({ hasBattle: false });
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return apiError(error.message, error.code, error.statusCode);
    }

    console.error("[GET /api/battle/active]", error);
    return apiError("Erro interno do servidor", "INTERNAL_ERROR", 500);
  }
}
