import AppLayout from '@/components/layout/AppLayout'
import { MemberProfileDrawer } from '@/components/groups/MemberProfileDrawer'
import { ConfirmPaymentModal } from '@/components/settlement/ConfirmPaymentModal'
import { CurrencyDisplay } from '@/components/shared/CurrencyDisplay'
import { MemberAvatarNameButton } from '@/components/shared/MemberAvatarNameButton'
import { ResolvedImageList } from '@/components/shared/ResolvedImageList'
import { useGroup, useGroupMembers } from '@/hooks/useGroup'
import {
  useAcceptPayment,
  useDeleteSettlement,
  useReopenRejectedSettlementPayment,
  useRequestSettlementPaymentReview,
  useSettlement,
} from '@/hooks/useSettlement'
import { paymentRecordStatusVi, settlementStatusVi } from '@/utils/statusLabels'
import { fmtDate, timeAgo } from '@/utils/date'
import { formatVND } from '@/utils/currency'
import { isSettlementDeletable } from '@/utils/settlementDeletable'
import { withAuth } from '@/utils/withAuth'
import { Icon } from '@iconify/react'
import { BellOutlined, CheckCircleOutlined, CloseCircleOutlined } from '@ant-design/icons'
import type { MemberDto, PaymentRecordDto, SettlementExpenseInBatchDto } from '@expense/types'
import { Alert, App, Button, Card, Collapse, Popconfirm, Progress, Space, Table, Tag, Typography } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/router'
import type { MouseEvent } from 'react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

export const getServerSideProps = withAuth()

const COLORS = ['#1677ff', '#52c41a', '#faad14', '#ff4d4f', '#722ed1', '#13c2c2']

const settlementHeaderTagColor: Record<string, string> = {
  DRAFT: 'default',
  PENDING: 'processing',
  COMPLETED: 'success',
}

const payStatusColor: Record<string, string> = {
  PENDING: 'default',
  CONFIRMED: 'processing',
  ACCEPTED: 'success',
  REJECTED: 'error',
}

function PaymentPersonCell({
  userId,
  user,
  onOpen,
}: {
  userId: string
  user: PaymentRecordDto['payer']
  onOpen: (userId: string, user: PaymentRecordDto['payer']) => void
}) {
  return (
    <MemberAvatarNameButton
      userId={userId}
      user={user}
      size={36}
      className="max-w-[240px]"
      onOpen={onOpen}
    />
  )
}

export default function SettlementDetailPage() {
  const { message } = App.useApp()
  const router = useRouter()
  const { data: session } = useSession()
  const groupId = typeof router.query.groupId === 'string' ? router.query.groupId : ''
  const settlementId =
    typeof router.query.settlementId === 'string' ? router.query.settlementId : ''
  const { data: group } = useGroup(groupId)
  const { data: settlement, isLoading } = useSettlement(groupId, settlementId)
  const accept = useAcceptPayment(groupId, settlementId)
  const nudgeReview = useRequestSettlementPaymentReview(groupId, settlementId)
  const reopenRejected = useReopenRejectedSettlementPayment(groupId, settlementId)
  const deleteSettlement = useDeleteSettlement(groupId)

  const [modalOpen, setModalOpen] = useState(false)
  const [activeRecord, setActiveRecord] = useState<PaymentRecordDto | null>(null)
  const [expensePage, setExpensePage] = useState(1)
  const expensePageSize = 10
  const [profileMember, setProfileMember] = useState<MemberDto | null>(null)

  const { data: membersData } = useGroupMembers(groupId || undefined)
  const memberByUserId = useMemo(() => {
    const m = new Map<string, MemberDto>()
    for (const x of membersData?.members ?? []) m.set(x.userId, x)
    return m
  }, [membersData?.members])

  const openMemberProfile = useCallback(
    (userId: string, user: PaymentRecordDto['payer']) => {
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

  const uid = session?.user?.id

  useEffect(() => {
    setExpensePage(1)
  }, [settlementId])

  const settlementExpenseRows = settlement?.settlementExpenses ?? []
  const paginatedSettlementExpenses = useMemo(() => {
    const start = (expensePage - 1) * expensePageSize
    return settlementExpenseRows.slice(start, start + expensePageSize)
  }, [settlementExpenseRows, expensePage])

  const fromSnapshotOnly =
    settlementExpenseRows.length > 0 && settlementExpenseRows.every((r) => r.fromLiveDb !== true)

  const expenseColumns: ColumnsType<SettlementExpenseInBatchDto> = [
    {
      title: 'Tiêu đề',
      dataIndex: 'title',
      key: 'title',
      render: (t: string) => t,
    },
    {
      title: 'Số tiền',
      dataIndex: 'amount',
      key: 'amount',
      align: 'right',
      render: (v: string) => <CurrencyDisplay amount={v} className="whitespace-nowrap font-medium tabular-nums" />,
    },
    {
      title: 'Ngày',
      dataIndex: 'expenseDate',
      key: 'expenseDate',
      render: (d: string) => fmtDate(d),
    },
    {
      title: 'Trả bởi',
      key: 'paidBy',
      render: (_, r) => r.paidBy.name,
    },
    {
      title: 'Trạng thái chi',
      key: 'expenseStatus',
      width: 150,
      render: (_, r) => {
        const st =
          r.status ?? (settlement?.status === 'COMPLETED' ? 'SETTLED' : 'ACTIVE')
        return st === 'SETTLED' ? (
          <Tag color="success">Đã chốt tổng kết</Tag>
        ) : (
          <Tag color="processing">Trong đợt</Tag>
        )
      },
    },
  ]

  /** Chỉ ACCEPTED = đã duyệt xong; CONFIRMED vẫn chờ duyệt — không tính vào %. */
  const acceptedCount = useMemo(
    () => settlement?.paymentRecords.filter((p) => p.status === 'ACCEPTED').length ?? 0,
    [settlement],
  )
  const awaitingReviewCount = useMemo(
    () => settlement?.paymentRecords.filter((p) => p.status === 'CONFIRMED').length ?? 0,
    [settlement],
  )
  const totalPayments = settlement?.paymentRecords.length ?? 0
  const progressPct = totalPayments ? Math.round((acceptedCount / totalPayments) * 100) : 0

  /** Tổng số tiền các khoản chưa duyệt xong (chờ thanh toán / chứng từ / duyệt). */
  const pendingPayAmount = useMemo(() => {
    if (!settlement?.paymentRecords.length) return '0'
    const t = settlement.paymentRecords
      .filter((p) => p.status !== 'ACCEPTED')
      .reduce((s, p) => s + (Number.parseFloat(p.amount) || 0), 0)
    return String(t)
  }, [settlement])

  const barData = useMemo(() => {
    if (!settlement?.summaryData.balances.length) return []
    return settlement.summaryData.balances.map((b) => ({
      name: b.userName,
      paid: Number.parseFloat(b.totalPaid) || 0,
      fund: Number.parseFloat(b.fundNetInPeriod ?? '0') || 0,
      owed: Number.parseFloat(b.totalOwed) || 0,
    }))
  }, [settlement])

  const pieData = useMemo(() => {
    // Placeholder: category split not in summary — use balance net as slices
    if (!settlement?.summaryData.balances.length) return []
    return settlement.summaryData.balances.map((b, i) => ({
      name: b.userName,
      value: Math.abs(Number.parseFloat(b.netBalance)) || 0,
      color: COLORS[i % COLORS.length],
    }))
  }, [settlement])

  const onAccept = async (paymentRecordId: string, accepted: boolean) => {
    try {
      await accept.mutateAsync({ paymentRecordId, accepted })
      message.success(accepted ? 'Đã chấp nhận' : 'Đã từ chối')
    } catch (e) {
      message.error(e instanceof Error ? e.message : 'Thất bại')
    }
  }

  const paymentColumns: ColumnsType<PaymentRecordDto> = useMemo(
    () => [
      {
        title: 'Người trả',
        key: 'payer',
        width: 260,
        onCell: () => ({
          onMouseDown: (e: MouseEvent) => {
            e.stopPropagation()
          },
        }),
        render: (_, r) => (
          <PaymentPersonCell userId={r.payerUserId} user={r.payer} onOpen={openMemberProfile} />
        ),
      },
      {
        title: 'Người nhận',
        key: 'receiver',
        width: 260,
        onCell: () => ({
          onMouseDown: (e: MouseEvent) => {
            e.stopPropagation()
          },
        }),
        render: (_, r) => (
          <PaymentPersonCell userId={r.receiverUserId} user={r.receiver} onOpen={openMemberProfile} />
        ),
      },
      {
        title: 'Số tiền',
        key: 'amount',
        align: 'right',
        width: 140,
        render: (_, r) => (
          <CurrencyDisplay
            amount={r.amount}
            className="whitespace-nowrap font-semibold text-brand-text tabular-nums"
          />
        ),
      },
      {
        title: 'Trạng thái',
        key: 'status',
        width: 150,
        render: (_, r) => (
          <Tag color={payStatusColor[r.status] ?? 'default'} className="!m-0">
            {paymentRecordStatusVi(r.status)}
          </Tag>
        ),
      },
    ],
    [openMemberProfile],
  )

  if (!groupId || !settlementId) return null

  return (
    <AppLayout title={settlement?.title ?? 'Tổng kết'}>
      {isLoading || !settlement ? (
        <Typography.Text>Đang tải…</Typography.Text>
      ) : (
        <>
          <Space direction="vertical" size="large" className="w-full">
            {settlement.status === 'COMPLETED' ? (
              <Alert
                type="success"
                showIcon
                message="Đợt đã đóng — quỹ làm sạch"
                description="Toàn bộ lịch sử giao dịch quỹ trước thời điểm đóng đợt đã được xoá và số dư quỹ về 0 để bắt đầu kỳ mới. Các khoản nộp quỹ sau đó cần ghi nhận lại trên trang quỹ nhóm."
              />
            ) : null}
            <Card
              extra={
                group?.myRole === 'LEADER' && isSettlementDeletable(settlement) ? (
                  <Popconfirm
                    title="Xoá đợt tổng kết?"
                    description="Các khoản chi trong đợt sẽ mở lại để tổng kết sau. Dùng khi tổng kết sớm hoặc cần tạo lại đợt."
                    okText="Xoá"
                    okButtonProps={{ danger: true }}
                    cancelText="Hủy"
                    onConfirm={() =>
                      void deleteSettlement
                        .mutateAsync(settlementId)
                        .then(() => message.success('Đã xoá đợt tổng kết'))
                        .catch((e) => message.error(e instanceof Error ? e.message : 'Không xoá được'))
                    }
                  >
                    <Button danger size="small" loading={deleteSettlement.isPending}>
                      Xoá đợt
                    </Button>
                  </Popconfirm>
                ) : null
              }
            >
              <div className="flex flex-col gap-3 text-left">
                <div>
                  <Typography.Text type="secondary" className="mb-0.5 block text-xs font-medium uppercase tracking-wide">
                    Kỳ
                  </Typography.Text>
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
                    <Typography.Text className="text-base font-semibold text-stone-900">
                      {fmtDate(settlement.periodStart)} — {fmtDate(settlement.periodEnd)}
                    </Typography.Text>
                    <Tag color={settlementHeaderTagColor[settlement.status] ?? 'default'} className="!m-0">
                      {settlementStatusVi(settlement.status)}
                    </Tag>
                  </div>
                </div>
                <div>
                  <Typography.Text type="secondary" className="mb-0.5 block text-xs font-medium uppercase tracking-wide">
                    Số tiền còn chờ thanh toán
                  </Typography.Text>
                  <CurrencyDisplay
                    amount={pendingPayAmount}
                    className="text-xl font-bold text-red-800"
                  />
                </div>
                <div className="border-t border-stone-100 pt-3">
                  <Typography.Text type="secondary" className="mb-0.5 block text-xs font-medium uppercase tracking-wide">
                    Tổng kỳ
                  </Typography.Text>
                  <CurrencyDisplay
                    amount={settlement.periodExpensesTotal}
                    className="text-2xl font-bold tracking-tight text-stone-900"
                  />
                  <Typography.Text type="secondary" className="mt-1.5 block text-xs leading-relaxed">
                    Tổng tiền các khoản chi chung trong kỳ (cộng hết từng bill). Đợt tạo ra còn tính{' '}
                    <strong>quỹ trong kỳ</strong> vào cân bằng (xem bản lưu số dư thành viên). Luồng phải chuyển tay:{' '}
                    <CurrencyDisplay amount={settlement.totalAmount} className="tabular-nums font-medium" />
                  </Typography.Text>
                </div>
              </div>
            </Card>

            <Card title="Tiến độ thanh toán">
              <div className="mb-4 border-b border-stone-200 pb-4">
                <Typography.Text
                  type="secondary"
                  className="mb-1 block text-xs font-medium uppercase tracking-wide"
                >
                  Thanh toán cho
                </Typography.Text>
                <PaymentPersonCell
                  userId={settlement.receiver.id}
                  user={settlement.receiver}
                  onOpen={openMemberProfile}
                />
              </div>
              <Progress percent={progressPct} status={progressPct >= 100 ? 'success' : 'active'} />
              <div className="mb-4 space-y-1">
                <Typography.Text type="secondary" className="block">
                  {acceptedCount}/{totalPayments} khoản đã duyệt xong
                </Typography.Text>
                {awaitingReviewCount > 0 ? (
                  <Typography.Text className="block text-amber-800">
                    {awaitingReviewCount} khoản đang chờ duyệt chứng từ
                  </Typography.Text>
                ) : null}
                <Typography.Paragraph type="secondary" className="!mb-0 !mt-2 text-xs">
                  Bấm tên người trả / người nhận để xem hồ sơ. Mở rộng hàng để xem chứng từ và thao tác.
                </Typography.Paragraph>
              </div>
              <Table<PaymentRecordDto>
                rowKey="id"
                size="small"
                columns={paymentColumns}
                dataSource={settlement.paymentRecords}
                pagination={false}
                scroll={{ x: true }}
                locale={{ emptyText: 'Chưa có khoản thanh toán nào.' }}
                expandable={{
                  expandRowByClick: false,
                  expandedRowRender: (r) => {
                    const isReceiver = r.receiverUserId === uid
                    const canReview = isReceiver || group?.myRole === 'LEADER'
                    return (
                      <div className="space-y-3 border-l-2 border-stone-200 py-1 pl-4">
                        {r.proofImageUrls.length > 0 ? (
                          <ResolvedImageList urls={r.proofImageUrls} label="Ảnh chứng từ" compact />
                        ) : null}
                        {r.payerComment ? (
                          <Typography.Text type="secondary" className="text-xs">
                            Ghi chú người trả: {r.payerComment}
                          </Typography.Text>
                        ) : null}
                        {r.status === 'PENDING' && r.leaderComment ? (
                          <Alert
                            type="warning"
                            showIcon
                            className="text-sm"
                            message="Lần trước bị từ chối"
                            description={r.leaderComment}
                          />
                        ) : null}
                        <Space wrap>
                          {r.status === 'PENDING' && r.payerUserId === uid ? (
                            <Button
                              type="primary"
                              size="small"
                              onClick={() => {
                                setActiveRecord(r)
                                setModalOpen(true)
                              }}
                            >
                              Nộp chứng từ đã chuyển
                            </Button>
                          ) : null}
                          {r.status === 'PENDING' && canReview && r.payerUserId !== uid ? (
                            <Button
                              type="default"
                              size="small"
                              loading={accept.isPending}
                              onClick={() => void onAccept(r.id, true)}
                            >
                              Xác nhận đã nhận tiền
                            </Button>
                          ) : null}
                          {r.status === 'CONFIRMED' && r.payerUserId === uid ? (
                            <Button
                              size="small"
                              icon={<BellOutlined />}
                              loading={nudgeReview.isPending}
                              onClick={() =>
                                void nudgeReview
                                  .mutateAsync(r.id)
                                  .then((d) =>
                                    message.success(
                                      d.notified > 0
                                        ? `Đã gửi nhắc tới ${d.notified} người`
                                        : 'Đã gửi nhắc',
                                    ),
                                  )
                                  .catch((e) => message.error(e instanceof Error ? e.message : 'Lỗi'))
                              }
                            >
                              Nhắc xác nhận
                            </Button>
                          ) : null}
                          {r.status === 'CONFIRMED' && canReview ? (
                            <>
                              <Button
                                type="primary"
                                size="small"
                                icon={<CheckCircleOutlined />}
                                loading={accept.isPending}
                                onClick={() => void onAccept(r.id, true)}
                              >
                                Duyệt
                              </Button>
                              <Button
                                danger
                                size="small"
                                icon={<CloseCircleOutlined />}
                                loading={accept.isPending}
                                onClick={() => void onAccept(r.id, false)}
                              >
                                Từ chối
                              </Button>
                            </>
                          ) : null}
                          {r.status === 'ACCEPTED' ? (
                            <Typography.Text type="success">
                              <CheckCircleOutlined /> Đã duyệt{' '}
                              {r.acceptedAt ? timeAgo(r.acceptedAt) : ''}
                            </Typography.Text>
                          ) : null}
                          {r.status === 'REJECTED' ? (
                            <div className="w-full space-y-2">
                              <Alert
                                type="error"
                                showIcon
                                message="Chứng từ bị từ chối"
                                description={
                                  r.leaderComment?.trim() || 'Người duyệt không ghi thêm lý do.'
                                }
                              />
                              <Space wrap>
                                {group?.myRole === 'LEADER' && r.payerUserId !== uid ? (
                                  <Button
                                    size="small"
                                    loading={reopenRejected.isPending}
                                    onClick={() =>
                                      void reopenRejected
                                        .mutateAsync(r.id)
                                        .then(() =>
                                          message.success('Đã gửi yêu cầu thanh toán lại cho người trả'),
                                        )
                                        .catch((e) => message.error(e instanceof Error ? e.message : 'Lỗi'))
                                    }
                                  >
                                    Yêu cầu thanh toán lại
                                  </Button>
                                ) : null}
                                {r.payerUserId === uid ? (
                                  <Button
                                    type="primary"
                                    size="small"
                                    loading={reopenRejected.isPending}
                                    onClick={() =>
                                      void reopenRejected
                                        .mutateAsync(r.id)
                                        .then(() =>
                                          message.success('Đã mở lại — vui lòng nộp chứng từ mới'),
                                        )
                                        .catch((e) => message.error(e instanceof Error ? e.message : 'Lỗi'))
                                    }
                                  >
                                    Cập nhật thanh toán lại
                                  </Button>
                                ) : null}
                              </Space>
                            </div>
                          ) : null}
                        </Space>
                      </div>
                    )
                  },
                }}
              />
            </Card>

            {group?.myRole === 'LEADER' ? (
              <Collapse
                items={[
                  {
                    key: 'stats',
                    label: 'Thống kê (trưởng nhóm)',
                    children: (
                      <div className="space-y-6">
                        <div className="h-64">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={barData}>
                              <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                              <YAxis width={88} tick={{ fontSize: 10 }} tickFormatter={(v) => formatVND(v)} />
                              <Tooltip formatter={(v) => formatVND(Number(v))} />
                              <Bar dataKey="paid" name="Đã trả (bill)" fill="#1677ff" />
                              <Bar dataKey="fund" name="Quỹ (kỳ)" fill="#00a32a" />
                              <Bar dataKey="owed" name="Phải trả (bill)" fill="#faad14" />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                        <div className="h-64">
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                              <Pie
                                data={pieData}
                                dataKey="value"
                                nameKey="name"
                                cx="50%"
                                cy="50%"
                                outerRadius={80}
                                label={(p: { name?: string; value?: number }) =>
                                  `${p.name ?? ''}: ${formatVND(p.value ?? 0)}`
                                }
                              >
                                {pieData.map((e, i) => (
                                  <Cell key={e.name} fill={COLORS[i % COLORS.length]} />
                                ))}
                              </Pie>
                              <Tooltip formatter={(v) => formatVND(Number(v))} />
                            </PieChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                    ),
                  },
                ]}
              />
            ) : null}

            <Card title="Chi tiêu trong đợt">
              <Typography.Paragraph type="secondary" className="!mb-3 !mt-0 text-sm">
                Chi chung trong đợt (không gồm chi riêng). Dữ liệu lấy từ hệ thống hoặc bản lưu lúc tạo đợt nếu bản ghi cũ chưa có liên kết đầy đủ trên chi tiêu.
              </Typography.Paragraph>
              {fromSnapshotOnly ? (
                <Alert
                  type="info"
                  showIcon
                  className="mb-3"
                  message="Danh sách theo bản lưu lúc tạo đợt"
                  description="Các đợt tạo trước khi lưu đầy đủ snapshot có thể không có dòng nào. Đợt mới luôn có danh sách khi có chi trong kỳ."
                />
              ) : null}
              <Table<SettlementExpenseInBatchDto>
                rowKey="id"
                size="small"
                columns={expenseColumns}
                dataSource={paginatedSettlementExpenses}
                scroll={{ x: true }}
                locale={{
                  emptyText:
                    'Không có khoản chi nào trong đợt (hoặc đợt cũ chưa lưu danh sách chi — các đợt tạo sau bản cập nhật này sẽ có đầy đủ).',
                }}
                pagination={{
                  current: expensePage,
                  total: settlementExpenseRows.length,
                  pageSize: expensePageSize,
                  showSizeChanger: false,
                  onChange: (p) => setExpensePage(p),
                }}
              />
            </Card>
          </Space>
          <MemberProfileDrawer member={profileMember} onClose={() => setProfileMember(null)} />
          <ConfirmPaymentModal
            open={modalOpen}
            onClose={() => {
              setModalOpen(false)
              setActiveRecord(null)
            }}
            groupId={groupId}
            settlementId={settlementId}
            record={activeRecord}
          />
        </>
      )}
    </AppLayout>
  )
}
