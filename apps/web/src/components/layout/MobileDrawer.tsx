import { SidebarMenu } from '@/components/layout/Sidebar'
import { Drawer } from 'antd'
import Link from 'next/link'
import type { ReactNode } from 'react'

export function MobileDrawer({
  open,
  onClose,
  groupId,
}: {
  open: boolean
  onClose: () => void
  groupId?: string
}) {
  return (
    <Drawer title="Menu" placement="left" onClose={onClose} open={open} width={280}>
      <SidebarMenu {...(groupId ? { groupId } : {})} onNavigate={onClose} />
    </Drawer>
  )
}

export function MobileBottomNav(): ReactNode {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 flex border-t border-gray-200 bg-white py-2 md:hidden">
      <BottomLink href="/dashboard" label="Dashboard" />
      <BottomLink href="/groups" label="Nhóm" />
      <BottomLink href="/notifications" label="Thông báo" />
      <BottomLink href="/dashboard" label="Tài khoản" />
    </nav>
  )
}

function BottomLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="flex-1 text-center text-xs font-medium text-gray-700 hover:text-[#1677ff]"
    >
      {label}
    </Link>
  )
}
