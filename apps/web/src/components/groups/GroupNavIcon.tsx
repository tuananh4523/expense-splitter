import type { GroupDto } from '@expense/types'
import { Icon } from '@iconify/react'

export function GroupNavIcon({
  group,
  size = 18,
}: {
  group: Pick<GroupDto, 'name' | 'icon' | 'color' | 'avatarUrl'>
  size?: number
}) {
  const color = group.color ?? '#C4B5FD'
  const radius = Math.round(size * 0.28)
  const containerStyle: object = {
    width: size,
    height: size,
    borderRadius: radius,
    background: `${color}30`,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  }

  if (group.icon?.includes(':')) {
    return (
      <span style={containerStyle}>
        <Icon icon={group.icon} width={size * 0.62} color={color} />
      </span>
    )
  }
  if (group.icon) {
    return (
      <span style={containerStyle}>
        <span style={{ fontSize: size * 0.62, lineHeight: 1 }}>{group.icon}</span>
      </span>
    )
  }
  return (
    <span style={containerStyle}>
      <Icon icon="mdi:account-group" width={size * 0.62} color={color} />
    </span>
  )
}
