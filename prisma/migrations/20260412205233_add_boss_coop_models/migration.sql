-- AlterTable
ALTER TABLE "Character" ADD COLUMN     "bossEssence" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "Boss" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "lore" TEXT NOT NULL,
    "category" "HabitCategory" NOT NULL,
    "tier" INTEGER NOT NULL,
    "aiProfile" TEXT NOT NULL,
    "physicalAtk" INTEGER NOT NULL,
    "physicalDef" INTEGER NOT NULL,
    "magicAtk" INTEGER NOT NULL,
    "magicDef" INTEGER NOT NULL,
    "hp" INTEGER NOT NULL,
    "speed" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Boss_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BossSkill" (
    "id" TEXT NOT NULL,
    "bossId" TEXT NOT NULL,
    "skillId" TEXT NOT NULL,
    "slotIndex" INTEGER NOT NULL,

    CONSTRAINT "BossSkill_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CoopBattle" (
    "id" TEXT NOT NULL,
    "bossId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'MATCHING',
    "result" TEXT,
    "turns" INTEGER NOT NULL DEFAULT 0,
    "expGained" INTEGER NOT NULL DEFAULT 0,
    "log" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CoopBattle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CoopBattleParticipant" (
    "id" TEXT NOT NULL,
    "coopBattleId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "dominantCategory" "HabitCategory" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CoopBattleParticipant_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Boss_name_key" ON "Boss"("name");

-- CreateIndex
CREATE UNIQUE INDEX "BossSkill_bossId_skillId_key" ON "BossSkill"("bossId", "skillId");

-- CreateIndex
CREATE UNIQUE INDEX "BossSkill_bossId_slotIndex_key" ON "BossSkill"("bossId", "slotIndex");

-- CreateIndex
CREATE INDEX "CoopBattle_date_status_idx" ON "CoopBattle"("date", "status");

-- CreateIndex
CREATE INDEX "CoopBattleParticipant_userId_idx" ON "CoopBattleParticipant"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "CoopBattleParticipant_coopBattleId_userId_key" ON "CoopBattleParticipant"("coopBattleId", "userId");

-- AddForeignKey
ALTER TABLE "BossSkill" ADD CONSTRAINT "BossSkill_bossId_fkey" FOREIGN KEY ("bossId") REFERENCES "Boss"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BossSkill" ADD CONSTRAINT "BossSkill_skillId_fkey" FOREIGN KEY ("skillId") REFERENCES "Skill"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoopBattle" ADD CONSTRAINT "CoopBattle_bossId_fkey" FOREIGN KEY ("bossId") REFERENCES "Boss"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoopBattleParticipant" ADD CONSTRAINT "CoopBattleParticipant_coopBattleId_fkey" FOREIGN KEY ("coopBattleId") REFERENCES "CoopBattle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoopBattleParticipant" ADD CONSTRAINT "CoopBattleParticipant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
