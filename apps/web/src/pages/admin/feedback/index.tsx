import AppLayout from '@/components/layout/AppLayout'
import { api } from '@/lib/api'
import { fmtDate } from '@/utils/date'
import { withAdmin } from '@/utils/withAdmin'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Button, Col, Form, Image, Input, Rate, Row, Select, Table, Tag, Typography } from 'antd'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

export const getServerSideProps = withAdmin()

type FeedbackStatus = 'NEW' | 'IN_PROGRESS' | 'RESOLVED' | 'ARCHIVED'

type FeedbackRow = {
  id: string
  userId: string
  type: 'PRAISE' | 'ISSUE'
  status: FeedbackStatus
  rating: number | null
  title: string | null
  body: string | null
  imageUrls: string[]
  resolvedImageUrls: string[]
  adminNote: string | null
  createdAt: string
  updatedAt: string
  user: { id: string; name: string; email: string }
}

const statusOptions: { value: FeedbackStatus; label: string }[] = [
  { value: 'NEW', label: 'Mới' },
  { value: 'IN_PROGRESS', label: 'Đang xử lý' },
  { value: 'RESOLVED', label: 'Đã xử lý' },
  { value: 'ARCHIVED', label: 'Lưu trữ' },
]

function feedbackRowStatusClass(status: FeedbackStatus): string {
  const map: Record<FeedbackStatus, string> = {
    NEW: 'admin-feedback-row--new',
    IN_PROGRESS: 'admin-feedback-row--in-progress',
    RESOLVED: 'admin-feedback-row--resolved',
    ARCHIVED: 'admin-feedback-row--archived',
  }
  return map[status] ?? ''
}

function AdminNoteInline({ row }: { row: FeedbackRow }) {
  const qc = useQueryClient()
  const patch = useMutation({
    mutationFn: async (adminNote: string | null) => {
      await api.patch(`/admin/feedback/${row.id}`, { adminNote })
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['admin', 'feedback'] })
    },
  })

  return (
    <Form
      key={`${row.id}-${row.updatedAt}`}
      layout="vertical"
      initialValues={{ adminNote: row.adminNote ?? '' }}
      onFinish={(v) => patch.mutate(v.adminNote.trim() ? v.adminNote.trim() : null)}
      className="mt-2"
    >
      <Form.Item name="adminNote" label="Ghi chú nội bộ (admin)">
        <Input.TextArea rows={2} placeholder="Ghi chú xử lý…" maxLength={2000} />
      </Form.Item>
      <Button type="primary" htmlType="submit" size="small" loading={patch.isPending}>
        Lưu ghi chú
      </Button>
    </Form>
  )
}

export default function AdminFeedbackPage() {
  const qc = useQueryClient()
  const [page, setPage] = useState(1)
  const [typeFilter, setTypeFilter] = useState<'PRAISE' | 'ISSUE' | ''>('')
  const [statusFilter, setStatusFilter] = useState<FeedbackStatus | ''>('')
  const [searchDraft, setSearchDraft] = useState('')
  const [search, setSearch] = useState('')
  const searchAppliedRef = useRef<string | undefined>(undefined)

  useEffect(() => {
    const id = window.setTimeout(() => {
      setSearch(searchDraft)
    }, 320)
    return () => window.clearTimeout(id)
  }, [searchDraft])

  useEffect(() => {
    if (searchAppliedRef.current === search) return
    searchAppliedRef.current = search
    setPage(1)
  }, [search])

  const onFilterChange = useCallback(() => {
    setPage(1)
  }, [])

  const patchStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: FeedbackStatus }) => {
      await api.patch(`/admin/feedback/${id}`, { status })
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['admin', 'feedback'] })
    },
  })

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'feedback', page, typeFilter, statusFilter, search],
    queryFn: () =>
      api
        .get<{
          data: FeedbackRow[]
          total: number
          totalPages: number
          limit: number
        }>('/admin/feedback', {
          params: {
            page,
            limit: 20,
            ...(typeFilter ? { type: typeFilter } : {}),
            ...(statusFilter ? { status: statusFilter } : {}),
            ...(search.trim() ? { search: search.trim() } : {}),
          },
        })
        .then((r) => r.data),
  })

  const columns = useMemo(
    () => [
      {
        title: 'Tiêu đề',
        dataIndex: 'title',
        ellipsis: true,
        render: (t: string | null) => t?.trim() || '—',
      },
      {
        title: 'Loại',
        dataIndex: 'type',
        width: 112,
        render: (t: string) =>
          t === 'PRAISE' ? <Tag color="green">Đánh giá</Tag> : <Tag color="volcano">Vấn đề</Tag>,
      },
      {
        title: 'Sao',
        key: 'rating',
        width: 132,
        align: 'center' as const,
        render: (_: unknown, r: FeedbackRow) =>
          r.type === 'PRAISE' && r.rating != null ? (
            <span className="admin-feedback-rate-cell inline-flex justify-center">
              <Rate disabled allowHalf={false} value={r.rating} style={{ fontSize: 15 }} />
            </span>
          ) : (
            <span className="text-stone-400">—</span>
          ),
      },
      {
        title: 'Người gửi',
        key: 'u',
        width: 200,
        ellipsis: true,
        render: (_: unknown, r: FeedbackRow) => (
          <span className="block min-w-0">
            <span className="block truncate">{r.user.name}</span>
            <span className="block truncate text-xs text-stone-500">{r.user.email}</span>
          </span>
        ),
      },
      {
        title: 'Thời gian',
        dataIndex: 'createdAt',
        width: 168,
        render: (d: string) => fmtDate(d),
      },
      {
        title: 'Trạng thái',
        dataIndex: 'status',
        width: 168,
        render: (s: FeedbackStatus, r: FeedbackRow) => (
          <Select
            size="small"
            value={s}
            loading={patchStatus.isPending && patchStatus.variables?.id === r.id}
            className="min-w-[140px] w-full"
            options={statusOptions}
            onChange={(v) => patchStatus.mutate({ id: r.id, status: v })}
            onClick={(e) => e.stopPropagation()}
          />
        ),
      },
    ],
    [patchStatus],
  )

  return (
    <AppLayout title="Quản trị — Góp ý">
      <Row gutter={[16, 16]} className="mb-6">
        <Col xs={24} md={10} lg={9}>
          <Input
            allowClear
            placeholder="Tìm theo tiêu đề hoặc nội dung…"
            className="w-full"
            value={searchDraft}
            onChange={(e) => setSearchDraft(e.target.value)}
          />
        </Col>
        <Col xs={24} sm={12} md={7} lg={6}>
          <Select<'PRAISE' | 'ISSUE' | undefined>
            allowClear
            placeholder="Tất cả loại"
            className="w-full"
            value={typeFilter || undefined}
            onChange={(v) => {
              setTypeFilter(v ?? '')
              onFilterChange()
            }}
            options={[
              { value: 'PRAISE', label: 'Đánh giá tốt' },
              { value: 'ISSUE', label: 'Báo vấn đề' },
            ]}
          />
        </Col>
        <Col xs={24} sm={12} md={7} lg={6}>
          <Select<FeedbackStatus | undefined>
            allowClear
            placeholder="Tất cả trạng thái"
            className="w-full"
            value={statusFilter || undefined}
            onChange={(v) => {
              setStatusFilter(v ?? '')
              onFilterChange()
            }}
            options={statusOptions}
          />
        </Col>
      </Row>

      <Table<FeedbackRow>
        rowKey="id"
        loading={isLoading}
        className="admin-feedback-table"
        dataSource={data?.data ?? []}
        rowClassName={(r) => `admin-feedback-row ${feedbackRowStatusClass(r.status)}`}
        expandable={{
          expandedRowClassName: () => 'admin-feedback-expanded-row',
          expandedRowRender: (r) => (
            <div className="admin-feedback-detail space-y-3 rounded-lg border border-stone-200 bg-white p-4 text-sm shadow-sm">
              <div>
                <Typography.Text strong>Nội dung: </Typography.Text>
                <Typography.Paragraph className="!mb-0 whitespace-pre-wrap">
                  {r.body?.trim() ? r.body : '—'}
                </Typography.Paragraph>
              </div>
              {r.type === 'ISSUE' && r.resolvedImageUrls.length > 0 ? (
                <div>
                  <Typography.Text strong className="mb-2 block">
                    Ảnh đính kèm
                  </Typography.Text>
                  <Image.PreviewGroup>
                    <div className="flex flex-wrap gap-2">
                      {r.resolvedImageUrls.map((src, i) => (
                        <Image
                          key={i}
                          src={src}
                          alt={`Ảnh đính kèm ${i + 1}`}
                          className="rounded border border-stone-200 object-contain"
                          style={{ maxHeight: 176, maxWidth: 320, objectFit: 'contain' }}
                          preview={{
                            mask: 'Xem',
                          }}
                        />
                      ))}
                    </div>
                  </Image.PreviewGroup>
                </div>
              ) : null}
              <AdminNoteInline row={r} />
            </div>
          ),
        }}
        columns={columns}
        scroll={{ x: 'max-content' }}
        pagination={{
          current: page,
          pageSize: data?.limit ?? 20,
          total: data?.total ?? 0,
          onChange: (p) => setPage(p),
        }}
      />
    </AppLayout>
  )
}
