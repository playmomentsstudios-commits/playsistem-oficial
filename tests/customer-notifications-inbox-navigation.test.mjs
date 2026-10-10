import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8')
const notices=read('src/pages/customer/NotificationsPage.tsx')
const layout=read('src/layouts/CustomerLayoutV2.tsx')
const settings=read('src/pages/customer/CustomerSettings.tsx')
const portal=read('src/api/portal.ts')

test('phone and desktop notification bells open real inbox, not push settings',()=>{
  assert.match(layout,/aria-label="Abrir notificações"/)
  assert.match(layout,/to="\/app\/notificacoes"/)
  assert.match(layout,/counts\.notifications>0/)
  assert.match(layout,/label: 'Notificações', href: '\/app\/notificacoes'/)
  assert.doesNotMatch(layout,/<PushNotificationSettings iconOnly\/>/)
  // Device-level push settings remain accessible in the account menu.
  assert.match(layout,/<PushNotificationSettings compact\/>/)
})

test('inbox reads actual database events with no simulated notifications',()=>{
  assert.match(notices,/portalApi\.notifications\(\)/)
  assert.match(notices,/syncMyRentalNotifications\(\)/)
  assert.match(portal,/from\('notifications'\)\.select\('\*'\)/)
  assert.match(notices,/rows\.map|visible\.map/)
  assert.match(notices,/Nenhuma notificação recebida/)
  assert.match(notices,/aria-pressed=\{filter==='unread'\}/)
  assert.match(notices,/Não lidas \(\{unread\}\)/)
  assert.match(notices,/portalApi\.markNotification\(row\.id\)/)
  assert.match(notices,/portalApi\.markAllNotifications\(\)/)
  assert.doesNotMatch(notices,/sampleNotifications|mockNotifications|fakeNotifications|exampleNotices|seedNotifications/)
})

test('gear leads to preferences; message click preserves deep-link to its task',()=>{
  assert.match(notices,/aria-label="Configurações de notificações"/)
  assert.match(notices,/\/app\/configuracoes#notificacoes/)
  assert.match(notices,/\/admin\/configuracoes/)
  assert.match(settings,/id="notificacoes"/)
  assert.match(settings,/location\.hash!=='#notificacoes'/)
  assert.match(settings,/to="\/app\/notificacoes"/)
  assert.match(notices,/safeDestination\(row\.link,listPath\)/)
  assert.match(notices,/navigate\(destination\)/)
  assert.match(notices,/Ver detalhes/)
  assert.match(notices,/to="\/app\/configuracoes#whatsapp"/)
})

test('portal displays real read state, updates unread badge and offers refresh',()=>{
  assert.match(notices,/row\.read_at/)
  assert.match(notices,/onClick=\{\(\)=>void markAll\(\)\}/)
  assert.match(notices,/window\.setInterval/)
  assert.match(notices,/document\.visibilityState==='visible'/)
  assert.match(notices,/aria-label="Atualizar notificações"/)
  assert.match(portal,/notifyBadgeChanged\(\)/)
})
