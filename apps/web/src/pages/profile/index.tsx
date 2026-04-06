import AppLayout from '@/components/layout/AppLayout'
import { AvatarUpload, type AvatarUploadRef } from '@/components/shared/AvatarUpload'
import { BankQrPreviewModal } from '@/components/shared/BankQrPreviewModal'
import type { BankAccountRow } from '@/hooks/useProfile'
import { useCreateBank, useDeleteBank, useMe, usePatchBank, usePatchMe } from '@/hooks/useProfile'
import { useResolveViewUrls } from '@/hooks/useResolveViewUrls'
import { useUpload } from '@/hooks/useUpload'
import { useAppUiTheme } from '@/theme/AppThemeProvider'
import { withAuth } from '@/utils/withAuth'
import { CheckOutlined } from '@ant-design/icons'
import {
  MAX_IMAGE_UPLOAD_BYTES,
  MAX_IMAGE_UPLOAD_MB,
  UI_THEME_IDS,
  UI_THEME_LABELS,
  UI_THEME_SWATCHES,
  type UiThemeId,
  VIETNAM_BANKS,
} from '@expense/types'
import { Icon } from '@iconify/react'
import {
  App,
  Avatar,
  Badge,
  Button,
  Card,
  Col,
  Form,
  Input,
  Modal,
  Popconfirm,
  Row,
  Select,
  Skeleton,
  Switch,
  Typography,
  Upload,
} from 'antd'
import { useSession } from 'next-auth/react'
import { useEffect, useMemo, useRef, useState } from 'react'

const QR_ALLOWED = ['image/jpeg', 'image/png', 'image/webp']

export const getServerSideProps = withAuth()

function ProfileThemeGrid() {
  const { message } = App.useApp()
  const { themeId, setUiTheme, isSavingTheme } = useAppUiTheme()

  const pick = async (id: UiThemeId) => {
    try {
      await setUiTheme(id)
      message.success('Đã cập nhật giao diện')
    } catch {
      message.error('Không lưu được giao diện')
    }
  }

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8">
      {UI_THEME_IDS.map((id) => {
        const sw = UI_THEME_SWATCHES[id]
        const active = themeId === id
        return (
          <button
            key={id}
            type="button"
            disabled={isSavingTheme}
            onClick={() => void pick(id)}
            className={`flex flex-col items-center gap-1.5 rounded-xl border-2 p-2 text-center transition-colors ${
              active ? 'border-brand bg-brand-soft' : 'border-transparent hover:bg-page'
            }`}
          >
            <div className="flex h-4 w-full max-w-[56px] overflow-hidden rounded-sm">
              {sw.map((c, i) => (
                <span key={i} className="min-w-0 flex-1" style={{ background: c }} />
              ))}
            </div>
            <span className="w-full truncate text-[11px] font-medium text-wp-slate">
              {UI_THEME_LABELS[id]}
            </span>
            {active ? <CheckOutlined className="text-sm text-brand" /> : <span className="h-4" />}
          </button>
        )
      })}
    </div>
  )
}

export default function ProfilePage() {
  const { message } = App.useApp()
  const { update: updateSession } = useSession()
  const { data: me, isLoading } = useMe()
  const patchMe = usePatchMe()
  const createBank = useCreateBank()
  const patchBank = usePatchBank()
  const delBank = useDeleteBank()
  const { upload } = useUpload()

  const avatarRef = useRef<AvatarUploadRef>(null)
  const initialised = useRef(false)
  const [name, setName] = useState('')
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [phone, setPhone] = useState('')
  const [bio, setBio] = useState('')

  const [bankOpen, setBankOpen] = useState(false)
  const [bankEditId, setBankEditId] = useState<string | null>(null)
  const [bankCode, setBankCode] = useState<string | undefined>()
  const [bankAcc, setBankAcc] = useState('')
  const [bankHolder, setBankHolder] = useState('')
  const [bankDefault, setBankDefault] = useState(false)
  /** URL lưu trữ (viewUrl) sau upload mới; null = không đổi / chưa chọn */
  const [bankQrNewCanonical, setBankQrNewCanonical] = useState<string | null>(null)
  const [bankQrRemoved, setBankQrRemoved] = useState(false)
  /** Ảnh QR hiện có (đã ký) khi mở sửa — chỉ để hiển thị */
  const [bankExistingQrSigned, setBankExistingQrSigned] = useState<string | null>(null)
  const [bankQrUploading, setBankQrUploading] = useState(false)
  const [listQrModalOpen, setListQrModalOpen] = useState(false)
  const [listQrUrl, setListQrUrl] = useState<string | null>(null)

  const bankQrResolveKey = useMemo(
    () => (bankQrNewCanonical ? [bankQrNewCanonical] : []),
    [bankQrNewCanonical],
  )
  const { data: bankQrResolved = {} } = useResolveViewUrls(bankQrResolveKey)
  const bankQrThumbUrl = bankQrRemoved
    ? null
    : bankQrNewCanonical
      ? (bankQrResolved[bankQrNewCanonical] ?? null)
      : bankExistingQrSigned

  useEffect(() => {
    if (!me || initialised.current) return
    initialised.current = true
    setName(me.name)
    setAvatarUrl(me.avatarUrl ?? null)
    setPhone(me.phone ?? '')
    setBio(me.bio ?? '')
  }, [me])

  const saveProfile = async () => {
    const p = phone.trim()
    if (p && !/^0\d{9,10}$/.test(p)) {
      message.error('Số điện thoại không hợp lệ (0xxxxxxxxx)')
      return
    }
    // Upload pending cropped file if any
    let finalAvatarUrl = avatarUrl?.startsWith('blob:') ? null : (avatarUrl ?? null)
    if (avatarRef.current?.hasPending) {
      finalAvatarUrl = await avatarRef.current.uploadPending()
    }
    try {
      const data = await patchMe.mutateAsync({
        name: name.trim(),
        avatarUrl: finalAvatarUrl,
        bio: bio.trim() || null,
        phone: p || null,
      })
      setAvatarUrl(data.avatarUrl ?? null)
      message.success('Đã lưu')
      try {
        await updateSession({
          user: {
            name: data.name,
            image: data.avatarUrl ?? null,
          },
        })
      } catch {
        /* Header lấy tên/ảnh từ refetch /users/me */
      }
    } catch (e) {
      message.error(e instanceof Error ? e.message : 'Lỗi')
    }
  }

  const closeBankModal = () => {
    setBankOpen(false)
    setBankEditId(null)
    setBankQrNewCanonical(null)
    setBankQrRemoved(false)
    setBankExistingQrSigned(null)
    setBankQrUploading(false)
  }

  const openAddBank = () => {
    if (me && me.bankAccounts.length >= 5) {
      message.warning('Đã đủ 5 tài khoản')
      return
    }
    setBankEditId(null)
    setBankCode(undefined)
    setBankAcc('')
    setBankHolder('')
    setBankDefault((me?.bankAccounts.length ?? 0) === 0)
    setBankQrNewCanonical(null)
    setBankQrRemoved(false)
    setBankExistingQrSigned(null)
    setBankOpen(true)
  }

  const openEditBank = (b: BankAccountRow) => {
    setBankEditId(b.id)
    setBankCode(b.bankCode)
    setBankAcc(b.accountNumber)
    setBankHolder(b.accountName)
    setBankDefault(b.isDefault)
    setBankQrNewCanonical(null)
    setBankQrRemoved(false)
    setBankExistingQrSigned(b.qrImageUrl ?? null)
    setBankOpen(true)
  }

  const submitBank = () => {
    if (!bankCode || !bankAcc.trim() || !bankHolder.trim()) {
      message.error('Điền đủ thông tin')
      return
    }
    if (bankEditId) {
      const body: {
        bankCode: string
        accountNumber: string
        accountName: string
        isDefault: boolean
        qrImageUrl?: string | null
      } = {
        bankCode,
        accountNumber: bankAcc.trim(),
        accountName: bankHolder.trim(),
        isDefault: bankDefault,
      }
      if (bankQrRemoved) body.qrImageUrl = null
      else if (bankQrNewCanonical) body.qrImageUrl = bankQrNewCanonical

      void patchBank
        .mutateAsync({
          bankId: bankEditId,
          body,
        })
        .then(() => {
          message.success('Đã cập nhật tài khoản')
          closeBankModal()
        })
        .catch((e) => message.error(e instanceof Error ? e.message : 'Lỗi'))
      return
    }
    void createBank
      .mutateAsync({
        bankCode,
        accountNumber: bankAcc.trim(),
        accountName: bankHolder.trim(),
        isDefault: bankDefault,
        ...(bankQrNewCanonical ? { qrImageUrl: bankQrNewCanonical } : {}),
      })
      .then(() => {
        message.success('Đã thêm tài khoản')
        closeBankModal()
      })
      .catch((e) => message.error(e instanceof Error ? e.message : 'Lỗi'))
  }

  if (isLoading || !me) {
    return (
      <AppLayout title="Tài khoản của tôi">
        <Skeleton active paragraph={{ rows: 8 }} />
      </AppLayout>
    )
  }

  return (
    <AppLayout title="Tài khoản của tôi">
      <Row gutter={[24, 24]}>
        <Col xs={24} lg={9} style={{ maxWidth: 360 }}>
          <Card title="Thông tin cơ bản">
            <div className="mb-6 flex flex-col items-center gap-2">
              <AvatarUpload value={avatarUrl} onChange={setAvatarUrl} uploadRef={avatarRef} />
              <Typography.Text type="secondary" className="max-w-[260px] text-center text-xs">
                Chọn ảnh để xem trước ngay. Sau khi tải lên, bấm <strong>Lưu thay đổi</strong> để
                cập nhật header và menu.
              </Typography.Text>
            </div>
            <Form layout="vertical" requiredMark={false}>
              <Form.Item label="Tên hiển thị">
                <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={120} />
              </Form.Item>
              <Form.Item label="Email" help="Email không thể thay đổi">
                <Input value={me.email} disabled />
              </Form.Item>
              <Form.Item label="Số điện thoại" help="Định dạng: 0xxxxxxxxx">
                <Input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="0xxxxxxxxx"
                />
              </Form.Item>
              <Form.Item label="Mô tả">
                <Input.TextArea
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  maxLength={300}
                  rows={4}
                  showCount
                />
              </Form.Item>
              <div className="flex justify-end">
                <Button
                  type="primary"
                  loading={patchMe.isPending}
                  onClick={() => void saveProfile()}
                >
                  Lưu thay đổi
                </Button>
              </div>
            </Form>
          </Card>
        </Col>

        <Col xs={24} lg={15} flex="1 1 auto">
          <Card title="Tài khoản ngân hàng">
            <div className="mb-4 flex flex-wrap justify-between gap-2">
              <Typography.Text type="secondary">
                Tối đa 5 tài khoản ({me.bankAccounts.length}/5)
              </Typography.Text>
              <Button type="primary" onClick={() => openAddBank()}>
                Thêm tài khoản
              </Button>
            </div>
            {me.bankAccounts.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '48px 24px' }}>
                <Icon icon="fluent:box-24-regular" width={40} color="#D6D3D1" />
                <div style={{ marginTop: 12, color: '#78716C', fontSize: 14 }}>
                  Chưa có tài khoản ngân hàng
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {me.bankAccounts.map((b) => (
                  <Card
                    key={b.id}
                    size="small"
                    style={{
                      background: '#fff',
                      border: '1px solid #E7E5E4',
                      borderRadius: 12,
                    }}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="flex gap-3">
                        <Avatar
                          style={{
                            background: '#E5F4FA',
                            color: '#0073AA',
                            fontWeight: 700,
                          }}
                        >
                          {b.bankCode.slice(0, 2)}
                        </Avatar>
                        <div>
                          <div className="font-semibold text-stone-900">{b.bankName}</div>
                          <div className="font-mono text-stone-800">{b.accountNumber}</div>
                          <div className="text-sm text-stone-500">{b.accountName}</div>
                          {b.isDefault ? (
                            <Badge status="processing" text="Mặc định" className="mt-1" />
                          ) : null}
                          {b.qrImageUrl ? (
                            <div className="mt-1">
                              <Button
                                type={b.isDefault ? 'primary' : 'link'}
                                size="small"
                                className={b.isDefault ? '' : '!h-auto !p-0'}
                                onClick={() => {
                                  setListQrUrl(b.qrImageUrl)
                                  setListQrModalOpen(true)
                                }}
                              >
                                Xem mã QR
                              </Button>
                            </div>
                          ) : null}
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        <Button size="small" type="link" onClick={() => openEditBank(b)}>
                          Sửa
                        </Button>
                        {!b.isDefault ? (
                          <Button
                            size="small"
                            type="link"
                            onClick={() =>
                              void patchBank
                                .mutateAsync({ bankId: b.id, body: { isDefault: true } })
                                .then(() => message.success('Đã đặt mặc định'))
                                .catch((e) => message.error(e instanceof Error ? e.message : 'Lỗi'))
                            }
                          >
                            Đặt mặc định
                          </Button>
                        ) : null}
                        <Popconfirm
                          title="Xóa tài khoản này?"
                          onConfirm={() =>
                            void delBank
                              .mutateAsync(b.id)
                              .then(() => message.success('Đã xóa'))
                              .catch((e) => message.error(e instanceof Error ? e.message : 'Lỗi'))
                          }
                        >
                          <Button size="small" danger type="link">
                            Xóa
                          </Button>
                        </Popconfirm>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </Card>
        </Col>

        {/* <Col span={24}>
            <Card title="Giao diện màu">
              <Typography.Paragraph type="secondary" className="!mb-4 max-w-2xl text-sm">
                Bảng màu kiểu WordPress Admin. Khi đã đăng nhập, lựa chọn được lưu theo tài khoản; trình duyệt
                cũng nhớ để giảm nháy màu khi tải trang.
              </Typography.Paragraph>
              <ProfileThemeGrid />
            </Card>
          </Col> */}
      </Row>

      <Modal
        title={bankEditId ? 'Sửa tài khoản ngân hàng' : 'Thêm tài khoản ngân hàng'}
        open={bankOpen}
        onCancel={() => closeBankModal()}
        width={520}
        destroyOnClose
        footer={[
          <Button key="c" onClick={() => closeBankModal()}>
            Hủy
          </Button>,
          <Button
            key="s"
            type="primary"
            loading={createBank.isPending || patchBank.isPending}
            onClick={() => submitBank()}
          >
            {bankEditId ? 'Lưu' : 'Thêm'}
          </Button>,
        ]}
      >
        <Form layout="vertical">
          <Form.Item label="Ngân hàng" required>
            <Select
              showSearch
              placeholder="Chọn ngân hàng"
              optionFilterProp="label"
              value={bankCode}
              onChange={setBankCode}
              options={VIETNAM_BANKS.map((bk) => ({
                value: bk.code,
                label: `${bk.shortName} — ${bk.fullName}`,
              }))}
            />
          </Form.Item>
          <Form.Item label="Số tài khoản" required>
            <Input value={bankAcc} onChange={(e) => setBankAcc(e.target.value)} />
          </Form.Item>
          <Form.Item label="Tên chủ tài khoản" required>
            <Input value={bankHolder} onChange={(e) => setBankHolder(e.target.value)} />
          </Form.Item>
          <Form.Item label="Đặt làm mặc định">
            <Switch checked={bankDefault} onChange={setBankDefault} />
          </Form.Item>
          <Form.Item
            label="Ảnh mã QR (tuỳ chọn)"
            help={`JPEG, PNG, WebP — tối đa ${MAX_IMAGE_UPLOAD_MB}MB. Người nhận có thể xem trong hồ sơ để quét chuyển khoản.`}
          >
            <div className="flex flex-col gap-2">
              {bankQrThumbUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- presigned / resolved URL
                <img
                  src={bankQrThumbUrl}
                  alt="Mã QR"
                  className="max-h-44 max-w-[200px] rounded-lg border border-stone-200 object-contain"
                />
              ) : null}
              <div className="flex flex-wrap items-center gap-2">
                <Upload
                  accept={QR_ALLOWED.join(',')}
                  showUploadList={false}
                  disabled={bankQrUploading}
                  beforeUpload={(file) => {
                    if (!QR_ALLOWED.includes(file.type)) {
                      message.error('Chỉ chấp nhận JPEG, PNG, WebP')
                      return Upload.LIST_IGNORE
                    }
                    if (file.size > MAX_IMAGE_UPLOAD_BYTES) {
                      message.error(`Ảnh tối đa ${MAX_IMAGE_UPLOAD_MB}MB`)
                      return Upload.LIST_IGNORE
                    }
                    void (async () => {
                      setBankQrUploading(true)
                      try {
                        const url = await upload(file, 'bankQr')
                        setBankQrNewCanonical(url)
                        setBankQrRemoved(false)
                        message.success('Đã tải ảnh QR')
                      } catch (e) {
                        message.error(e instanceof Error ? e.message : 'Upload thất bại')
                      } finally {
                        setBankQrUploading(false)
                      }
                    })()
                    return false
                  }}
                >
                  <Button loading={bankQrUploading}>
                    {bankQrThumbUrl ? 'Đổi ảnh QR' : 'Tải ảnh QR'}
                  </Button>
                </Upload>
                {!bankQrRemoved && (bankExistingQrSigned || bankQrNewCanonical) ? (
                  <Button
                    type="link"
                    danger
                    className="!p-0"
                    onClick={() => {
                      setBankQrRemoved(true)
                      setBankQrNewCanonical(null)
                    }}
                  >
                    Xóa ảnh QR
                  </Button>
                ) : null}
              </div>
            </div>
          </Form.Item>
        </Form>
      </Modal>
      <BankQrPreviewModal
        open={listQrModalOpen}
        imageUrl={listQrUrl}
        onClose={() => {
          setListQrModalOpen(false)
          setListQrUrl(null)
        }}
      />
    </AppLayout>
  )
}
