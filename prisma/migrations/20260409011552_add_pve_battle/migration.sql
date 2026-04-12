-- CreateTable
CREATE TABLE "PveBattle" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "mobId" TEXT NOT NULL,
    "result" TEXT,
    "expGained" INTEGER NOT NULL DEFAULT 0,
    "turns" INTEGER NOT NULL DEFAULT 0,
    "log" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PveBattle_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "PveBattle" ADD CONSTRAINT "PveBattle_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PveBattle" ADD CONSTRAINT "PveBattle_mobId_fkey" FOREIGN KEY ("mobId") REFERENCES "Mob"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
