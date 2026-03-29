/**
 * Load env từ apps/api (import đầu tiên từ index).
 * Thứ tự giống Next.js: `.env` rồi `.env.local` (local ghi đè). Chỉ cần một trong hai.
 */
import { config } from 'dotenv'
import { existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const apiDir = dirname(fileURLToPath(import.meta.url))
const apiRoot = resolve(apiDir, '..')
const envPath = resolve(apiRoot, '.env')
const envLocalPath = resolve(apiRoot, '.env.local')

if (existsSync(envPath)) {
  config({ path: envPath })
}
if (existsSync(envLocalPath)) {
  config({ path: envLocalPath, override: true })
}
// Không có cả hai: vẫn cho phép biến từ shell / Docker inject sẵn
