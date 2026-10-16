// Trusted server-only dry-run: reads SINGLE schedule authority and real Saga events.
// It cannot write, enqueue, call WhatsApp, schedule jobs or activate settings.
// No HTTP endpoint is exposed by this module; never import it in a browser bundle.
import { prepareAuthorizedSagaCustomerPreviews } from './sagaDigestCustomerPreview.mjs';
import { sagaDueSlot } from './sagaDigestPreview.mjs';

const SLOTS=['07:00','13:00','19:00'];

export async function previewSagaCustomerDigestsFromDb({
  at, db, recipientIds, dryRunApproved = false
}) {
  if(dryRunApproved!==true) return {status:'approval_required',drafts:[]};
  if(!db || typeof db.from!=='function') return {status:'db_unavailable',drafts:[]};
  if(!Array.isArray(recipientIds)||recipientIds.length>25)
    return {status:'invalid_recipients',drafts:[]};
  let slot;
  try{slot=sagaDueSlot(at);}catch{return {status:'invalid_time',drafts:[]};}
  if(slot===null) return {status:'not_due',drafts:[]};
  try {
    const {data:config,error:configError} = await db.from('sagamente_assistant_settings')
      .select('enabled,whatsapp_notifications,timezone,digest_times')
      .eq('id',true).maybeSingle();
    if(configError || !config) return {status:'settings_unavailable',drafts:[]};

    // Preview ONLY in the safe fully-off state. This is not a live sender.
    // The assistant settings already belong to PR #490 and are the only clock.
    if(config.enabled!==false || config.whatsapp_notifications!==false ||
       config.timezone!=='America/Sao_Paulo' ||
       !Array.isArray(config.digest_times) ||
       config.digest_times.length!==3 ||
       !SLOTS.every(t=>config.digest_times.includes(t))) {
       return {status:'staging_gate_closed',drafts:[]};
    }

    const instant=new Date(at);
    const from=new Date(instant.getTime()-48*3600000).toISOString();
    const {data:events,error:eventError}=await db.from('sagamente_assistant_events')
      .select('id,title,message,created_at,event_type,source_table,source_id')
      .eq('event_type','project_stage_status')
      .gte('created_at',from).lte('created_at',instant.toISOString())
      .order('created_at',{ascending:false}).limit(201);
    if(eventError || !Array.isArray(events))return {status:'events_unavailable',drafts:[]};
    // Fail-closed on truncation; no partial digest of a larger event batch.
    if(events.length>200)return {status:'too_many_events',drafts:[]};
    return await prepareAuthorizedSagaCustomerPreviews({
      at,db,recipientIds,events,settings:{
        enabled:true,preview_enabled:true,dispatch_enabled:false
      }
    });
  }catch{return {status:'error',drafts:[]};}
}
