import { ExpenseWizardForm } from '@/components/expenses/ExpenseWizardForm'
import AppLayout from '@/components/layout/AppLayout'
import { withAuth } from '@/utils/withAuth'
import { Typography } from 'antd'
import { useRouter } from 'next/router'

export const getServerSideProps = withAuth()

export default function NewExpensePage() {
  const router = useRouter()
  const groupId = typeof router.query.groupId === 'string' ? router.query.groupId : ''

  if (!groupId) return null

  return (
    <AppLayout title="Chi tiêu mới">
      <Typography.Title level={4} className="!mb-8">
        Thêm chi tiêu
      </Typography.Title>
      <ExpenseWizardForm mode="create" groupId={groupId} onDone={() => {}} />
    </AppLayout>
  )
}
