import { NextRequest } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { apiSuccess, apiError } from "@/lib/api-response";
import { z } from "zod";
import { cardEffectsArraySchema } from "@/lib/validations/cards";

const cardUpdateSchema = z.object({
  name: z.string().min(1).max(100),
  flavorText: z.string().min(1).max(500),
  rarity: z.enum(["COMUM", "INCOMUM", "RARO", "EPICO", "LENDARIO"]),
  effects: cardEffectsArraySchema,
});

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const card = await prisma.card.findUnique({
      where: { id },
      include: {
        mob: {
          select: { id: true, name: true, tier: true, imageUrl: true },
        },
      },
    });
    if (!card) return apiError("Card nao encontrado", "NOT_FOUND", 404);
    return apiSuccess(card);
  } catch (error) {
    console.error("[GET /api/admin/cards/:id]", error);
    return apiError("Erro interno do servidor", "INTERNAL_ERROR", 500);
  }
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const existing = await prisma.card.findUnique({ where: { id } });
    if (!existing) return apiError("Card nao encontrado", "NOT_FOUND", 404);

    const body = await request.json();
    const parsed = cardUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return apiError(
        "Dados invalidos",
        "VALIDATION_ERROR",
        422,
        parsed.error.flatten(),
      );
    }

    const card = await prisma.card.update({
      where: { id },
      data: {
        name: parsed.data.name,
        flavorText: parsed.data.flavorText,
        rarity: parsed.data.rarity,
        effects: parsed.data.effects as unknown as Prisma.InputJsonValue,
      },
    });
    return apiSuccess(card);
  } catch (error) {
    if (
      error instanceof Error &&
      "code" in error &&
      (error as { code: string }).code === "P2002"
    ) {
      return apiError("Ja existe um card com este nome", "DUPLICATE_NAME", 409);
    }
    console.error("[PUT /api/admin/cards/:id]", error);
    return apiError("Erro interno do servidor", "INTERNAL_ERROR", 500);
  }
}
