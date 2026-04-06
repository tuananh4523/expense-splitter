import './env.js'
import { createServer } from 'node:http'
import { getRequestListener } from '@hono/node-server'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { prettyJSON } from 'hono/pretty-json'
import { secureHeaders } from 'hono/secure-headers'
import { attachSocketServer } from './realtime/socket.js'
import { adminRoutes } from './routes/admin.js'
import { authRoutes } from './routes/auth.js'
import { dashboardRoutes } from './routes/dashboard.js'
import { feedbackRoutes } from './routes/feedback.js'
import { groupRoutes } from './routes/groups.js'
import { categoryRoutes, notificationRoutes } from './routes/misc.js'
import { uploadRoutes } from './routes/upload.js'
import { userRoutes } from './routes/users.js'

const jwtSecret = process.env.JWT_SECRET?.trim() ?? ''
if (!jwtSecret || jwtSecret.length < 8) {
  console.warn(
    '[expense-api] JWT_SECRET thiếu hoặc ngắn hơn 8 ký tự — đăng nhập sẽ lỗi 500. Thêm vào apps/api/.env hoặc .env.local (xem .env.example).',
  )
}

const WEB_ORIGINS = (process.env.WEB_URL ?? 'http://localhost:3000')
  .split(',')
  .map((v) => v.trim())
  .filter((v) => v.length > 0)

const CORS_ORIGINS = WEB_ORIGINS.length > 0 ? WEB_ORIGINS : ['http://localhost:3000']

const app = new Hono()

// ── Global middleware ──────────────────────────────
app.use('*', logger())
app.use('*', secureHeaders())
app.use('*', prettyJSON())
app.use(
  '/api/*',
  cors({
    origin: CORS_ORIGINS,
    credentials: true,
    allowHeaders: ['Content-Type', 'Authorization'],
    allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  }),
)

// ── Health check ───────────────────────────────────
app.get('/health', (c) => c.json({ status: 'ok', ts: new Date().toISOString() }))

app.route('/api/auth', authRoutes)
app.route('/api/dashboard', dashboardRoutes)
app.route('/api/users', userRoutes)
app.route('/api/upload', uploadRoutes)
app.route('/api/feedback', feedbackRoutes)
app.route('/api/groups', groupRoutes)
app.route('/api/categories', categoryRoutes)
app.route('/api/notifications', notificationRoutes)
app.route('/api/admin', adminRoutes)

// ── Routes will be registered in PROMPT 03 ────────
// import { userRoutes }       from './routes/users'
// import { categoryRoutes }   from './routes/categories'
// import { notifRoutes }      from './routes/notifications'
// import { uploadRoutes }     from './routes/upload'
import { cronRoutes } from './routes/cron.js'

app.route('/api/cron', cronRoutes)

// ── 404 fallback ──────────────────────────────────
app.notFound((c) => c.json({ error: 'Not found' }, 404))
app.onError((err, c) => {
  console.error('[Unhandled]', err)
  return c.json({ error: 'Internal server error' }, 500)
})

const PORT = Number(process.env.PORT ?? 4000)
/** Mặc định 0.0.0.0 để nhận cả IPv4 / IPv6 loopback (Next server gọi 127.0.0.1 hoặc ::1). */
const HOST = process.env.API_HOST ?? '0.0.0.0'

const server = createServer(getRequestListener(app.fetch))
attachSocketServer(server)

server.listen(PORT, HOST, () => {
  console.log(`🔥 API on http://${HOST === '0.0.0.0' ? 'localhost' : HOST}:${PORT}`)
})

export type AppType = typeof app
