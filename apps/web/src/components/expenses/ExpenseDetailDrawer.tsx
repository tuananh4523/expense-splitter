import { CommentSection } from '@/components/expenses/CommentSection'
import { MemberProfileDrawer } from '@/components/groups/MemberProfileDrawer'
import { CurrencyDisplay } from '@/components/shared/CurrencyDisplay'
import { MemberAvatarNameButton } from '@/components/shared/MemberAvatarNameButton'
import { ResolvedImageList } from '@/components/shared/ResolvedImageList'
import { useGroupMembers } from '@/hooks/useGroup'
import { useExpense, useExpenseAudit } from '@/hooks/useExpenses'
import { fmtDate, fmtDateTime } from '@/utils/date'
import { expenseLockedForEditDelete, expenseStatusColor, expenseStatusLabel } from '@/utils/expenseStatusDisplay'
import { groupActivityActionVi } from '@/utils/activityLabels'
import { Icon } from '@iconify/react'
import type { MemberDto, UserDto } from '@expense/types'
import { Button, Descriptions, Drawer, Spin, Table, Tabs, Tag, Typography } from 'antd'
import { Fragment, useCallback, useMemo, useState } from 'react'

export function ExpenseDetailDrawer({
  groupId,
  expenseId,
  open,
  onClose,
  onRequestEdit,
}: {
  groupId: string
  expenseId: string | null
  open: boolean
  onClose: () => void
  /** Mở form sửa (SPA) — không cần F5 / đổi trang. */
  onRequestEdit?: (id: string) => void
}) {
  const [profileMember, setProfileMember] = useState<MemberDto | null>(null)
  const { data: membersData } = useGroupMembers(groupId)
  const memberByUserId = useMemo(() => {
    const m = new Map<string, MemberDto>()
    for (const x of membersData?.members ?? []) m.set(x.userId, x)
    return m
  }, [membersData?.members])

  const openMemberProfile = useCallback(
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

  const { data: expense, isLoading } = useExpense(groupId, expenseId ?? '')
  const { data: audit = [], isLoading: auditLoading } = useExpenseAudit(
    groupId,
    expenseId ?? '',
    open && Boolean(expenseId),
  )

  return (
    <Fragment>
      <Drawer
        title="Chi tiêu"
        placement="right"
        width={600}
        onClose={onClose}
        open={open}
        destroyOnClose
        extra={
          !isLoading &&
          expense &&
          onRequestEdit &&
          !expenseLockedForEditDelete(expense.status) ? (
            <Button
              type="primary"
              onClick={() => {
                onRequestEdit(expense.id)
                onClose()
              }}
            >
              Sửa
            </Button>
          ) : undefined
        }
      >
      {isLoading || !expense ? (
        <Spin className="mt-8 block" />
      ) : (
        <Tabs
          items={[
            {
              key: 'info',
              label: 'Chi tiết',
              children: (
                <div className="space-y-0">
                  <Descriptions
                    bordered
                    size="small"
                    column={1}
                    className="[&_.ant-descriptions-item-label]:w-[132px] [&_.ant-descriptions-item-label]:bg-stone-50/80 [&_.ant-descriptions-item-label]:text-stone-600"
                    items={[
                      {
                        key: 'title',
                        label: 'Tiêu đề',
                        children: (
                          <span className="min-w-0 text-base font-semibold leading-snug text-stone-900">
                            {expense.title}
                          </span>
                        ),
                      },
                      {
                        key: 'status',
                        label: 'Trạng thái',
                        children: (
                          <Tag color={expenseStatusColor[expense.status] ?? 'default'}>
                            {expenseStatusLabel[expense.status] ?? expense.status}
                          </Tag>
                        ),
                      },
                      {
                        key: 'amount',
                        label: 'Số tiền',
                        children: (
                          <span className="text-xl font-bold tabular-nums text-stone-900">
                            <CurrencyDisplay amount={expense.amount} />
                          </span>
                        ),
                      },
                      {
                        key: 'category',
                        label: 'Danh mục',
                        children: expense.category ? (
                          <span className="inline-flex items-center gap-1.5 text-stone-800">
                            {expense.category.icon?.includes(':') ? (
                              <Icon icon={expense.category.icon} width={16} />
                            ) : expense.category.icon ? (
                              <span>{expense.category.icon}</span>
                            ) : null}
                            {expense.category.name}
                          </span>
                        ) : (
                          <Typography.Text type="secondary">—</Typography.Text>
                        ),
                      },
                      {
                        key: 'expenseDate',
                        label: 'Ngày chi',
                        children: (
                          <span className="inline-flex items-center gap-1.5 tabular-nums text-stone-800">
                            <Icon icon="mdi:calendar-outline" width={16} className="text-stone-400" />
                            {fmtDate(expense.expenseDate)}
                          </span>
                        ),
                      },
                      {
                        key: 'createdAt',
                        label: 'Ghi nhận lúc',
                        children: (
                          <span className="inline-flex items-center gap-1.5 tabular-nums text-stone-800">
                            <Icon icon="mdi:clock-outline" width={16} className="text-stone-400" />
                            {fmtDateTime(expense.createdAt)}
                          </span>
                        ),
                      },
                      {
                        key: 'paidBy',
                        label: 'Trả bởi',
                        children: expense.paidBy ? (
                          <MemberAvatarNameButton
                            userId={expense.paidBy.id}
                            user={expense.paidBy}
                            size={32}
                            className="-ml-1 max-w-full"
                            onOpen={openMemberProfile}
                          />
                        ) : (
                          <Typography.Text type="secondary">—</Typography.Text>
                        ),
                      },
                      {
                        key: 'createdBy',
                        label: 'Người tạo bản ghi',
                        children: expense.createdBy ? (
                          <MemberAvatarNameButton
                            userId={expense.createdBy.id}
                            user={expense.createdBy}
                            size={32}
                            className="-ml-1 max-w-full"
                            onOpen={openMemberProfile}
                          />
                        ) : (
                          <Typography.Text type="secondary" className="text-xs">
                            Không xác định (dữ liệu cũ hoặc thiếu lịch sử)
                          </Typography.Text>
                        ),
                      },
                      {
                        key: 'standalone',
                        label: 'Loại',
                        children: expense.isStandalone ? (
                          <Tag color="orange" className="!m-0">
                            Chi riêng — không gộp tổng kết chung
                          </Tag>
                        ) : (
                          <Typography.Text type="secondary">Chi chung</Typography.Text>
                        ),
                      },
                      ...(expense.tags?.length
                        ? [
                            {
                              key: 'tags',
                              label: 'Thẻ',
                              children: (
                                <div className="flex flex-wrap gap-1">
                                  {expense.tags.map((t) => (
                                    <Tag key={t} className="!m-0">
                                      {t}
                                    </Tag>
                                  ))}
                                </div>
                              ),
                            },
                          ]
                        : []),
                      ...(expense.description
                        ? [
                            {
                              key: 'description',
                              label: 'Mô tả',
                              children: (
                                <Typography.Paragraph className="!mb-0 whitespace-pre-wrap text-stone-800">
                                  {expense.description}
                                </Typography.Paragraph>
                              ),
                            },
                          ]
                        : []),
                    ]}
                  />

                  <section className="mt-4 border-t border-stone-200 pt-3">
                    <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-stone-500">Phần chia</div>
                    <Table
                      size="small"
                      pagination={false}
                      rowKey="userId"
                      className="overflow-hidden rounded border border-stone-200"
                      dataSource={expense.splits.filter((s) => !s.isExcluded)}
                      columns={[
                        {
                          title: 'Thành viên',
                          render: (_, s) => (
                            <MemberAvatarNameButton
                              userId={s.userId}
                              user={s.user}
                              size={32}
                              className="max-w-full"
                              onOpen={openMemberProfile}
                            />
                          ),
                        },
                        {
                          title: 'Số tiền',
                          align: 'right' as const,
                          render: (_, s) => <CurrencyDisplay amount={s.amount} />,
                        },
                      ]}
                    />
                  </section>

                  {expense.imageUrls?.length ? (
                    <section className="mt-4 border-t border-stone-200 pt-3">
                      <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-stone-500">
                        Hoá đơn / ảnh
                      </div>
                      <ResolvedImageList urls={expense.imageUrls} />
                    </section>
                  ) : null}
                </div>
              ),
            },
            {
              key: 'comments',
              label: 'Bình luận',
              children: expenseId ? <CommentSection groupId={groupId} expenseId={expenseId} /> : null,
            },
            {
              key: 'audit',
              label: 'Lịch sử',
              children: auditLoading ? (
                <Spin />
              ) : (
                <ul className="list-none space-y-2 p-0">
                  {audit.map((a) => (
                    <li key={a.id} className="rounded-lg border border-stone-100 bg-white p-3 text-sm shadow-sm">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium text-stone-900">{a.actorName}</span>
                        {a.actorEmail ? (
                          <span className="text-xs text-stone-500">{a.actorEmail}</span>
                        ) : null}
                        <Tag className="!m-0" color={a.source === 'group_activity' ? 'blue' : 'default'}>
                          {a.source === 'group_activity' ? 'Chi tiết' : 'Audit cũ'}
                        </Tag>
                        <span className="text-xs text-stone-400">{fmtDate(a.createdAt)}</span>
                      </div>
                      <div className="mt-1 text-stone-700">{a.summary}</div>
                      <div className="mt-0.5 text-xs text-stone-500">
                        {groupActivityActionVi(a.action)}
                        {a.source === 'audit_legacy' ? ' (bản ghi cũ)' : ''}
                      </div>
                    </li>
                  ))}
                </ul>
              ),
            },
          ]}
        />
      )}
      </Drawer>
      <MemberProfileDrawer member={profileMember} onClose={() => setProfileMember(null)} />
    </Fragment>
  )
}
