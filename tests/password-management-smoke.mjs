import fs from 'node:fs';
import assert from 'node:assert/strict';

const worker=fs.readFileSync('worker/password-entry.js','utf8');
const ownerWorker=fs.readFileSync('worker/owner-protection-entry.js','utf8');
const baseWorker=fs.readFileSync('worker/index.js','utf8');
const ui=fs.readFileSync('password-management.js','utf8');
const wrangler=fs.readFileSync('wrangler.jsonc','utf8');

for(const token of [
  '/api/password/change',
  'users\\/([^/]+)\\/password',
  'verifyPassword(currentPassword',
  "actor.role!=='admin'",
  'newPassword.length<10',
  'PBKDF2_ITERATIONS=100000',
  "DELETE FROM sessions WHERE user_id=? AND token_hash<>?",
  "DELETE FROM sessions WHERE user_id=?",
  "action:'password_changed'",
  "action:'password_reset'",
  'password-management.js'
])assert.ok(worker.includes(token),`Passwort-Backend fehlt: ${token}`);

assert.ok(baseWorker.includes('PBKDF2_ITERATIONS = 100000'), 'Basis-Authentifizierung muss den Cloudflare-kompatiblen PBKDF2-Grenzwert verwenden.');
assert.ok(!worker.includes('details:{password'), 'Passwörter dürfen niemals ins Audit-Log geschrieben werden.');
assert.ok(ui.includes('Aktuelles Passwort *'));
assert.ok(ui.includes('Neues Passwort *'));
assert.ok(ui.includes('Passwort wiederholen *'));
assert.ok(ui.includes('Passwort setzen'));
assert.ok(ui.includes("cloud.user?.role!=='admin'"));
assert.ok(wrangler.includes('"main": "./worker/owner-protection-entry.js"'));
assert.ok(ownerWorker.includes("import app from './password-entry.js'"),'Der Hauptadministrator-Schutz muss die Passwort-Schicht weiterverwenden.');
console.log('Password management smoke test OK');