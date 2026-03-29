import { CurrencyDisplay } from '@/components/shared/CurrencyDisplay'
import { FileUpload } from '@/components/shared/FileUpload'
import { useConfirmPayment } from '@/hooks/useSettlement'
import type { PaymentRecordDto } from '@expense/types'
import { confirmPaymentSchema } from '@expense/types'
import { zodResolver } from '@hookform/resolvers/zod'
import { App, Button, Form, Input, Modal } from 'antd'
import { Controller, useForm } from 'react-hook-form'
import type { z } from 'zod'

type FormValues = z.infer<typeof confirmPaymentSchema>

export function ConfirmPaymentModal({
  open,
  onClose,
  groupId,
  settlementId,
  record,
}: {
  open: boolean
  onClose: () => void
  groupId: string
  settlementId: string
  record: PaymentRecordDto | null
}) {
  const { message } = App.useApp()
  const confirm = useConfirmPayment(groupId, settlementId)
  const { control, handleSubmit, reset, formState } = useForm<FormValues>({
    resolver: zodResolver(confirmPaymentSchema),
    defaultValues: { proofImageUrls: [], comment: undefined },
  })

  const onSubmit = handleSubmit(async (data) => {
    if (!record) return
    try {
      await confirm.mutateAsync({ paymentRecordId: record.id, ...data })
      message.success('Đã gửi xác nhận')
      reset()
      onClose()
    } catch (e) {
      message.error(e instanceof Error ? e.message : 'Thất bại')
    }
  })

  return (
    <Modal
      open={open}
      onCancel={onClose}
      title="Xác nhận chuyển tiền"
      footer={null}
      destroyOnClose
      width={560}
    >
      {record ? (
        <div className="mb-4">
          <p>
            Số tiền: <CurrencyDisplay amount={record.amount} className="font-semibold" />
          </p>
          <p className="text-gray-600">Người nhận: {record.receiver.name}</p>
        </div>
      ) : null}
      <Form layout="vertical" onFinish={() => void onSubmit()}>
        <Form.Item
          label="Ảnh chứng từ (bắt buộc)"
          validateStatus={formState.errors.proofImageUrls ? 'error' : ''}
          help={formState.errors.proofImageUrls?.message}
        >
          <Controller
            name="proofImageUrls"
            control={control}
            render={({ field }) => (
              <FileUpload
                value={field.value}
                onChange={field.onChange}
                groupId={groupId}
                uploadType="payment"
              />
            )}
          />
        </Form.Item>
        <Form.Item label="Ghi chú">
          <Controller
            name="comment"
            control={control}
            render={({ field }) => <Input.TextArea {...field} rows={2} />}
          />
        </Form.Item>
        <Button type="primary" htmlType="submit" loading={confirm.isPending} block>
          Xác nhận đã chuyển tiền
        </Button>
      </Form>
    </Modal>
  )
}
