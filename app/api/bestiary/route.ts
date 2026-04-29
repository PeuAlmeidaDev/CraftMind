// app/api/bestiary/route.ts — GET retorna o bestiario do usuario autenticado.
//
// Resposta: { entries: BestiaryEntry[], totals: { discovered, studied, mastered, total } }
// - Busca todos os mobs cadastrados (independente do usuario ter visto).
// - Une com MobKillStat do usuario (left join via map em memoria — N pequeno, 12 mobs).
// - Aplica gating de campos via buildBestiaryEntry conforme tier de unlock.
// - Inclui info de cristal possuido (raridade) por mob.

import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifySession, AuthenticationError } from "@/lib/auth/verify-session";
import { apiSuccess, apiError } from "@/lib/api-response";
import { buildBestiaryEntry } from "@/lib/bestiary/progression";
import type { BestiaryResponse, CardRarity } from "@/types/cards";
import { BestiaryUnlockTier } from "@/types/cards";

export async function GET(request: NextRequest) {
  try {
    const { userId } = await verifySession(request);

    // Busca em paralelo: todos os mobs (com skills + card), kill stats do user,
    // e user cards do user (para saber quais cards ele tem).
    const [mobs, killStats, userCards] = await Promise.all([
      prisma.mob.findMany({
        orderBy: [{ tier: "asc" }, { name: "asc" }],
        include: {
          skills: {
            orderBy: { slotIndex: "asc" },
            include: {
              skill: {
                select: {
                  name: true,
                  tier: true,
                  damageType: true,
                },
              },
            },
          },
          card: { select: { id: true, rarity: true, cardArtUrl: true } },
        },
      }),
      prisma.mobKillStat.findMany({ where: { userId } }),
      prisma.userCard.findMany({
        where: { userId },
        select: { cardId: true },
      }),
    ]);

    const killStatByMobId = new Map(
      killStats.map((k) => [k.mobId, k]),
    );
    const ownedCardIds = new Set(userCards.map((u) => u.cardId));

    const entries = mobs.map((mob) => {
      const ks = killStatByMobId.get(mob.id) ?? null;
      const hasCard = mob.card ? ownedCardIds.has(mob.card.id) : false;
      const cardRarity: CardRarity | null =
        mob.card && hasCard ? (mob.card.rarity as CardRarity) : null;
      const cardArtUrl: string | null = mob.card?.cardArtUrl ?? null;

      return buildBestiaryEntry({
        mob: {
          id: mob.id,
          name: mob.name,
          description: mob.description,
          tier: mob.tier,
          aiProfile: mob.aiProfile,
          imageUrl: mob.imageUrl ?? null,
          loreExpanded: mob.loreExpanded,
          curiosity: mob.curiosity,
          physicalAtk: mob.physicalAtk,
          physicalDef: mob.physicalDef,
          magicAtk: mob.magicAtk,
          magicDef: mob.magicDef,
          hp: mob.hp,
          speed: mob.speed,
          skills: mob.skills.map((ms) => ({
            name: ms.skill.name,
            tier: ms.skill.tier,
            damageType: ms.skill.damageType,
          })),
        },
        killStat: ks
          ? {
              victories: ks.victories,
              defeats: ks.defeats,
              damageDealt: ks.damageDealt,
              firstSeenAt: ks.firstSeenAt,
              lastSeenAt: ks.lastSeenAt,
            }
          : null,
        hasCard,
        cardRarity,
        cardArtUrl,
      });
    });

    const totals = {
      total: entries.length,
      discovered: entries.filter(
        (e) =>
          e.unlockTier === BestiaryUnlockTier.DISCOVERED ||
          e.unlockTier === BestiaryUnlockTier.STUDIED ||
          e.unlockTier === BestiaryUnlockTier.MASTERED,
      ).length,
      studied: entries.filter(
        (e) =>
          e.unlockTier === BestiaryUnlockTier.STUDIED ||
          e.unlockTier === BestiaryUnlockTier.MASTERED,
      ).length,
      mastered: entries.filter(
        (e) => e.unlockTier === BestiaryUnlockTier.MASTERED,
      ).length,
    };

    const response: BestiaryResponse = { entries, totals };
    return apiSuccess(response);
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return apiError(error.message, error.code, error.statusCode);
    }
    console.error("[GET /api/bestiary]", error);
    return apiError("Erro interno do servidor", "INTERNAL_ERROR", 500);
  }
}
