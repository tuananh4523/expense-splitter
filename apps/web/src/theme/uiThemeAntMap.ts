import type { UiThemeId } from '@expense/types'

/** Token Ant khớp màu trong `themes.css` (primary / sidebar / cảnh báo). */
export const uiThemeAntMap: Record<
  UiThemeId,
  {
    colorPrimary: string
    colorInfo: string
    colorWarning: string
    siderBg: string
    triggerBg: string
    tableHeaderBg: string
  }
> = {
  fresh: {
    colorPrimary: '#0073AA',
    colorInfo: '#0073AA',
    colorWarning: '#D54E21',
    siderBg: '#1d2327',
    triggerBg: '#2c3338',
    tableHeaderBg: '#F0F0F1',
  },
  light: {
    colorPrimary: '#d54e21',
    colorInfo: '#d54e21',
    colorWarning: '#9ebaa0',
    siderBg: '#e5e5e5',
    triggerBg: '#cccccc',
    tableHeaderBg: '#e8e8e8',
  },
  '80s-kid': {
    colorPrimary: '#cb2b8e',
    colorInfo: '#cb2b8e',
    colorWarning: '#f0e328',
    siderBg: '#1c2260',
    triggerBg: '#161b52',
    tableHeaderBg: '#F0F0F1',
  },
  aubergine: {
    colorPrimary: '#a3b745',
    colorInfo: '#a3b745',
    colorWarning: '#d499c1',
    siderBg: '#4a1a2c',
    triggerBg: '#3d1525',
    tableHeaderBg: '#F0F0F1',
  },
  blue: {
    colorPrimary: '#e1a948',
    colorInfo: '#e1a948',
    colorWarning: '#72c2e9',
    siderBg: '#096484',
    triggerBg: '#075472',
    tableHeaderBg: '#F0F0F1',
  },
  coffee: {
    colorPrimary: '#c7a589',
    colorInfo: '#c7a589',
    colorWarning: '#e5c08a',
    siderBg: '#46403c',
    triggerBg: '#383330',
    tableHeaderBg: '#F0F0F1',
  },
  cruise: {
    colorPrimary: '#d9ab59',
    colorInfo: '#d9ab59',
    colorWarning: '#82b4c8',
    siderBg: '#263238',
    triggerBg: '#1c272c',
    tableHeaderBg: '#F0F0F1',
  },
  ectoplasm: {
    colorPrimary: '#a7b656',
    colorInfo: '#a7b656',
    colorWarning: '#c6d46e',
    siderBg: '#413256',
    triggerBg: '#352849',
    tableHeaderBg: '#F0F0F1',
  },
  flat: {
    colorPrimary: '#f18500',
    colorInfo: '#f18500',
    colorWarning: '#56c2d6',
    siderBg: '#1e2327',
    triggerBg: '#14181b',
    tableHeaderBg: '#F0F0F1',
  },
  lawn: {
    colorPrimary: '#b4b848',
    colorInfo: '#b4b848',
    colorWarning: '#d8e27a',
    siderBg: '#1b3218',
    triggerBg: '#142612',
    tableHeaderBg: '#F0F0F1',
  },
  midnight: {
    colorPrimary: '#e14d43',
    colorInfo: '#e14d43',
    colorWarning: '#77a6bc',
    siderBg: '#25282b',
    triggerBg: '#1a1d1f',
    tableHeaderBg: '#F0F0F1',
  },
  ocean: {
    colorPrimary: '#9ebaa0',
    colorInfo: '#9ebaa0',
    colorWarning: '#738e8f',
    siderBg: '#627c83',
    triggerBg: '#536a70',
    tableHeaderBg: '#F0F0F1',
  },
  primary: {
    colorPrimary: '#b81c2e',
    colorInfo: '#b81c2e',
    colorWarning: '#f9c440',
    siderBg: '#191e23',
    triggerBg: '#101418',
    tableHeaderBg: '#F0F0F1',
  },
  seashore: {
    colorPrimary: '#a09060',
    colorInfo: '#a09060',
    colorWarning: '#c7ac7d',
    siderBg: '#ede8d6',
    triggerBg: '#ddd8c0',
    tableHeaderBg: '#e8e4d4',
  },
  sunrise: {
    colorPrimary: '#dd823b',
    colorInfo: '#dd823b',
    colorWarning: '#f0c050',
    siderBg: '#6e3d3d',
    triggerBg: '#5c3232',
    tableHeaderBg: '#F0F0F1',
  },
  vineyard: {
    colorPrimary: '#c09050',
    colorInfo: '#c09050',
    colorWarning: '#d4b080',
    siderBg: '#4a2040',
    triggerBg: '#3d1a35',
    tableHeaderBg: '#F0F0F1',
  },
}
