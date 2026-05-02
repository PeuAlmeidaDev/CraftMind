// lib/auth/log-login.ts — Helper async puro para registrar login na tabela LoginLog
//
// Append-only: nunca atualiza, sempre cria nova linha.
// Caller decide se ignora erro (.catch) ou propaga — este helper apenas
// trunca defensivamente os campos e chama o Prisma.

import { prisma } from "@/lib/prisma";

export type LogLoginInput = {
  userId: string;
  visitorId: string;
  ip: string;
  userAgent: string;
};

const MAX_USER_AGENT = 500;
const MAX_IP = 45; // cabe IPv6 max length
const MAX_VISITOR_ID = 100;

/** Trunca string para tamanho maximo. Strings curtas passam intactas. */
function truncate(value: string, max: number): string {
  if (value.length <= max) return value;
  return value.slice(0, max);
}

/**
 * Registra um login na tabela LoginLog.
 *
 * Faz truncamento defensivo dos campos (string absurda do client nao explode
 * o banco). Pode propagar erro do Prisma — quem chama decide se ignora com
 * `.catch(console.error)` (padrao em rotas de auth) ou propaga.
 */
export async function logLogin(input: LogLoginInput): Promise<void> {
  await prisma.loginLog.create({
    data: {
      userId: input.userId,
      visitorId: truncate(input.visitorId, MAX_VISITOR_ID),
      ip: truncate(input.ip, MAX_IP),
      userAgent: truncate(input.userAgent, MAX_USER_AGENT),
    },
  });
}
