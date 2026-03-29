import { z } from 'zod'

/** Theme giao diện (WordPress admin color schemes) — khớp `data-theme` trên `<html>`. */
export const UI_THEME_IDS = [
  'fresh',
  'light',
  '80s-kid',
  'aubergine',
  'blue',
  'coffee',
  'cruise',
  'ectoplasm',
  'flat',
  'lawn',
  'midnight',
  'ocean',
  'primary',
  'seashore',
  'sunrise',
  'vineyard',
] as const

export type UiThemeId = (typeof UI_THEME_IDS)[number]

export const DEFAULT_UI_THEME: UiThemeId = 'fresh'

export const uiThemeIdSchema = z.enum(UI_THEME_IDS)

export const UI_THEME_LABELS: Record<UiThemeId, string> = {
  fresh: 'Fresh',
  light: 'Light',
  '80s-kid': "80's Kid",
  aubergine: 'Aubergine',
  blue: 'Blue',
  coffee: 'Coffee',
  cruise: 'Cruise',
  ectoplasm: 'Ectoplasm',
  flat: 'Flat',
  lawn: 'Lawn',
  midnight: 'Midnight',
  ocean: 'Ocean',
  primary: 'Primary',
  seashore: 'Seashore',
  sunrise: 'Sunrise',
  vineyard: 'Vineyard',
}

/** Swatch preview (sidebar / accent / highlight / phụ) — khớp theme-system prompt. */
export const UI_THEME_SWATCHES: Record<UiThemeId, [string, string, string, string]> = {
  fresh: ['#23282d', '#0073aa', '#00a0d2', '#72aee6'],
  light: ['#e5e5e5', '#d54e21', '#f9d05e', '#9ebaa0'],
  '80s-kid': ['#1c2260', '#cb2b8e', '#f0e328', '#5dc1b9'],
  aubergine: ['#4a1a2c', '#a3b745', '#d499c1', '#886d81'],
  blue: ['#096484', '#e1a948', '#72c2e9', '#4796b3'],
  coffee: ['#46403c', '#c7a589', '#e5c08a', '#9ea476'],
  cruise: ['#263238', '#d9ab59', '#82b4c8', '#a3b9c9'],
  ectoplasm: ['#413256', '#a7b656', '#c6d46e', '#8c88b2'],
  flat: ['#1e2327', '#f18500', '#56c2d6', '#3fbbc0'],
  lawn: ['#1b3218', '#b4b848', '#d8e27a', '#7b9c5e'],
  midnight: ['#25282b', '#e14d43', '#77a6bc', '#363b3f'],
  ocean: ['#627c83', '#9ebaa0', '#c4dde2', '#738e8f'],
  primary: ['#191e23', '#b81c2e', '#f9c440', '#2271b1'],
  seashore: ['#ede8d6', '#a09060', '#c7ac7d', '#d4c5a0'],
  sunrise: ['#6e3d3d', '#dd823b', '#f0c050', '#e05c5c'],
  vineyard: ['#4a2040', '#c09050', '#d4b080', '#7a4060'],
}
