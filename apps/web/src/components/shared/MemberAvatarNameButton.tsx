import type { UserDto } from '@expense/types'
import { Avatar } from 'antd'
import clsx from 'clsx'

type UserRef = Pick<UserDto, 'id' | 'name' | 'avatarUrl'>

export function MemberAvatarNameButton({
  userId,
  user,
  size = 32,
  className,
  onOpen,
}: {
  userId: string
  user: UserRef
  size?: number
  className?: string
  onOpen: (userId: string, user: UserRef) => void
}) {
  return (
    <button
      type="button"
      className={clsx(
        'flex min-w-0 max-w-full cursor-pointer items-center gap-2 rounded-lg border-0 bg-transparent p-1 text-left transition-colors hover:bg-stone-100',
        className,
      )}
      onClick={(e) => {
        e.stopPropagation()
        onOpen(userId, user)
      }}
      onMouseDown={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          e.stopPropagation()
          onOpen(userId, user)
        }
      }}
    >
      <Avatar
        src={user.avatarUrl ?? undefined}
        size={size}
        className="shrink-0 !bg-brand-soft !font-semibold !text-brand-text"
      >
        {user.name[0]?.toUpperCase()}
      </Avatar>
      <span className="min-w-0 truncate font-medium leading-tight text-stone-900">{user.name}</span>
    </button>
  )
}
