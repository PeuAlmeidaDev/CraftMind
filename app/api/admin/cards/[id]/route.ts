// app/api/admin/cards/[id]/route.ts — leitura, atualizacao e remocao de uma Card (admin).
//
// PATCH e PUT sao tratados como sinonimos (atualizacao parcial validada via Zod).
// Os campos `requiredStars` e `dropChance` agora sao opcionais no payload e
// persistem em `prisma.card.update` quando informados (Task 4).

import { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { apiSuccess, apiError } from "@/lib/api-response";
import { cardUpdateSchema } from "@/lib/validations/cards";

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

async function handleUpdate(request: NextRequest, { params }: RouteParams) {
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

    const data: Prisma.CardUpdateInput = {
      name: parsed.data.name,
      flavorText: parsed.data.flavorText,
      rarity: parsed.data.rarity,
      effects: parsed.data.effects as unknown as Prisma.InputJsonValue,
    };
    if (parsed.data.requiredStars !== undefined) {
      data.requiredStars = parsed.data.requiredStars;
    }
    if (parsed.data.dropChance !== undefined) {
      data.dropChance = parsed.data.dropChance;
    }

    const card = await prisma.card.update({ where: { id }, data });
    return apiSuccess(card);
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
      return apiError("Ja existe um card com este nome", "DUPLICATE_NAME", 409);
    }
    console.error("[PATCH /api/admin/cards/:id]", error);
    return apiError("Erro interno do servidor", "INTERNAL_ERROR", 500);
  }
}

export async function PATCH(request: NextRequest, ctx: RouteParams) {
  return handleUpdate(request, ctx);
}

export async function PUT(request: NextRequest, ctx: RouteParams) {
  return handleUpdate(request, ctx);
}

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const existing = await prisma.card.findUnique({ where: { id } });
    if (!existing) return apiError("Card nao encontrado", "NOT_FOUND", 404);

    await prisma.card.delete({ where: { id } });
    return apiSuccess({ id });
  } catch (error) {
    console.error("[DELETE /api/admin/cards/:id]", error);
    return apiError("Erro interno do servidor", "INTERNAL_ERROR", 500);
  }
}
