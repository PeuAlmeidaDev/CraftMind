-- AlterTable
ALTER TABLE "Card" ADD COLUMN     "cardArtUrlSpectral" TEXT;

-- CreateTable
CREATE TABLE "SpectralDropLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "userCardId" TEXT NOT NULL,
    "droppedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SpectralDropLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserShowcase" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "userCardIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserShowcase_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SpectralDropLog_droppedAt_idx" ON "SpectralDropLog"("droppedAt");

-- CreateIndex
CREATE INDEX "SpectralDropLog_userId_idx" ON "SpectralDropLog"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "UserShowcase_userId_key" ON "UserShowcase"("userId");

-- AddForeignKey
ALTER TABLE "SpectralDropLog" ADD CONSTRAINT "SpectralDropLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SpectralDropLog" ADD CONSTRAINT "SpectralDropLog_userCardId_fkey" FOREIGN KEY ("userCardId") REFERENCES "UserCard"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserShowcase" ADD CONSTRAINT "UserShowcase_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
