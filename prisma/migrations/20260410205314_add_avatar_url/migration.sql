-- AlterTable
ALTER TABLE "User" ADD COLUMN     "avatarUrl" TEXT;

-- CreateIndex
CREATE INDEX "Battle_player1Id_idx" ON "Battle"("player1Id");

-- CreateIndex
CREATE INDEX "Battle_player2Id_idx" ON "Battle"("player2Id");

-- CreateIndex
CREATE INDEX "Battle_status_idx" ON "Battle"("status");

-- CreateIndex
CREATE INDEX "PveBattle_userId_createdAt_idx" ON "PveBattle"("userId", "createdAt");
