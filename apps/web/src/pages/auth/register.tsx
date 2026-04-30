import { AppVersionBadge } from '@/components/layout/AppVersionBadge'
import { APP_AUTHOR, APP_AUTHOR_GITHUB_URL, APP_AUTHOR_LINKEDIN_URL, APP_NAME } from '@/config/app'
import { SITE_DESCRIPTION, pageTitle } from '@/config/site'
import { getBrowserApiBaseUrl } from '@/lib/apiBaseUrl'
import { withGuest } from '@/utils/withAuth'
import { registerSchema } from '@expense/types'
import { zodResolver } from '@hookform/resolvers/zod'
import { Icon } from '@iconify/react'
import { Button, Input } from 'antd'
import axios, { isAxiosError } from 'axios'
import { signIn } from 'next-auth/react'
import Head from 'next/head'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { z } from 'zod'

export const getServerSideProps = withGuest

const registerFormSchema = registerSchema
  .extend({
    confirmPassword: z.string().min(1, 'Xác nhận mật khẩu'),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: 'Mật khẩu nhập lại không khớp',
    path: ['confirmPassword'],
  })

type RegisterFormValues = z.infer<typeof registerFormSchema>

const iconMuted = '#646970'

export default function RegisterPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const { control, handleSubmit, formState } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerFormSchema),
    defaultValues: {
      email: '',
      name: '',
      password: '',
      confirmPassword: '',
    },
  })

  const onSubmit = handleSubmit(async ({ email, name, password }) => {
    setLoading(true)
    setError('')
    try {
      const base = getBrowserApiBaseUrl()
      await axios.post(`${base}/api/auth/register`, { email, name, password }, { timeout: 20_000 })
      const result = await signIn('credentials', {
        email,
        password,
        redirect: false,
      })
      if (result?.error) {
        setError('Đã tạo tài khoản nhưng đăng nhập tự động thất bại. Vui lòng đăng nhập thủ công.')
        await router.push('/auth/login')
        return
      }
      void router.push('/dashboard')
    } catch (e) {
      if (isAxiosError(e)) {
        const msg =
          e.response?.data && typeof e.response.data === 'object' && 'error' in e.response.data
            ? String((e.response.data as { error: unknown }).error)
            : e.message
        setError(msg || 'Đăng ký thất bại')
      } else {
        setError('Đăng ký thất bại')
      }
    } finally {
      setLoading(false)
    }
  })

  return (
    <div className="auth-page">
      <Head>
        <title>{pageTitle('Đăng ký')}</title>
        <meta name="description" content={`Đăng ký — ${SITE_DESCRIPTION}`} />
        <meta name="robots" content="noindex, nofollow" />
      </Head>
      <div className="auth-page__inner">
        <div className="auth-page__hero">
          <div className="auth-page__logo">
            <Icon icon="fluent:wallet-credit-card-24-filled" width={28} color="#fff" />
          </div>
          <h1 className="auth-page__title">{APP_NAME}</h1>
          <p className="auth-page__subtitle">Quản lý chi tiêu nhóm dễ dàng</p>
        </div>

        <div className="auth-page__panel">
          <h2 className="auth-page__panel-title">Đăng ký</h2>

          {error ? (
            <div className="auth-page__alert">
              <Icon icon="fluent:error-circle-20-filled" width={16} />
              {error}
            </div>
          ) : null}

          <form onSubmit={onSubmit}>
            <div style={{ marginBottom: 16 }}>
              <label className="auth-page__label" htmlFor="reg-name">
                Họ tên
              </label>
              <Controller
                name="name"
                control={control}
                render={({ field }) => (
                  <Input
                    {...field}
                    id="reg-name"
                    size="large"
                    placeholder="Nguyễn Văn Tuấn Anh"
                    prefix={<Icon icon="fluent:person-20-regular" color={iconMuted} width={18} />}
                    status={formState.errors.name ? 'error' : ''}
                    autoComplete="name"
                  />
                )}
              />
              {formState.errors.name ? (
                <p className="auth-page__field-error">{formState.errors.name.message}</p>
              ) : null}
            </div>

            <div style={{ marginBottom: 16 }}>
              <label className="auth-page__label" htmlFor="reg-email">
                Email
              </label>
              <Controller
                name="email"
                control={control}
                render={({ field }) => (
                  <Input
                    {...field}
                    id="reg-email"
                    size="large"
                    type="email"
                    placeholder="email@gmail.com"
                    prefix={<Icon icon="fluent:mail-20-regular" color={iconMuted} width={18} />}
                    status={formState.errors.email ? 'error' : ''}
                    autoComplete="email"
                  />
                )}
              />
              {formState.errors.email ? (
                <p className="auth-page__field-error">{formState.errors.email.message}</p>
              ) : null}
            </div>

            <div style={{ marginBottom: 16 }}>
              <label className="auth-page__label" htmlFor="reg-password">
                Mật khẩu
              </label>
              <Controller
                name="password"
                control={control}
                render={({ field }) => (
                  <Input.Password
                    {...field}
                    id="reg-password"
                    size="large"
                    placeholder="Tối thiểu 6 ký tự"
                    prefix={
                      <Icon icon="fluent:lock-closed-20-regular" color={iconMuted} width={18} />
                    }
                    status={formState.errors.password ? 'error' : ''}
                    autoComplete="new-password"
                  />
                )}
              />
              {formState.errors.password ? (
                <p className="auth-page__field-error">{formState.errors.password.message}</p>
              ) : null}
            </div>

            <div style={{ marginBottom: 24 }}>
              <label className="auth-page__label" htmlFor="reg-confirm">
                Nhập lại mật khẩu
              </label>
              <Controller
                name="confirmPassword"
                control={control}
                render={({ field }) => (
                  <Input.Password
                    {...field}
                    id="reg-confirm"
                    size="large"
                    placeholder="••••••••"
                    prefix={
                      <Icon icon="fluent:lock-closed-20-regular" color={iconMuted} width={18} />
                    }
                    status={formState.errors.confirmPassword ? 'error' : ''}
                    autoComplete="new-password"
                  />
                )}
              />
              {formState.errors.confirmPassword ? (
                <p className="auth-page__field-error">{formState.errors.confirmPassword.message}</p>
              ) : null}
            </div>

            <Button
              htmlType="submit"
              type="primary"
              size="large"
              loading={loading}
              block
              style={{ height: 48, borderRadius: 10, fontWeight: 600, fontSize: 15 }}
            >
              Đăng ký
            </Button>
          </form>

          <div className="auth-page__footer mt-4 text-center">
            <span className="text-wp-slate">Đã có tài khoản? </span>
            <Link href="/auth/login" className="auth-page__link">
              Đăng nhập
            </Link>
          </div>

          <div className="mt-4 flex justify-center">
            <AppVersionBadge />
          </div>
        </div>

        <div className="auth-page__meta">
          <div className="auth-page__author-row">
            <span className="app-header-version">{APP_AUTHOR}</span>
            <a
              href={APP_AUTHOR_GITHUB_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="app-header-version"
            >
              <Icon icon="mdi:github" width={16} color="currentColor" aria-hidden />
              GitHub
            </a>
            <a
              href={APP_AUTHOR_LINKEDIN_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="app-header-version"
            >
              <Icon icon="mdi:linkedin" width={16} color="currentColor" aria-hidden />
              LinkedIn
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}
