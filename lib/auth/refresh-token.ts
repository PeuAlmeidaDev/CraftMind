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

  const stored = await prisma.refreshToken.findUnique({
    where: { tokenHash: currentHash },
  });

  if (!stored) {
    return { token: "", accessDenied: true };
  }

  // Token reutilizado (ja revogado) — revogar TODA a familia (possivel roubo)
  if (stored.revoked) {
    await prisma.refreshToken.updateMany({
      where: { family: stored.family },
      data: { revoked: true },
    });
    return { token: "", accessDenied: true };
  }

  // Revogar o token atual
  await prisma.refreshToken.update({
    where: { id: stored.id },
    data: { revoked: true },
  });

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
