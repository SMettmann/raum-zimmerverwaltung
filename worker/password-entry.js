import app from './email-entry.js';

const enc=new TextEncoder();
const PBKDF2_ITERATIONS=100000;
const SESSION_DAYS=14;

export default {
  async fetch(request,env,ctx){
    const url=new URL(request.url);
    if(request.method==='GET'&&(url.pathname==='/'||url.pathname==='/index.html')){
      const response=await app.fetch(request,env,ctx);
      const type=response.headers.get('Content-Type')||'';
      if(!response.ok||!type.includes('text/html'))return response;
      const html=await response.text();
      let next=html;
      if(!next.includes('password-management.js'))next=next.replace('</body>','<script src="password-management.js"></script></body>');
      if(!next.includes('cleaning-history-expand.js'))next=next.replace('</body>','<script src="cleaning-history-expand.js"></script></body>');
      if(!next.includes('live-test-fixes.js'))next=next.replace('</body>','<script src="live-test-fixes.js"></script></body>');
      if(!next.includes('task-history-undo.js'))next=next.replace('</body>','<script src="task-history-undo.js"></script></body>');
      if(!next.includes('live-test-fixes-round-two.js'))next=next.replace('</body>','<script src="live-test-fixes-round-two.js"></script></body>');
      if(!next.includes('catering-booking.js'))next=next.replace('</body>','<script src="catering-booking.js"></script></body>');
      if(!next.includes('registration-ui.js'))next=next.replace('</body>','<script src="registration-ui.js?v=20260903-1"></script></body>');
      if(!next.includes('business-closure.js'))next=next.replace('</body>','<script src="business-closure.js?v=20260903-2"></script></body>');
      if(next===html)return new Response(html,{status:response.status,headers:response.headers});
      const headers=new Headers(response.headers);headers.delete('Content-Length');
      return new Response(next,{status:response.status,statusText:response.statusText,headers});
    }
    if(url.pathname==='/api/register'&&request.method==='POST'){
      if(!sameOrigin(request,url))return json({error:'Ungültiger Ursprung.'},403);
      try{return await registerOrganization(request,env)}
      catch(e){console.error('registration_error',e);return json({error:'Registrierung konnte nicht abgeschlossen werden.'},500)}
    }
    if(url.pathname==='/api/password/change'&&request.method==='POST'){
      if(!sameOrigin(request,url))return json({error:'Ungültiger Ursprung.'},403);
      try{return await changeOwnPassword(request,env)}
      catch(e){console.error('password_change_error',e);return json({error:'Passwort konnte nicht geändert werden.'},500)}
    }
    const reset=url.pathname.match(/^\/api\/users\/([^/]+)\/password$/);
    if(reset&&request.method==='POST'){
      if(!sameOrigin(request,url))return json({error:'Ungültiger Ursprung.'},403);
      try{return await resetUserPassword(request,env,decodeURIComponent(reset[1]))}
      catch(e){console.error('password_reset_error',e);return json({error:'Passwort konnte nicht neu gesetzt werden.'},500)}
    }
    return app.fetch(request,env,ctx);
  }
};

async function registerOrganization(request,env){
  const body=await readJson(request);
  const organization=clean(body.organization,160);
  const name=clean(body.name,120);
  const email=cleanEmail(body.email);
  const password=String(body.password||'');
  if(!organization||!name||!email||password.length<10)return json({error:'Einrichtung, Name, gültige E-Mail und Passwort mit mindestens 10 Zeichen angeben.'},400);

  const existing=await env.DB.prepare('SELECT id FROM users WHERE email=?').bind(email).first();
  if(existing)return json({error:'Für diese E-Mail-Adresse besteht bereits ein Zugang. Bitte anmelden.'},409);

  const orgId=crypto.randomUUID();
  const userId=crypto.randomUUID();
  const now=new Date().toISOString();
  const salt=randomToken(16);
  const hash=await hashPassword(password,salt);
  const state={rooms:[],bookings:[],guests:[],tasks:[],settings:{org:organization,email:'',phone:'',address:'',locations:[]}};

  await env.DB.batch([
    env.DB.prepare('INSERT INTO organizations (id,name,created_at) VALUES (?,?,?)').bind(orgId,organization,now),
    env.DB.prepare('INSERT INTO users (id,org_id,name,email,password_hash,password_salt,role,active,created_at) VALUES (?,?,?,?,?,?,?,?,?)').bind(userId,orgId,name,email,hash,salt,'admin',1,now),
    env.DB.prepare('INSERT INTO app_state (org_id,version,data,updated_at,updated_by) VALUES (?,1,?,?,?)').bind(orgId,JSON.stringify(state),now,userId)
  ]);

  const token=randomToken(32);
  const tokenHash=await sha256(token);
  const expires=new Date(Date.now()+SESSION_DAYS*86400000).toISOString();
  await env.DB.prepare('INSERT INTO sessions (token_hash,user_id,expires_at,created_at) VALUES (?,?,?,?)').bind(tokenHash,userId,expires,now).run();
  await writeAudit(env,{orgId,userId,action:'organization_registered',details:{organization}});

  return json({ok:true,user:{id:userId,name,email,role:'admin'},organization:{id:orgId,name:organization}},201,{'Set-Cookie':sessionCookie(token,SESSION_DAYS*86400)});
}

async function changeOwnPassword(request,env){
  const auth=await passwordUserFromSession(request,env);
  if(!auth)return json({error:'Nicht angemeldet.'},401);
  const body=await readJson(request),currentPassword=String(body.currentPassword||''),newPassword=String(body.newPassword||'');
  if(!currentPassword||newPassword.length<10)return json({error:'Aktuelles Passwort und neues Passwort mit mindestens 10 Zeichen angeben.'},400);
  if(!(await verifyPassword(currentPassword,auth.password_salt,auth.password_hash)))return json({error:'Das aktuelle Passwort ist nicht korrekt.'},400);
  if(currentPassword===newPassword)return json({error:'Das neue Passwort muss sich vom aktuellen Passwort unterscheiden.'},400);
  const salt=randomToken(16),hash=await hashPassword(newPassword,salt);
  await env.DB.prepare('UPDATE users SET password_hash=?,password_salt=? WHERE id=? AND org_id=?').bind(hash,salt,auth.id,auth.org_id).run();
  await env.DB.prepare('DELETE FROM sessions WHERE user_id=? AND token_hash<>?').bind(auth.id,auth.session_hash).run();
  await writeAudit(env,{orgId:auth.org_id,userId:auth.id,action:'password_changed',details:{}});
  return json({ok:true,message:'Passwort wurde geändert.'});
}

async function resetUserPassword(request,env,targetId){
  const actor=await passwordUserFromSession(request,env);
  if(!actor)return json({error:'Nicht angemeldet.'},401);
  if(actor.role!=='admin')return json({error:'Nur Administratoren dürfen Passwörter neu setzen.'},403);
  if(targetId===actor.id)return json({error:'Das eigene Passwort bitte über „Passwort ändern“ ändern.'},400);
  const target=await env.DB.prepare('SELECT id,name,email FROM users WHERE id=? AND org_id=?').bind(targetId,actor.org_id).first();
  if(!target)return json({error:'Benutzer nicht gefunden.'},404);
  const body=await readJson(request),newPassword=String(body.newPassword||'');
  if(newPassword.length<10)return json({error:'Das neue Passwort muss mindestens 10 Zeichen lang sein.'},400);
  const salt=randomToken(16),hash=await hashPassword(newPassword,salt);
  await env.DB.prepare('UPDATE users SET password_hash=?,password_salt=? WHERE id=? AND org_id=?').bind(hash,salt,targetId,actor.org_id).run();
  await env.DB.prepare('DELETE FROM sessions WHERE user_id=?').bind(targetId).run();
  await writeAudit(env,{orgId:actor.org_id,userId:actor.id,action:'password_reset',details:{targetUserId:targetId,targetEmail:String(target.email||'').slice(0,180)}});
  return json({ok:true,message:'Neues Passwort wurde gesetzt. Der Benutzer muss sich erneut anmelden.'});
}

async function passwordUserFromSession(request,env){
  const token=getCookie(request,'raumwerk_session');if(!token)return null;
  const sessionHash=await sha256(token);
  const row=await env.DB.prepare(`SELECT u.id,u.org_id,u.role,u.active,u.password_hash,u.password_salt,s.expires_at FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=?`).bind(sessionHash).first();
  if(!row||!row.active||row.expires_at<=new Date().toISOString())return null;
  return {...row,session_hash:sessionHash};
}

async function hashPassword(password,salt){
  const key=await crypto.subtle.importKey('raw',enc.encode(password),'PBKDF2',false,['deriveBits']);
  const bits=await crypto.subtle.deriveBits({name:'PBKDF2',salt:enc.encode(salt),iterations:PBKDF2_ITERATIONS,hash:'SHA-256'},key,256);
  return hex(new Uint8Array(bits));
}
async function verifyPassword(password,salt,expected){return timingSafeEqual(await hashPassword(password,salt),String(expected||''))}
function timingSafeEqual(a,b){if(a.length!==b.length)return false;let diff=0;for(let i=0;i<a.length;i++)diff|=a.charCodeAt(i)^b.charCodeAt(i);return diff===0}
async function sha256(value){return hex(new Uint8Array(await crypto.subtle.digest('SHA-256',enc.encode(value))))}
function randomToken(bytes){const data=crypto.getRandomValues(new Uint8Array(bytes));let binary='';for(const b of data)binary+=String.fromCharCode(b);return btoa(binary).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/g,'')}
function hex(bytes){return [...bytes].map(b=>b.toString(16).padStart(2,'0')).join('')}
function getCookie(request,name){const cookies=request.headers.get('Cookie')||'';for(const part of cookies.split(';')){const [key,...rest]=part.trim().split('=');if(key===name)return rest.join('=')}return ''}
function sameOrigin(request,url){const origin=request.headers.get('Origin');return !origin||origin===url.origin}
function clean(value,max=160){return String(value||'').trim().slice(0,max)}
function cleanEmail(value){const email=clean(value,180).toLowerCase();return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)?email:''}
function sessionCookie(token,maxAge){return `raumwerk_session=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`}
async function readJson(request){try{return await request.json()}catch{return {}}}
async function writeAudit(env,{orgId,userId,action,details={}}){await env.DB.prepare('INSERT INTO audit_log (id,org_id,user_id,action,details,ip,created_at) VALUES (?,?,?,?,?,?,?)').bind(crypto.randomUUID(),orgId,userId,action,JSON.stringify(details),'',new Date().toISOString()).run()}
function json(data,status=200,extraHeaders={}){return new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...extraHeaders}})}