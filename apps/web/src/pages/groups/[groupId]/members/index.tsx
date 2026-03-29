import { InviteCodeCard } from '@/components/groups/InviteCodeCard'
import { InviteModal } from '@/components/groups/InviteModal'
import { MemberProfileDrawer } from '@/components/groups/MemberProfileDrawer'
import AppLayout from '@/components/layout/AppLayout'
import { CurrencyDisplay } from '@/components/shared/CurrencyDisplay'
import {
  useCancelGroupInvite,
  useGroup,
  useGroupMembers,
  useLeaveGroup,
  useRemoveMember,
  useUpdateMemberRole,
} from '@/hooks/useGroup'
import { withAuth } from '@/utils/withAuth'
import { fmtDate } from '@/utils/date'
import { UserAddOutlined } from '@ant-design/icons'
import { Icon } from '@iconify/react'
import type { MemberDto, PendingGroupInviteDto } from '@expense/types'
import { App, Avatar, Button, Modal, Popconfirm, Select, Space, Table, Tag, Tooltip, Typography } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/router'
import { useMemo, useState } from 'react'

export const getServerSideProps = withAuth()

const roleLabel: Record<string, string> = {
  LEADER: 'Trưởng nhóm',
  VICE_LEADER: 'Phó nhóm',
  MEMBER: 'Thành viên',
}

type GroupMemberRole = 'LEADER' | 'VICE_LEADER' | 'MEMBER'

type Row =
  | { key: string; kind: 'member'; member: MemberDto }
  | { key: string; kind: 'pending'; invite: PendingGroupInviteDto }

export default function GroupMembersPage() {
  const { message } = App.useApp()
  const router = useRouter()
  const { data: session } = useSession()
  const groupId = typeof router.query.groupId === 'string' ? router.query.groupId : ''
  const { data: group } = useGroup(groupId)
  const { data: memberList, isLoading } = useGroupMembers(groupId)
  const members = memberList?.members ?? []
  const pendingInvites = memberList?.pendingInvites ?? []
  const [inviteOpen, setInviteOpen] = useState(false)
  const [profileMember, setProfileMember] = useState<MemberDto | null>(null)
  const [roleModalMember, setRoleModalMember] = useState<MemberDto | null>(null)
  const [nextGroupRole, setNextGroupRole] = useState<GroupMemberRole>('MEMBER')
  const updateRole = useUpdateMemberRole(groupId)
  const remove = useRemoveMember(groupId)
  const leave = useLeaveGroup(groupId)
  const cancelInvite = useCancelGroupInvite(groupId)

  if (!groupId) return null

  const isLeader = group?.myRole === 'LEADER'
  const canManageInvites =
    group?.myRole === 'LEADER' || group?.myRole === 'VICE_LEADER'
  const canLeaveGroup = group != null && group.myRole !== 'LEADER'
  const uid = session?.user?.id

  const dataSource: Row[] = useMemo(() => {
    const pendingRows: Row[] = isLeader
      ? pendingInvites.map((inv) => ({ key: `p-${inv.id}`, kind: 'pending' as const, invite: inv }))
      : []
    const memberRows: Row[] = members.map((m) => ({ key: `m-${m.id}`, kind: 'member' as const, member: m }))
    return [...pendingRows, ...memberRows]
  }, [isLeader, pendingInvites, members])

  const columns: ColumnsType<Row> = [
    {
      title: 'Thành viên',
      key: 'user',
      align: 'left',
      render: (_, row) =>
        row.kind === 'member' ? (
          <div className="flex items-center gap-3">
            <Avatar
              src={row.member.user.avatarUrl ?? undefined}
              size={32}
              className="shrink-0 !bg-brand-soft !text-brand-text !font-semibold"
            >
              {row.member.user.name[0]?.toUpperCase()}
            </Avatar>
            <div className="min-w-0">
              <div className="font-medium text-stone-900 leading-tight">{row.member.user.name}</div>
              <div className="text-xs text-stone-400">{row.member.user.email}</div>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <Avatar
              src={row.invite.invitee.avatarUrl ?? undefined}
              size={32}
              className="shrink-0 !bg-amber-100 !text-amber-800 !font-semibold"
            >
              {row.invite.invitee.name[0]?.toUpperCase()}
            </Avatar>
            <div className="min-w-0">
              <div className="font-medium text-stone-900 leading-tight">{row.invite.invitee.name}</div>
              <div className="text-xs text-stone-400">{row.invite.invitee.email}</div>
            </div>
          </div>
        ),
    },
    {
      title: 'Trạng thái',
      key: 'status',
      width: 168,
      render: (_, row) =>
        row.kind === 'member' ? (
          <Tag color="success">Đã tham gia</Tag>
        ) : (
          <Tag color="warning">Đang chờ xác nhận</Tag>
        ),
    },
    {
      title: 'Vai trò',
      key: 'role',
      align: 'left',
      render: (_, row) =>
        row.kind === 'member' ? (
          <Tag>{roleLabel[row.member.role] ?? row.member.role}</Tag>
        ) : (
          <span className="text-stone-400">—</span>
        ),
    },
    {
      title: 'Tham gia / Mời',
      key: 'joinedAt',
      align: 'left',
      render: (_, row) =>
        row.kind === 'member' ? (
          fmtDate(row.member.joinedAt)
        ) : (
          <div className="text-xs">
            <div>Gửi {fmtDate(row.invite.createdAt)}</div>
            <div className="text-stone-400">bởi {row.invite.invitedBy.name}</div>
          </div>
        ),
    },
    {
      title: (
        <Tooltip title="Tổng tiền các khoản chung do bạn trả (người trả bill).">
          <span className="cursor-help border-b border-dotted border-stone-300">Tổng trả hộ (chung)</span>
        </Tooltip>
      ),
      key: 'sharedPaid',
      align: 'right',
      render: (_, row) =>
        row.kind === 'member' ? (
          <CurrencyDisplay
            amount={row.member.sharedPaidTotal ?? '0'}
            className="whitespace-nowrap tabular-nums font-medium text-stone-900"
          />
        ) : (
          <span className="text-stone-300">—</span>
        ),
    },
    {
      title: (
        <Tooltip title="Đã nộp quỹ (đã duyệt) − đã trừ quỹ (theo người).">
          <span className="cursor-help border-b border-dotted border-stone-300">Phần quỹ (duyệt)</span>
        </Tooltip>
      ),
      key: 'fundMember',
      align: 'right',
      render: (_, row) =>
        row.kind === 'member' ? (
          <CurrencyDisplay
            amount={row.member.fundContributedApproved ?? '0'}
            className="whitespace-nowrap tabular-nums font-medium text-stone-900"
          />
        ) : (
          <span className="text-stone-300">—</span>
        ),
    },
    {
      title: (
        <Tooltip title="Phần tiền gán cho bạn trên khoản chung (phần chia).">
          <span className="cursor-help border-b border-dotted border-stone-300">Phần chia (bill)</span>
        </Tooltip>
      ),
      key: 'sharedOwed',
      align: 'right',
      render: (_, row) =>
        row.kind === 'member' ? (
          <CurrencyDisplay
            amount={row.member.sharedOwedTotal ?? '0'}
            className="whitespace-nowrap tabular-nums font-medium text-stone-900"
          />
        ) : (
          <span className="text-stone-300">—</span>
        ),
    },
    {
      title: (
        <Tooltip title="Đã trả + quỹ − phần chia. Dương: được nợ; âm: còn nợ.">
          <span className="cursor-help border-b border-dotted border-stone-300">Chênh (ước tính)</span>
        </Tooltip>
      ),
      key: 'balance',
      align: 'right',
      render: (_, row) =>
        row.kind === 'member' ? (
          <CurrencyDisplay
            amount={row.member.netBalance ?? '0'}
            className={
              Number(row.member.netBalance ?? 0) > 0
                ? 'font-semibold text-green-600'
                : Number(row.member.netBalance ?? 0) < 0
                  ? 'font-semibold text-red-600'
                  : 'tabular-nums text-stone-500'
            }
          />
        ) : (
          <span className="text-stone-300">—</span>
        ),
    },
    {
      title: <span className="whitespace-nowrap">Thao tác</span>,
      key: 'actions',
      align: 'right',
      width: isLeader ? 200 : 96,
      render: (_, row) => (
        <Space size={4} onClick={(e) => e.stopPropagation()}>
          {row.kind === 'member' ? (
            <Tooltip title="Xem hồ sơ">
              <Button
                type="text"
                size="small"
                icon={<Icon icon="fluent:person-24-regular" width={16} />}
                onClick={(e) => {
                  e.stopPropagation()
                  setProfileMember(row.member)
                }}
                aria-label="Xem hồ sơ thành viên"
              />
            </Tooltip>
          ) : null}
          {row.kind === 'member' && isLeader && row.member.userId !== uid ? (
            <>
              <Tooltip title="Đổi vai trò">
                <Button
                  type="text"
                  size="small"
                  icon={<Icon icon="fluent:person-swap-24-regular" width={16} />}
                  onClick={(e) => {
                    e.stopPropagation()
                    setRoleModalMember(row.member)
                    setNextGroupRole(row.member.role as GroupMemberRole)
                  }}
                  aria-label="Đổi vai trò"
                />
              </Tooltip>
              <Popconfirm
                title="Xoá thành viên khỏi nhóm?"
                onConfirm={() =>
                  void remove
                    .mutateAsync(row.member.id)
                    .then(() => message.success('Đã xoá'))
                    .catch((e) => message.error(e instanceof Error ? e.message : 'Lỗi'))
                }
              >
                <Tooltip title="Xoá khỏi nhóm">
                  <Button type="text" size="small" danger icon={<Icon icon="mdi:account-remove-outline" width={16} />} />
                </Tooltip>
              </Popconfirm>
            </>
          ) : null}
          {row.kind === 'pending' && isLeader ? (
            <Popconfirm
              title="Huỷ lời mời này?"
              onConfirm={() =>
                void cancelInvite
                  .mutateAsync(row.invite.id)
                  .then(() => message.success('Đã huỷ lời mời'))
                  .catch((e) => message.error(e instanceof Error ? e.message : 'Lỗi'))
              }
            >
              <Tooltip title="Huỷ lời mời">
                <Button type="text" size="small" danger icon={<Icon icon="mdi:email-remove-outline" width={16} />} />
              </Tooltip>
            </Popconfirm>
          ) : null}
        </Space>
      ),
    },
  ]

  return (
    <AppLayout title="Thành viên">
      {canManageInvites || canLeaveGroup ? (
        <div className="mb-4 flex flex-wrap items-center justify-end gap-3">
          {canLeaveGroup ? (
            <Popconfirm
              title="Rời nhóm?"
              description="Rời nhóm sẽ xoá bạn khỏi danh sách thành viên. Đảm bảo bạn đã thanh toán hết các khoản nợ trong nhóm."
              okText="Rời nhóm"
              cancelText="Huỷ"
              okButtonProps={{ danger: true }}
              onConfirm={() =>
                void leave
                  .mutateAsync()
                  .then(() => message.success('Đã rời nhóm'))
                  .catch((e) => message.error(e instanceof Error ? e.message : 'Lỗi'))
              }
            >
              <Button type="default" danger loading={leave.isPending}>
                Rời nhóm
              </Button>
            </Popconfirm>
          ) : null}
          {canManageInvites ? (
            <Button type="primary" icon={<UserAddOutlined />} onClick={() => setInviteOpen(true)}>
              Mời thành viên
            </Button>
          ) : null}
        </div>
      ) : null}

      {group && canManageInvites ? (
        <div className="mb-4">
          <InviteCodeCard group={group} groupId={groupId} canConfigureInviteCode={isLeader} />
        </div>
      ) : null}

      <Table<Row>
        rowKey="key"
        loading={isLoading}
        columns={columns}
        dataSource={dataSource}
        scroll={{ x: true }}
      />

      {canManageInvites ? (
        <InviteModal open={inviteOpen} onClose={() => setInviteOpen(false)} groupId={groupId} />
      ) : null}

      <MemberProfileDrawer member={profileMember} onClose={() => setProfileMember(null)} />

      <Modal
        title={
          roleModalMember
            ? `Đổi vai trò — ${roleModalMember.user.name}`
            : 'Đổi vai trò'
        }
        open={roleModalMember != null}
        onCancel={() => setRoleModalMember(null)}
        okText="Lưu"
        cancelText="Hủy"
        confirmLoading={updateRole.isPending}
        destroyOnClose
        onOk={() => {
          if (!roleModalMember) return Promise.resolve()
          if (nextGroupRole === roleModalMember.role) {
            setRoleModalMember(null)
            return Promise.resolve()
          }
          return updateRole
            .mutateAsync({ memberId: roleModalMember.id, role: nextGroupRole })
            .then(() => {
              message.success('Đã cập nhật vai trò')
              setRoleModalMember(null)
            })
            .catch((e) => {
              message.error(e instanceof Error ? e.message : 'Lỗi')
              return Promise.reject(e)
            })
        }}
      >
        {roleModalMember?.role === 'LEADER' && nextGroupRole !== 'LEADER' ? (
          <Typography.Paragraph type="secondary" className="!mt-0 !mb-3 text-sm">
            Hạ vai trò trưởng nhóm chỉ thực hiện được khi đã có trưởng nhóm khác trong nhóm.
          </Typography.Paragraph>
        ) : null}
        <Select<GroupMemberRole>
          className="w-full"
          value={nextGroupRole}
          onChange={(v) => setNextGroupRole(v)}
          options={[
            { value: 'LEADER', label: roleLabel.LEADER },
            { value: 'VICE_LEADER', label: roleLabel.VICE_LEADER },
            { value: 'MEMBER', label: roleLabel.MEMBER },
          ]}
        />
      </Modal>
    </AppLayout>
  )
}
