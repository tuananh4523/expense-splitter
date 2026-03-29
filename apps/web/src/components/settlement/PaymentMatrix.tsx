import { CurrencyDisplay } from '@/components/shared/CurrencyDisplay'
import type { MemberDto, Transfer } from '@expense/types'
import { Table, Tag } from 'antd'
import type { ColumnsType } from 'antd/es/table'

export function PaymentMatrix({
  transfers,
  members,
  resolveName,
}: {
  transfers: Transfer[]
  members: MemberDto[]
  /** Ưu tiên dùng khi có thành viên đã rời nhóm nhưng vẫn nằm trong luồng tổng kết. */
  resolveName?: (userId: string) => string
}) {
  const name = (id: string) =>
    resolveName?.(id) ?? members.find((m) => m.userId === id)?.user.name ?? id

  const columns: ColumnsType<Transfer & { key: string }> = [
    {
      title: 'Người trả',
      key: 'from',
      render: (_, r) => name(r.fromUserId),
    },
    {
      title: 'Người nhận',
      key: 'to',
      render: (_, r) => name(r.toUserId),
    },
    {
      title: 'Số tiền',
      dataIndex: 'amount',
      key: 'amount',
      render: (v: string) => <CurrencyDisplay amount={v} />,
    },
  ]

  const data = transfers.map((t, i) => ({ ...t, key: `${i}` }))

  if (!transfers.length) {
    return <Tag>Không có giao dịch gợi ý</Tag>
  }

  return <Table rowKey="key" size="small" pagination={false} columns={columns} dataSource={data} />
}
