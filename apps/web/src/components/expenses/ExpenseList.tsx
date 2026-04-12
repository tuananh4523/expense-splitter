import { CurrencyDisplay } from '@/components/shared/CurrencyDisplay'
import { EmptyState } from '@/components/shared/EmptyState'
import { fmtDate } from '@/utils/date'
import { expenseCanRestore } from '@/utils/expenseSoftDelete'
import { CategoryLabel } from '@/components/expenses/CategoryLabel'
import {
  expenseLockedForEditDelete,
  expenseStatusColor,
  expenseStatusLabel,
} from '@/utils/expenseStatusDisplay'
import type { ExpenseDto } from '@expense/types'
import { Icon } from '@iconify/react'
import { Button, Popconfirm, Table, Tag, Tooltip } from 'antd'
import type { TagProps } from 'antd'
import type { ColumnsType } from 'antd/es/table'

export function ExpenseList({
  groupId: _groupId,
  data,
  loading,
  page,
  total,
  pageSize,
  onPageChange,
  onRowOpen,
  onStandaloneOpen,
  onEditOpen,
  onDeleteExpense,
  onRestoreExpense,
  emptyDescription,
}: {
  groupId: string
  data: ExpenseDto[]
  loading: boolean
  page: number
  total: number
  pageSize: number
  onPageChange: (p: number, ps: number) => void
  onRowOpen?: (expenseId: string) => void
  onStandaloneOpen?: (expenseId: string) => void
  onEditOpen?: (expenseId: string) => void
  onDeleteExpense?: (expenseId: string) => void
  onRestoreExpense?: (expenseId: string) => void
  emptyDescription?: string
}) {
  const columns: ColumnsType<ExpenseDto> = [
    {
      title: 'Tiêu đề',
      dataIndex: 'title',
      key: 'title',
      align: 'left',
      render: (t: string, r) => (
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="min-w-0">{t}</span>
          {r.deletedAt ? (
            <Tag color="default" className="!m-0 shrink-0">
              Đã xóa
            </Tag>
          ) : null}
          {r.isStandalone ? (
            <Tag color="purple" className="!m-0 shrink-0">
              Riêng
            </Tag>
          ) : null}
        </span>
      ),
    },
    {
      title: 'Số tiền',
      dataIndex: 'amount',
      key: 'amount',
      align: 'right',
      render: (v: string) => (
        <CurrencyDisplay amount={v} className="whitespace-nowrap font-medium tabular-nums" />
      ),
    },
    {
      title: 'Ngày',
      dataIndex: 'expenseDate',
      key: 'expenseDate',
      align: 'left',
      render: (d: string) => fmtDate(d),
    },
    {
      title: 'Danh mục',
      key: 'category',
      align: 'left',
      render: (_, r) =>
        r.category ? (
          <CategoryLabel
            name={r.category.name}
            icon={r.category.icon}
            color={r.category.color}
            iconSize={14}
          />
        ) : (
          <span className="text-stone-300">—</span>
        ),
    },
    {
      title: 'Trả bởi',
      key: 'paidBy',
      align: 'left',
      render: (_, r) => r.paidBy.name,
    },
    {
      title: 'Trạng thái',
      dataIndex: 'status',
      key: 'status',
      align: 'left',
      render: (s: string) => {
        const c = expenseStatusColor[s] as TagProps['color'] | undefined
        return <Tag {...(c ? { color: c } : {})}>{expenseStatusLabel[s] ?? s}</Tag>
      },
    },
    {
      title: '',
      key: 'actions',
      align: 'right',
      width: 148,
      render: (_, r) => {
        const isDeleted = Boolean(r.deletedAt)
        const canRestore = isDeleted && expenseCanRestore(r.deletedAt)
        return (
          <div
            className="flex items-center justify-end gap-1"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
          >
            {isDeleted && onRestoreExpense ? (
              canRestore ? (
                <Popconfirm
                  title="Khôi phục chi tiêu đã xóa?"
                  description="Chi tiêu sẽ hiện lại trong danh sách chính."
                  okText="Khôi phục"
                  cancelText="Huỷ"
                  onConfirm={() => onRestoreExpense(r.id)}
                >
                  <Tooltip title="Khôi phục (trong 7 ngày)">
                    <Button
                      type="text"
                      size="small"
                      icon={<Icon icon="mdi:restore" width={16} />}
                    />
                  </Tooltip>
                </Popconfirm>
              ) : (
                <Tooltip title="Đã quá 7 ngày — không thể khôi phục">
                  <Button type="text" size="small" disabled icon={<Icon icon="mdi:restore" width={16} />} />
                </Tooltip>
              )
            ) : null}
            {!isDeleted && r.isStandalone ? (
              <Tooltip title="Thanh toán riêng">
                <Button
                  type="text"
                  size="small"
                  icon={<Icon icon="mdi:wallet-outline" width={16} />}
                  onClick={() => onStandaloneOpen?.(r.id)}
                />
              </Tooltip>
            ) : null}
            {!isDeleted && onEditOpen && !expenseLockedForEditDelete(r.status) ? (
              <Tooltip title="Sửa chi tiêu">
                <Button
                  type="text"
                  size="small"
                  icon={<Icon icon="mdi:pencil-outline" width={16} />}
                  onClick={() => onEditOpen(r.id)}
                />
              </Tooltip>
            ) : null}
            {!isDeleted && onDeleteExpense && !expenseLockedForEditDelete(r.status) ? (
              <Popconfirm
                title="Xoá chi tiêu này?"
                description="Có thể khôi phục trong 7 ngày ở mục «Đã xóa»."
                okText="Xoá"
                okButtonProps={{ danger: true }}
                onConfirm={() => onDeleteExpense(r.id)}
              >
                <Tooltip title="Xoá chi tiêu">
                  <Button
                    type="text"
                    size="small"
                    danger
                    icon={<Icon icon="mdi:trash-can-outline" width={16} />}
                  />
                </Tooltip>
              </Popconfirm>
            ) : null}
            {!isDeleted ? (
              <Tooltip title="Xem chi tiết">
                <Button
                  type="text"
                  size="small"
                  icon={<Icon icon="mdi:eye-outline" width={16} />}
                  onClick={() => onRowOpen?.(r.id)}
                />
              </Tooltip>
            ) : (
              <Tooltip title="Chi đã xóa — không xem chi tiết tại đây">
                <Button
                  type="text"
                  size="small"
                  disabled
                  icon={<Icon icon="mdi:eye-off-outline" width={16} />}
                />
              </Tooltip>
            )}
          </div>
        )
      },
    },
  ]

  if (!loading && !data.length) {
    return <EmptyState description={emptyDescription ?? 'Chưa có chi tiêu'} />
  }

  return (
    <Table<ExpenseDto>
      rowKey="id"
      loading={loading}
      columns={columns}
      dataSource={data}
      rowClassName={(record) =>
        [
          record.standaloneAttention ? 'expense-row-standalone-attention' : '',
          record.deletedAt ? 'expense-row-soft-deleted opacity-80' : '',
        ]
          .filter(Boolean)
          .join(' ')
      }
      pagination={{
        current: page,
        total,
        pageSize,
        showSizeChanger: true,
        onChange: onPageChange,
      }}
      scroll={{ x: true }}
    />
  )
}
