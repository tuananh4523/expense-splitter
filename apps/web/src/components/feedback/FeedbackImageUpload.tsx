import { useUpload } from '@/hooks/useUpload'
import { api } from '@/lib/api'
import { InboxOutlined } from '@ant-design/icons'
import { MAX_IMAGE_UPLOAD_BYTES, MAX_IMAGE_UPLOAD_MB } from '@expense/types'
import { useQuery } from '@tanstack/react-query'
import type { UploadFile, UploadProps } from 'antd'
import { App, Upload } from 'antd'
import { useMemo } from 'react'

const { Dragger } = Upload

const ALLOWED = ['image/jpeg', 'image/png', 'image/webp', 'image/heic']

export function FeedbackImageUpload({
  value,
  onChange,
  maxCount = 10,
}: {
  value: string[]
  onChange: (urls: string[]) => void
  maxCount?: number
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

  const fileList: UploadFile[] = value.map((url) => {
    const show = resolved[url] ?? url
    return {
      uid: url,
      name: 'Ảnh',
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
    customRequest: async ({ file, onSuccess, onError }) => {
      try {
        if (value.length >= maxCount) {
          message.error(`Tối đa ${maxCount} ảnh`)
          onError?.(new Error('limit'))
          return
        }
        const f = file as File
        const url = await upload(f, 'feedback')
        onSuccess?.(url)
        onChange([...value, url])
      } catch (e) {
        message.error(e instanceof Error ? e.message : 'Upload thất bại')
        onError?.(e as Error)
      }
    },
    beforeUpload: (file) => {
      if (!ALLOWED.includes(file.type)) {
        message.error('Chỉ chấp nhận JPEG, PNG, WebP, HEIC')
        return Upload.LIST_IGNORE
      }
      if (file.size > MAX_IMAGE_UPLOAD_BYTES) {
        message.error(`Ảnh tối đa ${MAX_IMAGE_UPLOAD_MB}MB`)
        return Upload.LIST_IGNORE
      }
      if (value.length >= maxCount) {
        message.error(`Tối đa ${maxCount} ảnh`)
        return Upload.LIST_IGNORE
      }
      return true
    },
    onRemove: (file) => {
      const uid = typeof file.uid === 'string' ? file.uid : ''
      onChange(value.filter((x) => x !== uid))
      return true
    },
  }

  return (
    <Dragger {...props}>
      <p className="ant-upload-drag-icon">
        <InboxOutlined />
      </p>
      <p className="ant-upload-text">Kéo thả ảnh minh họa hoặc bấm để chọn</p>
      <p className="ant-upload-hint">
        JPEG, PNG, WebP, HEIC — tối đa {MAX_IMAGE_UPLOAD_MB}MB — tối đa {maxCount} ảnh
      </p>
    </Dragger>
  )
}
