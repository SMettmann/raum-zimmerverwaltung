import fs from 'node:fs';

const entry=fs.readFileSync('worker/entry.js','utf8');
const schema=fs.readFileSync('schema.sql','utf8');
const expect=(value,msg)=>{if(!value)throw new Error(msg)};

for(const text of [
  "LOGIN_MAX_ATTEMPTS=8",
  "LOGIN_WINDOW_MS=15*60*1000",
  "LOGIN_BLOCK_MS=15*60*1000",
  "url.pathname==='/api/login'&&request.method==='POST'",
  "url.pathname==='/api/audit'&&request.method==='GET'",
  "status===401",
  "Retry-After",
  "state_update",
  "public_booking_direct",
  "public_booking_request",
  "login_success",
  "user_created",
  "user_updated"
])expect(entry.includes(text),'Security-Hardening fehlt: '+text);

for(const text of [
  'CREATE TABLE IF NOT EXISTS login_attempts',
  'CREATE TABLE IF NOT EXISTS audit_log',
  'idx_login_attempts_window',
  'idx_audit_org_created'
])expect(schema.includes(text),'Schema-Erweiterung fehlt: '+text);

expect(!entry.includes("details:{name"),'Audit-Log darf keine Namen als Detail speichern');
expect(!entry.includes("details:{email"),'Audit-Log darf keine E-Mail als Detail speichern');
console.log('Login + audit smoke test OK');
