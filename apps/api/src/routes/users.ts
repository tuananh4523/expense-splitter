import { prisma } from '@expense/database'
import { DEFAULT_UI_THEME, VIETNAM_BANKS, type VietnamBank, uiThemeIdSchema } from '@expense/types'
import bcrypt from 'bcryptjs'
import { Hono } from 'hono'
import { z } from 'zod'
import { signedStorageUrlForUser } from '../lib/minio.js'
import { getOrCreateSystemConfig } from '../lib/systemConfig.js'
import { requireAuth } from '../middleware/auth.js'

const patchMeBody = z.object({
  name: z.string().min(1).max(120).optional(),
  avatarUrl: z.string().url().max(2000).nullable().optional(),
  bio: z.string().max(300).nullable().optional(),
  phone: z
    .union([z.string().regex(/^0\d{9,10}$/), z.literal(''), z.null()])
    .optional(),
  uiTheme: uiThemeIdSchema.optional(),
})

const bankCreateBody = z.object({
  bankCode: z.string().min(1).max(16),
  accountNumber: z.string().min(4).max(32),
  accountName: z.string().min(1).max(120),
  isDefault: z.boolean().optional(),
  qrImageUrl: z.union([z.string().url().max(2000), z.null()]).optional(),
})

const bankPatchBody = z.object({
  bankCode: z.string().min(1).max(16).optional(),
  accountNumber: z.string().min(4).max(32).optional(),
  accountName: z.string().min(1).max(120).optional(),
  isDefault: z.boolean().optional(),
  qrImageUrl: z.union([z.string().url().max(2000), z.null()]).optional(),
})

const changePasswordBody = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(6).max(128),
})

function bankMeta(code: string): { bankCode: string; bankName: string } | null {
  const b = VIETNAM_BANKS.find((x: VietnamBank) => x.code === code)
  if (!b) return null
  return { bankCode: b.code, bankName: b.fullName }
}

async function getOrCreateProfile(userId: string) {
  let profile = await prisma.userProfile.findUnique({ where: { userId } })
  if (!profile) {
    profile = await prisma.userProfile.create({ data: { userId } })
  }
  return profile
}

async function unsetOtherDefaults(profileId: string, exceptId: string) {
  await prisma.bankAccount.updateMany({
    where: { profileId, id: { not: exceptId }, isDefault: true },
    data: { isDefault: false },
  })
}

type BankRow = {
  id: string
  bankCode: string
  bankName: string
  accountNumber: string
  accountName: string
  isDefault: boolean
  createdAt: Date
  qrImageUrl: string | null
}

async function bankAccountToDto(b: BankRow, viewerUserId: string) {
  return {
    id: b.id,
    bankCode: b.bankCode,
    bankName: b.bankName,
    accountNumber: b.accountNumber,
    accountName: b.accountName,
    isDefault: b.isDefault,
    createdAt: b.createdAt.toISOString(),
    qrImageUrl: await signedStorageUrlForUser(b.qrImageUrl, viewerUserId),
  }
}

export const userRoutes = new Hono<{
  Variables: { userId: string; userRole: string; sessionJti: string }
}>()
userRoutes.use('*', requireAuth)

userRoutes.get('/me', async (c) => {
  const userId = c.get('userId')
  const [user, sys] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      include: {
        profile: { include: { bankAccounts: { orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }] } } },
      },
    }),
    getOrCreateSystemConfig(),
  ])
  if (!user) return c.json({ error: 'Không tìm thấy người dùng' }, 404)

  const profile = user.profile
    ? {
        bio: user.profile.bio,
        phone: user.profile.phone,
        uiTheme: user.profile.uiTheme ?? DEFAULT_UI_THEME,
        bankAccounts: await Promise.all(
          user.profile.bankAccounts.map((b) => bankAccountToDto(b, userId)),
        ),
      }
    : { bio: null, phone: null, uiTheme: DEFAULT_UI_THEME, bankAccounts: [] as const }

  const avatarUrl = await signedStorageUrlForUser(user.avatarUrl, userId)

  return c.json({
    data: {
      id: user.id,
      email: user.email,
      name: user.name,
      avatarUrl,
      role: user.role,
      mustChangePassword: user.mustChangePassword,
      bio: profile.bio,
      phone: profile.phone,
      uiTheme: profile.uiTheme,
      bankAccounts: profile.bankAccounts,
      createdAt: user.createdAt.toISOString(),
      idleTimeoutMinutes: sys.idleTimeoutMinutes,
    },
  })
})

userRoutes.patch('/me', async (c) => {
  const userId = c.get('userId')
  let body: unknown
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'Invalid JSON' }, 400)
  }
  const parsed = patchMeBody.safeParse(body)
  if (!parsed.success) {
    return c.json({ error: parsed.error.issues[0]?.message ?? 'Dữ liệu không hợp lệ' }, 400)
  }
  const d = parsed.data
  if (Object.keys(d).length === 0) {
    return c.json({ error: 'Không có dữ liệu cập nhật' }, 400)
  }

  const { bio, phone, uiTheme, ...userFields } = d
  const hasUser =
    userFields.name != null || userFields.avatarUrl !== undefined
  if (hasUser) {
    await prisma.user.update({
      where: { id: userId },
      data: {
        ...(userFields.name != null ? { name: userFields.name.trim() } : {}),
        ...(userFields.avatarUrl !== undefined ? { avatarUrl: userFields.avatarUrl } : {}),
      },
    })
  }

  if (bio !== undefined || phone !== undefined || uiTheme !== undefined) {
    await getOrCreateProfile(userId)
    await prisma.userProfile.update({
      where: { userId },
      data: {
        ...(bio !== undefined ? { bio: bio?.trim() || null } : {}),
        ...(phone !== undefined
          ? { phone: phone === '' || phone == null ? null : phone.trim() }
          : {}),
        ...(uiTheme !== undefined ? { uiTheme } : {}),
      },
    })
  }

  const full = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      profile: { include: { bankAccounts: { orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }] } } },
    },
  })
  if (!full) return c.json({ error: 'Lỗi' }, 500)

  const p = full.profile
  const avatarUrl = await signedStorageUrlForUser(full.avatarUrl, userId)
  const sys = await getOrCreateSystemConfig()

  return c.json({
    data: {
      id: full.id,
      email: full.email,
      name: full.name,
      avatarUrl,
      role: full.role,
      mustChangePassword: full.mustChangePassword,
      bio: p?.bio ?? null,
      phone: p?.phone ?? null,
      uiTheme: p?.uiTheme ?? DEFAULT_UI_THEME,
      bankAccounts: await Promise.all((p?.bankAccounts ?? []).map((b) => bankAccountToDto(b, userId))),
      createdAt: full.createdAt.toISOString(),
      idleTimeoutMinutes: sys.idleTimeoutMinutes,
    },
  })
})

userRoutes.get('/me/banks', async (c) => {
  const userId = c.get('userId')
  const profile = await getOrCreateProfile(userId)
  const list = await prisma.bankAccount.findMany({
    where: { profileId: profile.id },
    orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
  })
  return c.json({
    data: await Promise.all(list.map((b) => bankAccountToDto(b, userId))),
  })
})

userRoutes.post('/me/banks', async (c) => {
  const userId = c.get('userId')
  let body: unknown
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'Invalid JSON' }, 400)
  }
  const parsed = bankCreateBody.safeParse(body)
  if (!parsed.success) {
    return c.json({ error: parsed.error.issues[0]?.message ?? 'Dữ liệu không hợp lệ' }, 400)
  }

  const meta = bankMeta(parsed.data.bankCode)
  if (!meta) {
    return c.json({ error: 'Ngân hàng không hợp lệ' }, 400)
  }

  const profile = await getOrCreateProfile(userId)
  const count = await prisma.bankAccount.count({ where: { profileId: profile.id } })
  if (count >= 5) {
    return c.json({ error: 'Tối đa 5 tài khoản ngân hàng' }, 400)
  }

  const isDefault = parsed.data.isDefault ?? count === 0
  const qrIn = parsed.data.qrImageUrl
  const b = await prisma.bankAccount.create({
    data: {
      profileId: profile.id,
      bankCode: meta.bankCode,
      bankName: meta.bankName,
      accountNumber: parsed.data.accountNumber.trim(),
      accountName: parsed.data.accountName.trim(),
      isDefault,
      ...(typeof qrIn === 'string' && qrIn.length > 0 ? { qrImageUrl: qrIn } : {}),
    },
  })
  if (isDefault) {
    await unsetOtherDefaults(profile.id, b.id)
  }

  return c.json({
    data: await bankAccountToDto(b, userId),
  })
})

userRoutes.patch('/me/banks/:bankId', async (c) => {
  const userId = c.get('userId')
  const bankId = c.req.param('bankId')
  let body: unknown
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'Invalid JSON' }, 400)
  }
  const parsed = bankPatchBody.safeParse(body)
  if (!parsed.success) {
    return c.json({ error: parsed.error.issues[0]?.message ?? 'Dữ liệu không hợp lệ' }, 400)
  }
  if (Object.keys(parsed.data).length === 0) {
    return c.json({ error: 'Không có dữ liệu cập nhật' }, 400)
  }

  const profile = await getOrCreateProfile(userId)
  const existing = await prisma.bankAccount.findFirst({
    where: { id: bankId, profileId: profile.id },
  })
  if (!existing) return c.json({ error: 'Không tìm thấy tài khoản' }, 404)

  const d = parsed.data
  let bankCode = existing.bankCode
  let bankName = existing.bankName
  if (d.bankCode != null) {
    const meta = bankMeta(d.bankCode)
    if (!meta) return c.json({ error: 'Ngân hàng không hợp lệ' }, 400)
    bankCode = meta.bankCode
    bankName = meta.bankName
  }

  const updated = await prisma.bankAccount.update({
    where: { id: bankId },
    data: {
      bankCode,
      bankName,
      ...(d.accountNumber != null ? { accountNumber: d.accountNumber.trim() } : {}),
      ...(d.accountName != null ? { accountName: d.accountName.trim() } : {}),
      ...(d.isDefault === true ? { isDefault: true } : d.isDefault === false ? { isDefault: false } : {}),
      ...(d.qrImageUrl !== undefined ? { qrImageUrl: d.qrImageUrl } : {}),
    },
  })

  if (d.isDefault === true) {
    await unsetOtherDefaults(profile.id, bankId)
  }

  return c.json({
    data: await bankAccountToDto(updated, userId),
  })
})

userRoutes.delete('/me/banks/:bankId', async (c) => {
  const userId = c.get('userId')
  const bankId = c.req.param('bankId')
  const profile = await getOrCreateProfile(userId)
  const existing = await prisma.bankAccount.findFirst({
    where: { id: bankId, profileId: profile.id },
  })
  if (!existing) return c.json({ error: 'Không tìm thấy tài khoản' }, 404)

  const wasDefault = existing.isDefault
  await prisma.bankAccount.delete({ where: { id: bankId } })

  if (wasDefault) {
    const first = await prisma.bankAccount.findFirst({
      where: { profileId: profile.id },
      orderBy: { createdAt: 'asc' },
    })
    if (first) {
      await prisma.bankAccount.update({ where: { id: first.id }, data: { isDefault: true } })
    }
  }

  return c.json({ data: { ok: true } })
})

userRoutes.post('/me/change-password', async (c) => {
  const userId = c.get('userId')
  let body: unknown
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'Invalid JSON' }, 400)
  }
  const parsed = changePasswordBody.safeParse(body)
  if (!parsed.success) {
    return c.json({ error: parsed.error.issues[0]?.message ?? 'Dữ liệu không hợp lệ' }, 400)
  }

  const user = await prisma.user.findUnique({ where: { id: userId } })
  if (!user) return c.json({ error: 'Không tìm thấy người dùng' }, 404)

  const ok = await bcrypt.compare(parsed.data.currentPassword, user.passwordHash)
  if (!ok) {
    return c.json({ error: 'Mật khẩu hiện tại không đúng' }, 400)
  }

  const passwordHash = await bcrypt.hash(parsed.data.newPassword, 12)
  await prisma.user.update({
    where: { id: userId },
    data: {
      passwordHash,
      mustChangePassword: false,
      passwordResetToken: null,
      passwordResetExpires: null,
    },
  })

  const currentJti = c.get('sessionJti')
  await prisma.userSession.deleteMany({
    where: { userId, NOT: { jti: currentJti } },
  })

  return c.json({ data: { ok: true } })
})

userRoutes.get('/me/sessions', async (c) => {
  const userId = c.get('userId')
  const currentJti = c.get('sessionJti')
  const rows = await prisma.userSession.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      deviceLabel: true,
      userAgent: true,
      ipAddress: true,
      createdAt: true,
      jti: true,
    },
  })
  return c.json({
    data: rows.map((s) => ({
      id: s.id,
      deviceLabel: s.deviceLabel,
      userAgent: s.userAgent,
      ipAddress: s.ipAddress,
      createdAt: s.createdAt.toISOString(),
      isCurrent: s.jti === currentJti,
    })),
  })
})

userRoutes.delete('/me/sessions/:sessionId', async (c) => {
  const userId = c.get('userId')
  const currentJti = c.get('sessionJti')
  const sessionId = c.req.param('sessionId')
  const s = await prisma.userSession.findFirst({
    where: { id: sessionId, userId },
    select: { id: true, jti: true },
  })
  if (!s) return c.json({ error: 'Không tìm thấy phiên' }, 404)
  const wasCurrent = s.jti === currentJti
  await prisma.userSession.delete({ where: { id: s.id } })
  return c.json({ data: { ok: true, wasCurrent } })
})

/** Profile công khai của một user — chỉ trả dữ liệu không nhạy cảm, yêu cầu đăng nhập. */
userRoutes.get('/:userId', async (c) => {
  const requesterId = c.get('userId')
  const { userId } = c.req.param()

  const user = await prisma.user.findUnique({
    where: { id: userId, isActive: true },
    include: {
      profile: {
        include: {
          bankAccounts: { orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }] },
        },
      },
    },
  })
  if (!user) return c.json({ error: 'Không tìm thấy người dùng' }, 404)

  // Chỉ cho phép xem nếu cùng nhóm hoặc chính mình.
  // Người xem phải còn trong nhóm (active); người được xem có thể đã rời — vẫn cho xem (tổng kết / STK).
  if (userId !== requesterId) {
    const shared = await prisma.groupMember.findFirst({
      where: {
        userId: requesterId,
        isActive: true,
        leftAt: null,
        group: {
          members: {
            some: { userId },
          },
        },
      },
    })
    if (!shared) return c.json({ error: 'Không có quyền xem' }, 403)
  }

  const avatarUrl = await signedStorageUrlForUser(user.avatarUrl, requesterId)

  return c.json({
    data: {
      id: user.id,
      name: user.name,
      avatarUrl,
      bio: user.profile?.bio ?? null,
      phone: user.profile?.phone ?? null,
      createdAt: user.createdAt.toISOString(),
      bankAccounts: await Promise.all(
        (user.profile?.bankAccounts ?? []).map((b) => bankAccountToDto(b, requesterId)),
      ),
    },
  })
})
