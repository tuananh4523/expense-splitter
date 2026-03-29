# Swantech chi tiêu (`expense-splitter`)

Ứng dụng **chia chi tiêu nhóm** — monorepo **pnpm**: API (**Hono**), giao diện (**Next.js**), **Prisma** + PostgreSQL, Redis, MinIO (object storage), Docker Compose cho dev và production.

---

## Mục lục

1. [Cấu trúc repo](#cấu-trúc-repo)
2. [Yêu cầu môi trường](#yêu-cầu-môi-trường)
3. [Cài đặt và chạy local (dev)](#cài-đặt-và-chạy-local-dev)
4. [Hai file Docker Compose: dev vs production](#hai-file-docker-compose-dev-vs-production)
5. [Biến môi trường (đầy đủ)](#biến-môi-trường-đầy-đủ)
6. [Makefile — tất cả lệnh](#makefile--tất-cả-lệnh)
7. [Script npm ở thư mục gốc](#script-npm-ở-thư-mục-gốc)
8. [Triển khai production trên server](#triển-khai-production-trên-server)
9. [CI/CD: GitHub Actions + SSH](#cicd-github-actions--ssh)
10. [Cổng dịch vụ & reverse proxy](#cổng-dịch-vụ--reverse-proxy)
11. [Cơ sở dữ liệu: migrate & seed](#cơ-sở-dữ-liệu-migrate--seed)
12. [SEO & chia sẻ link](#seo--chia-sẻ-link)
13. [Xử lý sự cố thường gặp](#xử-lý-sự-cố-thường-gặp)

---

## Cấu trúc repo

| Thư mục | Vai trò |
|---------|---------|
| `apps/api` | API Hono, cổng mặc định `4000` |
| `apps/web` | Next.js (Pages Router), cổng dev = `PORT` trong `apps/web/.env` (mặc định 3000) |
| `packages/database` | Prisma schema, migration, seed |
| `packages/types` | Kiểu dùng chung |
| `docker-compose.yml` | **Chỉ dev**: Postgres, Redis, MinIO (không build `api` / `web`) |
| `docker-compose.prod.yml` | **Production**: đủ service + build image `api` + `web` |
| `.github/workflows/deploy.yml` | Deploy tự động qua SSH + `make` |

---

## Yêu cầu môi trường

| Thành phần | Phiên bản gợi ý |
|------------|-----------------|
| Node.js | ≥ 20 |
| pnpm | ≥ 9 |
| Docker + Docker Compose v2 (`docker compose`) | Bản ổn định |

---

## Cài đặt và chạy local (dev)

```bash
git clone <url-repo>
cd quanlychitieu
pnpm install
```

### File env cho dev

| Vị trí | Mẫu | Ghi chú |
|--------|-----|---------|
| API | `apps/api/.env.example` → `apps/api/.env` (tùy chọn `.env.local` ghi đè) | `DATABASE_URL` trỏ Postgres dev (thường `localhost:5432`) |
| Web | `apps/web/.env.example` → `apps/web/.env` | `NEXT_PUBLIC_API_URL=http://localhost:4000` |

**Không commit** `.env`, `.env.local`, `.env.production` (đã ignore). File mẫu chỉ `*.example`.

### Chạy nền DB (Postgres + Redis + MinIO) + app

```bash
make dev
```

Lệnh này: `docker compose up -d` (file **`docker-compose.yml`**) rồi `pnpm dev` (chạy song song API + Web).

Tách tay:

```bash
docker compose up -d    # chỉ stack dev trong docker-compose.yml
pnpm dev                # hoặc: pnpm dev:api / pnpm dev:web
```

Kiểm tra API: `curl http://localhost:4000/health` (nếu có route health trong project).

---

## Hai file Docker Compose: dev vs production

| | `docker-compose.yml` | `docker-compose.prod.yml` |
|---|----------------------|---------------------------|
| **Mục đích** | Dev: chỉ hạ tầng | Production: hạ tầng + **build & chạy** `api`, `web` |
| **Postgres / Redis / MinIO** | Có | Có |
| **Service `api` / `web`** | **Không** | **Có** (build từ `apps/api/Dockerfile`, `apps/web/Dockerfile`) |
| **Lệnh Makefile** | Dùng trong `make dev` (nền) | `make build`, `make up`, `make down`, `make logs` |

**Trên server production:** luôn dùng **`docker-compose.prod.yml`** (hoặc `make build && make up`). **Không** dùng `docker-compose.yml` để deploy app vì không có container API/Web.

---

## Biến môi trường (đầy đủ)

### 1. Gốc repo — `.env` (chỉ cho `docker-compose.prod.yml`)

Docker Compose **chỉ** tự đọc file **`.env`** cùng thư mục với `docker-compose.prod.yml` để thay `${...}` trong file YAML. **Không** đọc `apps/api/.env.production` / `apps/web/.env.production` cho việc đó — nên:

- **Cổng public máy chủ** (`API_HOST_PORT`, `WEB_HOST_PORT`, `POSTGRES_HOST_PORT`) đặt trong `.env` gốc (map `host:container`).
- **Mật khẩu dịch vụ do Compose tạo** (Postgres container, Redis, MinIO root user/password) cũng nằm ở đây cho gọn.

**Tầng khác:** `apps/api/.env.production` chứa biến **bên trong container** (`DATABASE_URL`, `PORT`, JWT, …) — trùng mật khẩu với `.env` gốc nhưng **không** thay thế được chỗ `${API_HOST_PORT}` trong compose nếu chỉ sửa file trong `apps/`.

- **Mẫu:** [`.env.example`](.env.example)
- **Lệnh:** `cp .env.example .env` rồi sửa mật khẩu, URL, cổng.

Trong `.env.example`: `POSTGRES_DB` / `POSTGRES_USER` / `POSTGRES_PASSWORD`, `REDIS_PASSWORD`, `MINIO_ROOT_USER` / `MINIO_ROOT_PASSWORD` (user + mật khẩu MinIO — trùng với API), `NEXT_PUBLIC_API_URL`, tùy chọn `API_HOST_PORT` / `WEB_HOST_PORT` / `POSTGRES_HOST_PORT`.

### 2. API — production (`apps/api/.env.production`)

- **Mẫu:** [`apps/api/.env.production.example`](apps/api/.env.production.example)
- **Lệnh:** `cp apps/api/.env.production.example apps/api/.env.production`

Trong Docker, host DB/Redis/MinIO là **tên service**: `postgres`, `redis`, `minio`. Mật khẩu trong `DATABASE_URL`, `REDIS_URL` và cặp `MINIO_ROOT_*` phải **khớp** với `.env` gốc (Compose).

Gợi ý: `SKIP_DB_MIGRATE=1` trong env API chỉ khi cần tạm bỏ migrate lúc start (xem `apps/api/docker-entrypoint.sh`) — **không khuyến nghị** trên production.

### 3. Web — production (`apps/web/.env.production`)

- **Mẫu:** [`apps/web/.env.production.example`](apps/web/.env.production.example)
- **Lệnh:** `cp apps/web/.env.production.example apps/web/.env.production`

Khi `NODE_ENV=production` (`next build` / `next start`), Next ưu tiên biến trong **`.env.production`**. Docker Compose nạp file này qua `env_file`.

**Chia sẻ link / Facebook (og:image):** `NEXT_PUBLIC_SITE_URL` phải là URL public **https** (vd. `https://yourdomain.com`) và **trùng lúc `docker compose build web`** (xem biến trong `.env` gốc repo + `apps/web/Dockerfile`). Nếu build thiếu biến này, meta ảnh preview trỏ `localhost` — Facebook không hiện ảnh. Sau khi sửa, dùng [Sharing Debugger](https://developers.facebook.com/tools/debug/) để gỡ cache bài cũ.

### 4. Web — dev (`apps/web/.env`)

- **Mẫu:** [`apps/web/.env.example`](apps/web/.env.example)
- **Lệnh:** `cp apps/web/.env.example apps/web/.env` — **cùng quy ước với API** (`apps/api/.env`).

Next dev đọc **`apps/web/.env`** — không dùng `.env.local` trong quy ước repo này.

### 5. API — dev (`apps/api/.env`)

- **Mẫu:** [`apps/api/.env.example`](apps/api/.env.example)

---

## Makefile — tất cả lệnh

| Lệnh | Thực hiện |
|------|-----------|
| `make dev` | `docker compose up -d` (file **dev**) + `pnpm dev` |
| `make build` | `docker compose -f docker-compose.prod.yml build` |
| `make up` | `docker compose -f docker-compose.prod.yml up -d` |
| `make down` | `docker compose -f docker-compose.prod.yml down` |
| `make migrate` | `pnpm db:migrate` — Prisma migrate **trên máy dev** (cần DB local) |
| `make seed` | `pnpm db:seed` — seed dev |
| `make logs` | `docker compose -f docker-compose.prod.yml logs -f` |
| `make clean` | `docker compose down -v` (stack **dev**) + xóa thư mục build tạm; **cẩn thận** mất volume DB dev |

**Production:** khi container API start, `docker-entrypoint.sh` chạy `prisma migrate deploy` (trừ khi bật `SKIP_DB_MIGRATE`). Thường **không** cần `make migrate` trên server nếu chỉ deploy bằng Docker.

---

## Script npm ở thư mục gốc

| Script | Ý nghĩa |
|--------|---------|
| `pnpm dev` | Chạy song song dev cho các app trong workspace |
| `pnpm dev:api` / `pnpm dev:web` | Chỉ API hoặc chỉ Web |
| `pnpm build` | Build packages + apps |
| `pnpm db:migrate` | Prisma migrate dev |
| `pnpm db:migrate:deploy` | Prisma migrate deploy (CI / thủ công) |
| `pnpm db:seed` | Seed |
| `pnpm db:generate` | `prisma generate` |
| `pnpm typecheck` | Kiểm tra TypeScript toàn repo |
| `pnpm check` | Biome |

---

## Triển khai production trên server

### Chuẩn bị

- Cài **Docker**, **Docker Compose plugin**, **Git**, **Make**.
- Mở firewall hoặc cấu hình **Nginx / Caddy** phía trước (HTTPS, proxy tới `3000` / `4000` nếu không public trực tiếp).

### Bước 1 — Clone

```bash
cd /opt   # ví dụ
git clone git@github.com:<user>/<repo>.git quanlychitieu
cd quanlychitieu
```

Repo **private**: server phải `git fetch` được (Deploy key hoặc HTTPS + token) — xem [CI/CD](#cicd-github-actions--ssh).

### Bước 2 — Env (bắt buộc)

| Bước | Lệnh / file |
|------|-------------|
| Compose | `cp .env.example .env` — sửa mật khẩu + `NEXT_PUBLIC_API_URL` |
| API | `cp apps/api/.env.production.example apps/api/.env.production` |
| Web | `cp apps/web/.env.production.example apps/web/.env.production` |

Đảm bảo mật khẩu Postgres / Redis / MinIO **thống nhất** giữa `.env` gốc và `apps/api/.env.production`.

### Bước 3 — Build & chạy

```bash
make build
make up
make logs   # xem log nếu cần
```

---

## CI/CD: GitHub Actions + SSH

Workflow: [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml).

### Hành vi

- **Push** lên **bất kỳ nhánh** (`on.push.branches: '**'`) → SSH vào server, `git fetch/checkout/reset` đúng **`github.ref_name`**, rồi `make build` và `make up`.
- **Chạy tay:** Actions → **Deploy to server** → **Run workflow** — chọn nhánh ở **“Use workflow from”** để deploy đúng nhánh đó.

**Một server + một thư mục deploy:** lần deploy sau ghi đè code theo nhánh vừa chọn. Muốn tách staging / production → tách server hoặc `DEPLOY_PATH` / workflow khác nhau.

**Giới hạn nhánh:** trong workflow, thay `branches: ['**']` bằng ví dụ `[main, staging]`.

### SSH cho GitHub Actions

Cặp khóa dùng để **GitHub Actions SSH vào server** — tạo trên **máy bạn (dev)** hoặc máy tạm là đủ, **không** bắt buộc tạo trên server. (Nếu tạo trên server thì vẫn phải copy **private key** sang GitHub Secret — dễ lộ nên thường không khuyến nghị.)

1. Tạo cặp khóa **không passphrase** (CI không thể nhập passphrase mỗi lần chạy):

   ```bash
   ssh-keygen -t ed25519 -C "github-actions-deploy" -f ./gha_deploy_ed25519 -N ""
   ```

2. **Public key** (file `.pub`) → chỉ **một dòng** này dán vào `~/.ssh/authorized_keys` trên **server**, user dùng để deploy (`chmod 700 ~/.ssh`, `chmod 600 ~/.ssh/authorized_keys`).

3. **Private key** → GitHub **Settings → Secrets and variables → Actions**:

   | Secret | Nội dung |
   |--------|----------|
   | `SERVER_HOST` | IP hoặc hostname |
   | `SERVER_USER` | User SSH |
   | `SSH_PRIVATE_KEY` | Toàn bộ file private key (cả `BEGIN` / `END`) |
   | `DEPLOY_PATH` | Đường dẫn tuyệt đối tới repo trên server (vd. `/opt/quanlychitieu`) |

4. SSH **cổng khác 22:** trong `appleboy/ssh-action`, thêm `port: <số_cổng>`.

5. **Repo private:** thêm **Deploy key** (read-only) trên GitHub và private key tương ứng trên server trong `~/.ssh/` (và `~/.ssh/config` nếu cần), để lệnh `git fetch` trên server thành công.

### Troubleshooting CI

| Lỗi | Hướng xử lý |
|-----|-------------|
| `Permission denied (publickey)` | Sai user / `authorized_keys` / nội dung `SSH_PRIVATE_KEY` |
| `Host key verification` | Cấu hình known_hosts hoặc tùy chọn action — xem [appleboy/ssh-action](https://github.com/appleboy/ssh-action) |
| `make: not found` / `docker: not found` | Cài `make`, Docker, plugin Compose trên server |

---

## Cổng dịch vụ & reverse proxy

Trong **`docker-compose.prod.yml`** (mặc định publish ra host):

| Dịch vụ | Cổng host | Ghi chú |
|---------|-----------|---------|
| Web (Next) | `${WEB_HOST_PORT:-3000}` | Trong `.env` gốc: `WEB_HOST_PORT` → map vào container `3000` |
| API | `${API_HOST_PORT:-4000}` | Trong `.env` gốc: `API_HOST_PORT` → map vào container `4000` |
| PostgreSQL | `${POSTGRES_HOST_PORT:-5432}` | Trong `.env` gốc: `POSTGRES_HOST_PORT` → map vào container `5432` (psql / GUI từ máy host) |
| MinIO API | `9000` | Thường chỉ nội bộ / hạn chế |
| MinIO Console | `9001` | Không nên public mạng nếu không cần |

Redis **không** map cổng ra host trong prod — API vẫn nối qua tên service `redis` trong mạng Docker `app`. Postgres giờ có map tùy `POSTGRES_HOST_PORT`; trên server public nên siết firewall hoặc bỏ publish nếu không cần truy cập từ ngoài container.

**Dev (không Docker):**

- **Web:** đặt **`PORT`** trong `apps/web/.env` (mẫu trong `.env.example`; mặc định 3000). Đổi port → cập nhật **`NEXTAUTH_URL`** và **`NEXT_PUBLIC_SITE_URL`** cho khớp (vd. `http://localhost:3001`). Hoặc một lần: `PORT=3001 pnpm dev`.
- **API:** cổng đọc từ `PORT` trong `apps/api/.env` (mặc định `4000` trong `.env.example`). Đổi port → cập nhật `NEXT_PUBLIC_API_URL` / `WEB_URL` (API) cho khớp.

---

## Cơ sở dữ liệu: migrate & seed

- **Dev:** `make migrate` / `pnpm db:migrate` (cần Postgres dev), `make seed` / `pnpm db:seed`.
- **Production (Docker):** migrate deploy khi container **api** khởi động (`apps/api/docker-entrypoint.sh`).
- Seed: chủ yếu dùng **dev**; production chỉ seed khi bạn chủ động chạy (có rủi ro ghi đè dữ liệu — làm có chủ đích).

Chi tiết user/mật khẩu seed xem `packages/database/prisma/seed.ts` (cập nhật theo phiên bản hiện tại của repo).

---

## SEO & chia sẻ link

- Đặt **`NEXT_PUBLIC_SITE_URL`** trong env **production** của Web (URL public, không `/` cuối) để `og:image` và meta chia sẻ dùng đúng domain.
- Tùy chọn **`NEXT_PUBLIC_APP_NAME`** để đổi tên hiển thị.
- Ảnh OG mặc định: `apps/web/public/og-image.png` — sau khi đổi, dùng công cụ debug của Facebook/Zalo để làm mới cache.

---

## Xử lý sự cố thường gặp

| Vấn đề | Gợi ý |
|--------|--------|
| Web không gọi được API (local) | Kiểm tra `NEXT_PUBLIC_API_URL`, API đã chạy, `curl` health |
| Lỗi kết nối DB (Docker) | `DATABASE_URL` đúng host (`postgres` trong prod, `localhost` dev), user/mật khẩu khớp `.env` |
| Build Docker fail | Chạy `make build` từ **gốc repo**; đủ RAM; xem log từng stage |
| Migrate production | Xem log container `api`; kiểm tra `SKIP_DB_MIGRATE` |

---

## License

Private / theo quy định dự án.
