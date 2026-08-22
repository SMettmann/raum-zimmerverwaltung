import fs from 'node:fs';
import { publicLimitDecision } from '../worker/public-rate-limit.mjs';

const expect=(v,m)=>{if(!v)throw new Error(m)};
expect(publicLimitDecision(0,false,'').allowed,'Erste Anfrage muss erlaubt sein');
expect(publicLimitDecision(9,false,'').allowed,'Zehnte Anfrage muss noch erlaubt sein');
expect(!publicLimitDecision(10,false,'').allowed,'Elfte Anfrage muss blockieren');
expect(publicLimitDecision(10,true,'').allowed,'Nach neuem Zeitfenster muss wieder erlaubt sein');

const entry=fs.readFileSync('worker/entry.js','utf8');
for(const text of ['consumePublicBookingAttempt','PUBLIC_RATE_LIMIT','Retry-After',"url.pathname==='/api/public/request'&&request.method==='POST'"]){
  expect(entry.includes(text),'Public Rate Limit fehlt: '+text);
}
console.log('Public booking rate limit smoke test OK');
