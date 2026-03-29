.PHONY: dev build up down migrate seed logs clean

dev:
	docker compose up -d && pnpm dev

build:
	docker compose -f docker-compose.prod.yml build

up:
	docker compose -f docker-compose.prod.yml up -d

down:
	docker compose -f docker-compose.prod.yml down

migrate:
	pnpm db:migrate

seed:
	pnpm db:seed

logs:
	docker compose -f docker-compose.prod.yml logs -f

clean:
	docker compose down -v
	rm -rf apps/api/dist apps/web/.next packages/types/dist packages/database/node_modules/.prisma
