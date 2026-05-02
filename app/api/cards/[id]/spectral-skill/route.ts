// app/api/cards/[id]/spectral-skill/route.ts
//
// GET — retorna as 4 mob skills do mob de origem de um UserCard Espectral, para
//        alimentar o modal de selecao no frontend.
//        Validacoes: 404 UserCard nao existe; 403 ownership; 422 purity != 100.
//        Resposta: { skills: [{ id, name, description, tier, target, damageType,
//                  basePower, hits, accuracy, slotIndex }], currentSkillId | null }
//
// PUT — define a skill espectral (5o slot em batalha) para um Cristal Espectral
//        (UserCard com purity 100).
//   Body: { skillId: string }  (validado por spectralSkillSchema)
//   Validacoes:
//     - 401 se nao autenticado
//     - 404 se UserCard nao existe
//     - 403 se UserCard.userId !== session.userId
//     - 422 se UserCard.purity !== 100
//     - 422 se skillId NAO pertence aos 4 mob skills do mob de origem da carta
//   Resposta: { ok: true, spectralSkillId }

import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifySession, AuthenticationError } from "@/lib/auth/verify-session";
import { apiSuccess, apiError } from "@/lib/api-response";
import { spectralSkillSchema } from "@/lib/validations/cards";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { userId } = await verifySession(request);
    const { id: userCardId } = await context.params;

    if (!userCardId || typeof userCardId !== "string") {
      return apiError("Param `id` invalido", "INVALID_PARAM", 400);
    }

    const userCard = await prisma.userCard.findUnique({
      where: { id: userCardId },
      select: {
        id: true,
        userId: true,
        purity: true,
        spectralSkillId: true,
        card: {
          select: {
            mob: {
              select: {
                id: true,
                skills: {
                  orderBy: { slotIndex: "asc" },
                  select: {
                    slotIndex: true,
                    skill: {
                      select: {
                        id: true,
                        name: true,
                        description: true,
                        tier: true,
                        cooldown: true,
                        target: true,
                        damageType: true,
                        basePower: true,
                        hits: true,
                        accuracy: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!userCard) {
      return apiError("Cristal nao encontrado", "USER_CARD_NOT_FOUND", 404);
    }

    if (userCard.userId !== userId) {
      return apiError("Este cristal nao pertence a voce", "NOT_YOUR_CARD", 403);
    }

    if (userCard.purity !== 100) {
      return apiError(
        "Apenas cristais Espectrais (100% pureza) podem desbloquear skill",
        "NOT_SPECTRAL",
        422,
      );
    }

    const skills = userCard.card.mob.skills.map((ms) => ({
      id: ms.skill.id,
      name: ms.skill.name,
      description: ms.skill.description,
      tier: ms.skill.tier,
      cooldown: ms.skill.cooldown,
      target: ms.skill.target,
      damageType: ms.skill.damageType,
      basePower: ms.skill.basePower,
      hits: ms.skill.hits,
      accuracy: ms.skill.accuracy,
      slotIndex: ms.slotIndex,
    }));

    return apiSuccess({
      skills,
      currentSkillId: userCard.spectralSkillId,
      mobId: userCard.card.mob.id,
    });
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return apiError(error.message, error.code, error.statusCode);
    }
    console.error("[GET /api/cards/[id]/spectral-skill]", error);
    return apiError("Erro interno do servidor", "INTERNAL_ERROR", 500);
  }
}

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { userId } = await verifySession(request);
    const { id: userCardId } = await context.params;

    if (!userCardId || typeof userCardId !== "string") {
      return apiError("Param `id` invalido", "INVALID_PARAM", 400);
    }

    const body: unknown = await request.json().catch(() => null);
    if (!body) {
      return apiError("Body da requisicao invalido", "INVALID_BODY", 400);
    }

    const parsed = spectralSkillSchema.safeParse(body);
    if (!parsed.success) {
      return apiError(
        "Dados invalidos",
        "VALIDATION_ERROR",
        422,
        parsed.error.flatten(),
      );
    }

    const { skillId } = parsed.data;

    const userCard = await prisma.userCard.findUnique({
      where: { id: userCardId },
      select: {
        id: true,
        userId: true,
        purity: true,
        card: { select: { mobId: true } },
      },
    });

    if (!userCard) {
      return apiError("Cristal nao encontrado", "USER_CARD_NOT_FOUND", 404);
    }

    if (userCard.userId !== userId) {
      return apiError("Este cristal nao pertence a voce", "NOT_YOUR_CARD", 403);
    }

    if (userCard.purity !== 100) {
      return apiError(
        "Apenas cristais Espectrais (100% pureza) podem desbloquear skill",
        "NOT_SPECTRAL",
        422,
      );
    }

    // skillId DEVE pertencer aos 4 mob skills do mob de origem da carta
    const mobSkill = await prisma.mobSkill.findFirst({
      where: {
        mobId: userCard.card.mobId,
        skillId,
      },
      select: { id: true },
    });

    if (!mobSkill) {
      return apiError(
        "Skill nao pertence ao mob de origem deste cristal",
        "SKILL_NOT_OF_MOB",
        422,
      );
    }

    await prisma.userCard.update({
      where: { id: userCardId },
      data: { spectralSkillId: skillId },
    });

    return apiSuccess({ ok: true, spectralSkillId: skillId });
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return apiError(error.message, error.code, error.statusCode);
    }
    console.error("[PUT /api/cards/[id]/spectral-skill]", error);
    return apiError("Erro interno do servidor", "INTERNAL_ERROR", 500);
  }
}
