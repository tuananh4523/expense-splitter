import AppLayout from '@/components/layout/AppLayout'
import { useAdminDeleteGroupActivityLogs, useGroup, useGroupActivityLogs } from '@/hooks/useGroup'
import { fmtDate } from '@/utils/date'
import { groupActivityActionVi, groupActivityTargetTypeVi } from '@/utils/activityLabels'
import { withAuth } from '@/utils/withAuth'
import type { GroupActivityLogDto } from '@expense/types'
import {
  App,
  Button,
  Card,
  Checkbox,
  DatePicker,
  Input,
  Popconfirm,
  Select,
  Space,
  Table,
  Typography,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/router'
import { useMemo, useState } from 'react'

export const getServerSideProps = withAuth()

const TARGET_TYPES = [
  { value: 'EXPENSE', label: 'Chi tiêu' },
  { value: 'MEMBER', label: 'Thành viên' },
  { value: 'SETTLEMENT', label: 'Tổng kết' },
  { value: 'FUND', label: 'Quỹ' },
  { value: 'GROUP', label: 'Nhóm / mời' },
]

export default function GroupActivityPage() {
  const { message } = App.useApp()
  const router = useRouter()
  const { data: session } = useSession()
  const groupId = typeof router.query.groupId === 'string' ? router.query.groupId : ''
  const { data: group } = useGroup(groupId)

  const [page, setPage] = useState(1)
  const [q, setQ] = useState('')
  const [action, setAction] = useState('')
  const [targetType, setTargetType] = useState('')
  const [hideStandalone, setHideStandalone] = useState(false)
  const [range, setRange] = useState<[dayjs.Dayjs | null, dayjs.Dayjs | null] | null>(null)

  const filters = useMemo(
    () => ({
      page,
      limit: 25,
      ...(q.trim() ? { q: q.trim() } : {}),
      ...(action.trim() ? { action: action.trim() } : {}),
      ...(targetType ? { targetType } : {}),
      ...(hideStandalone ? { hideStandaloneExpenses: true as const } : {}),
      ...(range?.[0] ? { dateFrom: range[0].startOf('day').toISOString() } : {}),
      ...(range?.[1] ? { dateTo: range[1].endOf('day').toISOString() } : {}),
    }),
    [page, q, action, targetType, hideStandalone, range],
  )

  const { data: logPage, isLoading } = useGroupActivityLogs(groupId, filters)
  const clearLogs = useAdminDeleteGroupActivityLogs()
  const isAdmin = session?.user?.role === 'ADMIN'

  const columns: ColumnsType<GroupActivityLogDto> = [
    {
      title: 'Thời điểm',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 118,
      render: (d: string) => <span className="whitespace-nowrap text-xs">{fmtDate(d)}</span>,
    },
    {
      title: 'Người thực hiện',
      key: 'actor',
      width: 200,
      render: (_, r) => (
        <div>
          <div className="font-medium text-stone-900">{r.actorName}</div>
          <div className="text-xs text-stone-500">{r.actorEmail || '—'}</div>
        </div>
      ),
    },
    {
      title: 'Mô tả',
      key: 'summary',
      render: (_, r) => (
        <div>
          <div className="text-stone-800">{r.summary}</div>
          <div className="mt-0.5 text-xs text-stone-500">
            {[groupActivityActionVi(r.action), r.targetType ? groupActivityTargetTypeVi(r.targetType) : '']
              .filter(Boolean)
              .join(' · ')}
          </div>
        </div>
      ),
    },
  ]

  if (!groupId) return null

  return (
    <AppLayout title={group ? `Lịch sử — ${group.name}` : 'Lịch sử nhóm'}>
      <Space direction="vertical" size="large" className="w-full">
        <Typography.Paragraph type="secondary" className="!mb-0">
          Nhật ký hoạt động lưu sẵn tên và email người thực hiện — xóa thành viên hoặc chi tiêu không làm mất dòng
          lịch sử. Có thể lọc theo thời gian, từ khóa, loại đích và ẩn log liên quan chi riêng.
        </Typography.Paragraph>

        <Card>
          <Space wrap className="w-full" size="middle">
            <Input
              allowClear
              placeholder="Tìm trong mô tả…"
              value={q}
              onChange={(e) => {
                setPage(1)
                setQ(e.target.value)
              }}
              style={{ minWidth: 200 }}
            />
            <Input
              allowClear
              placeholder="Mã hành động (vd. EXPENSE_CREATED)"
              value={action}
              onChange={(e) => {
                setPage(1)
                setAction(e.target.value)
              }}
              style={{ minWidth: 220 }}
            />
            <Select
              placeholder="Loại đích (tùy chọn)"
              value={targetType || undefined}
              allowClear
              style={{ minWidth: 180 }}
              options={TARGET_TYPES}
              onChange={(v) => {
                setPage(1)
                setTargetType(typeof v === 'string' ? v : '')
              }}
            />
            <DatePicker.RangePicker
              value={range}
              onChange={(v) => {
                setPage(1)
                setRange(v as [dayjs.Dayjs | null, dayjs.Dayjs | null] | null)
              }}
            />
            <Checkbox
              checked={hideStandalone}
              onChange={(e) => {
                setPage(1)
                setHideStandalone(e.target.checked)
              }}
            >
              Ẩn log chi riêng
            </Checkbox>
            <Button
              type="link"
              onClick={() => {
                setPage(1)
                setQ('')
                setAction('')
                setTargetType('')
                setHideStandalone(false)
                setRange(null)
              }}
            >
              Xóa bộ lọc
            </Button>
          </Space>
        </Card>

        {isAdmin ? (
          <Card size="small" className="border-amber-200 bg-amber-50/60">
            <Space wrap>
              <Typography.Text className="text-amber-950">
                Quản trị hệ thống: xóa log để giảm dữ liệu (không ảnh hưởng chi tiêu hay thành viên).
              </Typography.Text>
              <Popconfirm
                title="Xóa toàn bộ lịch sử của nhóm này?"
                okText="Xóa"
                cancelText="Huỷ"
                okButtonProps={{ danger: true, loading: clearLogs.isPending }}
                onConfirm={() =>
                  void clearLogs
                    .mutateAsync({ groupId })
                    .then((d) => message.success(`Đã xóa ${d.deleted} bản ghi`))
                    .catch((e) => message.error(e instanceof Error ? e.message : 'Lỗi'))
                }
              >
                <Button danger size="small" loading={clearLogs.isPending}>
                  Xóa toàn bộ lịch sử nhóm
                </Button>
              </Popconfirm>
            </Space>
          </Card>
        ) : null}

        <Table<GroupActivityLogDto>
          rowKey="id"
          size="small"
          loading={isLoading}
          columns={columns}
          dataSource={logPage?.data ?? []}
          pagination={{
            current: page,
            total: logPage?.total ?? 0,
            pageSize: logPage?.limit ?? 25,
            showSizeChanger: false,
            onChange: (p) => setPage(p),
          }}
          scroll={{ x: true }}
          className="w-full"
        />
      </Space>
    </AppLayout>
  )
}
