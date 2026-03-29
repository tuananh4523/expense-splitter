import { prisma } from '@expense/database'
import { loginSchema, registerSchema } from '@expense/types'
import bcrypt from 'bcryptjs'
import { randomUUID } from 'node:crypto'
import { Hono } from 'hono'
import { formatJwtSignError, signAccessToken } from '../lib/jwt.js'
import { signedStorageUrlForUser } from '../lib/minio.js'
import { createUserSession, formatUserSessionCreateError } from '../lib/userSession.js'

const auth = new Hono()

async function userDto(u: { id: string; email: string; name: string; avatarUrl: string | null; role: string }) {
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    avatarUrl: await signedStorageUrlForUser(u.avatarUrl, u.id),
    role: u.role,
  }
}

auth.post('/login', async (c) => {
  let body: unknown
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'Invalid JSON' }, 400)
  }

  const parsed = loginSchema.safeParse(body)
  if (!parsed.success) {
    return c.json({ error: parsed.error.flatten().fieldErrors.email?.[0] ?? 'Dữ liệu không hợp lệ' }, 400)
  }

  const { email, password } = parsed.data
  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } })
  if (!user?.isActive) {
    return c.json({ error: 'Email hoặc mật khẩu không đúng' }, 401)
  }

  const ok = await bcrypt.compare(password, user.passwordHash)
  if (!ok) {
    return c.json({ error: 'Email hoặc mật khẩu không đúng' }, 401)
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  })

  const jti = randomUUID()
  try {
    await createUserSession(c, user.id, jti)
  } catch (e) {
    console.error('[auth/login] session', e)
    return c.json({ error: 'Không tạo được phiên đăng nhập' }, 500)
  }

  let token: string
  try {
    token = signAccessToken({
      sub: user.id,
      role: user.role,
      email: user.email,
      jti,
    })
  } catch (e) {
    console.error('[auth/login]', e)
    return c.json({ error: formatJwtSignError(e) }, 500)
  }

  return c.json({
    data: {
      token,
      user: await userDto(user),
    },
  })
})

auth.post('/register', async (c) => {
  let body: unknown
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'Invalid JSON' }, 400)
  }

  const parsed = registerSchema.safeParse(body)
  if (!parsed.success) {
    return c.json({ error: parsed.error.issues[0]?.message ?? 'Dữ liệu không hợp lệ' }, 400)
  }

  const { email, name, password } = parsed.data
  const normalized = email.toLowerCase().trim()
  const exists = await prisma.user.findUnique({ where: { email: normalized } })
  if (exists) {
    return c.json({ error: 'Email đã được sử dụng' }, 409)
  }

  const passwordHash = await bcrypt.hash(password, 12)
  const user = await prisma.user.create({
    data: {
      email: normalized,
      name: name.trim(),
      passwordHash,
      role: 'USER',
      isActive: true,
      mustChangePassword: false,
    },
    select: { id: true, email: true, name: true },
  })

  return c.json({ data: user }, 201)
})

export { auth as authRoutes }
