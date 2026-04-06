import dayjs from 'dayjs'
import { Hono } from 'hono'
import { computePersonalExpenseCharts } from '../lib/dashboard-charts.js'
import { computeDashboardSummaryForUser } from '../lib/dashboard-summary.js'
import { requireAuth } from '../middleware/auth.js'

export const dashboardRoutes = new Hono<{
  Variables: { userId: string; userRole: string; sessionJti: string }
}>()

dashboardRoutes.use('*', requireAuth)

dashboardRoutes.get('/summary', async (c) => {
  const userId = c.get('userId')
  const data = await computeDashboardSummaryForUser(userId)
  return c.json({ data })
})

dashboardRoutes.get('/charts', async (c) => {
  const userId = c.get('userId')
  const { startDate, endDate } = c.req.query()

  // [Fix 7] Default date range (backend) nếu không truyền start/end
  const end = endDate ? dayjs(endDate).toDate() : dayjs().toDate()
  const start = startDate ? dayjs(startDate).toDate() : dayjs(end).subtract(1, 'month').toDate()

  const data = await computePersonalExpenseCharts(userId, start, end)
  return c.json({ data })
})
