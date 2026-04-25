// server/index.ts — Servidor HTTP + Socket.io principal

import { config } from "dotenv";
import path from "node:path";
config({ path: path.resolve(__dirname, "..", ".env") });
import http from "node:http";
import { Server } from "socket.io";
import jwt from "jsonwebtoken";
import { registerMatchmakingHandlers } from "./handlers/matchmaking";
import { registerBattleHandlers, handleReconnection } from "./handlers/battle";
import { registerBossMatchmakingHandlers } from "./handlers/boss-matchmaking";
import { registerBossBattleHandlers, handleBossReconnection } from "./handlers/boss-battle";
import { registerCoopPveMatchmakingHandlers } from "./handlers/coop-pve-matchmaking";
import { registerCoopPveBattleHandlers, handleCoopPveReconnection } from "./handlers/coop-pve-battle";
import { registerCoopPveInviteHandlers } from "./handlers/coop-pve-invite";
import { registerSocket, unregisterSocket, getSocketIds, isOnline } from "./stores/user-store";
import { getPlayerBattle } from "./stores/pvp-store";
import { getPlayerBossBattle } from "./stores/boss-battle-store";
import { getPlayerCoopPveBattle } from "./stores/coop-pve-battle-store";

// ---------------------------------------------------------------------------
// Tipagem do socket.data via generic do Server
// ---------------------------------------------------------------------------

export type ServerSocketData = {
  userId: string;
};

// ---------------------------------------------------------------------------
// Servidor
// ---------------------------------------------------------------------------

const PORT = Number(process.env.PORT) || 3001;
const CLIENT_URL = process.env.CLIENT_URL || "http://localhost:3000";

// ---------------------------------------------------------------------------
// Token para autenticar requests internas (Next.js -> Socket.io server)
// ---------------------------------------------------------------------------

const INTERNAL_SECRET = process.env.SOCKET_INTERNAL_SECRET || "";

console.log("[Socket.io] INTERNAL_SECRET carregado:", INTERNAL_SECRET ? `${INTERNAL_SECRET.substring(0, 5)}...` : "(VAZIO)");

const IS_PRODUCTION = process.env.NODE_ENV === "production";

if (IS_PRODUCTION && !process.env.CLIENT_URL) {
  throw new Error("CLIENT_URL must be set in production");
}
if (IS_PRODUCTION && !process.env.SOCKET_INTERNAL_SECRET) {
  throw new Error("SOCKET_INTERNAL_SECRET must be set in production");
}
if (IS_PRODUCTION && !process.env.JWT_SECRET) {
  throw new Error("JWT_SECRET must be set in production");
}

// ---------------------------------------------------------------------------
// HTTP handler para notificacoes internas do Next.js
// ---------------------------------------------------------------------------

const httpServer = http.createServer((req, res) => {
  // GET /health — liveness probe para Railway / load balancer
  if (req.method === "GET" && req.url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "ok" }));
    return;
  }

  // GET /internal/active-battle?userId=<userId> — consulta batalha ativa de um usuario
  if (req.method === "GET" && req.url?.startsWith("/internal/active-battle")) {
    const authHeader = req.headers.authorization;
    console.log("[Socket.io] active-battle recebido:", JSON.stringify(authHeader));
    console.log("[Socket.io] active-battle esperado:", JSON.stringify(`Bearer ${INTERNAL_SECRET}`));
    if (!INTERNAL_SECRET || authHeader !== `Bearer ${INTERNAL_SECRET}`) {
      res.writeHead(401, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Unauthorized" }));
      return;
    }

    const parsedUrl = new URL(req.url, "http://localhost");
    const userId = parsedUrl.searchParams.get("userId");

    if (!userId) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Missing userId query param" }));
      return;
    }

    // Consultar stores na ordem: PvP -> Boss -> Coop PvE
    const pvpResult = getPlayerBattle(userId);
    if (pvpResult) {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ hasBattle: true, battleType: "pvp", battleId: pvpResult.battleId }));
      return;
    }

    const bossResult = getPlayerBossBattle(userId);
    if (bossResult) {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ hasBattle: true, battleType: "boss", battleId: bossResult.battleId }));
      return;
    }

    const coopPveResult = getPlayerCoopPveBattle(userId);
    if (coopPveResult) {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ hasBattle: true, battleType: "coop-pve", battleId: coopPveResult.battleId }));
      return;
    }

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ hasBattle: false }));
    return;
  }

  // GET /internal/online-check?userIds=id1,id2,id3 — consulta status online de usuarios
  if (req.method === "GET" && req.url?.startsWith("/internal/online-check")) {
    const authHeader = req.headers.authorization;
    if (!INTERNAL_SECRET || authHeader !== `Bearer ${INTERNAL_SECRET}`) {
      res.writeHead(401, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Unauthorized" }));
      return;
    }

    const parsedUrl = new URL(req.url, "http://localhost");
    const userIdsParam = parsedUrl.searchParams.get("userIds");

    if (!userIdsParam) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "userIds query param required" }));
      return;
    }

    const userIds = userIdsParam.split(",").filter(Boolean);
    if (userIds.length > 50) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Max 50 userIds" }));
      return;
    }

    const statuses: Record<string, boolean> = {};
    for (const id of userIds) {
      statuses[id] = isOnline(id);
    }

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ statuses }));
    return;
  }

  // POST /internal/notify — emite evento para um userId especifico
  if (req.method === "POST" && req.url === "/internal/notify") {
    // Verificar autorizacao
    const authHeader = req.headers.authorization;
    if (!INTERNAL_SECRET || authHeader !== `Bearer ${INTERNAL_SECRET}`) {
      res.writeHead(401, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Unauthorized" }));
      return;
    }

    let body = "";
    req.on("data", (chunk: Buffer) => {
      body += chunk.toString();
    });

    req.on("end", () => {
      try {
        const parsed = JSON.parse(body) as {
          targetUserId?: unknown;
          event?: unknown;
          payload?: unknown;
        };

        if (
          typeof parsed.targetUserId !== "string" ||
          typeof parsed.event !== "string" ||
          parsed.payload === undefined
        ) {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(
            JSON.stringify({ error: "Missing targetUserId, event, or payload" })
          );
          return;
        }

        const socketIds = getSocketIds(parsed.targetUserId);

        if (socketIds) {
          for (const socketId of socketIds) {
            io.to(socketId).emit(parsed.event, parsed.payload);
          }
          console.log(
            `[Notify] ${parsed.event} -> ${parsed.targetUserId} (${socketIds.size} socket(s))`
          );
        } else {
          console.log(
            `[Notify] ${parsed.event} -> ${parsed.targetUserId} (offline, skipped)`
          );
        }

        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            delivered: socketIds ? socketIds.size : 0,
          })
        );
      } catch {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Invalid JSON" }));
      }
    });
    return;
  }

  // Qualquer outra rota -> 404
  res.writeHead(404);
  res.end();
});

const io = new Server<
  Record<string, never>,
  Record<string, never>,
  Record<string, never>,
  ServerSocketData
>(httpServer, {
  cors: {
    origin: CLIENT_URL,
    methods: ["GET", "POST"],
  },
});

// ---------------------------------------------------------------------------
// Middleware de autenticacao
// ---------------------------------------------------------------------------

io.use((socket, next) => {
  const token = socket.handshake.auth.token;

  if (typeof token !== "string" || token.length === 0) {
    console.log("[Socket.io] Conexao rejeitada: token ausente");
    return next(new Error("Token de autenticacao ausente"));
  }

  const secret = process.env.JWT_SECRET;
  if (!secret) {
    console.error("[Socket.io] JWT_SECRET nao configurado");
    return next(new Error("Erro interno de autenticacao"));
  }

  try {
    const decoded = jwt.verify(token, secret);

    if (
      typeof decoded !== "object" ||
      decoded === null ||
      typeof (decoded as Record<string, unknown>).userId !== "string"
    ) {
      console.log("[Socket.io] Conexao rejeitada: payload JWT invalido");
      return next(new Error("Token invalido"));
    }

    const payload = decoded as { userId: string };
    socket.data.userId = payload.userId;
    next();
  } catch {
    console.log("[Socket.io] Conexao rejeitada: token invalido ou expirado");
    return next(new Error("Token invalido ou expirado"));
  }
});

// ---------------------------------------------------------------------------
// Conexoes
// ---------------------------------------------------------------------------

io.on("connection", (socket) => {
  const userId = socket.data.userId;
  registerSocket(userId, socket.id);

  console.log(
    `[Socket.io] Conectado: ${userId} (socket ${socket.id})`
  );

  // Verificar reconexao pendente em batalha PvP ativa
  const reconnected = handleReconnection(io, socket, socket.data.userId);
  if (reconnected) {
    console.log(
      `[Socket.io] ${socket.data.userId} reconectado em batalha ativa`
    );
  }

  // Verificar reconexao pendente em boss battle ativa
  const bossReconnected = handleBossReconnection(io, socket, socket.data.userId);
  if (bossReconnected) {
    console.log(
      `[Socket.io] ${socket.data.userId} reconectou em boss battle`
    );
  }

  // Verificar reconexao pendente em coop PvE battle ativa
  const coopPveReconnected = handleCoopPveReconnection(io, socket, socket.data.userId);
  if (coopPveReconnected) {
    console.log(
      `[Socket.io] ${socket.data.userId} reconectou em coop PvE battle`
    );
  }

  registerMatchmakingHandlers(io, socket);
  registerBattleHandlers(io, socket);
  registerBossMatchmakingHandlers(io, socket);
  registerBossBattleHandlers(io, socket);
  registerCoopPveMatchmakingHandlers(io, socket);
  registerCoopPveBattleHandlers(io, socket);
  registerCoopPveInviteHandlers(io, socket);

  socket.on("disconnect", (reason) => {
    unregisterSocket(userId, socket.id);
    console.log(
      `[Socket.io] Desconectado: ${userId} (${reason})`
    );
  });
});

// ---------------------------------------------------------------------------
// Iniciar servidor
// ---------------------------------------------------------------------------

httpServer.listen(PORT, () => {
  console.log(`[Socket.io] Servidor rodando na porta ${PORT}`);
  console.log(`[Socket.io] CORS permitido para: ${CLIENT_URL}`);
});
