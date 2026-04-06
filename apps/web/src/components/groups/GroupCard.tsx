import { CurrencyDisplay } from '@/components/shared/CurrencyDisplay'
import { fmtDate } from '@/utils/date'
import { BankOutlined, TeamOutlined } from '@ant-design/icons'
import type { GroupDto } from '@expense/types'
import { Icon } from '@iconify/react'
import { Avatar, Card, Tag, Typography } from 'antd'
import { useRouter } from 'next/router'

function groupVisual(group: GroupDto) {
  if (group.icon?.includes(':')) {
    return (
      <div
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
        style={{ background: `${group.color ?? '#0073AA'}22` }}
      >
        <Icon icon={group.icon} width={22} color={group.color ?? '#0073AA'} />
      </div>
    )
  }
  if (group.icon) {
    return (
      <Avatar
        size="large"
        className="shrink-0"
        style={{ background: `${group.color ?? '#0073AA'}33` }}
      >
        {group.icon}
      </Avatar>
    )
  }
  return (
    <div
      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
      style={{ background: '#0073AA22' }}
    >
      <Icon icon="mdi:account-group-outline" width={22} color="#0073AA" />
    </div>
  )
}

const roleLabel: Record<string, string> = {
  LEADER: 'Trưởng nhóm',
  VICE_LEADER: 'Phó nhóm',
  MEMBER: 'Thành viên',
}

export function GroupCard({ group }: { group: GroupDto }) {
  const router = useRouter()
  return (
    <Card
      hoverable
      className="group-card h-full min-h-[148px] w-full flex-1"
      onClick={() => void router.push(`/groups/${group.id}`)}
    >
      <div className="group-card__inner">
        <div className="shrink-0 self-start pt-0.5">{groupVisual(group)}</div>
        <div className="group-card__main">
          <Typography.Title level={5} className="!mb-1 !mt-0 truncate">
            {group.name}
          </Typography.Title>
          <div className="mb-0 flex flex-wrap gap-1">
            <Tag icon={<TeamOutlined />}>{group.memberCount} thành viên</Tag>
            <Tag color="blue">{roleLabel[group.myRole] ?? group.myRole}</Tag>
          </div>
          <div className="mt-auto flex flex-col gap-1 border-t border-stone-100 pt-3">
            <div className="flex items-center gap-2 text-sm text-stone-600">
              <BankOutlined className="text-stone-400" />
              <span>Quỹ:</span>
              {group.fundBalance != null ? (
                <CurrencyDisplay amount={group.fundBalance} />
              ) : (
                <Typography.Text type="secondary">—</Typography.Text>
              )}
            </div>
            <Typography.Text type="secondary" className="block text-xs">
              Tạo {fmtDate(group.createdAt)}
            </Typography.Text>
          </div>
        </div>
        <div className="group-card__chevron-wrap">
          <Icon icon="mdi:chevron-right" width={20} className="text-stone-300" aria-hidden />
        </div>
      </div>
    </Card>
  )
}
