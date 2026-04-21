// lib/socket-emitter.ts — Helper para emitir eventos Socket.io a partir das API routes
//
// Faz um POST HTTP interno para o servidor Socket.io (endpoint /internal/notify).
// Fire-and-forget: erros sao logados mas nunca propagados ao chamador.

const SOCKET_SERVER_URL = process.env.SOCKET_SERVER_URL;
const INTERNAL_SECRET = process.env.SOCKET_INTERNAL_SECRET;

type NotifyPayload = {
  targetUserId: string;
  event: string;
  payload: Record<string, unknown>;
};

/**
 * Emite um evento Socket.io para um usuario especifico via o servidor Socket.io.
 * Se o usuario estiver offline, nada acontece. Se houver erro de rede, ele e logado
 * e a promise resolve normalmente (fire-and-forget).
 */
export async function emitToUser(
  targetUserId: string,
  event: string,
  payload: Record<string, unknown>
): Promise<void> {
  const body: NotifyPayload = { targetUserId, event, payload };

  if (!SOCKET_SERVER_URL || !INTERNAL_SECRET) {
    console.warn("[socket-emitter] SOCKET_SERVER_URL or SOCKET_INTERNAL_SECRET not configured, skipping");
    return;
  }

  try {
    const response = await fetch(`${SOCKET_SERVER_URL}/internal/notify`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${INTERNAL_SECRET}`,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      console.warn(
        `[socket-emitter] Failed to notify ${targetUserId} (${event}): ${response.status} ${text}`
      );
    }
  } catch (error) {
    console.warn(
      `[socket-emitter] Error notifying ${targetUserId} (${event}):`,
      error instanceof Error ? error.message : error
    );
  }
}
