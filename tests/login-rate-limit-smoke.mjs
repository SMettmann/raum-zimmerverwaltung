import fs from 'node:fs';
import { loginLimitDecision } from '../worker/login-rate-limit.mjs';

const expect=(value,msg)=>{if(!value)throw new Error(msg)};
expect(loginLimitDecision(0,0).allowed,'Frischer Login muss erlaubt sein');
expect(loginLimitDecision(11,5).allowed,'Unterhalb der Grenzwerte muss Login erlaubt sein');
expect(!loginLimitDecision(12,0).allowed,'IP-Grenzwert muss blockieren');
expect(!loginLimitDecision(0,6).allowed,'IP/E-Mail-Grenzwert muss blockieren');
expect(loginLimitDecision(0,0).retryAfterSeconds===900,'Sperrfenster muss 15 Minuten betragen');

const entry=fs.readFileSync('worker/entry.js','utf8');
for(const text of ["url.pathname==='/api/login'&&request.method==='POST'",'handleRateLimitedLogin','recordLoginFailure','clearLoginFailures','LOGIN_RATE_LIMIT','Retry-After']){
  expect(entry.includes(text),'Login-Schutz fehlt: '+text);
}
const schema=fs.readFileSync('schema.sql','utf8');
for(const text of ['CREATE TABLE IF NOT EXISTS login_attempts','idx_login_attempts_ip','idx_login_attempts_pair']){
  expect(schema.includes(text),'Login-Schutz Schema fehlt: '+text);
}
console.log('Login rate limit smoke test OK');
