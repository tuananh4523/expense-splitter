import { IconPicker, type IconPickerValue } from '@/components/shared/IconPicker'
import { useCreateGroup } from '@/hooks/useGroup'
import { createGroupSchema } from '@expense/types'
import { zodResolver } from '@hookform/resolvers/zod'
import { App, Button, Input, Typography } from 'antd'
import { useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { z } from 'zod'

export function GroupForm() {
  const { message } = App.useApp()
  const create = useCreateGroup()
  const [iconData, setIconData] = useState<IconPickerValue>({
    icon: 'mdi:account-group-outline',
    color: '#0073AA',
  })
  type GroupFormValues = z.input<typeof createGroupSchema>
  const { control, handleSubmit, formState } = useForm<GroupFormValues>({
    resolver: zodResolver(createGroupSchema),
    defaultValues: { name: '', description: '', requireApproval: false },
  })

  const onSubmit = handleSubmit(async (data) => {
    try {
      const parsed = createGroupSchema.parse(data)
      await create.mutateAsync({
        ...parsed,
        icon: iconData.icon,
        color: iconData.color,
      })
      message.success('Đã tạo nhóm')
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Không tạo được nhóm'
      message.error(
        /column|icon|color|migrate|does not exist/i.test(msg)
          ? 'Cơ sở dữ liệu chưa cập nhật. Chạy: pnpm --filter @expense/database exec prisma migrate deploy'
          : msg,
      )
    }
  })

  return (
    <form className="max-w-lg flex flex-col gap-5" onSubmit={onSubmit}>
      <div>
        <Typography.Text className="mb-2 block font-medium text-stone-700">
          Icon nhóm
        </Typography.Text>
        <div className="flex items-center gap-3">
          <IconPicker value={iconData} onChange={setIconData} size={56} />
          <Typography.Text type="secondary" className="text-sm">
            Nhấn để chọn icon và màu
          </Typography.Text>
        </div>
      </div>
      <div>
        <Typography.Text className="mb-2 block font-medium text-stone-700">
          Tên nhóm
        </Typography.Text>
        <Controller
          name="name"
          control={control}
          render={({ field }) => (
            <Input
              {...field}
              size="large"
              {...(formState.errors.name ? { status: 'error' as const } : {})}
            />
          )}
        />
        {formState.errors.name ? (
          <Typography.Text type="danger" className="mt-1 block text-sm">
            {formState.errors.name.message}
          </Typography.Text>
        ) : null}
      </div>
      <div>
        <Typography.Text className="mb-2 block font-medium text-stone-700">
          Mô tả (tuỳ chọn)
        </Typography.Text>
        <Controller
          name="description"
          control={control}
          render={({ field }) => (
            <Input.TextArea
              {...field}
              rows={3}
              {...(formState.errors.description ? { status: 'error' as const } : {})}
            />
          )}
        />
        {formState.errors.description ? (
          <Typography.Text type="danger" className="mt-1 block text-sm">
            {formState.errors.description.message}
          </Typography.Text>
        ) : null}
      </div>
      <Button type="primary" htmlType="submit" loading={create.isPending || formState.isSubmitting}>
        Tạo nhóm
      </Button>
    </form>
  )
}
