import { EditExpenseDrawer } from '@/components/expenses/EditExpenseDrawer'
import { ExpenseDetailDrawer } from '@/components/expenses/ExpenseDetailDrawer'
import { ExpenseFilter } from '@/components/expenses/ExpenseFilter'
import { ExpenseList } from '@/components/expenses/ExpenseList'
import { NewExpenseDrawer } from '@/components/expenses/NewExpenseDrawer'
import { StandalonePaymentModal } from '@/components/expenses/StandalonePaymentModal'
import AppLayout from '@/components/layout/AppLayout'
import { useDeleteExpense, useExpenses, useRestoreExpense } from '@/hooks/useExpenses'
import { withAuth } from '@/utils/withAuth'
import { PlusOutlined } from '@ant-design/icons'
import type { ExpenseFilterInput } from '@expense/types'
import { App, Button } from 'antd'
import { useRouter } from 'next/router'
import { useEffect, useMemo, useState } from 'react'

export const getServerSideProps = withAuth()

export default function GroupExpensesPage() {
  const { message } = App.useApp()
  const router = useRouter()
  const groupId = typeof router.query.groupId === 'string' ? router.query.groupId : ''
  const [filters, setFilters] = useState<Partial<ExpenseFilterInput>>({
    page: 1,
    limit: 20,
    status: 'ACTIVE',
  })
  const [newDrawerOpen, setNewDrawerOpen] = useState(false)
  const [drawerExpenseId, setDrawerExpenseId] = useState<string | null>(null)
  const [editExpenseId, setEditExpenseId] = useState<string | null>(null)
  const [standaloneExpenseId, setStandaloneExpenseId] = useState<string | null>(null)
  const queryFilters = useMemo(
    () => ({ ...filters, page: filters.page ?? 1, limit: filters.limit ?? 20 }),
    [filters],
  )
  const { data, isLoading } = useExpenses(groupId, queryFilters)

  useEffect(() => {
    if (!router.isReady || !groupId) return
    const q = router.query.standalonePending
    if (q !== '1' && q !== 'true') return
    setFilters((f) => ({
      ...f,
      page: 1,
      standaloneIncomplete: true,
      dateFrom: undefined,
      dateTo: undefined,
      status: undefined,
      categoryId: undefined,
      isStandalone: undefined,
      paidByUserId: undefined,
    }))
    void router.replace(`/groups/${groupId}/expenses`, undefined, { shallow: true })
  }, [router.isReady, router.query.standalonePending, groupId, router])

  useEffect(() => {
    if (!router.isReady || !groupId) return
    const id = typeof router.query.openStandalone === 'string' ? router.query.openStandalone : null
    if (!id) return
    setStandaloneExpenseId(id)
    void router.replace(`/groups/${groupId}/expenses`, undefined, { shallow: true })
  }, [router.isReady, router.query.openStandalone, groupId, router])

  useEffect(() => {
    if (!router.isReady || !groupId) return
    const q = router.query.deletedBin
    if (q !== '1' && q !== 'true') return
    setFilters((f) => ({
      ...f,
      page: 1,
      includeDeleted: true,
      deletedOnly: true,
      standaloneIncomplete: undefined,
      status: undefined,
    }))
    void router.replace(`/groups/${groupId}/expenses`, undefined, { shallow: true })
  }, [router.isReady, router.query.deletedBin, groupId, router])
  const del = useDeleteExpense(groupId)
  const restore = useRestoreExpense(groupId)
  const isDeletedBinView = queryFilters.includeDeleted === true && queryFilters.deletedOnly === true

  if (!groupId) return null

  return (
    <AppLayout title="Chi tiêu">
      <div className="mb-4 flex justify-end">
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setNewDrawerOpen(true)}>
          Thêm chi tiêu
        </Button>
      </div>
      <div className="mb-4">
        <ExpenseFilter groupId={groupId} value={filters} onChange={setFilters} />
      </div>
      <ExpenseList
        groupId={groupId}
        data={data?.data ?? []}
        loading={isLoading}
        page={data?.page ?? 1}
        total={data?.total ?? 0}
        pageSize={data?.limit ?? 20}
        onPageChange={(p, ps) => setFilters((f) => ({ ...f, page: p, limit: ps }))}
        onRowOpen={(id) => setDrawerExpenseId(id)}
        onStandaloneOpen={(id) => setStandaloneExpenseId(id)}
        onEditOpen={(id) => setEditExpenseId(id)}
        {...(isDeletedBinView ? { emptyDescription: 'Chưa có chi tiêu đã xóa' } : {})}
        onDeleteExpense={(id) =>
          void del
            .mutateAsync(id)
            .then(() =>
              message.success('Chi tiêu đã xóa (Phạm vi «Đã xóa») — có thể khôi phục trong 7 ngày'),
            )
            .catch((e: Error) => message.error(e.message))  
        }
        onRestoreExpense={(id) =>
          void restore
            .mutateAsync(id)
            .then(() => message.success('Đã khôi phục chi tiêu'))
            .catch((e: Error) => message.error(e.message))
        }
      />
      <ExpenseDetailDrawer
        groupId={groupId}
        expenseId={drawerExpenseId}
        open={drawerExpenseId != null}
        onClose={() => setDrawerExpenseId(null)}
        onRequestEdit={(id) => {
          setDrawerExpenseId(null)
          setEditExpenseId(id)
        }}
      />
      <NewExpenseDrawer
        open={newDrawerOpen}
        onClose={() => setNewDrawerOpen(false)}
        groupId={groupId}
      />
      <EditExpenseDrawer
        open={editExpenseId != null}
        expenseId={editExpenseId}
        groupId={groupId}
        onClose={() => setEditExpenseId(null)}
      />
      {standaloneExpenseId ? (
        <StandalonePaymentModal
          open={standaloneExpenseId != null}
          onClose={() => setStandaloneExpenseId(null)}
          groupId={groupId}
          expenseId={standaloneExpenseId}
        />
      ) : null}
    </AppLayout>
  )
}
