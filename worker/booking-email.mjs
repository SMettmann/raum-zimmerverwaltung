const TIMED_ROOM_TYPES=new Set(['Seminarraum','Besprechungsraum','Veranstaltungsraum']);
const RESEND_ENDPOINT='https://api.resend.com/emails';

export function confirmationCandidates(beforeState={},afterState={}){
  const before=new Map((Array.isArray(beforeState.bookings)?beforeState.bookings:[]).map(b=>[b.id,b]));
  return (Array.isArray(afterState.bookings)?afterState.bookings:[]).filter(b=>{
    if(!b?.id||b.status!=='confirmed')return false;
    const previous=before.get(b.id);
    return !previous||previous.status!=='confirmed';
  });
}

export function bookingRecipient(state={},booking={}){
  const direct=String(booking.email||booking.guestEmail||'').trim().toLowerCase();
  if(validEmail(direct))return direct;
  const guestName=String(booking.guest||'').trim().toLowerCase();
  const guests=Array.isArray(state.guests)?state.guests:[];
  const guest=guests.find(g=>String(g.name||'').trim().toLowerCase()===guestName);
  const email=String(guest?.email||'').trim().toLowerCase();
  return validEmail(email)?email:'';
}

export function bookingPeriodText(state={},booking={}){
  const room=(Array.isArray(state.rooms)?state.rooms:[]).find(r=>r.id===booking.roomId);
  const timed=TIMED_ROOM_TYPES.has(String(room?.type||''))&&validTime(booking.fromTime)&&validTime(booking.toTime);
  const from=formatDate(booking.from),to=formatDate(booking.to);
  if(timed&&booking.from===booking.to)return `${from}, ${booking.fromTime}–${booking.toTime} Uhr`;
  if(timed)return `${from}, ${booking.fromTime} Uhr – ${to}, ${booking.toTime} Uhr`;
  return booking.from===booking.to?from:`${from} – ${to}`;
}

export function buildBookingConfirmation({state={},booking={},organizationName=''}){
  const room=(Array.isArray(state.rooms)?state.rooms:[]).find(r=>r.id===booking.roomId);
  const settings=state.settings&&typeof state.settings==='object'?state.settings:{};
  const org=String(organizationName||settings.org||'Ihre Einrichtung').trim();
  const guest=String(booking.guest||'Guten Tag').trim();
  const roomName=String(room?.name||'Raum / Zimmer').trim();
  const period=bookingPeriodText(state,booking);
  const purpose=String(booking.purpose||'').trim();
  const participants=Number(booking.participants)||0;
  const contact=[settings.email,settings.phone].filter(Boolean).join(' · ');
  const subject=`Buchungsbestätigung – ${roomName}`;
  const details=[
    `Raum / Zimmer: ${roomName}`,
    `Zeitraum: ${period}`,
    purpose?`Zweck / Veranstaltung: ${purpose}`:'',
    participants?`Teilnehmerzahl: ${participants}`:''
  ].filter(Boolean);
  const text=[
    `Guten Tag ${guest},`,
    '',
    `Ihre Buchung bei ${org} wurde bestätigt.`,
    '',
    ...details,
    '',
    contact?`Bei Rückfragen: ${contact}`:'',
    '',
    `Freundliche Grüße`,
    org
  ].filter((line,index,array)=>line!==''||array[index-1]!=='').join('\n').trim();
  const detailHtml=details.map(line=>{const [label,...rest]=line.split(': ');return `<tr><td style="padding:7px 12px 7px 0;color:#667085;vertical-align:top">${htmlEsc(label)}</td><td style="padding:7px 0;font-weight:600">${htmlEsc(rest.join(': '))}</td></tr>`}).join('');
  const html=`<!doctype html><html><body style="margin:0;background:#f5f7fb;font-family:Arial,sans-serif;color:#172033"><div style="max-width:640px;margin:0 auto;padding:28px 16px"><div style="background:#fff;border:1px solid #e3e8f0;border-radius:16px;padding:28px"><div style="font-size:12px;font-weight:700;color:#667085;margin-bottom:8px">BUCHUNGSBESTÄTIGUNG</div><h1 style="font-size:22px;margin:0 0 20px">${htmlEsc(org)}</h1><p>Guten Tag ${htmlEsc(guest)},</p><p>Ihre Buchung wurde bestätigt.</p><table style="width:100%;border-collapse:collapse;margin:22px 0">${detailHtml}</table>${contact?`<p style="color:#667085;font-size:14px">Bei Rückfragen: ${htmlEsc(contact)}</p>`:''}<p style="margin-top:26px">Freundliche Grüße<br><strong>${htmlEsc(org)}</strong></p></div></div></body></html>`;
  return {subject,text,html,replyTo:validEmail(String(settings.email||'').trim())?String(settings.email).trim():''};
}

export async function sendBookingConfirmationOnce(env,{orgId,organizationName,state,bookingId}){
  if(state?.settings?.automaticBookingEmails===false)return {status:'disabled'};
  if(!env?.RESEND_API_KEY||!env?.TRANSACTIONAL_FROM_EMAIL)return {status:'not_configured'};
  const booking=(Array.isArray(state?.bookings)?state.bookings:[]).find(b=>b.id===bookingId);
  if(!booking||booking.status!=='confirmed')return {status:'not_confirmed'};
  const recipient=bookingRecipient(state,booking);
  if(!recipient)return {status:'no_recipient'};
  const eventKey=`booking-confirmation/${String(orgId||'org')}/${String(booking.id)}`.slice(0,256);
  const existing=await env.DB.prepare('SELECT status FROM email_log WHERE event_key=?').bind(eventKey).first();
  if(existing?.status==='sent')return {status:'already_sent'};

  const mail=buildBookingConfirmation({state,booking,organizationName});
  const fromAddress=String(env.TRANSACTIONAL_FROM_EMAIL).trim();
  if(!validEmail(fromAddress))return {status:'invalid_sender'};
  const displayName=safeDisplayName(organizationName||state?.settings?.org||'RAUMWERK');
  const payload={from:`${displayName} <${fromAddress}>`,to:[recipient],subject:mail.subject,html:mail.html,text:mail.text};
  if(mail.replyTo)payload.reply_to=mail.replyTo;

  let providerId='',error='';
  try{
    const response=await fetch(RESEND_ENDPOINT,{method:'POST',headers:{'Authorization':`Bearer ${env.RESEND_API_KEY}`,'Content-Type':'application/json','Idempotency-Key':eventKey},body:JSON.stringify(payload)});
    const data=await safeResponseJson(response);
    if(!response.ok)throw new Error(String(data?.message||data?.error||`E-Mail-Versand fehlgeschlagen (${response.status})`).slice(0,500));
    providerId=String(data?.id||'');
    await writeEmailLog(env,{eventKey,orgId,bookingId:booking.id,recipient,status:'sent',providerId,error:''});
    return {status:'sent',providerId,recipient};
  }catch(e){
    error=String(e?.message||e||'Unbekannter E-Mail-Fehler').slice(0,500);
    try{await writeEmailLog(env,{eventKey,orgId,bookingId:booking.id,recipient,status:'failed',providerId,error})}catch(logError){console.error('booking_email_log_error',logError)}
    console.error('booking_email_send_error',error);
    return {status:'failed',error};
  }
}

async function writeEmailLog(env,{eventKey,orgId,bookingId,recipient,status,providerId,error}){
  const now=new Date().toISOString();
  await env.DB.prepare(`INSERT INTO email_log (event_key,org_id,booking_id,recipient,status,provider_id,error,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?) ON CONFLICT(event_key) DO UPDATE SET recipient=excluded.recipient,status=excluded.status,provider_id=excluded.provider_id,error=excluded.error,updated_at=excluded.updated_at`).bind(eventKey,orgId,bookingId,recipient,status,providerId||null,error||null,now,now).run();
}

function validEmail(value){return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value||''))}
function validTime(value){return /^([01]\d|2[0-3]):[0-5]\d$/.test(String(value||''))}
function formatDate(value){const m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value||''));return m?`${m[3]}.${m[2]}.${m[1]}`:String(value||'–')}
function safeDisplayName(value){return String(value||'RAUMWERK').replace(/[\r\n<>]/g,' ').replace(/\s+/g,' ').trim().slice(0,100)||'RAUMWERK'}
function htmlEsc(value){return String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
async function safeResponseJson(response){try{return await response.json()}catch{return {}}}
