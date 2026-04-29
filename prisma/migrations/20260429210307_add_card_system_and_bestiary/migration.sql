-- CreateEnum
CREATE TYPE "CardRarity" AS ENUM ('COMUM', 'INCOMUM', 'RARO', 'EPICO', 'LENDARIO');

-- AlterTable
ALTER TABLE "Mob" ADD COLUMN     "curiosity" TEXT,
ADD COLUMN     "loreExpanded" TEXT;

-- CreateTable
CREATE TABLE "Card" (
    "id" TEXT NOT NULL,
    "mobId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "flavorText" TEXT NOT NULL,
    "rarity" "CardRarity" NOT NULL,
    "effects" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Card_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserCard" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "cardId" TEXT NOT NULL,
    "equipped" BOOLEAN NOT NULL DEFAULT false,
    "slotIndex" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserCard_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MobKillStat" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "mobId" TEXT NOT NULL,
    "victories" INTEGER NOT NULL DEFAULT 0,
    "defeats" INTEGER NOT NULL DEFAULT 0,
    "damageDealt" INTEGER NOT NULL DEFAULT 0,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MobKillStat_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Card_mobId_key" ON "Card"("mobId");

-- CreateIndex
CREATE UNIQUE INDEX "Card_name_key" ON "Card"("name");

-- CreateIndex
CREATE INDEX "UserCard_userId_idx" ON "UserCard"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "UserCard_userId_cardId_key" ON "UserCard"("userId", "cardId");

-- CreateIndex
CREATE UNIQUE INDEX "UserCard_userId_slotIndex_key" ON "UserCard"("userId", "slotIndex");

-- CreateIndex
CREATE INDEX "MobKillStat_userId_idx" ON "MobKillStat"("userId");

-- CreateIndex
CREATE INDEX "MobKillStat_mobId_idx" ON "MobKillStat"("mobId");

-- CreateIndex
CREATE UNIQUE INDEX "MobKillStat_userId_mobId_key" ON "MobKillStat"("userId", "mobId");

-- AddForeignKey
ALTER TABLE "Card" ADD CONSTRAINT "Card_mobId_fkey" FOREIGN KEY ("mobId") REFERENCES "Mob"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserCard" ADD CONSTRAINT "UserCard_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserCard" ADD CONSTRAINT "UserCard_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "Card"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MobKillStat" ADD CONSTRAINT "MobKillStat_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MobKillStat" ADD CONSTRAINT "MobKillStat_mobId_fkey" FOREIGN KEY ("mobId") REFERENCES "Mob"("id") ON DELETE CASCADE ON UPDATE CASCADE;
