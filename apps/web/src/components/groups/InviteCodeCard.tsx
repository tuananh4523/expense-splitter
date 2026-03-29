import { useRegenerateInviteCode, useToggleGroupInvite } from '@/hooks/useGroup'
import { formatInviteCodeDisplay } from '@/lib/inviteCodeDisplay'
import type { GroupDto } from '@expense/types'
import { Icon } from '@iconify/react'
import { App, Badge, Button, Card, Popconfirm, Switch, Typography } from 'antd'
import { useState } from 'react'

export function InviteCodeCard({
  group,
  groupId,
  canConfigureInviteCode,
}: {
  group: GroupDto
  groupId: string
  /** Bật/tắt mã & tạo mã mới — API chỉ cho trưởng nhóm */
  canConfigureInviteCode: boolean
}) {
  const { message } = App.useApp()
  const regen = useRegenerateInviteCode(groupId)
  const toggle = useToggleGroupInvite(groupId)
  const [copyLinkOk, setCopyLinkOk] = useState(false)

  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  const inviteUrl = `${origin}/join?code=${encodeURIComponent(group.inviteCode)}`
  const displayCode = formatInviteCodeDisplay(group.inviteCode)

  const copyLink = async () => {
    await navigator.clipboard.writeText(inviteUrl)
    message.success('Đã copy link')
    setCopyLinkOk(true)
    setTimeout(() => setCopyLinkOk(false), 2000)
  }

  const disabledVisually = !group.inviteEnabled

  return (
    <Card
      className="mb-4 overflow-hidden"
      styles={{ body: { padding: 0 } }}
      style={{ opacity: disabledVisually ? 0.5 : 1 }}
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-200 bg-stone-50 px-4 py-3">
        <div className="flex items-center gap-2">
          <Icon icon="mdi:link-variant" width={22} className="text-brand" />
          <Typography.Text strong className="text-base">
            Mã mời nhóm
          </Typography.Text>
        </div>
        <div className="flex items-center gap-2">
          {group.inviteEnabled ? (
            <Badge status="success" text="Đang hoạt động" />
          ) : (
            <Badge status="error" text="Đang tắt" />
          )}
          {canConfigureInviteCode ? (
            <Switch
              checked={group.inviteEnabled}
              loading={toggle.isPending}
              checkedChildren="Bật"
              unCheckedChildren="Tắt"
              onChange={(enabled) =>
                void toggle
                  .mutateAsync(enabled)
                  .then(() => message.success(enabled ? 'Đã bật mã mời' : 'Đã tắt mã mời'))
                  .catch((e) => message.error(e instanceof Error ? e.message : 'Lỗi'))
              }
            />
          ) : null}
        </div>
      </div>

      <div className="px-4 py-5">
        <div className="rounded-xl border border-stone-200 bg-white px-4 py-4 shadow-sm">
          <Typography.Text type="secondary" className="block text-xs">
            {inviteUrl.replace(/^https?:\/\//, '')}
          </Typography.Text>
          <Typography.Text
            className="mt-1 block font-mono text-lg font-semibold tracking-wider text-stone-900"
            copyable={{ text: inviteUrl }}
          >
            {displayCode}
          </Typography.Text>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <Button
            type="primary"
            icon={
              <Icon icon={copyLinkOk ? 'mdi:check' : 'mdi:content-copy'} width={18} />
            }
            onClick={() => void copyLink()}
          >
            {copyLinkOk ? 'Đã copy' : 'Copy link'}
          </Button>
          {canConfigureInviteCode ? (
            <Popconfirm
              title="Mã cũ sẽ hết hiệu lực, tiếp tục?"
              okText="Tạo mới"
              cancelText="Huỷ"
              onConfirm={() =>
                void regen
                  .mutateAsync()
                  .then(() => message.success('Đã tạo mã mới'))
                  .catch((e) => message.error(e instanceof Error ? e.message : 'Lỗi'))
              }
            >
              <Button loading={regen.isPending} icon={<Icon icon="mdi:refresh" width={18} />}>
                Tạo mã mới
              </Button>
            </Popconfirm>
          ) : null}
        </div>

        {!group.inviteEnabled ? (
          <Typography.Text type="warning" className="mt-4 block">
            Mã mời hiện đang tắt — không thể tham gia bằng link hoặc mã.
          </Typography.Text>
        ) : null}
      </div>
    </Card>
  )
}
