// lib/ranking/pvp.ts — Ranking PvP por modo (SOLO_1V1 ou TEAM_2V2)
//
// Le PvpStats agregado por (characterId, mode) e ordena por
// rankingPoints desc, depois wins desc como tiebreak. Filtragem por
// casa via include encadeado: PvpStats -> Character -> User -> House.

import type { PvpMode } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { HouseFilter, RankingPvpEntry } from "@/types/ranking";

export async function getPvpRanking(
  mode: PvpMode,
  house: HouseFilter,
  limit: number,
): Promise<RankingPvpEntry[]> {
  const userWhere =
    house === "GLOBAL" ? undefined : { houseId: { not: null }, house: { name: house } };

  const stats = await prisma.pvpStats.findMany({
    where: {
      mode,
      character: {
        user: userWhere,
      },
    },
    orderBy: [
      { rankingPoints: "desc" },
      { wins: "desc" },
    ],
    take: limit,
    select: {
      rankingPoints: true,
      wins: true,
      losses: true,
      draws: true,
      character: {
        select: {
          level: true,
          user: {
            select: {
              id: true,
              name: true,
              avatarUrl: true,
              house: {
                select: { name: true },
              },
            },
          },
        },
      },
    },
  });

  return stats.map((row, index): RankingPvpEntry => {
    const user = row.character.user;
    return {
      rank: index + 1,
      userId: user.id,
      name: user.name,
      avatarUrl: user.avatarUrl,
      house: user.house?.name ?? null,
      level: row.character.level,
      rankingPoints: row.rankingPoints,
      wins: row.wins,
      losses: row.losses,
      draws: row.draws,
    };
  });
}
