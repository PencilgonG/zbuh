-- CreateTable
CREATE TABLE "PendingEffect" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "consumedAt" TIMESTAMP(3),

    CONSTRAINT "PendingEffect_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PendingEffect_userId_type_consumedAt_idx" ON "PendingEffect"("userId", "type", "consumedAt");
