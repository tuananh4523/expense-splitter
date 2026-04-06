import AppLayout from '@/components/layout/AppLayout'
import { IconPicker, type IconPickerValue } from '@/components/shared/IconPicker'
import { api } from '@/lib/api'
import { withAdmin } from '@/utils/withAdmin'
import { PlusOutlined } from '@ant-design/icons'
import { Icon } from '@iconify/react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  App,
  Button,
  Form,
  Input,
  Modal,
  Popconfirm,
  Space,
  Switch,
  Table,
  Tag,
  Tooltip,
} from 'antd'
import { useMemo, useState } from 'react'

export const getServerSideProps = withAdmin()

type CatRow = {
  id: string
  name: string
  icon: string | null
  color: string | null
  isSystem: boolean
  expenseCount: number
}

function isIconifyId(s: string | null) {
  return Boolean(s?.includes(':'))
}

export default function AdminCategoriesPage() {
  const { message } = App.useApp()
  const qc = useQueryClient()
  const [open, setOpen] = useState(false)
  const [edit, setEdit] = useState<CatRow | null>(null)
  const [name, setName] = useState('')
  const [isSystem, setIsSystem] = useState(false)
  const [iconData, setIconData] = useState<IconPickerValue>({
    icon: 'mdi:wallet-outline',
    color: '#0073AA',
  })
  const [search, setSearch] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'categories'],
    queryFn: () => api.get<{ data: CatRow[] }>('/admin/categories').then((r) => r.data.data),
  })

  const resetForm = () => {
    setName('')
    setIsSystem(false)
    setIconData({ icon: 'mdi:wallet-outline', color: '#0073AA' })
    setEdit(null)
  }

  const save = useMutation({
    mutationFn: async () => {
      if (edit) {
        await api.patch(`/admin/categories/${edit.id}`, {
          name: name.trim(),
          icon: iconData.icon,
          color: iconData.color,
        })
      } else {
        await api.post('/admin/categories', {
          name: name.trim(),
          icon: iconData.icon,
          color: iconData.color,
          isSystem,
        })
      }
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['admin', 'categories'] })
      void qc.invalidateQueries({ queryKey: ['categories'] })
      message.success('Đã lưu')
      setOpen(false)
      resetForm()
    },
    onError: (e: Error) => message.error(e.message),
  })

  const del = useMutation({
    mutationFn: (id: string) => api.delete(`/admin/categories/${id}`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['admin', 'categories'] })
      void qc.invalidateQueries({ queryKey: ['categories'] })
      message.success('Đã xóa')
    },
    onError: (e: Error) => message.error(e.message),
  })

  const filteredRows = useMemo(() => {
    const rows = data ?? []
    const q = search.trim().toLowerCase()
    if (!q) return rows
    return rows.filter((r) => r.name.toLowerCase().includes(q))
  }, [data, search])

  return (
    <AppLayout title="Quản trị — Danh mục">
      <div className="mb-6 flex justify-end">
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => {
            resetForm()
            setOpen(true)
          }}
        >
          Tạo danh mục
        </Button>
      </div>
      <div className="mb-6">
        <Input.Search
          allowClear
          placeholder="Tìm theo tên danh mục…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full sm:!w-[260px]"
        />
      </div>
      <Table<CatRow>
        rowKey="id"
        loading={isLoading}
        dataSource={filteredRows}
        scroll={{ x: 'max-content' }}
        columns={[
          {
            title: '',
            key: 'ic',
            width: 48,
            render: (_: unknown, r) =>
              r.icon && isIconifyId(r.icon) ? (
                <Icon icon={r.icon} width={22} color={r.color ?? '#0073AA'} />
              ) : (
                <span className="text-lg">{r.icon ?? '—'}</span>
              ),
          },
          { title: 'Tên', dataIndex: 'name', align: 'left' },
          {
            title: 'Loại',
            dataIndex: 'isSystem',
            align: 'left',
            render: (s: boolean) => (s ? <Tag>Hệ thống</Tag> : <Tag color="blue">Tuỳ chỉnh</Tag>),
          },
          { title: 'Số chi tiêu', dataIndex: 'expenseCount', align: 'right' },
          {
            title: '',
            key: 'x',
            align: 'right',
            width: 80,
            render: (_: unknown, r) => (
              <Space size={4}>
                <Tooltip title="Sửa danh mục">
                  <Button
                    type="text"
                    size="small"
                    icon={<Icon icon="mdi:pencil-outline" width={16} />}
                    onClick={() => {
                      setEdit(r)
                      setName(r.name)
                      setIsSystem(r.isSystem)
                      setIconData({
                        icon: r.icon ?? 'mdi:wallet-outline',
                        color: r.color ?? '#0073AA',
                      })
                      setOpen(true)
                    }}
                  />
                </Tooltip>
                <Popconfirm
                  title="Xóa danh mục?"
                  disabled={r.expenseCount > 0}
                  onConfirm={() => del.mutate(r.id)}
                >
                  <Tooltip title={r.expenseCount > 0 ? 'Danh mục đang được dùng' : 'Xóa danh mục'}>
                    <Button
                      type="text"
                      size="small"
                      danger
                      disabled={r.expenseCount > 0}
                      icon={<Icon icon="mdi:trash-can-outline" width={16} />}
                    />
                  </Tooltip>
                </Popconfirm>
              </Space>
            ),
          },
        ]}
      />
      <Modal
        title={edit ? 'Sửa danh mục' : 'Tạo danh mục'}
        open={open}
        onCancel={() => {
          setOpen(false)
          resetForm()
        }}
        onOk={() => save.mutate()}
        confirmLoading={save.isPending}
      >
        <Form layout="vertical" className="mt-2">
          <Form.Item label="Biểu tượng">
            <Space align="center">
              <IconPicker value={iconData} onChange={setIconData} size={48} />
              <span className="text-stone-500 text-sm">Chọn icon và màu</span>
            </Space>
          </Form.Item>
          <Form.Item label="Tên" required>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </Form.Item>
          {!edit ? (
            <Form.Item label="Danh mục hệ thống">
              <Switch checked={isSystem} onChange={setIsSystem} />
            </Form.Item>
          ) : null}
        </Form>
      </Modal>
    </AppLayout>
  )
}
