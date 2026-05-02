// lib/ranking/houses.ts — Estandarte das Casas
//
// Competicao entre as 4 Casas (ARION, LYCUS, NOCTIS, NEREID).
// Inspiracao na Taca das Casas, mas sem ampulhetas: a fórmula é
// baseada em eventos datados que ja existem no banco, garantindo
// consistencia entre os 3 periodos (lifetime, monthly, weekly).
//
// Formula:
//   houseScore = Σ pontos / max(membersCount, 1)
//
// Pontos por evento:
//   - Battle.winnerId == userId          -> +30  (PvP 1v1 win)
//   - TeamBattleParticipant em time vencedor -> +25  (PvP Team win)
//   - HabitLog                           -> +1   (cada habito)
//   - PveBattle.result == "VICTORY"      -> +10  (vitoria PvE)
//
// Filtros de periodo:
//   - lifetime: sem filtro
//   - monthly:  data >= now - 30 dias
//   - weekly:   data >= now - 7 dias
//
// Tiebreak: totalEvents desc; se persistir, ordem alfabetica do nome
// da casa (deterministica).

import type { HouseName } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { HouseStandardEntry, RankingSeason } from "@/types/ranking";

// ---------------------------------------------------------------------------
// Pesos (centralizados aqui para tunagem futura)
// ---------------------------------------------------------------------------

export const ESTANDARTE_WEIGHTS = {
  WIN_1V1: 30,
  WIN_TEAM: 25,
  HABIT: 1,
  WIN_PVE: 10,
} as const;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const HOUSE_NAMES: readonly HouseName[] = [
  "ARION",
  "LYCUS",
  "NOCTIS",
  "NEREID",
] as const;

/** Retorna a data limite inferior do periodo, ou null para lifetime. */
function getPeriodStart(season: RankingSeason): Date | null {
  if (season === "lifetime") return null;
  const days = season === "weekly" ? 7 : 30;
  const start = new Date();
  start.setUTCDate(start.getUTCDate() - days);
  return start;
}

/** Acumulador de pontos e eventos por casa. */
type HouseAccumulator = {
  points: number;
  events: number;
};

function emptyAccumulators(): Record<HouseName, HouseAccumulator> {
  return {
    ARION: { points: 0, events: 0 },
    LYCUS: { points: 0, events: 0 },
    NOCTIS: { points: 0, events: 0 },
    NEREID: { points: 0, events: 0 },
  };
}

// ---------------------------------------------------------------------------
// Funcao pura — testada em isolamento
// ---------------------------------------------------------------------------

/** Dados crus dos eventos por casa para a agregacao. */
export type HouseStandardRawData = {
  /** Casas com membersCount e animal. Nao precisam estar todas presentes — ausentes assumem 0/"" */
  houses: ReadonlyArray<{ name: HouseName; animal: string; membersCount: number }>;
  /** Casas dos vencedores de PvP 1v1 (uma entrada por vitoria; null se sem casa). */
  pvp1v1Winners: ReadonlyArray<HouseName | null>;
  /** Casas dos participantes em times vencedores de PvP Team. */
  pvpTeamWinners: ReadonlyArray<HouseName | null>;
  /** Casas dos usuarios que registraram cada HabitLog. */
  habitLogHouses: ReadonlyArray<HouseName | null>;
  /** Casas dos usuarios que venceram batalhas PvE. */
  pveWinners: ReadonlyArray<HouseName | null>;
};

const FALLBACK_ANIMAL: Record<HouseName, string> = {
  ARION: "Leao",
  LYCUS: "Lobo",
  NOCTIS: "Coruja",
  NEREID: "Sereia",
};

/**
 * Agrega os 5 dados crus em entries do Estandarte.
 * Pura, deterministica — facil de testar.
 */
export function assembleHouseStandardEntries(
  raw: HouseStandardRawData,
): HouseStandardEntry[] {
  const membersByHouse: Record<HouseName, number> = {
    ARION: 0,
    LYCUS: 0,
    NOCTIS: 0,
    NEREID: 0,
  };
  const animalByHouse: Record<HouseName, string> = { ...FALLBACK_ANIMAL };
  for (const h of raw.houses) {
    membersByHouse[h.name] = h.membersCount;
    animalByHouse[h.name] = h.animal;
  }

  const acc = emptyAccumulators();

  for (const houseName of raw.pvp1v1Winners) {
    if (!houseName) continue;
    acc[houseName].points += ESTANDARTE_WEIGHTS.WIN_1V1;
    acc[houseName].events += 1;
  }
  for (const houseName of raw.pvpTeamWinners) {
    if (!houseName) continue;
    acc[houseName].points += ESTANDARTE_WEIGHTS.WIN_TEAM;
    acc[houseName].events += 1;
  }
  for (const houseName of raw.habitLogHouses) {
    if (!houseName) continue;
    acc[houseName].points += ESTANDARTE_WEIGHTS.HABIT;
    acc[houseName].events += 1;
  }
  for (const houseName of raw.pveWinners) {
    if (!houseName) continue;
    acc[houseName].points += ESTANDARTE_WEIGHTS.WIN_PVE;
    acc[houseName].events += 1;
  }

  const entries: HouseStandardEntry[] = HOUSE_NAMES.map((name) => {
    const data = acc[name];
    const members = membersByHouse[name];
    const score = data.points / Math.max(members, 1);
    return {
      rank: 0, // preenchido depois do sort
      house: name,
      animal: animalByHouse[name],
      score,
      totalEvents: data.events,
      membersCount: members,
    };
  });

  // Ordena: score desc; tiebreak totalEvents desc; tiebreak nome asc.
  entries.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (b.totalEvents !== a.totalEvents) return b.totalEvents - a.totalEvents;
    return a.house.localeCompare(b.house);
  });

  for (let i = 0; i < entries.length; i++) {
    entries[i].rank = i + 1;
  }

  return entries;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

export async function getHouseStandardRanking(
  season: RankingSeason,
): Promise<HouseStandardEntry[]> {
  const periodStart = getPeriodStart(season);
  const dateFilter = periodStart ? { gte: periodStart } : undefined;

  // 4 queries paralelas — uma para cada tipo de evento — buscando apenas
  // o houseId de cada participante. A agregacao em memoria e barata
  // comparada a fazer 4 groupBy distintos.
  const [houses, battleWinners, teamWins, habitLogs, pveWins] = await Promise.all([
    // Membros por casa
    prisma.house.findMany({
      select: {
        id: true,
        name: true,
        animal: true,
        _count: {
          select: { users: true },
        },
      },
    }),

    // PvP 1v1 wins (Battle.winnerId)
    prisma.battle.findMany({
      where: {
        status: "FINISHED",
        winnerId: { not: null },
        ...(dateFilter ? { createdAt: dateFilter } : {}),
      },
      select: {
        winner: {
          select: {
            house: { select: { name: true } },
          },
        },
      },
    }),

    // PvP Team wins (TeamBattleParticipant em time vencedor)
    // Buscamos participantes cuja teamBattle tem winnerTeam == participant.team.
    prisma.teamBattleParticipant.findMany({
      where: {
        teamBattle: {
          winnerTeam: { not: null },
          ...(dateFilter ? { finishedAt: dateFilter } : {}),
        },
      },
      select: {
        team: true,
        teamBattle: {
          select: { winnerTeam: true },
        },
        user: {
          select: {
            house: { select: { name: true } },
          },
        },
      },
    }),

    // Habitos completados
    prisma.habitLog.findMany({
      where: dateFilter ? { date: dateFilter } : {},
      select: {
        user: {
          select: {
            house: { select: { name: true } },
          },
        },
      },
    }),

    // Vitorias PvE
    prisma.pveBattle.findMany({
      where: {
        result: "VICTORY",
        ...(dateFilter ? { createdAt: dateFilter } : {}),
      },
      select: {
        user: {
          select: {
            house: { select: { name: true } },
          },
        },
      },
    }),
  ]);

  // Mapeia para HouseStandardRawData e delega para a funcao pura
  return assembleHouseStandardEntries({
    houses: houses.map((h) => ({
      name: h.name,
      animal: h.animal,
      membersCount: h._count.users,
    })),
    pvp1v1Winners: battleWinners.map((b) => b.winner?.house?.name ?? null),
    pvpTeamWinners: teamWins.map((p) =>
      p.teamBattle.winnerTeam === p.team ? p.user.house?.name ?? null : null,
    ),
    habitLogHouses: habitLogs.map((log) => log.user.house?.name ?? null),
    pveWinners: pveWins.map((pve) => pve.user.house?.name ?? null),
  });
}
