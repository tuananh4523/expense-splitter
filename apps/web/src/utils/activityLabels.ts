/** Nhãn tiếng Việt cho mã hành động lưu trong log (thay ký hiệu kỹ thuật trên UI). */
export function groupActivityActionVi(code: string): string {
  const m: Record<string, string> = {
    EXPENSE_CREATED: 'Tạo chi tiêu',
    EXPENSE_UPDATED: 'Cập nhật chi tiêu',
    EXPENSE_DELETED: 'Xóa chi tiêu',
    MEMBER_JOINED_INVITE: 'Tham gia nhóm (mã mời)',
    MEMBER_INVITED: 'Gửi lời mời email (chờ xác nhận)',
    MEMBER_REMOVED: 'Gỡ thành viên',
    MEMBER_LEFT: 'Rời nhóm',
    MEMBER_ROLE_CHANGED: 'Đổi vai trò thành viên',
    FUND_ENABLED: 'Bật quỹ nhóm',
    FUND_THRESHOLD_UPDATED: 'Cập nhật ngưỡng cảnh báo quỹ',
    FUND_CONTRIBUTED: 'Nộp quỹ',
    FUND_CONTRIBUTION_PENDING: 'Gửi nộp quỹ (chờ duyệt)',
    FUND_CONTRIBUTION_APPROVED: 'Duyệt nộp quỹ',
    FUND_CONTRIBUTION_REJECTED: 'Từ chối nộp quỹ',
    INVITE_CODE_REGENERATED: 'Tạo lại mã mời',
    INVITE_TOGGLED: 'Bật/tắt mã mời',
    GROUP_UPDATED: 'Cập nhật thông tin nhóm',
    SETTLEMENT_CREATED: 'Tạo đợt tổng kết',
    SETTLEMENT_COMPLETED: 'Đóng đợt tổng kết',
    SETTLEMENT_DELETED: 'Xoá đợt tổng kết',
    GROUP_INVITE_ACCEPTED: 'Chấp nhận lời mời',
    GROUP_INVITE_DECLINED: 'Từ chối lời mời',
    GROUP_INVITE_CANCELLED: 'Huỷ lời mời',
  }
  return m[code] ?? code
}

export function groupActivityTargetTypeVi(t: string | null | undefined): string {
  if (!t) return ''
  const m: Record<string, string> = {
    EXPENSE: 'Chi tiêu',
    MEMBER: 'Thành viên',
    SETTLEMENT: 'Tổng kết',
    FUND: 'Quỹ',
    GROUP: 'Nhóm',
  }
  return m[t] ?? t
}
