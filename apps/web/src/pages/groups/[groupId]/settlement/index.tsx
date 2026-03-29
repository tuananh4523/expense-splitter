import AppLayout from '@/components/layout/AppLayout'
import { MemberProfileDrawer } from '@/components/groups/MemberProfileDrawer'
import { CurrencyDisplay } from '@/components/shared/CurrencyDisplay'
import { MemberAvatarNameButton } from '@/components/shared/MemberAvatarNameButton'
import { EmptyState } from '@/components/shared/EmptyState'
import { useGroup, useGroupMembers } from '@/hooks/useGroup'
import {
  useDeleteSettlement,
  useNotifySettlementPendingPayers,
  useSettlements,
} from '@/hooks/useSettlement'
import { fmtDate } from '@/utils/date'
import { withAuth } from '@/utils/withAuth'
import { Icon } from '@iconify/react'
import { BellOutlined, PlusOutlined, QuestionCircleOutlined } from '@ant-design/icons'
import { settlementStatusVi } from '@/utils/statusLabels'
import type { MemberDto, SettlementDto, UserDto } from '@expense/types'
import { isSettlementDeletable } from '@/utils/settlementDeletable'
import { Alert, App, Button, Col, Input, Popconfirm, Row, Select, Space, Table, Tag, Tooltip } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import Link from 'next/link'
import { useRouter } from 'next/router'
import type { MouseEvent } from 'react'
import { useCallback, useEffect, useMemo, useState } from 'react'

export const getServerSideProps = withAuth()

const statusColor: Record<string, string> = {
  DRAFT: 'default',
  PENDING: 'processing',
  COMPLETED: 'success',
}

type StatusFilter = 'all' | 'open' | 'completed'

function pendingPayerNotifyCount(s: SettlementDto): number {
  const ids = new Set<string>()
  for (const p of s.paymentRecords) {
    if (p.status === 'PENDING' || p.status === 'REJECTED') ids.add(p.payerUserId)
  }
  return ids.size
}

export default function SettlementsListPage() {
  const { message } = App.useApp()
  const router = useRouter()
  const groupId = typeof router.query.groupId === 'string' ? router.query.groupId : ''
  const { data: group } = useGroup(groupId)
  const { data: list = [], isLoading } = useSettlements(groupId)
  const notifyPending = useNotifySettlementPendingPayers(groupId)
  const deleteSettlement = useDeleteSettlement(groupId)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [titleQuery, setTitleQuery] = useState('')
  const [profileMember, setProfileMember] = useState<MemberDto | null>(null)

  const { data: membersData } = useGroupMembers(groupId || undefined)
  const memberByUserId = useMemo(() => {
    const m = new Map<string, MemberDto>()
    for (const x of membersData?.members ?? []) m.set(x.userId, x)
    return m
  }, [membersData?.members])

  const openReceiverProfile = useCallback(
    (userId: string, user: Pick<UserDto, 'id' | 'name' | 'avatarUrl'>) => {
      const existing = memberByUserId.get(userId)
      if (existing) {
        setProfileMember(existing)
        return
      }
      setProfileMember({
        id: `synth-${userId}`,
        userId,
        groupId,
        role: 'MEMBER',
        nickname: null,
        isActive: true,
        joinedAt: '',
        user: { id: user.id, name: user.name, email: '', avatarUrl: user.avatarUrl },
      })
    },
    [memberByUserId, groupId],
  )

  useEffect(() => {
    if (!router.isReady || !groupId) return
    const p = router.query.pending
    if (p !== '1' && p !== 'true') return
    setStatusFilter('open')
    void router.replace(`/groups/${groupId}/settlement`, undefined, { shallow: true })
  }, [router.isReady, router.query.pending, groupId, router])

  const displayedList = useMemo(() => {
    let rows = list
    if (statusFilter === 'open') {
      rows = rows.filter((s) => s.status === 'PENDING' || s.status === 'DRAFT')
    } else if (statusFilter === 'completed') {
      rows = rows.filter((s) => s.status === 'COMPLETED')
    }
    const q = titleQuery.trim().toLowerCase()
    if (q) rows = rows.filter((s) => s.title.toLowerCase().includes(q))
    return rows
  }, [list, statusFilter, titleQuery])

  const isLeader = group?.myRole === 'LEADER'
  const canCreate = isLeader

  const columns: ColumnsType<SettlementDto> = useMemo(
    () => [
      { title: 'Tiêu đề', dataIndex: 'title', key: 'title', align: 'left' },
      {
        title: 'Kỳ',
        key: 'period',
        align: 'left',
        render: (_, r) => (
          <span>
            {fmtDate(r.periodStart)} — {fmtDate(r.periodEnd)}
          </span>
        ),
      },
      {
        title: 'Thanh toán cho',
        key: 'receiver',
        width: 220,
        ellipsis: true,
        onCell: () => ({
          onMouseDown: (e: MouseEvent) => {
            e.stopPropagation()
          },
        }),
        render: (_, r) => (
          <MemberAvatarNameButton
            userId={r.receiver.id}
            user={r.receiver}
            size={32}
            className="max-w-full py-0.5"
            onOpen={openReceiverProfile}
          />
        ),
      },
      {
        title: 'Tổng chi kỳ',
        dataIndex: 'periodExpensesTotal',
        key: 'periodExpensesTotal',
        align: 'right',
        render: (v: string, r) => (
          <Tooltip
            title={
              <span>
                Luồng quyết toán (cộng từng khoản chuyển):{' '}
                <CurrencyDisplay amount={r.totalAmount} />
              </span>
            }
          >
            <span className="cursor-help">
              <CurrencyDisplay amount={v} />
            </span>
          </Tooltip>
        ),
      },
      {
        title: 'Trạng thái',
        dataIndex: 'status',
        key: 'status',
        align: 'left',
        render: (s: string) => <Tag color={statusColor[s] ?? 'default'}>{settlementStatusVi(s)}</Tag>,
      },
      {
        title: '',
        key: 'act',
        align: 'right',
        width: isLeader ? 176 : 56,
        render: (_, r) => {
          const n = pendingPayerNotifyCount(r)
          const canNudge = isLeader && r.status !== 'COMPLETED' && n > 0
          const canDel = isLeader && isSettlementDeletable(r)
          return (
            <Space size={8} className="justify-end" onClick={(e) => e.stopPropagation()}>
              {isLeader ? (
                <Popconfirm
                  title="Gửi nhắc thanh toán?"
                  description={
                    n > 0
                      ? `Gửi thông báo tới ${n} người còn phải nộp chứng từ / xử lý khoản (bỏ qua người đã nộp chờ duyệt hoặc đã duyệt xong).`
                      : undefined
                  }
                  okText="Gửi"
                  cancelText="Hủy"
                  disabled={!canNudge}
                  onConfirm={() =>
                    void notifyPending
                      .mutateAsync(r.id)
                      .then((d) =>
                        message.success(
                          d.notified > 0 ? `Đã gửi nhắc tới ${d.notified} người` : 'Đã gửi nhắc',
                        ),
                      )
                      .catch((e) => message.error(e instanceof Error ? e.message : 'Không gửi được'))
                  }
                >
                  <Tooltip
                    title={
                      r.status === 'COMPLETED'
                        ? 'Đợt đã hoàn thành'
                        : n === 0
                          ? 'Không còn người chờ nộp chứng từ'
                          : `Nhắc ${n} người chưa hoàn tất thanh toán`
                    }
                  >
                    <Button
                      type="text"
                      size="small"
                      disabled={!canNudge}
                      loading={notifyPending.isPending && notifyPending.variables === r.id}
                      icon={<BellOutlined />}
                      aria-label="Nhắc thanh toán"
                    />
                  </Tooltip>
                </Popconfirm>
              ) : null}
              {canDel ? (
                <Popconfirm
                  title="Xoá đợt tổng kết?"
                  description="Các khoản chi trong đợt sẽ mở lại để tổng kết sau. Dùng khi tổng kết sớm hoặc cần tạo lại đợt."
                  okText="Xoá"
                  okButtonProps={{ danger: true }}
                  cancelText="Hủy"
                  onConfirm={() =>
                    void deleteSettlement
                      .mutateAsync(r.id)
                      .then(() => message.success('Đã xoá đợt tổng kết'))
                      .catch((e) => message.error(e instanceof Error ? e.message : 'Không xoá được'))
                  }
                >
                  <Tooltip title="Xoá đợt (trưởng nhóm)">
                    <Button
                      type="text"
                      size="small"
                      danger
                      loading={deleteSettlement.isPending && deleteSettlement.variables === r.id}
                      icon={<Icon icon="mdi:trash-can-outline" width={16} />}
                      aria-label="Xoá đợt tổng kết"
                    />
                  </Tooltip>
                </Popconfirm>
              ) : null}
              <Tooltip title="Xem chi tiết">
                <Link href={`/groups/${groupId}/settlement/${r.id}`}>
                  <Button type="text" size="small" icon={<Icon icon="mdi:arrow-right-circle-outline" width={16} />} />
                </Link>
              </Tooltip>
            </Space>
          )
        },
      },
    ],
    [
      groupId,
      isLeader,
      notifyPending.isPending,
      notifyPending.variables,
      deleteSettlement.isPending,
      deleteSettlement.variables,
      message,
      openReceiverProfile,
    ],
  )

  if (!groupId) return null

  const filteredEmpty = !isLoading && list.length > 0 && displayedList.length === 0

  const settlementFundHelpTitle = (
    <div className="max-w-xs text-xs leading-relaxed">
      <p className="mb-0 font-semibold">Đã trả + quỹ trong kỳ − phải trả → tính ai trả ai.</p>
      <p className="mb-0 mt-2">Đóng đợt xong: xoá hết giao dịch quỹ, số dư quỹ về 0.</p>
    </div>
  )

  return (
    <AppLayout title="Tổng kết">
      {canCreate ? (
        <div className="mb-6 flex justify-end">
          <Space size={4} align="center">
            <Tooltip title={settlementFundHelpTitle} placement="rightTop" overlayStyle={{ maxWidth: 320 }}>
              <Button
                type="text"
                className="!text-stone-400 hover:!text-stone-600"
                icon={<QuestionCircleOutlined className="text-lg" />}
                aria-label="Công thức tổng kết và quỹ — xem giải thích"
              />
            </Tooltip>
            <Link href={`/groups/${groupId}/settlement/new`}>
              <Button type="primary" icon={<PlusOutlined />}>
                Tạo tổng kết
              </Button>
            </Link>
          </Space>
        </div>
      ) : null}

      {!isLoading && list.length > 0 ? (
        <Row gutter={[16, 16]} className="mb-6">
          <Col xs={24} sm={12} md={8}>
            <Select<StatusFilter>
              className="w-full"
              value={statusFilter}
              onChange={setStatusFilter}
              options={[
                { value: 'all', label: 'Tất cả trạng thái' },
                { value: 'open', label: 'Chờ thanh toán' },
                { value: 'completed', label: 'Đã hoàn thành' },
              ]}
            />
          </Col>
          <Col xs={24} sm={12} md={10}>
            <Input
              allowClear
              placeholder="Lọc theo tiêu đề…"
              value={titleQuery}
              onChange={(e) => setTitleQuery(e.target.value)}
            />
          </Col>
        </Row>
      ) : null}

      {statusFilter === 'open' ? (
        <div className="settlement-filter-alert-wrap">
          <Alert
            type="info"
            showIcon
            className="settlement-filter-alert"
            message="Đang lọc: đợt chờ thanh toán"
            action={
              <Button size="small" type="link" onClick={() => setStatusFilter('all')}>
                Xem tất cả đợt
              </Button>
            }
          />
        </div>
      ) : null}

      {!isLoading && !list.length ? (
        <EmptyState description="Chưa có đợt tổng kết" />
      ) : (
        <Table<SettlementDto>
          rowKey="id"
          loading={isLoading}
          columns={columns}
          dataSource={displayedList}
          className="settlement-list-table"
          scroll={{ x: true }}
          locale={{
            emptyText:
              filteredEmpty && statusFilter === 'open'
                ? 'Không có đợt tổng kết đang chờ'
                : filteredEmpty
                  ? 'Không có đợt nào khớp bộ lọc'
                  : undefined,
          }}
        />
      )}
      <MemberProfileDrawer member={profileMember} onClose={() => setProfileMember(null)} />
    </AppLayout>
  )
}
