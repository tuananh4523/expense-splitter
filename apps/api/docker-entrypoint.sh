#!/bin/sh
set -e
cd /app
# pnpm monorepo: prisma CLI nằm dưới package @expense/database, không phải root node_modules/.bin
PRISMA_BIN="./packages/database/node_modules/.bin/prisma"
[ -x "$PRISMA_BIN" ] || PRISMA_BIN="./node_modules/.bin/prisma"
if [ -z "${SKIP_DB_MIGRATE:-}" ]; then
  echo "[api] Running prisma migrate deploy..."
  "$PRISMA_BIN" migrate deploy --schema=./packages/database/prisma/schema.prisma
else
  echo "[api] SKIP_DB_MIGRATE is set — skipping migrations"
fi
exec node apps/api/dist/index.js
