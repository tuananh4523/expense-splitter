import { z } from 'zod'
import { MAX_IMAGE_UPLOAD_BYTES } from './uploadLimits.js'

// ── Auth ─────────────────────────────────────────
export const registerSchema = z.object({
  email: z.string().email('Email không hợp lệ'),
  name: z.string().min(2, 'Tên tối thiểu 2 ký tự').max(100),
  password: z.string().min(6, 'Mật khẩu tối thiểu 6 ký tự'),
})

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})

/** Quản trị cấp mật khẩu mới cho user (POST /admin/users/:id/reset-password) */
export const adminSetUserPasswordSchema = z.object({
  newPassword: z.string().min(6, 'Mật khẩu tối thiểu 6 ký tự').max(128),
})

/** Quản trị tạo tài khoản (POST /admin/users) */
export const adminCreateUserSchema = z.object({
  email: z.string().email('Email không hợp lệ'),
  name: z.string().min(2, 'Tên tối thiểu 2 ký tự').max(100),
  password: z.string().min(6, 'Mật khẩu tối thiểu 6 ký tự').max(128),
  role: z.enum(['ADMIN', 'USER']).default('USER'),
})

/** 0 = tắt; tối đa 7 ngày (phút) */
export const patchSystemSettingsSchema = z.object({
  idleTimeoutMinutes: z.number().int().min(0).max(10080),
})

/** Gửi thông báo toàn hệ thống (POST /admin/broadcast) — mặc định mọi user hoạt động, trừ excludeUserIds */
export const adminBroadcastSchema = z.object({
  title: z.string().min(1, 'Nhập tiêu đề').max(200),
  body: z.string().min(1, 'Nhập nội dung').max(10000),
  excludeUserIds: z.array(z.string().min(1)).max(5000).default([]),
})

// ── Group ────────────────────────────────────────
export const createGroupSchema = z.object({
  name: z.string().min(2).max(100),
  description: z.string().max(500).optional(),
  icon: z.string().max(120).optional(),
  color: z.string().max(32).optional(),
})

export const updateGroupSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  description: z.string().max(500).optional().nullable(),
  avatarUrl: z.string().max(2000).optional().nullable(),
  icon: z.string().max(120).optional().nullable(),
  color: z.string().max(32).optional().nullable(),
})

export const updateGroupFundSchema = z.object({
  lowThreshold: z.number().nonnegative(),
})

export const updateMemberRoleSchema = z.object({
  role: z.enum(['LEADER', 'VICE_LEADER', 'MEMBER']),
})

export const inviteMemberSchema = z
  .object({
    email: z.string().email().optional(),
    inviteCode: z.string().optional(),
  })
  .refine((d) => Boolean(d.email ?? d.inviteCode), 'Cần email hoặc invite code')

// ── Expense ──────────────────────────────────────

/** Select mode=tags có thể trả (string|number)[]; bỏ rỗng, giới hạn độ dài / số lượng. */
export function normalizeExpenseTags(val: unknown): string[] {
  if (val == null) return []
  const raw = Array.isArray(val) ? val : []
  const seen = new Set<string>()
  const out: string[] = []
  for (const item of raw) {
    const s = (typeof item === 'string' ? item : String(item ?? '')).trim().slice(0, 80)
    if (!s) continue
    const k = s.toLowerCase()
    if (seen.has(k)) continue
    seen.add(k)
    out.push(s)
    if (out.length >= 50) break
  }
  return out
}

export const expenseTagsField = z
  .any()
  .transform((v) => normalizeExpenseTags(v))
  .pipe(z.array(z.string().max(80)).max(50))

export const splitItemSchema = z.object({
  userId: z.string().cuid(),
  amount: z.number().nonnegative().optional(),
  percentage: z.number().min(0).max(100).optional(),
  isExcluded: z.boolean().default(false),
})

/** POST: chuỗi rỗng từ Select clear → bỏ danh mục (giống undefined). */
const categoryIdForCreate = z.preprocess(
  (val) => (val === '' ? undefined : val),
  z.string().cuid().optional(),
)

/** PATCH: '' hoặc null → gỡ danh mục; bỏ field → không đổi. */
const categoryIdForUpdate = z.preprocess(
  (val) => {
    if (val === '') return null
    return val
  },
  z.union([z.string().cuid(), z.null()]).optional(),
)

export const createExpenseSchema = z.object({
  title: z.string().min(1).max(200),
  amount: z.number().positive().max(999_999_999),
  /** Thành viên nhóm thực tế chi tiền; mặc định phía API là người gọi nếu không gửi. */
  paidByUserId: z.string().cuid().optional(),
  categoryId: categoryIdForCreate,
  splitType: z.enum(['EQUAL', 'UNEQUAL', 'PERCENTAGE']),
  splits: z.array(splitItemSchema).optional(),
  expenseDate: z.string().datetime(),
  tags: expenseTagsField,
  imageUrls: z.array(z.string().min(1)).default([]),
  isStandalone: z.boolean().default(false),
  description: z.string().max(1000).optional(),
  useGroupFund: z.boolean().default(false),
  recurringDays: z.number().int().min(1).max(365).optional(),
})

export const updateExpenseSchema = createExpenseSchema.partial().extend({
  categoryId: categoryIdForUpdate,
})

export const addCommentSchema = z.object({
  content: z.string().min(1).max(2000),
  imageUrls: z.array(z.string().min(1)).default([]),
})

// ── Settlement ───────────────────────────────────
export const createSettlementSchema = z.object({
  title: z.string().min(1).max(200),
  periodStart: z.string().datetime(),
  periodEnd: z.string().datetime(),
  receiverUserId: z.string().cuid(),
})

export const confirmPaymentSchema = z.object({
  proofImageUrls: z.array(z.string().min(1)).min(1, 'Cần ít nhất 1 ảnh xác nhận'),
  comment: z.string().max(500).optional(),
})

export const acceptPaymentSchema = z.object({
  paymentRecordId: z.string().cuid(),
  accepted: z.boolean(),
  comment: z.string().max(500).optional(),
})

// ── Fund ─────────────────────────────────────────
export const contributeFundSchema = z.object({
  amount: z.number().positive().max(999_999_999),
  note: z.string().max(200).optional(),
  proofImageUrls: z.array(z.string().url()).min(1, 'Cần ít nhất một ảnh chứng từ'),
})

export const rejectFundContributionSchema = z.object({
  note: z.string().max(500).optional(),
})

// ── Upload ───────────────────────────────────────
export const presignUploadSchema = z
  .object({
    filename: z.string().min(1).max(200),
    contentType: z.enum(['image/jpeg', 'image/png', 'image/webp', 'image/heic']),
    groupId: z.string().cuid().optional(),
    uploadType: z.enum(['expense', 'payment', 'avatar', 'feedback', 'bankQr']),
    fileSizeBytes: z.number().int().positive().max(MAX_IMAGE_UPLOAD_BYTES),
  })
  .refine(
    (d) =>
      d.uploadType === 'avatar' ||
      d.uploadType === 'feedback' ||
      d.uploadType === 'bankQr' ||
      d.groupId != null,
    {
      message: 'Cần groupId',
      path: ['groupId'],
    },
  )

export const createFeedbackSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('PRAISE'),
    rating: z.number().int().min(1).max(5),
    title: z.string().max(200).optional(),
    description: z.string().max(2000).optional(),
  }),
  z.object({
    type: z.literal('ISSUE'),
    title: z.string().min(1).max(200),
    description: z.string().min(1).max(5000),
    imageUrls: z.array(z.string().url()).max(10).default([]),
  }),
])

export const patchAdminFeedbackSchema = z.object({
  status: z.enum(['NEW', 'IN_PROGRESS', 'RESOLVED', 'ARCHIVED']).optional(),
  adminNote: z.string().max(2000).optional().nullable(),
})

// ── Query params ─────────────────────────────────
export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
})

export const expenseFilterSchema = paginationSchema.extend({
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
  categoryId: z.string().cuid().optional(),
  paidByUserId: z.string().cuid().optional(),
  status: z.enum(['ACTIVE', 'SETTLED', 'STANDALONE_DONE']).optional(),
  /** Query: client có thể gửi boolean hoặc chuỗi */
  isStandalone: z.preprocess((val) => {
    if (val === undefined || val === null || val === '') return undefined
    if (val === true || val === 'true' || val === '1') return true
    if (val === false || val === 'false' || val === '0') return false
    return undefined
  }, z.boolean().optional()),
  /** Chi riêng chưa hoàn tất thanh toán (chưa STANDALONE_DONE) */
  standaloneIncomplete: z.preprocess((val) => {
    if (val === undefined || val === null || val === '') return undefined
    if (val === true || val === 'true' || val === '1') return true
    return undefined
  }, z.boolean().optional()),
  /** Lọc chi đã gắn một đợt tổng kết cụ thể (vd. danh sách trong trang chi tiết đợt) */
  settlementId: z.string().cuid().optional(),
})

export const groupActivityLogFilterSchema = paginationSchema.extend({
  action: z.string().min(1).max(120).optional(),
  targetType: z.string().min(1).max(60).optional(),
  targetId: z.string().cuid().optional(),
  /** Tìm trong phần mô tả (summary), không phân biệt hoa thường */
  q: z.string().min(1).max(200).optional(),
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
  /** Ẩn các log liên quan chi tiêu đánh dấu chi riêng (metadata.isStandalone) */
  hideStandaloneExpenses: z.preprocess((val) => {
    if (val === undefined || val === null || val === '') return undefined
    if (val === true || val === 'true' || val === '1') return true
    return undefined
  }, z.boolean().optional()),
})

export const settlementPreviewSchema = z.object({
  periodStart: z.string().datetime(),
  periodEnd: z.string().datetime(),
})

// Inferred types
export type RegisterInput = z.infer<typeof registerSchema>
export type LoginInput = z.infer<typeof loginSchema>
export type CreateGroupInput = z.infer<typeof createGroupSchema>
export type CreateExpenseInput = z.infer<typeof createExpenseSchema>
export type UpdateExpenseInput = z.infer<typeof updateExpenseSchema>
export type CreateSettlementInput = z.infer<typeof createSettlementSchema>
export type ConfirmPaymentInput = z.infer<typeof confirmPaymentSchema>
export type ContributeFundInput = z.infer<typeof contributeFundSchema>
export type ExpenseFilterInput = z.infer<typeof expenseFilterSchema>
export type AcceptPaymentInput = z.infer<typeof acceptPaymentSchema>
export type GroupActivityLogFilterInput = z.infer<typeof groupActivityLogFilterSchema>
