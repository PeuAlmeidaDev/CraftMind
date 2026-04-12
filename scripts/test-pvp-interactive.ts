/**
 * Teste PvP INTERATIVO — você escolhe as skills de cada jogador a cada turno.
 *
 * Uso:
 *   1. Terminal 1: node --env-file=.env --import=tsx server/index.ts
 *   2. Terminal 2: node --env-file=.env --import=tsx scripts/test-pvp-interactive.ts
 */

import { io, Socket } from "socket.io-client";
import jwt from "jsonwebtoken";
import readline from "node:readline";

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:3001";
const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  console.error("JWT_SECRET nao definido no .env");
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Skills disponíveis (4 por jogador)
// ---------------------------------------------------------------------------

const skills = [
  {
    skillId: "skill-ataque-rapido",
    slotIndex: 0,
    skill: {
      id: "skill-ataque-rapido",
      name: "Ataque Rapido",
      description: "Golpe fisico basico. Sem cooldown.",
      tier: 1, cooldown: 0, target: "SINGLE_ENEMY", damageType: "PHYSICAL",
      basePower: 40, hits: 1, accuracy: 100, effects: [], mastery: {},
    },
  },
  {
    skillId: "skill-bola-fogo",
    slotIndex: 1,
    skill: {
      id: "skill-bola-fogo",
      name: "Bola de Fogo",
      description: "Ataque magico. 30% chance de BURN (3 turnos).",
      tier: 1, cooldown: 0, target: "SINGLE_ENEMY", damageType: "MAGICAL",
      basePower: 45, hits: 1, accuracy: 90,
      effects: [{ type: "STATUS", target: "SINGLE_ENEMY", status: "BURN", chance: 30, duration: 3 }],
      mastery: {},
    },
  },
  {
    skillId: "skill-investida-brutal",
    slotIndex: 2,
    skill: {
      id: "skill-investida-brutal",
      name: "Investida Brutal",
      description: "Golpe forte (80 poder) com 25% recoil. Cooldown: 1 turno.",
      tier: 2, cooldown: 1, target: "SINGLE_ENEMY", damageType: "PHYSICAL",
      basePower: 80, hits: 1, accuracy: 85,
      effects: [{ type: "RECOIL", target: "SELF", percentOfDamage: 25 }],
      mastery: {},
    },
  },
  {
    skillId: "skill-cura-natural",
    slotIndex: 3,
    skill: {
      id: "skill-cura-natural",
      name: "Cura Natural",
      description: "Cura 25% do HP maximo. Cooldown: 1 turno.",
      tier: 2, cooldown: 1, target: "SELF", damageType: "NONE",
      basePower: 0, hits: 0, accuracy: 100,
      effects: [{ type: "HEAL", target: "SELF", percent: 25 }],
      mastery: {},
    },
  },
];

// ---------------------------------------------------------------------------
// Stats dos jogadores
// ---------------------------------------------------------------------------

const player1Stats = {
  physicalAtk: 25, physicalDef: 18, magicAtk: 20, magicDef: 16, hp: 250, speed: 16,
};

const player2Stats = {
  physicalAtk: 20, physicalDef: 15, magicAtk: 28, magicDef: 20, hp: 220, speed: 14,
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createToken(userId: string): string {
  return jwt.sign({ userId, email: `${userId}@test.com` }, JWT_SECRET!, { expiresIn: "15m" });
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

function ask(question: string): Promise<string> {
  return new Promise((resolve) => rl.question(question, resolve));
}

function connectPlayer(userId: string): Promise<Socket> {
  return new Promise((resolve, reject) => {
    const token = createToken(userId);
    const socket = io(SOCKET_URL, { auth: { token }, transports: ["websocket"] });
    socket.on("connect", () => resolve(socket));
    socket.on("connect_error", (err) => reject(err));
  });
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  console.log("========================================");
  console.log("   CRAFT MIND — Batalha PvP Interativa  ");
  console.log("========================================\n");

  console.log("Player 1: Guerreiro (ATK:25 DEF:18 MATK:20 MDEF:16 HP:250 SPD:16)");
  console.log("Player 2: Mago     (ATK:20 DEF:15 MATK:28 MDEF:20 HP:220 SPD:14)\n");

  console.log("Skills disponiveis:");
  skills.forEach((s, i) => {
    console.log(`  [${i + 1}] ${s.skill.name} — ${s.skill.description}`);
  });
  console.log(`  [0] Skip (pular turno)\n`);

  console.log(`Conectando a ${SOCKET_URL}...`);

  const player1 = await connectPlayer("test-player-1");
  const player2 = await connectPlayer("test-player-2");
  console.log("Ambos jogadores conectados!\n");

  // Estado
  let battleId: string | null = null;
  let battleOver = false;
  let waitingForState = false;
  let turnNumber = 0;

  // Dados de HP para exibir
  let p1Hp = player1Stats.hp;
  let p1MaxHp = player1Stats.hp;
  let p2Hp = player2Stats.hp;
  let p2MaxHp = player2Stats.hp;

  // Promise para esperar estado do turno
  let resolveState: (() => void) | null = null;

  // Listeners Player 1 (recebe os eventos de ambos)
  player1.on("matchmaking:found", (data: { battleId: string }) => {
    battleId = data.battleId;
  });

  player1.on("matchmaking:error", (data: { message: string }) => {
    console.error(`Erro matchmaking: ${data.message}`);
  });

  player1.on("battle:state", (data: {
    state: {
      turnNumber: number;
      players: Array<{ playerId: string; currentHp: number; baseStats: { hp: number }; statusEffects: Array<{ status: string; remainingTurns: number }> }>;
    };
    events: Array<{ message: string; phase: string }>;
  }) => {
    turnNumber = data.state.turnNumber;
    const p1 = data.state.players.find((p) => p.playerId === "test-player-1")!;
    const p2 = data.state.players.find((p) => p.playerId === "test-player-2")!;
    p1Hp = p1.currentHp;
    p1MaxHp = p1.baseStats.hp;
    p2Hp = p2.currentHp;
    p2MaxHp = p2.baseStats.hp;

    console.log("\n----------------------------------------");
    for (const event of data.events) {
      const msg = event.message
        .replace(/test-player-1/g, "Player 1")
        .replace(/test-player-2/g, "Player 2");
      console.log(`  ${msg}`);
    }
    console.log("----------------------------------------");

    // Status effects
    const p1Status = p1.statusEffects.map((s) => `${s.status}(${s.remainingTurns}t)`).join(", ") || "nenhum";
    const p2Status = p2.statusEffects.map((s) => `${s.status}(${s.remainingTurns}t)`).join(", ") || "nenhum";

    const p1Bar = hpBar(p1Hp, p1MaxHp);
    const p2Bar = hpBar(p2Hp, p2MaxHp);

    console.log(`\n  Player 1: ${p1Bar} ${p1Hp}/${p1MaxHp} HP  [${p1Status}]`);
    console.log(`  Player 2: ${p2Bar} ${p2Hp}/${p2MaxHp} HP  [${p2Status}]`);

    if (resolveState) {
      resolveState();
      resolveState = null;
    }
  });

  player1.on("battle:end", (data: { winnerId: string | null }) => {
    battleOver = true;
    console.log("\n========================================");
    if (data.winnerId === "test-player-1") {
      console.log("   PLAYER 1 VENCEU!");
    } else if (data.winnerId === "test-player-2") {
      console.log("   PLAYER 2 VENCEU!");
    } else {
      console.log("   EMPATE!");
    }
    console.log("========================================\n");

    if (resolveState) {
      resolveState();
      resolveState = null;
    }
  });

  player1.on("battle:error", (data: { message: string }) => {
    console.error(`Erro: ${data.message}`);
  });

  player2.on("battle:error", (data: { message: string }) => {
    console.error(`Erro P2: ${data.message}`);
  });

  // Matchmaking
  console.log("Entrando na fila...");
  player1.emit("matchmaking:join", { characterId: "char-1", stats: player1Stats, skills });
  await sleep(300);
  player2.emit("matchmaking:join", { characterId: "char-2", stats: player2Stats, skills });
  await sleep(1000);

  if (!battleId) {
    console.error("Matchmaking falhou.");
    cleanup(player1, player2);
    return;
  }

  console.log(`\nBatalha iniciada! (${battleId})\n`);

  // Loop de turnos
  while (!battleOver) {
    console.log(`\n--- Turno ${turnNumber} ---\n`);

    const p1Choice = await askSkill("Player 1");
    const p2Choice = await askSkill("Player 2");

    // Enviar ações
    player1.emit("battle:action", { battleId, skillId: p1Choice });
    player2.emit("battle:action", { battleId, skillId: p2Choice });

    // Esperar resolução do turno
    await new Promise<void>((resolve) => {
      resolveState = resolve;
      // Safety timeout caso algo dê errado
      setTimeout(() => {
        if (resolveState) {
          resolveState();
          resolveState = null;
        }
      }, 5000);
    });
  }

  cleanup(player1, player2);
}

async function askSkill(playerName: string): Promise<string | null> {
  while (true) {
    const input = await ask(`  ${playerName} — Escolha skill [1-4] ou 0 para skip: `);
    const num = parseInt(input.trim(), 10);
    if (num === 0) return null;
    if (num >= 1 && num <= 4) return skills[num - 1].skillId;
    console.log("  Opcao invalida. Digite 1-4 ou 0.");
  }
}

function hpBar(current: number, max: number): string {
  const width = 20;
  const filled = Math.max(0, Math.round((current / max) * width));
  const empty = width - filled;
  const percent = Math.round((current / max) * 100);
  return `[${"#".repeat(filled)}${"-".repeat(empty)}] ${percent}%`;
}

function cleanup(p1: Socket, p2: Socket): void {
  p1.disconnect();
  p2.disconnect();
  rl.close();
  setTimeout(() => process.exit(0), 500);
}

main().catch((err) => {
  console.error("Erro fatal:", err);
  process.exit(1);
});
