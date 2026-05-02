-- AlterTable
ALTER TABLE "UserCard" ADD COLUMN     "spectralSkillId" TEXT;

-- CreateIndex
CREATE INDEX "UserCard_spectralSkillId_idx" ON "UserCard"("spectralSkillId");

-- AddForeignKey
ALTER TABLE "UserCard" ADD CONSTRAINT "UserCard_spectralSkillId_fkey" FOREIGN KEY ("spectralSkillId") REFERENCES "Skill"("id") ON DELETE SET NULL ON UPDATE CASCADE;
