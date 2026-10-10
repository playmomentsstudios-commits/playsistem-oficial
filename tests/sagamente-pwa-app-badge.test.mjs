import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8')
const sw=read('public/sw.js')
const dispatch=read('supabase/functions/push-dispatch/index.ts')
const badge=read('src/lib/appBadge.ts')
const portal=read('src/api/portal.ts')

test('Push envelope contains the recipient unread count from database, not cumulative guesses',()=>{
  assert.match(dispatch,/select\("id",\{count:"exact",head:true\}\)/)
  assert.match(dispatch,/\.eq\("user_id",item\.user_id\)\.is\("read_at",null\)/)
  assert.match(dispatch,/safeNotice\(kind,role,link,unreadCount\)/)
  assert.match(dispatch,/badge:"\/pwa\/icon-192\.png",category:kind,role,unreadCount/)
  assert.doesNotMatch(dispatch,/message\.content|item\.message\}/)
})
test('Service Worker sets an actual iOS home screen app badge even while the app is closed',()=>{
  assert.match(sw,/self\.addEventListener\('push'/)
  assert.match(sw,/self\.registration\.showNotification/)
  assert.match(sw,/Number\.isSafeInteger\(unread\)/)
  assert.match(sw,/self\.navigator\.setAppBadge\(unread\)/)
  assert.match(sw,/self\.navigator\.clearAppBadge\(\)/)
})
test('Logged in layouts update badge from authoritative unread inbox at startup, refocus and polling',()=>{
  for(const path of ['src/layouts/CustomerLayoutV2.tsx','src/layouts/AdminLayout.tsx']){
    const src=read(path)
    assert.match(src,/setUnreadAppBadge\(counts\.notifications\)/)
    assert.match(src,/BADGE_REFRESH_EVENT/)
    assert.match(src,/visibilitychange/)
    assert.match(src,/setInterval\(load, 10000\)/)
  }
})
test('Reading alerts or conversation clears their unread notifications, and logout clears old account badge',()=>{
  assert.match(portal,/markNotification: async/)
  assert.match(portal,/markAllNotifications: async/)
  assert.match(portal,/notifyBadgeChanged\(\)/)
  assert.match(portal,/\.contains\('metadata',\{conversation_id:conversationId\}\)/)
  assert.match(read('src/contexts/AuthContext.tsx'),/setUnreadAppBadge\(0\)/)
  assert.match(badge,/clearAppBadge/)
  assert.match(badge,/Number\.isSafeInteger\(count\)/)
})
