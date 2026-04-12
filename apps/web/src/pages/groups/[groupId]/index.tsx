import { GroupNavIcon } from '@/components/groups/GroupNavIcon'
import AppLayout from '@/components/layout/AppLayout'
import { CurrencyDisplay } from '@/components/shared/CurrencyDisplay'
import { useExpenses } from '@/hooks/useExpenses'
import { useGroup, useGroupMembers } from '@/hooks/useGroup'
import { useSettlements } from '@/hooks/useSettlement'
import { formatVND } from '@/utils/currency'
import { isGroupFundAtOrBelowWarning } from '@/utils/fundLowWarning'
import { withAuth } from '@/utils/withAuth'
import { Icon } from '@iconify/react'
import { Col, Row, Space, Tag, Typography } from 'antd'
import dayjs from 'dayjs'
import { useRouter } from 'next/router'
import { type ReactNode, useMemo } from 'react'

type OverviewStat = {
  label: string
  value: ReactNode
  sub: string
  icon: string
  color: string
  bg: string
  action?: { label: string; onClick: () => void }
  /** Màu chữ số liệu chính (vd. quỹ cảnh báo) */
  valueTextClass?: string
  /** Viền thẻ (vd. quỹ thấp) */
  cardBorderClass?: string
}

const standalonePendingFilters = { standaloneIncomplete: true as const, page: 1, limit: 1 }

function UnsettledStatValue({ amount, kind }: { amount: string; kind: 'debt' | 'credit' }) {
  const d = Number.parseFloat(amount)
  const cls = 'text-2xl font-bold tabular-nums'
  if (Number.isNaN(d) || d <= 0)
    return <span className={`${cls} text-stone-900`}>{formatVND(amount)}</span>
  return (
    <Typography.Text type={kind === 'debt' ? 'danger' : 'success'} className={cls}>
      {formatVND(amount)}
    </Typography.Text>
  )
}

export const getServerSideProps = withAuth()

const roleLabel: Record<string, string> = {
  LEADER: 'Trưởng nhóm',
  VICE_LEADER: 'Phó nhóm',
  MEMBER: 'Thành viên',
}

export default function GroupHomePage() {
  const router = useRouter()
  const groupId = typeof router.query.groupId === 'string' ? router.query.groupId : ''
  const { data: group, isLoading } = useGroup(groupId)
  const { data: memberList } = useGroupMembers(groupId)
  const members = memberList?.members ?? []
  const { data: settlements = [] } = useSettlements(groupId)

  const thisMonthFilters = useMemo(
    () => ({
      dateFrom: dayjs().startOf('month').toISOString(),
      dateTo: dayjs().endOf('month').toISOString(),
      page: 1,
      limit: 100,
    }),
    [],
  )

  const { data: thisMonthData } = useExpenses(groupId, thisMonthFilters)
  const { data: standalonePendingData } = useExpenses(groupId, standalonePendingFilters)
  const standalonePendingCount = standalonePendingData?.total ?? 0
  const showUnsettled =
    !group?.adminViewer && group?.myUnsettledDebt != null && group?.myUnsettledCredit != null

  const thisMonthTotal = thisMonthData?.data.reduce((sum, e) => sum + Number(e.amount), 0) ?? 0
  const thisMonthCount = thisMonthData?.total ?? 0

  const pendingSettlements = settlements.filter(
    (s) => s.status === 'PENDING' || s.status === 'DRAFT',
  )
  const completedSettlements = settlements.filter((s) => s.status === 'COMPLETED')

  const overviewStats = useMemo((): OverviewStat[] => {
    if (!group) return []
    const fundLowWarning = isGroupFundAtOrBelowWarning(group.fundBalance, group.fundLowThreshold)
    return [
      {
        label: 'Thành viên',
        value: members.length,
        sub: `${members.filter((m) => m.role === 'LEADER' || m.role === 'VICE_LEADER').length} quản lý`,
        icon: 'mdi:account-multiple',
        color: '#005A87',
        bg: '#E5F4FA',
      },
      {
        label: 'Chi tiêu tháng này',
        value: <CurrencyDisplay amount={String(thisMonthTotal)} />,
        sub: `${thisMonthCount} khoản`,
        icon: 'mdi:cash-multiple',
        color: '#0073AA',
        bg: '#E5F4FA',
      },
      {
        label: 'Quỹ nhóm',
        value:
          group.fundBalance != null ? <CurrencyDisplay amount={group.fundBalance} /> : '—',
        sub: fundLowWarning
          ? 'Đã chạm hoặc thấp hơn ngưỡng cảnh báo quỹ'
          : 'Số dư hiện tại',
        icon: 'mdi:bank-outline',
        color: fundLowWarning ? '#cf1322' : '#00A32A',
        bg: fundLowWarning ? '#fff1f0' : '#EDFAEF',
        ...(fundLowWarning
          ? { valueTextClass: 'text-[#cf1322]', cardBorderClass: 'border-red-200' }
          : {}),
      },
      {
        label: 'Đang nợ (ước tính)',
        value: showUnsettled ? (
          <UnsettledStatValue amount={group.myUnsettledDebt!} kind="debt" />
        ) : (
          <span className="text-2xl font-bold tabular-nums text-stone-400">—</span>
        ),
        sub: showUnsettled
          ? 'Đã trả + quỹ − phần chia (khoản chung)'
          : 'Chỉ tính khi bạn là thành viên nhóm',
        icon: 'mdi:trending-down',
        color: '#b32d00',
        bg: '#fce8e8',
      },
      {
        label: 'Được nợ (ước tính)',
        value: showUnsettled ? (
          <UnsettledStatValue amount={group.myUnsettledCredit!} kind="credit" />
        ) : (
          <span className="text-2xl font-bold tabular-nums text-stone-400">—</span>
        ),
        sub: showUnsettled
          ? 'Đã trả + quỹ − phần chia (khoản chung)'
          : 'Chỉ tính khi bạn là thành viên nhóm',
        icon: 'mdi:trending-up',
        color: '#00A32A',
        bg: '#EDFAEF',
      },
      {
        label: 'Tổng kết đang chờ',
        value: pendingSettlements.length,
        sub: `${completedSettlements.length} đã hoàn thành`,
        icon: 'mdi:clipboard-clock-outline',
        color: '#D54E21',
        bg: '#FCF9E8',
      },
    ]
  }, [group, members, thisMonthTotal, thisMonthCount, showUnsettled, settlements])

  if (!groupId) return null

  return (
    <AppLayout title="Tổng quan">
      {isLoading || !group ? (
        <Typography.Text>Đang tải…</Typography.Text>
      ) : (
        <>
          {/* Group header */}
          <div className="mb-6 overflow-hidden rounded-xl border border-stone-300 bg-white shadow-sm">
            {group.avatarUrl ? (
              <img src={group.avatarUrl} alt={group.name} className="h-40 w-full object-cover" />
            ) : null}
            <div className="flex min-w-0 items-center gap-4 px-4 py-4">
              <div
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl"
                style={{
                  background: `${group.color ?? '#0073AA'}18`,
                  border: `1px solid ${group.color ?? '#0073AA'}35`,
                }}
              >
                <GroupNavIcon group={group} size={24} />
              </div>
              <div className="min-w-0 flex-1">
                <Typography.Title level={4} className="!mb-1 !mt-0">
                  {group.name}
                </Typography.Title>
                <Typography.Paragraph type="secondary" className="!mb-2 !mt-0 text-sm">
                  {group.description?.trim() ? group.description : 'Chưa có mô tả.'}
                </Typography.Paragraph>
                <Space wrap size={[6, 6]}>
                  <Tag style={{ color: '#0073aa', background: '#e5f4fa', border: 'none' }}>
                    {roleLabel[group.myRole] ?? group.myRole}
                  </Tag>
                  <Tag>{group.memberCount} thành viên</Tag>
                </Space>
              </div>
            </div>
          </div>

          {/* Stat cards */}
          <Row gutter={[16, 16]} className="mb-6">
            {overviewStats.map((s: OverviewStat) => (
              <Col xs={24} sm={12} lg={8} key={s.label}>
                <div
                  className={`flex items-center gap-4 rounded-xl border bg-white px-5 py-4 shadow-sm ${s.cardBorderClass ?? 'border-stone-300'}`}
                >
                  <div
                    className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl"
                    style={{ background: s.bg }}
                  >
                    <Icon icon={s.icon} width={24} color={s.color} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm text-stone-500">{s.label}</div>
                    <div
                      className={`text-2xl font-bold tabular-nums ${s.valueTextClass ?? 'text-stone-900'}`}
                    >
                      {s.value}
                    </div>
                    <div className="text-xs text-stone-400">{s.sub}</div>
                    {s.action ? (
                      <button
                        type="button"
                        className="mt-2 text-left text-xs font-semibold text-[#b32d00] underline-offset-2 hover:underline"
                        onClick={s.action.onClick}
                      >
                        {s.action.label}
                      </button>
                    ) : null}
                  </div>
                </div>
              </Col>
            ))}
          </Row>

          <Row gutter={[16, 16]} className="mb-6">
            <Col xs={24} md={12}>
              <button
                type="button"
                className="h-full min-h-[88px] w-full rounded-xl border border-stone-200 bg-white px-5 py-4 text-left shadow-sm transition-colors duration-200 hover:border-[#e8a98b] hover:bg-[#fcf9e8]/80"
                onClick={() => void router.push(`/groups/${groupId}/expenses?standalonePending=1`)}
              >
                <div className="flex items-center gap-4">
                  <div
                    className="relative grid h-12 w-12 shrink-0 place-items-center overflow-visible rounded-xl leading-none"
                    style={{ background: '#FCF9E8', color: '#D54E21' }}
                  >
                    <Icon
                      icon="mdi:wallet-outline"
                      width={24}
                      height={24}
                      className="col-start-1 row-start-1 block shrink-0"
                      aria-hidden
                    />
                    {standalonePendingCount > 0 ? (
                      <span
                        className="pointer-events-none absolute right-0 top-0 z-[1] flex h-[18px] min-w-[18px] translate-x-0.5 -translate-y-0.5 items-center justify-center rounded-full bg-[#d63638] px-1 text-[11px] font-semibold tabular-nums leading-none text-white shadow-sm ring-2 ring-white"
                        aria-hidden
                      >
                        {standalonePendingCount > 99 ? '99+' : standalonePendingCount}
                      </span>
                    ) : null}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-stone-900">Thanh toán riêng chưa xong</div>
                    <div className="text-sm text-stone-500">
                      {standalonePendingCount > 0
                        ? `${standalonePendingCount} khoản chi cần chuyển tiền / duyệt chứng từ`
                        : 'Không có khoản nào đang chờ — bấm để xem danh sách chi riêng'}
                    </div>
                  </div>
                  <Icon icon="mdi:chevron-right" width={22} className="shrink-0 text-stone-400" />
                </div>
              </button>
            </Col>
            <Col xs={24} md={12}>
              <button
                type="button"
                className="h-full min-h-[88px] w-full rounded-xl border border-stone-200 bg-white px-5 py-4 text-left shadow-sm transition-colors duration-200 hover:border-[#72aee6] hover:bg-brand-soft/60"
                onClick={() => void router.push(`/groups/${groupId}/settlement?pending=1`)}
              >
                <div className="flex items-center gap-4">
                  <div
                    className="relative grid h-12 w-12 shrink-0 place-items-center overflow-visible rounded-xl leading-none"
                    style={{ background: '#E5F4FA', color: '#0073AA' }}
                  >
                    <Icon
                      icon="mdi:clipboard-text-clock-outline"
                      width={24}
                      height={24}
                      className="col-start-1 row-start-1 block shrink-0"
                      aria-hidden
                    />
                    {pendingSettlements.length > 0 ? (
                      <span
                        className="pointer-events-none absolute right-0 top-0 z-[1] flex h-[18px] min-w-[18px] translate-x-0.5 -translate-y-0.5 items-center justify-center rounded-full bg-[#d63638] px-1 text-[11px] font-semibold tabular-nums leading-none text-white shadow-sm ring-2 ring-white"
                        aria-hidden
                      >
                        {pendingSettlements.length > 99 ? '99+' : pendingSettlements.length}
                      </span>
                    ) : null}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-stone-900">Tổng kết đang chờ thanh toán</div>
                    <div className="text-sm text-stone-500">
                      {pendingSettlements.length > 0
                        ? `${pendingSettlements.length} đợt cần nộp chứng từ / duyệt — mở danh sách`
                        : 'Không có đợt đang chờ — bấm để xem mọi đợt tổng kết'}
                    </div>
                  </div>
                  <Icon icon="mdi:chevron-right" width={22} className="shrink-0 text-stone-400" />
                </div>
              </button>
            </Col>
          </Row>
        </>
      )}
    </AppLayout>
  )
}
