import type { UserRole } from '../types'

// Validate both the encoded and decoded form before passing a return path to the router.
export function safeReturnPath(value: unknown): string | null {
  if (typeof value !== 'string' || !value.startsWith('/')) return null
  try {
    let decoded = value
    for (let i = 0; i < 5; i++) {
      if (!decoded.startsWith('/') || decoded.startsWith('//') || /[\\\s\u0000-\u001f\u007f]/.test(decoded)) return null
      const next = decodeURIComponent(decoded)
      if (next === decoded) {
        const url = new URL(value, 'https://internal.invalid')
        const normalized = new URL(decoded, 'https://internal.invalid')
        if (url.origin !== 'https://internal.invalid' || url.pathname.startsWith('//') || normalized.pathname.startsWith('//') || /^\/(login|cadastro)(\/|$)/.test(normalized.pathname)) return null
        return url.pathname + url.search + url.hash
      }
      decoded = next
    }
  } catch { /* Invalid encoding is not a return destination. */ }
  return null
}

export function authLink(page: '/login' | '/cadastro', next: unknown) {
  const path = safeReturnPath(next)
  return path ? `${page}?${new URLSearchParams({ next: path })}` : page
}

export function afterAuthPath(next: unknown, role: UserRole) {
  const path = safeReturnPath(next)
  const staff = role === 'admin' || role === 'staff'
  if (!path) return staff ? '/admin' : '/app/dashboard'
  const url = new URL(path, 'https://internal.invalid')
  if (staff && /^\/app\/conversas(\/|$)/.test(url.pathname)) return '/admin/conversas' + url.search
  if (staff && /^\/app(\/|$)/.test(url.pathname)) return '/admin'
  if (!staff && /^\/admin(\/|$)/.test(url.pathname)) return '/app/dashboard'
  return path
}

export function conversationLink(role: UserRole | null, subject?: 'orcamento' | 'duvida') {
  const path = '/app/conversas' + (subject ? `?assunto=${subject}` : '')
  return role ? afterAuthPath(path, role) : authLink('/cadastro', path)
}
