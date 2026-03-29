import { FileUpload } from '@/components/shared/FileUpload'
import { MoneyInputNumber } from '@/components/shared/MoneyInputNumber'
import { useContribute } from '@/hooks/useFund'
import { formatMoneyInputVN, parseMoneyInputVN } from '@/utils/currency'
import type { ContributeFundInput } from '@expense/types'
import { contributeFundSchema, MAX_IMAGE_UPLOAD_MB } from '@expense/types'
import { zodResolver } from '@hookform/resolvers/zod'
import { App, Button, Form, Input, Modal, Typography } from 'antd'
import { Controller, useForm } from 'react-hook-form'

/** Modal gửi yêu cầu nộp quỹ (không dùng Alert — tránh ReferenceError nếu thiếu import). */
export function ContributeModal({
  open,
  onClose,
  groupId,
}: {
  open: boolean
  onClose: () => void
  groupId: string
}) {
  const { message } = App.useApp()
  const contribute = useContribute(groupId)
  const { control, handleSubmit, reset, formState } = useForm<ContributeFundInput>({
    resolver: zodResolver(contributeFundSchema),
    defaultValues: { amount: 100_000, note: undefined, proofImageUrls: [] },
  })

  const onSubmit = handleSubmit(async (data) => {
    try {
      await contribute.mutateAsync(data)
      message.success('Đã gửi yêu cầu nộp quỹ — chờ trưởng nhóm, phó nhóm hoặc quản trị duyệt')
      reset()
      onClose()
    } catch (e) {
      message.error(e instanceof Error ? e.message : 'Thất bại')
    }
  })

  return (
    <Modal
      open={open}
      onCancel={() => {
        reset()
        onClose()
      }}
      title="Đóng quỹ"
      footer={null}
      destroyOnClose
      width={600}
      className="[&_.ant-modal-content]:overflow-hidden [&_.ant-modal-content]:rounded-2xl"
    >
      <Form layout="vertical" onFinish={() => void onSubmit()}>
        <Form.Item
          label="Số tiền (VND)"
          validateStatus={formState.errors.amount ? 'error' : ''}
          help={formState.errors.amount?.message}
        >
          <Controller
            name="amount"
            control={control}
            render={({ field }) => (
              <MoneyInputNumber
                style={{ width: '100%' }}
                min={1}
                value={field.value}
                onChange={(v) => field.onChange(typeof v === 'number' ? v : 0)}
                formatter={(v) => formatMoneyInputVN(v as number | string | undefined)}
                parser={(v) => parseMoneyInputVN(v ?? undefined)}
              />
            )}
          />
        </Form.Item>
        <Form.Item label="Ghi chú (tuỳ chọn)">
          <Controller
            name="note"
            control={control}
            render={({ field }) => <Input.TextArea {...field} rows={3} maxLength={200} showCount />}
          />
        </Form.Item>
        <Form.Item
          label="Ảnh chứng từ (bắt buộc)"
          validateStatus={formState.errors.proofImageUrls ? 'error' : ''}
          help={formState.errors.proofImageUrls?.message as string | undefined}
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
        <Typography.Text type="secondary" className="mb-0 block text-xs">
          JPEG, PNG, WebP — tối đa {MAX_IMAGE_UPLOAD_MB}MB mỗi ảnh.
        </Typography.Text>
        <div className="mt-6 flex flex-wrap justify-end gap-2">
          <Button
            onClick={() => {
              reset()
              onClose()
            }}
          >
            Huỷ
          </Button>
          <Button type="primary" htmlType="submit" loading={contribute.isPending}>
            Gửi yêu cầu nộp quỹ
          </Button>
        </div>
      </Form>
    </Modal>
  )
}
