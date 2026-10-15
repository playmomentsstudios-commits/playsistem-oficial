/** Minimal preflight for email/password registration before the last wizard step. */
export function normalizeSignupEmail(value:string):string {
  // Remove invisible characters introduced by copying from chat or messaging apps.
  // Leave case and all visible local-part characters unchanged.
  return value.trim().replace(/[\u200B-\u200D\uFEFF]/g,'')
}

export function isValidSignupEmail(value:string):boolean {
  const email=normalizeSignupEmail(value)
  if(email.length<6 || email.length>254 || /\s/.test(email))return false
  const parts=email.split('@')
  if(parts.length!==2)return false
  const [local,domain]=parts
  if(!local||local.length>64||local.startsWith('.')||local.endsWith('.')||local.includes('..'))return false
  if(!/^[a-zA-Z0-9.!#$%&'*+/=?^`{|}~-]+$/.test(local))return false
  const labels=domain.split('.')
  if(labels.length<2 || labels[labels.length-1].length<2)return false
  if(!labels.every(label=>label.length<=63&&/^[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?$/.test(label)))return false
  return true
}

export function isServerEmailFormatError(error:unknown):boolean {
  const message=error instanceof Error?error.message:String(error??'')
  return /unable to validate email address|invalid email|email.*invalid format|email_address_invalid/i.test(message)
}

export const EMAIL_FORMAT_HINT='Confira o e-mail. Use um endereço válido, como nome@exemplo.com, sem espaços.'
