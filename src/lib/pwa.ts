/** Registers PWA support only in production. */
export function registerPwa(): void {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' })
      .catch((error: unknown) => console.warn('[Sagamente PWA] Falha no registro.', error))
  }, { once: true })
}
