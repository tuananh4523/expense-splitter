import { useAppUiTheme } from '@/theme/AppThemeProvider'
import { BgColorsOutlined, CheckOutlined } from '@ant-design/icons'
import { UI_THEME_IDS, UI_THEME_LABELS, UI_THEME_SWATCHES, type UiThemeId } from '@expense/types'
import { App, Popover } from 'antd'
import { useState } from 'react'

export function ThemeSwitcher() {
  const { message } = App.useApp()
  const { themeId, setUiTheme, isSavingTheme } = useAppUiTheme()
  const [open, setOpen] = useState(false)

  const pick = async (id: UiThemeId) => {
    try {
      await setUiTheme(id)
      message.success('Đã đổi giao diện')
    } catch {
      message.error('Không lưu được giao diện')
    }
  }

  const content = (
    <div className="w-[min(100vw-24px,320px)]">
      <div className="mb-2 text-sm font-semibold text-wp-charcoal">Chọn bảng màu</div>
      <div className="grid grid-cols-4 gap-2">
        {UI_THEME_IDS.map((id) => {
          const sw = UI_THEME_SWATCHES[id]
          const active = themeId === id
          return (
            <button
              key={id}
              type="button"
              disabled={isSavingTheme}
              title={UI_THEME_LABELS[id]}
              onClick={() => void pick(id)}
              className={`flex flex-col items-center gap-1 rounded-lg border-2 p-1.5 transition-colors ${
                active ? 'border-brand bg-brand-soft' : 'border-transparent hover:bg-page'
              }`}
            >
              <div className="flex h-3.5 w-[52px] max-w-full overflow-hidden rounded-sm">
                {sw.map((c, i) => (
                  <span key={i} className="min-w-0 flex-1" style={{ background: c }} />
                ))}
              </div>
              <span className="max-w-full truncate text-center text-[10px] font-medium text-wp-slate">
                {UI_THEME_LABELS[id]}
              </span>
              {active ? (
                <CheckOutlined className="text-xs text-brand" aria-hidden />
              ) : (
                <span className="h-3" aria-hidden />
              )}
            </button>
          )
        })}
      </div>
    </div>
  )

  return (
    <Popover
      open={open}
      onOpenChange={setOpen}
      trigger="click"
      placement="bottomRight"
      content={content}
    >
      <button
        type="button"
        className="app-header-bell-btn"
        aria-label="Chọn giao diện màu"
        title="Giao diện"
      >
        <BgColorsOutlined className="text-base" />
      </button>
    </Popover>
  )
}
