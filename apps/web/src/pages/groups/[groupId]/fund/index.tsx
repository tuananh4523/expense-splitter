import { ContributeModal } from '@/components/fund/ContributeModal'
import { FundOverview } from '@/components/fund/FundOverview'
import AppLayout from '@/components/layout/AppLayout'
import { CurrencyDisplay } from '@/components/shared/CurrencyDisplay'
import { ResolvedImageList } from '@/components/shared/ResolvedImageList'
import { useGroup } from '@/hooks/useGroup'
import {
  useApproveFundContribution,
  useFund,
  useRejectFundContribution,
} from '@/hooks/useFund'
import { fmtDateTime } from '@/utils/date'
import { withAuth } from '@/utils/withAuth'
import { WalletOutlined } from '@ant-design/icons'
import { Icon } from '@iconify/react'
import type { FundTransactionDto } from '@expense/types'
import { App, Avatar, Button, Input, Modal, Popconfirm, Space, Table, Tooltip, Typography } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/router'
import { useMemo, useState } from 'react'

export const getServerSideProps = withAuth()

function contributionStatusLabel(t: FundTransactionDto): string | null {
  if (t.type !== 'CONTRIBUTE' || !t.contributionStatus) return null
  const s = t.contributionStatus
  if (s === 'PENDING') return 'Chờ duyệt'
  if (s === 'APPROVED') return 'Đã duyệt'
  if (s === 'REJECTED') return 'Đã từ chối'
  return null
}

export default function GroupFundPage() {
  const { message } = App.useApp()
  const router = useRouter()
  const { data: session } = useSession()
  const groupId = typeof router.query.groupId === 'string' ? router.query.groupId : ''
  const { data: group } = useGroup(groupId)
  const { data: fund, isLoading } = useFund(groupId)
  const [open, setOpen] = useState(false)
  const [rejectOpen, setRejectOpen] = useState(false)
  const [rejectTx, setRejectTx] = useState<FundTransactionDto | null>(null)
  const [rejectNote, setRejectNote] = useState('')

  const approve = useApproveFundContribution(groupId)
  const reject = useRejectFundContribution(groupId)

  const myRole = group?.myRole
  const isAdmin = session?.user?.role === 'ADMIN'
  const canReview =
    isAdmin || myRole === 'LEADER' || myRole === 'VICE_LEADER'

  const pendingReviewCount = useMemo(
    () =>
      fund?.transactions.filter(
        (t) => t.type === 'CONTRIBUTE' && t.contributionStatus === 'PENDING',
      ).length ?? 0,
    [fund?.transactions],
  )

  const columns: ColumnsType<FundTransactionDto> = useMemo(
    () => [
      {
        title: 'Thời gian',
        dataIndex: 'createdAt',
        key: 'createdAt',
        width: 168,
        render: (d: string) => (
          <span className="whitespace-nowrap tabular-nums text-sm text-wp-charcoal">{fmtDateTime(d)}</span>
        ),
      },
      {
        title: 'Thành viên',
        key: 'user',
        ellipsis: true,
        render: (_, r) => (
          <div className="flex min-w-0 items-center gap-3">
            <Avatar
              src={r.user.avatarUrl ?? undefined}
              size={32}
              className="shrink-0 bg-stone-200 font-semibold text-stone-700"
            >
              {r.user.name[0]?.toUpperCase()}
            </Avatar>
            <span className="min-w-0 truncate font-medium text-stone-900">{r.user.name}</span>
          </div>
        ),
      },
      {
        title: 'Loại',
        dataIndex: 'type',
        key: 'type',
        width: 112,
        render: (t: string) => (
          <span className="text-sm font-medium text-stone-900">
            {t === 'CONTRIBUTE' ? 'Nộp quỹ' : t === 'DEDUCT' ? 'Khấu trừ' : t}
          </span>
        ),
      },
      {
        title: 'Trạng thái',
        key: 'contributionStatus',
        width: 200,
        render: (_, r) => {
          const st = contributionStatusLabel(r)
          if (!st && !(r.reviewedBy && r.contributionStatus && r.contributionStatus !== 'PENDING')) {
            return <span className="text-sm text-stone-300">—</span>
          }
          return (
            <div className="min-w-0 space-y-1">
              {st ? <div className="text-sm text-wp-charcoal">{st}</div> : null}
              {r.reviewedBy && r.contributionStatus && r.contributionStatus !== 'PENDING' ? (
                <Typography.Text type="secondary" className="!block text-xs leading-snug">
                  {r.contributionStatus === 'APPROVED' ? 'Duyệt bởi' : 'Từ chối bởi'} {r.reviewedBy.name}
                  {r.reviewedAt ? ` · ${fmtDateTime(r.reviewedAt)}` : ''}
                </Typography.Text>
              ) : null}
            </div>
          )
        },
      },
      {
        title: 'Số tiền',
        dataIndex: 'amount',
        key: 'amount',
        align: 'right',
        width: 140,
        render: (v: string, r) => (
          <CurrencyDisplay
            amount={r.type === 'DEDUCT' ? `-${v}` : v}
            className="whitespace-nowrap font-medium tabular-nums text-stone-900"
          />
        ),
      },
      {
        title: 'Chứng từ',
        key: 'proof',
        width: 200,
        render: (_, r) =>
          r.type === 'CONTRIBUTE' && r.proofImageUrls.length > 0 ? (
            <ResolvedImageList urls={r.proofImageUrls} label="" compact />
          ) : (
            <span className="text-sm text-wp-slate">—</span>
          ),
      },
      {
        title: 'Ghi chú',
        dataIndex: 'note',
        key: 'note',
        ellipsis: true,
        render: (n: string | null, r) => (
          <div className="min-w-0 text-sm text-wp-charcoal">
            {n?.trim() ? n : '—'}
            {r.reviewNote ? (
              <span className="mt-1 block text-xs leading-snug text-stone-500">
                Lý do từ chối: {r.reviewNote}
              </span>
            ) : null}
          </div>
        ),
      },
      ...(canReview
        ? [
            {
              title: '',
              key: 'actions',
              width: 104,
              align: 'right' as const,
              fixed: 'right' as const,
              render: (_: unknown, r: FundTransactionDto) =>
                r.type === 'CONTRIBUTE' && r.contributionStatus === 'PENDING' ? (
                  <Space size={4} className="justify-end" onClick={(e) => e.stopPropagation()}>
                    <Popconfirm
                      title="Duyệt nộp quỹ?"
                      description="Số dư quỹ sẽ được cộng sau khi duyệt."
                      okText="Duyệt"
                      cancelText="Huỷ"
                      onConfirm={() =>
                        void approve
                          .mutateAsync(r.id)
                          .then(() => message.success('Đã duyệt nộp quỹ'))
                          .catch((e) => message.error(e instanceof Error ? e.message : 'Lỗi'))
                      }
                    >
                      <Tooltip title="Duyệt nộp quỹ">
                        <Button
                          type="text"
                          size="small"
                          loading={approve.isPending && approve.variables === r.id}
                          icon={<Icon icon="mdi:check-circle-outline" width={18} />}
                          aria-label="Duyệt nộp quỹ"
                        />
                      </Tooltip>
                    </Popconfirm>
                    <Tooltip title="Từ chối">
                      <Button
                        type="text"
                        size="small"
                        danger
                        loading={reject.isPending && reject.variables?.transactionId === r.id}
                        icon={<Icon icon="mdi:close-circle-outline" width={18} />}
                        aria-label="Từ chối nộp quỹ"
                        onClick={() => {
                          setRejectTx(r)
                          setRejectNote('')
                          setRejectOpen(true)
                        }}
                      />
                    </Tooltip>
                  </Space>
                ) : (
                  <span className="text-stone-300">—</span>
                ),
            },
          ]
        : []),
    ],
    [canReview, approve, reject, message],
  )

  if (!groupId) return null

  return (
    <AppLayout title="Quỹ nhóm">
      <div className="mb-6 flex flex-wrap items-center justify-end gap-3">
        <Button type="primary" icon={<WalletOutlined />} onClick={() => setOpen(true)}>
          Đóng quỹ
        </Button>
      </div>

      <div className="flex flex-col gap-8">
        <FundOverview
          fund={fund}
          loading={isLoading}
          pendingReviewCount={pendingReviewCount}
          showReviewerHint={canReview && pendingReviewCount > 0}
        />

        <section className="min-w-0">
          <Typography.Title level={5} className="!mb-4 !mt-0 text-wp-charcoal">
            Lịch sử giao dịch quỹ
          </Typography.Title>
          <Table<FundTransactionDto>
            rowKey="id"
            className="settlement-list-table"
            columns={columns}
            dataSource={fund?.transactions ?? []}
            loading={isLoading}
            pagination={{ pageSize: 10 }}
            scroll={{ x: true }}
            locale={{
              emptyText: 'Chưa có giao dịch quỹ.',
            }}
          />
        </section>
      </div>

      {open ? (
        <ContributeModal open onClose={() => setOpen(false)} groupId={groupId} />
      ) : null}

      <Modal
        title="Từ chối nộp quỹ"
        open={rejectOpen}
        onCancel={() => {
          setRejectOpen(false)
          setRejectTx(null)
        }}
        destroyOnClose
        width={480}
        footer={null}
        className="[&_.ant-modal-content]:overflow-hidden [&_.ant-modal-content]:rounded-2xl"
      >
        <div className="wizard-card-body !gap-4">
          <Typography.Paragraph type="secondary" className="!mb-0 text-sm">
            Ghi chú (tuỳ chọn) sẽ hiển thị cho người nộp trong lịch sử quỹ.
          </Typography.Paragraph>
          <Input.TextArea
            rows={3}
            maxLength={500}
            showCount
            placeholder="Lý do từ chối…"
            value={rejectNote}
            onChange={(e) => setRejectNote(e.target.value)}
          />
        </div>
        <div className="wizard-card-actions">
          <Button
            type="primary"
            danger
            loading={reject.isPending}
            onClick={() => {
              if (!rejectTx) return
              void reject
                .mutateAsync({
                  transactionId: rejectTx.id,
                  ...(rejectNote.trim() ? { note: rejectNote.trim() } : {}),
                })
                .then(() => {
                  message.success('Đã từ chối')
                  setRejectOpen(false)
                  setRejectTx(null)
                })
                .catch((e) => message.error(e instanceof Error ? e.message : 'Lỗi'))
            }}
          >
            Xác nhận từ chối
          </Button>
          <Button
            onClick={() => {
              setRejectOpen(false)
              setRejectTx(null)
            }}
          >
            Huỷ
          </Button>
        </div>
      </Modal>
    </AppLayout>
  )
}
