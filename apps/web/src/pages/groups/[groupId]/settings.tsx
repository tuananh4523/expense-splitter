import AppLayout from '@/components/layout/AppLayout'
import { AvatarUpload, type AvatarUploadRef } from '@/components/shared/AvatarUpload'
import { IconPicker, type IconPickerValue } from '@/components/shared/IconPicker'
import { MoneyInputNumber } from '@/components/shared/MoneyInputNumber'
import { useFund } from '@/hooks/useFund'
import { useDeleteGroup, useGroup, useUpdateGroup, useUpsertGroupFund } from '@/hooks/useGroup'
import { formatMoneyInputVN, parseMoneyInputVN } from '@/utils/currency'
import { withAuth } from '@/utils/withAuth'
import { WarningOutlined } from '@ant-design/icons'
import { App, Button, Card, Form, Input, Popconfirm, Switch, Typography } from 'antd'
import { useRouter } from 'next/router'
import { useEffect, useRef, useState } from 'react'

export const getServerSideProps = withAuth()

export default function GroupSettingsPage() {
  const { message } = App.useApp()
  const router = useRouter()
  const groupId = typeof router.query.groupId === 'string' ? router.query.groupId : ''
  const { data: group, isLoading } = useGroup(groupId)
  const { data: fund } = useFund(groupId, Boolean(group?.fundBalance != null))
  const update = useUpdateGroup(groupId)
  const del = useDeleteGroup(groupId)
  const fundMut = useUpsertGroupFund(groupId)

  const avatarRef = useRef<AvatarUploadRef>(null)
  const initialised = useRef(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [iconData, setIconData] = useState<IconPickerValue>({
    icon: 'mdi:account-group-outline',
    color: '#0073AA',
  })
  const [requireApproval, setRequireApproval] = useState(false)
  const [debtReminderEnabled, setDebtReminderEnabled] = useState(false)
  const [debtReminderDays, setDebtReminderDays] = useState(7)
  const [fundEnabled, setFundEnabled] = useState(false)
  const [lowThreshold, setLowThreshold] = useState(0)
  const [dissolveName, setDissolveName] = useState('')

  useEffect(() => {
    if (group && !initialised.current) {
      initialised.current = true
      setName(group.name)
      setDescription(group.description ?? '')
      setAvatarUrl(group.avatarUrl ?? null)
      setIconData({
        icon: group.icon ?? 'mdi:account-group-outline',
        color: group.color ?? '#0073AA',
      })
      setRequireApproval(group.requireApproval ?? false)
      setDebtReminderEnabled(group.debtReminderEnabled ?? false)
      setDebtReminderDays(group.debtReminderDays ?? 7)
      setFundEnabled(group.fundBalance != null)
    }
  }, [group])

  useEffect(() => {
    if (fund) setLowThreshold(Number(fund.lowThreshold))
  }, [fund])

  useEffect(() => {
    if (!isLoading && group && group.myRole !== 'LEADER') {
      void router.replace(`/groups/${groupId}`)
    }
  }, [isLoading, group, groupId, router])

  if (!groupId) return null
  if (isLoading || !group) return null
  if (group.myRole !== 'LEADER') return null

  const saveInfo = async () => {
    let finalAvatarUrl = avatarUrl?.startsWith('blob:') ? null : (avatarUrl ?? null)
    if (avatarRef.current?.hasPending) {
      finalAvatarUrl = await avatarRef.current.uploadPending()
    }
    try {
      const updated = await update.mutateAsync({
        name,
        description: description || null,
        avatarUrl: finalAvatarUrl,
        icon: iconData.icon,
        color: iconData.color,
        requireApproval,
      })
      setAvatarUrl(updated.avatarUrl ?? null)
      message.success('Đã lưu')
    } catch (e) {
      message.error(e instanceof Error ? e.message : 'Lỗi')
    }
  }

  return (
    <AppLayout title="Cài đặt nhóm">
      <div className="flex flex-col gap-8">
        <Card title="Thông tin nhóm" classNames={{ body: 'pt-1' }}>
          <Form layout="vertical" className="[&_.ant-form-item:last-child]:!mb-0">
            <Form.Item label="Ảnh bìa nhóm" className="!mb-5">
              <div className="flex flex-col gap-3">
                <AvatarUpload
                  value={avatarUrl}
                  onChange={setAvatarUrl}
                  uploadRef={avatarRef}
                  mode="cover"
                />
                <Typography.Text type="secondary" className="text-xs">
                  Sau khi cắt xong, bấm <strong>Lưu</strong> để cập nhật.
                </Typography.Text>
              </div>
            </Form.Item>
            <Form.Item label="Icon nhóm" className="!mb-5">
              <div className="flex items-center gap-3">
                <IconPicker value={iconData} onChange={setIconData} size={48} />
                <Typography.Text type="secondary" className="text-sm">
                  Nhấn để chọn icon và màu
                </Typography.Text>
              </div>
            </Form.Item>
            <Form.Item label="Tên nhóm" className="!mb-5">
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </Form.Item>
            <Form.Item label="Mô tả" className="!mb-6">
              <Input.TextArea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
              />
            </Form.Item>
            <Form.Item className="!mb-6" valuePropName="checked">
              <div className="flex items-center gap-3">
                <span>Bật phê duyệt thành viên mới</span>
                <Switch checked={requireApproval} onChange={setRequireApproval} />
              </div>
              <Typography.Text type="secondary" className="block text-sm">
                Người tham gia bằng mã mời sẽ cần chờ Quản trị viên duyệt mới được vào nhóm.
              </Typography.Text>
            </Form.Item>
            <Button type="primary" loading={update.isPending} onClick={() => void saveInfo()}>
              Lưu
            </Button>
          </Form>
        </Card>

        <Card title="Cấu hình nhắc nợ (Cron job)" classNames={{ body: 'pt-1' }}>
          <Form layout="vertical">
            <Form.Item className="!mb-6" valuePropName="checked">
              <div className="flex items-center gap-3">
                <span>Bật tự động nhắc nợ</span>
                <Switch 
                  checked={debtReminderEnabled} 
                  onChange={(checked) => {
                    setDebtReminderEnabled(checked)
                    void update.mutateAsync({ debtReminderEnabled: checked })
                  }} 
                />
              </div>
              <Typography.Text type="secondary" className="block text-sm">
                Tính năng này sẽ tự động tìm các khoản chi chưa thanh toán để gửi nhắc nợ qua thông báo (notification).
              </Typography.Text>
            </Form.Item>
            {debtReminderEnabled && (
                <Form.Item label="Thời hạn nhắc khéo (ngày)" className="!mb-6">
                  <div className="flex items-center gap-3">
                    <Input
                      type="number"
                      min={1}
                      value={debtReminderDays}
                      onChange={(e) => setDebtReminderDays(Number(e.target.value) || 7)}
                      style={{ maxWidth: 120 }}
                    />
                    <Button
                      type="primary"
                      onClick={() => {
                      void update.mutateAsync({ debtReminderDays })
                        .then(() => message.success('Đã lưu thời hạn nhắc nợ'))
                      }}
                    >
                      Lưu
                    </Button>
                  </div>
                  <Typography.Text type="secondary" className="block text-sm">
                    Gửi nhắc nhở nếu khoản chi tiêu còn nợ vượt quá số ngày cấu hình (tính từ ngày thanh toán).
                  </Typography.Text>
                </Form.Item>
            )}
          </Form>
        </Card>

        <Card title="Quỹ nhóm" classNames={{ body: 'pt-1' }}>
          <div className="mb-6 flex flex-wrap items-center gap-3">
            <span>Bật quỹ nhóm</span>
            <Switch
              checked={fundEnabled}
              onChange={(v) => {
                setFundEnabled(v)
                if (v && group.fundBalance == null) {
                  void fundMut.mutateAsync({ enable: true }).then(
                    () => message.success('Đã bật quỹ'),
                    (e) => message.error(e instanceof Error ? e.message : 'Lỗi'),
                  )
                }
              }}
              disabled={group.fundBalance != null}
            />
            {group.fundBalance != null ? (
              <Typography.Text type="secondary">Quỹ đang hoạt động</Typography.Text>
            ) : null}
          </div>
          {fundEnabled || group.fundBalance != null ? (
            <Form layout="vertical">
              <Form.Item label="Ngưỡng cảnh báo số dư thấp (VND)">
                <MoneyInputNumber
                  min={0}
                  className="w-full max-w-xs"
                  value={lowThreshold}
                  onChange={(v) => setLowThreshold(Number(v) || 0)}
                  formatter={(v) => formatMoneyInputVN(v as number | string | undefined)}
                  parser={(v) => parseMoneyInputVN(v ?? undefined)}
                />
              </Form.Item>
              <Button
                onClick={() =>
                  void fundMut
                    .mutateAsync({ lowThreshold })
                    .then(() => message.success('Đã cập nhật ngưỡng'))
                    .catch((e) => message.error(e instanceof Error ? e.message : 'Lỗi'))
                }
              >
                Lưu ngưỡng
              </Button>
            </Form>
          ) : null}
        </Card>

        {/* <div className="mb-6">
        <InviteCodeCard group={group} groupId={groupId} canConfigureInviteCode />
      </div> */}

        <Card title="Giải tán nhóm" className="border-red-200" classNames={{ body: 'pt-1' }}>
          <Typography.Paragraph type="danger">
            <WarningOutlined /> Giải tán nhóm sẽ xoá toàn bộ dữ liệu nhóm.
          </Typography.Paragraph>
          <Typography.Paragraph type="secondary">
            Nhập đúng tên nhóm <Typography.Text strong>{group.name}</Typography.Text> để xác nhận.
          </Typography.Paragraph>
          <Input
            className="mb-3 max-w-md"
            placeholder="Tên nhóm"
            value={dissolveName}
            onChange={(e) => setDissolveName(e.target.value)}
          />
          <Popconfirm
            title="Xoá vĩnh viễn nhóm này?"
            okText="Giải tán"
            okButtonProps={{ danger: true, disabled: dissolveName !== group.name }}
            onConfirm={() =>
              void del
                .mutateAsync()
                .then(() => message.success('Đã giải tán nhóm'))
                .catch((e) => message.error(e instanceof Error ? e.message : 'Lỗi'))
            }
          >
            <Button danger loading={del.isPending} disabled={dissolveName !== group.name}>
              Giải tán nhóm
            </Button>
          </Popconfirm>
        </Card>
      </div>
    </AppLayout>
  )
}
