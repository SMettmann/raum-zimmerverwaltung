import app from './index.js';
import { canWriteExtendedState } from './state-permissions.mjs';

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname.startsWith('/api/public/')) {
      try { return await handlePublic(request, env, url); }
      catch (e) { console.error('public_api_error', e); return json({error:'Anfrage konnte nicht verarbeitet werden.'},500); }
    }
    if(url.pathname==='/api/state'&&request.method==='PUT'){
      try{
        const denied=await enforceExtendedStatePermissions(request,env);
        if(denied)return denied;
      }catch(e){console.error('extended_permission_error',e);return json({error:'Berechtigung konnte nicht geprüft werden.'},500)}
    }
    return app.fetch(request, env, ctx);
  }
};

async function enforceExtendedStatePermissions(request,env){
  const user=await userFromSession(request,env);if(!user)return null;
  if(user.role==='admin'||user.role==='manager')return null;
  if(user.role==='viewer')return json({error:'Für diese Änderung fehlen die Rechte.'},403);
  let payload;try{payload=await request.clone().json()}catch{return null}
  if(!payload?.state)return null;
  const current=await env.DB.prepare('SELECT data FROM app_state WHERE org_id=?').bind(user.org_id).first();
  if(!current)return null;
  let before;try{before=JSON.parse(current.data)}catch{return json({error:'Aktueller Datenstand ist ungültig.'},500)}
  if(!canWriteExtendedState(user.role,before,payload.state))return json({error:'Für diese Änderung fehlen die Rechte.'},403);
  return null;
}
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
      if(Number(result.meta?.changes||0)===1)return mode==='direct'?json({ok:true,mode,message:'Die Buchung wurde verbindlich bestätigt.'},201):json({ok:true,mode,message:'Buchungsanfrage wurde gesendet.'},201);
    }
    return json({error:'Die Daten wurden gleichzeitig geändert. Bitte erneut senden.'},409);
  }
  return json({error:'Nicht gefunden.'},404);
}
function sameOrigin(request,url){const origin=request.headers.get('Origin');return !origin||origin===url.origin}
async function body(request){try{return await request.json()}catch{return {}}}
function text(v,max){return String(v||'').trim().slice(0,max)}
function date(v){const s=String(v||'');return /^\d{4}-\d{2}-\d{2}$/.test(s)?s:''}
function json(data,status=200){return new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}})}