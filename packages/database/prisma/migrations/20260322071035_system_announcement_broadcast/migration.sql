-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'SYSTEM_ANNOUNCEMENT';

-- AlterTable
ALTER TABLE "Notification" ADD COLUMN     "broadcastId" TEXT;

-- CreateIndex
CREATE INDEX "Notification_broadcastId_idx" ON "Notification"("broadcastId");
