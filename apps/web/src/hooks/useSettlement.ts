import { expenseKeys } from '@/hooks/useExpenses'
import { groupKeys } from '@/hooks/useGroup'
import { notificationKeys } from '@/hooks/useNotifications'
import { api } from '@/lib/api'
import type {
  AcceptPaymentInput,
  ConfirmPaymentInput,
  CreateSettlementInput,
  SettlementDto,
  SettlementPreviewDto,
} from '@expense/types'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/router'

export interface SettlementMemberTotal {
  userId: string
  name: string
  avatarUrl: string | null
  paid: string
  debt: string
}

export interface SettlementMemberTotals {
  startDate: string
  endDate: string
  members: SettlementMemberTotal[]
}

export const settlementKeys = {
  all: (groupId: string) => ['settlements', groupId] as const,
  lists: (groupId: string) => [...settlementKeys.all(groupId), 'list'] as const,
  detail: (groupId: string, settlementId: string) =>
    [...settlementKeys.all(groupId), 'detail', settlementId] as const,
  preview: (groupId: string, periodStart: string, periodEnd: string) =>
    [...settlementKeys.all(groupId), 'preview', periodStart, periodEnd] as const,
  memberTotals: (groupId: string, start?: string, end?: string) =>
    [...settlementKeys.all(groupId), 'member-totals', start, end] as const,
}

export const useSettlements = (groupId: string) =>
  useQuery({
    queryKey: settlementKeys.lists(groupId),
    queryFn: () =>
      api.get<{ data: SettlementDto[] }>(`/groups/${groupId}/settlements`).then((r) => r.data.data),
    enabled: Boolean(groupId),
  })

export const useSettlement = (groupId: string, settlementId: string) =>
  useQuery({
    queryKey: settlementKeys.detail(groupId, settlementId),
    queryFn: () =>
      api
        .get<{ data: SettlementDto }>(`/groups/${groupId}/settlements/${settlementId}`)
        .then((r) => r.data.data),
    enabled: Boolean(groupId) && Boolean(settlementId),
    refetchInterval: (query) => (query.state.data?.status === 'PENDING' ? 30_000 : false),
    refetchIntervalInBackground: false,
  })

export const useSettlementPreview = (
  groupId: string,
  params: { periodStart: string; periodEnd: string } | null,
  options?: { enabled?: boolean },
) =>
  useQuery({
    queryKey: params
      ? settlementKeys.preview(groupId, params.periodStart, params.periodEnd)
      : ['settlements', groupId, 'preview', 'idle'],
    queryFn: () =>
      api
        .post<{ data: SettlementPreviewDto }>(`/groups/${groupId}/settlements/preview`, {
          periodStart: params?.periodStart,
          periodEnd: params?.periodEnd,
        })
        .then((r) => r.data.data),
    enabled:
      (options?.enabled ?? true) &&
      Boolean(groupId) &&
      Boolean(params?.periodStart) &&
      Boolean(params?.periodEnd),
  })

export const useSettlementMemberTotals = (groupId: string, startDate?: Date, endDate?: Date) =>
  useQuery({
    queryKey: settlementKeys.memberTotals(groupId, startDate?.toISOString(), endDate?.toISOString()),
    queryFn: () =>
      api
        .get<{ data: SettlementMemberTotals }>(`/groups/${groupId}/settlements/member-totals`, {
          params: {
            ...(startDate ? { startDate: startDate.toISOString() } : {}),
            ...(endDate ? { endDate: endDate.toISOString() } : {}),
          },
        })
        .then((r) => r.data.data),
    enabled: Boolean(groupId),
  })

export const useNotifySettlementPendingPayers = (groupId: string) => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (settlementId: string) =>
      api
        .post<{ data: { ok: boolean; notified: number } }>(
          `/groups/${groupId}/settlements/${settlementId}/notify-pending-payers`,
        )
        .then((r) => r.data.data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: notificationKeys.all })
    },
  })
}

export const useCreateSettlement = (groupId: string) => {
  const qc = useQueryClient()
  const router = useRouter()
  return useMutation({
    mutationFn: (data: CreateSettlementInput) =>
      api
        .post<{ data: SettlementDto }>(`/groups/${groupId}/settlements`, data)
        .then((r) => r.data.data),
    onSuccess: (s) => {
      void qc.invalidateQueries({ queryKey: settlementKeys.all(groupId) })
      void qc.invalidateQueries({ queryKey: groupKeys.detail(groupId) })
      void qc.invalidateQueries({ queryKey: expenseKeys.all(groupId) })
      void qc.invalidateQueries({ queryKey: notificationKeys.all })
      void router.push(`/groups/${groupId}/settlement/${s.id}`)
    },
  })
}

export const useConfirmPayment = (groupId: string, settlementId: string) => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ paymentRecordId, ...body }: ConfirmPaymentInput & { paymentRecordId: string }) =>
      api
        .post(
          `/groups/${groupId}/settlements/${settlementId}/payments/${paymentRecordId}/confirm`,
          body,
        )
        .then((r) => r.data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: settlementKeys.detail(groupId, settlementId) })
    },
  })
}

export const useAcceptPayment = (groupId: string, settlementId: string) => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: AcceptPaymentInput) =>
      api
        .post(`/groups/${groupId}/settlements/${settlementId}/payments/accept`, body)
        .then((r) => r.data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: settlementKeys.detail(groupId, settlementId) })
      void qc.invalidateQueries({ queryKey: expenseKeys.all(groupId) })
    },
  })
}

export const useRequestSettlementPaymentReview = (groupId: string, settlementId: string) => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (paymentRecordId: string) =>
      api
        .post<{ data: { ok: boolean; notified: number } }>(
          `/groups/${groupId}/settlements/${settlementId}/payments/${paymentRecordId}/request-review`,
        )
        .then((r) => r.data.data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: notificationKeys.all })
    },
  })
}

export const useReopenRejectedSettlementPayment = (groupId: string, settlementId: string) => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (paymentRecordId: string) =>
      api
        .post(
          `/groups/${groupId}/settlements/${settlementId}/payments/${paymentRecordId}/reopen-after-reject`,
        )
        .then((r) => r.data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: settlementKeys.detail(groupId, settlementId) })
      void qc.invalidateQueries({ queryKey: notificationKeys.all })
    },
  })
}

export const useDeleteSettlement = (groupId: string) => {
  const qc = useQueryClient()
  const router = useRouter()
  return useMutation({
    mutationFn: (settlementId: string) =>
      api.delete(`/groups/${groupId}/settlements/${settlementId}`).then((r) => r.data),
    onSuccess: (_data, settlementId) => {
      void qc.invalidateQueries({ queryKey: settlementKeys.all(groupId) })
      void qc.invalidateQueries({ queryKey: settlementKeys.detail(groupId, settlementId) })
      void qc.invalidateQueries({ queryKey: expenseKeys.all(groupId) })
      void qc.invalidateQueries({ queryKey: groupKeys.detail(groupId) })
      void qc.invalidateQueries({ queryKey: notificationKeys.all })
      if (router.pathname.includes('/settlement/') && router.query.settlementId === settlementId) {
        void router.push(`/groups/${groupId}/settlement`)
      }
    },
  })
}
