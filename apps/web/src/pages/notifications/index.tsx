import AppLayout from '@/components/layout/AppLayout'
import { useMarkRead, useNotifications } from '@/hooks/useNotifications'
import { timeAgo } from '@/utils/date'
import { getNotificationTargetPath } from '@/utils/notificationPath'
import { withAuth } from '@/utils/withAuth'
import type { NotificationDto } from '@expense/types'
import { Icon } from '@iconify/react'
import { App, Button, Spin, Typography } from 'antd'
import clsx from 'clsx'
import { useRouter } from 'next/router'

export const getServerSideProps = withAuth()

export default function NotificationsPage() {
  const { message } = App.useApp()
  const router = useRouter()
  const { data, isLoading } = useNotifications({ page: 1, limit: 50 })
  const mark = useMarkRead()

  const onReadAll = async () => {
    try {
      await mark.mutateAsync({ markAll: true })
      message.success('Đã đánh dấu đọc')
    } catch (e) {
      message.error(e instanceof Error ? e.message : 'Lỗi')
    }
  }

  const onItemClick = async (item: NotificationDto) => {
    try {
      await mark.mutateAsync({ id: item.id })
      const path = getNotificationTargetPath(item)
      if (path) void router.push(path)
    } catch {
      /* ignore */
    }
  }

  const items = data?.data ?? []

  return (
    <AppLayout title="Thông báo">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Button onClick={() => void onReadAll()} loading={mark.isPending}>
          Đánh dấu tất cả đã đọc
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Spin size="large" />
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-[var(--color-border)] bg-white py-16 text-center shadow-sm">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-soft text-brand">
            <Icon icon="mdi:bell-outline" width={24} />
          </span>
          <Typography.Text type="secondary">Chưa có thông báo nào</Typography.Text>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              className={clsx(
                'flex w-full cursor-pointer items-start gap-3 rounded-xl border bg-white px-4 py-3 text-left shadow-sm transition',
                'hover:border-[var(--color-border-strong)] hover:shadow-[var(--shadow-md)]',
                item.isRead
                  ? 'border-[var(--color-border)]'
                  : 'border-l-[3px] border-[var(--color-border)] border-l-brand bg-brand-soft',
              )}
              onClick={() => void onItemClick(item)}
            >
              <span
                className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand"
                aria-hidden
              >
                <Icon icon="mdi:bell-outline" width={18} />
              </span>
              <div className="min-w-0 flex-1">
                <Typography.Text
                  strong={!item.isRead}
                  className="block text-[14px] leading-snug text-wp-charcoal"
                >
                  {item.title}
                </Typography.Text>
                {item.body ? (
                  <div className="mt-0.5 text-[13px] leading-snug text-wp-slate">{item.body}</div>
                ) : null}
                <Typography.Text type="secondary" className="mt-1.5 block text-xs">
                  {timeAgo(item.createdAt)}
                </Typography.Text>
              </div>
              {!item.isRead && (
                <span
                  className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-brand"
                  aria-label="Chưa đọc"
                />
              )}
            </button>
          ))}
        </div>
      )}
    </AppLayout>
  )
}
