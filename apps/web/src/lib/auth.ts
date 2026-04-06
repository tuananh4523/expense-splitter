import { getServerApiBaseUrl, getServerApiCandidateBases } from '@/lib/apiBaseUrl'
import axios, { isAxiosError } from 'axios'
import type { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'

interface LoginApiUser {
  id: string
  email: string
  name: string
  avatarUrl: string | null
  role: string
}

interface LoginApiBody {
  data: {
    token: string
    user: LoginApiUser
  }
}

interface MeApiBody {
  data: {
    role: string
    name?: string
    avatarUrl?: string | null
  }
}

function loginApiErrorMessage(err: unknown): string | null {
  if (!isAxiosError(err) || err.response?.data == null) return null
  const d = err.response.data
  if (typeof d === 'object' && d !== null && 'error' in d) {
    const msg = (d as { error: unknown }).error
    if (typeof msg === 'string' && msg.trim()) return msg
  }
  return null
}

/**
 * URL backend cho bước đăng nhập (chạy trên server Next.js, không phải trình duyệt).
 * Trong Docker, đặt INTERNAL_API_URL (vd. http://api:4000) — không đổi hostname.
 */
function loginApiBaseUrl(): string {
  return getServerApiBaseUrl()
}

/** Chuyển UA / IP từ request đăng nhập tới API để UserSession lưu đúng thiết bị & client. */
function forwardClientMetaHeaders(req: { headers?: Record<string, unknown> } | undefined) {
  const h = req?.headers
  if (!h) return {}
  const pick = (...keys: string[]): string | undefined => {
    for (const k of keys) {
      const raw = h[k] ?? h[k.toLowerCase()]
      if (typeof raw === 'string' && raw.trim()) return raw.trim()
      if (Array.isArray(raw) && typeof raw[0] === 'string' && raw[0].trim()) return raw[0].trim()
    }
    return undefined
  }
  const headers: Record<string, string> = {}
  const ua = pick('user-agent', 'User-Agent')
  const xff = pick('x-forwarded-for', 'X-Forwarded-For')
  const xri = pick('x-real-ip', 'X-Real-IP')
  const cf = pick('cf-connecting-ip', 'CF-Connecting-IP')
  if (ua) headers['User-Agent'] = ua.slice(0, 512)
  if (xff) headers['X-Forwarded-For'] = xff.slice(0, 256)
  if (xri) headers['X-Real-IP'] = xri.slice(0, 64)
  if (cf) headers['CF-Connecting-IP'] = cf.slice(0, 64)
  return headers
}

export const authOptions: NextAuthOptions = {
  session: { strategy: 'jwt', maxAge: 7 * 24 * 60 * 60 },
  pages: { signIn: '/auth/login' },
  secret: process.env.NEXTAUTH_SECRET ?? '',
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id
        token.role = user.role
        token.accessToken = user.accessToken
        token.email = user.email ?? null
        token.name = user.name ?? null
        token.picture = user.image ?? null
      }
      if (trigger === 'update' && session) {
        const s = session as {
          user?: { name?: string; image?: string | null }
          name?: string
          image?: string | null
        }
        const u = s.user ?? s
        if (typeof u.name === 'string') token.name = u.name
        if (Object.prototype.hasOwnProperty.call(u, 'image')) {
          token.picture = (u as { image: string | null }).image ?? null
        }
      }

      /** Mỗi lần tính lại session (SSR / refetch): đồng bộ role & profile từ DB — không dùng claim cũ trong Bearer JWT. */
      const accessToken = token.accessToken as string | undefined
      if (accessToken && token.id && !user) {
        try {
          let data: MeApiBody | undefined
          for (const base of getServerApiCandidateBases()) {
            try {
              const r = await axios.get<MeApiBody>(`${base}/api/users/me`, {
                headers: { Authorization: `Bearer ${accessToken}` },
                timeout: 12_000,
              })
              data = r.data
              break
            } catch (e) {
              if (isAxiosError(e) && e.response) break
              if (
                isAxiosError(e) &&
                (e.code === 'ECONNREFUSED' || e.code === 'ERR_NETWORK' || e.code === 'ETIMEDOUT')
              ) {
                continue
              }
              break
            }
          }
          const me = data?.data
          if (me?.role) token.role = me.role
          if (typeof me?.name === 'string') token.name = me.name
          if (me && Object.prototype.hasOwnProperty.call(me, 'avatarUrl')) {
            token.picture = me.avatarUrl ?? null
          }
        } catch {
          /* giữ token.role cũ nếu API lỗi */
        }
      }

      return token
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string
        session.user.role = token.role as string
        if (token.email != null) session.user.email = token.email
        if (token.name != null) session.user.name = token.name
        session.user.image =
          token.picture !== undefined && token.picture !== null ? (token.picture as string) : null
      }
      session.accessToken = token.accessToken as string
      return session
    },
  },
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: { email: {}, password: {} },
      async authorize(credentials, req) {
        if (!credentials?.email || !credentials?.password) return null
        try {
          const fwd = forwardClientMetaHeaders(req)
          let data: LoginApiBody | undefined
          let lastConn: unknown
          for (const base of getServerApiCandidateBases()) {
            try {
              const r = await axios.post<LoginApiBody>(
                `${base}/api/auth/login`,
                {
                  email: credentials.email,
                  password: credentials.password,
                },
                { headers: fwd, timeout: 20_000 },
              )
              data = r.data
              break
            } catch (e) {
              if (isAxiosError(e) && e.response) {
                throw e
              }
              if (
                isAxiosError(e) &&
                (e.code === 'ECONNREFUSED' || e.code === 'ERR_NETWORK' || e.code === 'ETIMEDOUT')
              ) {
                lastConn = e
                continue
              }
              throw e
            }
          }
          if (data === undefined && lastConn) {
            throw lastConn
          }
          const payload = data?.data
          if (!payload?.token || !payload?.user) {
            throw new Error(
              'API đăng nhập trả dữ liệu không hợp lệ. Kiểm tra INTERNAL_API_URL / NEXT_PUBLIC_API_URL trỏ đúng backend.',
            )
          }
          const { token, user } = payload
          return {
            id: user.id,
            email: user.email,
            name: user.name,
            image: user.avatarUrl,
            role: user.role,
            accessToken: token,
          }
        } catch (err) {
          if (process.env.NODE_ENV === 'development') {
            const msg = err instanceof Error ? err.message : String(err)
            console.error('[next-auth] login API failed:', msg)
            if (isAxiosError(err)) {
              console.error('[next-auth] response:', err.response?.status, err.response?.data)
              if (err.code === 'ECONNREFUSED') {
                console.error(
                  '[next-auth] Không kết nối được API (thường do @expense/api không chạy hoặc port 4000 bị chiếm). Chạy `lsof -i :4000` và tắt process cũ, rồi `pnpm dev` lại.',
                )
              }
            }
          }
          const fromApi = loginApiErrorMessage(err)
          if (fromApi) {
            throw new Error(fromApi)
          }
          if (isAxiosError(err) && (err.code === 'ECONNREFUSED' || err.code === 'ERR_NETWORK')) {
            throw new Error(
              'Không kết nối được máy chủ API. Hãy chạy API và kiểm tra NEXT_PUBLIC_API_URL (mặc định http://localhost:4000).',
            )
          }
          throw new Error('Đăng nhập thất bại. Kiểm tra API đang chạy và thử lại.')
        }
      },
    }),
  ],
}
