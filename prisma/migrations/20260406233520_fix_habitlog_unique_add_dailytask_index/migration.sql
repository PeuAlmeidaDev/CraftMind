/*
  Warnings:

  - A unique constraint covering the columns `[userId,habitId,date]` on the table `HabitLog` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `date` to the `HabitLog` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "HabitLog_userId_habitId_completedAt_key";

-- AlterTable
ALTER TABLE "HabitLog" ADD COLUMN     "date" DATE NOT NULL;

-- CreateTable
CREATE TABLE "DailyTask" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "habitId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "attributeGrants" JSONB NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DailyTask_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DailyTask_userId_dueDate_idx" ON "DailyTask"("userId", "dueDate");

-- CreateIndex
CREATE UNIQUE INDEX "DailyTask_userId_habitId_dueDate_key" ON "DailyTask"("userId", "habitId", "dueDate");

-- CreateIndex
CREATE UNIQUE INDEX "HabitLog_userId_habitId_date_key" ON "HabitLog"("userId", "habitId", "date");

-- AddForeignKey
ALTER TABLE "DailyTask" ADD CONSTRAINT "DailyTask_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyTask" ADD CONSTRAINT "DailyTask_habitId_fkey" FOREIGN KEY ("habitId") REFERENCES "Habit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
