// Trusted backend read-only adapter for Saga's existing INTERNAL admin events.
// Deliberately no client/customer/WhatsApp resolver in this phase.
// The caller supplies an authenticated admin identity and a server-side DB
// interface with access checks; never expose a service-role key to the browser.
import { prepareSagaDigestDrafts } from './sagaDigestDrafts.mjs';

const INTERNAL_SOURCES = new Set([
  'profiles','tasks','task_checklist_items','project_stages',
  'academy_work_purchases','academy_library_grants'
]);
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function previewInternalSagaAdminDigest({at, adminId, db, enabledForPreview = false}) {
  if (!enabledForPreview || !uuid.test(String(adminId ?? ''))) return {status:'disabled',drafts:[]};
  if (!db || typeof db.from !== 'function') return {status:'db_unavailable',drafts:[]};
  try {
    // Profile is checked server-side; callers must not supply profile claims.
    const {data:profile,error:profileError}=await db.from('profiles')
      .select('id,role,status').eq('id',adminId).maybeSingle();
    if (profileError || profile?.role!=='admin' || profile?.status!=='active') {
      return {status:'not_authorized',drafts:[]};
    }
    const {data:rows,error:eventsError}=await db.from('sagamente_assistant_events')
      .select('id,event_type,source_table,title,message,created_at')
      .lte('created_at',new Date(at).toISOString())
      .order('created_at',{ascending:false})
      .limit(250);
    if(eventsError || !Array.isArray(rows)) return {status:'events_unavailable',drafts:[]};
    // Only known internal event types; no raw purchase/customer records are loaded.
    const events=rows.filter(e=>INTERNAL_SOURCES.has(e.source_table))
      .map(e=>({...e,message:String(e.message??'').slice(0,240)}));
    return prepareSagaDigestDrafts({
      at,
      settings:{enabled:true,preview_enabled:true,dispatch_enabled:false},
      recipientIds:[adminId],events,
      resolveRecipientAuthorization:async (recipient)=>recipient===adminId,
      resolveEventAuthorization:async (event,recipient)=>
        recipient===adminId && INTERNAL_SOURCES.has(event.source_table)
    });
  }catch{
    return {status:'error',drafts:[]};
  }
}
