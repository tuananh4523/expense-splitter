import { Icon } from '@iconify/react'

/** Hiển thị danh mục với màu đã cấu hình (icon Iconify + tên). */
export function CategoryLabel({
  name,
  icon,
  color,
  iconSize = 14,
  className,
}: {
  name: string
  icon: string | null
  color?: string | null
  iconSize?: number
  className?: string
}) {
  const accent = color?.trim() ? color.trim() : undefined
  return (
    <span
      className={`inline-flex max-w-full items-center gap-1 ${className ?? ''}`}
      style={accent ? { color: accent } : undefined}
    >
      {icon ? (
        icon.includes(':') ? (
          <Icon icon={icon} width={iconSize} className="shrink-0" style={{ color: 'inherit' }} />
        ) : (
          <span className="shrink-0">{icon}</span>
        )
      ) : null}
      <span className="min-w-0 truncate">{name}</span>
    </span>
  )
}
