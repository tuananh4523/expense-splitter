import { BankQrPreviewModal } from '@/components/shared/BankQrPreviewModal'
import { CurrencyDisplay } from '@/components/shared/CurrencyDisplay'
import { useUserProfile } from '@/hooks/useProfile'
import { fmtDate } from '@/utils/date'
import type { MemberDto } from '@expense/types'
import { Icon } from '@iconify/react'
import { App, Avatar, Button, Descriptions, Divider, Drawer, Skeleton, Tag, Typography } from 'antd'
import { useState } from 'react'

const roleLabel: Record<string, string> = {
  LEADER: 'Trưởng nhóm',
  VICE_LEADER: 'Phó nhóm',
  MEMBER: 'Thành viên',
}

function CopyButton({ text }: { text: string }) {
  const { message } = App.useApp()
  return (
    <button
      type="button"
      className="ml-1 text-stone-400 hover:text-brand transition-colors"
      onClick={() => {
        void navigator.clipboard.writeText(text).then(() => message.success('Đã sao chép'))
      }}
      title="Sao chép"
    >
      <Icon icon="mdi:content-copy" width={13} />
    </button>
  )
}

export function MemberProfileDrawer({
  member,
  onClose,
}: {
  member: MemberDto | null
  onClose: () => void
}) {
  const { data: profile, isLoading, isError } = useUserProfile(member?.userId ?? null)
  const [qrModalOpen, setQrModalOpen] = useState(false)
  const [qrModalUrl, setQrModalUrl] = useState<string | null>(null)

  return (
    <>
      <Drawer
        open={member != null}
        onClose={onClose}
        width={360}
        title={null}
        styles={{ body: { padding: 0 } }}
      >
        {member ? (
          <div>
            {/* Header */}
            <div className="flex flex-col items-center gap-3 bg-brand-soft px-6 py-8">
              <Avatar
                src={profile?.avatarUrl ?? member.user.avatarUrl ?? undefined}
                size={72}
                className="!bg-[#b8dbe8] !text-[#005a87] !text-2xl !font-bold ring-4 ring-white shadow-md"
              >
                {member.user.name[0]?.toUpperCase()}
              </Avatar>
              <div className="text-center">
                <div className="text-lg font-semibold text-stone-900">{member.user.name}</div>
                <div className="text-sm text-stone-400">{member.user.email}</div>
              </div>
              <Tag>{roleLabel[member.role] ?? member.role}</Tag>
            </div>

            {/* Thông tin trong nhóm */}
            <div className="px-6 py-4">
              <Typography.Text className="mb-2 block text-xs font-semibold uppercase tracking-wider text-stone-400">
                Trong nhóm này
              </Typography.Text>
              <Descriptions column={1} size="small" labelStyle={{ color: '#78716c', width: 128 }}>
                <Descriptions.Item label="Tham gia">{fmtDate(member.joinedAt)}</Descriptions.Item>
                <Descriptions.Item label="Tổng trả hộ (chung)">
                  <CurrencyDisplay
                    amount={member.sharedPaidTotal ?? '0'}
                    className="tabular-nums font-medium text-stone-900"
                  />
                </Descriptions.Item>
                <Descriptions.Item label="Phần quỹ (duyệt)">
                  <CurrencyDisplay
                    amount={member.fundContributedApproved ?? '0'}
                    className="tabular-nums font-medium text-stone-900"
                  />
                </Descriptions.Item>
                <Descriptions.Item label="Phần chia (bill)">
                  <CurrencyDisplay
                    amount={member.sharedOwedTotal ?? '0'}
                    className="tabular-nums font-medium text-stone-900"
                  />
                </Descriptions.Item>
                <Descriptions.Item
                  label="Chênh (ước tính)"
                  contentStyle={{ flexDirection: 'column', alignItems: 'flex-start', gap: 4 }}
                >
                  <CurrencyDisplay
                    amount={member.netBalance ?? '0'}
                    className={
                      Number(member.netBalance ?? 0) > 0
                        ? 'font-semibold text-green-600'
                        : Number(member.netBalance ?? 0) < 0
                          ? 'font-semibold text-red-600'
                          : 'tabular-nums text-stone-500'
                    }
                  />
                  <Typography.Text type="secondary" className="!text-xs !leading-snug">
                    Đã trả + quỹ − phần chia
                  </Typography.Text>
                </Descriptions.Item>
                {member.nickname ? (
                  <Descriptions.Item label="Biệt danh">{member.nickname}</Descriptions.Item>
                ) : null}
              </Descriptions>
            </div>

            <Divider className="!my-0" />

            {/* Thông tin cá nhân */}
            <div className="px-6 py-4">
              <Typography.Text className="mb-3 block text-xs font-semibold uppercase tracking-wider text-stone-400">
                Thông tin cá nhân
              </Typography.Text>
              {isLoading ? (
                <Skeleton active paragraph={{ rows: 3 }} title={false} />
              ) : isError ? (
                <Typography.Text type="secondary" className="text-sm">
                  Không tải được thông tin cá nhân. Thử lại sau.
                </Typography.Text>
              ) : (
                <Descriptions column={1} size="small" labelStyle={{ color: '#78716c', width: 120 }}>
                  {profile?.phone ? (
                    <Descriptions.Item label="Điện thoại">{profile.phone}</Descriptions.Item>
                  ) : null}
                  {profile?.bio ? (
                    <Descriptions.Item label="Giới thiệu">
                      <span className="text-stone-600">{profile.bio}</span>
                    </Descriptions.Item>
                  ) : null}
                  {!profile?.phone && !profile?.bio ? (
                    <Descriptions.Item label="">
                      <span className="text-stone-300 text-sm">Chưa có thông tin</span>
                    </Descriptions.Item>
                  ) : null}
                </Descriptions>
              )}
            </div>

            {/* Tài khoản ngân hàng */}
            {isLoading || (profile?.bankAccounts?.length ?? 0) > 0 ? (
              <>
                <Divider className="!my-0" />
                <div className="px-6 py-4">
                  <Typography.Text className="mb-3 block text-xs font-semibold uppercase tracking-wider text-stone-400">
                    Tài khoản ngân hàng
                  </Typography.Text>
                  {isLoading ? (
                    <Skeleton active paragraph={{ rows: 2 }} title={false} />
                  ) : (
                    <div className="flex flex-col gap-2">
                      {profile?.bankAccounts.map((b) => (
                        <div
                          key={b.id}
                          className={`flex items-start gap-3 rounded-xl border bg-stone-50 px-4 py-3 ${
                            b.isDefault
                              ? 'border-brand/30 ring-1 ring-brand/15'
                              : 'border-stone-100'
                          }`}
                        >
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-soft">
                            <Icon icon="mdi:bank-outline" width={18} className="text-brand" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="text-sm font-semibold text-stone-800">
                                {b.bankName}
                              </span>
                              {b.isDefault ? (
                                <Tag color="processing" className="m-0! text-xs!">
                                  Mặc định
                                </Tag>
                              ) : null}
                            </div>
                            <div className="mt-0.5 flex items-center font-mono text-sm text-stone-700">
                              {b.accountNumber}
                              <CopyButton text={b.accountNumber} />
                            </div>
                            <div className="text-xs text-stone-400">{b.accountName}</div>
                            {b.qrImageUrl ? (
                              <Button
                                type={b.isDefault ? 'primary' : 'default'}
                                size="small"
                                className="mt-2"
                                icon={<Icon icon="mdi:qrcode" width={16} />}
                                onClick={() => {
                                  setQrModalUrl(b.qrImageUrl)
                                  setQrModalOpen(true)
                                }}
                              >
                                Xem mã QR
                              </Button>
                            ) : null}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            ) : null}
          </div>
        ) : null}
      </Drawer>
      <BankQrPreviewModal
        open={qrModalOpen}
        imageUrl={qrModalUrl}
        onClose={() => {
          setQrModalOpen(false)
          setQrModalUrl(null)
        }}
      />
    </>
  )
}
