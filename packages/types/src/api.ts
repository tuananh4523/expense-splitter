// Shared API response shapes — used by both api (Hono) and web (React Query)

export interface ApiSuccess<T> {
  data: T
}

export interface ApiError {
  error: string
  /** Máy khách có thể xử lý đặc biệt (vd. ACCOUNT_DISABLED → đăng xuất) */
  code?: string
  details?: unknown
}

export interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  totalPages: number
  limit: number
}

// ── Domain DTOs (safe for HTTP — no passwordHash) ──

export interface UserDto {
  id: string
  email: string
  name: string
  avatarUrl: string | null
  role: string
  createdAt: string
}

export interface GroupDto {
  id: string
  name: string
  description: string | null
  avatarUrl: string | null
  icon: string | null
  color: string | null
  inviteCode: string
  inviteEnabled: boolean
  inviteExpires: string | null
  /** Nhóm còn hoạt động hay bị quản trị tạm khóa. */
  isActive: boolean
  requireApproval: boolean
  memberCount: number
  myRole: string
  fundBalance: string | null
  createdAt: string
  /** true khi quản trị viên xem nhóm nhưng không phải thành viên (chỉ đọc). */
  adminViewer?: boolean
  /** Ước tính: đã trả + quỹ − phần chia (âm). Chỉ khi là thành viên; không gửi khi adminViewer. */
  myUnsettledDebt?: string
  /** Cùng công thức (dương). Chỉ khi là thành viên; không gửi khi adminViewer. */
  myUnsettledCredit?: string
}

export interface MemberDto {
  id: string
  userId: string
  groupId: string
  role: string
  nickname: string | null
  isActive: boolean
  joinedAt: string
  user: Pick<UserDto, 'id' | 'name' | 'email' | 'avatarUrl'>
  /** Đã trả + quỹ − phần chia (khoản chung). GET /groups/:id/members. */
  netBalance?: string
  /** Tổng tiền bill khi thành viên là người trả (gồm cả phần người khác trên bill). */
  sharedPaidTotal?: string
  /** Tổng phần chia bill gán cho thành viên. */
  sharedOwedTotal?: string
  /** Đã nộp quỹ (duyệt) − đã trừ quỹ; cộng vào cột chênh. */
  fundContributedApproved?: string
}

/** Lời mời qua email chờ người được mời xác nhận. */
export interface PendingGroupInviteDto {
  id: string
  groupId: string
  inviteeUserId: string
  invitedByUserId: string
  createdAt: string
  invitee: Pick<UserDto, 'id' | 'name' | 'email' | 'avatarUrl'>
  invitedBy: Pick<UserDto, 'id' | 'name' | 'email'>
}

export interface GroupJoinRequestDto {
  id: string
  groupId: string
  userId: string
  status: string
  createdAt: string
  user: Pick<UserDto, 'id' | 'name' | 'email' | 'avatarUrl'>
}

export interface GroupMembersListDto {
  members: MemberDto[]
  /** Chỉ trưởng nhóm mới nhận danh sách; thành viên khác luôn []. */
  pendingInvites: PendingGroupInviteDto[]
}

/** Gợi ý người để mời vào nhóm (tìm theo tên/email). */
export interface GroupInviteSearchUserDto {
  id: string
  email: string
  name: string
  avatarUrl: string | null
}

/** Lời mời PENDING của chính user (màn xác nhận, không cần đã vào nhóm). */
export interface MyPendingGroupInviteDto {
  invite: { id: string; groupId: string; createdAt: string }
  group: { id: string; name: string }
  inviter: { name: string; email: string }
}

export interface SplitDto {
  userId: string
  amount: string
  percentage: string | null
  isExcluded: boolean
  user: Pick<UserDto, 'id' | 'name' | 'avatarUrl'>
}

export interface ExpenseDto {
  id: string
  groupId: string
  title: string
  description: string | null
  amount: string // Decimal serialized as string
  currency: string
  splitType: string
  status: string
  isStandalone: boolean
  expenseDate: string
  tags: string[]
  imageUrls: string[]
  category: { id: string; name: string; icon: string | null } | null
  paidBy: Pick<UserDto, 'id' | 'name' | 'avatarUrl'>
  /** Người tạo bản ghi (audit EXPENSE_CREATED); null nếu không còn lịch sử. */
  createdBy: Pick<UserDto, 'id' | 'name' | 'avatarUrl'> | null
  splits: SplitDto[]
  commentCount: number
  createdAt: string
  /** Đợt tổng kết đang khóa khoản này (null = chưa gắn đợt mở) */
  settlementId: string | null
  /** Danh sách: user hiện tại còn việc với thanh toán riêng (chưa ACCEPTED / cần duyệt) */
  standaloneAttention?: boolean
}

export interface CommentDto {
  id: string
  content: string
  imageUrls: string[]
  isEdited: boolean
  createdAt: string
  user: Pick<UserDto, 'id' | 'name' | 'avatarUrl'>
}

export interface SettlementDto {
  id: string
  groupId: string
  title: string
  periodStart: string
  periodEnd: string
  totalAmount: string
  /** Tổng tiền các khoản chi chung trong kỳ (cộng từng bill). Khác totalAmount (tổng luồng chuyển). */
  periodExpensesTotal: string
  status: string
  summaryData: SettlementSummary
  receiver: Pick<UserDto, 'id' | 'name' | 'avatarUrl'>
  paymentRecords: PaymentRecordDto[]
  completedAt: string | null
  createdAt: string
  /**
   * Chỉ khi GET chi tiết đợt: chi chung trong đợt (ưu tiên DB, fallback bản lưu trong summaryData).
   */
  settlementExpenses?: SettlementExpenseInBatchDto[]
}

export interface SettlementSummary {
  balances: MemberBalance[]
  transactions: Transfer[]
  /** Snapshot lúc tạo đợt — dùng khi không còn liên kết expense.settlementId (dữ liệu cũ). */
  expenses?: SettlementPreviewExpenseItem[]
  /** Tổng tiền chi chung trong kỳ (cộng bill). Đợt cũ có thể thiếu — client tính lại từ expenses. */
  periodExpensesTotal?: string
}

/** Một dòng chi trong đợt (API chi tiết tổng kết). */
export interface SettlementExpenseInBatchDto extends SettlementPreviewExpenseItem {
  /** Có khi lấy từ DB (ACTIVE / SETTLED). Snapshot cũ có thể không có. */
  status?: string
  /** true = từ DB hiện tại; false = chỉ còn bản lưu trong summaryData */
  fromLiveDb?: boolean
}

export interface MemberBalance {
  userId: string
  userName: string
  /** Tổng bill do người này trả (trong kỳ). */
  totalPaid: string
  /** Tổng phần chia bill gán cho người này (trong kỳ). */
  totalOwed: string
  /**
   * Nộp quỹ đã duyệt − khấu trừ quỹ, chỉ giao dịch có ngày trong kỳ tổng kết (reviewedAt / createdAt).
   * Cộng vào netBalance — trừ nợ bill trước khi tính ai trả ai.
   */
  fundNetInPeriod?: string
  /** totalPaid − totalOwed + fundNetInPeriod (fundNet mặc định 0 nếu thiếu). */
  netBalance: string // positive = creditor, negative = debtor
}

export interface Transfer {
  fromUserId: string
  toUserId: string
  amount: string
}

export interface PaymentRecordDto {
  id: string
  payerUserId: string
  receiverUserId: string
  amount: string
  status: string
  proofImageUrls: string[]
  payerComment: string | null
  leaderComment: string | null
  confirmedAt: string | null
  acceptedAt: string | null
  rejectedAt: string | null
  payer: Pick<UserDto, 'id' | 'name' | 'avatarUrl'>
  receiver: Pick<UserDto, 'id' | 'name' | 'avatarUrl'>
}

export interface FundDto {
  id: string
  groupId: string
  balance: string
  lowThreshold: string
  transactions: FundTransactionDto[]
}

export type FundContributionStatusDto = 'PENDING' | 'APPROVED' | 'REJECTED'

export interface FundTransactionDto {
  id: string
  type: string
  amount: string
  note: string | null
  createdAt: string
  user: Pick<UserDto, 'id' | 'name' | 'avatarUrl'>
  /** Chỉ CONTRIBUTE; null với DEDUCT/REFUND. */
  contributionStatus: FundContributionStatusDto | null
  proofImageUrls: string[]
  reviewedAt: string | null
  reviewNote: string | null
  reviewedBy: Pick<UserDto, 'id' | 'name'> | null
}

export interface AuditLogDto {
  id: string
  action: string
  createdAt: string
  user: Pick<UserDto, 'id' | 'name'>
}

/** Lịch sử nhóm — snapshot người thực hiện, không phụ thuộc FK user/expense sau khi xoá. */
export interface GroupActivityLogDto {
  id: string
  groupId: string
  actorUserId: string | null
  actorName: string
  actorEmail: string
  action: string
  summary: string
  targetType: string | null
  targetId: string | null
  metadata: Record<string, unknown> | null
  createdAt: string
}

/** Dòng hợp nhất: log nhóm (chi tiết) + bản ghi audit cũ nếu có. */
export interface ExpenseHistoryEntryDto {
  id: string
  source: 'group_activity' | 'audit_legacy'
  action: string
  summary: string
  actorName: string
  actorEmail: string
  actorUserId: string | null
  createdAt: string
}

/** Một đợt gửi thông báo hệ thống (gom theo broadcastId). */
export interface AdminBroadcastHistoryItemDto {
  broadcastId: string
  title: string
  body: string
  sentAt: string
  recipientCount: number
}

/** Người nhận trong một đợt broadcast (mở rộng dòng lịch sử). */
export interface AdminBroadcastRecipientDto {
  userId: string
  name: string
  email: string
}

export interface NotificationDto {
  id: string
  type: string
  title: string
  body: string
  isRead: boolean
  data: Record<string, unknown> | null
  /** Cùng giá trị cho mọi user trong một đợt thông báo hệ thống (nếu có). */
  broadcastId: string | null
  createdAt: string
}

/** Chi tiêu chung (ACTIVE, không chi riêng) nằm trong kỳ tổng kết — dùng khi xem trước trước khi tạo đợt. */
export interface SettlementPreviewExpenseItem {
  id: string
  title: string
  amount: string
  expenseDate: string
  paidBy: Pick<UserDto, 'id' | 'name'>
}

export interface SettlementPreviewDto {
  balances: MemberBalance[]
  transactions: Transfer[]
  suggestedReceiver: Pick<UserDto, 'id' | 'name'>
  /** User id được phép làm người nhận quỹ (tham gia chi hoặc luồng chuyển trong kỳ); kỳ không có chi thì = mọi participant. */
  receiverCandidateUserIds: string[]
  totalAmount: string
  /** Tổng tiền các khoản chi chung trong kỳ (cộng từng bill). */
  periodExpensesTotal: string
  expenseCount: number
  expenses: SettlementPreviewExpenseItem[]
}

export interface AuthResponseDto {
  token: string
  user: UserDto
}

export interface PresignResponseDto {
  uploadUrl: string
  objectName: string
  viewUrl: string
}
