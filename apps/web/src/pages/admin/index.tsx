import AppLayout from '@/components/layout/AppLayout'
import { OverviewHighlightCard } from '@/components/shared/OverviewHighlightCard'
import { api } from '@/lib/api'
import { withAdmin } from '@/utils/withAdmin'
import { Icon } from '@iconify/react'
import { Col, Row, Spin } from 'antd'
import { useQuery } from '@tanstack/react-query'

export const getServerSideProps = withAdmin()

export default function AdminDashboardPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'stats'],
    queryFn: () =>
      api
        .get<{
          data: {
            userCount: number
            groupCount: number
            expenseCount: number
            pendingSettlements: number
          }
        }>('/admin/stats')
        .then((r) => r.data.data),
  })

  return (
    <AppLayout title="Quản trị hệ thống">
      {isLoading || !data ? (
        <Spin />
      ) : (
        <>
          <Row gutter={[16, 16]}>
            {[
              { label: 'Người dùng hoạt động', value: data.userCount, icon: 'fluent:people-community-24-regular', color: '#0073AA', bg: '#E5F4FA' },
              { label: 'Nhóm hoạt động', value: data.groupCount, icon: 'fluent:folder-people-24-regular', color: '#00A32A', bg: '#EDFAEF' },
              { label: 'Chi tiêu (30 ngày)', value: data.expenseCount, icon: 'mdi:cash-multiple', color: '#D54E21', bg: '#FCF9E8' },
              { label: 'Tổng kết chờ', value: data.pendingSettlements, icon: 'mdi:calculator-variant-outline', color: '#005A87', bg: '#E5F4FA' },
            ].map((s) => (
              <Col xs={24} sm={12} lg={6} key={s.label}>
                <div className="flex items-center gap-4 rounded-xl border border-stone-300 bg-white px-5 py-4 shadow-sm">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl" style={{ background: s.bg }}>
                    <Icon icon={s.icon} width={24} color={s.color} />
                  </div>
                  <div>
                    <div className="text-sm text-stone-500">{s.label}</div>
                    <div className="text-2xl font-bold text-stone-900">{s.value}</div>
                  </div>
                </div>
              </Col>
            ))}
          </Row>
          <Row gutter={[16, 16]} className="mt-6">
            <Col xs={24} sm={12} lg={6}>
              <OverviewHighlightCard variant="indigo" title="Tài khoản" description="Quản lý người dùng" icon="fluent:people-community-24-regular" href="/admin/users" showChevron className="h-full" />
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <OverviewHighlightCard variant="teal" title="Nhóm" description="Quản lý nhóm hệ thống" icon="fluent:folder-people-24-regular" href="/admin/groups" showChevron className="h-full" />
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <OverviewHighlightCard variant="amber" title="Danh mục" description="Danh mục chi tiêu" icon="fluent:tag-24-regular" href="/admin/categories" showChevron className="h-full" />
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <OverviewHighlightCard variant="violet" title="Audit log" description="Lịch sử hoạt động" icon="fluent:document-search-24-regular" href="/admin/audit" showChevron className="h-full" />
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <OverviewHighlightCard
                variant="teal"
                title="Thông báo hệ thống"
                description="Gửi toast + thông báo cho người dùng"
                icon="fluent:megaphone-24-regular"
                href="/admin/broadcast"
                showChevron
                className="h-full"
              />
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <OverviewHighlightCard
                variant="indigo"
                title="Cài đặt hệ thống"
                description="Tự đăng xuất khi không hoạt động"
                icon="fluent:settings-24-regular"
                href="/admin/settings"
                showChevron
                className="h-full"
              />
            </Col>
          </Row>
        </>
      )}
    </AppLayout>
  )
}
