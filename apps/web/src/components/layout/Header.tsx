import { NotificationBellDropdown } from '@/components/layout/NotificationBellDropdown'
import { useUnreadCount } from '@/hooks/useNotifications'
import { BellOutlined, LogoutOutlined, MenuOutlined, UserOutlined } from '@ant-design/icons'
import type { MenuProps } from 'antd'
import { Avatar, Button, Dropdown, Grid } from 'antd'
import { APP_NAME } from '@/config/app'
import { signOut, useSession } from 'next-auth/react'

const { useBreakpoint } = Grid

export function AppHeader({
  title,
  onMenuClick,
}: {
  title?: string
  onMenuClick?: () => void
}) {
  const { data: session } = useSession()
  const screens = useBreakpoint()
  const isMobile = !screens.md
  const { data: unread } = useUnreadCount()

  const userMenu: MenuProps['items'] = [
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: 'Đăng xuất',
      onClick: ({ domEvent }) => {
        domEvent.preventDefault()
        domEvent.stopPropagation()
        void signOut({ callbackUrl: '/auth/login' })
      },
    },
  ]

  return (
    <header className="sticky top-0 z-50 flex h-14 shrink-0 items-center justify-between gap-3 border-b border-gray-100 bg-white px-4">
      <div className="flex min-w-0 flex-1 items-center gap-2">
        {isMobile ? (
          <Button type="text" icon={<MenuOutlined />} onClick={onMenuClick} aria-label="Mở menu" />
        ) : null}
        <h1 className="truncate text-lg font-semibold leading-tight text-gray-900">
          {title ?? APP_NAME}
        </h1>
      </div>
      <div className="app-header-actions flex shrink-0 items-center gap-1 sm:gap-2">
        <NotificationBellDropdown
          badgeCount={unread?.count ?? 0}
          trigger={
            <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-stone-200/90 bg-white text-stone-600 shadow-sm transition hover:border-stone-300 hover:bg-stone-50 hover:text-brand">
              <BellOutlined className="text-base" />
            </span>
          }
        />
        <Dropdown
          menu={{ items: userMenu }}
          trigger={['click']}
          placement="bottomRight"
          getPopupContainer={(trigger) => trigger.parentElement ?? document.body}
        >
          <button
            type="button"
            className="flex max-w-[200px] cursor-pointer items-center gap-2 rounded-md border-0 bg-transparent py-1 pl-1 pr-0 text-left text-gray-900 outline-none ring-inset hover:bg-gray-50 focus-visible:ring-2 focus-visible:ring-blue-500"
          >
            <Avatar size="small" src={session?.user?.image} icon={<UserOutlined />} />
            {!isMobile ? (
              <span className="truncate text-sm text-gray-700">{session?.user?.name}</span>
            ) : null}
          </button>
        </Dropdown>
      </div>
    </header>
  )
}
