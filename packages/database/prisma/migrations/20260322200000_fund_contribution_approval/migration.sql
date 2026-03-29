-- CreateEnum
CREATE TYPE "FundContributionStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- AlterTable
ALTER TABLE "FundTransaction" ADD COLUMN     "contributionStatus" "FundContributionStatus",
ADD COLUMN     "proofImageUrls" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "reviewedByUserId" TEXT,
ADD COLUMN     "reviewedAt" TIMESTAMP(3),
ADD COLUMN     "reviewNote" TEXT;

-- Dữ liệu cũ: mọi CONTRIBUTE đã ghi vào số dư → coi như đã duyệt
UPDATE "FundTransaction"
SET "contributionStatus" = 'APPROVED'
WHERE "type" = 'CONTRIBUTE';

-- AddForeignKey
ALTER TABLE "FundTransaction" ADD CONSTRAINT "FundTransaction_reviewedByUserId_fkey" FOREIGN KEY ("reviewedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "FundTransaction_fundId_contributionStatus_idx" ON "FundTransaction"("fundId", "contributionStatus");
