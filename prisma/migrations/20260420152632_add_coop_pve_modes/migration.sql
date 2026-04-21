-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "PveBattleMode" ADD VALUE 'COOP_2V3';
ALTER TYPE "PveBattleMode" ADD VALUE 'COOP_2V5';

-- AlterTable
ALTER TABLE "PveBattle" ADD COLUMN     "teamMateId" TEXT;
