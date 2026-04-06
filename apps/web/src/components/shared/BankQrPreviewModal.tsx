import { Modal, Typography } from 'antd'
import { useEffect, useState } from 'react'

/** Cao hơn Drawer (1000) để modal không bị che khi mở từ drawer hồ sơ. */
const QR_MODAL_Z = 1200

export function BankQrPreviewModal({
  open,
  imageUrl,
  onClose,
  title = 'Mã QR chuyển khoản',
}: {
  open: boolean
  imageUrl: string | null
  onClose: () => void
  title?: string
}) {
  const [loadError, setLoadError] = useState(false)

  useEffect(() => {
    if (open) setLoadError(false)
  }, [open, imageUrl])

  return (
    <Modal
      open={open}
      title={title}
      onCancel={onClose}
      footer={null}
      width={440}
      centered
      destroyOnClose
      zIndex={QR_MODAL_Z}
      styles={{ mask: { zIndex: QR_MODAL_Z - 1 }, wrapper: { zIndex: QR_MODAL_Z } }}
    >
      {imageUrl && !loadError ? (
        // eslint-disable-next-line @next/next/no-img-element -- URL presigned từ API
        <img
          src={imageUrl}
          alt="Mã QR chuyển khoản"
          className="mx-auto block max-h-[min(72vh,560px)] w-full max-w-sm object-contain"
          onError={() => setLoadError(true)}
        />
      ) : null}
      {imageUrl && loadError ? (
        <Typography.Paragraph type="danger" className="!mb-0 text-center text-sm">
          Không tải được ảnh QR (hết hạn liên kết hoặc lỗi mạng). Thử đóng và mở lại, hoặc tải lại
          trang.
        </Typography.Paragraph>
      ) : null}
      {!imageUrl && open ? (
        <Typography.Text type="secondary" className="block text-center text-sm">
          Chưa có liên kết ảnh.
        </Typography.Text>
      ) : null}
    </Modal>
  )
}
