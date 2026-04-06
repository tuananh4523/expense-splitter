import { Icon } from '@iconify/react'
import { Button, Typography } from 'antd'

type FilterVariant = 'owe' | 'owed' | 'settlement_pending'

const VARIANT: Record<
  FilterVariant,
  { icon: string; accent: string; iconBg: string; border: string; surface: string; kicker: string }
> = {
  owe: {
    icon: 'mdi:trending-down',
    accent: '#b32d00',
    iconBg: '#fce8e8',
    border: 'border-rose-200',
    surface: 'bg-[#fff5f5]',
    kicker: 'text-rose-800',
  },
  owed: {
    icon: 'mdi:trending-up',
    accent: '#00a32a',
    iconBg: '#edfaef',
    border: 'border-emerald-200',
    surface: 'bg-[#f0fdf4]',
    kicker: 'text-emerald-900',
  },
  settlement_pending: {
    icon: 'mdi:clipboard-clock-outline',
    accent: '#d54e21',
    iconBg: '#fcf9e8',
    border: 'border-amber-200',
    surface: 'bg-[#fffbeb]',
    kicker: 'text-amber-950',
  },
}

export function GroupsFilterCallout({
  variant,
  title,
  description,
  onClear,
}: {
  variant: FilterVariant
  title: string
  description: string
  onClear: () => void
}) {
  const v = VARIANT[variant]
  return (
    <div
      className={`mb-6 overflow-hidden rounded-2xl border shadow-sm ${v.border} ${v.surface}`}
      role="status"
    >
      <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
        <div className="flex min-w-0 gap-4">
          <div
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl shadow-sm ring-1 ring-stone-900/5"
            style={{ background: v.iconBg, color: v.accent }}
          >
            <Icon icon={v.icon} width={26} aria-hidden />
          </div>
          <div className="min-w-0 flex-1">
            <div className={`mb-1 text-[11px] font-bold uppercase tracking-wider ${v.kicker}`}>
              Đang lọc danh sách
            </div>
            <Typography.Title level={5} className="!mb-1 !mt-0 text-stone-900">
              {title}
            </Typography.Title>
            <Typography.Paragraph
              type="secondary"
              className="!mb-0 max-w-2xl text-sm leading-relaxed"
            >
              {description}
            </Typography.Paragraph>
          </div>
        </div>
        <Button
          type="default"
          className="shrink-0 border-stone-300 bg-white font-semibold shadow-sm"
          onClick={onClear}
        >
          Xem tất cả nhóm
        </Button>
      </div>
    </div>
  )
}
