import { notificationKeys } from '@/hooks/useNotifications'
import { api } from '@/lib/api'
import type {
  CreateGroupInput,
  GroupActivityLogDto,
  GroupActivityLogFilterInput,
  GroupDto,
  GroupMembersListDto,
  MyPendingGroupInviteDto,
  PaginatedResponse,
} from '@expense/types'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/router'

export const groupKeys = {
  all: ['groups'] as const,
  lists: () => [...groupKeys.all, 'list'] as const,
  detail: (id: string) => [...groupKeys.all, 'detail', id] as const,
  members: (id: string) => [...groupKeys.all, 'members', id] as const,
  activityLogs: (id: string, filters: Partial<GroupActivityLogFilterInput>) =>
    [...groupKeys.all, 'activity', id, filters] as const,
}

function activityLogQueryParams(
  filters: Partial<GroupActivityLogFilterInput>,
): Record<string, string | number> {
  const out: Record<string, string | number> = {
    page: filters.page ?? 1,
    limit: filters.limit ?? 25,
  }
  if (filters.action) out.action = filters.action
  if (filters.targetType) out.targetType = filters.targetType
  if (filters.targetId) out.targetId = filters.targetId
  if (filters.q) out.q = filters.q
  if (filters.dateFrom) out.dateFrom = filters.dateFrom
  if (filters.dateTo) out.dateTo = filters.dateTo
  if (filters.hideStandaloneExpenses === true) out.hideStandaloneExpenses = 'true'
  return out
}

export const useGroups = () =>
  useQuery({
    queryKey: groupKeys.lists(),
    queryFn: () => api.get<{ data: GroupDto[] }>('/groups').then((r) => r.data.data),
    placeholderData: keepPreviousData,
  })

export const useGroup = (groupId: string | undefined, opts?: { enabled?: boolean }) =>
  useQuery({
    queryKey: groupKeys.detail(groupId ?? ''),
    queryFn: () => api.get<{ data: GroupDto }>(`/groups/${groupId}`).then((r) => r.data.data),
    enabled: Boolean(groupId) && opts?.enabled !== false,
  })

export const useCreateGroup = () => {
  const qc = useQueryClient()
  const router = useRouter()
  return useMutation({
    mutationFn: (data: CreateGroupInput) =>
      api.post<{ data: GroupDto }>('/groups', data).then((r) => r.data.data),
    onSuccess: (group) => {
      void qc.invalidateQueries({ queryKey: groupKeys.lists() })
      void router.push(`/groups/${group.id}`)
    },
  })
}

export const useGroupMembers = (groupId: string | undefined) =>
  useQuery({
    queryKey: groupKeys.members(groupId ?? ''),
    queryFn: () =>
      api.get<{ data: GroupMembersListDto }>(`/groups/${groupId}/members`).then((r) => r.data.data),
    enabled: Boolean(groupId),
  })

export const useMyPendingGroupInvite = (groupId: string | undefined) =>
  useQuery({
    queryKey: [...groupKeys.all, 'myInvite', groupId ?? ''] as const,
    queryFn: () =>
      api
        .get<{ data: MyPendingGroupInviteDto | null }>(`/groups/${groupId}/invites/me`)
        .then((r) => r.data.data),
    enabled: Boolean(groupId),
  })

export const useAcceptGroupInvite = (groupId: string) => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (inviteId: string) =>
      api.post(`/groups/${groupId}/invites/${inviteId}/accept`, {}).then((r) => r.data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: groupKeys.members(groupId) })
      void qc.invalidateQueries({ queryKey: [...groupKeys.all, 'myInvite', groupId] })
      void qc.invalidateQueries({ queryKey: groupKeys.lists() })
      void qc.invalidateQueries({ queryKey: groupKeys.detail(groupId) })
      void qc.invalidateQueries({ queryKey: notificationKeys.all })
    },
  })
}

export const useDeclineGroupInvite = (groupId: string) => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (inviteId: string) =>
      api.post(`/groups/${groupId}/invites/${inviteId}/decline`, {}).then((r) => r.data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: [...groupKeys.all, 'myInvite', groupId] })
      void qc.invalidateQueries({ queryKey: notificationKeys.all })
    },
  })
}

export const useCancelGroupInvite = (groupId: string) => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (inviteId: string) =>
      api.delete(`/groups/${groupId}/invites/${inviteId}`).then((r) => r.data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: groupKeys.members(groupId) })
    },
  })
}

export const useInviteMember = (groupId: string | undefined) => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: { email?: string; inviteCode?: string }) =>
      api.post(`/groups/${groupId ?? ''}/members`, data).then((r) => r.data),
    onSuccess: () => {
      if (groupId) void qc.invalidateQueries({ queryKey: groupKeys.members(groupId) })
    },
  })
}

export const useJoinByInviteCode = () => {
  const qc = useQueryClient()
  const router = useRouter()
  return useMutation({
    mutationFn: (inviteCode: string) =>
      api
        .post<{ data: { ok: boolean; groupId: string; pendingApproval?: boolean } }>(
          '/groups/join',
          { inviteCode },
        )
        .then((r) => r.data.data),
    onSuccess: (d) => {
      void qc.invalidateQueries({ queryKey: groupKeys.all })
      if (!d.pendingApproval) {
        void router.push(`/groups/${d.groupId}`)
      }
    },
  })
}

export const useUpdateGroup = (groupId: string) => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: {
      name?: string
      description?: string | null
      avatarUrl?: string | null
      icon?: string
      color?: string
      requireApproval?: boolean
      debtReminderEnabled?: boolean
      debtReminderDays?: number
    }) => api.patch<{ data: GroupDto }>(`/groups/${groupId}`, data).then((r) => r.data.data),
    onSuccess: (data) => {
      qc.setQueryData(groupKeys.detail(groupId), data)
      void qc.invalidateQueries({ queryKey: groupKeys.detail(groupId) })
      void qc.invalidateQueries({ queryKey: groupKeys.lists() })
    },
  })
}

export const useDeleteGroup = (groupId: string) => {
  const qc = useQueryClient()
  const router = useRouter()
  return useMutation({
    mutationFn: () => api.delete(`/groups/${groupId}`).then((r) => r.data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: groupKeys.all })
      void router.push('/groups')
    },
  })
}

export const useRegenerateInviteCode = (groupId: string) => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () =>
      api.post<{ data: GroupDto }>(`/groups/${groupId}/invite/regenerate`).then((r) => r.data.data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: groupKeys.detail(groupId) })
    },
  })
}

export const useToggleGroupInvite = (groupId: string) => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (enabled: boolean) =>
      api
        .patch<{ data: GroupDto }>(`/groups/${groupId}/invite/toggle`, { enabled })
        .then((r) => r.data.data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: groupKeys.detail(groupId) })
      void qc.invalidateQueries({ queryKey: groupKeys.lists() })
    },
  })
}

export const useUpsertGroupFund = (groupId: string) => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (opts: { enable?: boolean; lowThreshold?: number }) => {
      if (opts.enable) {
        return api.post(`/groups/${groupId}/fund`, {}).then((r) => r.data)
      }
      if (opts.lowThreshold != null) {
        return api
          .patch(`/groups/${groupId}/fund`, { lowThreshold: opts.lowThreshold })
          .then((r) => r.data)
      }
      return Promise.resolve({})
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: groupKeys.detail(groupId) })
      void qc.invalidateQueries({ queryKey: ['fund', groupId] })
    },
  })
}

export const useUpdateMemberRole = (groupId: string) => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (p: { memberId: string; role: 'LEADER' | 'VICE_LEADER' | 'MEMBER' }) =>
      api.patch(`/groups/${groupId}/members/${p.memberId}`, { role: p.role }).then((r) => r.data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: groupKeys.members(groupId) })
      void qc.invalidateQueries({ queryKey: groupKeys.detail(groupId) })
    },
  })
}

export const useRemoveMember = (groupId: string) => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (memberId: string) =>
      api.delete(`/groups/${groupId}/members/${memberId}`).then((r) => r.data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: groupKeys.members(groupId) })
    },
  })
}

export const useLeaveGroup = (groupId: string) => {
  const qc = useQueryClient()
  const router = useRouter()
  return useMutation({
    mutationFn: () => api.post(`/groups/${groupId}/leave`, {}).then((r) => r.data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: groupKeys.all })
      void router.push('/groups')
    },
  })
}

export const useGroupActivityLogs = (
  groupId: string,
  filters: Partial<GroupActivityLogFilterInput>,
) =>
  useQuery({
    queryKey: groupKeys.activityLogs(groupId, filters),
    queryFn: () =>
      api
        .get<{ data: PaginatedResponse<GroupActivityLogDto> }>(`/groups/${groupId}/activity-logs`, {
          params: activityLogQueryParams(filters),
        })
        .then((r) => r.data.data),
    enabled: Boolean(groupId),
    placeholderData: keepPreviousData,
  })

export const useAdminDeleteGroupActivityLogs = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (p: { groupId: string; before?: string }) =>
      api
        .delete<{ data: { ok: boolean; deleted: number } }>(
          `/admin/groups/${p.groupId}/activity-logs`,
          {
            params: p.before ? { before: p.before } : {},
          },
        )
        .then((r) => r.data.data),
    onSuccess: (_, p) => {
      void qc.invalidateQueries({ queryKey: [...groupKeys.all, 'activity', p.groupId] })
    },
  })
}

import type { GroupJoinRequestDto } from '@expense/types'

export const useGroupJoinRequests = (groupId: string | undefined, enabled = true) =>
  useQuery({
    queryKey: [...groupKeys.all, 'joinRequests', groupId ?? ''] as const,
    queryFn: () =>
      api
        .get<{ data: GroupJoinRequestDto[] }>(`/groups/${groupId}/join-requests`)
        .then((r) => r.data.data),
    enabled: Boolean(groupId) && enabled,
  })

export const useApproveJoinRequest = (groupId: string) => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (requestId: string) =>
      api.post(`/groups/${groupId}/join-requests/${requestId}/approve`, {}).then((r) => r.data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: [...groupKeys.all, 'joinRequests', groupId] })
      void qc.invalidateQueries({ queryKey: groupKeys.members(groupId) })
      void qc.invalidateQueries({ queryKey: groupKeys.detail(groupId) })
      void qc.invalidateQueries({ queryKey: groupKeys.lists() })
    },
  })
}

export const useRejectJoinRequest = (groupId: string) => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (requestId: string) =>
      api.post(`/groups/${groupId}/join-requests/${requestId}/reject`, {}).then((r) => r.data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: [...groupKeys.all, 'joinRequests', groupId] })
    },
  })
}
