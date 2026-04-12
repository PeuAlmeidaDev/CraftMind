// server/index.ts — Servidor HTTP + Socket.io principal

import http from "node:http";
import { Server } from "socket.io";
import jwt from "jsonwebtoken";
import { registerMatchmakingHandlers } from "./handlers/matchmaking";
import { registerBattleHandlers, handleReconnection } from "./handlers/battle";
import { registerBossMatchmakingHandlers } from "./handlers/boss-matchmaking";
import { registerBossBattleHandlers, handleBossReconnection } from "./handlers/boss-battle";

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

const httpServer = http.createServer();

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
  console.log(
    `[Socket.io] Conectado: ${socket.data.userId} (socket ${socket.id})`
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

  registerMatchmakingHandlers(io, socket);
  registerBattleHandlers(io, socket);
  registerBossMatchmakingHandlers(io, socket);
  registerBossBattleHandlers(io, socket);

  socket.on("disconnect", (reason) => {
    console.log(
      `[Socket.io] Desconectado: ${socket.data.userId} (${reason})`
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
