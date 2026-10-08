export interface PwaPrompt extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

let pendingPrompt: PwaPrompt | null = null
export const INSTALL_PROMPT_CHANGED = 'sagamente:install-prompt'
export function getInstallPrompt(): PwaPrompt | null { return pendingPrompt }
export function clearInstallPrompt(): void {
  pendingPrompt = null
  window.dispatchEvent(new Event(INSTALL_PROMPT_CHANGED))
}

// Register globally: Chrome can fire the install event before users open /instalar.
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault()
    pendingPrompt = event as PwaPrompt
    window.dispatchEvent(new Event(INSTALL_PROMPT_CHANGED))
  })
  window.addEventListener('appinstalled', clearInstallPrompt)
}

/** Register the privacy-preserving service worker in production only. */
export function registerPwa(): void {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' })
      .catch((error: unknown) => console.warn('[Sagamente PWA] Falha no registro.', error))
  }, { once: true })
}
