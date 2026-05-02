// app/api/user/showcase/route.ts
//
// PUT /api/user/showcase — define a vitrine publica do usuario autenticado.
//   Body: { userCardIds: string[] } — ate 6, ordem preservada.
//
// Validacoes:
//   - 401 se sem auth.
//   - 422 se payload invalido (nao-array, > 6, ID nao-string).
//   - 422 se algum userCardId NAO pertence ao usuario autenticado (ownership
//     check via Prisma findMany filtrado por userId).
//   - Idempotente: upsert por userId (constraint unique em UserShowcase.userId).
//
// IDs duplicados no array sao removidos preservando a primeira ocorrencia.

import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { verifySession, AuthenticationError } from "@/lib/auth/verify-session";
import { apiSuccess, apiError } from "@/lib/api-response";

const SHOWCASE_MAX = 6;

const showcaseSchema = z.object({
  userCardIds: z
    .array(z.string().min(1, "userCardId nao pode ser vazio"))
    .max(SHOWCASE_MAX, `Maximo de ${SHOWCASE_MAX} cristais na vitrine`),
});

export async function PUT(request: NextRequest) {
  try {
    const { userId } = await verifySession(request);

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return apiError("Body invalido", "INVALID_BODY", 422);
    }

    const parsed = showcaseSchema.safeParse(body);
    if (!parsed.success) {
      return apiError(
        "Dados invalidos",
        "VALIDATION_ERROR",
        422,
        parsed.error.flatten(),
      );
    }

    // Dedup preservando ordem.
    const seen = new Set<string>();
    const userCardIds: string[] = [];
    for (const id of parsed.data.userCardIds) {
      if (!seen.has(id)) {
        seen.add(id);
        userCardIds.push(id);
      }
    }

    // Ownership check: todos os IDs devem pertencer ao usuario autenticado.
    if (userCardIds.length > 0) {
      const owned = await prisma.userCard.findMany({
        where: { userId, id: { in: userCardIds } },
        select: { id: true },
      });
      if (owned.length !== userCardIds.length) {
        return apiError(
          "Um ou mais cristais nao pertencem ao seu inventario",
          "INVALID_OWNERSHIP",
          422,
        );
      }
    }

    const showcase = await prisma.userShowcase.upsert({
      where: { userId },
      create: { userId, userCardIds },
      update: { userCardIds },
      select: { userCardIds: true, updatedAt: true },
    });

    return apiSuccess({
      userCardIds: showcase.userCardIds,
      updatedAt: showcase.updatedAt.toISOString(),
    });
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return apiError(error.message, error.code, error.statusCode);
    }
    console.error("[PUT /api/user/showcase]", error);
    return apiError("Erro interno do servidor", "INTERNAL_ERROR", 500);
  }
}
