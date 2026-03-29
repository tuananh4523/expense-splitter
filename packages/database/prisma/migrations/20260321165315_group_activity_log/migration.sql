-- CreateTable
CREATE TABLE "GroupActivityLog" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "actorUserId" TEXT,
    "actorName" TEXT NOT NULL,
    "actorEmail" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "targetType" TEXT,
    "targetId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GroupActivityLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GroupActivityLog_groupId_createdAt_idx" ON "GroupActivityLog"("groupId", "createdAt");

-- CreateIndex
CREATE INDEX "GroupActivityLog_groupId_targetType_targetId_idx" ON "GroupActivityLog"("groupId", "targetType", "targetId");

-- AddForeignKey
ALTER TABLE "GroupActivityLog" ADD CONSTRAINT "GroupActivityLog_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;
