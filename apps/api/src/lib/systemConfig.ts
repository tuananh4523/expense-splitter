import { prisma } from '@expense/database'

const CONFIG_ID = 'default' as const

export async function getOrCreateSystemConfig() {
  return prisma.systemConfig.upsert({
    where: { id: CONFIG_ID },
    create: { id: CONFIG_ID, idleTimeoutMinutes: 0 },
    update: {},
  })
}
