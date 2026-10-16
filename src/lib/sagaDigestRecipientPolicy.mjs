// Staged server-only authorization for Saga customer DIGEST PREVIEWS.
// No credentials, outgoing messages, cron or write operations.
// THIS IS NOT AN AUTHORIZATION TO SEND. Consent/eligibility must be rechecked
// by the final bridge claim at delivery time before activating any dispatch.
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const phone=(value)=>String(value??'').replace(/[^0-9]/g,'');
const load=async(db,table,fields,filters)=>{
  let query=db.from(table).select(fields);
  for(const [name,value] of Object.entries(filters)) query=query.eq(name,value);
  const {data,error}=await query.maybeSingle();
  return error ? null : data;
};

// Fail closed until provenance, current access AND WhatsApp consent are verified.
// Only client-visible, non-internal project STAGE status events are supported.
// Other event types require a separately reviewed, business-specific resolver.
export async function isAuthorizedSagaStageRecipient({db,eventId,recipientId}){
  if(!db || typeof db.from!=='function'||!uuid.test(String(eventId))||!uuid.test(String(recipientId))) return false;
  try{
    const event=await load(db,'sagamente_assistant_events',
      'id,event_type,source_table,source_id',{id:eventId});
    if(event?.event_type!=='project_stage_status'||
       event?.source_table!=='project_stages'||!uuid.test(String(event.source_id)))return false;
    const recipient=await load(db,'profiles','id,role,status,phone',{id:recipientId});
    if(recipient?.role!=='customer'||recipient?.status!=='active')return false;
    const pref=await load(db,'user_preferences',
      'user_id,wa_automatic_opt_in,wa_opt_in_phone,wa_opt_in_at,notify_project_updates',
      {user_id:recipientId});
    if(pref?.wa_automatic_opt_in!==true||pref?.notify_project_updates!==true||
       !pref?.wa_opt_in_at||!/^55[0-9]{10,11}$/.test(phone(pref.wa_opt_in_phone)))return false;
    const registered=phone(recipient.phone);
    const registeredE164=registered.startsWith('55')?registered:'55'+registered;
    if(registeredE164!==phone(pref.wa_opt_in_phone))return false;
    const stage=await load(db,'project_stages','id,project_id,client_visible',{id:event.source_id});
    if(!stage||!uuid.test(String(stage.project_id))||stage.client_visible!==true)return false;
    const project=await load(db,'projects','id,customer_id,project_type',{id:stage.project_id});
    if(!project||!project.project_type||project.project_type==='internal')return false;
    if(project.customer_id===recipientId)return true;
    const grant=await load(db,'project_customer_access','project_id,customer_id',
      {project_id:stage.project_id,customer_id:recipientId});
    return Boolean(grant);
  }catch{return false;}
}

export function createSagaStageEventAuthorization(db){
  return async (event,recipientId)=>Boolean(event?.id)&&
    isAuthorizedSagaStageRecipient({db,eventId:event.id,recipientId});
}
