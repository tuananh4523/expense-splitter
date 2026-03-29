import AppLayout from '@/components/layout/AppLayout'
import { api } from '@/lib/api'
import { withAdmin } from '@/utils/withAdmin'
import { fmtDateTime } from '@/utils/date'
import type { AdminBroadcastHistoryItemDto, AdminBroadcastRecipientDto } from '@expense/types'
import { Icon } from '@iconify/react'
import { App, Button, Empty, Form, Input, Modal, Popconfirm, Select, Space, Spin, Table, Tooltip, Typography } from 'antd'
import { useMe } from '@/hooks/useProfile'
import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

export const getServerSideProps = withAdmin()

type AdminUserOption = { label: string; value: string }

function BroadcastRecipientsPanel({ broadcastId }: { broadcastId: string }) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['admin', 'broadcasts', broadcastId, 'recipients'],
    queryFn: () =>
      api
        .get<{
          data: AdminBroadcastRecipientDto[]
          total: number
          truncated: boolean
        }>(`/admin/broadcasts/${encodeURIComponent(broadcastId)}/recipients`)
        .then((r) => r.data),
  })

  if (isLoading) {
    return (
      <div className="py-8 text-center">
        <Spin />
      </div>
    )
  }
  if (isError || !data) {
    return <Typography.Text type="danger">Không tải được danh sách người nhận.</Typography.Text>
  }

  const items = data.data
  if (items.length === 0) {
    return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Không có bản ghi" />
  }

  return (
    <div className="rounded-xl border border-[var(--color-border-light)] bg-[var(--color-bg-page,#f7f7f8)] px-4 py-3">
      <Typography.Text strong className="mb-3 block text-[15px] text-wp-charcoal">
        Đã gửi tới {data.total} người
        {data.truncated ? (
          <span className="font-normal text-wp-slate"> — hiển thị tối đa 5000 tên (sắp xếp theo tên).</span>
        ) : null}
      </Typography.Text>
      <ul className="m-0 max-h-80 list-none space-y-0 overflow-y-auto overscroll-contain p-0 text-sm">
        {items.map((r) => (
          <li
            key={r.userId}
            className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b border-[var(--color-border-light)] py-2.5 last:border-0"
          >
            <span className="min-w-0 shrink font-medium text-wp-charcoal">{r.name}</span>
            <span className="min-w-0 break-all text-wp-slate">{r.email}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

export default function AdminBroadcastPage() {
  const { message } = App.useApp()
  const qc = useQueryClient()
  const { data: me } = useMe()
  const [form] = Form.useForm<{ title: string; body: string; excludeUserIds: string[] }>()
  const [createOpen, setCreateOpen] = useState(false)
  const [search, setSearch] = useState('')

  const { data: broadcastRows = [], isLoading: broadcastsLoading } = useQuery({
    queryKey: ['admin', 'broadcasts'],
    queryFn: () =>
      api.get<{ data: AdminBroadcastHistoryItemDto[] }>('/admin/broadcasts').then((r) => r.data.data),
  })

  const { data: userOptions = [], isLoading: usersLoading } = useQuery({
    queryKey: ['admin', 'users', 'broadcast-options'],
    queryFn: () =>
      api
        .get<{
          data: { id: string; name: string; email: string; isActive: boolean }[]
        }>('/admin/users', { params: { page: 1, limit: 500, isActive: 'true' } })
        .then((r) =>
          r.data.data
            .filter((u) => u.isActive)
            .map((u) => ({
              label: `${u.name} (${u.email})`,
              value: u.id,
            })),
        ),
  })

  const options = useMemo(() => userOptions as AdminUserOption[], [userOptions])

  const [excludedPreview, setExcludedPreview] = useState<string[]>([])

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return broadcastRows
    return broadcastRows.filter(
      (r) => r.title.toLowerCase().includes(q) || r.body.toLowerCase().includes(q),
    )
  }, [broadcastRows, search])

  const send = useMutation({
    mutationFn: (payload: { title: string; body: string; excludeUserIds: string[] }) =>
      api
        .post<{ data: { broadcastId: string; sent: number } }>('/admin/broadcast', payload, { timeout: 120_000 })
        .then((r) => r.data.data),
    onSuccess: (d) => {
      message.success(`Đã gửi tới ${d.sent} tài khoản.`)
      form.resetFields()
      setExcludedPreview([])
      setCreateOpen(false)
      void qc.invalidateQueries({ queryKey: ['admin', 'broadcasts'] })
    },
    onError: (e: Error) => message.error(e.message),
  })

  const removeBroadcast = useMutation({
    mutationFn: (broadcastId: string) =>
      api.delete<{ data: { deleted: number } }>(`/admin/broadcasts/${broadcastId}`).then((r) => r.data.data),
    onSuccess: (d) => {
      message.success(`Đã xóa ${d.deleted} thông báo.`)
      void qc.invalidateQueries({ queryKey: ['admin', 'broadcasts'] })
    },
    onError: (e: Error) => message.error(e.message),
  })

  const submitBroadcast = async () => {
    try {
      const v = await form.validateFields()
      await send.mutateAsync({
        title: v.title.trim(),
        body: v.body.trim(),
        excludeUserIds: v.excludeUserIds ?? [],
      })
    } catch {
      /* validate hoặc API */
    }
  }

  const selfId = me?.id ? [me.id] : []

  const openCreateModal = () => {
    form.resetFields()
    form.setFieldsValue({ title: '', body: '', excludeUserIds: selfId })
    setExcludedPreview(selfId)
    setCreateOpen(true)
  }

  const openResendModal = (row: AdminBroadcastHistoryItemDto) => {
    form.setFieldsValue({
      title: row.title,
      body: row.body,
      excludeUserIds: selfId,
    })
    setExcludedPreview([])
    setCreateOpen(true)
  }

  const columns = [
    {
      title: 'Thời gian gửi',
      dataIndex: 'sentAt',
      key: 'sentAt',
      width: 160,
      render: (d: string) => (
        <span className="whitespace-nowrap tabular-nums text-[13px] text-wp-slate">{fmtDateTime(d)}</span>
      ),
    },
    {
      title: 'Tiêu đề',
      dataIndex: 'title',
      key: 'title',
      width: 240,
      ellipsis: { showTitle: false },
      render: (text: string) => (
        <Tooltip placement="topLeft" title={text}>
          <span className="block max-w-full font-medium text-wp-charcoal">{text}</span>
        </Tooltip>
      ),
    },
    {
      title: 'Nội dung',
      dataIndex: 'body',
      key: 'body',
      ellipsis: { showTitle: false },
      render: (text: string) => (
        <Tooltip placement="topLeft" title={text}>
          <span className="block max-w-full text-[13px] text-wp-slate">{text}</span>
        </Tooltip>
      ),
    },
    {
      title: 'Người nhận',
      dataIndex: 'recipientCount',
      key: 'recipientCount',
      width: 140,
      align: 'right' as const,
      render: (n: number) => <span className="tabular-nums text-[13px]">{n.toLocaleString('vi')}</span>,
    },
    {
      title: 'Thao tác',
      key: 'actions',
      width: 120,
      align: 'center' as const,
      render: (_: unknown, row: AdminBroadcastHistoryItemDto) => (
        <Space size={0}>
          <Tooltip title="Gửi lại (mở form với tiêu đề & nội dung tương tự)">
            <Button
              type="text"
              size="small"
              className="text-brand"
              icon={<Icon icon="mdi:bell-outline" width={16} />}
              aria-label="Gửi lại"
              onClick={() => openResendModal(row)}
            />
          </Tooltip>
          <Popconfirm
            title="Xóa đợt thông báo này?"
            description="Toàn bộ bản ghi trong hộp thư người dùng sẽ bị gỡ."
            okText="Xóa"
            cancelText="Hủy"
            okButtonProps={{
              loading: removeBroadcast.isPending && removeBroadcast.variables === row.broadcastId,
            }}
            onConfirm={() => removeBroadcast.mutate(row.broadcastId)}
          >
            <Button
              type="text"
              size="small"
              danger
              icon={<Icon icon="mdi:trash-can-outline" width={16} />}
              aria-label="Xóa"
            />
          </Popconfirm>
        </Space>
      ),
    },
  ]

  return (
    <AppLayout title="Quản trị — Thông báo hệ thống">
      <div className="mb-6 flex justify-end">
        <Button type="primary" icon={<Icon icon="mdi:bullhorn-outline" width={18} />} onClick={openCreateModal}>
          Tạo thông báo
        </Button>
      </div>

      {/* <Typography.Paragraph type="secondary" className="!mb-4 !mt-0 text-sm">
        Lịch sử các đợt đã gửi. Mặc định mỗi lần gửi tới <strong>mọi tài khoản đang hoạt động</strong> (trừ người
        được chọn trong phần loại trừ).{' '}
        <strong className="text-wp-charcoal">Mở rộng dòng (biểu tượng danh sách)</strong> để xem đã gửi tới những ai.
        Người nhận thấy thông báo trong hộp thư; nếu đang mở app có thể nhận ngay qua kết nối realtime.
      </Typography.Paragraph> */}

      <Space wrap className="mb-6">
        <Input.Search
          placeholder="Lọc theo tiêu đề / nội dung"
          allowClear
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full sm:!w-[300px]"
        />
      </Space>

      <Table<AdminBroadcastHistoryItemDto>
          rowKey="broadcastId"
          loading={broadcastsLoading}
          scroll={{ x: 'max-content' }}
          columns={columns}
          dataSource={filteredRows}
          pagination={false}
          className="[&_.ant-table-thead>tr>th]:text-[13px]"
          expandable={{
            expandedRowRender: (record) => <BroadcastRecipientsPanel broadcastId={record.broadcastId} />,
            expandIcon: ({ expanded, onExpand, record }) => (
              <Tooltip title={expanded ? 'Thu gọn' : 'Bấm để xem gửi tới những ai'}>
                <button
                  type="button"
                  className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-(--color-text-muted) transition hover:bg-brand-soft hover:text-brand"
                  aria-expanded={expanded}
                  aria-label={expanded ? 'Thu gọn' : 'Xem danh sách người nhận'}
                  onClick={(e) => onExpand(record, e)}
                >
                  <Icon
                    icon={expanded ? 'mdi:chevron-up' : 'mdi:chevron-down'}
                    width={18}
                    className="text-current"
                  />
                </button>
              </Tooltip>
            ),
          }}
        />

      <Modal
        title="Gửi thông báo hệ thống"
        open={createOpen}
        width={560}
        onCancel={() => {
          setCreateOpen(false)
          form.resetFields()
          setExcludedPreview([])
        }}
        destroyOnClose
        okText="Gửi thông báo"
        cancelText="Hủy"
        confirmLoading={send.isPending}
        onOk={() => void submitBroadcast()}
      >
        <Form
          form={form}
          layout="vertical"
          initialValues={{ title: '', body: '', excludeUserIds: [] }}
          onValuesChange={(_, all) => setExcludedPreview(all.excludeUserIds ?? [])}
          requiredMark={false}
          className="pt-1"
        >
          <Form.Item
            name="title"
            label="Tiêu đề"
            rules={[
              { required: true, message: 'Nhập tiêu đề' },
              { max: 200, message: 'Tối đa 200 ký tự' },
            ]}
          >
            <Input placeholder="Ví dụ: Bảo trì hệ thống tối nay" maxLength={200} showCount />
          </Form.Item>
          <Form.Item name="body" label="Nội dung" rules={[{ required: true, message: 'Nhập nội dung' }]}>
            <Input.TextArea rows={6} placeholder="Nội dung hiển thị trong thông báo…" maxLength={10000} showCount />
          </Form.Item>
          <Form.Item
            name="excludeUserIds"
            label="Loại trừ (không gửi tới)"
            extra={
              excludedPreview.length === 0
                ? 'Không chọn = gửi cho mọi người.'
                : `Đang loại trừ ${excludedPreview.length} tài khoản.`
            }
          >
            <Select
              mode="multiple"
              allowClear
              showSearch
              optionFilterProp="label"
              loading={usersLoading}
              placeholder="Chọn người không nhận thông báo này…"
              options={options}
              className="w-full"
            />
          </Form.Item>
        </Form>
      </Modal>
    </AppLayout>
  )
}
