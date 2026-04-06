import {
  SplitConfig,
  type SplitConfigValue,
  type SplitRowState,
  buildDefaultSplitRows,
  splitsFromConfig,
} from '@/components/expenses/SplitConfig'
import { FileUpload } from '@/components/shared/FileUpload'
import { MoneyInputNumber } from '@/components/shared/MoneyInputNumber'
import {
  syncCachesAfterExpenseUpdate,
  useCategories,
  useCreateExpense,
  useExpense,
  useUpdateExpense,
} from '@/hooks/useExpenses'
import { useGroupMembers } from '@/hooks/useGroup'
import type { CreateExpenseInput } from '@expense/types'
import { createExpenseSchema, expenseTagsField, normalizeExpenseTags } from '@expense/types'
import { zodResolver } from '@hookform/resolvers/zod'
import { Icon } from '@iconify/react'
import { useQueryClient } from '@tanstack/react-query'
import {
  App,
  Button,
  Checkbox,
  Col,
  DatePicker,
  Form,
  Input,
  Radio,
  Row,
  Select,
  Spin,
  Steps,
} from 'antd'
import dayjs from 'dayjs'
import { useSession } from 'next-auth/react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Controller, type FieldErrors, type Resolver, useForm } from 'react-hook-form'
import { z } from 'zod'

const memberRoleLabel: Record<string, string> = {
  LEADER: 'Trưởng nhóm',
  VICE_LEADER: 'Phó nhóm',
  MEMBER: 'Thành viên',
}

const formSchema = z.object({
  title: z.string().min(1, 'Nhập tiêu đề').max(200),
  amount: z.number().positive('Số tiền phải lớn hơn 0').max(999_999_999),
  paidByUserId: z.string().min(1, 'Chọn người trả tiền').cuid('Chọn người trả tiền'),
  categoryId: z.string().min(1, 'Chọn danh mục').cuid('Chọn danh mục'),
  splitType: z.enum(['EQUAL', 'UNEQUAL', 'PERCENTAGE']),
  expenseDate: z.any().refine((v) => dayjs.isDayjs(v), { message: 'Chọn ngày' }),
  tags: expenseTagsField,
  description: z.string().max(1000).optional(),
  imageUrls: z.array(z.string()).default([]),
  isStandalone: z.boolean().default(false),
  useGroupFund: z.boolean().default(false),
  recurringDays: z.number().int().min(1).max(365).optional(),
})

type FormValues = z.infer<typeof formSchema>

const defaultFormValues: FormValues = {
  title: '',
  amount: 0,
  paidByUserId: '',
  categoryId: '',
  splitType: 'EQUAL',
  expenseDate: dayjs(),
  tags: [],
  description: undefined,
  imageUrls: [],
  isStandalone: false,
  useGroupFund: false,
  recurringDays: undefined,
}

export type ExpenseWizardMode = 'create' | 'edit'

export function ExpenseWizardForm({
  mode,
  groupId,
  expenseId,
  onDone,
  onCancel,
}: {
  mode: ExpenseWizardMode
  groupId: string
  expenseId?: string
  onDone: () => void
  onCancel?: () => void
}) {
  const { message } = App.useApp()
  const qc = useQueryClient()
  const { data: session } = useSession()
  const [step, setStep] = useState(0)
  const { data: memberList, isLoading: loadingMembers } = useGroupMembers(groupId)
  const members = memberList?.members ?? []
  const selectableMembers = useMemo(() => members.filter((m) => m.isActive !== false), [members])
  const { data: categories = [], isLoading: loadingCategories } = useCategories()
  const create = useCreateExpense(groupId)
  const updateExpenseId = expenseId ?? '__none__'
  const update = useUpdateExpense(groupId, updateExpenseId)
  const { data: expense, isLoading: loadingExpense } = useExpense(groupId, expenseId ?? '')

  /** Ant Design Select trống nếu value không nằm trong options — khi mở lại drawer trước khi cache categories/members kịp, hoặc payer không còn trong nhóm. */
  const memberSelectOptions = useMemo(() => {
    const opts = selectableMembers.map((m) => ({
      value: m.userId,
      label: `${m.user.name} (${memberRoleLabel[m.role] ?? m.role})`,
    }))
    if (mode === 'edit' && expense?.paidBy && !opts.some((o) => o.value === expense.paidBy.id)) {
      opts.unshift({
        value: expense.paidBy.id,
        label: `${expense.paidBy.name} (không còn trong danh sách nhóm)`,
      })
    }
    return opts
  }, [mode, expense, selectableMembers])

  const categorySelectOptions = useMemo(() => {
    const opts = categories.map((c) => ({ value: c.id, label: c.name }))
    const ec = mode === 'edit' ? expense?.category : undefined
    if (ec && !opts.some((o) => o.value === ec.id)) {
      opts.unshift({ value: ec.id, label: ec.name })
    }
    return opts
  }, [mode, expense, categories])

  const [splitValue, setSplitValue] = useState<SplitConfigValue>({ splitType: 'EQUAL', rows: [] })
  /** Tránh reset trùng cùng một snapshot; cho phép seed lại khi cache expense đổi (sau PATCH / refetch). */
  const editSeedSigRef = useRef<string | null>(null)
  const [editFormReady, setEditFormReady] = useState(false)

  const { control, handleSubmit, trigger, watch, getValues, setValue, reset, formState } =
    useForm<FormValues>({
      resolver: zodResolver(formSchema) as Resolver<FormValues>,
      defaultValues: defaultFormValues,
      // Mặc định onSubmit + reValidate sau submit: lỗi từ trigger() (bước 1) không tự xoá khi gõ.
      mode: 'onChange',
      reValidateMode: 'onChange',
    })

  const amount = watch('amount')
  const splitTypeForm = watch('splitType')
  const totalAmount = Number.isFinite(amount) && amount > 0 ? amount : 0

  const resetWizard = useCallback(() => {
    reset(defaultFormValues)
    setStep(0)
    setSplitValue({ splitType: 'EQUAL', rows: [] })
    editSeedSigRef.current = null
    setEditFormReady(false)
  }, [reset])

  useEffect(() => {
    if (mode !== 'edit') return
    editSeedSigRef.current = null
    setEditFormReady(false)
    setStep(0)
    setSplitValue({ splitType: 'EQUAL', rows: [] })
  }, [mode, expenseId])

  useEffect(() => {
    if (mode !== 'edit' || !expenseId || !expense) return
    if (!expense.paidBy?.id) return
    if (!selectableMembers.length) return
    if (loadingCategories && categories.length === 0) return

    const splitsSig = [...expense.splits]
      .sort((a, b) => a.userId.localeCompare(b.userId))
      .map((s) => `${s.userId}:${Number(s.isExcluded)}:${s.amount}:${s.percentage ?? ''}`)
      .join(';')
    const tagsSig = [...(expense.tags ?? [])].sort().join(',')
    const sig = [
      expense.id,
      expense.paidBy.id,
      expense.category?.id ?? '',
      expense.amount,
      expense.splitType,
      expense.title,
      expense.expenseDate,
      expense.description ?? '',
      expense.isStandalone ? '1' : '0',
      splitsSig,
      tagsSig,
    ].join('|')

    if (editSeedSigRef.current === sig) return

    reset({
      title: expense.title,
      amount: Number(expense.amount),
      paidByUserId: expense.paidBy.id,
      categoryId: expense.category?.id ?? '',
      splitType: expense.splitType as FormValues['splitType'],
      expenseDate: dayjs(expense.expenseDate),
      description: expense.description ?? undefined,
      tags: expense.tags ?? [],
      imageUrls: expense.imageUrls ?? [],
      isStandalone: expense.isStandalone ?? false,
      useGroupFund: false,
      recurringDays: undefined,
    })

    const rows: SplitRowState[] = buildDefaultSplitRows(selectableMembers).map(
      (r): SplitRowState => {
        const existing = expense.splits.find((s) => s.userId === r.userId)
        if (!existing) return { userId: r.userId, isExcluded: true }
        return {
          userId: r.userId,
          isExcluded: Boolean(existing.isExcluded),
          amount: Number(existing.amount),
          ...(existing.percentage != null ? { percentage: Number(existing.percentage) } : {}),
        }
      },
    )
    setSplitValue({ splitType: expense.splitType as FormValues['splitType'], rows })
    editSeedSigRef.current = sig
    setEditFormReady(true)
  }, [mode, expenseId, expense, selectableMembers, reset, loadingCategories, categories.length])

  useEffect(() => {
    if (mode !== 'create') return
    resetWizard()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- chỉ khi đổi nhóm
  }, [groupId])

  useEffect(() => {
    if (mode !== 'create') return
    if (!selectableMembers.length) return
    const cur = getValues('paidByUserId')
    if (cur && selectableMembers.some((m) => m.userId === cur)) return
    const self = session?.user?.id
    if (self && selectableMembers.some((m) => m.userId === self)) {
      setValue('paidByUserId', self)
    } else {
      setValue('paidByUserId', selectableMembers[0]!.userId)
    }
  }, [mode, selectableMembers, session?.user?.id, setValue, getValues])

  /**
   * Chỉ dùng cho flow tạo mới. Ở edit, seed từ expense.splits phải là nguồn duy nhất:
   * nếu chạy cùng commit với seed, effect này vẫn thấy rows.length === 0 và ghi đè mặc định
   * (tất cả Không tham gia); seed đã set editSeedSigRef nên không chạy lại → phải F5 mới đúng.
   */
  useEffect(() => {
    if (mode !== 'create') return
    if (!selectableMembers.length || splitValue.rows.length > 0) return
    setSplitValue({ splitType: splitTypeForm, rows: buildDefaultSplitRows(selectableMembers) })
  }, [mode, selectableMembers, splitValue.rows.length, splitTypeForm])

  useEffect(() => {
    setSplitValue((prev) => ({ ...prev, splitType: splitTypeForm }))
  }, [splitTypeForm])

  const nextFromStep0 = async () => {
    const ok = await trigger([
      'title',
      'amount',
      'paidByUserId',
      'categoryId',
      'splitType',
      'expenseDate',
      'description',
      'tags',
    ])
    if (!ok) return
    const payer = getValues('paidByUserId')
    if (!payer || !memberSelectOptions.some((o) => o.value === payer)) {
      void message.error('Chọn người trả tiền hợp lệ')
      return
    }
    setStep(1)
  }

  const nextFromStep1 = () => {
    if (!splitValue.rows.some((r) => !r.isExcluded)) {
      void message.error('Bật ít nhất một người tham gia chia (cột Tham gia chia — chọn Có).')
      return
    }
    const t = getValues('amount')
    const total = Number.isFinite(t) && t > 0 ? t : 0
    if (splitValue.splitType === 'UNEQUAL') {
      const sum = splitValue.rows
        .filter((r) => !r.isExcluded)
        .reduce((s, r) => s + (r.amount ?? 0), 0)
      if (Math.abs(sum - total) > 0.01) {
        void message.error('Tổng phần chia phải bằng số tiền')
        return
      }
    }
    if (splitValue.splitType === 'PERCENTAGE') {
      const sum = splitValue.rows
        .filter((r) => !r.isExcluded)
        .reduce((s, r) => s + (r.percentage ?? 0), 0)
      if (Math.abs(sum - 100) > 0.01) {
        void message.error('Tổng phần trăm phải bằng 100%')
        return
      }
    }
    setStep(2)
  }

  const handleStepChange = async (next: number) => {
    if (next <= step) {
      setStep(next)
      return
    }
    if (step === 0 || next > 1) {
      const ok = await trigger([
        'title',
        'amount',
        'paidByUserId',
        'categoryId',
        'splitType',
        'expenseDate',
        'description',
        'tags',
      ])
      if (!ok) {
        void message.warning('Vui lòng điền đầy đủ thông tin bước 1 trước')
        return
      }
    }
    if (next === 2 && step < 2) {
      if (!splitValue.rows.some((r) => !r.isExcluded)) {
        void message.error('Bật ít nhất một người tham gia chia (cột Tham gia chia — chọn Có).')
        return
      }
      const t = getValues('amount')
      const total = Number.isFinite(t) && t > 0 ? t : 0
      if (splitValue.splitType === 'UNEQUAL') {
        const sum = splitValue.rows
          .filter((r) => !r.isExcluded)
          .reduce((s, r) => s + (r.amount ?? 0), 0)
        if (Math.abs(sum - total) > 0.01) {
          void message.error('Tổng phần chia phải bằng số tiền')
          return
        }
      }
      if (splitValue.splitType === 'PERCENTAGE') {
        const sum = splitValue.rows
          .filter((r) => !r.isExcluded)
          .reduce((s, r) => s + (r.percentage ?? 0), 0)
        if (Math.abs(sum - 100) > 0.01) {
          void message.error('Tổng phần trăm phải bằng 100%')
          return
        }
      }
    }
    setStep(next)
  }

  const submitExpense = async (vals: FormValues) => {
    const payer = vals.paidByUserId ?? session?.user?.id
    if (!payer || !memberSelectOptions.some((o) => o.value === payer)) {
      void message.error('Chọn người trả tiền hợp lệ')
      return
    }
    const total = Number.isFinite(vals.amount) && vals.amount > 0 ? vals.amount : 0
    if (!splitValue.rows.some((r) => !r.isExcluded)) {
      void message.error('Bật ít nhất một người tham gia chia trước khi lưu.')
      setStep(1)
      return
    }
    const st = vals.splitType
    if (st === 'UNEQUAL') {
      const sum = splitValue.rows
        .filter((r) => !r.isExcluded)
        .reduce((s, r) => s + (r.amount ?? 0), 0)
      if (Math.abs(sum - total) > 0.01) {
        void message.error('Tổng phần chia phải bằng số tiền')
        setStep(1)
        return
      }
    }
    if (st === 'PERCENTAGE') {
      const sum = splitValue.rows
        .filter((r) => !r.isExcluded)
        .reduce((s, r) => s + (r.percentage ?? 0), 0)
      if (Math.abs(sum - 100) > 0.01) {
        void message.error('Tổng phần trăm phải bằng 100%')
        setStep(1)
        return
      }
    }
    const splits = splitsFromConfig(total, { ...splitValue, splitType: st })
    const categoryTrimmed = vals.categoryId?.trim() ?? ''

    if (mode === 'create') {
      const payload: CreateExpenseInput = {
        title: vals.title,
        amount: vals.amount,
        paidByUserId: payer,
        categoryId: categoryTrimmed || undefined,
        splitType: vals.splitType,
        splits,
        expenseDate: (vals.expenseDate as dayjs.Dayjs).toDate().toISOString(),
        tags: vals.tags ?? [],
        imageUrls: vals.imageUrls ?? [],
        isStandalone: vals.isStandalone,
        useGroupFund: vals.useGroupFund,
        recurringDays: vals.recurringDays,
        description: vals.description,
      }
      const parsed = createExpenseSchema.safeParse(payload)
      if (!parsed.success) {
        void message.error(parsed.error.issues[0]?.message ?? 'Dữ liệu không hợp lệ')
        return
      }
      try {
        await create.mutateAsync(parsed.data)
        void message.success('Đã tạo chi tiêu')
        resetWizard()
        onDone()
      } catch (e) {
        void message.error(e instanceof Error ? e.message : 'Không tạo được')
      }
      return
    }

    if (!expenseId) return
    try {
      const updated = await update.mutateAsync({
        title: vals.title.trim(),
        amount: vals.amount,
        paidByUserId: payer,
        categoryId: categoryTrimmed ? categoryTrimmed : null,
        splitType: vals.splitType,
        splits,
        expenseDate: (vals.expenseDate as dayjs.Dayjs).toDate().toISOString(),
        tags: normalizeExpenseTags(vals.tags ?? []),
        imageUrls: vals.imageUrls ?? [],
        description: vals.description?.trim() || undefined,
        isStandalone: vals.isStandalone,
      })
      await syncCachesAfterExpenseUpdate(qc, groupId, expenseId, updated)
      void message.success('Đã cập nhật chi tiêu')
      onDone()
    } catch (e) {
      void message.error(e instanceof Error ? e.message : 'Lỗi')
    }
  }

  const onSubmit = handleSubmit(submitExpense, (errors: FieldErrors<FormValues>) => {
    const first = Object.values(errors)[0]
    const msg =
      typeof first?.message === 'string'
        ? first.message
        : 'Thông tin chưa hợp lệ — đã chuyển về bước 1, vui lòng sửa các ô báo lỗi.'
    void message.error(msg)
    setStep(0)
    void trigger()
  })

  const handleCancel = () => {
    resetWizard()
    onCancel?.()
  }

  const saving = mode === 'create' ? create.isPending : update.isPending

  if (mode === 'edit' && (!expenseId || loadingExpense || !expense || !editFormReady)) {
    return (
      <div className="flex justify-center py-12">
        <Spin />
      </div>
    )
  }

  return (
    <div className="max-w-3xl">
      {/* Margin trên wrapper: class trực tiếp Steps hay bị antd ghi đè margin-bottom */}
      <div className="mb-16">
        <Steps
          current={step}
          onChange={(n) => void handleStepChange(n)}
          items={[{ title: 'Thông tin' }, { title: 'Cách chia' }, { title: 'Lưu' }]}
          size="small"
        />
      </div>

      {step === 0 ? (
        <Form layout="vertical" requiredMark>
          <Form.Item
            label="Tiêu đề"
            required
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
            label="Số tiền (VND)"
            required
            validateStatus={formState.errors.amount ? 'error' : ''}
            help={formState.errors.amount?.message}
          >
            <Controller
              name="amount"
              control={control}
              render={({ field }) => (
                <MoneyInputNumber
                  style={{ width: '100%' }}
                  min={1}
                  value={field.value}
                  onChange={(v) => field.onChange(typeof v === 'number' ? v : 0)}
                  formatter={(v) => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, '.')}
                  parser={(v) => Number(`${v}`.replace(/\./g, '')) || 0}
                />
              )}
            />
          </Form.Item>
          <Form.Item
            label="Người trả tiền"
            required
            validateStatus={formState.errors.paidByUserId ? 'error' : ''}
            help={formState.errors.paidByUserId?.message}
            extra={
              !formState.errors.paidByUserId
                ? 'Có thể đổi nếu chi riêng chưa có chứng từ / thanh toán được duyệt.'
                : undefined
            }
          >
            <Controller
              name="paidByUserId"
              control={control}
              render={({ field }) => (
                <Select
                  placeholder={loadingMembers ? 'Đang tải thành viên…' : 'Chọn thành viên'}
                  loading={loadingMembers}
                  options={memberSelectOptions}
                  value={field.value || undefined}
                  onChange={field.onChange}
                  showSearch
                  optionFilterProp="label"
                />
              )}
            />
          </Form.Item>
          <Row gutter={[16, 16]}>
            <Col xs={24} sm={12}>
              <Form.Item
                label="Danh mục"
                required
                validateStatus={formState.errors.categoryId ? 'error' : ''}
                help={formState.errors.categoryId?.message}
              >
                <Controller
                  name="categoryId"
                  control={control}
                  render={({ field }) => (
                    <Select
                      allowClear
                      showSearch
                      optionFilterProp="label"
                      placeholder={loadingCategories ? 'Đang tải danh mục…' : 'Chọn danh mục'}
                      loading={loadingCategories && categories.length === 0}
                      options={categorySelectOptions}
                      optionRender={(opt) => {
                        const cat =
                          categories.find((c) => c.id === opt.value) ??
                          (mode === 'edit' && expense?.category?.id === opt.value
                            ? expense?.category
                            : undefined)
                        if (!cat) return opt.label
                        return (
                          <span className="flex items-center gap-2">
                            {cat.icon ? (
                              cat.icon.includes(':') ? (
                                <Icon icon={cat.icon} width={16} />
                              ) : (
                                <span>{cat.icon}</span>
                              )
                            ) : null}
                            {cat.name}
                          </span>
                        )
                      }}
                      value={field.value || undefined}
                      onChange={(v) => field.onChange(v ?? '')}
                    />
                  )}
                />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item label="Thẻ">
                <Controller
                  name="tags"
                  control={control}
                  render={({ field }) => (
                    <Select
                      mode="tags"
                      placeholder="Thêm thẻ"
                      value={field.value}
                      onChange={(v) => field.onChange(normalizeExpenseTags(v))}
                    />
                  )}
                />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item
            label="Cách chia"
            required
            validateStatus={formState.errors.splitType ? 'error' : ''}
            help={formState.errors.splitType?.message}
          >
            <Controller
              name="splitType"
              control={control}
              render={({ field }) => (
                <Radio.Group {...field} block buttonStyle="solid">
                  <Radio.Button value="EQUAL">Chia đều</Radio.Button>
                  <Radio.Button value="UNEQUAL">Không đều</Radio.Button>
                  <Radio.Button value="PERCENTAGE">Theo %</Radio.Button>
                </Radio.Group>
              )}
            />
          </Form.Item>
          <Form.Item
            label="Ngày chi"
            required
            validateStatus={formState.errors.expenseDate ? 'error' : ''}
            help={formState.errors.expenseDate?.message}
          >
            <Controller
              name="expenseDate"
              control={control}
              render={({ field }) => (
                <DatePicker
                  className="w-full"
                  format="DD/MM/YYYY"
                  value={field.value}
                  onChange={field.onChange}
                />
              )}
            />
          </Form.Item>
          <Form.Item label="Mô tả">
            <Controller
              name="description"
              control={control}
              render={({ field }) => <Input.TextArea {...field} rows={2} />}
            />
          </Form.Item>
          <Form.Item>
            <Controller
              name="isStandalone"
              control={control}
              render={({ field }) => (
                <Checkbox checked={field.value} onChange={(e) => field.onChange(e.target.checked)}>
                  Chi riêng lẻ{' '}
                  <span className="text-xs text-stone-400">
                    (không tính vào chi tiêu chung khi tổng kết nhóm)
                  </span>
                </Checkbox>
              )}
            />
          </Form.Item>
          {onCancel ? (
            <div className="mt-1 flex flex-wrap justify-end gap-2 border-t border-stone-100 pt-5">
              <Button onClick={handleCancel}>Huỷ</Button>
              <Button type="primary" onClick={() => void nextFromStep0()}>
                Tiếp theo
              </Button>
            </div>
          ) : (
            <Button type="primary" onClick={() => void nextFromStep0()}>
              Tiếp theo
            </Button>
          )}
        </Form>
      ) : null}

      {step === 1 ? (
        <>
          <SplitConfig
            members={selectableMembers}
            totalAmount={totalAmount}
            value={splitValue}
            onChange={setSplitValue}
          />
          <div className="mt-6 flex flex-wrap justify-end gap-2 border-t border-stone-100 pt-5">
            <Button onClick={() => setStep(0)}>Quay lại</Button>
            <Button type="primary" onClick={nextFromStep1}>
              Tiếp theo
            </Button>
          </div>
        </>
      ) : null}

      {step === 2 ? (
        <Form layout="vertical" onFinish={() => void onSubmit()}>
          <Form.Item label="Ảnh hoá đơn">
            <Controller
              name="imageUrls"
              control={control}
              render={({ field }) => (
                <FileUpload
                  value={field.value}
                  onChange={field.onChange}
                  groupId={groupId}
                  uploadType="expense"
                />
              )}
            />
          </Form.Item>
          {mode === 'create' ? (
            <Form.Item label="Lặp lại mỗi (ngày) — tuỳ chọn">
              <Controller
                name="recurringDays"
                control={control}
                render={({ field }) => (
                  <MoneyInputNumber
                    min={1}
                    max={365}
                    style={{ width: '100%' }}
                    placeholder="Không lặp"
                    value={field.value ?? null}
                    onChange={(v) => field.onChange(typeof v === 'number' ? v : undefined)}
                  />
                )}
              />
            </Form.Item>
          ) : null}
          <div className="mt-2 flex flex-wrap justify-end gap-2 border-t border-stone-100 pt-5">
            <Button onClick={() => setStep(1)}>Quay lại</Button>
            <Button type="primary" htmlType="submit" loading={saving}>
              {mode === 'create' ? 'Lưu chi tiêu' : 'Lưu thay đổi'}
            </Button>
          </div>
        </Form>
      ) : null}
    </div>
  )
}
