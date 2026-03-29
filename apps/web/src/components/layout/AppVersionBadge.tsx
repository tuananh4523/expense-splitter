import { APP_VERSION } from '@/config/app'
import clsx from 'clsx'

const BETA_IN_VERSION = /beta/i.test(APP_VERSION)

export function AppVersionBadge({ className }: { className?: string }) {
  return (
    <span
      className={clsx(
        'app-header-version app-version-badge',
        BETA_IN_VERSION && 'app-header-version--beta',
        className,
      )}
      title={`Phiên bản ${APP_VERSION}`}
    >
      <span className="app-header-version__text">v{APP_VERSION}</span>
    </span>
  )
}
