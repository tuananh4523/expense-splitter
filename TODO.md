# TODO: Fix Errors - Complete Implementation Plan

✅ **Phase 0: Planning & Tracking** - DONE

**Phase 1: Prisma Schema**
- [ ] Edit schema.prisma: Category groupId + composite unique, Expense deletedAt + index
- [ ] `npx prisma generate && npx prisma db push`
- [ ] Verify no data loss/migration OK

**Phase 2: API Backend**
- [ ] Fix cron.service.ts: Remove @ts-ignore, add Expense cleanup cron (deletedAt >14d)
- [ ] Edit expenses.ts: Soft DELETE/restore endpoints, filter lists, audit snapshots
- [ ] Create routes/categories.ts: CRUD with groupId filter
- [ ] Update routes/cron.ts: Test endpoints
- [ ] `pnpm --filter @expense/api build` - fix TS

**Phase 3: Types**
- [ ] packages/types/src/schemas.ts: New zod for restore/categories
- [ ] packages/types/src/api.ts: Route updates

**Phase 4: Frontend (Optional)**
- [ ] Group settings: Categories UI
- [ ] Activity page: Trash/restore
- [ ] Hooks/expenses: deleted filter toggle

**Phase 5: Test & Cleanup**
- [ ] Manual: create/delete/restore expense, group cats
- [ ] Run cron test
- [ ] Update README/TODO

**Commands to run after each phase:**
```
pnpm install
npx prisma generate
pnpm --filter @expense/api build
pnpm dev
```

