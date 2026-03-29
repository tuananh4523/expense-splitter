import {
  DEFAULT_UI_THEME,
  UI_THEME_IDS,
  type UiThemeId,
} from '@expense/types'

export const UI_THEME_STORAGE_KEY = 'expense-ui-theme'

export function isUiThemeId(v: string): v is UiThemeId {
  return (UI_THEME_IDS as readonly string[]).includes(v)
}

export function readStoredUiTheme(): UiThemeId {
  if (typeof window === 'undefined') return DEFAULT_UI_THEME
  try {
    const v = localStorage.getItem(UI_THEME_STORAGE_KEY)
    if (v && isUiThemeId(v)) return v
  } catch {
    /* ignore */
  }
  return DEFAULT_UI_THEME
}

export function writeStoredUiTheme(id: UiThemeId) {
  try {
    localStorage.setItem(UI_THEME_STORAGE_KEY, id)
  } catch {
    /* ignore */
  }
}

/** `fresh` = không gắn data-theme (dùng :root trong tokens.css). */
export function applyUiThemeToDocument(id: UiThemeId) {
  if (typeof document === 'undefined') return
  const el = document.documentElement
  if (id === DEFAULT_UI_THEME) {
    el.removeAttribute('data-theme')
  } else {
    el.setAttribute('data-theme', id)
  }
}
