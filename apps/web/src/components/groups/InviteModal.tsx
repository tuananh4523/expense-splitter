import { useInviteMember } from '@/hooks/useGroup'
import { api } from '@/lib/api'
import { CloseOutlined } from '@ant-design/icons'
import type { GroupInviteSearchUserDto } from '@expense/types'
import { App, AutoComplete, Avatar, Button, Input, Modal, Spin, Typography } from 'antd'
import type { DefaultOptionType } from 'antd/es/select'
import { useCallback, useEffect, useRef, useState } from 'react'

type OptionWithUser = DefaultOptionType & { user: GroupInviteSearchUserDto }

export function InviteModal({
  open,
  onClose,
  groupId,
}: {
  open: boolean
  onClose: () => void
  groupId: string
}) {
  const { message } = App.useApp()
  const invite = useInviteMember(groupId)
  const [inputValue, setInputValue] = useState('')
  const [picked, setPicked] = useState<GroupInviteSearchUserDto[]>([])
  const [options, setOptions] = useState<OptionWithUser[]>([])
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [searching, setSearching] = useState(false)
  const [bulkSubmitting, setBulkSubmitting] = useState(false)
  const lastResultsRef = useRef<GroupInviteSearchUserDto[]>([])

  useEffect(() => {
    if (!open) {
      setInputValue('')
      setPicked([])
      setOptions([])
      setDropdownOpen(false)
      lastResultsRef.current = []
    }
  }, [open])

  const runSearch = useCallback(
    async (raw: string): Promise<GroupInviteSearchUserDto[]> => {
      const q = raw.trim()
      if (q.length < 2) return []
      setSearching(true)
      try {
        const data = await api
          .get<{ data: GroupInviteSearchUserDto[] }>(`/groups/${groupId}/members/invite-search`, {
            params: { q },
          })
          .then((r) => r.data.data)
        return data
      } catch (e) {
        message.error(e instanceof Error ? e.message : 'Lỗi tìm kiếm')
        return []
      } finally {
        setSearching(false)
      }
    },
    [groupId, message],
  )

  const toOptions = (data: GroupInviteSearchUserDto[]): OptionWithUser[] =>
    data.map((u) => ({
      value: u.id,
      user: u,
      label: (
        <div className="flex items-center gap-2 py-0.5">
          <Avatar
            src={u.avatarUrl ?? undefined}
            size={36}
            className="shrink-0 !bg-brand-soft !text-brand-text"
          >
            {u.name[0]?.toUpperCase()}
          </Avatar>
          <div className="min-w-0 flex-1">
            <div className="truncate font-medium text-stone-900">{u.name}</div>
            <div className="truncate text-xs text-stone-500">{u.email}</div>
          </div>
        </div>
      ),
    }))

  const addUser = useCallback(
    (u: GroupInviteSearchUserDto) => {
      setPicked((prev) => {
        if (prev.some((p) => p.id === u.id)) {
          message.warning('Đã chọn người này rồi')
          return prev
        }
        return [...prev, u]
      })
      setInputValue('')
      setOptions([])
      setDropdownOpen(false)
      lastResultsRef.current = []
    },
    [message],
  )

  const removeUser = (id: string) => {
    setPicked((prev) => prev.filter((p) => p.id !== id))
  }

  const handleEnterSearch = async () => {
    if (inputValue.trim().length < 2) {
      message.warning('Nhập ít nhất 2 ký tự rồi nhấn Enter để tìm')
      return
    }
    const data = await runSearch(inputValue)
    lastResultsRef.current = data
    if (data.length === 0) {
      setOptions([])
      setDropdownOpen(false)
      message.info('Không tìm thấy tài khoản phù hợp (hoặc đã ở trong nhóm / đang được mời)')
      return
    }
    if (data.length === 1) {
      const only = data[0]
      if (only) addUser(only)
      return
    }
    setOptions(toOptions(data))
    setDropdownOpen(true)
  }

  const onSelectOption = (_value: string, option: DefaultOptionType | OptionWithUser) => {
    const u = (option as OptionWithUser).user
    if (u) addUser(u)
  }

  const onInvite = async () => {
    if (picked.length === 0) return
    setBulkSubmitting(true)
    const failed: { email: string; msg: string }[] = []
    let ok = 0
    try {
      for (const u of picked) {
        try {
          await invite.mutateAsync({ email: u.email })
          ok++
        } catch (e) {
          failed.push({ email: u.email, msg: e instanceof Error ? e.message : 'Lỗi' })
        }
      }
    } finally {
      setBulkSubmitting(false)
    }

    if (ok > 0 && failed.length === 0) {
      message.success(ok === 1 ? 'Đã gửi lời mời' : `Đã gửi ${ok} lời mời`)
      onClose()
      return
    }
    if (ok > 0 && failed.length > 0) {
      message.warning(
        `Đã gửi ${ok} lời mời; ${failed.length} lỗi: ${failed.map((f) => `${f.email} (${f.msg})`).join('; ')}`,
      )
      onClose()
      return
    }
    message.error(failed.map((f) => `${f.email}: ${f.msg}`).join(' · ') || 'Không gửi được lời mời')
  }

  return (
    <Modal open={open} onCancel={onClose} title="Mời thành viên" footer={null} destroyOnClose>
      <Typography.Paragraph type="secondary" className="!mb-3 !text-sm">
        Gõ email hoặc tên, nhấn <strong>Enter</strong> để tìm trong hệ thống. Chọn người trong gợi ý
        hoặc nếu chỉ có một kết quả sẽ thêm vào danh sách bên dưới. Để tham gia bằng mã mời, dùng
        «Tham gia nhóm» hoặc link mời.
      </Typography.Paragraph>

      <AutoComplete
        className="block w-full"
        style={{ width: '100%' }}
        value={inputValue}
        options={options}
        open={dropdownOpen}
        onDropdownVisibleChange={(vis) => {
          if (!vis) setDropdownOpen(false)
        }}
        onSelect={onSelectOption}
        onChange={(v) => {
          setInputValue(typeof v === 'string' ? v : '')
        }}
        notFoundContent={searching ? <Spin size="small" /> : null}
        popupMatchSelectWidth
      >
        <Input
          placeholder="Ví dụ: nguyen@email.com hoặc Nguyễn Văn — nhấn Enter để tìm"
          disabled={searching}
          allowClear
          suffix={searching ? <Spin size="small" /> : null}
          onPressEnter={(e) => {
            e.preventDefault()
            void handleEnterSearch()
          }}
        />
      </AutoComplete>

      {picked.length > 0 ? (
        <div className="mt-4 space-y-2">
          <Typography.Text type="secondary" className="text-xs">
            Đã chọn ({picked.length})
          </Typography.Text>
          <ul className="max-h-56 space-y-2 overflow-y-auto rounded-lg border border-stone-200 bg-stone-50/80 p-2">
            {picked.map((u) => (
              <li
                key={u.id}
                className="flex items-center gap-3 rounded-md border border-stone-100 bg-white px-2 py-2 shadow-sm"
              >
                <Avatar
                  src={u.avatarUrl ?? undefined}
                  size={40}
                  className="shrink-0 !bg-brand-soft !text-brand-text"
                >
                  {u.name[0]?.toUpperCase()}
                </Avatar>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium text-stone-900">{u.name}</div>
                  <div className="truncate text-xs text-stone-500">{u.email}</div>
                </div>
                <Button
                  type="text"
                  danger
                  size="small"
                  icon={<CloseOutlined />}
                  aria-label="Bỏ chọn"
                  onClick={() => removeUser(u.id)}
                />
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <Button
        type="primary"
        className="mt-4"
        block
        disabled={picked.length === 0}
        loading={bulkSubmitting}
        onClick={() => void onInvite()}
      >
        Mời
      </Button>
    </Modal>
  )
}
