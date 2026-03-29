import { fmtDate } from '@/utils/date'
import type { MemberDto } from '@expense/types'
import { Table, Tag } from 'antd'
import type { ColumnsType } from 'antd/es/table'

const roleLabel: Record<string, string> = {
  LEADER: 'Trưởng nhóm',
  VICE_LEADER: 'Phó nhóm',
  MEMBER: 'Thành viên',
}

export function MemberList({ members, loading }: { members: MemberDto[]; loading: boolean }) {
  const columns: ColumnsType<MemberDto> = [
    {
      title: 'Thành viên',
      key: 'user',
      render: (_, r) => r.user.name,
    },
    { title: 'Email', key: 'email', render: (_, r) => r.user.email },
    {
      title: 'Vai trò',
      dataIndex: 'role',
      key: 'role',
      render: (role: string) => <Tag>{roleLabel[role] ?? role}</Tag>,
    },
    {
      title: 'Tham gia',
      dataIndex: 'joinedAt',
      key: 'joinedAt',
      render: (d: string) => fmtDate(d),
    },
  ]

  return (
    <Table<MemberDto>
      rowKey="id"
      loading={loading}
      columns={columns}
      dataSource={members}
      scroll={{ x: true }}
    />
  )
}
