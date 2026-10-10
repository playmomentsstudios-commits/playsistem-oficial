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

/**
 * Resolve exactly one WhatsApp-registered individual for the consented phone.
 * The returned PN JID must match the registered number; do not guess one.
 */
export function registeredRecipientJid(expectedPhone,lookupRows){
  if(!/^55\d{2}9\d{8}$/.test(expectedPhone))throw new Error('Telefone brasileiro do cliente inválido para o envio automático.')
  const registered=(Array.isArray(lookupRows)?lookupRows:[])
    .filter(row=>row?.exists===true && typeof row.jid==='string')
    .map(row=>row.jid)
    .filter(jid=>matchesAuthorizedBrazilPhone(pnFromJid(jid),expectedPhone))
    .map(jid=>pnFromJid(jid)+'@s.whatsapp.net')
  const distinct=[...new Set(registered)]
  if(distinct.length!==1)throw new Error(distinct.length===0
    ?'Número não confirmado como conta WhatsApp pela consulta de destinatário. Nenhuma mensagem enviada.'
    :'WhatsApp retornou mais de uma conta possível. Envio bloqueado para evitar destinatário incorreto.')
  return distinct[0]
}
