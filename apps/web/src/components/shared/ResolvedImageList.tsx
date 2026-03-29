import { useResolveViewUrls } from '@/hooks/useResolveViewUrls'
import { Image, Spin } from 'antd'

/**
 * Ảnh MinIO (bucket private): lấy presigned GET qua API để preview / phóng to được.
 */
export function ResolvedImageList({
  urls,
  label,
  compact,
}: {
  urls: string[]
  label?: string
  /** Hàng nhỏ trong card thanh toán */
  compact?: boolean
}) {
  const { data: resolved = {}, isLoading } = useResolveViewUrls(urls)
  if (urls.length === 0) return null
  const w = compact ? 72 : 96
  return (
    <div className="space-y-1">
      {label ? <div className="text-sm font-medium text-stone-600">{label}</div> : null}
      {isLoading ? (
        <Spin size="small" />
      ) : (
        <Image.PreviewGroup>
          <div className="flex flex-wrap gap-2">
            {urls.map((u) => (
              <Image
                key={u}
                src={resolved[u] ?? u}
                alt=""
                width={w}
                height={w}
                className="rounded border border-stone-200 object-cover"
              />
            ))}
          </div>
        </Image.PreviewGroup>
      )}
    </div>
  )
}
