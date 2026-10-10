// A compact notification identifier is a locator, never an access token.
export function notificationIdFromCode(code: string): string | null {
  if (!/^[A-Za-z0-9_-]{22}$/.test(code)) return null
  try {
    const bytes = atob(code.replace(/-/g, '+').replace(/_/g, '/') + '==')
    if (bytes.length !== 16 || btoa(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '') !== code) return null
    const hex = Array.from(bytes, byte => byte.charCodeAt(0).toString(16).padStart(2, '0')).join('')
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
  } catch { return null }
}
