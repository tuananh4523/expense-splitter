import { Icon } from '@iconify/react'
import { Card, Spin, Typography } from 'antd'
import Link from 'next/link'
import type { ReactNode } from 'react'

export type HighlightVariant = 'indigo' | 'rose' | 'emerald' | 'amber' | 'teal' | 'violet'

const VARIANT_ICON: Record<HighlightVariant, { accent: string; iconBg: string }> = {
  indigo: { accent: '#0073AA', iconBg: '#E5F4FA' },
  rose: { accent: '#D63638', iconBg: '#FCF0F1' },
  emerald: { accent: '#00A32A', iconBg: '#EDFAEF' },
  amber: { accent: '#D54E21', iconBg: '#FCF9E8' },
  teal: { accent: '#2271B1', iconBg: '#E5F4FA' },
  violet: { accent: '#005A87', iconBg: '#E5F4FA' },
}

export function OverviewHighlightCard({
  variant,
  title,
  description,
  icon,
  children,
  loading,
  href,
  showChevron,
  className,
  onClick,
}: {
  variant: HighlightVariant
  title: string
  description?: string
  icon: string
  children?: ReactNode
  loading?: boolean
  href?: string
  showChevron?: boolean
  className?: string
  onClick?: () => void
}) {
  const { accent, iconBg } = VARIANT_ICON[variant]
  const tileClass = ['highlight-tile', `highlight-tile--${variant}`, className].filter(Boolean).join(' ')

  const body = (
    <div className="highlight-tile__inner">
      <div
        className="highlight-tile__icon"
        style={{ background: iconBg, color: accent }}
      >
        <Icon icon={icon} width={24} />
      </div>
      <div className="highlight-tile__main">
        <div className="highlight-tile__head">
          <Typography.Text className="highlight-tile__title">{title}</Typography.Text>
          {showChevron ? (
            <Icon icon="mdi:chevron-right" width={22} className="highlight-tile__chevron" aria-hidden />
          ) : null}
        </div>
        {description ? (
          <Typography.Text className="highlight-tile__desc block">{description}</Typography.Text>
        ) : null}
        {loading || children != null ? (
          <div className="highlight-tile__value min-w-0">
            {loading ? <Spin size="small" /> : children}
          </div>
        ) : null}
      </div>
    </div>
  )

  const card = (
    <Card
      hoverable={Boolean(href || onClick)}
      className={tileClass}
      onClick={onClick}
    >
      {body}
    </Card>
  )

  if (href) {
    return (
      <Link href={href} className="block h-full min-w-0 text-inherit no-underline hover:text-inherit hover:no-underline">
        {card}
      </Link>
    )
  }

  return card
}
