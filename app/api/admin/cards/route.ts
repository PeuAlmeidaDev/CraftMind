import { NextRequest } from "next/server";
import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { apiSuccess, apiError } from "@/lib/api-response";
import { cardEffectsArraySchema } from "@/lib/validations/cards";

/** GET /api/admin/cards — lista todas as Cards (1 por mob), com info do mob para exibicao. */
export async function GET(_request: NextRequest) {
  try {
    const cards = await prisma.card.findMany({
      orderBy: [{ mob: { tier: "asc" } }, { name: "asc" }],
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

const cardCreateSchema = z.object({
  mobId: z.string().min(1, "mobId obrigatorio"),
  name: z.string().min(1).max(100),
  flavorText: z.string().min(1).max(500),
  rarity: z.enum(["COMUM", "INCOMUM", "RARO", "EPICO", "LENDARIO"]),
  effects: cardEffectsArraySchema,
});

/** POST /api/admin/cards — cria uma nova Card vinculada a um mob (1 por mob, schema atual). */
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

    const existing = await prisma.card.findUnique({
      where: { mobId: parsed.data.mobId },
      select: { id: true },
    });
    if (existing) {
      return apiError(
        "Este mob ja possui uma carta",
        "CARD_ALREADY_EXISTS",
        409,
      );
    }

    const card = await prisma.card.create({
      data: {
        mobId: parsed.data.mobId,
        name: parsed.data.name,
        flavorText: parsed.data.flavorText,
        rarity: parsed.data.rarity,
        effects: parsed.data.effects as unknown as Prisma.InputJsonValue,
      },
    });
    return apiSuccess(card, 201, "Cristal criado com sucesso");
  } catch (error) {
    if (
      error instanceof Error &&
      "code" in error &&
      (error as { code: string }).code === "P2002"
    ) {
      return apiError("Ja existe uma carta com este nome", "DUPLICATE_NAME", 409);
    }
    console.error("[POST /api/admin/cards]", error);
    return apiError("Erro interno do servidor", "INTERNAL_ERROR", 500);
  }
}
