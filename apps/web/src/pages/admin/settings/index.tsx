import AppLayout from '@/components/layout/AppLayout'
import { profileKeys } from '@/hooks/useProfile'
import { api } from '@/lib/api'
import { fmtDateTime } from '@/utils/date'
import { withAdmin } from '@/utils/withAdmin'
import { Icon } from '@iconify/react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { App, Button, Card, Form, InputNumber, Popconfirm, Spin } from 'antd'
import { useEffect } from 'react'

export const getServerSideProps = withAdmin()

const cardShell =
  'flex h-full min-h-0 flex-col rounded-2xl border border-[--color-border] shadow-sm [&_.ant-card-body]:flex [&_.ant-card-body]:min-h-0 [&_.ant-card-body]:flex-1 [&_.ant-card-body]:flex-col [&_.ant-card-body]:!p-0'

type SettingsDto = {
  idleTimeoutMinutes: number
  updatedAt: string
}

type OrphanCleanupDto = {
  scanned: number
  referenced: number
  deleted: number
  skippedUnsafe: number
  errors: string[]
}

export default function AdminSettingsPage() {
  const { message } = App.useApp()
  const qc = useQueryClient()
  const [form] = Form.useForm<{ idleTimeoutMinutes: number }>()

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'settings'],
    queryFn: () => api.get<{ data: SettingsDto }>('/admin/settings').then((r) => r.data.data),
  })

  useEffect(() => {
    if (data) {
      form.setFieldsValue({ idleTimeoutMinutes: data.idleTimeoutMinutes })
    }
  }, [data, form])

  const cleanupStorage = useMutation({
    mutationFn: () =>
      api
        .post<{ data: OrphanCleanupDto }>('/admin/storage/cleanup-orphans')
        .then((r) => r.data.data),
    onSuccess: (d) => {
      message.success(
        `Đã quét ${d.scanned} file, xóa ${d.deleted} file mồ côi (tham chiếu DB: ${d.referenced}).` +
          (d.errors.length ? ` Lỗi: ${d.errors.length}.` : ''),
      )
    },
    onError: (e: Error) => message.error(e.message),
  })

  const patch = useMutation({
    mutationFn: (idleTimeoutMinutes: number) =>
      api
        .patch<{ data: SettingsDto }>('/admin/settings', { idleTimeoutMinutes })
        .then((r) => r.data.data),
    onSuccess: () => {
      message.success('Đã lưu cài đặt')
      void qc.invalidateQueries({ queryKey: ['admin', 'settings'] })
      void qc.invalidateQueries({ queryKey: profileKeys.me })
    },
    onError: (e: Error) => message.error(e.message),
  })

  return (
    <AppLayout title="Quản trị — Cài đặt hệ thống">
      {isLoading && !data ? (
        <div className="flex min-h-[min(50vh,320px)] items-center justify-center">
          <Spin size="large" />
        </div>
      ) : (
        <div className="grid w-full max-w-6xl grid-cols-1 items-stretch gap-8 lg:grid-cols-2">
          <Card className={cardShell}>
            <div className="flex h-full min-h-[280px] flex-1 flex-col p-6">
              <div className="flex min-h-0 flex-1 items-start gap-4 text-left">
                <div
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand"
                  aria-hidden
                >
                  <Icon icon="mdi:cloud-sync-outline" width={22} height={22} />
                </div>
                <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col">
                  <h2 className="text-lg font-semibold tracking-tight text-wp-charcoal">
                    Lưu trữ (MinIO)
                  </h2>
                  <p className="mt-1 text-sm leading-relaxed text-wp-slate">
                    Gỡ các file ảnh trong kho không còn được hệ thống trỏ tới — ví dụ ảnh đại diện
                    cũ sau khi đổi, ảnh đính kèm đã gỡ khỏi chi tiêu.
                  </p>
                  <div className="mt-3 rounded-lg border border-[--color-border-light] bg-page px-3 py-2 text-sm leading-relaxed text-wp-slate">
                    Chỉ quét và xóa trong thư mục an toàn:{' '}
                    <span className="font-medium text-wp-charcoal">avatars</span>,{' '}
                    <span className="font-medium text-wp-charcoal">groups</span>,{' '}
                    <span className="font-medium text-wp-charcoal">feedback</span>,{' '}
                    <span className="font-medium text-wp-charcoal">bank-qr</span>. Không xóa dữ liệu
                    trong PostgreSQL.
                  </div>
                  <div className="mt-auto border-t border-[--color-border-light] pt-4">
                    <Popconfirm
                      title="Chạy dọn file không dùng trên MinIO?"
                      description="Chỉ gỡ object không còn tham chiếu từ cơ sở dữ liệu."
                      onConfirm={() => cleanupStorage.mutate()}
                      okText="Dọn"
                      cancelText="Hủy"
                    >
                      <Button size="small" loading={cleanupStorage.isPending}>
                        Dọn file không dùng
                      </Button>
                    </Popconfirm>
                  </div>
                </div>
              </div>
            </div>
          </Card>

          <Card className={cardShell}>
            <div className="flex h-full min-h-[280px] flex-1 flex-col p-6">
              <div className="flex min-h-0 flex-1 items-start gap-4 text-left">
                <div
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--color-warning-soft)] text-[var(--color-warning)]"
                  aria-hidden
                >
                  <Icon icon="mdi:timer-sand-complete" width={22} height={22} />
                </div>
                <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col">
                  <h2 className="text-lg font-semibold tracking-tight text-wp-charcoal">
                    Phiên đăng nhập
                  </h2>
                  <p className="mt-1 text-sm leading-relaxed text-wp-slate">
                    Nếu người dùng không thao tác (chuột, phím, cuộn…) trong khoảng thời gian này,
                    hệ thống sẽ tự đăng xuất. Giá trị{' '}
                    <strong className="font-semibold text-wp-charcoal">0</strong> là tắt tính năng.
                  </p>

                  <Form
                    form={form}
                    layout="vertical"
                    className="mt-3 flex min-h-0 flex-1 flex-col"
                    onFinish={(v) => patch.mutate(v.idleTimeoutMinutes)}
                    requiredMark={false}
                  >
                    <div className="min-h-0 flex-1 space-y-3">
                      <Form.Item
                        className="!mb-3"
                        name="idleTimeoutMinutes"
                        label="Thời gian chờ không hoạt động (phút)"
                        rules={[
                          { required: true, message: 'Nhập số phút' },
                          {
                            type: 'number',
                            min: 0,
                            max: 10080,
                            message: 'Từ 0 đến 10080 (7 ngày)',
                          },
                        ]}
                        extra="Ví dụ: 30 = nửa giờ; 120 = 2 giờ. Tối đa 10080 phút (7 ngày)."
                      >
                        <InputNumber
                          className="max-w-[180px]"
                          min={0}
                          max={10080}
                          precision={0}
                          size="small"
                        />
                      </Form.Item>
                      {data?.updatedAt ? (
                        <p className="text-sm text-[var(--color-text-muted)]">
                          Cập nhật lần cuối:{' '}
                          <span className="tabular-nums text-wp-slate">
                            {fmtDateTime(data.updatedAt)}
                          </span>
                        </p>
                      ) : null}
                    </div>
                    <div className="mt-auto border-t border-[--color-border-light] pt-4">
                      <Button
                        type="primary"
                        htmlType="submit"
                        loading={patch.isPending}
                        size="small"
                      >
                        Lưu
                      </Button>
                    </div>
                  </Form>
                </div>
              </div>
            </div>
          </Card>
        </div>
      )}
    </AppLayout>
  )
}
