import app from './password-entry.js';

const enc=new TextEncoder();

export default {
  async fetch(request,env,ctx){
    const url=new URL(request.url);

    if(request.method==='GET'&&(url.pathname==='/'||url.pathname==='/index.html')){
      const response=await app.fetch(request,env,ctx);
      const type=response.headers.get('Content-Type')||'';
      if(!response.ok||!type.includes('text/html'))return response;
      const html=await response.text();
      const next=html.includes('owner-account-protection.js')?html:html.replace('</body>','<script src="owner-account-protection.js?v=20260903-1"></script></body>');
      if(next===html)return new Response(html,{status:response.status,statusText:response.statusText,headers:response.headers});
      const headers=new Headers(response.headers);headers.delete('Content-Length');
      return new Response(next,{status:response.status,statusText:response.statusText,headers});
    }

    if(url.pathname==='/api/users'&&request.method==='GET'){
      const actor=await userFromSession(request,env);
      const response=await app.fetch(request,env,ctx);
      if(!response.ok||!actor)return response;
      let data;try{data=await response.clone().json()}catch{return response}
      const protectedId=await ownerId(env,actor.org_id);
      if(Array.isArray(data.users))data.users=data.users.map(u=>({...u,protected:u.id===protectedId}));
      const headers=new Headers(response.headers);headers.delete('Content-Length');
      headers.set('Content-Type','application/json; charset=utf-8');
      headers.set('Cache-Control','no-store');
      return new Response(JSON.stringify(data),{status:response.status,statusText:response.statusText,headers});
    }

    const passwordMatch=url.pathname.match(/^\/api\/users\/([^/]+)\/password$/);
    const userMatch=url.pathname.match(/^\/api\/users\/([^/]+)$/);
    const protectedWrite=(passwordMatch&&request.method==='POST')||(userMatch&&['PATCH','DELETE'].includes(request.method));

    if(protectedWrite){
      if(!sameOrigin(request,url))return json({error:'Ungültiger Ursprung.'},403);
      const actor=await userFromSession(request,env);
      if(actor){
        const targetId=decodeURIComponent((passwordMatch||userMatch)[1]);
        const protectedId=await ownerId(env,actor.org_id);
        if(targetId===protectedId){
          if(request.method==='DELETE')return json({error:'Der Hauptadministrator ist geschützt und kann nicht gelöscht werden.'},400);
          if(passwordMatch&&actor.id!==protectedId)return json({error:'Das Passwort des Hauptadministrators kann nur vom Hauptadministrator selbst geändert werden.'},403);
          if(request.method==='PATCH'){
            let body={};try{body=await request.clone().json()}catch{}
            const triesDeactivate=body.active===false;
            const triesDemote=body.role!==undefined&&String(body.role)!=='admin';
            if(triesDeactivate||triesDemote)return json({error:'Der Hauptadministrator ist geschützt und kann weder deaktiviert noch herabgestuft werden.'},400);
          }
        }
      }
    }

    return app.fetch(request,env,ctx);
  }
};

async function ownerId(env,orgId){
  if(!orgId)return '';
  const row=await env.DB.prepare('SELECT id FROM users WHERE org_id=? ORDER BY created_at ASC,id ASC LIMIT 1').bind(orgId).first();
  return row?.id||'';
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
async function sha256(value){return hex(new Uint8Array(await crypto.subtle.digest('SHA-256',enc.encode(value))))}
function hex(bytes){return [...bytes].map(b=>b.toString(16).padStart(2,'0')).join('')}
function sameOrigin(request,url){const origin=request.headers.get('Origin');return !origin||origin===url.origin}
function json(data,status=200){return new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}})}
