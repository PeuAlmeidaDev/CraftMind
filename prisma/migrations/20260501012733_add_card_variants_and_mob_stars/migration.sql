-- DropIndex
DROP INDEX "Card_mobId_key";

-- AlterTable
ALTER TABLE "Card" ADD COLUMN     "dropChance" DOUBLE PRECISION NOT NULL DEFAULT 5,
ADD COLUMN     "requiredStars" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "Mob" ADD COLUMN     "maxStars" INTEGER NOT NULL DEFAULT 1;

-- CreateIndex
CREATE UNIQUE INDEX "Card_mobId_requiredStars_key" ON "Card"("mobId", "requiredStars");
