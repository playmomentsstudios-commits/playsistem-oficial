/**
 * Brazil: the WhatsApp Phone Number (PN) JID can omit the mobile ninth digit.
 * Never accept a different DDD, country code, or subscriber number.
 * LID JIDs are opaque identifiers, NOT phone numbers.
 */
export function pnFromJid(value){
  if(typeof value!=='string')return null
  const match=/^(55\d{10,11})(?::\d+)?@(s\.whatsapp\.net|c\.us)$/i.exec(value)
  return match?match[1]:null
}
export function matchesAuthorizedBrazilPhone(observed,expected){
  if(typeof observed!=='string'||typeof expected!=='string')return false
  if(!/^55\d{2}9\d{8}$/.test(expected))return false
  if(observed===expected)return true
  // Legacy PN JID: 55 + DDD + eight local digits (without the mobile prefix 9).
  return /^55\d{10}$/.test(observed)
    && observed.slice(0,4)===expected.slice(0,4)
    && observed.slice(4)===expected.slice(5)
}
export function resolveAuthorizedAccount(expected,...jidCandidates){
  for(const jid of jidCandidates){
    const observed=pnFromJid(jid)
    if(observed&&matchesAuthorizedBrazilPhone(observed,expected)){
      const pnJid=observed+'@s.whatsapp.net'
      return {authorizedPhone:expected, observedPhone:observed, pnJid}
    }
  }
  return null
}
