const WINDOW_MINUTES=15;
const MAX_IP_FAILURES=12;
const MAX_PAIR_FAILURES=6;

export function loginLimitDecision(ipFailures,pairFailures){
  return {
    allowed:Number(ipFailures)<MAX_IP_FAILURES&&Number(pairFailures)<MAX_PAIR_FAILURES,
    retryAfterSeconds:WINDOW_MINUTES*60,
    maxIpFailures:MAX_IP_FAILURES,
    maxPairFailures:MAX_PAIR_FAILURES
  };
}

export async function checkLoginRateLimit(env,{ip,email,now=new Date()}){
  const cutoff=new Date(now.getTime()-WINDOW_MINUTES*60*1000).toISOString();
  await env.DB.prepare('DELETE FROM login_attempts WHERE attempted_at < ?').bind(cutoff).run();
  const ipHash=await keyHash('ip:'+String(ip||'unknown'));
  const pairHash=await keyHash('pair:'+String(ip||'unknown')+'|'+String(email||'').toLowerCase());
  const [ipRow,pairRow]=await Promise.all([
    env.DB.prepare('SELECT COUNT(*) AS count FROM login_attempts WHERE ip_hash = ? AND attempted_at >= ?').bind(ipHash,cutoff).first(),
    env.DB.prepare('SELECT COUNT(*) AS count FROM login_attempts WHERE pair_hash = ? AND attempted_at >= ?').bind(pairHash,cutoff).first()
  ]);
  return {...loginLimitDecision(Number(ipRow?.count||0),Number(pairRow?.count||0)),ipHash,pairHash};
}

export async function recordLoginFailure(env,{ip,email,now=new Date()}){
  const ipHash=await keyHash('ip:'+String(ip||'unknown'));
  const pairHash=await keyHash('pair:'+String(ip||'unknown')+'|'+String(email||'').toLowerCase());
  await env.DB.prepare('INSERT INTO login_attempts (id, ip_hash, pair_hash, attempted_at) VALUES (?, ?, ?, ?)')
    .bind(crypto.randomUUID(),ipHash,pairHash,now.toISOString()).run();
}

export async function clearLoginFailures(env,{ip,email}){
  const ipHash=await keyHash('ip:'+String(ip||'unknown'));
  const pairHash=await keyHash('pair:'+String(ip||'unknown')+'|'+String(email||'').toLowerCase());
  await env.DB.prepare('DELETE FROM login_attempts WHERE ip_hash = ? AND pair_hash = ?').bind(ipHash,pairHash).run();
}

export function requestIp(request){
  return request.headers.get('CF-Connecting-IP')||request.headers.get('X-Forwarded-For')?.split(',')[0]?.trim()||'unknown';
}

export async function loginEmail(request){
  try{const body=await request.clone().json();return String(body?.email||'').trim().toLowerCase().slice(0,254)}catch{return ''}
}

async function keyHash(value){
  const data=new TextEncoder().encode(value);
  const digest=new Uint8Array(await crypto.subtle.digest('SHA-256',data));
  return [...digest].map(b=>b.toString(16).padStart(2,'0')).join('');
}
