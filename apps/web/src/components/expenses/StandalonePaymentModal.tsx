import { CurrencyDisplay } from '@/components/shared/CurrencyDisplay'
import { FileUpload } from '@/components/shared/FileUpload'
import { ResolvedImageList } from '@/components/shared/ResolvedImageList'
import {
  useAcceptStandalonePayment,
  useConfirmStandalonePayment,
  useNotifyStandalonePayer,
  useReopenRejectedStandalonePayment,
  useRequestStandalonePaymentReview,
  useStandaloneState,
} from '@/hooks/useExpenses'
import { useGroup } from '@/hooks/useGroup'
import { paymentRecordStatusShort, paymentRecordStatusVi } from '@/utils/statusLabels'
import { fmtDate } from '@/utils/date'
import type { PaymentRecordDto } from '@expense/types'
import { BellOutlined, CheckCircleOutlined } from '@ant-design/icons'
import {
  Alert,
  App,
  Avatar,
  Button,
  Descriptions,
  Modal,
  Table,
  Tabs,
  Tag,
  Tooltip,
  Typography,
} from 'antd'
import { useSession } from 'next-auth/react'
import { useState } from 'react'

function recordStatusTag(s: string) {
  const color =
    s === 'ACCEPTED' ? 'success' : s === 'CONFIRMED' ? 'processing' : s === 'REJECTED' ? 'error' : 'default'
  return (
    <Tooltip title={paymentRecordStatusVi(s)}>
      <Tag color={color} className="!mr-0 shrink-0">
        {paymentRecordStatusShort(s)}
      </Tag>
    </Tooltip>
  )
}

export function StandalonePaymentModal({
  open,
  onClose,
  groupId,
  expenseId,
}: {
  open: boolean
  onClose: () => void
  groupId: string
  expenseId: string
}) {
  const { message } = App.useApp()
  const { data: session } = useSession()
  const { data: group } = useGroup(groupId)
  const { data, isLoading, refetch } = useStandaloneState(groupId, expenseId, open)
  const confirm = useConfirmStandalonePayment(groupId, expenseId)
  const accept = useAcceptStandalonePayment(groupId, expenseId)
  const nudgeReview = useRequestStandalonePaymentReview(groupId, expenseId)
  const notifyPayer = useNotifyStandalonePayer(groupId, expenseId)
  const reopenRejected = useReopenRejectedStandalonePayment(groupId, expenseId)
  const [proofByRecord, setProofByRecord] = useState<Record<string, string[]>>({})

  const uid = session?.user?.id
  const isLeader = group?.myRole === 'LEADER'

  const onConfirmPay = async (r: PaymentRecordDto) => {
    const urls = proofByRecord[r.id] ?? []
    if (urls.length === 0) {
      message.error('Cần ít nhất một ảnh xác nhận')
      return
    }
    try {
      await confirm.mutateAsync({ paymentRecordId: r.id, proofImageUrls: urls })
      message.success('Đã gửi xác nhận')
      void refetch()
    } catch (e) {
      message.error(e instanceof Error ? e.message : 'Lỗi')
    }
  }

  const onAccept = async (r: PaymentRecordDto, ok: boolean) => {
    try {
      await accept.mutateAsync({ paymentRecordId: r.id, accepted: ok })
      message.success(ok ? 'Đã chấp nhận' : 'Đã từ chối')
      void refetch()
    } catch (e) {
      message.error(e instanceof Error ? e.message : 'Lỗi')
    }
  }

  return (
    <Modal open={open} onCancel={onClose} footer={null} width={640} title="Chi tiêu riêng" destroyOnClose>
      {isLoading || !data ? (
        <Typography.Text type="secondary">Đang tải…</Typography.Text>
      ) : (
        <Tabs
          items={[
            {
              key: 'detail',
              label: 'Chi tiết',
              children: (
                <div className="space-y-3">
                  <Typography.Title level={5} className="!mb-0">
                    {data.expense.title}
                  </Typography.Title>
                  <Descriptions size="small" column={1}>
                    <Descriptions.Item label="Số tiền">
                      <CurrencyDisplay amount={data.expense.amount} />
                    </Descriptions.Item>
                    <Descriptions.Item label="Ngày">{fmtDate(data.expense.expenseDate)}</Descriptions.Item>
                    <Descriptions.Item label="Trả bởi">{data.expense.paidBy.name}</Descriptions.Item>
                  </Descriptions>
                  <Table
                    size="small"
                    pagination={false}
                    rowKey="userId"
                    dataSource={data.expense.splits.filter((s) => !s.isExcluded)}
                    columns={[
                      { title: 'Thành viên', render: (_, s) => s.user.name },
                      {
                        title: 'Phần',
                        render: (_, s) => <CurrencyDisplay amount={s.amount} />,
                      },
                    ]}
                  />
                </div>
              ),
            },
            {
              key: 'pay',
              label: 'Trạng thái thanh toán',
              children: (
                <div className="flex flex-col gap-3">
                  {data.allAccepted ? (
                    <Alert
                      type="success"
                      showIcon
                      icon={<CheckCircleOutlined />}
                      message="Khoản chi này đã được thanh toán riêng — không tính vào tổng kết."
                    />
                  ) : null}
                  {data.records.map((r) => {
                    const canReviewStandalone = Boolean(uid && (r.receiverUserId === uid || isLeader))
                    return (
                      <div
                        key={r.id}
                        className="overflow-hidden rounded-xl border border-stone-200/90 bg-white shadow-sm"
                      >
                        {/* Header: một hàng cân, không chia cột lệch */}
                        <div className="flex gap-3 border-b border-stone-100 bg-stone-50/80 px-4 py-3">
                          <Avatar className="shrink-0" size={44} src={r.payer.avatarUrl ?? undefined}>
                            {r.payer.name[0]}
                          </Avatar>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                              <span className="font-semibold text-stone-900">{r.payer.name}</span>
                              <span className="text-stone-400">→</span>
                              <span className="font-medium text-stone-800">{r.receiver.name}</span>
                            </div>
                            <div className="mt-0.5 flex flex-wrap items-center gap-2">
                              <CurrencyDisplay amount={r.amount} className="text-[15px] font-semibold text-brand-text" />
                              {recordStatusTag(r.status)}
                            </div>
                          </div>
                        </div>

                        {/* Nội dung: full width, căn đều */}
                        <div className="space-y-3 px-4 py-3">
                          {r.status === 'PENDING' && r.leaderComment ? (
                            <Alert
                              type="warning"
                              showIcon
                              message="Lần trước bị từ chối"
                              description={r.leaderComment}
                            />
                          ) : null}
                          {r.proofImageUrls.length > 0 ? (
                            <div className="rounded-lg bg-stone-50/90 p-3 ring-1 ring-inset ring-stone-100">
                              <div className="mb-2 text-xs font-medium uppercase tracking-wide text-stone-500">
                                Ảnh chứng từ
                              </div>
                              <ResolvedImageList urls={r.proofImageUrls} compact />
                            </div>
                          ) : null}

                          {r.payerComment ? (
                            <Typography.Text type="secondary" className="block text-xs leading-relaxed">
                              Ghi chú người trả: {r.payerComment}
                            </Typography.Text>
                          ) : null}

                          {r.status === 'PENDING' && r.payerUserId === uid ? (
                            <div className="space-y-4">
                              <FileUpload
                                groupId={groupId}
                                uploadType="payment"
                                value={proofByRecord[r.id] ?? []}
                                onChange={(urls) => setProofByRecord((m) => ({ ...m, [r.id]: urls }))}
                              />
                              <div className="flex justify-end border-t border-stone-200 pt-4">
                                <Button
                                  type="primary"
                                  size="middle"
                                  loading={confirm.isPending}
                                  onClick={() => void onConfirmPay(r)}
                                >
                                  Xác nhận đã chuyển (kèm chứng từ)
                                </Button>
                              </div>
                            </div>
                          ) : null}

                          {r.status === 'PENDING' && canReviewStandalone && r.payerUserId !== uid ? (
                            <div className="space-y-3 rounded-lg border border-[#b8dbe8] bg-brand-soft/50 p-3">
                              <p className="m-0 text-sm leading-snug text-stone-600">
                                Đã nhận tiền mặt hoặc chuyển khoản? Bạn có thể xác nhận ngay, không cần chờ ảnh từ
                                người trả.
                              </p>
                              <div className="flex flex-wrap justify-end gap-2">
                                <Button
                                  size="middle"
                                  icon={<BellOutlined />}
                                  loading={notifyPayer.isPending}
                                  onClick={() =>
                                    void notifyPayer
                                      .mutateAsync(r.id)
                                      .then((d) =>
                                        message.success(
                                          d.notified > 0 ? 'Đã gửi nhắc chuyển tiền' : 'Đã gửi',
                                        ),
                                      )
                                      .catch((e) => message.error(e instanceof Error ? e.message : 'Lỗi'))
                                  }
                                >
                                  Nhắc chuyển tiền
                                </Button>
                                <Button
                                  type="primary"
                                  size="middle"
                                  className="min-w-[200px]"
                                  loading={accept.isPending}
                                  onClick={() => void onAccept(r, true)}
                                >
                                  Xác nhận đã nhận tiền
                                </Button>
                              </div>
                            </div>
                          ) : null}

                          {r.status === 'CONFIRMED' && r.payerUserId === uid ? (
                            <div className="flex flex-wrap justify-end gap-2">
                              <Button
                                size="middle"
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
                            </div>
                          ) : null}

                          {r.status === 'CONFIRMED' && canReviewStandalone ? (
                            <div className="flex flex-wrap justify-end gap-2 border-t border-stone-100 pt-3">
                              <Button
                                type="primary"
                                size="middle"
                                loading={accept.isPending}
                                onClick={() => void onAccept(r, true)}
                              >
                                Duyệt
                              </Button>
                              <Button danger size="middle" loading={accept.isPending} onClick={() => void onAccept(r, false)}>
                                Từ chối
                              </Button>
                            </div>
                          ) : null}

                          {r.status === 'REJECTED' ? (
                            <div className="space-y-3 rounded-lg border border-red-100 bg-red-50/40 p-3">
                              <Alert
                                type="error"
                                showIcon
                                message="Chứng từ bị từ chối"
                                description={
                                  r.leaderComment?.trim() || 'Người duyệt không ghi thêm lý do.'
                                }
                              />
                              {r.proofImageUrls.length > 0 ? (
                                <div className="rounded-lg bg-white/90 p-2 ring-1 ring-stone-100">
                                  <div className="mb-1 text-xs text-stone-500">
                                    Chứng từ đã nộp (bị từ chối)
                                  </div>
                                  <ResolvedImageList urls={r.proofImageUrls} compact />
                                </div>
                              ) : null}
                              <div className="flex flex-wrap justify-end gap-2">
                                {isLeader && r.payerUserId !== uid ? (
                                  <Button
                                    size="middle"
                                    loading={reopenRejected.isPending}
                                    onClick={() =>
                                      void reopenRejected
                                        .mutateAsync(r.id)
                                        .then(() => {
                                          message.success('Đã gửi yêu cầu thanh toán lại cho người trả')
                                          void refetch()
                                        })
                                        .catch((e) => message.error(e instanceof Error ? e.message : 'Lỗi'))
                                    }
                                  >
                                    Yêu cầu thanh toán lại
                                  </Button>
                                ) : null}
                                {r.payerUserId === uid ? (
                                  <Button
                                    type="primary"
                                    size="middle"
                                    loading={reopenRejected.isPending}
                                    onClick={() =>
                                      void reopenRejected
                                        .mutateAsync(r.id)
                                        .then(() => {
                                          message.success('Đã mở lại — vui lòng nộp chứng từ mới')
                                          void refetch()
                                        })
                                        .catch((e) => message.error(e instanceof Error ? e.message : 'Lỗi'))
                                    }
                                  >
                                    Cập nhật thanh toán lại
                                  </Button>
                                ) : null}
                              </div>
                            </div>
                          ) : null}
                        </div>
                      </div>
                    )
                  })}
                </div>
              ),
            },
          ]}
        />
      )}
    </Modal>
  )
}
