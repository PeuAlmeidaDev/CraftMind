-- CreateEnum
CREATE TYPE "PvpMode" AS ENUM ('SOLO_1V1', 'TEAM_2V2', 'TEAM_3V3', 'TEAM_5V5');

-- CreateTable
CREATE TABLE "PvpStats" (
    "id" TEXT NOT NULL,
    "characterId" TEXT NOT NULL,
    "mode" "PvpMode" NOT NULL,
    "wins" INTEGER NOT NULL DEFAULT 0,
    "losses" INTEGER NOT NULL DEFAULT 0,
    "draws" INTEGER NOT NULL DEFAULT 0,
    "rankingPoints" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PvpStats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeamBattle" (
    "id" TEXT NOT NULL,
    "mode" "PvpMode" NOT NULL,
    "winnerTeam" INTEGER,
    "status" "BattleStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "turns" INTEGER NOT NULL DEFAULT 0,
    "log" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "TeamBattle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeamBattleParticipant" (
    "id" TEXT NOT NULL,
    "teamBattleId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "characterId" TEXT NOT NULL,
    "team" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TeamBattleParticipant_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PvpStats_mode_rankingPoints_idx" ON "PvpStats"("mode", "rankingPoints");

-- CreateIndex
CREATE UNIQUE INDEX "PvpStats_characterId_mode_key" ON "PvpStats"("characterId", "mode");

-- CreateIndex
CREATE INDEX "TeamBattleParticipant_userId_idx" ON "TeamBattleParticipant"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "TeamBattleParticipant_teamBattleId_userId_key" ON "TeamBattleParticipant"("teamBattleId", "userId");

-- AddForeignKey
ALTER TABLE "PvpStats" ADD CONSTRAINT "PvpStats_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "Character"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamBattleParticipant" ADD CONSTRAINT "TeamBattleParticipant_teamBattleId_fkey" FOREIGN KEY ("teamBattleId") REFERENCES "TeamBattle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamBattleParticipant" ADD CONSTRAINT "TeamBattleParticipant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
