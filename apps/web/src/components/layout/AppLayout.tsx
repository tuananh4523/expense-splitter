import { FeedbackFab } from '@/components/feedback/FeedbackFab'
import { GroupNavIcon } from '@/components/groups/GroupNavIcon'
import { AppVersionBadge } from '@/components/layout/AppVersionBadge'
import { ChangePasswordModal } from '@/components/layout/ChangePasswordModal'
import { NotificationBellDropdown } from '@/components/layout/NotificationBellDropdown'
import { SidebarNav } from '@/components/layout/Sidebar'
import { ThemeSwitcher } from '@/components/layout/ThemeSwitcher'
import { APP_NAME } from '@/config/app'
import { pageTitle } from '@/config/site'
import { useGroup } from '@/hooks/useGroup'
import { useUnreadCount } from '@/hooks/useNotifications'
import { useMe } from '@/hooks/useProfile'
import { SIDEBAR_COLLAPSED_STORAGE_KEY, readSidebarCollapsedFromStorage } from '@/lib/sidebar-pref'
import { Icon } from '@iconify/react'
import { Alert, Avatar, Button, Drawer, Dropdown, Layout } from 'antd'
import { signOut, useSession } from 'next-auth/react'
import Head from 'next/head'
import { useRouter } from 'next/router'
import { type ReactNode, useState } from 'react'

const SIDEBAR_EXPANDED = 256
const SIDEBAR_COLLAPSED = 80

const { Sider, Header, Content } = Layout

export default function AppLayout({ children, title }: { children: ReactNode; title?: string }) {
  const { data: session, status: sessionStatus } = useSession()
  const { data: me } = useMe({ enabled: sessionStatus === 'authenticated' })
  const router = useRouter()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [changePwOpen, setChangePwOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    if (typeof window === 'undefined') return false
    return readSidebarCollapsedFromStorage()
  })

  const setCollapsedPersist = (next: boolean) => {
    setSidebarCollapsed(next)
    try {
      localStorage.setItem(SIDEBAR_COLLAPSED_STORAGE_KEY, next ? '1' : '0')
      document.documentElement.classList.toggle('layout-shell-collapsed', next)
    } catch {
      /* ignore */
    }
  }

  const sidebarWidth = sidebarCollapsed ? SIDEBAR_COLLAPSED : SIDEBAR_EXPANDED
  const { data: unreadData } = useUnreadCount()
  const unread = unreadData?.count ?? 0

  const groupId = typeof router.query.groupId === 'string' ? router.query.groupId : undefined
  const { data: group } = useGroup(groupId)

  const displayName = me?.name ?? session?.user?.name ?? ''
  const displayImage = me?.avatarUrl ?? session?.user?.image ?? undefined

  const userMenu = {
    items: [
      {
        key: 'profile',
        icon: <Icon icon="mdi:account-circle-outline" width={18} />,
        label: 'Tài khoản của tôi',
      },
      {
        key: 'change-password',
        icon: <Icon icon="mdi:lock-reset" width={18} />,
        label: 'Đổi mật khẩu',
      },
      {
        key: 'sessions',
        icon: <Icon icon="mdi:devices" width={18} />,
        label: 'Phiên đăng nhập',
      },
      { type: 'divider' as const },
      {
        key: 'logout',
        icon: <Icon icon="mdi:logout" width={18} />,
        label: 'Đăng xuất',
        danger: true,
      },
    ],
    onClick: ({ key }: { key: string }) => {
      if (key === 'profile') void router.push('/profile')
      if (key === 'change-password') setChangePwOpen(true)
      if (key === 'sessions') void router.push('/profile/sessions')
      if (key === 'logout') void signOut({ callbackUrl: '/auth/login' })
    },
  }

  const docTitle = pageTitle(
    group ? (title ? `${group.name} / ${title}` : group.name) : (title ?? 'Dashboard'),
  )

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Head>
        <title>{docTitle}</title>
      </Head>
      <Sider
        className="app-sider"
        width={SIDEBAR_EXPANDED}
        collapsedWidth={SIDEBAR_COLLAPSED}
        collapsed={sidebarCollapsed}
        onCollapse={setCollapsedPersist}
        collapsible
        trigger={null}
        theme="dark"
        style={{
          position: 'fixed',
          left: 0,
          top: 0,
          bottom: 0,
          zIndex: 100,
          height: '100vh',
          overflow: 'hidden',
        }}
      >
        <div className="app-sider-brand">
          <div className="app-sider-brand-mark">
            <Icon icon="mdi:wallet-outline" width={22} color="#fff" />
          </div>
          <span className="app-sider-brand-text">{APP_NAME}</span>
        </div>

        <div className="app-sider-scroll">
          <SidebarNav inlineCollapsed={sidebarCollapsed} />
        </div>

        <div className="app-sider-footer">
          <Button
            type="text"
            aria-expanded={!sidebarCollapsed}
            aria-label={sidebarCollapsed ? 'Mở rộng menu' : 'Thu gọn menu'}
            icon={
              <Icon
                icon={sidebarCollapsed ? 'mdi:chevron-double-right' : 'mdi:chevron-double-left'}
                width={22}
                style={{ color: 'var(--sidebar-icon)' }}
              />
            }
            onClick={() => setCollapsedPersist(!sidebarCollapsed)}
          />
        </div>
      </Sider>

      <Drawer
        placement="left"
        open={mobileOpen}
        onClose={() => setMobileOpen(false)}
        width={280}
        styles={{
          body: { padding: 0, background: 'var(--drawer-body-bg)' },
          header: { display: 'none' },
        }}
      >
        <div className="app-drawer-head">
          <span className="text-stone-100 font-semibold">Menu</span>
        </div>
        <SidebarNav onNavigate={() => setMobileOpen(false)} />
      </Drawer>

      <Layout
        className="app-main-inner"
        style={{
          marginLeft: sidebarWidth,
          transition: 'margin-left 0.2s ease',
          minHeight: '100vh',
        }}
      >
        <Header className="app-header">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <Button
              type="text"
              icon={<Icon icon="mdi:menu" width={22} />}
              onClick={() => setMobileOpen(true)}
              className="app-header-icon-btn mobile-menu-btn shrink-0"
            />
            <h1 className="app-header-title truncate">
              {group ? (
                <span className="flex items-center gap-2">
                  <GroupNavIcon group={group} size={22} />
                  <span className="text-stone-400 font-normal">{group.name}</span>
                  <span className="text-stone-300">/</span>
                  {title}
                </span>
              ) : (
                (title ?? 'Dashboard')
              )}
            </h1>
          </div>

          <div className="app-header-actions flex shrink-0 items-center gap-2 sm:gap-3">
            <AppVersionBadge />
            <ThemeSwitcher />
            <NotificationBellDropdown badgeCount={unread} />

            <Dropdown menu={userMenu} placement="bottomRight" trigger={['click']}>
              <button type="button" className="app-header-user" aria-label="Tài khoản">
                <Avatar size={36} src={displayImage} className="!bg-brand !font-semibold">
                  {displayName?.[0]?.toUpperCase()}
                </Avatar>
                <span className="app-header-user-meta hidden sm:block">
                  <span className="app-header-user-name">{displayName}</span>
                  <span className="app-header-user-email">{session?.user?.email}</span>
                </span>
                <Icon
                  icon="mdi:chevron-down"
                  width={18}
                  className="hidden text-stone-400 sm:block"
                />
              </button>
            </Dropdown>
          </div>
        </Header>

        <Content style={{ background: 'var(--color-bg-page, #f0f0f1)' }}>
          <div className="app-content">
            {group && !group.isActive ? (
              <Alert
                type="warning"
                showIcon
                className="mb-4"
                message="Nhóm đã bị tạm khóa bởi quản trị viên"
                description="Thành viên không thể thao tác cho đến khi nhóm được bật lại. Bạn vẫn có thể rời nhóm từ trang thành viên nếu cần."
              />
            ) : null}
            {group?.adminViewer ? (
              <Alert
                type="info"
                showIcon
                className="mb-4"
                message="Chế độ quản trị (chỉ xem)"
                description="Tài khoản của bạn không phải thành viên nhóm này — chỉ xem dữ liệu, không thể chỉnh sửa."
              />
            ) : null}
            {children}
          </div>
        </Content>
      </Layout>

      <FeedbackFab />

      <ChangePasswordModal open={changePwOpen} onClose={() => setChangePwOpen(false)} />
    </Layout>
  )
}
