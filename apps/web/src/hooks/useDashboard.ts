import { api } from '@/lib/api'
import { useQuery } from '@tanstack/react-query'

export interface DashboardSummary {
  participatingGroups: number
  totalDebt: string
  totalCredit: string
  pendingSettlementCount: number
  /** Nhóm có đã trả + quỹ − phần chia âm (ước tính). */
  debtGroupIds: string[]
  /** Nhóm có số dư ròng dương (người khác “nợ” bạn). */
  creditGroupIds: string[]
  /** Nhóm có ít nhất một đợt tổng kết DRAFT/PENDING. */
  pendingSettlementGroupIds: string[]
}

export const dashboardKeys = {
  summary: () => ['dashboard', 'summary'] as const,
}

export const useDashboardSummary = () =>
  useQuery({
    queryKey: dashboardKeys.summary(),
    queryFn: () =>
      api.get<{ data: DashboardSummary }>('/dashboard/summary').then((r) => r.data.data),
  })
