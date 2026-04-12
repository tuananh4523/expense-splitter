import AppLayout from '@/components/layout/AppLayout'
import { IconPicker, type IconPickerValue } from '@/components/shared/IconPicker'
import { useCategories } from '@/hooks/useExpenses'
import {
  useCreateGroupCategory,
  useDeleteGroupCategory,
  useGroup,
  useGroupUsedTags,
  useUpdateGroupCategory,
  useUpdateGroupPresetTags,
} from '@/hooks/useGroup'
import { withAuth } from '@/utils/withAuth'
import { PlusOutlined } from '@ant-design/icons'
import { Icon } from '@iconify/react'
import {
  App,
  Button,
  Form,
  Input,
  Modal,
  Popconfirm,
  Select,
  Space,
  Spin,
  Table,
  Tabs,
  Tag,
  Typography,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'

export const getServerSideProps = withAuth()

type CatRow = {
  id: string
  name: string
  icon: string | null
  color: string | null
  isSystem: boolean
}

function isIconifyId(s: string | null) {
  return Boolean(s?.includes(':'))
}

export default function GroupLabelsPage() {
  const { message } = App.useApp()
  const router = useRouter()
  const groupId = typeof router.query.groupId === 'string' ? router.query.groupId : ''
  const { data: group } = useGroup(groupId)
  const { data: categories = [], isLoading: loadingCat } = useCategories(groupId)
  const { data: usedTags = [], isLoading: loadingUsedTags } = useGroupUsedTags(groupId)
  const canManage = group?.myRole === 'LEADER' || group?.myRole === 'VICE_LEADER'

  const createCat = useCreateGroupCategory(groupId)
  const updateCat = useUpdateGroupCategory(groupId)
  const deleteCat = useDeleteGroupCategory(groupId)
  const savePresetTags = useUpdateGroupPresetTags(groupId)

  const [catModalOpen, setCatModalOpen] = useState(false)
  const [editCatId, setEditCatId] = useState<string | null>(null)
  const [catName, setCatName] = useState('')
  const [iconData, setIconData] = useState<IconPickerValue>({
    icon: 'mdi:label-outline',
    color: '#0073AA',
  })

  const [tagDraft, setTagDraft] = useState<string[]>([])
  useEffect(() => {
    setTagDraft(group?.presetTags ?? [])
  }, [group?.presetTags])

  const openNewCat = () => {
    setEditCatId(null)
    setCatName('')
    setIconData({ icon: 'mdi:label-outline', color: '#0073AA' })
    setCatModalOpen(true)
  }

  const openEditCat = (row: CatRow) => {
    setEditCatId(row.id)
    setCatName(row.name)
    setIconData({
      icon: row.icon && isIconifyId(row.icon) ? row.icon : 'mdi:label-outline',
      color: row.color ?? '#0073AA',
    })
    setCatModalOpen(true)
  }

  const saveCat = async () => {
    const name = catName.trim()
    if (!name) {
      message.warning('Nhập tên danh mục')
      return
    }
    try {
      if (editCatId) {
        await updateCat.mutateAsync({
          categoryId: editCatId,
          name,
          icon: iconData.icon,
          color: iconData.color,
        })
      } else {
        await createCat.mutateAsync({ name, icon: iconData.icon, color: iconData.color })
      }
      message.success('Đã lưu')
      setCatModalOpen(false)
    } catch (e: unknown) {
      message.error(e instanceof Error ? e.message : 'Lỗi')
    }
  }

  const saveTags = async () => {
    try {
      await savePresetTags.mutateAsync(tagDraft)
      message.success('Đã lưu thẻ gợi ý')
    } catch (e: unknown) {
      message.error(e instanceof Error ? e.message : 'Lỗi')
    }
  }

  const columns: ColumnsType<CatRow> = [
    {
      title: '',
      key: 'ic',
      width: 48,
      render: (_: unknown, r) =>
        r.icon && isIconifyId(r.icon) ? (
          <Icon icon={r.icon} width={22} color={r.color ?? '#0073AA'} />
        ) : (
          <span className="text-stone-400">—</span>
        ),
    },
    { title: 'Tên', dataIndex: 'name' },
    {
      title: 'Nguồn',
      key: 'src',
      width: 140,
      render: (_: unknown, r: CatRow) =>
        r.isSystem ? (
          <Tag color="blue">Hệ thống</Tag>
        ) : (
          <Tag color="default">Nhóm</Tag>
        ),
    },
    ...(canManage
      ? [
          {
            title: '',
            key: 'actions',
            width: 168,
            align: 'right' as const,
            render: (_: unknown, r: CatRow) =>
              r.isSystem ? (
                <span className="text-stone-400">—</span>
              ) : (
                <Space size="small">
                  <Button type="link" size="small" onClick={() => openEditCat(r)}>
                    Sửa
                  </Button>
                  <Popconfirm
                    title="Xóa danh mục?"
                    description="Chỉ xóa được khi chưa có chi tiêu dùng danh mục này."
                    onConfirm={async () => {
                      try {
                        await deleteCat.mutateAsync(r.id)
                        message.success('Đã xóa')
                      } catch (e: unknown) {
                        message.error(e instanceof Error ? e.message : 'Lỗi')
                      }
                    }}
                  >
                    <Button type="link" size="small" danger>
                      Xóa
                    </Button>
                  </Popconfirm>
                </Space>
              ),
          } satisfies ColumnsType<CatRow>[number],
        ]
      : []),
  ]

  if (!groupId) return null

  return (
    <AppLayout title="Danh mục & thẻ">
      <Typography.Paragraph type="secondary" className="!mb-6 max-w-3xl">
        Xem toàn bộ danh mục đang dùng trong nhóm (hệ thống + nhóm). Thẻ đang gắn trên chi tiêu và thẻ
        gợi ý (do trưởng/phó cấu hình) đều hiển thị ở tab Thẻ.
      </Typography.Paragraph>

      <Tabs
        items={[
          {
            key: 'cat',
            label: 'Danh mục',
            children: (
              <>
                {canManage ? (
                  <div className="mb-4 flex justify-end">
                    <Button type="primary" icon={<PlusOutlined />} onClick={openNewCat}>
                      Thêm danh mục nhóm
                    </Button>
                  </div>
                ) : null}
                <Table<CatRow>
                  rowKey="id"
                  loading={loadingCat}
                  dataSource={categories}
                  columns={columns}
                  pagination={false}
                  locale={{ emptyText: 'Chưa có danh mục' }}
                  scroll={{ x: 'max-content' }}
                />
              </>
            ),
          },
          {
            key: 'tags',
            label: 'Thẻ',
            children: (
              <div className="max-w-2xl space-y-8">
                <div>
                  <Typography.Title level={5} className="!mb-2">
                    Thẻ đang dùng trên chi tiêu
                  </Typography.Title>
                  <Typography.Paragraph type="secondary" className="!mb-3 text-sm">
                    Gom từ mọi khoản chi chưa xóa trong nhóm (đọc-only).
                  </Typography.Paragraph>
                  {loadingUsedTags ? (
                    <Spin />
                  ) : usedTags.length === 0 ? (
                    <Typography.Text type="secondary">Chưa có thẻ nào trên chi tiêu.</Typography.Text>
                  ) : (
                    <Space wrap size={[8, 8]}>
                      {usedTags.map((t) => (
                        <Tag key={t}>{t}</Tag>
                      ))}
                    </Space>
                  )}
                </div>
                <div>
                  <Typography.Title level={5} className="!mb-2">
                    Thẻ gợi ý
                  </Typography.Title>
                  <Typography.Paragraph type="secondary" className="!mb-3 text-sm">
                    Hiện trong ô «Thẻ» khi thêm hoặc sửa chi tiêu. Trưởng nhóm hoặc phó nhóm chỉnh danh
                    sách; mọi thành viên đều thấy.
                  </Typography.Paragraph>
                  <Form layout="vertical">
                    <Form.Item label="Danh sách gợi ý">
                      <Select
                        mode="tags"
                        placeholder="Thêm thẻ (Enter để xác nhận)"
                        value={tagDraft}
                        onChange={setTagDraft}
                        disabled={!canManage}
                        className="w-full"
                        options={usedTags.map((t) => ({ value: t, label: t }))}
                      />
                    </Form.Item>
                    {canManage ? (
                      <Button
                        type="primary"
                        loading={savePresetTags.isPending}
                        onClick={() => void saveTags()}
                      >
                        Lưu thẻ gợi ý
                      </Button>
                    ) : null}
                  </Form>
                </div>
              </div>
            ),
          },
        ]}
      />

      <Modal
        title={editCatId ? 'Sửa danh mục' : 'Thêm danh mục'}
        open={catModalOpen}
        onCancel={() => setCatModalOpen(false)}
        onOk={() => void saveCat()}
        confirmLoading={createCat.isPending || updateCat.isPending}
        destroyOnClose
      >
        <Form layout="vertical" className="mt-2">
          <Form.Item label="Tên" required>
            <Input
              value={catName}
              onChange={(e) => setCatName(e.target.value)}
              placeholder="Ví dụ: Ăn nhóm, Xăng xe…"
            />
          </Form.Item>
          <Form.Item label="Biểu tượng & màu">
            <IconPicker value={iconData} onChange={setIconData} size={48} />
          </Form.Item>
        </Form>
      </Modal>
    </AppLayout>
  )
}
