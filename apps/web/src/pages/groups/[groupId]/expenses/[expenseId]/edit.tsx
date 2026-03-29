import { ExpenseWizardForm } from '@/components/expenses/ExpenseWizardForm'
import AppLayout from '@/components/layout/AppLayout'
import { withAuth } from '@/utils/withAuth'
import { Typography } from 'antd'
import { useRouter } from 'next/router'

export const getServerSideProps = withAuth()

export default function EditExpensePage() {
  const router = useRouter()
  const groupId = typeof router.query.groupId === 'string' ? router.query.groupId : ''
  const expenseId = typeof router.query.expenseId === 'string' ? router.query.expenseId : ''

  if (!groupId || !expenseId) return null

  return (
    <AppLayout title="Sửa chi tiêu">
      <Typography.Title level={4} className="!mb-8">
        Sửa chi tiêu
      </Typography.Title>
      <ExpenseWizardForm
        mode="edit"
        groupId={groupId}
        expenseId={expenseId}
        onDone={() => void router.replace(`/groups/${groupId}/expenses`)}
      />
    </AppLayout>
  )
}
