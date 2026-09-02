import base from './entry.js';
import { consumePublicBookingAttempt } from './public-rate-limit.mjs';
import { isTimedRoomType, roomAvailable, validTimedRange } from './time-booking.mjs';

export default {
  async fetch(request,env,ctx){
    const url=new URL(request.url);
    if(url.pathname==='/api/public/config'||url.pathname==='/api/public/availability'||url.pathname==='/api/public/request'){
      try{return await handlePublicTimed(request,env,url)}
      catch(e){console.error('timed_public_api_error',e);return json({error:'Anfrage konnte nicht verarbeitet werden.'},500)}
    }
    return base.fetch(request,env,ctx);
  }
};

async function loadOrgState(env){
  const row=await env.DB.prepare(`SELECT o.id AS org_id,o.name AS org_name,s.version,s.data FROM organizations o JOIN app_state s ON s.org_id=o.id ORDER BY o.created_at LIMIT 1`).first();
  if(!row)return null;
  let state;try{state=JSON.parse(row.data)}catch{return null}
  return {...row,state};
}
function bookingMode(state){return state.settings?.onlineBookingMode==='direct'?'direct':'request'}
function requestIp(request){return String(request.headers.get('CF-Connecting-IP')||request.headers.get('X-Forwarded-For')||'unknown').split(',')[0].trim().slice(0,80)}
async function writeAudit(env,{orgId,action,details={},ip=''}){if(!orgId||!action)return;await env.DB.prepare('INSERT INTO audit_log (id,org_id,user_id,action,details,ip,created_at) VALUES (?,?,?,?,?,?,?)').bind(crypto.randomUUID(),orgId,null,action,JSON.stringify(details),String(ip||'').slice(0,80),new Date().toISOString()).run()}
function upsertPublicGuest(state,{name,email,phone}){state.guests=Array.isArray(state.guests)?state.guests:[];const lowerEmail=email.toLowerCase(),lowerName=name.toLowerCase();const existing=state.guests.find(g=>(g.email&&String(g.email).toLowerCase()===lowerEmail)||String(g.name||'').toLowerCase()===lowerName);if(existing){existing.name=name;existing.email=email;existing.phone=phone||existing.phone||'';return existing}const guest={id:crypto.randomUUID(),name,email,phone,note:'Online-Buchung'};state.guests.push(guest);return guest}
function addDirectBooking(state,room,data){
  state.bookings=Array.isArray(state.bookings)?state.bookings:[];
  const timed=isTimedRoomType(room.type),id=crypto.randomUUID(),createdAt=new Date().toISOString();
  state.bookings.push({id,roomId:data.roomId,guest:data.name,from:data.from,to:data.to,fromTime:timed?data.fromTime:'',toTime:timed?data.toTime:'',purpose:data.purpose,participants:data.participants,status:'confirmed',note:data.note,createdAt,source:'public-direct'});
  upsertPublicGuest(state,data);
  state.cleaningPlans=Array.isArray(state.cleaningPlans)?state.cleaningPlans:[];
  state.cleaningPlans.push({id:crypto.randomUUID(),bookingId:id,roomId:data.roomId,date:data.to,time:timed?data.toTime:'10:00',owner:'',note:'Automatisch nach Buchungsende',status:'planned',auto:true,source:'booking'});
  return id;
}

async function handlePublicTimed(request,env,url){
  if(request.method!=='GET'&&request.method!=='HEAD'&&!sameOrigin(request,url))return json({error:'Ungültiger Ursprung.'},403);
  const data=await loadOrgState(env);if(!data)return json({error:'RAUMSUITE ist noch nicht eingerichtet.'},503);

  if(url.pathname==='/api/public/config'&&request.method==='GET'){
    return json({organization:data.org_name,mode:bookingMode(data.state),rooms:(data.state.rooms||[]).map(r=>({id:r.id,name:r.name,type:r.type,capacity:r.capacity||1,note:r.note||'',location:r.location||'',timed:isTimedRoomType(r.type)}))});
  }

  if(url.pathname==='/api/public/availability'&&request.method==='POST'){
    const b=await body(request),from=date(b.from),to=date(b.to),fromTime=time(b.fromTime),toTime=time(b.toTime);
    if(!from||!to||to<from)return json({error:'Bitte einen gültigen Zeitraum wählen.'},400);
    const range={from,to,fromTime,toTime};
    return json({rooms:(data.state.rooms||[]).filter(room=>roomAvailable(data.state,room,range)).map(room=>room.id)});
  }

  if(url.pathname==='/api/public/request'&&request.method==='POST'){
    const limit=await consumePublicBookingAttempt(env,request);
    if(!limit.allowed)return json({error:'Zu viele Buchungsanfragen in kurzer Zeit. Bitte später erneut versuchen.',code:'PUBLIC_RATE_LIMIT'},429,{'Retry-After':String(limit.retryAfterSeconds)});
    const b=await body(request);if(b.website)return json({ok:true},202);
    const name=text(b.name,120),email=text(b.email,180),phone=text(b.phone,80),roomId=text(b.roomId,100),from=date(b.from),to=date(b.to),fromTime=time(b.fromTime),toTime=time(b.toTime),purpose=text(b.purpose,180),note=text(b.note,600),participants=Math.max(1,Math.min(999,Number(b.participants)||1));
    if(!name||!email||!roomId||!from||!to||to<from)return json({error:'Bitte alle Pflichtfelder ausfüllen.'},400);
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return json({error:'Bitte eine gültige E-Mail-Adresse angeben.'},400);
    const room=(data.state.rooms||[]).find(r=>r.id===roomId);if(!room)return json({error:'Raum nicht gefunden.'},404);
    const range={from,to,fromTime,toTime};
    if(isTimedRoomType(room.type)&&!validTimedRange(room,range))return json({error:'Bitte für diesen Seminar-/Veranstaltungsraum eine gültige Von- und Bis-Uhrzeit angeben.'},400);
    if(participants>Number(room.capacity||1))return json({error:'Die Teilnehmerzahl überschreitet die Kapazität des gewählten Raums.'},400);
    if(!roomAvailable(data.state,room,range))return json({error:'Der gewünschte Zeitraum ist inzwischen nicht mehr verfügbar.'},409);

    for(let attempt=0;attempt<3;attempt++){
      const fresh=attempt?await loadOrgState(env):data;if(!fresh)return json({error:'Daten nicht verfügbar.'},503);
      const freshRoom=(fresh.state.rooms||[]).find(r=>r.id===roomId);if(!freshRoom)return json({error:'Raum nicht gefunden.'},404);
      if(!roomAvailable(fresh.state,freshRoom,range))return json({error:'Der gewünschte Zeitraum ist inzwischen nicht mehr verfügbar.'},409);
      const payload={name,email,phone,roomId,from,to,fromTime:isTimedRoomType(freshRoom.type)?fromTime:'',toTime:isTimedRoomType(freshRoom.type)?toTime:'',purpose,participants,note};
      const mode=bookingMode(fresh.state);
      if(mode==='direct')addDirectBooking(fresh.state,freshRoom,payload);
      else {
        fresh.state.bookingRequests=Array.isArray(fresh.state.bookingRequests)?fresh.state.bookingRequests:[];
        fresh.state.bookingRequests.push({id:crypto.randomUUID(),...payload,status:'new',createdAt:new Date().toISOString(),source:'public'});
      }
      const result=await env.DB.prepare('UPDATE app_state SET data=?,version=version+1,updated_at=? WHERE org_id=? AND version=?').bind(JSON.stringify(fresh.state),new Date().toISOString(),fresh.org_id,fresh.version).run();
      if(Number(result.meta?.changes||0)===1){
        await writeAudit(env,{orgId:fresh.org_id,action:mode==='direct'?'public_booking_direct':'public_booking_request',details:{roomId,from,to,fromTime:payload.fromTime,toTime:payload.toTime},ip:requestIp(request)});
        return mode==='direct'?json({ok:true,mode,message:'Die Buchung wurde verbindlich bestätigt.'},201):json({ok:true,mode,message:'Buchungsanfrage wurde gesendet.'},201);
      }
    }
    return json({error:'Die Daten wurden gleichzeitig geändert. Bitte erneut senden.'},409);
  }

  return json({error:'Nicht gefunden.'},404);
}

function sameOrigin(request,url){const origin=request.headers.get('Origin');return !origin||origin===url.origin}
async function body(request){try{return await request.json()}catch{return {}}}
function text(v,max){return String(v||'').trim().slice(0,max)}
function date(v){const s=String(v||'');return /^\d{4}-\d{2}-\d{2}$/.test(s)?s:''}
function time(v){const s=String(v||'');return /^([01]\d|2[0-3]):[0-5]\d$/.test(s)?s:''}
function json(data,status=200,extraHeaders={}){return new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...extraHeaders}})}