import { groupKeys } from '@/hooks/useGroup'
import { notificationKeys } from '@/hooks/useNotifications'
import { api } from '@/lib/api'
import type {
  CommentDto,
  CreateExpenseInput,
  ExpenseDto,
  ExpenseFilterInput,
  ExpenseHistoryEntryDto,
  PaginatedResponse,
  PaymentRecordDto,
  UpdateExpenseInput,
} from '@expense/types'
import type { QueryClient } from '@tanstack/react-query'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/router'

export const expenseKeys = {
  all: (groupId: string) => ['expenses', groupId] as const,
  list: (groupId: string, filters: Partial<ExpenseFilterInput>) =>
    [...expenseKeys.all(groupId), 'list', filters] as const,
  detail: (groupId: string, expenseId: string) =>
    [...expenseKeys.all(groupId), 'detail', expenseId] as const,
  comments: (groupId: string, expenseId: string) =>
    [...expenseKeys.all(groupId), 'comments', expenseId] as const,
}

/** Ghi đè dòng chi trong mọi cache list (mọi filter/trang) để UI cập nhật ngay, không phụ thuộc refetch. */
function patchExpenseInGroupListCaches(qc: QueryClient, groupId: string, updated: ExpenseDto) {
  qc.setQueriesData(
    {
      predicate: (q) => {
        const k = q.queryKey
        return (
          Array.isArray(k) &&
          k.length >= 3 &&
          k[0] === 'expenses' &&
          k[1] === groupId &&
          k[2] === 'list'
        )
      },
    },
    (old: unknown) => {
      if (!old || typeof old !== 'object' || !('data' in old)) return old
      const page = old as PaginatedResponse<ExpenseDto>
      if (!Array.isArray(page.data)) return old
      const idx = page.data.findIndex((e) => e.id === updated.id)
      if (idx === -1) return old
      const data = page.data.slice()
      data[idx] = updated
      return { ...page, data }
    },
  )
}

/** Gọi ngay sau PATCH thành công (vd. trong form) — trước onDone/đóng drawer để không cần F5. */
export async function syncCachesAfterExpenseUpdate(
  qc: QueryClient,
  groupId: string,
  expenseId: string,
  data: ExpenseDto,
) {
  qc.setQueryData(expenseKeys.detail(groupId, expenseId), data)
  patchExpenseInGroupListCaches(qc, groupId, data)
  /**
   * KHÔNG invalidate query chi tiết `['expenses', groupId, 'detail', expenseId]`:
   * invalidate theo `expenseKeys.all` sẽ refetch GET và ghi đè `setQueryData` (SW/cache cũ / race)
   * → mở lại drawer seed form từ bản thiếu paidBy/category → Select trống.
   */
  await qc.invalidateQueries({
    predicate: (q) => {
      const k = q.queryKey
      if (!Array.isArray(k) || k[0] !== 'expenses' || k[1] !== groupId) return false
      if (k[2] === 'detail' && k[3] === expenseId && k.length === 4) return false
      return true
    },
    refetchType: 'all',
  })
  await qc.invalidateQueries({ queryKey: groupKeys.detail(groupId), refetchType: 'all' })
  await qc.invalidateQueries({ queryKey: groupKeys.usedTags(groupId), refetchType: 'all' })
  await qc.invalidateQueries({ queryKey: ['standalone', groupId, expenseId], refetchType: 'all' })
}

export const useCategories = (groupId?: string) =>
  useQuery({
    queryKey: ['categories', groupId ?? ''],
    queryFn: () => {
      const q = groupId ? `?groupId=${encodeURIComponent(groupId)}` : ''
      return api
        .get<{
          data: {
            id: string
            name: string
            icon: string | null
            color: string | null
            isSystem: boolean
          }[]
        }>(`/categories${q}`)
        .then((r) => r.data.data)
    },
  })

/** Gửi query chuỗi rõ ràng — tránh client/axios làm mất cờ boolean. */
function expenseListQueryParams(
  filters: Partial<ExpenseFilterInput>,
): Record<string, string | number> {
  const out: Record<string, string | number> = {
    page: filters.page ?? 1,
    limit: filters.limit ?? 20,
  }
  if (filters.dateFrom) out.dateFrom = filters.dateFrom
  if (filters.dateTo) out.dateTo = filters.dateTo
  if (filters.categoryId) out.categoryId = filters.categoryId
  if (filters.paidByUserId) out.paidByUserId = filters.paidByUserId
  if (filters.status) out.status = filters.status
  if (filters.includeDeleted === true) out.includeDeleted = 'true'
  if (filters.includeDeleted === false) out.includeDeleted = 'false'
  if (filters.deletedOnly === true) out.deletedOnly = 'true'
  if (filters.isStandalone === true) out.isStandalone = 'true'
  if (filters.isStandalone === false) out.isStandalone = 'false'
  if (filters.standaloneIncomplete === true) out.standaloneIncomplete = 'true'
  if (filters.settlementId) out.settlementId = filters.settlementId
  return out
}

export const useExpenses = (groupId: string, filters: Partial<ExpenseFilterInput>) =>
  useQuery({
    queryKey: expenseKeys.list(groupId, filters),
    queryFn: () =>
      api
        .get<{ data: PaginatedResponse<ExpenseDto> }>(`/groups/${groupId}/expenses`, {
          params: expenseListQueryParams(filters),
        })
        .then((r) => r.data.data),
    enabled: Boolean(groupId),
  })

export const useExpense = (groupId: string, expenseId: string, opts?: { staleTime?: number }) =>
  useQuery({
    queryKey: expenseKeys.detail(groupId, expenseId),
    queryFn: () =>
      api
        .get<{ data: ExpenseDto }>(`/groups/${groupId}/expenses/${expenseId}`)
        .then((r) => r.data.data),
    enabled: Boolean(groupId) && Boolean(expenseId),
    ...(opts?.staleTime !== undefined ? { staleTime: opts.staleTime } : {}),
  })

export const useCreateExpense = (groupId: string) => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: CreateExpenseInput) =>
      api.post<{ data: ExpenseDto }>(`/groups/${groupId}/expenses`, data).then((r) => r.data.data),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: expenseKeys.all(groupId), refetchType: 'all' })
      await qc.invalidateQueries({ queryKey: groupKeys.detail(groupId), refetchType: 'all' })
      await qc.invalidateQueries({ queryKey: groupKeys.usedTags(groupId), refetchType: 'all' })
    },
  })
}

export const useUpdateExpense = (groupId: string, expenseId: string) =>
  useMutation({
    mutationFn: (data: UpdateExpenseInput) =>
      api
        .patch<{ data: ExpenseDto }>(`/groups/${groupId}/expenses/${expenseId}`, data)
        .then((r) => r.data.data),
  })

export const useDeleteExpense = (groupId: string) => {
  const qc = useQueryClient()
  const router = useRouter()
  return useMutation({
    mutationFn: (expenseId: string) => api.delete(`/groups/${groupId}/expenses/${expenseId}`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: expenseKeys.all(groupId) })
      void qc.invalidateQueries({ queryKey: groupKeys.usedTags(groupId) })
      void router.push(`/groups/${groupId}/expenses`)
    },
  })
}

export const useRestoreExpense = (groupId: string) => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (expenseId: string) =>
      api.post(`/groups/${groupId}/expenses/${expenseId}/restore`).then((r) => r.data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: expenseKeys.all(groupId) })
      void qc.invalidateQueries({ queryKey: groupKeys.detail(groupId) })
      void qc.invalidateQueries({ queryKey: groupKeys.usedTags(groupId) })
      void qc.invalidateQueries({ queryKey: notificationKeys.all })
    },
  })
}

export const useComments = (groupId: string, expenseId: string) =>
  useQuery({
    queryKey: expenseKeys.comments(groupId, expenseId),
    queryFn: () =>
      api
        .get<{ data: CommentDto[] }>(`/groups/${groupId}/expenses/${expenseId}/comments`)
        .then((r) => r.data.data),
    enabled: Boolean(groupId) && Boolean(expenseId),
  })

export const useAddComment = (groupId: string, expenseId: string) => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: { content: string; imageUrls: string[] }) =>
      api.post(`/groups/${groupId}/expenses/${expenseId}/comments`, data).then((r) => r.data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: expenseKeys.comments(groupId, expenseId) })
      void qc.invalidateQueries({ queryKey: expenseKeys.detail(groupId, expenseId) })
    },
  })
}

export const useDeleteComment = (groupId: string, expenseId: string) => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (commentId: string) =>
      api
        .delete(`/groups/${groupId}/expenses/${expenseId}/comments/${commentId}`)
        .then((r) => r.data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: expenseKeys.comments(groupId, expenseId) })
      void qc.invalidateQueries({ queryKey: expenseKeys.detail(groupId, expenseId) })
    },
  })
}

export const useExpenseAudit = (groupId: string, expenseId: string, enabled: boolean) =>
  useQuery({
    queryKey: [...expenseKeys.detail(groupId, expenseId), 'audit'],
    queryFn: () =>
      api
        .get<{ data: ExpenseHistoryEntryDto[] }>(`/groups/${groupId}/expenses/${expenseId}/audit`)
        .then((r) => r.data.data),
    enabled: Boolean(groupId) && Boolean(expenseId) && enabled,
  })

export interface StandaloneState {
  expense: ExpenseDto
  records: PaymentRecordDto[]
  standaloneStatus: string
  allAccepted: boolean
}

export const useStandaloneState = (groupId: string, expenseId: string, enabled: boolean) =>
  useQuery({
    queryKey: ['standalone', groupId, expenseId],
    queryFn: () =>
      api
        .get<{ data: StandaloneState }>(`/groups/${groupId}/expenses/${expenseId}/standalone`)
        .then((r) => r.data.data),
    enabled: Boolean(groupId) && Boolean(expenseId) && enabled,
  })

export const useConfirmStandalonePayment = (groupId: string, expenseId: string) => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (p: { paymentRecordId: string; proofImageUrls: string[]; comment?: string }) =>
      api
        .post(
          `/groups/${groupId}/expenses/${expenseId}/standalone/payments/${p.paymentRecordId}/confirm`,
          { proofImageUrls: p.proofImageUrls, comment: p.comment },
        )
        .then((r) => r.data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['standalone', groupId, expenseId] })
      void qc.invalidateQueries({ queryKey: expenseKeys.all(groupId) })
    },
  })
}

export const useAcceptStandalonePayment = (groupId: string, expenseId: string) => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (p: { paymentRecordId: string; accepted: boolean; comment?: string }) =>
      api
        .post(`/groups/${groupId}/expenses/${expenseId}/standalone/payments/accept`, {
          paymentRecordId: p.paymentRecordId,
          accepted: p.accepted,
          comment: p.comment,
        })
        .then((r) => r.data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['standalone', groupId, expenseId] })
      void qc.invalidateQueries({ queryKey: expenseKeys.all(groupId) })
    },
  })
}

export const useRequestStandalonePaymentReview = (groupId: string, expenseId: string) => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (paymentRecordId: string) =>
      api
        .post<{ data: { ok: boolean; notified: number } }>(
          `/groups/${groupId}/expenses/${expenseId}/standalone/payments/${paymentRecordId}/request-review`,
        )
        .then((r) => r.data.data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: notificationKeys.all })
    },
  })
}

/** Người nhận / trưởng nhóm nhắc người trả chuyển tiền (PENDING). */
export const useNotifyStandalonePayer = (groupId: string, expenseId: string) => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (paymentRecordId: string) =>
      api
        .post<{ data: { ok: boolean; notified: number } }>(
          `/groups/${groupId}/expenses/${expenseId}/standalone/payments/${paymentRecordId}/notify-payer`,
        )
        .then((r) => r.data.data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: notificationKeys.all })
    },
  })
}

export const useReopenRejectedStandalonePayment = (groupId: string, expenseId: string) => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (paymentRecordId: string) =>
      api
        .post(
          `/groups/${groupId}/expenses/${expenseId}/standalone/payments/${paymentRecordId}/reopen-after-reject`,
        )
        .then((r) => r.data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['standalone', groupId, expenseId] })
      void qc.invalidateQueries({ queryKey: expenseKeys.all(groupId) })
      void qc.invalidateQueries({ queryKey: notificationKeys.all })
    },
  })
}
