import AppLayout from '@/components/layout/AppLayout'
import { api } from '@/lib/api'
import { fmtDate } from '@/utils/date'
import { withAdmin } from '@/utils/withAdmin'
import { useQuery } from '@tanstack/react-query'
import { Table, Typography } from 'antd'
import { useState } from 'react'

export const getServerSideProps = withAdmin()

type AuditRow = {
  id: string
  userId: string
  groupId: string | null
  expenseId: string | null
  action: string
  before: unknown
  after: unknown
  ipAddress: string | null
  createdAt: string
  user: { id: string; name: string; email: string }
  group: { id: string; name: string } | null
}

export default function AdminAuditPage() {
  const [page, setPage] = useState(1)

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'audit', page],
    queryFn: () =>
      api
        .get<{ data: AuditRow[]; total: number; totalPages: number }>('/admin/audit', {
          params: { page, limit: 25 },
        })
        .then((r) => r.data),
  })

  return (
    <AppLayout title="Quản trị — Audit">
      <Table<AuditRow>
        rowKey="id"
        loading={isLoading}
        dataSource={data?.data ?? []}
        expandable={{
          expandedRowRender: (r) => (
            <div className="max-w-3xl space-y-2 text-sm">
              <div>
                <Typography.Text strong>Before: </Typography.Text>
                <pre className="mt-1 overflow-x-auto rounded bg-stone-100 p-2 text-xs">
                  {JSON.stringify(r.before, null, 2)}
                </pre>
              </div>
              <div>
                <Typography.Text strong>After: </Typography.Text>
                <pre className="mt-1 overflow-x-auto rounded bg-stone-100 p-2 text-xs">
                  {JSON.stringify(r.after, null, 2)}
                </pre>
              </div>
            </div>
          ),
        }}
        columns={[
          {
            title: 'Thời gian',
            dataIndex: 'createdAt',
            width: 180,
            render: (d: string) => fmtDate(d),
          },
          { title: 'Người dùng', key: 'u', render: (_: unknown, r) => r.user.name },
          { title: 'Hành động', dataIndex: 'action' },
          { title: 'Nhóm', key: 'g', render: (_: unknown, r) => r.group?.name ?? '—' },
        ]}
        scroll={{ x: 'max-content' }}
        pagination={{
          current: page,
          pageSize: 25,
          total: data?.total ?? 0,
          onChange: (p) => setPage(p),
        }}
      />
    </AppLayout>
  )
}
