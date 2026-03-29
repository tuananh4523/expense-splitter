-- AlterTable
ALTER TABLE "Expense" ADD COLUMN "settlementId" TEXT;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_settlementId_fkey" FOREIGN KEY ("settlementId") REFERENCES "Settlement"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "Expense_settlementId_idx" ON "Expense"("settlementId");

-- Gán lại chi cho đợt tổng kết đang mở (chỉ chi tạo không sau đợt): tránh đợt cũ không SETTLE được sau khi đổi logic
UPDATE "Expense" e
SET "settlementId" = s.id
FROM "Settlement" s
WHERE e."settlementId" IS NULL
  AND s.status IN ('PENDING', 'DRAFT')
  AND s."groupId" = e."groupId"
  AND e.status = 'ACTIVE'
  AND e."isStandalone" = false
  AND e."expenseDate" >= s."periodStart"
  AND e."expenseDate" <= s."periodEnd"
  AND e."createdAt" <= s."createdAt";
