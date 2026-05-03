// app/api/cards/total-count/route.ts — total de Cards cadastrados no jogo.
//
// Usado pela tela /inventario para o stat "X / Y cartas unicas". Conta TODAS
// as variantes de cristal cadastradas, independente do usuario.

import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifySession, AuthenticationError } from "@/lib/auth/verify-session";
import { apiSuccess, apiError } from "@/lib/api-response";

export async function GET(request: NextRequest) {
  try {
    await verifySession(request);

    const totalCards = await prisma.card.count();

    return apiSuccess({ totalCards });
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return apiError(error.message, error.code, error.statusCode);
    }
    console.error("[GET /api/cards/total-count]", error);
    return apiError("Erro interno do servidor", "INTERNAL_ERROR", 500);
  }
}
