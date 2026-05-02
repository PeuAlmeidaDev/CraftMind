-- CreateTable
CREATE TABLE "LoginLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "visitorId" TEXT NOT NULL,
    "ip" TEXT NOT NULL,
    "userAgent" VARCHAR(500) NOT NULL,
    "loggedInAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LoginLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LoginLog_userId_loggedInAt_idx" ON "LoginLog"("userId", "loggedInAt");

-- CreateIndex
CREATE INDEX "LoginLog_visitorId_loggedInAt_idx" ON "LoginLog"("visitorId", "loggedInAt");

-- AddForeignKey
ALTER TABLE "LoginLog" ADD CONSTRAINT "LoginLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
