import { prisma, type Prisma } from '@expense/database'
import type { GroupMember } from '@expense/database'
import type { Context } from 'hono'

export const activeMemberWhereGate = { isActive: true, leftAt: null } as const

const groupReadInclude = {
  fund: true,
  _count: { select: { members: { where: activeMemberWhereGate } } },
} as const

type GroupReadRow = Prisma.GroupGetPayload<{ include: typeof groupReadInclude }>

export const GROUP_SUSPENDED_MSG =
  'Nhóm đã bị tạm khóa bởi quản trị viên. Liên hệ quản trị nếu cần hỗ trợ.'

export const ADMIN_NON_MEMBER_WRITE_MSG =
  'Chỉ xem — tài khoản quản trị không phải thành viên nhóm này nên không thể chỉnh sửa.'

const FORMER_LEFT_WRITE_MSG =
  'Bạn đã rời nhóm — không thể thao tác này. Vẫn xem được dữ liệu; trưởng nhóm đã rời vẫn duyệt chứng từ (tổng kết, chi riêng) qua các bước được phép.'

/** Trưởng nhóm (kể cả đã rời) — user còn hoạt động — dùng trong handler duyệt chứng từ. */
export async function findGroupLeaderIncludingFormer(
  groupId: string,
  userId: string,
): Promise<GroupMember | null> {
  return prisma.groupMember.findFirst({
    where: { groupId, userId, user: { isActive: true }, role: 'LEADER' },
  })
}

/** POST duyệt chứng từ: cựu trưởng nhóm vẫn được (không áp cho phó). */
function formerGroupLeaderProofMutateAllowed(c: Context): boolean {
  if (c.req.method !== 'POST') return false
  const p = c.req.path
  if (p.includes('/settlements/') && p.endsWith('/payments/accept')) return true
  if (p.includes('/settlements/') && p.includes('/reopen-after-reject')) return true
  if (p.includes('/standalone/payments/accept')) return true
  if (p.includes('/standalone/payments/') && p.includes('/reopen-after-reject')) return true
  return false
}

/** Cho router con /:groupId/expenses, /:groupId/settlements — gắn groupMember + adminGroupBrowse. */
export async function runGroupSubresourceGate(c: Context, groupId: string): Promise<Response | null> {
  const userId = c.get('userId') as string
  const userRole = c.get('userRole') as string
  const method = c.req.method
  const isRead = method === 'GET' || method === 'HEAD'

  const group = await prisma.group.findUnique({ where: { id: groupId } })
  if (!group) return c.json({ error: 'Không tìm thấy nhóm' }, 404)

  const m = await prisma.groupMember.findFirst({
    where: { groupId, userId, ...activeMemberWhereGate },
  })

  if (userRole !== 'ADMIN') {
    if (!group.isActive) return c.json({ error: GROUP_SUSPENDED_MSG }, 403)
    if (m) {
      c.set('groupMember', m)
      c.set('groupMemberIsFormer', false)
      c.set('adminGroupBrowse', false)
      return null
    }
    const fr = await prisma.groupMember.findFirst({
      where: {
        groupId,
        userId,
        user: { isActive: true },
        role: { in: ['LEADER', 'VICE_LEADER'] },
      },
    })
    if (!fr) return c.json({ error: 'Không tìm thấy nhóm' }, 404)
    if (isRead) {
      c.set('groupMember', fr)
      c.set('groupMemberIsFormer', true)
      c.set('adminGroupBrowse', false)
      return null
    }
    if (fr.role === 'LEADER' && formerGroupLeaderProofMutateAllowed(c)) {
      c.set('groupMember', fr)
      c.set('groupMemberIsFormer', true)
      c.set('adminGroupBrowse', false)
      return null
    }
    return c.json({ error: FORMER_LEFT_WRITE_MSG }, 403)
  }

  if (m) {
    if (!group.isActive && !isRead) return c.json({ error: GROUP_SUSPENDED_MSG }, 403)
    c.set('groupMember', m)
    c.set('groupMemberIsFormer', false)
    c.set('adminGroupBrowse', false)
    return null
  }

  if (!isRead) return c.json({ error: ADMIN_NON_MEMBER_WRITE_MSG }, 403)
  c.set('groupMember', null)
  c.set('groupMemberIsFormer', false)
  c.set('adminGroupBrowse', true)
  return null
}

export async function resolveGroupReadAccess(
  c: Context,
  groupId: string,
): Promise<
  | { ok: true; group: GroupReadRow; m: GroupMember; adminViewer: false }
  | { ok: true; group: GroupReadRow; m: null; adminViewer: true }
  | { ok: false; response: Response }
> {
  const userId = c.get('userId') as string
  const userRole = c.get('userRole') as string

  const group = await prisma.group.findUnique({
    where: { id: groupId },
    include: groupReadInclude,
  })
  if (!group) return { ok: false, response: c.json({ error: 'Không tìm thấy nhóm' }, 404) }

  const m = await prisma.groupMember.findFirst({
    where: { groupId, userId, ...activeMemberWhereGate },
  })

  if (userRole === 'ADMIN' && !m) {
    return { ok: true, group, m: null, adminViewer: true }
  }

  if (!m) {
    return { ok: false, response: c.json({ error: 'Không tìm thấy nhóm' }, 404) }
  }

  if (!group.isActive && userRole !== 'ADMIN') {
    return { ok: false, response: c.json({ error: GROUP_SUSPENDED_MSG }, 403) }
  }

  return { ok: true, group, m, adminViewer: false }
}

export async function resolveGroupWriteAccess(
  c: Context,
  groupId: string,
): Promise<{ ok: true; group: GroupReadRow; m: GroupMember } | { ok: false; response: Response }> {
  const userId = c.get('userId') as string
  const group = await prisma.group.findUnique({
    where: { id: groupId },
    include: groupReadInclude,
  })
  if (!group) return { ok: false, response: c.json({ error: 'Không tìm thấy nhóm' }, 404) }

  if (!group.isActive) {
    return { ok: false, response: c.json({ error: GROUP_SUSPENDED_MSG }, 403) }
  }

  const m = await prisma.groupMember.findFirst({
    where: { groupId, userId, ...activeMemberWhereGate },
  })
  if (!m) {
    return { ok: false, response: c.json({ error: 'Không tìm thấy nhóm' }, 404) }
  }

  return { ok: true, group, m }
}
