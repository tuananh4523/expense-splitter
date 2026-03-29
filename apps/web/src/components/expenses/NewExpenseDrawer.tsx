import { ExpenseWizardForm } from '@/components/expenses/ExpenseWizardForm'
import { Drawer } from 'antd'

export function NewExpenseDrawer({
  open,
  onClose,
  groupId,
}: {
  open: boolean
  onClose: () => void
  groupId: string
}) {
  return (
    <Drawer
      title="Thêm chi tiêu"
      open={open}
      onClose={onClose}
      width={560}
      destroyOnClose
      styles={{ body: { paddingTop: 20 } }}
    >
      <ExpenseWizardForm mode="create" groupId={groupId} onDone={onClose} onCancel={onClose} />
    </Drawer>
  )
}
