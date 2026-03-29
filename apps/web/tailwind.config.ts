import type { Config } from 'tailwindcss'

/**
 * - preflight: false — tránh reset xung đột Ant Design; dùng shell.css + globals cho nền/body.
 * - Scan: ưu tiên @source trong globals.css (Tailwind v4); content ở đây là dự phòng / công cụ.
 */
const config: Config = {
  content: ['./src/**/*.{ts,tsx,js,jsx}'],
  corePlugins: {
    preflight: false,
  },
  theme: {
    extend: {
      screens: { xs: '480px' },
      colors: {
        brand: {
          DEFAULT: 'var(--wp-blue)',
          soft: 'var(--color-brand-soft)',
          text: 'var(--wp-blue-dark)',
        },
        page: 'var(--color-bg-page)',
        wp: {
          charcoal: 'var(--wp-charcoal)',
          slate: 'var(--wp-slate)',
          blue: 'var(--wp-blue)',
          bg: 'var(--wp-bg)',
          orange: 'var(--wp-orange)',
        },
      },
      boxShadow: {
        sm: '0 2px 6px rgba(29, 35, 39, 0.08)',
        md: '0 6px 18px rgba(29, 35, 39, 0.12)',
      },
    },
  },
  plugins: [],
}

export default config
