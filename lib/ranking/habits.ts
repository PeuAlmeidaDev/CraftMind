// lib/ranking/habits.ts — Ranking de habitos completados (lifetime)
//
// groupBy(HabitLog, userId) com _count e ordering por count desc.
// Apos groupBy, busca os Users em uma unica query e cruza em memoria.
// Filtra por casa via where do User na segunda query.

import { prisma } from "@/lib/prisma";
import type { HouseFilter, RankingHabitsEntry } from "@/types/ranking";

export async function getHabitsRanking(
  house: HouseFilter,
  limit: number,
): Promise<RankingHabitsEntry[]> {
  // groupBy traz mais que `limit` quando filtramos por casa, porque alguns
  // userIds podem nao bater no filtro. Pegamos uma margem 4x para reduzir
  // a chance de precisar de uma segunda passada — quando o filtro casa nao
  // e GLOBAL, isso e otimizacao razoavel para os volumes esperados (MVP).
  const fetchSize = house === "GLOBAL" ? limit : Math.min(limit * 4, 400);

  const grouped = await prisma.habitLog.groupBy({
    by: ["userId"],
    _count: { _all: true },
    orderBy: { _count: { userId: "desc" } },
    take: fetchSize,
  });

  if (grouped.length === 0) return [];

  const userIds = grouped.map((g) => g.userId);

  const userWhere =
    house === "GLOBAL"
      ? { id: { in: userIds } }
      : { id: { in: userIds }, houseId: { not: null }, house: { name: house } };

  const users = await prisma.user.findMany({
    where: userWhere,
    select: {
      id: true,
      name: true,
      avatarUrl: true,
      house: {
        select: { name: true },
      },
      character: {
        select: { level: true },
      },
    },
  });

  const userById = new Map(users.map((u) => [u.id, u]));

  // Mantem a ordem do groupBy (count desc), filtra os que sumiram pelo
  // filtro de casa, aplica o limite final.
  const entries: RankingHabitsEntry[] = [];
  for (const row of grouped) {
    if (entries.length >= limit) break;
    const user = userById.get(row.userId);
    if (!user) continue;

    entries.push({
      rank: entries.length + 1,
      userId: user.id,
      name: user.name,
      avatarUrl: user.avatarUrl,
      house: user.house?.name ?? null,
      level: user.character?.level ?? 1,
      habitCount: row._count._all,
    });
  }

  return entries;
}
