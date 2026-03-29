import jwt, { type JwtPayload, type SignOptions } from 'jsonwebtoken'

function jwtSecretRaw(): string {
  return process.env.JWT_SECRET?.trim() ?? ''
}

function jwtExpiresIn(): string {
  const v = process.env.JWT_EXPIRES_IN?.trim()
  return v && v.length > 0 ? v : '7d'
}

/** Thông báo cho client khi ký JWT thất bại (thiếu env, expiresIn sai, …). */
export function formatJwtSignError(e: unknown): string {
  if (e instanceof Error) {
    const m = e.message
    if (m.includes('JWT_SECRET')) {
      return 'Thiếu JWT_SECRET hoặc JWT_SECRET ngắn hơn 8 ký tự. Trong apps/api/.env đặt JWT_SECRET (tối thiểu 8 ký tự), xem .env.example.'
    }
    if (/expires|expir|timespan/i.test(m)) {
      return 'JWT_EXPIRES_IN không hợp lệ hoặc rỗng. Dùng vd. 7d, 24h, 3600 — xóa dòng hoặc sửa trong apps/api/.env.'
    }
    if (/secretOrPrivateKey|must have a value/i.test(m)) {
      return 'JWT_SECRET không hợp lệ (thiếu giá trị thực). Kiểm tra apps/api/.env — không để JWT_SECRET= trống hoặc chỉ dấu ngoặc rỗng.'
    }
    if (process.env.NODE_ENV !== 'production') {
      return `Lỗi ký JWT: ${m}. Kiểm tra apps/api/.env (JWT_SECRET, JWT_EXPIRES_IN).`
    }
  }
  return 'Cấu hình JWT không hợp lệ. Kiểm tra JWT_SECRET (≥8 ký tự) và JWT_EXPIRES_IN (vd. 7d) trong apps/api/.env.'
}

export function signAccessToken(payload: {
  sub: string
  role: string
  email: string
  jti: string
}): string {
  const secret = jwtSecretRaw()
  if (secret.length < 8) {
    throw new Error('JWT_SECRET must be set (production: use at least 32 random bytes)')
  }
  const expiresIn = jwtExpiresIn()
  try {
    return jwt.sign(
      { sub: payload.sub, role: payload.role, email: payload.email, jti: payload.jti },
      secret,
      { expiresIn } as SignOptions,
    )
  } catch (err) {
    const hint = err instanceof Error ? err.message : String(err)
    throw new Error(`JWT sign failed: ${hint}`)
  }
}

export function verifyAccessToken(token: string): {
  sub: string
  role: string
  email: string
  jti: string
} {
  const secret = jwtSecretRaw()
  if (secret.length < 8) {
    throw new Error('JWT_SECRET must be set (production: use at least 32 random bytes)')
  }
  const decoded = jwt.verify(token, secret) as JwtPayload & {
    sub?: string
    role?: string
    email?: string
    jti?: string
  }
  const sub = decoded.sub
  if (!sub || typeof sub !== 'string') {
    throw new Error('Invalid token subject')
  }
  const jti = typeof decoded.jti === 'string' ? decoded.jti : ''
  if (!jti) {
    throw new Error('Invalid token')
  }
  return {
    sub,
    role: typeof decoded.role === 'string' ? decoded.role : 'USER',
    email: typeof decoded.email === 'string' ? decoded.email : '',
    jti,
  }
}
