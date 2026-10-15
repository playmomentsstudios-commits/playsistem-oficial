import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const signup=readFileSync(new URL('../src/pages/public/RegisterPage.tsx',import.meta.url),'utf8')
const auth=readFileSync(new URL('../src/contexts/AuthContext.tsx',import.meta.url),'utf8')
const prefs=readFileSync(new URL('../src/pages/customer/CustomerSettings.tsx',import.meta.url),'utf8')
const migration=readFileSync(new URL('../supabase/migrations/20261014215959_signup_communication_and_confirmed_welcome.sql',import.meta.url),'utf8')

test('signup choices are independent, optional, and unchecked initially',()=>{
  assert.match(signup,/whatsappUpdatesOptIn: false, marketingOptIn: false/)
  assert.match(signup,/checked={form.whatsappUpdatesOptIn}/)
  assert.match(signup,/checked={form.marketingOptIn}/)
  assert.match(signup,/Quero receber avisos pelo WhatsApp/)
  assert.match(signup,/Quero conhecer novidades da Sagamente/)
  assert.match(signup,/Seu e-mail será usado para acessar e recuperar sua conta/)
  assert.match(signup,/whatsappUpdatesOptIn: form.whatsappUpdatesOptIn/)
  assert.match(signup,/marketingOptIn: form.marketingOptIn/)
})

test('auth email verification stays intact; signup metadata records deliberate consent',()=>{
  assert.match(auth,/supabase.auth.signUp\(/)
  assert.match(auth,/emailRedirectTo: siteUrl \+ '\/email-confirmado'/)
  assert.match(auth,/signup_communication_version: '2026-10-v1'/)
  assert.match(auth,/signup_whatsapp_updates_opt_in: payload.whatsappUpdatesOptIn === true/)
  assert.match(auth,/signup_marketing_opt_in: payload.marketingOptIn === true/)
  assert.doesNotMatch(auth,/supabase.auth.admin.generateLink/)
})

test('server stores dated opt-ins without granting either channel by default',()=>{
  assert.match(migration,/marketing_opt_in boolean not null default false/)
  assert.match(migration,/marketing_opt_in_at timestamptz/)
  assert.match(migration,/new.marketing_opt_in_at:=now\(\)/)
  assert.match(migration,/signup_communication_version/)
  assert.match(migration,/v_meta->>'signup_whatsapp_updates_opt_in'='true'/)
  assert.match(migration,/v_phone ~ '\^55\[0-9\]\{10,11\}\$'/)
  assert.match(migration,/signup_consent_version='2026-10-v1'/)
  assert.match(prefs,/marketing_opt_in:prefs.marketing_opt_in/)
  assert.match(prefs,/Novidades e oportunidades/)
})

test('welcome and admin messages happen once only after confirmed email, via in-app notifications',()=>{
  assert.match(migration,/after update of email_confirmed_at on auth.users/)
  assert.match(migration,/old.email_confirmed_at is null and new.email_confirmed_at is not null/)
  assert.match(migration,/on conflict\(user_id\) do nothing returning user_id/)
  assert.match(migration,/new_customer_signup/)
  assert.match(migration,/account_welcome/)
  assert.match(migration,/\/admin\/clientes\//)
  assert.match(migration,/\/app/)
})

test('WhatsApp welcome is only delivered with existing consent, phone, and release-mode checks',()=>{
  assert.match(migration,/if public.wa_bridge_customer_eligible\(new.id\) then/)
  assert.match(migration,/o.event_type='account_welcome'/)
  assert.match(migration,/public.wa_bridge_customer_eligible\(o.recipient_user_id\)/)
  assert.match(migration,/cfg.wa_bridge_delivery_mode='consented_clients'/)
  assert.match(migration,/customer_onboarding_events/)
  assert.match(migration,/v_used>=cfg.wa_bridge_daily_limit/)
  assert.match(migration,/for update of o skip locked/)
  assert.doesNotMatch(migration,/wa_bridge_auto_enabled=true/)
})
