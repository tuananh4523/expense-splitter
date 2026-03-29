import AppLayout from '@/components/layout/AppLayout'
import { api } from '@/lib/api'
import { withAdmin } from '@/utils/withAdmin'
import {
  App,
  Button,
  Form,
  Input,
  Modal,
  Popconfirm,
  Select,
  Space,
  Table,
  Tag,
  Tooltip,
  Typography,
} from 'antd'
import { PlusOutlined } from '@ant-design/icons'
import { useSession } from 'next-auth/react'
import { useCallback, useState } from 'react'
import { Icon } from '@iconify/react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

export const getServerSideProps = withAdmin()

type AdminUserRow = {
  id: string
  email: string
  name: string
  avatarUrl: string | null
  role: string
  isActive: boolean
  /** Đang mở app + kết nối Socket.IO (realtime). */
  online?: boolean
  lastLoginAt: string | null
  createdAt: string
  _count: { memberships: number }
}

type ResetPwState =
  | null
  | { phase: 'form'; user: AdminUserRow }
  | { phase: 'done'; user: AdminUserRow; plainPassword: string }

export default function AdminUsersPage() {
  const { message } = App.useApp()
  const { data: session, update: updateSession } = useSession()
  const qc = useQueryClient()
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [role, setRole] = useState<string | undefined>()
  const [isActive, setIsActive] = useState<string | undefined>()
  const [roleModal, setRoleModal] = useState<AdminUserRow | null>(null)
  const [nextRole, setNextRole] = useState<'ADMIN' | 'USER'>('USER')
  const [resetPw, setResetPw] = useState<ResetPwState>(null)
  const [copyPwOk, setCopyPwOk] = useState(false)
  const [resetForm] = Form.useForm<{ newPassword: string; confirmPassword: string }>()
  const [createOpen, setCreateOpen] = useState(false)
  const [createForm] = Form.useForm<{
    email: string
    name: string
    password: string
    confirmPassword: string
    role: 'ADMIN' | 'USER'
  }>()

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'users', page, search, role, isActive],
    queryFn: () =>
      api
        .get<{
          data: AdminUserRow[]
          total: number
          onlineTotal?: number
          page: number
          limit: number
          totalPages: number
        }>('/admin/users', {
          params: {
            page,
            limit: 20,
            ...(search ? { search } : {}),
            ...(role ? { role } : {}),
            ...(isActive !== undefined ? { isActive } : {}),
          },
        })
        .then((r) => r.data),
    /** Làm mới trạng thái trực tuyến (Socket.IO) định kỳ. */
    refetchInterval: 20_000,
    refetchIntervalInBackground: true,
  })

  const resetPassword = useMutation({
    mutationFn: async ({ userId, newPassword }: { userId: string; newPassword: string }) => {
      await api.post(`/admin/users/${userId}/reset-password`, { newPassword })
    },
    onError: (e: Error) => message.error(e.message),
  })

  const patchUser = useMutation({
    mutationFn: async ({ id, body }: { id: string; body: { role?: string; isActive?: boolean } }) => {
      await api.patch(`/admin/users/${id}`, body)
    },
    onSuccess: (_d, { id }) => {
      void qc.invalidateQueries({ queryKey: ['admin', 'users'] })
      message.success('Đã cập nhật')
      if (session?.user?.id === id) {
        void updateSession()
      }
    },
    onError: (e: Error) => message.error(e.message),
  })

  const deleteUser = useMutation({
    mutationFn: async (userId: string) => {
      await api.delete(`/admin/users/${userId}`)
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['admin', 'users'] })
      message.success('Đã xóa người dùng và dữ liệu liên quan')
    },
    onError: (e: Error) => message.error(e.message),
  })

  const createUser = useMutation({
    mutationFn: async (body: { email: string; name: string; password: string; role: 'ADMIN' | 'USER' }) => {
      const res = await api.post<{ data: AdminUserRow }>('/admin/users', body)
      return res.data.data
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['admin', 'users'] })
      message.success('Đã tạo tài khoản')
      setCreateOpen(false)
      createForm.resetFields()
      setPage(1)
    },
    onError: (e: Error) => message.error(e.message),
  })

  const submitCreateUser = async () => {
    try {
      const v = await createForm.validateFields()
      if (v.password !== v.confirmPassword) {
        message.error('Xác nhận mật khẩu không khớp')
        return
      }
      await createUser.mutateAsync({
        email: v.email.trim(),
        name: v.name.trim(),
        password: v.password,
        role: v.role,
      })
    } catch {
      /* validate hoặc API */
    }
  }

  const closeResetModal = () => {
    setResetPw(null)
    resetForm.resetFields()
    setCopyPwOk(false)
  }

  const submitResetPassword = async () => {
    if (resetPw?.phase !== 'form') return
    try {
      const v = await resetForm.validateFields()
      if (v.newPassword !== v.confirmPassword) {
        message.error('Xác nhận mật khẩu không khớp')
        return
      }
      await resetPassword.mutateAsync({
        userId: resetPw.user.id,
        newPassword: v.newPassword,
      })
      message.success('Đã cấp mật khẩu mới')
      setResetPw({ phase: 'done', user: resetPw.user, plainPassword: v.newPassword })
      resetForm.resetFields()
    } catch {
      /* validateFields hoặc API */
    }
  }

  const columns = [
    { title: 'Tên', dataIndex: 'name', key: 'name', align: 'left' as const },
    { title: 'Email', dataIndex: 'email', key: 'email', align: 'left' as const },
    {
      title: 'Vai trò',
      dataIndex: 'role',
      key: 'role',
      align: 'center' as const,
      render: (r: string) => <Tag color={r === 'ADMIN' ? 'purple' : 'default'}>{r}</Tag>,
    },
    {
      title: 'Trạng thái',
      dataIndex: 'isActive',
      key: 'isActive',
      align: 'center' as const,
      render: (a: boolean) => (a ? <Tag color="green">Hoạt động</Tag> : <Tag>Khóa</Tag>),
    },
    {
      title: 'Trực tuyến',
      key: 'online',
      width: 120,
      align: 'center' as const,
      render: (_: unknown, u: AdminUserRow) =>
        u.online ? (
          <Tooltip title="Đang mở ứng dụng và kết nối realtime (có thể nhiều tab/ thiết bị).">
            <Tag color="green">Đang dùng</Tag>
          </Tooltip>
        ) : (
          <Tooltip title="Không có socket tới — đóng tab hoặc chưa đăng nhập trên trình duyệt này.">
            <span className="text-wp-slate text-sm">—</span>
          </Tooltip>
        ),
    },
    {
      title: 'Nhóm',
      key: 'groups',
      align: 'right' as const,
      render: (_: unknown, u: AdminUserRow) => u._count.memberships,
    },
    {
      title: '',
      key: 'actions',
      width: 212,
      align: 'right' as const,
      render: (_: unknown, u: AdminUserRow) => (
        <Space size={4}>
          <Tooltip title="Đổi vai trò">
            <Button
              type="text"
              size="small"
              icon={<Icon icon="fluent:person-swap-24-regular" width={16} />}
              onClick={(e) => {
                e.stopPropagation()
                setRoleModal(u)
                const self = session?.user?.id === u.id
                const flip = u.role === 'ADMIN' ? 'USER' : 'ADMIN'
                setNextRole(self && u.role === 'ADMIN' ? 'ADMIN' : flip)
              }}
            />
          </Tooltip>
          {session?.user?.id === u.id && u.isActive ? (
            <Tooltip title="Không thể tự khóa tài khoản của mình">
              <Button
                type="text"
                size="small"
                disabled
                icon={<Icon icon="fluent:lock-closed-24-regular" width={16} />}
                onClick={(e) => e.stopPropagation()}
              />
            </Tooltip>
          ) : (
            <Tooltip title={u.isActive ? 'Khóa' : 'Mở khóa'}>
              <Popconfirm
                title={u.isActive ? 'Khóa tài khoản?' : 'Mở khóa?'}
                onConfirm={() => patchUser.mutate({ id: u.id, body: { isActive: !u.isActive } })}
              >
                <Button
                  type="text"
                  size="small"
                  icon={<Icon icon="fluent:lock-closed-24-regular" width={16} />}
                  onClick={(e) => e.stopPropagation()}
                />
              </Popconfirm>
            </Tooltip>
          )}
          <Tooltip title="Cấp lại mật khẩu">
            <Button
              type="text"
              size="small"
              icon={<Icon icon="fluent:key-reset-24-regular" width={16} />}
              onClick={(e) => {
                e.stopPropagation()
                resetForm.resetFields()
                setCopyPwOk(false)
                setResetPw({ phase: 'form', user: u })
              }}
            />
          </Tooltip>
          {session?.user?.id !== u.id ? (
            <Tooltip title="Xóa tài khoản và dữ liệu liên quan">
              <Popconfirm
                title="Xóa người dùng?"
                description="Chi tiêu do người này trả, thanh toán, thành viên nhóm, bình luận… sẽ bị xóa theo. Đợt tổng kết mà họ là người nhận cũng bị xóa."
                okText="Xóa"
                cancelText="Hủy"
                okButtonProps={{ danger: true, loading: deleteUser.isPending }}
                onConfirm={() => deleteUser.mutate(u.id)}
              >
                <Button
                  type="text"
                  size="small"
                  danger
                  icon={<Icon icon="fluent:delete-24-regular" width={16} />}
                  onClick={(e) => e.stopPropagation()}
                />
              </Popconfirm>
            </Tooltip>
          ) : null}
        </Space>
      ),
    },
  ]

  const onSearch = useCallback(() => {
    setPage(1)
  }, [])

  const onlineTotal = data?.onlineTotal

  return (
    <AppLayout title="Quản trị — Tài khoản">
      {/* {typeof onlineTotal === 'number' ? (
        <Typography.Paragraph type="secondary" className="!mb-4 !mt-0 text-sm">
          <strong className="text-wp-charcoal">{onlineTotal}</strong> tài khoản đang{' '}
          <strong>trực tuyến</strong> (mở app với kết nối realtime). Cột «Trực tuyến» cập nhật khoảng mỗi 20 giây.
        </Typography.Paragraph>
      ) : null} */}
      <div className="mb-6 flex justify-end">
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => {
            createForm.resetFields()
            createForm.setFieldsValue({ role: 'USER' })
            setCreateOpen(true)
          }}
        >
          Tạo tài khoản
        </Button>
      </div>
      <Space wrap className="mb-6 w-full max-sm:[&_.ant-space-item]:w-full">
        <Input.Search
          placeholder="Tìm tên / email"
          allowClear
          className="w-full sm:!w-[260px]"
          onSearch={(v) => {
            setSearch(v)
            onSearch()
          }}
        />
        <Select
          allowClear
          placeholder="Vai trò"
          className="w-full min-w-0 sm:!w-[140px]"
          options={[
            { value: 'ADMIN', label: 'ADMIN' },
            { value: 'USER', label: 'USER' },
          ]}
          onChange={(v) => {
            setRole(v ?? undefined)
            setPage(1)
          }}
        />
        <Select
          allowClear
          placeholder="Trạng thái"
          className="w-full min-w-0 sm:!w-[140px]"
          options={[
            { value: 'true', label: 'Hoạt động' },
            { value: 'false', label: 'Khóa' },
          ]}
          onChange={(v) => {
            setIsActive(v)
            setPage(1)
          }}
        />
      </Space>
      <Table<AdminUserRow>
        rowKey="id"
        loading={isLoading}
        columns={columns}
        dataSource={data?.data ?? []}
        scroll={{ x: 'max-content' }}
        pagination={{
          current: page,
          pageSize: 20,
          total: data?.total ?? 0,
          onChange: (p) => setPage(p),
        }}
      />

      <Modal
        title={
          resetPw?.phase === 'done'
            ? 'Đã cấp mật khẩu'
            : resetPw?.phase === 'form'
              ? `Cấp lại mật khẩu — ${resetPw.user.name}`
              : ''
        }
        open={resetPw != null}
        onCancel={closeResetModal}
        destroyOnClose
        afterClose={() => {
          resetForm.resetFields()
          setCopyPwOk(false)
        }}
        footer={
          resetPw?.phase === 'form'
            ? [
                <Button key="cancel" onClick={closeResetModal}>
                  Hủy
                </Button>,
                <Button
                  key="ok"
                  type="primary"
                  loading={resetPassword.isPending}
                  onClick={() => void submitResetPassword()}
                >
                  Áp dụng
                </Button>,
              ]
            : resetPw?.phase === 'done'
              ? [
                  <Button key="close" onClick={closeResetModal}>
                    Đóng
                  </Button>,
                  <Button
                    key="copy"
                    type="primary"
                    icon={<Icon icon={copyPwOk ? 'mdi:check' : 'mdi:content-copy'} width={16} />}
                    onClick={() => {
                      if (resetPw.phase !== 'done') return
                      void navigator.clipboard.writeText(resetPw.plainPassword)
                      setCopyPwOk(true)
                      window.setTimeout(() => setCopyPwOk(false), 2000)
                      message.success('Đã sao chép mật khẩu')
                    }}
                  >
                    {copyPwOk ? 'Đã sao chép' : 'Sao chép mật khẩu'}
                  </Button>,
                ]
              : null
        }
      >
        {resetPw?.phase === 'form' ? (
          <Form form={resetForm} layout="vertical" requiredMark={false} className="pt-1">
            <Typography.Paragraph type="secondary" className="!-mt-1 !mb-3">
              Nhập mật khẩu mới cho <strong>{resetPw.user.email}</strong>. Người dùng sẽ phải đổi mật khẩu khi
              đăng nhập lại.
            </Typography.Paragraph>
            <Form.Item
              name="newPassword"
              label="Mật khẩu mới"
              rules={[
                { required: true, message: 'Nhập mật khẩu' },
                { min: 6, message: 'Tối thiểu 6 ký tự' },
              ]}
              hasFeedback
            >
              <Input.Password autoComplete="new-password" placeholder="Tối thiểu 6 ký tự" maxLength={128} />
            </Form.Item>
            <Form.Item
              name="confirmPassword"
              label="Xác nhận mật khẩu"
              dependencies={['newPassword']}
              rules={[
                { required: true, message: 'Nhập lại mật khẩu' },
                ({ getFieldValue }) => ({
                  validator(_, value) {
                    if (!value || getFieldValue('newPassword') === value) {
                      return Promise.resolve()
                    }
                    return Promise.reject(new Error('Không khớp với mật khẩu mới'))
                  },
                }),
              ]}
              hasFeedback
            >
              <Input.Password autoComplete="new-password" placeholder="Nhập lại" maxLength={128} />
            </Form.Item>
          </Form>
        ) : resetPw?.phase === 'done' ? (
          <div>
            <Typography.Paragraph>
              Mật khẩu vừa đặt cho <strong>{resetPw.user.name}</strong> ({resetPw.user.email}):
            </Typography.Paragraph>
            <Input readOnly value={resetPw.plainPassword} className="font-mono" />
            <Typography.Paragraph type="secondary" className="mt-3 !mb-0">
              Sao chép và gửi cho người dùng qua kênh an toàn. Họ sẽ được yêu cầu đổi mật khẩu sau khi đăng
              nhập.
            </Typography.Paragraph>
          </div>
        ) : null}
      </Modal>

      <Modal
        title="Tạo tài khoản"
        open={createOpen}
        onCancel={() => {
          setCreateOpen(false)
          createForm.resetFields()
        }}
        destroyOnClose
        okText="Tạo"
        cancelText="Hủy"
        confirmLoading={createUser.isPending}
        onOk={() => void submitCreateUser()}
      >
        <Form form={createForm} layout="vertical" requiredMark={false} className="pt-1">
          <Form.Item
            name="email"
            label="Email"
            rules={[{ required: true, type: 'email', message: 'Email hợp lệ' }]}
          >
            <Input autoComplete="off" placeholder="user@example.com" />
          </Form.Item>
          <Form.Item
            name="name"
            label="Tên hiển thị"
            rules={[
              { required: true, message: 'Nhập tên' },
              { min: 2, message: 'Tối thiểu 2 ký tự' },
              { max: 100, message: 'Tối đa 100 ký tự' },
            ]}
          >
            <Input autoComplete="off" placeholder="Họ tên" maxLength={100} />
          </Form.Item>
          <Form.Item name="role" label="Vai trò" rules={[{ required: true }]}>
            <Select
              options={[
                { value: 'USER', label: 'USER — Người dùng' },
                { value: 'ADMIN', label: 'ADMIN — Quản trị' },
              ]}
            />
          </Form.Item>
          <Form.Item
            name="password"
            label="Mật khẩu ban đầu"
            rules={[
              { required: true, message: 'Nhập mật khẩu' },
              { min: 6, message: 'Tối thiểu 6 ký tự' },
            ]}
            hasFeedback
          >
            <Input.Password autoComplete="new-password" placeholder="Tối thiểu 6 ký tự" maxLength={128} />
          </Form.Item>
          <Form.Item
            name="confirmPassword"
            label="Xác nhận mật khẩu"
            dependencies={['password']}
            rules={[
              { required: true, message: 'Nhập lại mật khẩu' },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue('password') === value) {
                    return Promise.resolve()
                  }
                  return Promise.reject(new Error('Không khớp'))
                },
              }),
            ]}
            hasFeedback
          >
            <Input.Password autoComplete="new-password" placeholder="Nhập lại" maxLength={128} />
          </Form.Item>
          <Typography.Paragraph type="secondary" className="!mb-0 text-xs">
            Gửi email và mật khẩu cho người dùng qua kênh an toàn. Họ đăng nhập tại trang Đăng nhập.
          </Typography.Paragraph>
        </Form>
      </Modal>

      <Modal
        title="Đổi vai trò"
        open={roleModal != null}
        onCancel={() => setRoleModal(null)}
        onOk={() => {
          if (!roleModal) return
          if (session?.user?.id === roleModal.id && nextRole === 'USER') {
            message.warning('Không thể tự đổi vai trò của mình thành USER')
            return
          }
          patchUser.mutate(
            { id: roleModal.id, body: { role: nextRole } },
            { onSettled: () => setRoleModal(null) },
          )
        }}
      >
        {roleModal && session?.user?.id === roleModal.id ? (
          <Typography.Paragraph type="secondary" className="!mt-0 !mb-3 text-sm">
            Bạn không thể tự hạ vai trò của mình xuống USER. Admin khác vẫn có thể đổi vai trò cho bạn hoặc cho
            admin khác.
          </Typography.Paragraph>
        ) : null}
        <Select
          className="w-full"
          value={nextRole}
          onChange={(v) => setNextRole(v)}
          options={[
            {
              value: 'USER',
              label: 'USER',
              disabled: !!roleModal && session?.user?.id === roleModal.id,
            },
            { value: 'ADMIN', label: 'ADMIN' },
          ]}
        />
      </Modal>
    </AppLayout>
  )
}
