# Build from monorepo root: docker build -f apps/api/Dockerfile .
FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@10 --activate

FROM base AS builder
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api ./apps/api
COPY packages ./packages
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @expense/database build
RUN pnpm --filter @expense/types build
RUN pnpm --filter @expense/api build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 hono
# Root .pnpm store + apps/api/node_modules (symlink ../../../node_modules/.pnpm — phải giữ layout monorepo)
COPY --from=builder --chown=hono:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=hono:nodejs /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=builder --chown=hono:nodejs /app/apps/api/dist ./apps/api/dist
COPY --from=builder --chown=hono:nodejs /app/apps/api/package.json ./apps/api/package.json
COPY --from=builder --chown=hono:nodejs /app/packages/database ./packages/database
COPY --from=builder --chown=hono:nodejs /app/packages/types/package.json ./packages/types/package.json
COPY --from=builder --chown=hono:nodejs /app/packages/types/node_modules ./packages/types/node_modules
COPY --from=builder --chown=hono:nodejs /app/packages/types/dist ./packages/types/dist
COPY --chown=hono:nodejs apps/api/docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x ./docker-entrypoint.sh
USER hono
EXPOSE 4000
ENTRYPOINT ["./docker-entrypoint.sh"]
