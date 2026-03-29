import { prisma } from '@expense/database'
import * as Minio from 'minio'
import { getMinioClient, minioBucket, parseStoredObject } from './minio.js'

/** Trích object name trong bucket app (để so khớp với MinIO). */
function objectNameFromStored(stored: string | null | undefined): string | null {
  if (!stored?.trim()) return null
  const p = parseStoredObject(stored)
  if (!p || p.bucket !== minioBucket()) return null
  return p.objectName
}

/**
 * Mọi object path đang được DB tham chiếu (avatar, ảnh chi, chứng từ, QR, feedback…).
 */
export async function collectReferencedObjectNames(): Promise<Set<string>> {
  const names = new Set<string>()
  const add = (s: string | null | undefined) => {
    const n = objectNameFromStored(s)
    if (n) names.add(n)
  }
  const addMany = (arr: string[]) => {
    for (const s of arr) add(s)
  }

  const [
    users,
    groups,
    banks,
    expenses,
    payments,
    fundTx,
    feedbacks,
    comments,
  ] = await Promise.all([
    prisma.user.findMany({ select: { avatarUrl: true } }),
    prisma.group.findMany({ select: { avatarUrl: true } }),
    prisma.bankAccount.findMany({ select: { qrImageUrl: true } }),
    prisma.expense.findMany({ select: { imageUrls: true } }),
    prisma.paymentRecord.findMany({ select: { proofImageUrls: true } }),
    prisma.fundTransaction.findMany({ select: { proofImageUrls: true } }),
    prisma.feedback.findMany({ select: { imageUrls: true } }),
    prisma.comment.findMany({ select: { imageUrls: true } }),
  ])

  for (const u of users) add(u.avatarUrl)
  for (const g of groups) add(g.avatarUrl)
  for (const b of banks) add(b.qrImageUrl)
  for (const e of expenses) addMany(e.imageUrls)
  for (const p of payments) addMany(p.proofImageUrls)
  for (const f of fundTx) addMany(f.proofImageUrls)
  for (const fb of feedbacks) addMany(fb.imageUrls)
  for (const c of comments) addMany(c.imageUrls)

  return names
}

const SAFE_PREFIXES = ['avatars/', 'groups/', 'feedback/', 'bank-qr/'] as const

async function listAllObjectNames(client: Minio.Client, bucket: string): Promise<string[]> {
  const out: string[] = []
  const stream = client.listObjectsV2(bucket, '', true)
  await new Promise<void>((resolve, reject) => {
    stream.on('data', (obj) => {
      if (obj.name) out.push(obj.name)
    })
    stream.on('error', reject)
    stream.on('end', () => resolve())
  })
  return out
}

function isUnderSafePrefix(name: string): boolean {
  return SAFE_PREFIXES.some((p) => name.startsWith(p))
}

export type OrphanCleanupResult = {
  scanned: number
  referenced: number
  deleted: number
  skippedUnsafe: number
  errors: string[]
}

/** Xoá object MinIO không còn được bất kỳ bản ghi DB nào trỏ tới. */
export async function deleteOrphanStorageObjects(): Promise<OrphanCleanupResult> {
  const client = getMinioClient()
  const bucket = minioBucket()
  const errors: string[] = []
  if (!client) {
    return { scanned: 0, referenced: 0, deleted: 0, skippedUnsafe: 0, errors: ['MinIO chưa cấu hình'] }
  }

  const referenced = await collectReferencedObjectNames()
  let scanned = 0
  let deleted = 0
  let skippedUnsafe = 0

  const allNames = await listAllObjectNames(client, bucket).catch((e) => {
    errors.push(String(e))
    return []
  })

  for (const name of allNames) {
    scanned++
    if (!isUnderSafePrefix(name)) {
      skippedUnsafe++
      continue
    }
    if (referenced.has(name)) continue
    try {
      await client.removeObject(bucket, name)
      deleted++
    } catch (e) {
      errors.push(`${name}: ${String(e)}`)
    }
  }

  return { scanned, referenced: referenced.size, deleted, skippedUnsafe, errors }
}
