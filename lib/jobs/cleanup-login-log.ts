// lib/jobs/cleanup-login-log.ts — Script de retencao 90 dias para LoginLog
//
// Executar manualmente via:
//   npx tsx lib/jobs/cleanup-login-log.ts
//
// Agendamento (cron Railway / Vercel) e responsabilidade de ops — fora do
// escopo desta fase. O script e standalone (puro Node + Prisma) e desliga
// o client ao final.

import { prisma } from "@/lib/prisma";

const RETENTION_DAYS = 90;

async function main(): Promise<void> {
  const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000);

  console.log(
    `[cleanup-login-log] Deletando LoginLog com loggedInAt < ${cutoff.toISOString()} (retencao ${RETENTION_DAYS} dias)`
  );

  const result = await prisma.loginLog.deleteMany({
    where: {
      loggedInAt: { lt: cutoff },
    },
  });

  console.log(`[cleanup-login-log] ${result.count} linha(s) deletada(s).`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
    process.exit(0);
  })
  .catch(async (err: unknown) => {
    console.error("[cleanup-login-log] erro:", err);
    await prisma.$disconnect().catch(() => {
      // ignore
    });
    process.exit(1);
  });
