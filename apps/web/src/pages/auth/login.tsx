import { AppVersionBadge } from '@/components/layout/AppVersionBadge'
import { APP_AUTHOR, APP_AUTHOR_GITHUB_URL, APP_NAME } from '@/config/app'
import { SITE_DESCRIPTION, pageTitle } from '@/config/site'
import { withGuest } from '@/utils/withAuth'
import { type LoginInput, loginSchema } from '@expense/types'
import { zodResolver } from '@hookform/resolvers/zod'
import { Icon } from '@iconify/react'
import { Button, Input } from 'antd'
import { signIn } from 'next-auth/react'
import Head from 'next/head'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'
import { Controller, useForm } from 'react-hook-form'

export const getServerSideProps = withGuest

const iconMuted = '#646970'

export default function LoginPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const { control, handleSubmit, formState } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  })

  useEffect(() => {
    const r = router.query.reason
    if (r === 'locked') {
      setError('Tài khoản của bạn đã bị khóa. Liên hệ quản trị viên nếu cần hỗ trợ.')
    } else if (r === 'idle') {
      setError(
        'Phiên đã hết hạn do không hoạt động trong thời gian quy định. Vui lòng đăng nhập lại.',
      )
    } else if (r === 'session') {
      setError('Phiên đăng nhập không còn hiệu lực hoặc đã hết hạn. Vui lòng đăng nhập lại.')
    }
  }, [router.query.reason])

  const onSubmit = handleSubmit(async (data) => {
    setLoading(true)
    setError('')
    try {
      const result = await signIn('credentials', { ...data, redirect: false })
      if (result?.error) {
        setError(
          result.error === 'CredentialsSignin'
            ? 'Email hoặc mật khẩu không đúng. Nếu mới clone repo: chạy migration + seed để có adminta@gmail.com / 1234567.'
            : result.error,
        )
      } else {
        void router.push('/dashboard')
      }
    } finally {
      setLoading(false)
    }
  })

  return (
    <div className="auth-page">
      <Head>
        <title>{pageTitle('Đăng nhập')}</title>
        <meta name="description" content={`Đăng nhập — ${SITE_DESCRIPTION}`} />
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
          <h2 className="auth-page__panel-title">Đăng nhập</h2>

          {error ? (
            <div className="auth-page__alert">
              <Icon icon="fluent:error-circle-20-filled" width={16} />
              {error}
            </div>
          ) : null}

          <form onSubmit={onSubmit}>
            <div style={{ marginBottom: 16 }}>
              <label className="auth-page__label" htmlFor="login-email">
                Email
              </label>
              <Controller
                name="email"
                control={control}
                render={({ field }) => (
                  <Input
                    {...field}
                    id="login-email"
                    size="large"
                    placeholder="email@gmail.com"
                    prefix={<Icon icon="fluent:mail-20-regular" color={iconMuted} width={18} />}
                    status={formState.errors.email ? 'error' : ''}
                  />
                )}
              />
              {formState.errors.email ? (
                <p className="auth-page__field-error">{formState.errors.email.message}</p>
              ) : null}
            </div>

            <div style={{ marginBottom: 24 }}>
              <label className="auth-page__label" htmlFor="login-password">
                Mật khẩu
              </label>
              <Controller
                name="password"
                control={control}
                render={({ field }) => (
                  <Input.Password
                    {...field}
                    id="login-password"
                    size="large"
                    placeholder="••••••••"
                    prefix={
                      <Icon icon="fluent:lock-closed-20-regular" color={iconMuted} width={18} />
                    }
                    status={formState.errors.password ? 'error' : ''}
                  />
                )}
              />
            </div>

            <Button
              htmlType="submit"
              type="primary"
              size="large"
              loading={loading}
              block
              style={{ height: 48, borderRadius: 10, fontWeight: 600, fontSize: 15 }}
            >
              Đăng nhập
            </Button>
          </form>

          <div className="auth-page__footer mt-4 text-center">
            <span className="text-wp-slate">Chưa có tài khoản? </span>
            <Link href="/auth/register" className="auth-page__link">
              Đăng ký
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
            {/* <a
              href={APP_AUTHOR_LINKEDIN_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="app-header-version"
            >
              <Icon icon="mdi:linkedin" width={16} color="currentColor" aria-hidden />
              LinkedIn
            </a> */}
          </div>
        </div>
      </div>
    </div>
  )
}
