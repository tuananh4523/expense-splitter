import type { ThemeConfig } from 'antd'
import { theme as antTheme } from 'antd'

/** Theme Ant tĩnh — token động ghi đè theo `uiThemeAntMap`. */
export const antThemeBase: ThemeConfig = {
  algorithm: antTheme.defaultAlgorithm,
  token: {
    fontFamily: 'var(--font-be-vietnam-pro), -apple-system, BlinkMacSystemFont, sans-serif',
    fontSize: 14,
    colorPrimary: '#0073AA',
    colorSuccess: '#00A32A',
    colorWarning: '#D54E21',
    colorError: '#D63638',
    colorInfo: '#0073AA',
    colorBgBase: '#F0F0F1',
    colorBgContainer: '#FFFFFF',
    colorBgElevated: '#FFFFFF',
    colorTextBase: '#1D2327',
    colorBorder: '#C3C4C7',
    colorBorderSecondary: '#A7AAAD',
    borderRadius: 10,
    borderRadiusLG: 12,
    borderRadiusSM: 6,
    wireframe: false,
    boxShadow: '0 2px 6px rgba(29, 35, 39, 0.08)',
    boxShadowSecondary: '0 6px 18px rgba(29, 35, 39, 0.12)',
    controlHeight: 40,
    controlHeightLG: 48,
    controlHeightSM: 32,
  },
  components: {
    Button: {
      primaryShadow: '0 2px 6px rgba(29, 35, 39, 0.1)',
      fontWeight: 500,
      paddingInline: 20,
    },
    Card: {
      headerBg: 'transparent',
      paddingLG: 24,
    },
    Menu: {
      itemBorderRadius: 8,
      itemMarginInline: 8,
      itemPaddingInline: 12,
      subMenuItemBorderRadius: 6,
      collapsedIconSize: 20,
    },
    Input: {
      paddingBlock: 9,
      paddingInline: 14,
    },
    Select: {
      optionPadding: '8px 12px',
    },
    Table: {
      headerBg: '#F0F0F1',
      headerColor: '#646970',
      headerSortActiveBg: '#DCDCDE',
      rowHoverBg: '#F6F7F7',
    },
    Form: {
      itemMarginBottom: 20,
      labelColor: '#2C3338',
      labelFontSize: 13,
    },
    Layout: {
      siderBg: '#1D2327',
      triggerBg: '#2C3338',
      headerBg: '#FFFFFF',
      headerHeight: 64,
      headerPadding: '0 24px',
    },
  },
}
