/*
  Warnings:

  - You are about to drop the column `pp` on the `Skill` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Skill" DROP COLUMN "pp",
ADD COLUMN     "cooldown" INTEGER NOT NULL DEFAULT 0;
