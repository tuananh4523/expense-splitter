# TODO: Chạy dự án local ✅ HOÀN THÀNH

- [x] Step 1: Copy .env files ✓
- [x] Step 2: pnpm install ✓ (755 packages)
- [x] Step 3: docker compose up -d ✓ (postgres:5432, redis:6379, minio:9000/9001)
- [x] Step 4: Dev servers 
  - API: `pnpm --filter @expense/api dev` (localhost:4000)
  - Web: `pnpm --filter @expense/web dev` (localhost:3000)
- [x] Step 5: Verify running

**Dự án đang chạy local!**

| Service | URL | Trạng thái |
|---------|-----|------------|
| **Web app** | http://localhost:3000 | ✅ Next.js dev server |
| **API** | http://localhost:4000 | ✅ Hono API + auto Prisma migrate |
| **DB Admin** | http://localhost:9001 | ✅ MinIO (minioadmin/minioadmin) |
| **Prisma Studio** | `pnpm db:studio` | (sau login) |

**Tắt:** Ctrl+C các dev server + `docker compose down`

**Production:** `make build && make up` (docker-compose.prod.yml)

Dự án đã sẵn sàng sử dụng!
