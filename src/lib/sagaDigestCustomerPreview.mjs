// Read-only composition with per-event backend authorization. NEVER call from client.
import { prepareSagaDigestDrafts } from './sagaDigestDrafts.mjs';
import { createSagaStageEventAuthorization } from './sagaDigestRecipientPolicy.mjs';

export async function prepareAuthorizedSagaCustomerPreviews({
  at, settings, recipientIds, events, db
}) {
  // No implicit opt-in for a missing schedule/preview flag.
  if (!db || typeof db.from!=='function') return {status:'db_unavailable',drafts:[]};
  if (settings?.enabled!==true||settings?.preview_enabled!==true||
      settings?.dispatch_enabled!==false) return {status:'disabled',drafts:[]};
  const authorizedEvent=createSagaStageEventAuthorization(db);
  return prepareSagaDigestDrafts({
    at,settings,recipientIds,events,
    // recipient authorization happens per-event below; no broad access grant.
    // The strict per-event resolver checks active customer, opt-in and project.
    resolveRecipientAuthorization:async(recipientId)=>
      typeof recipientId==='string' && /^[0-9a-f-]{36}$/i.test(recipientId),
    resolveEventAuthorization:authorizedEvent
  });
}
