import { api } from '@/lib/api'
import axios from 'axios'

export function useUpload() {
  const upload = async (
    file: File,
    type: 'expense' | 'payment' | 'avatar' | 'feedback' | 'bankQr',
    groupId?: string,
  ): Promise<string> => {
    const body: {
      filename: string
      contentType: string
      uploadType: 'expense' | 'payment' | 'avatar' | 'feedback' | 'bankQr'
      fileSizeBytes: number
      groupId?: string
    } = {
      filename: file.name,
      contentType: file.type,
      uploadType: type,
      fileSizeBytes: file.size,
    }
    if (type !== 'avatar' && type !== 'feedback' && type !== 'bankQr') {
      if (!groupId) throw new Error('Thiếu groupId')
      body.groupId = groupId
    }
    const { data } = await api.post<{
      data: { uploadUrl: string; objectName: string; viewUrl: string }
    }>('/upload/presign', body)
    const { uploadUrl, viewUrl } = data.data
    await axios.put(uploadUrl, file, { headers: { 'Content-Type': file.type } })
    return viewUrl
  }
  return { upload }
}
