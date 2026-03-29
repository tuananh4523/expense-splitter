import path from 'node:path'
import type { NextConfig } from 'next'
/**
 * MINIO_ENDPOINT (build-time): URL đầy đủ `http://host:9000` / `https://...` hoặc chỉ hostname.
 * Dùng cho `images.remotePatterns` — khớp host:port với URL ảnh API trả về (MINIO_PUBLIC_URL / MINIO_ENDPOINT).
 */
function minioImageRemotePattern(): { protocol: 'http' | 'https'; hostname: string; port: string } {
  const raw = (process.env.MINIO_ENDPOINT ?? 'http://localhost:9000').trim()
  if (/^https?:\/\//i.test(raw)) {
    try {
      const u = new URL(raw)
      const protocol = u.protocol === 'https:' ? 'https' : 'http'
      const port =
        u.port ||
        process.env.MINIO_PORT ||
        (protocol === 'https' ? '443' : '9000')
      return { protocol, hostname: u.hostname, port: String(port) }
    } catch {
      /* fallthrough */
    }
  }
  const host = raw.split(':')[0] || 'localhost'
  const portFromHost = raw.includes(':') ? raw.split(':')[1] : undefined
  const port = portFromHost ?? process.env.MINIO_PORT ?? '9000'
  const protocol = process.env.MINIO_USE_SSL === 'true' ? 'https' : 'http'
  return { protocol, hostname: host, port: String(port) }
}

// next-pwa is CommonJS
// eslint-disable-next-line @typescript-eslint/no-require-imports
const defaultPwaRuntimeCache = require('next-pwa/cache.js') as Array<{
  urlPattern: unknown
  handler: string
  method?: string
  options?: unknown
}>

/**
 * Mặc định next-pwa cache GET /api/* (NetworkFirst + cache 24h) — refetch sau PATCH vẫn có thể
 * lấy JSON cũ từ service worker → list chi tiêu không đổi đến khi F5. Phải NetworkOnly cho API.
 */
const pwaRuntimeCaching = [
  {
    urlPattern: ({ url }: { url: URL }) => {
      if (typeof self === 'undefined') return false
      if (self.origin !== url.origin) return false
      if (url.pathname.startsWith('/api/auth/')) return false
      return url.pathname.startsWith('/api/')
    },
    handler: 'NetworkOnly',
    method: 'GET',
  },
  ...defaultPwaRuntimeCache,
]

// eslint-disable-next-line @typescript-eslint/no-require-imports
const withPWA = require('next-pwa')({
  dest: 'public',
  disable: process.env.NODE_ENV === 'development',
  register: true,
  skipWaiting: true,
  runtimeCaching: pwaRuntimeCaching,
})

const nextConfig: NextConfig = {
  output: 'standalone',
  reactStrictMode: true,
  /** Ẩn indicator dev (Next 16) — giảm cảm giác “nháy” overlay khi dev */
  devIndicators: false,
  compiler: {
    styledComponents: true,
  },
  turbopack: {
    root: path.resolve(process.cwd(), '../..'),
  },
  async rewrites() {
    const base = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'
    return [
      {
        // NextAuth lives at /api/auth/* — do not proxy to Hono
        source: '/api/:routes((?!auth/).*)',
        destination: `${base}/api/:routes`,
      },
    ]
  },
  /** Transpile ESM/CJS của antd + rc-* — tránh hydrate/style lệch (Turbopack/webpack). */
  transpilePackages: [
    '@expense/types',
    'antd',
    '@ant-design/icons',
    '@ant-design/cssinjs',
    'styled-components',
    'rc-util',
    'rc-menu',
    'rc-motion',
    'rc-overflow',
    'rc-resize-observer',
  ],
  images: {
    remotePatterns: [minioImageRemotePattern()],
  },
  experimental: {
    optimizePackageImports: ['antd', '@ant-design/icons', 'recharts'],
  },
}

export default withPWA(nextConfig)
