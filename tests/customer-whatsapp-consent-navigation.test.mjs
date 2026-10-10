import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const route=readFileSync(new URL('../src/AppV2.tsx',import.meta.url),'utf8')
const nav=readFileSync(new URL('../src/layouts/CustomerLayoutV2.tsx',import.meta.url),'utf8')
const consent=readFileSync(new URL('../src/pages/customer/CustomerSettings.tsx',import.meta.url),'utf8')
const profile=readFileSync(new URL('../src/pages/customer/ProfilePage.tsx',import.meta.url),'utf8')
const notices=readFileSync(new URL('../src/pages/customer/NotificationsPage.tsx',import.meta.url),'utf8')
const api=readFileSync(new URL('../src/api/settings.ts',import.meta.url),'utf8')

test('customer Settings page and WhatsApp consent are discoverable',()=>{
  assert.match(route,/path="configuracoes" element=\{<CustomerSettings/)
  assert.match(nav,/label: 'Configurações', href: '\/app\/configuracoes'/)
  assert.match(profile,/to="\/app\/configuracoes#whatsapp"/)
  assert.match(notices,/to="\/app\/configuracoes#whatsapp"/)
  assert.match(consent,/id="whatsapp"/)
  assert.match(consent,/location\.hash!=='#whatsapp'/)
})
test('WhatsApp opt-in is distinct from activating device Push',()=>{
  assert.match(consent,/WhatsApp — Avisos dos meus projetos/)
  assert.match(consent,/Ativar notificações Push não autoriza o WhatsApp/)
  assert.match(consent,/PushNotificationSettings/)
  assert.match(consent,/onChange=\{toggle\('wa_automatic_opt_in'\)\}/)
  assert.match(consent,/Salvar autorização de WhatsApp/)
})
test('user sees current phone and can withdraw; only own preference update is sent',()=>{
  assert.match(consent,/supabase\.from\('profiles'\)\.select\('phone'\)\.eq\('id',id\)/)
  assert.match(consent,/Conferir ou alterar meu telefone/)
  assert.match(consent,/Posso retirar essa autorização/)
  assert.match(consent,/pref[s]?\.wa_automatic_opt_in/)
  assert.match(api,/wa_opt_in_phone:string\|null/)
  assert.match(api,/wa_opt_in_at:string\|null/)
  assert.match(api,/user_id:user\.id/)
})
