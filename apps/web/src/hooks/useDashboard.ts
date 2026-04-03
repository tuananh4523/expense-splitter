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

export interface DashboardChartData {
  lineChartData: Array<{ date: string; amount: string }>
  pieChartData: Array<{ name: string; color: string; amount: string }>
}

export const dashboardKeys = {
  summary: () => ['dashboard', 'summary'] as const,
  charts: (start?: string, end?: string) => ['dashboard', 'charts', start, end] as const,
}

export const useDashboardSummary = () =>
  useQuery({
    queryKey: dashboardKeys.summary(),
    queryFn: () =>
      api.get<{ data: DashboardSummary }>('/dashboard/summary').then((r) => r.data.data),
  })

export const useDashboardCharts = (startDate?: Date, endDate?: Date) =>
  useQuery({
    queryKey: dashboardKeys.charts(startDate?.toISOString(), endDate?.toISOString()),
    queryFn: () =>
      api
        .get<{ data: DashboardChartData }>('/dashboard/charts', {
          params: {
            ...(startDate ? { startDate: startDate.toISOString() } : {}),
            ...(endDate ? { endDate: endDate.toISOString() } : {}),
          },
        })
        .then((r) => r.data.data),
  })

