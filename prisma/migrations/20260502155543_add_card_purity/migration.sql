-- AlterTable
ALTER TABLE "UserCard" ADD COLUMN     "purity" INTEGER NOT NULL DEFAULT 50;

-- CreateTable
CREATE TABLE "PendingCardDuplicate" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "userCardId" TEXT NOT NULL,
    "newPurity" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PendingCardDuplicate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PendingCardDuplicate_userId_createdAt_idx" ON "PendingCardDuplicate"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "PendingCardDuplicate_userCardId_idx" ON "PendingCardDuplicate"("userCardId");

-- AddForeignKey
ALTER TABLE "PendingCardDuplicate" ADD CONSTRAINT "PendingCardDuplicate_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PendingCardDuplicate" ADD CONSTRAINT "PendingCardDuplicate_userCardId_fkey" FOREIGN KEY ("userCardId") REFERENCES "UserCard"("id") ON DELETE CASCADE ON UPDATE CASCADE;
