import { CurrencyDisplay } from '@/components/shared/CurrencyDisplay'
import type { MemberBalance } from '@expense/types'
import { Table, Tooltip } from 'antd'
import type { ColumnsType } from 'antd/es/table'

export function SettlementSummary({ balances }: { balances: MemberBalance[] }) {
  const columns: ColumnsType<MemberBalance> = [
    { title: 'Thành viên', dataIndex: 'userName', key: 'userName' },
    {
      title: 'Đã trả (bill)',
      dataIndex: 'totalPaid',
      key: 'totalPaid',
      align: 'right',
      render: (v: string) => <CurrencyDisplay amount={v} />,
    },
    {
      title: (
        <Tooltip title="Nộp quỹ đã duyệt (theo ngày duyệt) và trừ khấu trừ quỹ (theo ngày giao dịch) trong kỳ — cộng vào cân bằng trước khi tính ai trả ai.">
          <span className="cursor-help border-b border-dotted border-stone-300">Quỹ (trong kỳ)</span>
        </Tooltip>
      ),
      key: 'fundNetInPeriod',
      align: 'right',
      render: (_, r) => (
        <CurrencyDisplay amount={r.fundNetInPeriod ?? '0'} className="tabular-nums" />
      ),
    },
    {
      title: 'Phải trả (bill)',
      dataIndex: 'totalOwed',
      key: 'totalOwed',
      align: 'right',
      render: (v: string) => <CurrencyDisplay amount={v} />,
    },
    {
      title: (
        <Tooltip title="Đã trả + Quỹ (kỳ) − Phải trả. Dương: được nhóm nợ; âm: còn nợ sau khi đã tính quỹ trong kỳ.">
          <span className="cursor-help border-b border-dotted border-stone-300">Cân bằng</span>
        </Tooltip>
      ),
      dataIndex: 'netBalance',
      key: 'netBalance',
      align: 'right',
      render: (v: string) => <CurrencyDisplay amount={v} colorize />,
    },
  ]

  return (
    <Table<MemberBalance>
      rowKey="userId"
      size="small"
      pagination={false}
      columns={columns}
      dataSource={balances}
      scroll={{ x: 'max-content' }}
    />
  )
}
