// Saga digest preview (pure, fail-closed). No side effects, network calls or sends.
// Authorization is deliberately supplied per EVENT by an audited backend resolver.
export const SAGA_DIGEST_TIMEZONE = 'America/Sao_Paulo';
export const SAGA_DIGEST_HOURS = Object.freeze([7, 13, 19]);
const MAX_EVENTS = 30;
const truncate = (s, n) => String(s ?? '').trim().slice(0, n);

export function sagaLocalParts(at) {
  const date = at instanceof Date ? at : new Date(at);
  if (!Number.isFinite(date.getTime())) throw new TypeError('Invalid instant');
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
    timeZone: SAGA_DIGEST_TIMEZONE, hourCycle: 'h23',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit'
  }).formatToParts(date).filter(p => p.type !== 'literal').map(p => [p.type, p.value]));
  return { day: `${parts.year}-${parts.month}-${parts.day}`, hour: Number(parts.hour), minute: Number(parts.minute) };
}

function sagaPreviousDay(day) {
  const parsed = new Date(day + 'T00:00:00Z');
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0,10)!==day)
    throw new TypeError('Invalid local day');
  return new Date(parsed.getTime()-86400000).toISOString().slice(0,10);
}
function inDigestWindow(eventAt, runDay, hour) {
  const p = sagaLocalParts(eventAt);
  const minutes = p.hour*60+p.minute;
  if (hour===7) return (p.day===sagaPreviousDay(runDay) && minutes>=19*60) ||
    (p.day===runDay && minutes<7*60);
  if (hour===13) return p.day===runDay && minutes>=7*60 && minutes<13*60;
  return p.day===runDay && minutes>=13*60 && minutes<19*60;
}

export function sagaDueSlot(at) {
  const p = sagaLocalParts(at);
  return p.minute === 0 && SAGA_DIGEST_HOURS.includes(p.hour) ? p.hour : null;
}

// A missing, empty or forged recipient grant means NO preview.
// eventAudience must come from trusted server-side access/consent checks, not client input.
export function buildSagaDigestPreview({ at, recipientId, events, eventAudience, authorizedRecipientIds }) {
  if (typeof recipientId !== 'string' || !/^[0-9a-f-]{36}$/i.test(recipientId)) return null;
  if (!(authorizedRecipientIds instanceof Set) || !authorizedRecipientIds.has(recipientId)) return null;
  if (!(eventAudience instanceof Map) || !Array.isArray(events)) return null;
  const p = sagaLocalParts(at);
  const hour = sagaDueSlot(at);
  if (hour === null) return null;
  const unique = new Set();
  const relevant = [];
  for (const e of events) {
    if (!e || typeof e.id !== 'string' || unique.has(e.id)) continue;
    if (!e.created_at || !Number.isFinite(new Date(e.created_at).getTime()) ||
        new Date(e.created_at)>new Date(at) || !inDigestWindow(e.created_at,p.day,hour)) continue;
    const grants = eventAudience.get(e.id);
    if (!(grants instanceof Set) || !grants.has(recipientId)) continue;
    unique.add(e.id);
    relevant.push(e);
  }
  relevant.sort((a,b)=>String(a.created_at??'').localeCompare(String(b.created_at??'')) || a.id.localeCompare(b.id));
  const chosen = relevant.slice(-MAX_EVENTS);
  if (chosen.length === 0) return null; // No empty/no-op WhatsApp messages.
  const period = hour === 7 ? 'Planejamento' : hour === 13 ? 'Acompanhamento' : 'Fechamento';
  return Object.freeze({
    key: `saga:digest:${p.day}:${String(hour).padStart(2,'0')}:${recipientId}`,
    slot: hour, localDay: p.day, recipientId,
    eventIds: chosen.map(e => e.id),
    title: `Saga | ${period} — ${p.day}`,
    message: [`Saga | ${period} — ${p.day}`, ...chosen.map(e => `• ${truncate(e.title,120)}: ${truncate(e.message,240)}`)].join('\n')
  });
}
