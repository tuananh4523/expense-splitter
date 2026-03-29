import type { LoginInput } from '@expense/types'
import { loginSchema } from '@expense/types'
import { zodResolver } from '@hookform/resolvers/zod'
import { App, Button, Form, Input } from 'antd'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/router'
import { Controller, useForm } from 'react-hook-form'

export function LoginForm() {
  const { message } = App.useApp()
  const router = useRouter()
  const { control, handleSubmit, formState } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  })

  const onSubmit = handleSubmit(async (data) => {
    const res = await signIn('credentials', {
      email: data.email,
      password: data.password,
      redirect: false,
      callbackUrl: '/dashboard',
    })
    if (res?.error) {
      message.error('Email hoặc mật khẩu không đúng')
      return
    }
    void router.push('/dashboard')
  })

  return (
    <Form layout="vertical" onFinish={() => void onSubmit()}>
      <Form.Item
        label="Email"
        validateStatus={formState.errors.email ? 'error' : ''}
        help={formState.errors.email?.message}
      >
        <Controller
          name="email"
          control={control}
          render={({ field }) => (
            <Input {...field} type="email" autoComplete="email" size="large" />
          )}
        />
      </Form.Item>
      <Form.Item
        label="Mật khẩu"
        validateStatus={formState.errors.password ? 'error' : ''}
        help={formState.errors.password?.message}
      >
        <Controller
          name="password"
          control={control}
          render={({ field }) => (
            <Input.Password {...field} autoComplete="current-password" size="large" />
          )}
        />
      </Form.Item>
      <Button type="primary" htmlType="submit" block size="large" loading={formState.isSubmitting}>
        Đăng nhập
      </Button>
    </Form>
  )
}
