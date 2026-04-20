import { prisma } from "@/lib/prisma";

export interface PublicProfileData {
  id: string;
  name: string;
  avatarUrl: string | null;
  house: { name: string; animal: string } | null;
  character: {
    level: number;
    physicalAtk: number;
    physicalDef: number;
    magicAtk: number;
    magicDef: number;
    hp: number;
    speed: number;
  } | null;
  pvpStats: {
    totalBattles: number;
    wins: number;
    losses: number;
    draws: number;
  };
}

export async function getPublicProfile(userId: string): Promise<PublicProfileData | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      avatarUrl: true,
      house: {
        select: {
          name: true,
          animal: true,
        },
      },
      character: {
        select: {
          level: true,
          physicalAtk: true,
          physicalDef: true,
          magicAtk: true,
          magicDef: true,
          hp: true,
          speed: true,
        },
      },
    },
  });

  if (!user) {
    return null;
  }

  const [pvpBattles, pvpWins, pvpDraws] = await Promise.all([
    prisma.battle.count({
      where: {
        OR: [{ player1Id: userId }, { player2Id: userId }],
        status: "FINISHED",
      },
    }),
    prisma.battle.count({
      where: { winnerId: userId, status: "FINISHED" },
    }),
    prisma.battle.count({
      where: {
        OR: [{ player1Id: userId }, { player2Id: userId }],
        status: "FINISHED",
        winnerId: null,
      },
    }),
  ]);

  return {
    id: user.id,
    name: user.name,
    avatarUrl: user.avatarUrl,
    house: user.house,
    character: user.character,
    pvpStats: {
      totalBattles: pvpBattles,
      wins: pvpWins,
      losses: pvpBattles - pvpWins - pvpDraws,
      draws: pvpDraws,
    },
  };
}
