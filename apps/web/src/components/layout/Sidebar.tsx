import { GroupNavIcon } from '@/components/groups/GroupNavIcon'
import { useGroup, useGroups } from '@/hooks/useGroup'
import { useMe } from '@/hooks/useProfile'
import { Icon } from '@iconify/react'
import type { GroupDto } from '@expense/types'
import type { MenuProps } from 'antd'
import { ConfigProvider, Menu } from 'antd'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/router'
import { useCallback, useLayoutEffect, useMemo, useState } from 'react'

function groupSubItems(g: GroupDto): MenuProps['items'] {
  const base: MenuProps['items'] = [
    {
      key: `/groups/${g.id}`,
      icon: <Icon icon="mdi:view-dashboard-outline" width={16} color="currentColor" />,
      label: 'Tổng quan',
      title: `${g.name} — Tổng quan`,
    },
    {
      key: `/groups/${g.id}/expenses`,
      icon: <Icon icon="mdi:cash-multiple" width={16} color="currentColor" />,
      label: 'Chi tiêu',
      title: `${g.name} — Chi tiêu`,
    },
    {
      key: `/groups/${g.id}/members`,
      icon: <Icon icon="mdi:account-multiple" width={16} color="currentColor" />,
      label: 'Thành viên',
      title: `${g.name} — Thành viên`,
    },
    {
      key: `/groups/${g.id}/fund`,
      icon: <Icon icon="mdi:bank-outline" width={16} color="currentColor" />,
      label: 'Quỹ nhóm',
      title: `${g.name} — Quỹ nhóm`,
    },
    {
      key: `/groups/${g.id}/settlement`,
      icon: <Icon icon="mdi:calculator-variant" width={16} color="currentColor" />,
      label: 'Tổng kết',
      title: `${g.name} — Tổng kết`,
    },
    {
      key: `/groups/${g.id}/activity`,
      icon: <Icon icon="mdi:history" width={16} color="currentColor" />,
      label: 'Lịch sử',
      title: `${g.name} — Lịch sử hoạt động`,
    },
  ]
  if (g.myRole === 'LEADER') {
    base.push({
      key: `/groups/${g.id}/settings`,
      icon: <Icon icon="mdi:cog-outline" width={16} color="currentColor" />,
      label: 'Cài đặt',
      title: `${g.name} — Cài đặt`,
    })
  }
  return base
}

function activeGroupMenuKey(pathname: string): string | null {
  const m = /^\/groups\/([^/]+)/.exec(pathname)
  const id = m?.[1]
  if (!id || id === 'new') return null
  return `g-${id}`
}

export function SidebarNav({
  onNavigate,
  inlineCollapsed = false,
}: {
  onNavigate?: () => void
  /** Đồng bộ với Sider thu gọn — Ant Menu dùng popup cho submenu */
  inlineCollapsed?: boolean
}) {
  const router = useRouter()
  const { data: session, status: sessionStatus } = useSession()
  const { data: me } = useMe({
    enabled: sessionStatus === 'authenticated',
    staleTime: 0,
  })
  /** Menu quản trị: ưu tiên /users/me (trình duyệt → rewrite API), tránh JWT SSR lỗi mạng vẫn giữ role cũ. */
  const effectiveRole = me?.role ?? session?.user?.role
  const isAdmin = effectiveRole === 'ADMIN'
  const { data: groups = [] } = useGroups()
  const path = router.asPath.split('?')[0] ?? ''
  const pathGroupId = useMemo(() => {
    const m = /^\/groups\/([^/]+)/.exec(path)
    const id = m?.[1]
    if (!id || id === 'new') return undefined
    return id
  }, [path])
  const inMemberList = Boolean(pathGroupId && groups.some((g) => g.id === pathGroupId))
  const { data: pathOnlyGroup } = useGroup(pathGroupId, { enabled: Boolean(pathGroupId) && !inMemberList })
  const menuGroups = useMemo(() => {
    if (!pathGroupId || !pathOnlyGroup) return groups
    if (groups.some((g) => g.id === pathGroupId)) return groups
    return [pathOnlyGroup, ...groups]
  }, [groups, pathGroupId, pathOnlyGroup])
  const activeGk = useMemo(() => activeGroupMenuKey(path), [path])
  const [openKeys, setOpenKeys] = useState<string[]>([])

  /** Chỉ tự mở submenu khi đổi nhóm (activeGk đổi); user được phép đóng lại. */
  useLayoutEffect(() => {
    if (!activeGk || inlineCollapsed) return
    setOpenKeys((prev) => (prev.includes(activeGk) ? prev : [...prev, activeGk]))
  }, [activeGk, inlineCollapsed])

  const handleOpenChange = useCallback((keys: string[]) => {
    setOpenKeys(keys)
  }, [])

  const items: MenuProps['items'] = useMemo(() => {
    const list: MenuProps['items'] = []

    list.push({
      key: 'app-label',
      label: <span className="sidebar-section-label">Trang chính</span>,
      disabled: true,
    })
    list.push(
      {
        key: '/dashboard',
        icon: <Icon icon="mdi:view-dashboard-outline" width={18} color="currentColor" />,
        label: 'Dashboard',
        title: 'Dashboard',
      },
      {
        key: '/groups',
        icon: <Icon icon="mdi:account-group-outline" width={18} color="currentColor" />,
        label: 'Nhóm của tôi',
        title: 'Nhóm của tôi',
      },
    )

    if (menuGroups.length > 0) {
      list.push({
        type: 'divider',
        key: 'div-pinned',
      })
      list.push({
        key: 'pin-label',
        label: <span className="sidebar-section-label">Nhóm đang tham gia</span>,
        disabled: true,
      })
      for (const g of menuGroups) {
        if (inlineCollapsed) {
          list.push({
            key: `/groups/${g.id}`,
            icon: <GroupNavIcon group={g} size={20} />,
            label: g.name,
            title: g.name,
          })
        } else {
          list.push({
            key: `g-${g.id}`,
            icon: (
              <span className="sidebar-group-icon">
                <GroupNavIcon group={g} size={20} />
              </span>
            ),
            label: (
              <span className="sidebar-group-title" title={g.name}>
                {g.name}
              </span>
            ),
            title: g.name,
            theme: 'dark',
            children: groupSubItems(g),
          })
        }
      }
    }

    if (isAdmin) {
      list.push({ type: 'divider', key: 'div-before-admin' })
      list.push({
        key: 'admin-label',
        label: <span className="sidebar-section-label">Quản trị hệ thống</span>,
        disabled: true,
      })
      list.push({
        key: '/admin',
        icon: <Icon icon="mdi:shield-account-outline" width={18} color="currentColor" />,
        label: 'Bảng điều khiển',
        title: 'Quản trị — Bảng điều khiển',
      })
      list.push({
        key: '/admin/users',
        icon: <Icon icon="mdi:account-supervisor-outline" width={18} color="currentColor" />,
        label: 'Tài khoản',
        title: 'Quản trị — Tài khoản',
      })
      list.push({
        key: '/admin/groups',
        icon: <Icon icon="mdi:folder-account-outline" width={18} color="currentColor" />,
        label: 'Nhóm (hệ thống)',
        title: 'Quản trị — Nhóm',
      })
      list.push({
        key: '/admin/categories',
        icon: <Icon icon="mdi:tag-outline" width={18} color="currentColor" />,
        label: 'Danh mục',
        title: 'Quản trị — Danh mục',
      })
      list.push({
        key: '/admin/audit',
        icon: <Icon icon="mdi:text-search" width={18} color="currentColor" />,
        label: 'Audit log',
        title: 'Quản trị — Audit log',
      })
      list.push({
        key: '/admin/broadcast',
        icon: <Icon icon="mdi:bullhorn-outline" width={18} color="currentColor" />,
        label: 'Thông báo hệ thống',
        title: 'Quản trị — Gửi thông báo toàn hệ thống',
      })
      list.push({
        key: '/admin/feedback',
        icon: <Icon icon="mdi:comment-quote-outline" width={18} color="currentColor" />,
        label: 'Góp ý & phản hồi',
        title: 'Quản trị — Góp ý người dùng',
      })
      list.push({
        key: '/admin/settings',
        icon: <Icon icon="mdi:tune-variant" width={18} color="currentColor" />,
        label: 'Cài đặt hệ thống',
        title: 'Quản trị — Cài đặt hệ thống',
      })
    }

    return list
  }, [menuGroups, isAdmin, inlineCollapsed])

  return (
    <ConfigProvider
      wave={{ disabled: true }}
      theme={{
        token: { motion: false },
        components: {
          /** Khớp .sidebar-collapsed-hit (44px): ô vuông gọn trong Sider 80px, không dùng bar full-width */
          Menu: {
            itemHeight: 44,
            itemMarginBlock: 0,
            collapsedIconSize: 20,
          },
        },
      }}
    >
      <Menu
        mode="inline"
        theme="dark"
        inlineCollapsed={inlineCollapsed}
        className="sidebar-menu sidebar-menu-groups !border-0"
        style={{ background: 'transparent' }}
        selectedKeys={[path]}
        openKeys={inlineCollapsed ? [] : openKeys}
        onOpenChange={handleOpenChange}
        items={items}
        motion={{ motionAppear: false, motionEnter: false, motionLeave: false }}
        onClick={({ key }) => {
          if (key === 'pin-label' || key === 'admin-label' || key === 'app-label') return
          if (String(key).startsWith('g-')) return
          if (key.startsWith('/')) {
            void router.push(key)
            onNavigate?.()
          }
        }}
      />
    </ConfigProvider>
  )
}

export function SidebarMenu(props: { groupId?: string; onNavigate?: () => void; showFooter?: boolean }) {
  return <SidebarNav {...(props.onNavigate != null ? { onNavigate: props.onNavigate } : {})} />
}

export function Sidebar() {
  return <SidebarNav />
}
