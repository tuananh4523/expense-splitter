import {
  useAcceptGroupInvite,
  useDeclineGroupInvite,
  useJoinByInviteCode,
  useMyPendingGroupInvite,
} from '@/hooks/useGroup'
import { fmtDate } from '@/utils/date'
import { withAuth } from '@/utils/withAuth'
import { App, Button, Card, Form, Input, Space, Typography } from 'antd'
import { useRouter } from 'next/router'
import { useEffect, useMemo, useState } from 'react'

export const getServerSideProps = withAuth()

function PendingEmailInviteBlock({ groupId }: { groupId: string }) {
  const { message } = App.useApp()
  const router = useRouter()
  const { data: pending, isLoading } = useMyPendingGroupInvite(groupId)
  const accept = useAcceptGroupInvite(groupId)
  const decline = useDeclineGroupInvite(groupId)

  const onAcceptInvite = () => {
    if (!pending?.invite.id) return
    void accept
      .mutateAsync(pending.invite.id)
      .then(() => {
        message.success('Đã tham gia nhóm')
        void router.replace(`/groups/${groupId}`)
      })
      .catch((e) => message.error(e instanceof Error ? e.message : 'Lỗi'))
  }

  const onDeclineInvite = () => {
    if (!pending?.invite.id) return
    void decline
      .mutateAsync(pending.invite.id)
      .then(() => {
        message.success('Đã từ chối lời mời')
        void router.replace('/notifications')
      })
      .catch((e) => message.error(e instanceof Error ? e.message : 'Lỗi'))
  }

  if (isLoading) {
    return <Typography.Text type="secondary">Đang tải…</Typography.Text>
  }

  if (!pending) {
    return (
      <Space direction="vertical" size="middle" className="w-full">
        <Typography.Paragraph type="secondary" className="!mb-0">
          Không có lời mời đang chờ cho nhóm này.
        </Typography.Paragraph>
        <Button type="link" className="!px-0" onClick={() => void router.push('/groups')}>
          Về danh sách nhóm
        </Button>
      </Space>
    )
  }

  return (
    <Space direction="vertical" size="large" className="w-full">
      <Typography.Paragraph type="secondary" className="!mb-0">
        Bạn được mời tham gia nhóm. Chỉ khi bấm «Tham gia» thì bạn mới trở thành thành viên.
      </Typography.Paragraph>
      <div>
        <Typography.Title level={4} className="!mb-2">
          {pending.group.name}
        </Typography.Title>
        <Typography.Text type="secondary" className="block">
          {pending.inviter.name} ({pending.inviter.email}) mời bạn tham gia nhóm này.
        </Typography.Text>
        <Typography.Text type="secondary" className="mt-2 block text-xs">
          Gửi lúc {fmtDate(pending.invite.createdAt)}
        </Typography.Text>
      </div>
      <Space direction="vertical" size="small" className="w-full">
        <Button type="primary" loading={accept.isPending} block onClick={() => onAcceptInvite()}>
          Tham gia
        </Button>
        <Button danger loading={decline.isPending} block onClick={() => onDeclineInvite()}>
          Từ chối
        </Button>
      </Space>
    </Space>
  )
}

export default function JoinGroupPage() {
  const { message } = App.useApp()
  const router = useRouter()
  const join = useJoinByInviteCode()
  const [code, setCode] = useState('')

  const pendingGroupId = useMemo(() => {
    const g = router.query.group
    return typeof g === 'string' && g.trim() ? g.trim() : ''
  }, [router.query.group])

  useEffect(() => {
    const q = router.query.code
    if (typeof q === 'string' && q) setCode(q)
  }, [router.query.code])

  const submitCode = () => {
    const c = code.trim()
    if (!c) {
      message.error('Nhập mã mời')
      return
    }
    void join.mutateAsync(c)
      .then((res) => {
        if (res.pendingApproval) {
          message.success('Đã gửi yêu cầu tham gia, chờ quản trị viên duyệt')
        }
      })
      .catch((e) => message.error(e instanceof Error ? e.message : 'Không tham gia được'))
  }

  if (!router.isReady) {
    return (
      <div className="mx-auto flex min-h-screen max-w-lg flex-col justify-center p-4">
        <Card title="Tham gia nhóm">
          <div className="wizard-card-body">
            <Typography.Text type="secondary">Đang tải…</Typography.Text>
          </div>
        </Card>
      </div>
    )
  }

  if (pendingGroupId) {
    return (
      <div className="mx-auto flex min-h-screen max-w-lg flex-col justify-center p-4">
        <Card title="Tham gia nhóm">
          <div className="wizard-card-body">
            <PendingEmailInviteBlock groupId={pendingGroupId} />
          </div>
        </Card>
      </div>
    )
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-lg flex-col justify-center p-4">
      <Card title="Tham gia nhóm">
        <div className="wizard-card-body">
          <Typography.Paragraph type="secondary" className="!mb-0">
            Nhập mã mời hoặc dùng link có sẵn mã.
          </Typography.Paragraph>
          <Form
            id="join-by-code-form"
            layout="vertical"
            className="[&_.ant-form-item:last-child]:!mb-0"
            onFinish={() => submitCode()}
          >
            <Form.Item label="Mã mời">
              <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="Mã mời" />
            </Form.Item>
          </Form>
        </div>
        <div className="wizard-card-actions">
          <Button
            type="primary"
            htmlType="submit"
            form="join-by-code-form"
            loading={join.isPending}
            className="w-full sm:w-auto"
          >
            Tham gia
          </Button>
        </div>
      </Card>
    </div>
  )
}
