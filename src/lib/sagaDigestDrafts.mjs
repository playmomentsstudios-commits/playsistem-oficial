// An intentionally side-effect-free orchestration boundary for staged Saga previews.
// The authorization resolver and storage are injected by the trusted backend ONLY.
// Never fall back to all clients, project members or test phone numbers.
import { buildSagaDigestPreview, sagaDueSlot } from './sagaDigestPreview.mjs';

export async function prepareSagaDigestDrafts({
  at, settings, recipientIds, events, resolveRecipientAuthorization, resolveEventAuthorization
}) {
  // Double kill-switch. Even preview drafting is off unless specifically enabled
  // by a controlled homologation caller. dispatch_enabled never implies preview.
  if (settings?.enabled !== true || settings?.preview_enabled !== true) {
    return { status:'disabled', drafts:[] };
  }
  if (settings.dispatch_enabled !== false) {
    return { status:'unsafe_dispatch_flag', drafts:[] };
  }
  const slot=sagaDueSlot(at);
  if(slot===null) return {status:'not_due',drafts:[]};
  if(!Array.isArray(recipientIds)||!Array.isArray(events)||
     typeof resolveRecipientAuthorization!=='function'||
     typeof resolveEventAuthorization!=='function'){
    return {status:'missing_authorization_resolver',drafts:[]};
  }
  const drafts=[];
  for(const recipientId of new Set(recipientIds)){
    // Reject on resolver error. Never turn a partial error into a permission.
    let recipientAllowed=false;
    try {recipientAllowed=(await resolveRecipientAuthorization(recipientId,at))===true;}
    catch {continue;}
    if(!recipientAllowed) continue;
    const audience=new Map();
    for(const event of events){
      if(typeof event?.id!=='string') continue;
      try {
        if((await resolveEventAuthorization(event,recipientId,at))===true){
          audience.set(event.id,new Set([recipientId]));
        }
      } catch { /* denied */ }
    }
    const draft=buildSagaDigestPreview({
      at,recipientId,events,eventAudience:audience,
      authorizedRecipientIds:new Set([recipientId])
    });
    if(draft) drafts.push(draft);
  }
  return {status:'preview_only',drafts};
}
