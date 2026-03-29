import { api } from '@/lib/api'
import type { NotificationDto, PaginatedResponse } from '@expense/types'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

export const notificationKeys = {
  all: ['notifications'] as const,
  list: (filters: Record<string, unknown>) => [...notificationKeys.all, 'list', filters] as const,
  unread: () => [...notificationKeys.all, 'unread'] as const,
}

export const useNotifications = (
  filters: { page?: number; limit?: number } = {},
  options?: { enabled?: boolean },
) =>
  useQuery({
    queryKey: notificationKeys.list(filters),
    queryFn: () =>
      api
        .get<{ data: PaginatedResponse<NotificationDto> }>('/notifications', { params: filters })
        .then((r) => r.data.data),
    enabled: options?.enabled ?? true,
  })

export const useUnreadCount = () =>
  useQuery({
    queryKey: notificationKeys.unread(),
    queryFn: () =>
      api.get<{ data: { count: number } }>('/notifications/unread-count').then((r) => r.data.data),
    refetchInterval: 60_000,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
  })

export const useMarkRead = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: { id?: string; markAll?: boolean }) =>
      api.patch('/notifications/read', payload).then((r) => r.data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: notificationKeys.all })
    },
  })
}
