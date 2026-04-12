/**
 * Script de teste para batalha PvP via Socket.io.
 *
 * Uso:
 *   1. Certifique-se de que o .env tem JWT_SECRET definido
 *   2. Inicie o servidor Socket.io: node --env-file=.env --import=tsx server/index.ts
 *   3. Em outro terminal: node --env-file=.env --import=tsx scripts/test-pvp.ts
 *
 * O script simula dois jogadores conectando, entrando na fila,
 * sendo emparelhados e jogando uma batalha completa.
 */

import { io, Socket } from "socket.io-client";
import jwt from "jsonwebtoken";

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:3001";
const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  console.error("JWT_SECRET nao definido no .env");
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createToken(userId: string): string {
  return jwt.sign({ userId, email: `${userId}@test.com` }, JWT_SECRET!, {
    expiresIn: "15m",
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Stats e skills fake para teste (não precisa existir no banco)
const playerStats = {
  physicalAtk: 25,
  physicalDef: 18,
  magicAtk: 22,
  magicDef: 16,
  hp: 200,
  speed: 15,
};

const fakeSkills = [
  {
    skillId: "skill-1",
    slotIndex: 0,
    skill: {
      id: "skill-1",
      name: "Ataque Rapido",
      description: "Golpe fisico basico",
      tier: 1,
      cooldown: 0,
      target: "SINGLE_ENEMY",
      damageType: "PHYSICAL",
      basePower: 40,
      hits: 1,
      accuracy: 100,
      effects: [],
      mastery: {},
    },
  },
  {
    skillId: "skill-2",
    slotIndex: 1,
    skill: {
      id: "skill-2",
      name: "Bola de Fogo",
      description: "Ataque magico",
      tier: 1,
      cooldown: 0,
      target: "SINGLE_ENEMY",
      damageType: "MAGICAL",
      basePower: 45,
      hits: 1,
      accuracy: 90,
      effects: [],
      mastery: {},
    },
  },
];

// ---------------------------------------------------------------------------
// Conectar jogador
// ---------------------------------------------------------------------------

function connectPlayer(name: string, userId: string): Promise<Socket> {
  return new Promise((resolve, reject) => {
    const token = createToken(userId);
    const socket = io(SOCKET_URL, {
      auth: { token },
      transports: ["websocket"],
    });

    socket.on("connect", () => {
      console.log(`[${name}] Conectado (socket: ${socket.id})`);
      resolve(socket);
    });

    socket.on("connect_error", (err) => {
      console.error(`[${name}] Erro de conexao: ${err.message}`);
      reject(err);
    });
  });
}

// ---------------------------------------------------------------------------
// Fluxo principal
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  console.log("=== Teste PvP via Socket.io ===\n");
  console.log(`Conectando a ${SOCKET_URL}...\n`);

  // Conectar dois jogadores
  const player1 = await connectPlayer("Player 1", "test-player-1");
  const player2 = await connectPlayer("Player 2", "test-player-2");

  let battleId: string | null = null;
  let battleOver = false;
  let turnCount = 0;

  // Registrar listeners no Player 1
  player1.on("matchmaking:waiting", (data: { message: string }) => {
    console.log(`[Player 1] ${data.message}`);
  });

  player1.on("matchmaking:found", (data: { battleId: string }) => {
    battleId = data.battleId;
    console.log(`[Player 1] Match encontrado! battleId: ${battleId}`);
  });

  player1.on("matchmaking:error", (data: { message: string }) => {
    console.error(`[Player 1] Erro matchmaking: ${data.message}`);
  });

  player1.on("battle:state", (data: { state: { turnNumber: number; players: Array<{ playerId: string; currentHp: number; baseStats: { hp: number } }> }; events: Array<{ message: string }> }) => {
    turnCount = data.state.turnNumber;
    const p1 = data.state.players.find((p) => p.playerId === "test-player-1");
    const p2 = data.state.players.find((p) => p.playerId === "test-player-2");
    console.log(
      `\n[Turno ${turnCount - 1}] HP: Player1=${p1?.currentHp}/${p1?.baseStats.hp} | Player2=${p2?.currentHp}/${p2?.baseStats.hp}`
    );
    for (const event of data.events) {
      console.log(`  ${event.message}`);
    }
  });

  player1.on("battle:end", (data: { winnerId: string | null }) => {
    battleOver = true;
    if (data.winnerId === "test-player-1") {
      console.log("\n=== Player 1 VENCEU! ===");
    } else if (data.winnerId === "test-player-2") {
      console.log("\n=== Player 2 VENCEU! ===");
    } else {
      console.log("\n=== EMPATE! ===");
    }
  });

  player1.on("battle:error", (data: { message: string }) => {
    console.error(`[Player 1] Erro batalha: ${data.message}`);
  });

  // Registrar listeners no Player 2
  player2.on("matchmaking:waiting", (data: { message: string }) => {
    console.log(`[Player 2] ${data.message}`);
  });

  player2.on("matchmaking:found", (data: { battleId: string }) => {
    if (!battleId) battleId = data.battleId;
    console.log(`[Player 2] Match encontrado! battleId: ${data.battleId}`);
  });

  player2.on("matchmaking:error", (data: { message: string }) => {
    console.error(`[Player 2] Erro matchmaking: ${data.message}`);
  });

  player2.on("battle:error", (data: { message: string }) => {
    console.error(`[Player 2] Erro batalha: ${data.message}`);
  });

  // Entrar na fila de matchmaking
  console.log("\n--- Matchmaking ---\n");

  player1.emit("matchmaking:join", {
    characterId: "char-test-1",
    stats: playerStats,
    skills: fakeSkills,
  });

  await sleep(500);

  player2.emit("matchmaking:join", {
    characterId: "char-test-2",
    stats: { ...playerStats, speed: 12, magicAtk: 28 }, // Player 2 mais lento mas mais magico
    skills: fakeSkills,
  });

  // Esperar match ser encontrado
  await sleep(1000);

  if (!battleId) {
    console.error("Matchmaking falhou — battleId nao recebido");
    player1.disconnect();
    player2.disconnect();
    process.exit(1);
  }

  console.log("\n--- Batalha ---\n");

  // Simular turnos
  while (!battleOver && turnCount < 55) {
    // Player 1 sempre usa Ataque Rapido
    player1.emit("battle:action", {
      battleId,
      skillId: "skill-1",
    });

    // Player 2 sempre usa Bola de Fogo
    player2.emit("battle:action", {
      battleId,
      skillId: "skill-2",
    });

    // Esperar resolucao do turno
    await sleep(300);
  }

  // Esperar persistencia
  await sleep(1000);

  console.log(`\nBatalha encerrada apos ${turnCount - 1} turnos.`);

  // Limpar
  player1.disconnect();
  player2.disconnect();

  // Dar tempo para o server processar desconexao
  await sleep(500);
  process.exit(0);
}

main().catch((err) => {
  console.error("Erro fatal:", err);
  process.exit(1);
});
