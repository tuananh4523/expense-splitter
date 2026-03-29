import '@/styles/shell.css'
import '@/styles/globals.css'
import { IdleSessionWatcher } from '@/components/session/IdleSessionWatcher'
import { SessionValidityWatcher } from '@/components/session/SessionValidityWatcher'
import { AppThemeProvider } from '@/theme/AppThemeProvider'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import dayjs from 'dayjs'
import 'dayjs/locale/vi'
import { SessionProvider } from 'next-auth/react'
import type { AppProps } from 'next/app'

dayjs.locale('vi')

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 0,
      retry: 1,
      refetchOnWindowFocus: true,
    },
  },
})

export default function MyApp({ Component, pageProps: { session, ...pageProps } }: AppProps) {
  return (
    <SessionProvider
      session={session}
      refetchOnWindowFocus
      /** Đồng bộ session (role/menu) thường xuyên — kết hợp jwt callback gọi /users/me. */
      refetchInterval={20}
    >
      <QueryClientProvider client={queryClient}>
        <AppThemeProvider>
          <IdleSessionWatcher />
          <SessionValidityWatcher />
          <Component {...pageProps} />
        </AppThemeProvider>
        <ReactQueryDevtools initialIsOpen={false} />
      </QueryClientProvider>
    </SessionProvider>
  )
}
