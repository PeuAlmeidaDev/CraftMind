// lib/socket-emitter.ts — Helper para emitir eventos Socket.io a partir das API routes
//
// Faz um POST HTTP interno para o servidor Socket.io (endpoint /internal/notify
// para target unico, /internal/broadcast-spectral para broadcast global).
// Fire-and-forget: erros sao logados mas nunca propagados ao chamador.

const SOCKET_SERVER_URL = process.env.SOCKET_SERVER_URL;
const INTERNAL_SECRET = process.env.SOCKET_INTERNAL_SECRET;

type NotifyPayload = {
  targetUserId: string;
  event: string;
  payload: Record<string, unknown>;
};

type BroadcastPayload = {
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

/**
 * Broadcast global: emite um evento Socket.io para TODOS os sockets conectados
 * (usando io.emit no servidor). Fire-and-forget — falha de rede e logada mas
 * nunca propagada. Cliente filtra eventos irrelevantes (ex: o proprio dropper
 * nao mostra toast de Espectral pra si mesmo).
 *
 * Atualmente usado pelo evento `global:spectral-drop` quando alguem dropa um
 * Cristal Espectral (purity === 100).
 */
export async function broadcastGlobal(
  event: string,
  payload: Record<string, unknown>
): Promise<void> {
  const body: BroadcastPayload = { event, payload };

  if (!SOCKET_SERVER_URL || !INTERNAL_SECRET) {
    console.warn(
      "[socket-emitter] SOCKET_SERVER_URL or SOCKET_INTERNAL_SECRET not configured, skipping broadcast"
    );
    return;
  }

  try {
    const response = await fetch(
      `${SOCKET_SERVER_URL}/internal/broadcast-spectral`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${INTERNAL_SECRET}`,
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(5000),
      }
    );

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      console.warn(
        `[socket-emitter] Failed to broadcast ${event}: ${response.status} ${text}`
      );
    }
  } catch (error) {
    console.warn(
      `[socket-emitter] Error broadcasting ${event}:`,
      error instanceof Error ? error.message : error
    );
  }
}
