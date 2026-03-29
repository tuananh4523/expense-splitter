import AppLayout from '@/components/layout/AppLayout'
import { PaymentMatrix } from '@/components/settlement/PaymentMatrix'
import { SettlementSummary } from '@/components/settlement/SettlementSummary'
import { CurrencyDisplay } from '@/components/shared/CurrencyDisplay'
import { useGroup, useGroupMembers } from '@/hooks/useGroup'
import { useCreateSettlement, useSettlementPreview } from '@/hooks/useSettlement'
import { formatVND } from '@/utils/currency'
import { fmtDate } from '@/utils/date'
import { withAuth } from '@/utils/withAuth'
import type { CreateSettlementInput, SettlementPreviewExpenseItem } from '@expense/types'
import { createSettlementSchema } from '@expense/types'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  Alert,
  App,
  Button,
  Card,
  Collapse,
  DatePicker,
  Form,
  Input,
  Popconfirm,
  Select,
  Steps,
  Table,
  Typography,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import { useRouter } from 'next/router'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { z } from 'zod'

export const getServerSideProps = withAuth()

const step1Schema = z.object({
  title: z.string().min(1).max(200),
  range: z.any().superRefine((val, ctx) => {
    if (
      !Array.isArray(val) ||
      val.length !== 2 ||
      !dayjs.isDayjs(val[0]) ||
      !dayjs.isDayjs(val[1])
    ) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Chọn kỳ' })
    }
  }),
})

type Step1 = z.infer<typeof step1Schema>

/** Bảng xem trước: tiêu đề rộng nhất; ngày gọn; số tiền cột cuối căn phải (VND hay dài). */
const PREVIEW_EXPENSE_TABLE_SCROLL_X = 720

const previewExpenseColumns: ColumnsType<SettlementPreviewExpenseItem> = [
  {
    title: 'Tiêu đề',
    dataIndex: 'title',
    key: 'title',
    ellipsis: true,
    width: 300,
    minWidth: 180,
  },
  {
    title: 'Ngày',
    dataIndex: 'expenseDate',
    key: 'expenseDate',
    width: 108,
    render: (d: string) => <span className="whitespace-nowrap tabular-nums">{fmtDate(d)}</span>,
  },
  {
    title: 'Trả bởi',
    key: 'paidBy',
    width: 160,
    ellipsis: true,
    render: (_, r) => r.paidBy.name,
  },
  {
    title: 'Số tiền',
    dataIndex: 'amount',
    key: 'amount',
    align: 'right',
    width: 140,
    render: (v: string) => <CurrencyDisplay amount={v} className="whitespace-nowrap tabular-nums font-medium" />,
  },
]

export default function NewSettlementPage() {
  const { message } = App.useApp()
  const router = useRouter()
  const groupId = typeof router.query.groupId === 'string' ? router.query.groupId : ''
  const [step, setStep] = useState(0)
  const { data: group } = useGroup(groupId)
  const { data: memberList } = useGroupMembers(groupId)
  const members = memberList?.members ?? []
  const create = useCreateSettlement(groupId)

  const { control, handleSubmit, watch, formState } = useForm<Step1>({
    resolver: zodResolver(step1Schema),
    defaultValues: {
      title: `Tổng kết tháng ${dayjs().month() + 1}/${dayjs().year()}`,
      range: [dayjs().startOf('month'), dayjs().endOf('month')],
    },
  })

  const titleWatch = watch('title')
  const rangeWatch = watch('range')

  const previewParams = useMemo(() => {
    if (!rangeWatch?.[0] || !rangeWatch?.[1]) return null
    return {
      periodStart: rangeWatch[0].startOf('day').toISOString(),
      periodEnd: rangeWatch[1].endOf('day').toISOString(),
    }
  }, [rangeWatch])

  const {
    data: preview,
    isFetching: previewLoading,
    refetch,
  } = useSettlementPreview(groupId, previewParams)

  const [receiverId, setReceiverId] = useState<string>('')

  const chartData = useMemo(() => {
    if (!preview?.balances.length) return []
    return preview.balances.map((b) => ({
      name: b.userName,
      paid: Number.parseFloat(b.totalPaid) || 0,
      fund: Number.parseFloat(b.fundNetInPeriod ?? '0') || 0,
      owed: Number.parseFloat(b.totalOwed) || 0,
    }))
  }, [preview])

  const resolvePreviewUserName = useCallback(
    (id: string) => {
      const m = members.find((x) => x.userId === id)
      if (m) return m.user.name
      const b = preview?.balances.find((x) => x.userId === id)
      if (b) return b.userName
      return id
    },
    [members, preview?.balances],
  )

  const receiverOptions = useMemo(() => {
    const ids = preview?.receiverCandidateUserIds ?? []
    if (ids.length === 0) return []
    return ids.map((id) => {
      const m = members.find((x) => x.userId === id)
      const b = preview?.balances.find((x) => x.userId === id)
      return { value: id, label: m?.user.name ?? b?.userName ?? id }
    })
  }, [members, preview?.balances, preview?.receiverCandidateUserIds])

  useEffect(() => {
    if (!preview?.receiverCandidateUserIds?.length) return
    const ids = preview.receiverCandidateUserIds
    const sug = preview.suggestedReceiver.id
    setReceiverId((prev) => {
      if (prev && ids.includes(prev)) return prev
      if (sug && ids.includes(sug)) return sug
      return ids[0] ?? ''
    })
  }, [preview])

  const onPreview = handleSubmit(async () => {
    const r = await refetch()
    if (r.error) {
      message.error(r.error instanceof Error ? r.error.message : 'Không tải được xem trước')
      return
    }
    setStep(1)
  })

  const submitFinal = async () => {
    if (!previewParams || !preview) {
      message.error('Chưa có dữ liệu xem trước')
      return
    }
    const rid = receiverId || preview.suggestedReceiver.id
    const payload: CreateSettlementInput = {
      title: titleWatch,
      periodStart: previewParams.periodStart,
      periodEnd: previewParams.periodEnd,
      receiverUserId: rid,
    }
    const parsed = createSettlementSchema.safeParse(payload)
    if (!parsed.success) {
      message.error(parsed.error.issues[0]?.message ?? 'Dữ liệu không hợp lệ')
      return
    }
    try {
      await create.mutateAsync(parsed.data)
      message.success('Đã tạo tổng kết')
    } catch (e) {
      message.error(e instanceof Error ? e.message : 'Không tạo được')
    }
  }

  if (!groupId) return null

  if (group && group.myRole !== 'LEADER') {
    return (
      <AppLayout title="Tổng kết">
        <Alert type="error" message="Chỉ trưởng nhóm mới tạo tổng kết." showIcon />
      </AppLayout>
    )
  }

  const suggested = preview?.suggestedReceiver

  return (
    <AppLayout title="Tạo tổng kết">
      <Typography.Title level={4} className="!mb-8">
        Tạo tổng kết
      </Typography.Title>
      <Steps
        current={step}
        items={[{ title: 'Chọn kỳ' }, { title: 'Xem trước' }, { title: 'Xác nhận' }]}
        className="mb-8"
      />

      {step === 0 ? (
        <Card>
          <div className="wizard-card-body">
            <Alert
              type="info"
              showIcon
              className="mb-4"
              message="Cân bằng kỳ"
              description="Đã trả (bill) + quỹ trong kỳ − phải trả (bill). Đóng đợt xong thì xoá sổ quỹ, số dư quỹ về 0."
            />
            <Form layout="vertical" className="[&_.ant-form-item:last-child]:!mb-0">
              <Form.Item
                label="Tiêu đề"
                validateStatus={formState.errors.title ? 'error' : ''}
                help={formState.errors.title?.message}
              >
                <Controller
                  name="title"
                  control={control}
                  render={({ field }) => <Input {...field} />}
                />
              </Form.Item>
              <Form.Item
                label="Kỳ"
                validateStatus={formState.errors.range ? 'error' : ''}
                help={
                  formState.errors.range?.message ? String(formState.errors.range.message) : undefined
                }
              >
                <Controller
                  name="range"
                  control={control}
                  render={({ field }) => (
                    <DatePicker.RangePicker
                      className="w-full"
                      format="DD/MM/YYYY"
                      value={field.value}
                      onChange={field.onChange}
                    />
                  )}
                />
              </Form.Item>
            </Form>
          </div>
          <div className="wizard-card-actions">
            <Button type="primary" onClick={() => void onPreview()} loading={previewLoading}>
              Xem trước
            </Button>
          </div>
        </Card>
      ) : null}

      {step === 1 && preview ? (
        <Card>
          <div className="wizard-card-body">
            <Typography.Title level={5} className="!mb-0">
              Số dư theo thành viên
            </Typography.Title>
            <Typography.Paragraph type="secondary" className="!mb-3 text-sm">
              <strong>Đã trả + quỹ trong kỳ − phải trả</strong> → luồng chuyển tiền.
            </Typography.Paragraph>
            <SettlementSummary balances={preview.balances} />
            <Typography.Title level={5} className="!mb-0">
              Chi tiêu chung trong kỳ này
            </Typography.Title>
            <Typography.Paragraph type="secondary" className="!mb-0 text-sm">
              Chi chung trong kỳ, chưa gán đợt nào. Khoản thêm sau khi tạo đợt không tự vào đợt cũ.
            </Typography.Paragraph>
            {preview.expenses.length === 0 &&
            preview.balances.some((b) => Number.parseFloat(b.fundNetInPeriod ?? '0') !== 0) ? (
              <Alert
                type="info"
                showIcon
                message="Không có bill chung trong kỳ; vẫn có giao dịch quỹ trong kỳ — cân bằng chỉ theo quỹ."
              />
            ) : null}
            {preview.expenses.length === 0 &&
            !preview.balances.some((b) => Number.parseFloat(b.fundNetInPeriod ?? '0') !== 0) ? (
              <Alert
                type="warning"
                showIcon
                message="Không có chi tiêu chung và không có quỹ trong kỳ đã chọn."
              />
            ) : null}
            {preview.expenses.length > 0 ? (
              <Table<SettlementPreviewExpenseItem>
                size="small"
                rowKey="id"
                columns={previewExpenseColumns}
                dataSource={preview.expenses}
                pagination={{ pageSize: 8, showSizeChanger: false, hideOnSinglePage: true }}
                scroll={{ x: PREVIEW_EXPENSE_TABLE_SCROLL_X }}
              />
            ) : null}
            <Typography.Title level={5} className="!mb-0">
              Ai trả ai
            </Typography.Title>
            <PaymentMatrix
              transfers={preview.transactions}
              members={members}
              resolveName={resolvePreviewUserName}
            />
            {suggested ? (
              <Alert
                type="info"
                showIcon
                message={`Mặc định: ${suggested.name} nhận quỹ (bill + quỹ kỳ cao nhất trong kỳ)`}
              />
            ) : null}
            <Form.Item label="Người nhận quỹ" className="!mb-0 max-w-md">
              <Select<string>
                showSearch
                optionFilterProp="label"
                value={receiverId || suggested?.id || null}
                onChange={(v) => setReceiverId(v)}
                options={receiverOptions}
              />
            </Form.Item>
            <div className="h-72 min-h-[12rem]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis width={88} tick={{ fontSize: 10 }} tickFormatter={(v) => formatVND(v)} />
                  <Tooltip formatter={(v) => formatVND(Number(v))} />
                  <Legend />
                  <Bar dataKey="paid" name="Đã trả (bill)" fill="#0073aa" />
                  <Bar dataKey="fund" name="Quỹ (kỳ)" fill="#00a32a" />
                  <Bar dataKey="owed" name="Phải trả (bill)" fill="#d54e21" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="wizard-card-actions">
            <Button onClick={() => setStep(0)}>Quay lại</Button>
            <Button type="primary" onClick={() => setStep(2)}>
              Tiếp theo
            </Button>
          </div>
        </Card>
      ) : null}

      {step === 2 && preview && previewParams ? (
        <Card>
          <div className="wizard-card-body">
            <Typography.Paragraph className="!mb-0">
              Bạn sắp tạo tổng kết <strong>{titleWatch}</strong> với{' '}
              <strong>
                tổng chi trong kỳ <CurrencyDisplay amount={preview.periodExpensesTotal} />
              </strong>{' '}
              ({preview.expenseCount} khoản chi chung). Luồng quyết toán tối giản (tổng các khoản phải chuyển):{' '}
              <CurrencyDisplay amount={preview.totalAmount} />.
            </Typography.Paragraph>
            <Collapse
              items={[
                {
                  key: 'expenses',
                  label: `Danh sách chi trong kỳ (${preview.expenseCount} khoản)`,
                  children:
                    preview.expenses.length === 0 ? (
                      <Typography.Text type="secondary">Không có khoản chi chung nào trong kỳ.</Typography.Text>
                    ) : (
                      <Table<SettlementPreviewExpenseItem>
                        size="small"
                        rowKey="id"
                        columns={previewExpenseColumns}
                        dataSource={preview.expenses}
                        pagination={{ pageSize: 8, showSizeChanger: false, hideOnSinglePage: true }}
                        scroll={{ x: PREVIEW_EXPENSE_TABLE_SCROLL_X }}
                      />
                    ),
                },
              ]}
            />
          </div>
          <div className="wizard-card-actions">
            <Popconfirm
              title="Tạo tổng kết và thông báo mọi người?"
              onConfirm={() => void submitFinal()}
            >
              <Button type="primary" loading={create.isPending}>
                Tạo tổng kết và thông báo mọi người
              </Button>
            </Popconfirm>
            <Button onClick={() => setStep(1)}>Quay lại</Button>
          </div>
        </Card>
      ) : null}
    </AppLayout>
  )
}
