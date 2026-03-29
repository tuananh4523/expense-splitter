import type { NotificationDto } from '@expense/types'

/** Đích điều hướng khi người dùng mở một thông báo (dropdown + trang danh sách). */
export function getNotificationTargetPath(item: NotificationDto): string | undefined {
  const data = item.data ?? {}
  const groupId = typeof data.groupId === 'string' ? data.groupId : undefined
  const settlementId = typeof data.settlementId === 'string' ? data.settlementId : undefined
  const expenseId = typeof data.expenseId === 'string' ? data.expenseId : undefined

  if (item.type === 'GROUP_INVITE' && groupId) {
    return `/join?group=${encodeURIComponent(groupId)}`
  }
  if (groupId && settlementId) {
    return `/groups/${groupId}/settlement/${settlementId}`
  }
  if (groupId && expenseId) {
    return `/groups/${groupId}/expenses?openStandalone=${expenseId}`
  }
  if (item.type === 'FUND_CONTRIBUTED' && groupId) {
    return `/groups/${groupId}/fund`
  }
  if (groupId) {
    return `/groups/${groupId}`
  }
  if (item.type === 'SYSTEM_ANNOUNCEMENT') {
    return '/notifications'
  }
  return undefined
}
