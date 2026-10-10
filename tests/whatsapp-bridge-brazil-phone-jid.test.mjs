import assert from 'node:assert/strict'
import test from 'node:test'
import {pnFromJid,matchesAuthorizedBrazilPhone,resolveAuthorizedAccount}
 from '../services/whatsapp-bridge/phone-utils.mjs'

const expected='5564981294186'
const legacy='556481294186'

test('phone JIDs may use the legacy eight-digit Brazilian subscriber number',()=>{
  assert.equal(matchesAuthorizedBrazilPhone(expected,expected),true)
  assert.equal(matchesAuthorizedBrazilPhone(legacy,expected),true)
  assert.deepEqual(resolveAuthorizedAccount(expected,legacy+':2@s.whatsapp.net'),{
    authorizedPhone:expected,observedPhone:legacy,pnJid:legacy+'@s.whatsapp.net'
  })
  assert.deepEqual(resolveAuthorizedAccount(expected,expected+'@s.whatsapp.net'),{
    authorizedPhone:expected,observedPhone:expected,pnJid:expected+'@s.whatsapp.net'
  })
})
test('reject different DDD, subscriber, country, and unexpected extra digit',()=>{
  for(const value of [
    '556581294186',
    '556481294187',
    '5564981294187',
    '557481294186',
    '556487294186',
    '55649812941860',
    '55648129418',
    '1564981294186',
    '5511981294186'
  ]){
    assert.equal(matchesAuthorizedBrazilPhone(value,expected),false,value)
  }
  assert.equal(matchesAuthorizedBrazilPhone(legacy,'556481294186'),false,'Expected phone must use full authorized canonical form')
})
test('LID and group JIDs cannot be used as phone number identities',()=>{
  assert.equal(pnFromJid('556481294186@lid'),null)
  assert.equal(pnFromJid('556481294186@g.us'),null)
  assert.equal(pnFromJid('556481294186@s.whatsapp.net'),legacy)
  assert.equal(pnFromJid('556481294186:4@s.whatsapp.net'),legacy)
  assert.equal(pnFromJid('evil556481294186@s.whatsapp.net'),null)
  assert.equal(resolveAuthorizedAccount(expected,'1234567890@lid','12345@g.us'),null)
  assert.equal(resolveAuthorizedAccount(expected,'1234567890@lid',legacy+'@s.whatsapp.net')?.authorizedPhone,expected)
})
