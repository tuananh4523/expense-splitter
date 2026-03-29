import { MoneyInputNumber, moneyDigitsKeyDown, moneyDigitsPaste } from '@/components/shared/MoneyInputNumber'
import { formatVND } from '@/utils/currency'
import type { MemberDto } from '@expense/types'
import { Alert, InputNumber, Switch, Table, Tag, Typography } from 'antd'
import { useMemo } from 'react'

const roleLabel: Record<string, string> = {
  LEADER: 'Trưởng nhóm',
  VICE_LEADER: 'Phó nhóm',
  MEMBER: 'Thành viên',
}

export type SplitTypeUi = 'EQUAL' | 'UNEQUAL' | 'PERCENTAGE'

export interface SplitRowState {
  userId: string
  amount?: number
  percentage?: number
  isExcluded: boolean
}

export interface SplitConfigValue {
  splitType: SplitTypeUi
  rows: SplitRowState[]
}

export function buildDefaultSplitRows(members: MemberDto[]): SplitRowState[] {
  return members
    .filter((m) => m.isActive !== false)
    .map((m) => ({
      userId: m.userId,
      isExcluded: true,
    }))
}

export function SplitConfig({
  members,
  totalAmount,
  value,
  onChange,
}: {
  members: MemberDto[]
  totalAmount: number
  value: SplitConfigValue
  onChange: (next: SplitConfigValue) => void
}) {
  const activeCount = value.rows.filter((r) => !r.isExcluded).length
  const equalShare = activeCount > 0 && totalAmount > 0 ? totalAmount / activeCount : 0

  const sumAmount = useMemo(
    () => value.rows.filter((r) => !r.isExcluded).reduce((s, r) => s + (r.amount ?? 0), 0),
    [value.rows],
  )
  const sumPct = useMemo(
    () => value.rows.filter((r) => !r.isExcluded).reduce((s, r) => s + (r.percentage ?? 0), 0),
    [value.rows],
  )

  const memberMap = useMemo(() => new Map(members.map((m) => [m.userId, m])), [members])

  const updateRow = (userId: string, patch: Partial<SplitRowState>) => {
    onChange({
      ...value,
      rows: value.rows.map((r) => (r.userId === userId ? { ...r, ...patch } : r)),
    })
  }

  const setAmount = (userId: string, v: number | null) => {
    onChange({
      ...value,
      rows: value.rows.map((r) => {
        if (r.userId !== userId) return r
        if (v === null) {
          const { amount: _a, ...rest } = r
          return rest
        }
        return { ...r, amount: v }
      }),
    })
  }

  const setPct = (userId: string, v: number | null) => {
    onChange({
      ...value,
      rows: value.rows.map((r) => {
        if (r.userId !== userId) return r
        if (v === null) {
          const { percentage: _p, ...rest } = r
          return rest
        }
        return { ...r, percentage: v }
      }),
    })
  }

  const amountOk = value.splitType !== 'UNEQUAL' || Math.abs(sumAmount - totalAmount) < 0.01
  const pctOk = value.splitType !== 'PERCENTAGE' || Math.abs(sumPct - 100) < 0.01

  return (
    <div className="flex flex-col gap-6">
      {value.splitType === 'EQUAL' ? (
        <Alert
          type={activeCount === 0 ? 'warning' : 'info'}
          showIcon
          message={
            activeCount === 0
              ? 'Chưa ai tham gia — bật "Có" ở cột Tham gia chia cho ít nhất một thành viên để xem số tiền chia đều.'
              : `Mỗi người đang bật tham gia: ${formatVND(equalShare)}`
          }
        />
      ) : null}
      {value.splitType === 'UNEQUAL' && !amountOk ? (
        <Alert
          type="error"
          showIcon
          message={`Tổng phần chia (${formatVND(sumAmount)}) phải bằng ${formatVND(totalAmount)}`}
        />
      ) : null}
      {value.splitType === 'PERCENTAGE' && !pctOk ? (
        <Alert
          type="warning"
          showIcon
          message={`Tổng % hiện tại: ${sumPct.toFixed(2)}% (cần 100%)`}
        />
      ) : null}

      <Table
        size="small"
        pagination={false}
        rowKey="userId"
        dataSource={value.rows}
        columns={[
          {
            title: 'Thành viên',
            render: (_, r) => {
              const m = memberMap.get(r.userId)
              if (!m) return r.userId
              const rl = roleLabel[m.role] ?? m.role
              return (
                <span className="inline-flex flex-wrap items-center gap-1.5">
                  <span>{m.user.name}</span>
                  <Tag className="m-0" color={m.role === 'LEADER' ? 'blue' : m.role === 'VICE_LEADER' ? 'cyan' : 'default'}>
                    {rl}
                  </Tag>
                </span>
              )
            },
          },
          value.splitType === 'EQUAL'
            ? {
                title: 'Phần chia',
                render: (_, r) =>
                  r.isExcluded ? (
                    <Typography.Text type="secondary">—</Typography.Text>
                  ) : (
                    formatVND(equalShare)
                  ),
              }
            : value.splitType === 'UNEQUAL'
              ? {
                  title: 'Số tiền',
                  render: (_, r) => (
                    <MoneyInputNumber
                      min={0}
                      disabled={r.isExcluded}
                      value={r.amount ?? null}
                      onChange={(v) => setAmount(r.userId, typeof v === 'number' ? v : null)}
                      formatter={(v) => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                      parser={(v) => Number(v?.replace(/,/g, '') ?? 0)}
                    />
                  ),
                }
              : {
                  title: '%',
                  render: (_, r) => (
                    <InputNumber
                      min={0}
                      max={100}
                      disabled={r.isExcluded}
                      value={r.percentage ?? null}
                      onChange={(v) => setPct(r.userId, typeof v === 'number' ? v : null)}
                      onKeyDown={moneyDigitsKeyDown()}
                      onPaste={moneyDigitsPaste()}
                    />
                  ),
                },
          {
            title: 'Tham gia chia',
            width: 120,
            render: (_, r) => (
              <Switch
                checked={!r.isExcluded}
                onChange={(included) => updateRow(r.userId, { isExcluded: !included })}
                checkedChildren="Có"
                unCheckedChildren="Không"
                aria-label={r.isExcluded ? 'Không tham gia chia' : 'Tham gia chia'}
              />
            ),
          },
        ]}
      />
    </div>
  )
}

export function splitsFromConfig(
  totalAmount: number,
  v: SplitConfigValue,
): { userId: string; amount?: number; percentage?: number; isExcluded: boolean }[] {
  const active = v.rows.filter((r) => !r.isExcluded)
  const n = active.length || 1
  if (v.splitType === 'EQUAL') {
    const each = totalAmount / n
    return v.rows.map((r) => ({
      userId: r.userId,
      isExcluded: r.isExcluded,
      amount: r.isExcluded ? 0 : each,
    }))
  }
  if (v.splitType === 'UNEQUAL') {
    return v.rows.map((r) => ({
      userId: r.userId,
      isExcluded: r.isExcluded,
      amount: r.isExcluded ? 0 : (r.amount ?? 0),
    }))
  }
  return v.rows.map((r) => ({
    userId: r.userId,
    isExcluded: r.isExcluded,
    percentage: r.isExcluded ? 0 : (r.percentage ?? 0),
  }))
}
