import AppLayout from '@/components/layout/AppLayout'
import { CurrencyDisplay } from '@/components/shared/CurrencyDisplay'
import { api } from '@/lib/api'
import { withAdmin } from '@/utils/withAdmin'
import { Icon } from '@iconify/react'
import { App, Button, Input, Popconfirm, Space, Table, Tag, Tooltip } from 'antd'
import { useRouter } from 'next/router'
import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

export const getServerSideProps = withAdmin()

type AdminGroupRow = {
  id: string
  name: string
  isActive: boolean
  createdAt: string
  memberCount: number
  expenseCount: number
  fundBalance: string | null
}

type GroupCleanupDto = {
  commentsDeleted: number
  auditLogsDeleted: number
  groupActivityLogsDeleted: number
  fundTransactionsDeleted: number
  settlementsDeleted: number
  expensesDeleted: number
  paymentRecordsDeleted: number
  notificationsDeleted: number
}

export default function AdminGroupsPage() {
  const { message } = App.useApp()
  const router = useRouter()
  const qc = useQueryClient()
  const [search, setSearch] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'groups'],
    queryFn: () => api.get<{ data: AdminGroupRow[] }>('/admin/groups').then((r) => r.data.data),
  })

  const filteredRows = useMemo(() => {
    const rows = data ?? []
    const q = search.trim().toLowerCase()
    if (!q) return rows
    return rows.filter((r) => r.name.toLowerCase().includes(q))
  }, [data, search])

  const patchGroup = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      await api.patch(`/admin/groups/${id}`, { isActive })
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['admin', 'groups'] })
      message.success('Đã cập nhật')
    },
    onError: (e: Error) => message.error(e.message),
  })

  const cleanupGroupData = useMutation({
    mutationFn: async (id: string) => {
      const r = await api.post<{ data: GroupCleanupDto }>(`/admin/groups/${id}/cleanup-data`)
      return r.data.data
    },
    onSuccess: (d) => {
      void qc.invalidateQueries({ queryKey: ['admin', 'groups'] })
      message.success(
        `Đã dọn: ${d.commentsDeleted} bình luận, ${d.auditLogsDeleted} audit, ${d.groupActivityLogsDeleted} log hoạt động, ${d.fundTransactionsDeleted} giao dịch quỹ, ${d.settlementsDeleted} tổng kết hoàn thành, ${d.expensesDeleted} chi tiêu (đợt đó).`,
      )
    },
    onError: (e: Error) => message.error(e.message),
  })

  const deleteGroup = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/admin/groups/${id}`)
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['admin', 'groups'] })
      message.success('Đã xóa nhóm')
    },
    onError: (e: Error) => message.error(e.message),
  })

  return (
    <AppLayout title="Quản trị — Nhóm">
      <div className="mb-6">
        <Input.Search
          allowClear
          placeholder="Tìm theo tên nhóm…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full sm:!w-[260px]"
        />
      </div>
      <Table<AdminGroupRow>
        rowKey="id"
        loading={isLoading}
        dataSource={filteredRows}
        scroll={{ x: 'max-content' }}
        columns={[
          {
            title: 'Tên',
            dataIndex: 'name',
            align: 'left',
          },
          { title: 'Thành viên', dataIndex: 'memberCount', align: 'right' },
          { title: 'Chi tiêu', dataIndex: 'expenseCount', align: 'right' },
          {
            title: 'Quỹ',
            dataIndex: 'fundBalance',
            align: 'right',
            render: (v: string | null) =>
              v == null || v === '' ? '—' : <CurrencyDisplay amount={v} className="tabular-nums" />,
          },
          {
            title: 'Trạng thái',
            dataIndex: 'isActive',
            align: 'left',
            render: (a: boolean) => (a ? <Tag color="green">Hoạt động</Tag> : <Tag color="default">Tắt</Tag>),
          },
          {
            title: '',
            key: 'a',
            align: 'right',
            width: 150,
            render: (_: unknown, g) => (
              <Space size={4}>
                <Tooltip title="Xem nhóm">
                  <Button
                    type="text"
                    size="small"
                    icon={<Icon icon="mdi:arrow-right-circle-outline" width={16} />}
                    onClick={() => void router.push(`/groups/${g.id}`)}
                  />
                </Tooltip>
                <Popconfirm
                  title={
                    g.isActive
                      ? 'Tắt nhóm? Mọi thành viên (kể cả trưởng nhóm) sẽ không dùng được app cho nhóm này cho đến khi bật lại.'
                      : 'Bật lại nhóm?'
                  }
                  onConfirm={() => patchGroup.mutate({ id: g.id, isActive: !g.isActive })}
                >
                  <Tooltip title={g.isActive ? 'Tắt nhóm' : 'Bật nhóm'}>
                    <Button
                      type="text"
                      size="small"
                      icon={
                        g.isActive
                          ? <Icon icon="mdi:toggle-switch-off-outline" width={16} />
                          : <Icon icon="mdi:toggle-switch-outline" width={16} />
                      }
                    />
                  </Tooltip>
                </Popconfirm>
                <Popconfirm
                  title="Làm sạch dữ liệu nhóm?"
                  description="Giữ tên, ảnh, mô tả, thành viên. Xóa bình luận, lịch sử (audit + log hoạt động), toàn bộ giao dịch quỹ (số dư về 0), và các đợt tổng kết đã hoàn thành kèm chi tiêu thuộc đợt."
                  okText="Dọn"
                  cancelText="Hủy"
                  onConfirm={() => cleanupGroupData.mutate(g.id)}
                >
                  <Tooltip title="Làm sạch dữ liệu (giữ nhóm)">
                    <Button
                      type="text"
                      size="small"
                      loading={cleanupGroupData.isPending}
                      icon={<Icon icon="mdi:broom" width={16} />}
                    />
                  </Tooltip>
                </Popconfirm>
                <Popconfirm
                  title="Xóa vĩnh viễn nhóm và toàn bộ dữ liệu (chi tiêu, tổng kết, quỹ, thành viên…)?"
                  onConfirm={() => deleteGroup.mutate(g.id)}
                >
                  <Tooltip title="Xóa nhóm">
                    <Button type="text" size="small" danger icon={<Icon icon="mdi:trash-can-outline" width={16} />} />
                  </Tooltip>
                </Popconfirm>
              </Space>
            ),
          },
        ]}
      />
    </AppLayout>
  )
}
