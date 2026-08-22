const MAX_REQUESTS=10;
const WINDOW_MS=15*60*1000;
const BLOCK_MS=30*60*1000;

export function publicLimitDecision(attempts,windowExpired=false,blockedUntil=''){
  if(blockedUntil&&blockedUntil>new Date().toISOString())return {allowed:false,retryAfterSeconds:Math.ceil(BLOCK_MS/1000)};
  const next=windowExpired?1:Number(attempts||0)+1;
  return {allowed:next<=MAX_REQUESTS,nextAttempts:next,shouldBlock:next>MAX_REQUESTS,retryAfterSeconds:Math.ceil(BLOCK_MS/1000)};
}

export async function consumePublicBookingAttempt(env,request,now=new Date()){
  const ip=requestIp(request);
  const key=await sha256('public-booking|'+ip);
  const row=await env.DB.prepare('SELECT attempts,window_started_at,blocked_until FROM login_attempts WHERE attempt_key=?').bind(key).first();
  const nowIso=now.toISOString();
  if(row?.blocked_until&&row.blocked_until>nowIso){
    const seconds=Math.max(1,Math.ceil((new Date(row.blocked_until).getTime()-now.getTime())/1000));
    return {allowed:false,retryAfterSeconds:seconds};
  }
  const windowExpired=!row?.window_started_at||(now.getTime()-new Date(row.window_started_at).getTime())>WINDOW_MS;
  const attempts=windowExpired?1:Number(row?.attempts||0)+1;
  const windowStarted=windowExpired?nowIso:row.window_started_at;
  const blockedUntil=attempts>MAX_REQUESTS?new Date(now.getTime()+BLOCK_MS).toISOString():null;
  await env.DB.prepare(`INSERT INTO login_attempts (attempt_key,attempts,window_started_at,blocked_until) VALUES (?,?,?,?) ON CONFLICT(attempt_key) DO UPDATE SET attempts=excluded.attempts,window_started_at=excluded.window_started_at,blocked_until=excluded.blocked_until`).bind(key,attempts,windowStarted,blockedUntil).run();
  return blockedUntil?{allowed:false,retryAfterSeconds:Math.ceil(BLOCK_MS/1000)}:{allowed:true,retryAfterSeconds:0};
}

export function requestIp(request){return String(request.headers.get('CF-Connecting-IP')||request.headers.get('X-Forwarded-For')||'unknown').split(',')[0].trim().slice(0,80)}
async function sha256(value){
  const bytes=new TextEncoder().encode(value);
  const hash=new Uint8Array(await crypto.subtle.digest('SHA-256',bytes));
  return [...hash].map(b=>b.toString(16).padStart(2,'0')).join('');
}
