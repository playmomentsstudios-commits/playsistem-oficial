/** Badge do PWA: contador de notificações não lidas, nunca uma contagem estimada. */
export const BADGE_REFRESH_EVENT = 'sagamente:badge-refresh'

type BadgingNavigator = Navigator & {
  setAppBadge?: (contents?: number) => Promise<void>
  clearAppBadge?: () => Promise<void>
}

/** Browser support varies: unsupported browsers retain their normal notification UI. */
export async function setUnreadAppBadge(count: number): Promise<void> {
  if (typeof navigator === 'undefined' || !Number.isSafeInteger(count) || count < 0) return
  const badge = navigator as BadgingNavigator
  try {
    if (count === 0) {
      if (typeof badge.clearAppBadge === 'function') await badge.clearAppBadge()
      else if (typeof badge.setAppBadge === 'function') await badge.setAppBadge(0)
    } else if (typeof badge.setAppBadge === 'function') {
      await badge.setAppBadge(count)
    }
  } catch {
    // iOS only displays badges for installed PWAs with notification permission.
  }
}

export function notifyBadgeChanged(): void {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(BADGE_REFRESH_EVENT))
}
