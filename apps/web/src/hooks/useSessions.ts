import { api } from '@/lib/api'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { signOut } from 'next-auth/react'

export type SessionRow = {
  id: string
  deviceLabel: string | null
  userAgent: string | null
  ipAddress: string | null
  createdAt: string
  isCurrent: boolean
}

export const sessionKeys = {
  list: ['me', 'sessions'] as const,
}

export function useSessions(enabled: boolean) {
  return useQuery({
    queryKey: sessionKeys.list,
    queryFn: () => api.get<{ data: SessionRow[] }>('/users/me/sessions').then((r) => r.data.data),
    enabled,
  })
}

export function useRevokeSession() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (sessionId: string) =>
      api
        .delete<{ data: { ok: boolean; wasCurrent: boolean } }>(`/users/me/sessions/${sessionId}`)
        .then((r) => r.data.data),
    onSuccess: async (data) => {
      await qc.invalidateQueries({ queryKey: sessionKeys.list })
      if (data.wasCurrent) {
        await signOut({ callbackUrl: '/auth/login?reason=session' })
      }
    },
  })
}
