import { CreateGroupModal } from '@/components/groups/CreateGroupModal'
import { GroupCard } from '@/components/groups/GroupCard'
import { GroupsFilterCallout } from '@/components/groups/GroupsFilterCallout'
import AppLayout from '@/components/layout/AppLayout'
import { EmptyState } from '@/components/shared/EmptyState'
import { useDashboardSummary } from '@/hooks/useDashboard'
import { useGroups } from '@/hooks/useGroup'
import { withAuth } from '@/utils/withAuth'
import type { GroupDto } from '@expense/types'
import { Alert, Button, Col, Row, Spin, Typography } from 'antd'
import { useRouter } from 'next/router'
import { useEffect, useMemo, useState } from 'react'

export const getServerSideProps = withAuth()

type GroupsListFilter = 'none' | 'owe' | 'owed' | 'settlement_pending'

function parseGroupsFilter(query: Record<string, string | string[] | undefined>): GroupsListFilter {
  const bal = query.balance
  const balStr = typeof bal === 'string' ? bal : Array.isArray(bal) ? bal[0] : undefined
  if (balStr === 'owe') return 'owe'
  if (balStr === 'owed') return 'owed'
  const st = query.settlement
  const stStr = typeof st === 'string' ? st : Array.isArray(st) ? st[0] : undefined
  if (stStr === 'pending') return 'settlement_pending'
  return 'none'
}

export default function GroupsPage() {
  const router = useRouter()
  const [createOpen, setCreateOpen] = useState(false)
  const { data: groups, isLoading: loadingGroups } = useGroups()
  const { data: summary, isLoading: loadingSummary, isError: summaryError } = useDashboardSummary()

  const listFilter = useMemo(
    () => (router.isReady ? parseGroupsFilter(router.query) : 'none'),
    [router.isReady, router.query],
  )

  const filterInEffect = listFilter !== 'none'

  const allowedGroupIds = useMemo(() => {
    if (!filterInEffect || summaryError || !summary) return null
    if (listFilter === 'owe') return new Set(summary.debtGroupIds)
    if (listFilter === 'owed') return new Set(summary.creditGroupIds)
    return new Set(summary.pendingSettlementGroupIds)
  }, [summary, listFilter, filterInEffect, summaryError])

  const applyListFilter = (arr: GroupDto[]) => {
    if (!allowedGroupIds) return arr
    return arr.filter((g) => allowedGroupIds.has(g.id))
  }

  const { led, joined } = useMemo(() => {
    const list = groups ?? []
    return {
      led: list.filter((g) => g.myRole === 'LEADER'),
      joined: list.filter((g) => g.myRole !== 'LEADER'),
    }
  }, [groups])

  const ledFiltered = useMemo(() => applyListFilter(led), [led, allowedGroupIds])
  const joinedFiltered = useMemo(() => applyListFilter(joined), [joined, allowedGroupIds])

  const filterCallout =
    listFilter === 'owe'
      ? {
          variant: 'owe' as const,
          title: 'Nhóm bạn đang nợ (ước tính)',
          description: 'Cùng công thức «đã trả + quỹ − phần chia» trong nhóm (âm).',
        }
      : listFilter === 'owed'
        ? {
            variant: 'owed' as const,
            title: 'Nhóm được nợ (ước tính)',
            description: 'Cùng công thức trong nhóm (dương).',
          }
        : listFilter === 'settlement_pending'
          ? {
              variant: 'settlement_pending' as const,
              title: 'Nhóm có tổng kết đang chờ',
              description:
                'Chỉ hiện nhóm có ít nhất một đợt tổng kết ở trạng thái nháp hoặc đang chờ xử lý.',
            }
          : null

  useEffect(() => {
    if (!router.isReady) return
    if (router.query.create !== '1') return
    setCreateOpen(true)
    void router.replace('/groups', undefined, { shallow: true })
  }, [router.isReady, router.query.create, router])

  const clearFilter = () => {
    void router.replace('/groups', undefined, { shallow: true })
  }

  const listLoading = loadingGroups || (filterInEffect && loadingSummary)

  return (
    <AppLayout title="Nhóm của tôi">
      <CreateGroupModal open={createOpen} onCancel={() => setCreateOpen(false)} />
      <div className="mb-6 flex items-center justify-end">
        <Button type="primary" onClick={() => setCreateOpen(true)}>
          Tạo nhóm mới
        </Button>
      </div>

      {filterCallout ? (
        <GroupsFilterCallout
          variant={filterCallout.variant}
          title={filterCallout.title}
          description={filterCallout.description}
          onClear={clearFilter}
        />
      ) : null}

      {summaryError && filterInEffect ? (
        <Alert
          type="warning"
          showIcon
          className="mb-6"
          message="Không tải được dữ liệu lọc"
          description="Đang hiển thị toàn bộ nhóm. Bạn có thể thử lại sau hoặc xóa bộ lọc."
          action={
            <Button size="small" type="link" onClick={clearFilter}>
              Xem tất cả nhóm
            </Button>
          }
        />
      ) : null}

      {listLoading ? (
        <div className="flex justify-center py-12">
          <Spin />
        </div>
      ) : (
        <>
          {filterInEffect &&
          allowedGroupIds &&
          (groups?.length ?? 0) > 0 &&
          ledFiltered.length === 0 &&
          joinedFiltered.length === 0 ? (
            <EmptyState className="mb-8" description="Không có nhóm nào khớp bộ lọc này." />
          ) : null}

          <section className="mb-8">
            <Typography.Title level={5} className="!mb-3 !mt-0">
              Nhóm bạn quản lý
            </Typography.Title>
            {ledFiltered.length > 0 ? (
              <Row gutter={[16, 16]} align="stretch">
                {ledFiltered.map((g) => (
                  <Col xs={24} sm={12} lg={8} key={g.id} className="flex min-w-0 flex-col">
                    <GroupCard group={g} />
                  </Col>
                ))}
              </Row>
            ) : filterInEffect && allowedGroupIds && led.length > 0 ? (
              <Typography.Text type="secondary">
                Không có nhóm quản lý nào trong bộ lọc này.
              </Typography.Text>
            ) : !filterInEffect && led.length === 0 ? (
              <EmptyState description="Bạn chưa có nhóm do mình làm trưởng nhóm" />
            ) : null}
          </section>

          <section>
            <Typography.Title level={5} className="!mb-3 !mt-0">
              Nhóm tham gia
            </Typography.Title>
            {joinedFiltered.length > 0 ? (
              <Row gutter={[16, 16]} align="stretch">
                {joinedFiltered.map((g) => (
                  <Col xs={24} sm={12} lg={8} key={g.id} className="flex min-w-0 flex-col">
                    <GroupCard group={g} />
                  </Col>
                ))}
              </Row>
            ) : filterInEffect && allowedGroupIds && joined.length > 0 ? (
              <Typography.Text type="secondary">
                Không có nhóm tham gia nào trong bộ lọc này.
              </Typography.Text>
            ) : !filterInEffect && joined.length === 0 ? (
              <Typography.Text type="secondary">
                Chưa tham gia nhóm nào với vai trò thành viên.
              </Typography.Text>
            ) : null}
          </section>
        </>
      )}
    </AppLayout>
  )
}
