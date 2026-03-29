import AppLayout from '@/components/layout/AppLayout'
import { type SessionRow, useRevokeSession, useSessions } from '@/hooks/useSessions'
import { fmtDateTime } from '@/utils/date'
import { withAuth } from '@/utils/withAuth'
import { App, Button, Popconfirm, Table, Tag, Typography } from 'antd'
import { useSession } from 'next-auth/react'
import type { ColumnsType } from 'antd/es/table'
import type { MessageInstance } from 'antd/es/message/interface'
import type { UseMutationResult } from '@tanstack/react-query'

export const getServerSideProps = withAuth()

function RevokeSessionButton({
  row,
  revoke,
  message,
  variant,
}: {
  row: SessionRow
  revoke: UseMutationResult<
    { ok: boolean; wasCurrent: boolean },
    Error,
    string,
    unknown
  >
  message: MessageInstance
  variant: 'table' | 'mobile'
}) {
  const btn =
    variant === 'mobile' ? (
      <Button danger block size="large" loading={revoke.isPending} className="!min-h-11 !py-2.5">
        Đăng xuất phiên này
      </Button>
    ) : (
      <Button type="link" danger size="small" loading={revoke.isPending}>
        Đăng xuất
      </Button>
    )
  return (
    <Popconfirm
      title={row.isCurrent ? 'Đăng xuất khỏi thiết bị này?' : 'Đăng xuất phiên này?'}
      description={
        row.isCurrent
          ? 'Bạn sẽ cần đăng nhập lại trên trình duyệt này.'
          : 'Thiết bị đó sẽ bị ngắt phiên ngay.'
      }
      okText="Đăng xuất"
      cancelText="Hủy"
      okButtonProps={{ danger: true }}
      placement={variant === 'mobile' ? 'top' : 'topRight'}
      onConfirm={() =>
        void revoke.mutateAsync(row.id).then((d) => {
          if (!d.wasCurrent) message.success('Đã đăng xuất phiên')
        })
      }
    >
      {btn}
    </Popconfirm>
  )
}

export default function ProfileSessionsPage() {
  const { message } = App.useApp()
  const { status } = useSession()
  const { data: rows = [], isLoading } = useSessions(status === 'authenticated')
  const revoke = useRevokeSession()

  const columns: ColumnsType<SessionRow> = [
    {
      title: 'Thiết bị / trình duyệt',
      key: 'device',
      render: (_: unknown, r) => (
        <div>
          <div className="font-medium text-stone-900">{r.deviceLabel ?? 'Không xác định'}</div>
          {r.userAgent ? (
            <Typography.Text type="secondary" className="text-xs" ellipsis={{ tooltip: r.userAgent }}>
              {r.userAgent}
            </Typography.Text>
          ) : null}
        </div>
      ),
    },
    {
      title: 'IP (lúc đăng nhập)',
      dataIndex: 'ipAddress',
      width: 148,
      render: (ip: string | null) => ip?.trim() || '—',
    },
    {
      title: 'Đăng nhập lúc',
      dataIndex: 'createdAt',
      width: 168,
      render: (d: string) => fmtDateTime(d),
    },
    {
      title: '',
      key: 'badge',
      width: 100,
      render: (_: unknown, r) =>
        r.isCurrent ? <Tag color="blue">Phiên này</Tag> : <span className="text-stone-400">—</span>,
    },
    {
      title: '',
      key: 'act',
      width: 120,
      align: 'right',
      render: (_: unknown, r) => (
        <RevokeSessionButton row={r} revoke={revoke} message={message} variant="table" />
      ),
    },
  ]

  return (
    <AppLayout title="Phiên đăng nhập">
      <Typography.Paragraph
        type="secondary"
        className="mb-4 max-w-2xl text-pretty text-sm leading-relaxed md:text-base"
      >
        Mỗi lần đăng nhập tạo một phiên và lưu địa chỉ IP cùng chuỗi User-Agent (trình duyệt / thiết bị) lúc đó.
        Bạn có thể đăng xuất từ xa các phiên khác. Đổi mật khẩu sẽ đăng xuất mọi phiên trừ phiên hiện tại.
      </Typography.Paragraph>

      {/* Dùng breakpoint CSS (md = 768px) thay vì useBreakpoint — tránh nhầm layout lúc render đầu */}
      <div className="flex flex-col gap-4 pb-[max(0px,env(safe-area-inset-bottom))] md:hidden">
        {isLoading ? (
          <div className="rounded-xl border border-stone-200 bg-stone-50/80 px-4 py-8 text-center text-stone-500">
            Đang tải…
          </div>
        ) : rows.length === 0 ? (
          <div className="rounded-xl border border-dashed border-stone-200 bg-stone-50/50 px-4 py-10 text-center text-stone-500">
            Chưa có phiên nào
          </div>
        ) : (
          rows.map((r) => (
            <article
              key={r.id}
              className="min-w-0 overflow-hidden rounded-xl border border-stone-200 bg-white p-3 shadow-sm xs:p-4"
            >
              <div className="mb-3 min-w-0">
                <div className="flex flex-wrap items-start gap-2 gap-y-1">
                  <span className="min-w-0 flex-1 break-words text-base font-semibold text-stone-900">
                    {r.deviceLabel ?? 'Không xác định'}
                  </span>
                  {r.isCurrent ? (
                    <Tag color="blue" className="m-0 shrink-0">
                      Phiên này
                    </Tag>
                  ) : null}
                </div>
                {r.userAgent ? (
                  <details className="mt-3 rounded-lg border border-stone-100 bg-stone-50/90 text-left">
                    <summary className="cursor-pointer select-none px-3 py-2.5 text-xs font-semibold text-stone-600 outline-none ring-stone-400 ring-offset-2 focus-visible:ring-2 [&::-webkit-details-marker]:hidden">
                      Chuỗi trình duyệt (User-Agent)
                    </summary>
                    <p className="mb-0 border-t border-stone-100/80 px-3 py-2.5 font-mono text-[11px] leading-relaxed break-all text-stone-600">
                      {r.userAgent}
                    </p>
                  </details>
                ) : null}
              </div>
              <div className="mb-4 space-y-3 border-t border-stone-100 pt-3 text-sm">
                <div className="min-w-0">
                  <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-stone-400">
                    IP lúc đăng nhập
                  </p>
                  <p className="mb-0 break-all text-stone-800">{r.ipAddress?.trim() || '—'}</p>
                </div>
                <div>
                  <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-stone-400">
                    Đăng nhập lúc
                  </p>
                  <p className="mb-0 text-stone-800">{fmtDateTime(r.createdAt)}</p>
                </div>
              </div>
              <RevokeSessionButton row={r} revoke={revoke} message={message} variant="mobile" />
            </article>
          ))
        )}
      </div>

      <div className="hidden overflow-x-auto md:block">
        <Table<SessionRow>
          rowKey="id"
          loading={isLoading}
          columns={columns}
          dataSource={rows}
          pagination={false}
          scroll={{ x: 720 }}
          locale={{ emptyText: 'Chưa có phiên nào' }}
        />
      </div>
    </AppLayout>
  )
}
