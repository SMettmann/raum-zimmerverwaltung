import app from './index.js';
import { canWriteExtendedState } from './state-permissions.mjs';

const LOGIN_MAX_ATTEMPTS=8;
const LOGIN_WINDOW_MS=15*60*1000;
const LOGIN_BLOCK_MS=15*60*1000;
const AUDIT_FIELDS=['rooms','bookings','guests','tasks','settings','cleaningPlans','shifts','blocks','contracts','invoices','bookingRequests','billing'];

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname.startsWith('/api/public/')) {
      try { return await handlePublic(request, env, url); }
      catch (e) { console.error('public_api_error', e); return json({error:'Anfrage konnte nicht verarbeitet werden.'},500); }
    }
    if(url.pathname==='/api/login'&&request.method==='POST'){
      try{return await handleProtectedLogin(request,env,ctx)}
      catch(e){console.error('login_protection_error',e);return json({error:'Anmeldung konnte nicht verarbeitet werden.'},500)}
    }
    if(url.pathname==='/api/audit'&&request.method==='GET'){
      try{return await handleAuditList(request,env)}
      catch(e){console.error('audit_list_error',e);return json({error:'Änderungsprotokoll konnte nicht geladen werden.'},500)}
    }
    if(url.pathname==='/api/state'&&request.method==='PUT'){
      try{
        const inspection=await inspectStateWrite(request,env);
        if(inspection.denied)return inspection.denied;
        const response=await app.fetch(request,env,ctx);
        if(response.ok&&inspection.user&&inspection.before&&inspection.after){
          const fields=changedTopLevel(inspection.before,inspection.after);
          if(fields.length)ctx.waitUntil(writeAudit(env,{orgId:inspection.user.org_id,userId:inspection.user.id,action:'state_update',details:{fields,version:inspection.version},ip:requestIp(request)}));
        }
        return response;
      }catch(e){console.error('extended_permission_error',e);return json({error:'Berechtigung konnte nicht geprüft werden.'},500)}
    }
    if((url.pathname==='/api/users'&&request.method==='POST')||(/^\/api\/users\/[^/]+$/.test(url.pathname)&&request.method==='PATCH')){
      const actor=await userFromSession(request,env);
      const response=await app.fetch(request,env,ctx);
      if(response.ok&&actor)ctx.waitUntil(writeAudit(env,{orgId:actor.org_id,userId:actor.id,action:request.method==='POST'?'user_created':'user_updated',details:{target:url.pathname},ip:requestIp(request)}));
      return response;
    }
    return app.fetch(request, env, ctx);
  }
};

async function handleProtectedLogin(request,env,ctx){
  let submitted={};try{submitted=await request.clone().json()}catch{}
  const email=String(submitted.email||'').trim().toLowerCase().slice(0,180);
  const key=await sha256(requestIp(request)+'|'+email);
  const now=new Date();
  const row=await env.DB.prepare('SELECT attempts,window_started_at,blocked_until FROM login_attempts WHERE attempt_key=?').bind(key).first();
  if(row?.blocked_until&&row.blocked_until>now.toISOString()){
    const seconds=Math.max(1,Math.ceil((new Date(row.blocked_until).getTime()-now.getTime())/1000));
    return json({error:'Zu viele fehlgeschlagene Anmeldeversuche. Bitte später erneut versuchen.'},429,{'Retry-After':String(seconds)});
  }
  const response=await app.fetch(request,env,ctx);
  if(response.status===401){
    const blockedUntil=await recordFailedLogin(env,key,row,now);
    if(blockedUntil)return json({error:'Zu viele fehlgeschlagene Anmeldeversuche. Bitte später erneut versuchen.'},429,{'Retry-After':String(Math.ceil(LOGIN_BLOCK_MS/1000))});
  }else if(response.ok){
    await env.DB.prepare('DELETE FROM login_attempts WHERE attempt_key=?').bind(key).run();
    try{
      const data=await response.clone().json();
      if(data?.user?.id&&data?.organization?.id)ctx.waitUntil(writeAudit(env,{orgId:data.organization.id,userId:data.user.id,action:'login_success',details:{},ip:requestIp(request)}));
    }catch{}
  }
  return response;
}

async function recordFailedLogin(env,key,row,now){
  const nowIso=now.toISOString();
  const windowExpired=!row?.window_started_at||(now.getTime()-new Date(row.window_started_at).getTime())>LOGIN_WINDOW_MS;
  const attempts=windowExpired?1:Number(row?.attempts||0)+1;
  const windowStarted=windowExpired?nowIso:row.window_started_at;
  const blockedUntil=attempts>=LOGIN_MAX_ATTEMPTS?new Date(now.getTime()+LOGIN_BLOCK_MS).toISOString():null;
  await env.DB.prepare(`INSERT INTO login_attempts (attempt_key,attempts,window_started_at,blocked_until) VALUES (?,?,?,?) ON CONFLICT(attempt_key) DO UPDATE SET attempts=excluded.attempts,window_started_at=excluded.window_started_at,blocked_until=excluded.blocked_until`).bind(key,attempts,windowStarted,blockedUntil).run();
  const cleanupBefore=new Date(now.getTime()-24*60*60*1000).toISOString();
  await env.DB.prepare('DELETE FROM login_attempts WHERE window_started_at<?').bind(cleanupBefore).run();
  return blockedUntil;
}

async function inspectStateWrite(request,env){
  const user=await userFromSession(request,env);if(!user)return {};
  let payload;try{payload=await request.clone().json()}catch{return {user}};
  if(!payload?.state)return {user};
  const current=await env.DB.prepare('SELECT data FROM app_state WHERE org_id=?').bind(user.org_id).first();
  if(!current)return {user};
  let before;try{before=JSON.parse(current.data)}catch{return {denied:json({error:'Aktueller Datenstand ist ungültig.'},500)}}
  if(user.role==='viewer')return {denied:json({error:'Für diese Änderung fehlen die Rechte.'},403)};
  if(!['admin','manager'].includes(user.role)&&!canWriteExtendedState(user.role,before,payload.state))return {denied:json({error:'Für diese Änderung fehlen die Rechte.'},403)};
  return {user,before,after:payload.state,version:payload.version};
}

async function handleAuditList(request,env){
  const user=await userFromSession(request,env);if(!user)return json({error:'Nicht angemeldet.'},401);
  if(!['admin','manager'].includes(user.role))return json({error:'Keine Berechtigung.'},403);
  const result=await env.DB.prepare(`SELECT a.id,a.action,a.details,a.ip,a.created_at,u.name AS user_name FROM audit_log a LEFT JOIN users u ON u.id=a.user_id WHERE a.org_id=? ORDER BY a.created_at DESC LIMIT 100`).bind(user.org_id).all();
  return json({entries:(result.results||[]).map(row=>({...row,details:safeJson(row.details,{})}))});
}

async function writeAudit(env,{orgId,userId=null,action,details={},ip=''}){
  if(!orgId||!action)return;
  await env.DB.prepare('INSERT INTO audit_log (id,org_id,user_id,action,details,ip,created_at) VALUES (?,?,?,?,?,?,?)').bind(crypto.randomUUID(),orgId,userId,action,JSON.stringify(details),String(ip||'').slice(0,80),new Date().toISOString()).run();
}
function changedTopLevel(before,after){return AUDIT_FIELDS.filter(field=>stable(normalizeAudit(before,field))!==stable(normalizeAudit(after,field)))}
function normalizeAudit(state,field){
  if(['cleaningPlans','shifts','blocks','contracts','invoices','bookingRequests'].includes(field))return Array.isArray(state?.[field])?state[field]:[];
  if(field==='billing')return state?.billing&&typeof state.billing==='object'?state.billing:{};
  return state?.[field];
}
function stable(value){
  if(Array.isArray(value))return '['+value.map(stable).join(',')+']';
  if(value&&typeof value==='object')return '{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+stable(value[k])).join(',')+'}';
  return JSON.stringify(value);
}
function safeJson(value,fallback){try{return JSON.parse(value)}catch{return fallback}}
function requestIp(request){return String(request.headers.get('CF-Connecting-IP')||request.headers.get('X-Forwarded-For')||'unknown').split(',')[0].trim().slice(0,80)}

async function userFromSession(request,env){
  const token=getCookie(request,'raumwerk_session');if(!token)return null;
  const tokenHash=await sha256(token);
  const row=await env.DB.prepare(`SELECT u.id,u.org_id,u.role,u.active,s.expires_at FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=?`).bind(tokenHash).first();
  if(!row||!row.active||row.expires_at<=new Date().toISOString())return null;
  return row;
}
function getCookie(request,name){
  const cookies=request.headers.get('Cookie')||'';
  for(const part of cookies.split(';')){const [key,...rest]=part.trim().split('=');if(key===name)return rest.join('=')}
  return '';
}
async function sha256(value){
  const bytes=new TextEncoder().encode(value);
  const hash=new Uint8Array(await crypto.subtle.digest('SHA-256',bytes));
  return [...hash].map(b=>b.toString(16).padStart(2,'0')).join('');
}

async function loadOrgState(env){
  const row=await env.DB.prepare(`SELECT o.id AS org_id,o.name AS org_name,s.version,s.data FROM organizations o JOIN app_state s ON s.org_id=o.id ORDER BY o.created_at LIMIT 1`).first();
  if(!row)return null;
  let state;try{state=JSON.parse(row.data)}catch{return null}
  return {...row,state};
}
function overlap(aFrom,aTo,bFrom,bTo){return aFrom<=bTo&&aTo>=bFrom}
function rentalAllowed(state,roomId,from,to){
  const periods=Array.isArray(state.settings?.rentalPeriods)?state.settings.rentalPeriods:[];
  const scoped=periods.filter(p=>p.roomId==='*'||p.roomId===roomId);
  return !scoped.length||scoped.some(p=>p.from<=from&&p.to>=to);
}
function available(state,roomId,from,to){
  const booked=(state.bookings||[]).some(b=>b.roomId===roomId&&b.status!=='cancelled'&&overlap(from,to,b.from,b.to));
  const blocked=(state.blocks||[]).some(b=>b.roomId===roomId&&overlap(from,to,b.from,b.to));
  return !booked&&!blocked&&rentalAllowed(state,roomId,from,to);
}
function bookingMode(state){return state.settings?.onlineBookingMode==='direct'?'direct':'request'}
function upsertPublicGuest(state,{name,email,phone}){
  state.guests=Array.isArray(state.guests)?state.guests:[];
  const lowerEmail=email.toLowerCase(),lowerName=name.toLowerCase();
  const existing=state.guests.find(g=>(g.email&&String(g.email).toLowerCase()===lowerEmail)||String(g.name||'').toLowerCase()===lowerName);
  if(existing){existing.name=name;existing.email=email;existing.phone=phone||existing.phone||'';return existing}
  const guest={id:crypto.randomUUID(),name,email,phone,note:'Online-Buchung'};state.guests.push(guest);return guest;
}
function addDirectBooking(state,data){
  state.bookings=Array.isArray(state.bookings)?state.bookings:[];
  const id=crypto.randomUUID(),createdAt=new Date().toISOString();
  state.bookings.push({id,roomId:data.roomId,guest:data.name,from:data.from,to:data.to,purpose:data.purpose,participants:data.participants,status:'confirmed',note:data.note,createdAt,source:'public-direct'});
  upsertPublicGuest(state,data);
  state.cleaningPlans=Array.isArray(state.cleaningPlans)?state.cleaningPlans:[];
  state.cleaningPlans.push({id:crypto.randomUUID(),bookingId:id,roomId:data.roomId,date:data.to,time:'10:00',owner:'',note:'Automatisch nach Buchungsende',status:'planned',auto:true,source:'booking'});
  return id;
}
async function handlePublic(request,env,url){
  if(request.method!=='GET'&&request.method!=='HEAD'&&!sameOrigin(request,url))return json({error:'Ungültiger Ursprung.'},403);
  const data=await loadOrgState(env);if(!data)return json({error:'RAUMWERK ist noch nicht eingerichtet.'},503);
  if(url.pathname==='/api/public/config'&&request.method==='GET'){
    return json({organization:data.org_name,mode:bookingMode(data.state),rooms:(data.state.rooms||[]).map(r=>({id:r.id,name:r.name,type:r.type,capacity:r.capacity||1,note:r.note||''}))});
  }
  if(url.pathname==='/api/public/availability'&&request.method==='POST'){
    const b=await body(request);const from=date(b.from),to=date(b.to);if(!from||!to||to<from)return json({error:'Bitte einen gültigen Zeitraum wählen.'},400);
    return json({rooms:(data.state.rooms||[]).filter(r=>available(data.state,r.id,from,to)).map(r=>r.id)});
  }
  if(url.pathname==='/api/public/request'&&request.method==='POST'){
    const b=await body(request);if(b.website)return json({ok:true},202);
    const name=text(b.name,120),email=text(b.email,180),phone=text(b.phone,80),roomId=text(b.roomId,100),from=date(b.from),to=date(b.to),purpose=text(b.purpose,180),note=text(b.note,600),participants=Math.max(1,Math.min(999,Number(b.participants)||1));
    if(!name||!email||!roomId||!from||!to||to<from)return json({error:'Bitte alle Pflichtfelder ausfüllen.'},400);
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return json({error:'Bitte eine gültige E-Mail-Adresse angeben.'},400);
    const room=(data.state.rooms||[]).find(r=>r.id===roomId);if(!room)return json({error:'Raum nicht gefunden.'},404);
    if(participants>Number(room.capacity||1))return json({error:'Die Teilnehmerzahl überschreitet die Kapazität des gewählten Raums.'},400);
    if(!available(data.state,roomId,from,to))return json({error:'Der gewünschte Zeitraum ist inzwischen nicht mehr verfügbar.'},409);
    for(let attempt=0;attempt<3;attempt++){
      const fresh=attempt?await loadOrgState(env):data;if(!fresh)return json({error:'Daten nicht verfügbar.'},503);
      if(!available(fresh.state,roomId,from,to))return json({error:'Der gewünschte Zeitraum ist inzwischen nicht mehr verfügbar.'},409);
      const payload={name,email,phone,roomId,from,to,purpose,participants,note};
      const mode=bookingMode(fresh.state);
      if(mode==='direct')addDirectBooking(fresh.state,payload);
      else {
        fresh.state.bookingRequests=Array.isArray(fresh.state.bookingRequests)?fresh.state.bookingRequests:[];
        fresh.state.bookingRequests.push({id:crypto.randomUUID(),...payload,status:'new',createdAt:new Date().toISOString(),source:'public'});
      }
      const result=await env.DB.prepare('UPDATE app_state SET data=?,version=version+1,updated_at=? WHERE org_id=? AND version=?').bind(JSON.stringify(fresh.state),new Date().toISOString(),fresh.org_id,fresh.version).run();
      if(Number(result.meta?.changes||0)===1){
        await writeAudit(env,{orgId:fresh.org_id,userId:null,action:mode==='direct'?'public_booking_direct':'public_booking_request',details:{roomId,from,to},ip:requestIp(request)});
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
function json(data,status=200,extraHeaders={}){return new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...extraHeaders}})}