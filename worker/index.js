const enc = new TextEncoder();
const SESSION_DAYS = 14;
const PBKDF2_ITERATIONS = 210000;
const ROLES = new Set(['admin','manager','staff','cleaning','viewer']);

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (!url.pathname.startsWith('/api/')) return env.ASSETS.fetch(request);

    try {
      if (request.method !== 'GET' && request.method !== 'HEAD' && !sameOrigin(request, url)) {
        return json({ error: 'Ungültiger Ursprung.' }, 403);
      }
      return await handleApi(request, env, url);
    } catch (error) {
      console.error(JSON.stringify({ event: 'api_error', path: url.pathname, message: error?.message || String(error) }));
      return json({ error: 'Interner Serverfehler.' }, 500);
    }
  }
};

async function handleApi(request, env, url) {
  const path = url.pathname;

  if (path === '/api/health' && request.method === 'GET') {
    return json({ ok: true });
  }

  if (path === '/api/bootstrap/status' && request.method === 'GET') {
    const row = await env.DB.prepare('SELECT COUNT(*) AS count FROM users').first();
    return json({ needsSetup: Number(row?.count || 0) === 0 });
  }

  if (path === '/api/bootstrap' && request.method === 'POST') {
    return bootstrap(request, env);
  }

  if (path === '/api/login' && request.method === 'POST') {
    return login(request, env);
  }

  if (path === '/api/logout' && request.method === 'POST') {
    const token = getCookie(request, 'raumwerk_session');
    if (token) await env.DB.prepare('DELETE FROM sessions WHERE token_hash = ?').bind(await sha256(token)).run();
    return json({ ok: true }, 200, { 'Set-Cookie': clearSessionCookie() });
  }

  const user = await requireUser(request, env);
  if (!user) return json({ error: 'Nicht angemeldet.' }, 401);

  if (path === '/api/me' && request.method === 'GET') {
    return json({ user: publicUser(user), organization: { id: user.org_id, name: user.org_name } });
  }

  if (path === '/api/state' && request.method === 'GET') {
    const row = await env.DB.prepare('SELECT version, data, updated_at FROM app_state WHERE org_id = ?').bind(user.org_id).first();
    if (!row) return json({ error: 'Kein Datenstand vorhanden.' }, 404);
    return json({ version: Number(row.version), state: safeJson(row.data, {}), updatedAt: row.updated_at, user: publicUser(user) });
  }

  if (path === '/api/state' && request.method === 'PUT') {
    const body = await readJson(request);
    if (!Number.isInteger(body.version) || !isState(body.state)) return json({ error: 'Ungültiger Datenstand.' }, 400);

    const current = await env.DB.prepare('SELECT version, data FROM app_state WHERE org_id = ?').bind(user.org_id).first();
    if (!current) return json({ error: 'Kein Datenstand vorhanden.' }, 404);
    if (Number(current.version) !== body.version) {
      return json({ error: 'Die Daten wurden inzwischen von einem anderen Benutzer geändert.', code: 'VERSION_CONFLICT', version: Number(current.version) }, 409);
    }

    const previous = safeJson(current.data, {});
    if (!canWriteState(user.role, previous, body.state)) {
      return json({ error: 'Für diese Änderung fehlen die Rechte.' }, 403);
    }

    const now = new Date().toISOString();
    const result = await env.DB.prepare(`
      UPDATE app_state
      SET data = ?, version = version + 1, updated_at = ?, updated_by = ?
      WHERE org_id = ? AND version = ?
    `).bind(JSON.stringify(body.state), now, user.id, user.org_id, body.version).run();

    if (!result.meta?.changes) {
      const latest = await env.DB.prepare('SELECT version FROM app_state WHERE org_id = ?').bind(user.org_id).first();
      return json({ error: 'Die Daten wurden inzwischen von einem anderen Benutzer geändert.', code: 'VERSION_CONFLICT', version: Number(latest?.version || body.version) }, 409);
    }

    return json({ ok: true, version: body.version + 1, updatedAt: now });
  }

  if (path === '/api/users' && request.method === 'GET') {
    if (!['admin','manager'].includes(user.role)) return json({ error: 'Keine Berechtigung.' }, 403);
    const result = await env.DB.prepare('SELECT id, name, email, role, active, created_at FROM users WHERE org_id = ? ORDER BY name').bind(user.org_id).all();
    return json({ users: (result.results || []).map(u => ({ ...u, active: Boolean(u.active) })) });
  }

  if (path === '/api/users' && request.method === 'POST') {
    if (user.role !== 'admin') return json({ error: 'Nur Administratoren dürfen Benutzer anlegen.' }, 403);
    const body = await readJson(request);
    const name = clean(body.name, 120);
    const email = cleanEmail(body.email);
    const password = String(body.password || '');
    const role = String(body.role || 'staff');
    if (!name || !email || password.length < 10 || !ROLES.has(role)) return json({ error: 'Name, gültige E-Mail, Rolle und Passwort mit mindestens 10 Zeichen angeben.' }, 400);

    const existing = await env.DB.prepare('SELECT id FROM users WHERE email = ?').bind(email).first();
    if (existing) return json({ error: 'Diese E-Mail-Adresse ist bereits vergeben.' }, 409);

    const id = crypto.randomUUID();
    const salt = randomToken(16);
    const hash = await hashPassword(password, salt);
    await env.DB.prepare('INSERT INTO users (id, org_id, name, email, password_hash, password_salt, role, active, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)')
      .bind(id, user.org_id, name, email, hash, salt, role, new Date().toISOString()).run();
    return json({ ok: true, user: { id, name, email, role, active: true } }, 201);
  }

  const userMatch = path.match(/^\/api\/users\/([^/]+)$/);
  if (userMatch && request.method === 'PATCH') {
    if (user.role !== 'admin') return json({ error: 'Nur Administratoren dürfen Benutzer ändern.' }, 403);
    const targetId = decodeURIComponent(userMatch[1]);
    const target = await env.DB.prepare('SELECT id, role FROM users WHERE id = ? AND org_id = ?').bind(targetId, user.org_id).first();
    if (!target) return json({ error: 'Benutzer nicht gefunden.' }, 404);
    const body = await readJson(request);
    const role = body.role === undefined ? target.role : String(body.role);
    const active = body.active === undefined ? null : (body.active ? 1 : 0);
    if (!ROLES.has(role)) return json({ error: 'Ungültige Rolle.' }, 400);
    if (targetId === user.id && (active === 0 || role !== 'admin')) return json({ error: 'Du kannst deinen eigenen Administratorzugang nicht deaktivieren oder herabstufen.' }, 400);
    await env.DB.prepare('UPDATE users SET role = ?, active = COALESCE(?, active) WHERE id = ? AND org_id = ?').bind(role, active, targetId, user.org_id).run();
    if (active === 0) await env.DB.prepare('DELETE FROM sessions WHERE user_id = ?').bind(targetId).run();
    return json({ ok: true });
  }

  return json({ error: 'API-Endpunkt nicht gefunden.' }, 404);
}

async function bootstrap(request, env) {
  const count = await env.DB.prepare('SELECT COUNT(*) AS count FROM users').first();
  if (Number(count?.count || 0) !== 0) return json({ error: 'Die Ersteinrichtung wurde bereits abgeschlossen.' }, 409);

  const body = await readJson(request);
  const orgName = clean(body.organization, 160);
  const name = clean(body.name, 120);
  const email = cleanEmail(body.email);
  const password = String(body.password || '');
  const state = isState(body.state) ? body.state : emptyState(orgName);
  if (!orgName || !name || !email || password.length < 10) return json({ error: 'Einrichtung, Name, gültige E-Mail und Passwort mit mindestens 10 Zeichen angeben.' }, 400);

  const orgId = crypto.randomUUID();
  const userId = crypto.randomUUID();
  const now = new Date().toISOString();
  const salt = randomToken(16);
  const hash = await hashPassword(password, salt);

  await env.DB.batch([
    env.DB.prepare('INSERT INTO organizations (id, name, created_at) VALUES (?, ?, ?)').bind(orgId, orgName, now),
    env.DB.prepare('INSERT INTO users (id, org_id, name, email, password_hash, password_salt, role, active, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)').bind(userId, orgId, name, email, hash, salt, 'admin', now),
    env.DB.prepare('INSERT INTO app_state (org_id, version, data, updated_at, updated_by) VALUES (?, 1, ?, ?, ?)').bind(orgId, JSON.stringify(state), now, userId)
  ]);

  return createSession(env, { id: userId, org_id: orgId, name, email, role: 'admin', org_name: orgName }, 201);
}

async function login(request, env) {
  const body = await readJson(request);
  const email = cleanEmail(body.email);
  const password = String(body.password || '');
  if (!email || !password) return json({ error: 'E-Mail und Passwort eingeben.' }, 400);

  await env.DB.prepare('DELETE FROM sessions WHERE expires_at <= ?').bind(new Date().toISOString()).run();
  const user = await env.DB.prepare(`
    SELECT u.id, u.org_id, u.name, u.email, u.password_hash, u.password_salt, u.role, u.active, o.name AS org_name
    FROM users u JOIN organizations o ON o.id = u.org_id
    WHERE u.email = ?
  `).bind(email).first();

  if (!user || !user.active || !(await verifyPassword(password, user.password_salt, user.password_hash))) {
    return json({ error: 'E-Mail oder Passwort ist falsch.' }, 401);
  }
  return createSession(env, user, 200);
}

async function createSession(env, user, status) {
  const token = randomToken(32);
  const tokenHash = await sha256(token);
  const now = new Date();
  const expires = new Date(now.getTime() + SESSION_DAYS * 86400000);
  await env.DB.prepare('INSERT INTO sessions (token_hash, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)')
    .bind(tokenHash, user.id, expires.toISOString(), now.toISOString()).run();
  return json({ ok: true, user: publicUser(user), organization: { id: user.org_id, name: user.org_name } }, status, { 'Set-Cookie': sessionCookie(token, SESSION_DAYS * 86400) });
}

async function requireUser(request, env) {
  const token = getCookie(request, 'raumwerk_session');
  if (!token) return null;
  const row = await env.DB.prepare(`
    SELECT u.id, u.org_id, u.name, u.email, u.role, u.active, o.name AS org_name, s.expires_at
    FROM sessions s
    JOIN users u ON u.id = s.user_id
    JOIN organizations o ON o.id = u.org_id
    WHERE s.token_hash = ?
  `).bind(await sha256(token)).first();
  if (!row || !row.active || row.expires_at <= new Date().toISOString()) return null;
  return row;
}

function publicUser(user) {
  return { id: user.id, name: user.name, email: user.email, role: user.role };
}

function isState(state) {
  return Boolean(state && typeof state === 'object' && Array.isArray(state.rooms) && Array.isArray(state.bookings) && Array.isArray(state.guests) && Array.isArray(state.tasks) && state.settings && typeof state.settings === 'object');
}

function emptyState(orgName = '') {
  return { rooms: [], bookings: [], guests: [], tasks: [], settings: { org: orgName, email: '', phone: '', address: '' } };
}

function canWriteState(role, before, after) {
  if (!isState(after)) return false;
  if (role === 'admin' || role === 'manager') return true;
  if (role === 'viewer') return false;

  const sameSettings = stable(before.settings) === stable(after.settings);
  const sameRoomStructure = roomStructure(before.rooms) === roomStructure(after.rooms);

  if (role === 'staff') return sameSettings && sameRoomStructure;
  if (role === 'cleaning') {
    return sameSettings && sameRoomStructure &&
      stable(before.bookings) === stable(after.bookings) &&
      stable(before.guests) === stable(after.guests) &&
      stable(before.tasks) === stable(after.tasks);
  }
  return false;
}

function roomStructure(list) {
  return stable((list || []).map(r => ({ id: r.id, name: r.name, type: r.type, capacity: r.capacity, note: r.note })).sort((a,b) => String(a.id).localeCompare(String(b.id))));
}

function stable(value) {
  if (Array.isArray(value)) return '[' + value.map(stable).join(',') + ']';
  if (value && typeof value === 'object') return '{' + Object.keys(value).sort().map(k => JSON.stringify(k) + ':' + stable(value[k])).join(',') + '}';
  return JSON.stringify(value);
}

async function hashPassword(password, salt) {
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: enc.encode(salt), iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' }, key, 256);
  return hex(new Uint8Array(bits));
}

async function verifyPassword(password, salt, expected) {
  const actual = await hashPassword(password, salt);
  return timingSafeEqual(actual, expected);
}

function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function sha256(value) {
  return hex(new Uint8Array(await crypto.subtle.digest('SHA-256', enc.encode(value))));
}

function randomToken(bytes) {
  const data = crypto.getRandomValues(new Uint8Array(bytes));
  let binary = '';
  for (const b of data) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function hex(bytes) {
  return [...bytes].map(b => b.toString(16).padStart(2, '0')).join('');
}

function sessionCookie(token, maxAge) {
  return `raumwerk_session=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
}
function clearSessionCookie() {
  return 'raumwerk_session=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0';
}
function getCookie(request, name) {
  const cookies = request.headers.get('Cookie') || '';
  for (const part of cookies.split(';')) {
    const [key, ...rest] = part.trim().split('=');
    if (key === name) return rest.join('=');
  }
  return '';
}
function sameOrigin(request, url) {
  const origin = request.headers.get('Origin');
  return !origin || origin === url.origin;
}
function clean(value, max) {
  return String(value || '').trim().slice(0, max);
}
function cleanEmail(value) {
  const email = clean(value, 254).toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : '';
}
function safeJson(value, fallback) {
  try { return JSON.parse(value); } catch { return fallback; }
}
async function readJson(request) {
  const type = request.headers.get('Content-Type') || '';
  if (!type.includes('application/json')) throw new Error('JSON erwartet');
  return request.json();
}
function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'same-origin',
      ...extraHeaders
    }
  });
}
