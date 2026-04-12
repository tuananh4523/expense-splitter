import { CurrencyDisplay } from '@/components/shared/CurrencyDisplay'
import type { FundDto } from '@expense/types'
import { Alert, Card, Progress, Typography } from 'antd'

export function FundOverview({
  fund,
  loading,
  pendingReviewCount = 0,
  showReviewerHint = false,
}: {
  fund: FundDto | undefined
  loading: boolean
  /** Số giao dịch nộp quỹ chờ duyệt (chỉ để hiển thị). */
  pendingReviewCount?: number
  showReviewerHint?: boolean
}) {
  const balance = fund ? Number.parseFloat(fund.balance) : 0
  const threshold = fund ? Number.parseFloat(fund.lowThreshold) : 0
  const pct =
    threshold > 0 ? Math.min(100, Math.round((balance / threshold) * 100)) : balance > 0 ? 100 : 0
  const low = Boolean(fund && threshold > 0 && balance <= threshold)

  return (
    <Card
      loading={loading}
      className="rounded-2xl border border-[--color-border] shadow-sm [&_.ant-card-body]:!pb-6"
    >
      <Typography.Text
        type="secondary"
        className="mb-1 block text-xs font-semibold uppercase tracking-wide text-wp-slate"
      >
        Số dư hiện tại
      </Typography.Text>
      <CurrencyDisplay
        amount={fund?.balance ?? 0}
        className={
          low
            ? 'text-2xl font-semibold tabular-nums text-[#cf1322]'
            : 'text-2xl font-semibold tabular-nums'
        }
      />
      {fund ? (
        <Typography.Paragraph type="secondary" className="mt-2 mb-0 text-sm">
          Ngưỡng cảnh báo: <CurrencyDisplay amount={fund.lowThreshold} className="tabular-nums" />
        </Typography.Paragraph>
      ) : null}
      {fund ? (
        <Progress
          percent={pct}
          status={low ? 'exception' : 'active'}
          showInfo={false}
          className="mt-3"
        />
      ) : null}
      {showReviewerHint && pendingReviewCount > 0 ? (
        <Alert
          type="warning"
          showIcon
          className="mt-4"
          message="Có yêu cầu nộp quỹ chờ duyệt"
          description={`${pendingReviewCount} giao dịch đang chờ bạn xác nhận (ảnh chứng từ đã kèm theo).`}
        />
      ) : null}
      {low ? (
        <Alert
          type="warning"
          showIcon
          className="mt-4 !mb-0"
          message="Quỹ sắp hết"
          description="Cân nhắc đóng quỹ thêm."
        />
      ) : null}
    </Card>
  )
}
