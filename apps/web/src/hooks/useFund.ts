import { groupKeys } from '@/hooks/useGroup'
import { api } from '@/lib/api'
import type { ContributeFundInput, FundDto } from '@expense/types'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

export const fundKeys = {
  detail: (groupId: string) => ['fund', groupId] as const,
}

export const useFund = (groupId: string, queryEnabled = true) =>
  useQuery({
    queryKey: fundKeys.detail(groupId),
    queryFn: () => api.get<{ data: FundDto }>(`/groups/${groupId}/fund`).then((r) => r.data.data),
    enabled: Boolean(groupId) && queryEnabled,
  })

export const useContribute = (groupId: string) => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: ContributeFundInput) =>
      api
        .post<{ data: FundDto }>(`/groups/${groupId}/fund/contribute`, data)
        .then((r) => r.data.data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: fundKeys.detail(groupId) })
      void qc.invalidateQueries({ queryKey: groupKeys.detail(groupId) })
    },
  })
}

export const useApproveFundContribution = (groupId: string) => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (transactionId: string) =>
      api
        .post<{ data: FundDto }>(`/groups/${groupId}/fund/contributions/${transactionId}/approve`, {})
        .then((r) => r.data.data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: fundKeys.detail(groupId) })
      void qc.invalidateQueries({ queryKey: groupKeys.detail(groupId) })
    },
  })
}

export const useRejectFundContribution = (groupId: string) => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (p: { transactionId: string; note?: string }) =>
      api
        .post<{ data: FundDto }>(`/groups/${groupId}/fund/contributions/${p.transactionId}/reject`, {
          note: p.note,
        })
        .then((r) => r.data.data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: fundKeys.detail(groupId) })
      void qc.invalidateQueries({ queryKey: groupKeys.detail(groupId) })
    },
  })
}
