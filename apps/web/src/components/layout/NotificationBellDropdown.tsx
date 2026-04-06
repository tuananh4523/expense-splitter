import { useMarkRead, useNotifications } from '@/hooks/useNotifications'
import { timeAgo } from '@/utils/date'
import { getNotificationTargetPath } from '@/utils/notificationPath'
import { BellOutlined } from '@ant-design/icons'
import type { NotificationDto } from '@expense/types'
import { Icon } from '@iconify/react'
import { Badge, Dropdown, Spin, Typography } from 'antd'
import clsx from 'clsx'
import { useRouter } from 'next/router'
import { type ReactNode, useState } from 'react'

const PANEL_WIDTH = 360
const LIST_MAX_H = 320

export function NotificationBellDropdown({
  badgeCount,
  trigger,
}: {
  badgeCount: number
  /** Nút/spans tùy chỉnh (vd. Header dùng BellOutlined). Mặc định: nút chuông AppLayout. */
  trigger?: ReactNode
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const { data, isLoading } = useNotifications({ page: 1, limit: 10 }, { enabled: open })
  const mark = useMarkRead()

  const items = data?.data ?? []

  const onRowActivate = async (item: NotificationDto) => {
    const path = getNotificationTargetPath(item)
    try {
      await mark.mutateAsync({ id: item.id })
      setOpen(false)
      if (path) void router.push(path)
    } catch {
      /* ignore */
    }
  }

  const defaultTrigger = (
    <button
      type="button"
      className="app-header-bell-btn"
      aria-label="Thông báo"
      aria-haspopup="menu"
    >
      <Icon icon="mdi:bell-outline" width={20} />
    </button>
  )

  const panel = (
    <div
      className="rounded-lg border border-[var(--color-border-light)] bg-white py-2 shadow-[var(--shadow-md)]"
      style={{ width: PANEL_WIDTH, maxWidth: 'min(100vw - 24px, 360px)' }}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="border-b border-[var(--color-border-light)] px-3 pb-2">
        <Typography.Text strong className="text-wp-charcoal text-[15px]">
          Thông báo gần đây
        </Typography.Text>
      </div>

      <div className="overflow-y-auto px-3 py-2" style={{ maxHeight: LIST_MAX_H }}>
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Spin size="small" />
          </div>
        ) : items.length === 0 ? (
          <div className="px-3 py-6 text-center">
            <Typography.Text type="secondary" className="text-sm">
              Chưa có thông báo
            </Typography.Text>
          </div>
        ) : (
          <ul className="m-0 flex list-none flex-col gap-3 p-0">
            {items.map((item) => (
              <li key={item.id} className="min-w-0">
                <button
                  type="button"
                  className={clsx(
                    'w-full cursor-pointer rounded-md border border-transparent px-3 py-3 text-left transition',
                    'hover:border-[var(--color-border-light)] hover:bg-page',
                    !item.isRead &&
                      'border-l-[3px] border-l-brand bg-brand-soft hover:bg-brand-soft',
                  )}
                  onClick={() => void onRowActivate(item)}
                >
                  <div className="flex gap-2">
                    <span
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand"
                      aria-hidden
                    >
                      <BellOutlined className="text-base" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <Typography.Text
                        strong={!item.isRead}
                        className="block truncate text-[14px] text-wp-charcoal"
                      >
                        {item.title}
                      </Typography.Text>
                      {item.body ? (
                        <Typography.Text
                          type="secondary"
                          className="mt-0.5 line-clamp-2 block text-[13px]"
                        >
                          {item.body}
                        </Typography.Text>
                      ) : null}
                      <Typography.Text type="secondary" className="mt-1 block text-xs">
                        {timeAgo(item.createdAt)}
                      </Typography.Text>
                    </div>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="border-t border-[var(--color-border-light)] px-2 pt-2">
        <button
          type="button"
          className="text-brand hover:text-[var(--color-brand-text)] w-full rounded-md py-2 text-center text-sm font-medium transition"
          onClick={() => {
            setOpen(false)
            void router.push('/notifications')
          }}
        >
          Xem toàn bộ thông báo
        </button>
      </div>
    </div>
  )

  return (
    <Dropdown
      open={open}
      onOpenChange={setOpen}
      trigger={['click']}
      placement="bottomRight"
      dropdownRender={() => panel}
      getPopupContainer={() => document.body}
    >
      <span className="inline-flex cursor-pointer">
        <Badge count={badgeCount} size="small" offset={[-2, 4]} color="#dc2626">
          {trigger ?? defaultTrigger}
        </Badge>
      </span>
    </Dropdown>
  )
}
