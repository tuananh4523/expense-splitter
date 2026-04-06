import type { Prisma, prisma } from '@expense/database'

type Db = Prisma.TransactionClient | typeof prisma

export async function writeGroupActivityLog(
  db: Db,
  data: {
    groupId: string
    actorUserId: string | null
    actorName: string
    actorEmail: string
    action: string
    summary: string
    targetType?: string | null
    targetId?: string | null
    metadata?: Prisma.InputJsonValue | null
  },
): Promise<void> {
  const row: Prisma.GroupActivityLogUncheckedCreateInput = {
    groupId: data.groupId,
    actorUserId: data.actorUserId,
    actorName: data.actorName,
    actorEmail: data.actorEmail,
    action: data.action,
    summary: data.summary,
    targetType: data.targetType ?? null,
    targetId: data.targetId ?? null,
  }
  if (data.metadata !== undefined && data.metadata !== null) {
    row.metadata = data.metadata
  }
  await db.groupActivityLog.create({ data: row })
}

export async function actorSnapshot(
  db: Db,
  userId: string,
): Promise<{ name: string; email: string }> {
  const u = await db.user.findUnique({
    where: { id: userId },
    select: { name: true, email: true },
  })
  return { name: u?.name ?? '(không rõ)', email: u?.email ?? '' }
}
