-- CreateEnum
CREATE TYPE "PveBattleMode" AS ENUM ('SOLO', 'MULTI');

-- AlterTable
ALTER TABLE "PveBattle" ADD COLUMN     "mobIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "mode" "PveBattleMode" NOT NULL DEFAULT 'SOLO';
