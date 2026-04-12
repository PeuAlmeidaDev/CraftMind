/*
  Warnings:

  - You are about to drop the column `power` on the `Skill` table. All the data in the column will be lost.
  - You are about to drop the column `type` on the `Skill` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[userId,description,dueDate]` on the table `DailyTask` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `basePower` to the `Skill` table without a default value. This is not possible if the table is not empty.
  - Added the required column `damageType` to the `Skill` table without a default value. This is not possible if the table is not empty.
  - Added the required column `pp` to the `Skill` table without a default value. This is not possible if the table is not empty.
  - Added the required column `target` to the `Skill` table without a default value. This is not possible if the table is not empty.
  - Added the required column `tier` to the `Skill` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "DailyTask_userId_habitId_dueDate_key";

-- AlterTable
ALTER TABLE "DailyTask" ADD COLUMN     "tag" TEXT;

-- AlterTable
ALTER TABLE "Skill" DROP COLUMN "power",
DROP COLUMN "type",
ADD COLUMN     "basePower" INTEGER NOT NULL,
ADD COLUMN     "damageType" TEXT NOT NULL,
ADD COLUMN     "effects" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "hits" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "mastery" JSONB NOT NULL DEFAULT '{}',
ADD COLUMN     "pp" INTEGER NOT NULL,
ADD COLUMN     "target" TEXT NOT NULL,
ADD COLUMN     "tier" INTEGER NOT NULL;

-- DropEnum
DROP TYPE "SkillType";

-- CreateIndex
CREATE UNIQUE INDEX "DailyTask_userId_description_dueDate_key" ON "DailyTask"("userId", "description", "dueDate");
