import { useUpload } from '@/hooks/useUpload'
import { MAX_IMAGE_UPLOAD_BYTES, MAX_IMAGE_UPLOAD_MB } from '@expense/types'
import { PlusOutlined } from '@ant-design/icons'
import { App, Spin, Upload } from 'antd'
import ImgCrop from 'antd-img-crop'
import { useEffect, useImperativeHandle, useLayoutEffect, useRef, useState } from 'react'

const ALLOWED = ['image/jpeg', 'image/png', 'image/webp']

/** Tỷ lệ cắt mặc định (rộng/cao) tới khi đo xong — gần banner desktop */
const COVER_ASPECT_FALLBACK = 3

export interface AvatarUploadRef {
  uploadPending: () => Promise<string | null>
  hasPending: boolean
}

/**
 * mode="avatar"  → crop tròn 1:1, preview hình tròn 80×80
 * mode="cover"   → crop + preview cùng tỷ lệ trang tổng quan: `h-40 w-full object-cover` (đo width/height thật → aspect cho ImgCrop)
 */
export function AvatarUpload({
  value,
  onChange,
  uploadRef,
  mode = 'avatar',
}: {
  value: string | null
  onChange: (url: string | null) => void
  uploadRef?: React.Ref<AvatarUploadRef>
  mode?: 'avatar' | 'cover'
}) {
  const { message } = App.useApp()
  const { upload } = useUpload()
  const [blobUrl, setBlobUrl] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)

  const pendingFileRef = useRef<File | null>(null)
  const blobUrlRef = useRef<string | null>(null)
  const onChangeRef = useRef(onChange)
  useEffect(() => { onChangeRef.current = onChange })

  const revokeBlob = (u: string | null) => {
    if (u?.startsWith('blob:')) URL.revokeObjectURL(u)
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => () => { if (blobUrlRef.current?.startsWith('blob:')) URL.revokeObjectURL(blobUrlRef.current) }, [])

  useImperativeHandle(uploadRef, () => ({
    get hasPending() { return pendingFileRef.current != null },
    uploadPending: async () => {
      const file = pendingFileRef.current
      if (!file) return null
      setUploading(true)
      try {
        const viewUrl = await upload(file, 'avatar')
        revokeBlob(blobUrlRef.current)
        blobUrlRef.current = null
        pendingFileRef.current = null
        setBlobUrl(null)
        onChangeRef.current(viewUrl)
        return viewUrl
      } catch (err) {
        message.error(err instanceof Error ? err.message : 'Upload thất bại')
        return null
      } finally {
        setUploading(false)
      }
    },
  }))

  const displaySrc = blobUrl ?? value ?? null

  const handleCropped = (file: File) => {
    const newBlob = URL.createObjectURL(file)
    revokeBlob(blobUrlRef.current)
    blobUrlRef.current = newBlob
    pendingFileRef.current = file
    setBlobUrl(newBlob)
    onChange(newBlob)
  }

  const isCover = mode === 'cover'
  const coverFrameRef = useRef<HTMLDivElement>(null)
  const [coverAspect, setCoverAspect] = useState(COVER_ASPECT_FALLBACK)

  useLayoutEffect(() => {
    if (!isCover) return
    const el = coverFrameRef.current
    if (!el) return
    const measure = () => {
      const { width, height } = el.getBoundingClientRect()
      if (width > 0 && height > 0) {
        const next = width / height
        setCoverAspect((prev) => (Math.abs(next - prev) < 0.02 ? prev : next))
      }
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [isCover])

  const cropComponent = (
    <ImgCrop
      rotationSlider
      aspectSlider={false}
      aspect={isCover ? coverAspect : 1}
      cropShape={isCover ? 'rect' : 'round'}
      showGrid
      modalTitle={isCover ? 'Cắt ảnh bìa' : 'Cắt ảnh đại diện'}
      modalOk="Xác nhận"
      modalCancel="Huỷ"
      beforeCrop={(file) => {
        if (!ALLOWED.includes(file.type)) {
          void message.error('Chỉ chấp nhận JPEG, PNG, WebP')
          return false
        }
        if (file.size > MAX_IMAGE_UPLOAD_BYTES) {
          void message.error(`Ảnh tối đa ${MAX_IMAGE_UPLOAD_MB}MB`)
          return false
        }
        return true
      }}
    >
      <Upload
        accept={ALLOWED.join(',')}
        showUploadList={false}
        customRequest={({ file }) => handleCropped(file as File)}
        {...(isCover
          ? {
              className: '[&]:relative [&]:block h-full w-full min-h-0',
              style: { display: 'block', width: '100%', height: '100%' } as const,
            }
          : {})}
      >
        {isCover ? (
          /* absolute fill — parent div controls actual size */
          <div
            className="absolute inset-0 flex cursor-pointer items-center justify-center"
            aria-label="Chọn ảnh bìa"
          >
            {uploading ? (
              <Spin />
            ) : displaySrc ? (
              <>
                <img
                  key={displaySrc}
                  src={displaySrc}
                  alt="Ảnh bìa"
                  className="h-full w-full object-cover"
                />
                <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 transition-opacity hover:opacity-100">
                  <span className="text-sm font-medium text-white">Đổi ảnh bìa</span>
                </div>
              </>
            ) : (
              <span className="flex flex-col items-center gap-1 text-stone-400">
                <PlusOutlined style={{ fontSize: 20 }} />
                <span className="text-sm">Chọn ảnh bìa</span>
              </span>
            )}
          </div>
        ) : (
          <button
            type="button"
            disabled={uploading}
            className="relative flex h-20 w-20 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-full border border-dashed border-stone-300 bg-stone-50 text-stone-500 outline-none transition hover:border-brand hover:bg-brand-soft/80 disabled:cursor-not-allowed"
            aria-label="Chọn ảnh đại diện"
          >
            {uploading ? (
              <Spin size="small" />
            ) : displaySrc ? (
              <>
                <img
                  key={displaySrc}
                  src={displaySrc}
                  alt="Avatar"
                  className="h-full w-full object-cover"
                />
                <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 transition-opacity hover:opacity-100">
                  <span className="text-xs font-medium text-white">Đổi ảnh</span>
                </div>
              </>
            ) : (
              <span className="flex flex-col items-center gap-0.5 px-1">
                <PlusOutlined />
                <span className="text-xs">Chọn ảnh</span>
              </span>
            )}
          </button>
        )}
      </Upload>
    </ImgCrop>
  )

  return (
    <div className="flex flex-col gap-2">
      {isCover ? (
        /* Khớp khung ảnh bìa trên /groups/[id] (tổng quan): h-40 + full width vùng nội dung */
        <div className="w-full overflow-hidden rounded-xl border border-dashed border-stone-300 bg-stone-50">
          <div ref={coverFrameRef} className="relative h-40 w-full">
            {cropComponent}
          </div>
        </div>
      ) : (
        cropComponent
      )}

      {displaySrc ? (
        <button
          type="button"
          className="text-xs text-stone-400 underline hover:text-stone-600"
          onClick={() => {
            revokeBlob(blobUrlRef.current)
            blobUrlRef.current = null
            pendingFileRef.current = null
            setBlobUrl(null)
            onChange(null)
          }}
        >
          Xoá ảnh
        </button>
      ) : null}
    </div>
  )
}
