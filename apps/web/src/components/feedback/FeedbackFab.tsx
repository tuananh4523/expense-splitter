import { FeedbackImageUpload } from '@/components/feedback/FeedbackImageUpload'
import { api } from '@/lib/api'
import { Icon } from '@iconify/react'
import { App, Button, Form, Input, Modal, Rate, Select } from 'antd'
import { useSession } from 'next-auth/react'
import { useCallback, useState } from 'react'

type FeedbackKind = 'PRAISE' | 'ISSUE'

export function FeedbackFab() {
  const { message } = App.useApp()
  const { status } = useSession()
  const [open, setOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [form] = Form.useForm<{ kind: FeedbackKind; rating?: number; title?: string; description?: string }>()
  const [images, setImages] = useState<string[]>([])
  const kind = Form.useWatch('kind', form)

  const handleOpen = useCallback(() => {
    setOpen(true)
    form.setFieldsValue({ kind: 'PRAISE', rating: 5 })
    setImages([])
  }, [form])

  const handleClose = useCallback(() => {
    setOpen(false)
    form.resetFields()
    setImages([])
  }, [form])

  const onFinish = async (values: {
    kind: FeedbackKind
    rating?: number
    title?: string
    description?: string
  }) => {
    setSubmitting(true)
    try {
      if (values.kind === 'PRAISE') {
        const rating = values.rating ?? 5
        await api.post('/feedback', {
          type: 'PRAISE',
          rating,
          title: values.title?.trim() || undefined,
          description: values.description?.trim() || undefined,
        })
        handleClose()
        window.setTimeout(() => {
          message.open({
            type: 'success',
            content: 'Cảm ơn bạn đã đánh giá! Phản hồi đã được ghi nhận.',
            duration: 4,
          })
        }, 0)
      } else {
        await api.post('/feedback', {
          type: 'ISSUE',
          title: values.title?.trim(),
          description: values.description?.trim(),
          imageUrls: images,
        })
        handleClose()
        window.setTimeout(() => {
          message.open({
            type: 'success',
            content: 'Đã gửi báo cáo. Đội ngũ sẽ xem xét sớm.',
            duration: 4,
          })
        }, 0)
      }
    } catch (e: unknown) {
      message.open({
        type: 'error',
        content: e instanceof Error ? e.message : 'Gửi thất bại, thử lại sau',
        duration: 5,
      })
    } finally {
      setSubmitting(false)
    }
  }

  if (status !== 'authenticated') return null

  return (
    <>
      <button
        type="button"
        className="feedback-fab"
        onClick={handleOpen}
        aria-label="Góp ý và phản hồi"
        title="Góp ý / Báo lỗi"
      >
        <Icon icon="mdi:message-text-outline" width={26} />
      </button>

      <Modal
        title="Góp ý & phản hồi"
        open={open}
        onCancel={handleClose}
        footer={null}
        destroyOnClose
        width={480}
      >
        <Form form={form} layout="vertical" onFinish={onFinish} initialValues={{ kind: 'PRAISE', rating: 5 }}>
          <Form.Item
            name="kind"
            label="Bạn muốn"
            rules={[{ required: true, message: 'Chọn loại phản hồi' }]}
          >
            <Select
              options={[
                { value: 'PRAISE', label: 'Đánh giá tốt (cho sao)' },
                { value: 'ISSUE', label: 'Báo vấn đề / góp ý sửa lỗi' },
              ]}
            />
          </Form.Item>

          {kind === 'PRAISE' ? (
            <>
              <Form.Item
                name="rating"
                label="Số sao"
                rules={[{ required: true, message: 'Chọn số sao' }]}
              >
                <Rate />
              </Form.Item>
              <Form.Item name="title" label="Tiêu đề (tuỳ chọn)">
                <Input placeholder="Ví dụ: Giao diện dễ dùng" maxLength={200} showCount />
              </Form.Item>
              <Form.Item name="description" label="Lời nhắn (tuỳ chọn)">
                <Input.TextArea rows={3} placeholder="Chia sẻ thêm…" maxLength={2000} showCount />
              </Form.Item>
            </>
          ) : (
            <>
              <Form.Item
                name="title"
                label="Tiêu đề vấn đề"
                rules={[{ required: true, message: 'Nhập tiêu đề' }]}
              >
                <Input placeholder="Tóm tắt ngắn" maxLength={200} showCount />
              </Form.Item>
              <Form.Item
                name="description"
                label="Mô tả chi tiết"
                rules={[{ required: true, message: 'Nhập mô tả' }]}
              >
                <Input.TextArea rows={4} placeholder="Các bước tái hiện, kỳ vọng…" maxLength={5000} showCount />
              </Form.Item>
              <Form.Item label="Ảnh minh họa (tuỳ chọn)">
                <FeedbackImageUpload value={images} onChange={setImages} maxCount={10} />
              </Form.Item>
            </>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button onClick={handleClose}>Huỷ</Button>
            <Button type="primary" htmlType="submit" loading={submitting}>
              Gửi
            </Button>
          </div>
        </Form>
      </Modal>
    </>
  )
}
