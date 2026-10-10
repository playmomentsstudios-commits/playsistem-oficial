import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const file=(path)=>readFileSync(new URL('../'+path,import.meta.url),'utf8')
const chat=file('src/components/chat/SupportChat.tsx')
const help=file('src/pages/customer/HelpPage.tsx')
const auto=file('src/components/chat/AutoAttendant.tsx')
const routes=file('src/AppV2.tsx')
const layout=file('src/layouts/CustomerLayoutV2.tsx')
const composer=file('src/components/chat/ChatComposer.tsx')
const floating=file('src/components/chat/FloatingCustomerChat.tsx')

test('Customer message icon opens conversation history and message composer, not FAQ flow',()=>{
  assert.match(layout,/to="\/app\/conversas" aria-label="Abrir conversa com a equipe"/)
  assert.match(layout,/to="\/app\/conversas" aria-label="Abrir conversa"/)
  assert.match(routes,/<Route path="conversas" element=\{<ConversationsPage \/>\}/)
  assert.match(chat,/conversationsApi\.open\(\)/)
  assert.match(chat,/<ChatComposer key=\{selected\}/)
  assert.match(chat,/<div role="log"/)
  assert.doesNotMatch(chat,/<AutoAttendant /)
  assert.doesNotMatch(chat,/humanMode/)
})
test('Help gets its own customer route and question-mark navigation in desktop and mobile',()=>{
  assert.match(routes,/<Route path="ajuda" element=\{<HelpPage \/>\}/)
  assert.match(layout,/to="\/app\/ajuda" aria-label="Central de Ajuda"/)
  assert.match(layout,/to="\/app\/ajuda" aria-label="Ajuda e dúvidas frequentes"/)
  assert.match(layout,/label: 'Ajuda', href: '\/app\/ajuda'/)
  assert.match(help,/<AutoAttendant initialFlow="faq"/)
  assert.match(auto,/initialFlow='home'/)
})
test('Help handoff reuses the authenticated conversation and preserves old messages',()=>{
  assert.match(help,/conversationsApi\.open\(\)/)
  assert.match(help,/conversationsApi\.send\(conversationId,user\.id,summary,crypto\.randomUUID\(\)\)/)
  assert.match(help,/navigate\('\/app\/conversas'\)/)
  assert.match(auto,/setHandoffError/)
  assert.match(help,/setError/)
})
test('Direct conversations allow sending both texts and attachments on full-page and floating chat',()=>{
  assert.match(chat,/conversationsApi\.upload\(selected, user\.id, id, file\)/)
  assert.match(chat,/conversationsApi\.send\(selected, user\.id, content, id, attachment\)/)
  assert.match(composer,/input type="file"|type="file"/)
  assert.match(composer,/onSend/)
  assert.match(floating,/<SupportChat compact\/>/)
})
