// Administrative preview only. No network, cron or WhatsApp side effects.
export const SAGA_ADMIN_ZONE = 'America/Sao_Paulo';
export const SAGA_ADMIN_SLOTS = Object.freeze([7,13,19]);
const allowedSources=new Set(['profiles','tasks','task_checklist_items','project_stages','academy_work_purchases','academy_library_grants']);

export function sagaZonedParts(value) {
  const instant=new Date(value);
  if(!Number.isFinite(instant.getTime())) throw new TypeError('Invalid timestamp');
  const p=Object.fromEntries(new Intl.DateTimeFormat('en-US',{
    timeZone:SAGA_ADMIN_ZONE,hourCycle:'h23',year:'numeric',month:'2-digit',
    day:'2-digit',hour:'2-digit',minute:'2-digit'
  }).formatToParts(instant).filter(x=>x.type!=='literal').map(x=>[x.type,x.value]));
  return {day:`${p.year}-${p.month}-${p.day}`, minute: Number(p.hour)*60+Number(p.minute)};
}

function previousDay(day){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(day)) throw new TypeError('Invalid local day');
  const date=new Date(day+'T00:00:00Z');
  if(!Number.isFinite(date.getTime())||date.toISOString().slice(0,10)!==day) throw new TypeError('Invalid local day');
  return new Date(date.getTime()-86400000).toISOString().slice(0,10);
}
const str=(value,max)=>String(value??'').trim().slice(0,max);

// All events have already been read under ADMIN-ONLY RLS. Never reuse this
// preview for clients or as an authorization resolver for WhatsApp.
export function buildSagaInternalPreview({events,day,slot,now}){
  if(!Array.isArray(events)||!SAGA_ADMIN_SLOTS.includes(slot)) throw new TypeError('Invalid preview parameters');
  const prev=previousDay(day);
  const nowTime=new Date(now);
  if(!Number.isFinite(nowTime.getTime())) throw new TypeError('Invalid snapshot');
  const seen=new Set();
  const selected=[];
  for(const event of events){
    if(!event || typeof event.id!=='string' || seen.has(event.id) ||
       !allowedSources.has(event.source_table)||event.event_type==='daily_digest') continue;
    let p;
    try {
      const eventTime=new Date(event.created_at);
      if(!Number.isFinite(eventTime.getTime())||eventTime>nowTime) continue;
      p=sagaZonedParts(eventTime);
    }catch{continue;}
    const included=slot===7 ?
      (p.day===prev && p.minute>=1140) || (p.day===day && p.minute<420)
      : slot===13 ? p.day===day && p.minute>=420 && p.minute<780
      : p.day===day && p.minute>=780 && p.minute<1140;
    if(!included)continue;
    seen.add(event.id);
    selected.push(event);
  }
  selected.sort((a,b)=>String(a.created_at).localeCompare(String(b.created_at))||a.id.localeCompare(b.id));
  const label=slot===7?'Planejamento':slot===13?'Acompanhamento':'Fechamento';
  const visible=selected.slice(-30);
  return {
    key:`saga:internal-preview:${day}:${String(slot).padStart(2,'0')}`,
    label,count:selected.length,omitted:Math.max(0,selected.length-visible.length),
    title:`Saga | ${label} — ${day}`,
    lines:visible.map(e=>`• ${str(e.title,100)}: ${str(e.message,200)}`)
  };
}
