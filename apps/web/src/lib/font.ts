import { Be_Vietnam_Pro } from 'next/font/google'

/** Dùng chung _document (class biến CSS) + token antd — tránh FOUC do link Google Fonts ngoài. */
export const beVietnamPro = Be_Vietnam_Pro({
  subsets: ['latin', 'latin-ext', 'vietnamese'],
  weight: ['300', '400', '500', '600', '700'],
  display: 'swap',
  variable: '--font-be-vietnam-pro',
})
