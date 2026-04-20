import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifySession, AuthenticationError } from "@/lib/auth/verify-session";
import { apiSuccess, apiError } from "@/lib/api-response";
import { getPublicProfile } from "@/lib/helpers/public-profile";
import { z } from "zod";

const nameParamSchema = z.object({
  name: z.string().min(1, "Nome e obrigatorio").max(50, "Nome muito longo").trim(),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  try {
    await verifySession(request);

    const resolvedParams = await params;
    const parsed = nameParamSchema.safeParse(resolvedParams);

    if (!parsed.success) {
      return apiError("Nome de usuario invalido", "VALIDATION_ERROR", 422);
    }

    const targetName = parsed.data.name;

    const user = await prisma.user.findUnique({
      where: { name: targetName },
      select: { id: true },
    });

    if (!user) {
      return apiError("Jogador nao encontrado", "USER_NOT_FOUND", 404);
    }

    const profile = await getPublicProfile(user.id);

    if (!profile) {
      return apiError("Jogador nao encontrado", "USER_NOT_FOUND", 404);
    }

    return apiSuccess(profile);
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return apiError(error.message, error.code, error.statusCode);
    }

    console.error("[GET /api/user/by-name/[name]/profile]", error);
    return apiError("Erro interno do servidor", "INTERNAL_ERROR", 500);
  }
}
