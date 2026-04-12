/*
  Warnings:

  - You are about to drop the column `attributeGrants` on the `Habit` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Habit" DROP COLUMN "attributeGrants",
ADD COLUMN     "description" TEXT NOT NULL DEFAULT '';
