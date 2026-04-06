import { APP_NAME } from '@/config/app'
import { SITE_DESCRIPTION, getPublicSiteUrl } from '@/config/site'
import { beVietnamPro } from '@/lib/font'
import { SIDEBAR_COLLAPSED_STORAGE_KEY } from '@/lib/sidebar-pref'
import { UI_THEME_STORAGE_KEY } from '@/lib/uiThemeStorage'
import { StyleProvider, createCache, extractStyle } from '@ant-design/cssinjs'
import { UI_THEME_IDS } from '@expense/types'
import Document, { Head, Html, Main, NextScript, type DocumentContext } from 'next/document'
import { ServerStyleSheet } from 'styled-components'

/** Chạy trước paint đầu — class khớp localStorage sidebar (SSR không biết được). */
const sidebarPrefBootstrapScript = `(function(){try{if(localStorage.getItem(${JSON.stringify(SIDEBAR_COLLAPSED_STORAGE_KEY)})==='1')document.documentElement.classList.add('layout-shell-collapsed');}catch(e){}})();`

const uiThemeBootstrapScript = `(function(){try{var K=${JSON.stringify(UI_THEME_STORAGE_KEY)};var A=${JSON.stringify([...UI_THEME_IDS])};var t=localStorage.getItem(K);if(!t||A.indexOf(t)<0)t='fresh';if(t!=='fresh')document.documentElement.setAttribute('data-theme',t);else document.documentElement.removeAttribute('data-theme');}catch(e){}})();`

export default class MyDocument extends Document {
  static async getInitialProps(ctx: DocumentContext) {
    const cache = createCache()
    const rsSheet = new ServerStyleSheet()

    const originalRenderPage = ctx.renderPage
    ctx.renderPage = () =>
      originalRenderPage({
        enhanceApp: (App) => (props) =>
          rsSheet.collectStyles(
            <StyleProvider cache={cache}>
              <App {...props} />
            </StyleProvider>,
          ),
      })

    const initialProps = await Document.getInitialProps(ctx)
    const antdStyle = extractStyle(cache, true)

    return {
      ...initialProps,
      styles: (
        <>
          {initialProps.styles}
          <style dangerouslySetInnerHTML={{ __html: antdStyle }} />
          {rsSheet.getStyleElement()}
        </>
      ),
    }
  }

  render() {
    const siteUrl = getPublicSiteUrl()
    const ogImage = `${siteUrl}/og-image.png`
    return (
      <Html lang="vi" className={beVietnamPro.variable}>
        <Head>
          <script dangerouslySetInnerHTML={{ __html: uiThemeBootstrapScript }} />
          <script dangerouslySetInnerHTML={{ __html: sidebarPrefBootstrapScript }} />
          <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
          <meta name="description" content={SITE_DESCRIPTION} />
          <link rel="canonical" href={siteUrl} />
          <link rel="icon" href="/favicon.ico" sizes="32x32" />
          <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
          <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32.png" />
          <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
          <link rel="manifest" href="/manifest.json" />
          <meta name="theme-color" content="#0073AA" />
          <meta name="apple-mobile-web-app-capable" content="yes" />
          <meta name="apple-mobile-web-app-status-bar-style" content="default" />
          <meta name="apple-mobile-web-app-title" content={APP_NAME} />
          <meta property="og:type" content="website" />
          <meta property="og:url" content={siteUrl} />
          <meta property="og:site_name" content={APP_NAME} />
          <meta property="og:locale" content="vi_VN" />
          <meta property="og:title" content={APP_NAME} />
          <meta property="og:description" content={SITE_DESCRIPTION} />
          <meta property="og:image" content={ogImage} />
          {siteUrl.startsWith('https:') ? (
            <meta property="og:image:secure_url" content={ogImage} />
          ) : null}
          <meta property="og:image:type" content="image/png" />
          <meta property="og:image:alt" content={`${APP_NAME} — ${SITE_DESCRIPTION}`} />
          <meta property="og:image:width" content="1200" />
          <meta property="og:image:height" content="630" />
          <meta name="twitter:card" content="summary_large_image" />
          <meta name="twitter:title" content={APP_NAME} />
          <meta name="twitter:description" content={SITE_DESCRIPTION} />
          <meta name="twitter:image" content={ogImage} />
        </Head>
        <body className="antialiased" style={{ backgroundColor: '#f0f0f1' }}>
          <Main />
          <NextScript />
        </body>
      </Html>
    )
  }
}
