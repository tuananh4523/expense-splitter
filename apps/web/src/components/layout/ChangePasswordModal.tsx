import { useChangePassword } from '@/hooks/useProfile'
import { App, Button, Form, Input, Modal } from 'antd'
import { useEffect, useState } from 'react'

export function ChangePasswordModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { message } = App.useApp()
  const changePw = useChangePassword()
  const [pwCurrent, setPwCurrent] = useState('')
  const [pwNew, setPwNew] = useState('')
  const [pwConfirm, setPwConfirm] = useState('')

  useEffect(() => {
    if (!open) return
    setPwCurrent('')
    setPwNew('')
    setPwConfirm('')
  }, [open])

  const submit = () => {
    if (pwNew.length < 6) {
      message.error('Mật khẩu mới tối thiểu 6 ký tự')
      return
    }
    if (pwNew !== pwConfirm) {
      message.error('Xác nhận mật khẩu không khớp')
      return
    }
    void changePw
      .mutateAsync({ currentPassword: pwCurrent, newPassword: pwNew })
      .then(() => {
        message.success('Đã đổi mật khẩu')
        onClose()
      })
      .catch((e) => message.error(e instanceof Error ? e.message : 'Lỗi'))
  }

  return (
    <Modal
      title="Đổi mật khẩu"
      open={open}
      onCancel={onClose}
      destroyOnClose
      footer={[
        <Button key="cancel" onClick={onClose}>
          Hủy
        </Button>,
        <Button key="ok" type="primary" loading={changePw.isPending} onClick={() => submit()}>
          Đổi mật khẩu
        </Button>,
      ]}
      width={440}
    >
      <Form layout="vertical" requiredMark={false} className="pt-1">
        <Form.Item label="Mật khẩu hiện tại">
          <Input.Password
            value={pwCurrent}
            onChange={(e) => setPwCurrent(e.target.value)}
            autoComplete="current-password"
          />
        </Form.Item>
        <Form.Item label="Mật khẩu mới" help="Tối thiểu 6 ký tự">
          <Input.Password
            value={pwNew}
            onChange={(e) => setPwNew(e.target.value)}
            autoComplete="new-password"
          />
        </Form.Item>
        <Form.Item label="Xác nhận mật khẩu mới">
          <Input.Password
            value={pwConfirm}
            onChange={(e) => setPwConfirm(e.target.value)}
            autoComplete="new-password"
          />
        </Form.Item>
      </Form>
    </Modal>
  )
}
