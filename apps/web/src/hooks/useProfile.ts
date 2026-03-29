import { api } from '@/lib/api'
import type { UiThemeId } from '@expense/types'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

export type BankAccountRow = {
  id: string
  bankCode: string
  bankName: string
  accountNumber: string
  accountName: string
  isDefault: boolean
  createdAt: string
  /** URL xem ảnh QR (đã ký nếu bucket private). */
  qrImageUrl: string | null
}

export type MeResponse = {
  id: string
  email: string
  name: string
  avatarUrl: string | null
  role: string
  mustChangePassword: boolean
  bio: string | null
  phone: string | null
  bankAccounts: BankAccountRow[]
  createdAt: string
  /** 0 = tắt tự đăng xuất khi không hoạt động (theo cấu hình quản trị) */
  idleTimeoutMinutes: number
  uiTheme: UiThemeId
}

export const profileKeys = {
  me: ['me'] as const,
}

export type PublicUserProfile = {
  id: string
  name: string
  avatarUrl: string | null
  bio: string | null
  phone: string | null
  createdAt: string
  bankAccounts: {
    id: string
    bankCode: string
    bankName: string
    accountNumber: string
    accountName: string
    isDefault: boolean
    qrImageUrl: string | null
  }[]
}

export function useUserProfile(userId: string | null) {
  return useQuery({
    queryKey: ['users', userId],
    queryFn: () =>
      api.get<{ data: PublicUserProfile }>(`/users/${userId}`).then((r) => r.data.data),
    enabled: Boolean(userId),
  })
}

export function useMe(options?: { enabled?: boolean; staleTime?: number }) {
  return useQuery({
    queryKey: profileKeys.me,
    queryFn: () => api.get<{ data: MeResponse }>('/users/me').then((r) => r.data.data),
    enabled: options?.enabled ?? true,
    ...(options?.staleTime !== undefined ? { staleTime: options.staleTime } : {}),
  })
}

export function usePatchMe() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: {
      name?: string
      avatarUrl?: string | null
      bio?: string | null
      phone?: string | null
      uiTheme?: UiThemeId
    }) => api.patch<{ data: MeResponse }>('/users/me', body).then((r) => r.data.data),
    onSuccess: (data) => {
      qc.setQueryData(profileKeys.me, data)
      void qc.invalidateQueries({ queryKey: profileKeys.me })
    },
  })
}

export function useChangePassword() {
  return useMutation({
    mutationFn: (body: { currentPassword: string; newPassword: string }) =>
      api.post('/users/me/change-password', body).then((r) => r.data),
  })
}

export function useCreateBank() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: {
      bankCode: string
      accountNumber: string
      accountName: string
      isDefault?: boolean
      qrImageUrl?: string
    }) => api.post<{ data: BankAccountRow }>('/users/me/banks', body).then((r) => r.data.data),
    onSuccess: () => void qc.invalidateQueries({ queryKey: profileKeys.me }),
  })
}

export function usePatchBank() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (p: {
      bankId: string
      body: Partial<{
        bankCode: string
        accountNumber: string
        accountName: string
        isDefault: boolean
        qrImageUrl: string | null
      }>
    }) =>
      api.patch<{ data: BankAccountRow }>(`/users/me/banks/${p.bankId}`, p.body).then((r) => r.data.data),
    onSuccess: () => void qc.invalidateQueries({ queryKey: profileKeys.me }),
  })
}

export function useDeleteBank() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (bankId: string) => api.delete(`/users/me/banks/${bankId}`).then((r) => r.data),
    onSuccess: () => void qc.invalidateQueries({ queryKey: profileKeys.me }),
  })
}
