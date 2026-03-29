import { SystemBroadcastListener } from '@/components/notifications/SystemBroadcastListener'
import { api } from '@/lib/api'
import {
  applyUiThemeToDocument,
  readStoredUiTheme,
  writeStoredUiTheme,
} from '@/lib/uiThemeStorage'
import { antThemeBase } from '@/theme/antThemeBase'
import { uiThemeAntMap } from '@/theme/uiThemeAntMap'
import { profileKeys, useMe } from '@/hooks/useProfile'
import { DEFAULT_UI_THEME, type UiThemeId } from '@expense/types'
import { useQueryClient } from '@tanstack/react-query'
import type { ThemeConfig } from 'antd'
import { App as AntdApp, ConfigProvider } from 'antd'
import viVN from 'antd/locale/vi_VN'
import { useSession } from 'next-auth/react'
import {
  createContext,
  useCallback,
  useContext,
  useLayoutEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

function buildAntTheme(themeId: UiThemeId): ThemeConfig {
  const row = uiThemeAntMap[themeId]
  const base = antThemeBase
  return {
    ...base,
    token: {
      ...base.token,
      colorPrimary: row.colorPrimary,
      colorInfo: row.colorInfo,
      colorWarning: row.colorWarning,
    },
    components: {
      ...base.components,
      Layout: {
        ...base.components?.Layout,
        siderBg: row.siderBg,
        triggerBg: row.triggerBg,
      },
      Table: {
        ...base.components?.Table,
        headerBg: row.tableHeaderBg,
      },
    },
  }
}

type ThemeContextValue = {
  themeId: UiThemeId
  /** Áp theme + localStorage; nếu đã đăng nhập thì PATCH /users/me. */
  setUiTheme: (id: UiThemeId) => Promise<void>
  isSavingTheme: boolean
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

export function useAppUiTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) {
    throw new Error('useAppUiTheme must be used within AppThemeProvider')
  }
  return ctx
}

export function AppThemeProvider({ children }: { children: ReactNode }) {
  const { status } = useSession()
  const qc = useQueryClient()
  const { data: me } = useMe({ enabled: status === 'authenticated' })

  const [themeId, setThemeId] = useState<UiThemeId>(DEFAULT_UI_THEME)
  const [isSavingTheme, setIsSavingTheme] = useState(false)

  useLayoutEffect(() => {
    const stored = readStoredUiTheme()
    applyUiThemeToDocument(stored)
    setThemeId(stored)
  }, [])

  useLayoutEffect(() => {
    if (status !== 'authenticated' || !me?.uiTheme) return
    const server = me.uiTheme as UiThemeId
    const stored = readStoredUiTheme()
    if (server !== stored) {
      applyUiThemeToDocument(server)
      writeStoredUiTheme(server)
      setThemeId(server)
    }
  }, [status, me?.uiTheme])

  const antTheme = useMemo(() => buildAntTheme(themeId), [themeId])

  const setUiTheme = useCallback(
    async (id: UiThemeId) => {
      applyUiThemeToDocument(id)
      writeStoredUiTheme(id)
      setThemeId(id)
      if (status !== 'authenticated') return
      setIsSavingTheme(true)
      try {
        await api.patch('/users/me', { uiTheme: id })
        void qc.invalidateQueries({ queryKey: profileKeys.me })
      } finally {
        setIsSavingTheme(false)
      }
    },
    [status, qc],
  )

  const value = useMemo(
    () => ({ themeId, setUiTheme, isSavingTheme }),
    [themeId, setUiTheme, isSavingTheme],
  )

  return (
    <ThemeContext.Provider value={value}>
      <ConfigProvider locale={viVN} theme={antTheme}>
        <AntdApp notification={{ placement: 'topRight', top: 80 }}>
          <SystemBroadcastListener />
          {children}
        </AntdApp>
      </ConfigProvider>
    </ThemeContext.Provider>
  )
}
