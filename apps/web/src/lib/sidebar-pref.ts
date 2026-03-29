/** Khớp với script trong `_document.tsx` (tránh FOUC khi F5). */
export const SIDEBAR_COLLAPSED_STORAGE_KEY = 'sidebar-collapsed'

export function readSidebarCollapsedFromStorage(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return window.localStorage.getItem(SIDEBAR_COLLAPSED_STORAGE_KEY) === '1'
  } catch {
    return false
  }
}
