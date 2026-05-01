// app/api/admin/cards/route.ts — listagem e criacao de Cristais (admin).
//
// Cada mob suporta ate 3 variantes (requiredStars 1, 2, 3). A constraint
// [mobId, requiredStars] do Prisma e a fonte da verdade — duplicidade vira
// 409 ao cliente. Os campos `requiredStars` e `dropChance` agora sao
// expostos pelo admin (Task 4).

import { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { apiSuccess, apiError } from "@/lib/api-response";
import { cardCreateSchema } from "@/lib/validations/cards";

/** GET /api/admin/cards — lista todas as Cards com info do mob para exibicao. */
export async function GET(_request: NextRequest) {
  try {
    const cards = await prisma.card.findMany({
      orderBy: [
        { mob: { tier: "asc" } },
        { name: "asc" },
        { requiredStars: "asc" },
      ],
      include: {
        mob: {
          select: {
            id: true,
            name: true,
            tier: true,
            imageUrl: true,
          },
        },
      },
    });
    return apiSuccess(cards);
  } catch (error) {
    console.error("[GET /api/admin/cards]", error);
    return apiError("Erro interno do servidor", "INTERNAL_ERROR", 500);
  }
}

/** POST /api/admin/cards — cria uma nova variante de Card vinculada a um mob. */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = cardCreateSchema.safeParse(body);
    if (!parsed.success) {
      return apiError(
        "Dados invalidos",
        "VALIDATION_ERROR",
        422,
        parsed.error.flatten(),
      );
    }

    const mob = await prisma.mob.findUnique({
      where: { id: parsed.data.mobId },
      select: { id: true },
    });
    if (!mob) return apiError("Mob nao encontrado", "MOB_NOT_FOUND", 404);

    const { mobId, name, flavorText, rarity, effects, requiredStars, dropChance } =
      parsed.data;

    const card = await prisma.card.create({
      data: {
        mobId,
        name,
        flavorText,
        rarity,
        effects: effects as unknown as Prisma.InputJsonValue,
        requiredStars,
        dropChance,
      },
    });
    return apiSuccess(card, 201, "Cristal criado com sucesso");
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const target = error.meta?.target;
      const targets = Array.isArray(target) ? target : typeof target === "string" ? [target] : [];
      const isVariantConflict = targets.includes("mobId") && targets.includes("requiredStars");
      if (isVariantConflict) {
        return apiError(
          "Ja existe uma carta para este mob com essa estrela",
          "VARIANT_ALREADY_EXISTS",
          409,
        );
      }
      return apiError("Ja existe uma carta com este nome", "DUPLICATE_NAME", 409);
    }
    console.error("[POST /api/admin/cards]", error);
    return apiError("Erro interno do servidor", "INTERNAL_ERROR", 500);
  }
}
