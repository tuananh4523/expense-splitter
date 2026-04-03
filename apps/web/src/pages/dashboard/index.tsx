import { ExpenseCharts } from '@/components/dashboard/ExpenseCharts'
import { GroupCard } from '@/components/groups/GroupCard'
import AppLayout from '@/components/layout/AppLayout'
import { CurrencyDisplay } from '@/components/shared/CurrencyDisplay'
import { EmptyState } from '@/components/shared/EmptyState'
import { OverviewHighlightCard } from '@/components/shared/OverviewHighlightCard'
import { useDashboardSummary } from '@/hooks/useDashboard'
import { useGroups } from '@/hooks/useGroup'
import { withAuth } from '@/utils/withAuth'
import { LoadingOutlined } from '@ant-design/icons'
import { Col, Row, Spin, Typography } from 'antd'
import { useRouter } from 'next/router'
import { useMemo } from 'react'

export const getServerSideProps = withAuth()

export default function DashboardPage() {
  const router = useRouter()
  const { data: groups, isLoading: loadingGroups } = useGroups()
  const { data: summary, isLoading: loadingSummary, isError: summaryError } = useDashboardSummary()

  const { led, joined } = useMemo(() => {
    const list = groups ?? []
    return {
      led: list.filter((g) => g.myRole === 'LEADER'),
      joined: list.filter((g) => g.myRole !== 'LEADER'),
    }
  }, [groups])

  const groupCount = summary?.participatingGroups ?? groups?.length ?? 0
  const debt = summary?.totalDebt ?? '0'
  const credit = summary?.totalCredit ?? '0'
  const pending = summary?.pendingSettlementCount ?? 0
  const statLoading = loadingGroups || loadingSummary

  const hrefGroups = '/groups'
  const hrefDebtGroups = '/groups?balance=owe'
  const hrefCreditGroups = '/groups?balance=owed'
  const hrefPendingGroups = '/groups?settlement=pending'

  const valueClass = 'text-2xl font-bold leading-tight tabular-nums text-wp-charcoal'

  return (
    <AppLayout title="Dashboard">
      <Row gutter={[16, 16]} align="stretch" className="dashboard-row mb-8">
        <Col xs={24} sm={12} lg={6}>
          <OverviewHighlightCard
            variant="indigo"
            title="Nhóm tham gia"
            description="Mở danh sách nhóm, vào từng nhóm để xem chi tiêu, quỹ và tổng kết. Từ đây bạn cũng có thể tạo nhóm hoặc lọc theo nợ / được nợ."
            icon="mdi:account-group-outline"
            href={hrefGroups}
            showChevron
            loading={statLoading}
          >
            <span className={valueClass}>{groupCount}</span>
          </OverviewHighlightCard>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <OverviewHighlightCard
            variant="rose"
            title="Đang nợ (ước tính)"
            description="Đã trả + quỹ − phần chia (âm = đang nợ). Mở nhóm để xem chi tiết."
            icon="mdi:trending-down"
            href={hrefDebtGroups}
            showChevron
            loading={statLoading}
          >
            <CurrencyDisplay
              amount={debt}
              colorize
              colorizeRole="owe"
              className={valueClass}
            />
          </OverviewHighlightCard>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <OverviewHighlightCard
            variant="emerald"
            title="Được nợ (ước tính)"
            description="Đã trả + quỹ − phần chia (dương = được nợ). Mở nhóm để xem chi tiết."
            icon="mdi:trending-up"
            href={hrefCreditGroups}
            showChevron
            loading={statLoading}
          >
            <CurrencyDisplay
              amount={credit}
              colorize
              colorizeRole="owed"
              className={valueClass}
            />
          </OverviewHighlightCard>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <OverviewHighlightCard
            variant="amber"
            title="Tổng kết đang chờ"
            description={
              pending > 0
                ? `${pending} đợt trên các nhóm — bấm để chỉ xem nhóm có tổng kết đang chờ, rồi vào nhóm → Tổng kết.`
                : 'Bấm để lọc nhóm có đợt nháp / đang chờ (nếu có).'
            }
            icon="mdi:clipboard-clock-outline"
            href={hrefPendingGroups}
            showChevron
            loading={statLoading}
          >
            <span className={valueClass}>{pending}</span>
          </OverviewHighlightCard>
        </Col>
      </Row>

      {summaryError ? (
        <Typography.Paragraph type="secondary" className="mb-4">
          Không tải được thống kê tổng hợp. Một số số liệu có thể là 0.
        </Typography.Paragraph>
      ) : null}

      <ExpenseCharts />

      {/* <section className="mb-8">
        <Typography.Title level={5} className="!mb-3 !mt-0">
          Nhóm bạn quản lý
        </Typography.Title>
        {loadingGroups ? (
          <div className="flex justify-center py-12">
            <Spin indicator={<LoadingOutlined spin />} size="large" />
          </div>
        ) : led.length ? (
          <Row gutter={[16, 16]} align="stretch">
            {led.map((g) => (
              <Col xs={24} sm={12} lg={8} key={g.id} className="flex min-w-0 flex-col">
                <GroupCard group={g} />
              </Col>
            ))}
          </Row>
        ) : (
          <EmptyState
            description="Chưa có nhóm do bạn quản lý"
            action={{
              label: 'Tạo nhóm',
              onClick: () => void router.push('/groups?create=1'),
            }}
          />
        )}
      </section> */}

      {/* <section>
        <Typography.Title level={5} className="!mb-3 !mt-0">
          Nhóm tham gia
        </Typography.Title>
        {loadingGroups ? null : joined.length ? (
          <Row gutter={[16, 16]} align="stretch">
            {joined.map((g) => (
              <Col xs={24} sm={12} lg={8} key={g.id} className="flex min-w-0 flex-col">
                <GroupCard group={g} />
              </Col>
            ))}
          </Row>
        ) : (
          <Typography.Text type="secondary">Bạn chưa tham gia nhóm nào với vai trò thành viên.</Typography.Text>
        )}
      </section> */}
    </AppLayout>
  )
}
