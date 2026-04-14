// lib/auth/refresh-token.ts — Persistencia e rotacao de refresh tokens

import { prisma } from "@/lib/prisma";
import { signRefreshToken, hashToken, generateTokenFamily } from "@/lib/auth/jwt";
import type { RefreshTokenPayload } from "@/lib/auth/jwt";

const REFRESH_TOKEN_EXPIRY_DAYS = 7;

export async function createPersistedRefreshToken(
  payload: RefreshTokenPayload,
  family?: string
): Promise<{ token: string; family: string }> {
  const tokenFamily = family ?? generateTokenFamily();
  const jti = crypto.randomUUID();
  const token = await signRefreshToken(payload, jti);
  const tokenHash = hashToken(token);

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + REFRESH_TOKEN_EXPIRY_DAYS);

  await prisma.refreshToken.create({
    data: {
      userId: payload.userId,
      tokenHash,
      family: tokenFamily,
      expiresAt,
    },
  });

  return { token, family: tokenFamily };
}

export async function rotateRefreshToken(
  currentToken: string,
  payload: RefreshTokenPayload
): Promise<{ token: string; accessDenied: boolean }> {
  const currentHash = hashToken(currentToken);

  // Atomicamente revogar o token apenas se ainda nao estiver revogado.
  // updateMany retorna count=0 se ja estava revogado ou nao existia,
  // eliminando a race condition de dois refreshes simultaneos.
  const revokeResult = await prisma.refreshToken.updateMany({
    where: { tokenHash: currentHash, revoked: false },
    data: { revoked: true },
  });

  // Se nenhuma linha foi atualizada, o token nao existe ou ja foi revogado
  if (revokeResult.count === 0) {
    // Verificar se o token existe (revogado) para invalidar toda a familia
    const stored = await prisma.refreshToken.findUnique({
      where: { tokenHash: currentHash },
      select: { family: true, revoked: true },
    });

    if (stored?.revoked) {
      // Token reutilizado (ja revogado) — revogar TODA a familia (possivel roubo)
      await prisma.refreshToken.updateMany({
        where: { family: stored.family },
        data: { revoked: true },
      });
    }

    return { token: "", accessDenied: true };
  }

  // Buscar a familia do token recem-revogado para emitir o novo na mesma familia
  const stored = await prisma.refreshToken.findUnique({
    where: { tokenHash: currentHash },
    select: { family: true },
  });

  if (!stored) {
    return { token: "", accessDenied: true };
  }

  // Emitir novo token na mesma familia
  const { token } = await createPersistedRefreshToken(payload, stored.family);

  return { token, accessDenied: false };
}

export async function revokeRefreshTokenByValue(token: string): Promise<void> {
  const tokenHash = hashToken(token);

  const stored = await prisma.refreshToken.findUnique({
    where: { tokenHash },
  });

  if (!stored) return;

  // Revogar toda a familia
  await prisma.refreshToken.updateMany({
    where: { family: stored.family },
    data: { revoked: true },
  });
}
