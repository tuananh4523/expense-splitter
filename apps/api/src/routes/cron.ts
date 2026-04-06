import { Hono } from 'hono'
import { processDebtReminders } from '../services/cron.service.js'

export const cronRoutes = new Hono()

// Middleware check secret key để đảm bảo chỉ có cron job schedule (vd Vercel Cron) mới có quyền gọi
cronRoutes.use('*', async (c, next) => {
  const secret = c.req.header('X-Cron-Secret')
  const envSecret = process.env.CRON_SECRET
  if (envSecret && secret !== envSecret) {
    return c.json({ error: 'Unauthorized' }, 401)
  }
  await next()
})

cronRoutes.post('/debt-reminders', async (c) => {
  try {
    const notifiedCount = await processDebtReminders()
    return c.json({ data: { success: true, notifiedCount } })
  } catch (error) {
    console.error('[CRON Error] processDebtReminders:', error)
    return c.json({ error: 'Internal server error while processing debt reminders' }, 500)
  }
})

// Có thể thêm một route GET để Vercel ping (vercel cron gen ra GET)
cronRoutes.get('/debt-reminders', async (c) => {
  try {
    const notifiedCount = await processDebtReminders()
    return c.json({ data: { success: true, notifiedCount } })
  } catch (error) {
    console.error('[CRON Error] processDebtReminders:', error)
    return c.json({ error: 'Internal server error while processing debt reminders' }, 500)
  }
})
