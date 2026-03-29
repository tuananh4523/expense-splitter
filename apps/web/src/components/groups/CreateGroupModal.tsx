import { GroupForm } from '@/components/groups/GroupForm'
import { Modal, Typography } from 'antd'

export function CreateGroupModal({
  open,
  onCancel,
}: {
  open: boolean
  onCancel: () => void
}) {
  return (
    <Modal
      title="Tạo nhóm mới"
      open={open}
      onCancel={onCancel}
      footer={null}
      destroyOnClose
      width={560}
      centered
    >
      <Typography.Paragraph type="secondary" className="!mb-4 !mt-0">
        Đặt tên và mô tả ngắn cho nhóm chi tiêu.
      </Typography.Paragraph>
      <GroupForm />
    </Modal>
  )
}
