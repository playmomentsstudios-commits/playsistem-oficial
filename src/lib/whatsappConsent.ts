import type { UserPreferences } from '../api/settings'

export const WHATSAPP_CONSENT_PATH = '/whatsapp'

export function whatsappPhone(phone: string | null | undefined): string {
  const digits = (phone || '').replace(/\D/g, '')
  return /^55\d{10,11}$/.test(digits) ? digits : /^\d{10,11}$/.test(digits) ? '55' + digits : ''
}

export function whatsappConsentCurrent(preferences: UserPreferences | null, phone: string) {
  return Boolean(phone && preferences?.wa_automatic_opt_in && preferences.wa_opt_in_at && preferences.wa_opt_in_phone === phone)
}

export async function saveWhatsappConsent(
  preferences: UserPreferences | null,
  phone: string,
  enabled: boolean,
  save: (values: { wa_automatic_opt_in: boolean }) => Promise<UserPreferences>,
) {
  if (enabled && !/^55\d{10,11}$/.test(phone)) throw new Error('Cadastre um WhatsApp com DDD no seu perfil para continuar.')
  if (enabled && whatsappConsentCurrent(preferences, phone)) return preferences!
  // The existing database trigger intentionally preserves old consent when
  // a phone changes. Revoke it first, then record the explicit new acceptance.
  if (enabled && preferences?.wa_automatic_opt_in) await save({ wa_automatic_opt_in: false })
  const saved = await save({ wa_automatic_opt_in: enabled })
  if (enabled && !whatsappConsentCurrent(saved, phone)) throw new Error('A autorização não foi confirmada. Confira seu telefone e tente novamente.')
  if (!enabled && saved.wa_automatic_opt_in) throw new Error('Não foi possível cancelar os avisos. Tente novamente.')
  return saved
}
