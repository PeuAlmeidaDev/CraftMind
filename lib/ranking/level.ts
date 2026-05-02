// lib/ranking/level.ts — Ranking de Level/EXP (lifetime)
//
// Ordena Character por level desc com currentExp desc como tiebreak.
// Filtra por casa via relacao Character.user.house.

import { prisma } from "@/lib/prisma";
import type { HouseFilter, RankingLevelEntry } from "@/types/ranking";

export async function getLevelRanking(
  house: HouseFilter,
  limit: number,
): Promise<RankingLevelEntry[]> {
  const userWhere =
    house === "GLOBAL"
      ? undefined
      : { houseId: { not: null }, house: { name: house } };

  const characters = await prisma.character.findMany({
    where: {
      user: userWhere,
    },
    orderBy: [
      { level: "desc" },
      { currentExp: "desc" },
    ],
    take: limit,
    select: {
      level: true,
      currentExp: true,
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
  });

  return characters.map((row, index): RankingLevelEntry => {
    const user = row.user;
    return {
      rank: index + 1,
      userId: user.id,
      name: user.name,
      avatarUrl: user.avatarUrl,
      house: user.house?.name ?? null,
      level: row.level,
      currentExp: row.currentExp,
    };
  });
}
