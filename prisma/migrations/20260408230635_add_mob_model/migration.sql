-- CreateTable
CREATE TABLE "Mob" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
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

    CONSTRAINT "Mob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MobSkill" (
    "id" TEXT NOT NULL,
    "mobId" TEXT NOT NULL,
    "skillId" TEXT NOT NULL,
    "slotIndex" INTEGER NOT NULL,

    CONSTRAINT "MobSkill_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Mob_name_key" ON "Mob"("name");

-- CreateIndex
CREATE UNIQUE INDEX "MobSkill_mobId_skillId_key" ON "MobSkill"("mobId", "skillId");

-- CreateIndex
CREATE UNIQUE INDEX "MobSkill_mobId_slotIndex_key" ON "MobSkill"("mobId", "slotIndex");

-- AddForeignKey
ALTER TABLE "MobSkill" ADD CONSTRAINT "MobSkill_mobId_fkey" FOREIGN KEY ("mobId") REFERENCES "Mob"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MobSkill" ADD CONSTRAINT "MobSkill_skillId_fkey" FOREIGN KEY ("skillId") REFERENCES "Skill"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
