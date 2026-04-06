import { useUpload } from '@/hooks/useUpload'
import { api } from '@/lib/api'
import { InboxOutlined } from '@ant-design/icons'
import { MAX_IMAGE_UPLOAD_BYTES, MAX_IMAGE_UPLOAD_MB } from '@expense/types'
import { useQuery } from '@tanstack/react-query'
import type { UploadFile, UploadProps } from 'antd'
import { App, Upload } from 'antd'
import { useMemo } from 'react'

const { Dragger } = Upload

const ALLOWED = ['image/jpeg', 'image/png', 'image/webp']

export function FileUpload({
  value,
  onChange,
  groupId,
  uploadType,
}: {
  value: string[]
  onChange: (urls: string[]) => void
  /** Bắt buộc với expense / payment; bỏ qua với avatar (upload cá nhân). */
  groupId?: string
  uploadType: 'expense' | 'payment' | 'avatar'
}) {
  const { message } = App.useApp()
  const { upload } = useUpload()

  const resolveKey = useMemo(() => [...value].sort().join('\0'), [value])
  const { data: resolved = {} } = useQuery({
    queryKey: ['resolve-views', resolveKey],
    queryFn: async () => {
      if (value.length === 0) return {}
      const { data } = await api.post<{ data: { resolved: Record<string, string> } }>(
        '/upload/resolve-views',
        { urls: value },
      )
      return data.data.resolved
    },
    enabled: value.length > 0,
    staleTime: 60_000,
  })

  /** uid = URL lưu trữ (viewUrl gốc) để onRemove khớp với `value` — không dùng URL presigned làm khóa. */
  const fileList: UploadFile[] = value.map((url, i) => {
    const show = resolved[url] ?? url
    return {
      uid: url,
      name: `Ảnh ${i + 1}`,
      status: 'done',
      url: show,
      thumbUrl: show,
    }
  })

  const props: UploadProps = {
    name: 'file',
    multiple: true,
    fileList,
    listType: 'picture-card',
    showUploadList: { showRemoveIcon: true },
    customRequest: async ({ file, onSuccess, onError }) => {
      try {
        if (uploadType !== 'avatar' && !groupId) {
          message.error('Thiếu thông tin nhóm')
          onError?.(new Error('Thiếu groupId'))
          return
        }
        const f = file as File
        const url = await upload(f, uploadType, groupId)
        onSuccess?.(url)
        onChange([...value, url])
      } catch (e) {
        message.error(e instanceof Error ? e.message : 'Upload thất bại')
        onError?.(e as Error)
      }
    },
    beforeUpload: (file) => {
      if (!ALLOWED.includes(file.type)) {
        message.error('Chỉ chấp nhận JPEG, PNG, WebP')
        return Upload.LIST_IGNORE
      }
      if (file.size > MAX_IMAGE_UPLOAD_BYTES) {
        message.error(`Ảnh tối đa ${MAX_IMAGE_UPLOAD_MB}MB`)
        return Upload.LIST_IGNORE
      }
      return true
    },
    onRemove: (file) => {
      const key = typeof file.uid === 'string' ? file.uid : ''
      if (key && value.includes(key)) {
        onChange(value.filter((x) => x !== key))
      } else {
        const show = file.url ?? file.thumbUrl
        const fromResolved = show ? value.find((v) => (resolved[v] ?? v) === show) : undefined
        if (fromResolved) onChange(value.filter((x) => x !== fromResolved))
        else onChange(value)
      }
      return true
    },
  }

  return (
    <Dragger {...props}>
      <p className="ant-upload-drag-icon">
        <InboxOutlined />
      </p>
      <p className="ant-upload-text">Kéo thả ảnh hoặc bấm để chọn</p>
      <p className="ant-upload-hint">JPEG, PNG, WebP — tối đa {MAX_IMAGE_UPLOAD_MB}MB</p>
    </Dragger>
  )
}
