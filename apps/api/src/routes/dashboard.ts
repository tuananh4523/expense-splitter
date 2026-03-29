import { computeDashboardSummaryForUser } from '../lib/dashboard-summary.js'
import { requireAuth } from '../middleware/auth.js'
import { Hono } from 'hono'

export const dashboardRoutes = new Hono<{
  Variables: { userId: string; userRole: string; sessionJti: string }
}>()

dashboardRoutes.use('*', requireAuth)

dashboardRoutes.get('/summary', async (c) => {
  const userId = c.get('userId')
  const data = await computeDashboardSummaryForUser(userId)
  return c.json({ data })
})
