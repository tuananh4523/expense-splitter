import { ExpenseWizardForm } from '@/components/expenses/ExpenseWizardForm'
import { Drawer } from 'antd'

export function EditExpenseDrawer({
  open,
  onClose,
  groupId,
  expenseId,
}: {
  open: boolean
  onClose: () => void
  groupId: string
  expenseId: string | null
}) {
  return (
    <Drawer
      title="Sửa chi tiêu"
      placement="right"
      width={560}
      open={open}
      onClose={onClose}
      destroyOnClose
      styles={{ body: { paddingTop: 20 } }}
    >
      {expenseId ? (
        <ExpenseWizardForm
          key={expenseId}
          mode="edit"
          groupId={groupId}
          expenseId={expenseId}
          onDone={onClose}
        />
      ) : null}
    </Drawer>
  )
}
