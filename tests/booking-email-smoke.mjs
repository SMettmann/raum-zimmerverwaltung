import assert from 'node:assert/strict';
import fs from 'node:fs';
import { confirmationCandidates, bookingRecipient, bookingPeriodText, buildBookingConfirmation, sendBookingConfirmationOnce } from '../worker/booking-email.mjs';

const before={bookings:[{id:'old',status:'confirmed'},{id:'option',status:'option'}]};
const after={bookings:[{id:'old',status:'confirmed'},{id:'option',status:'confirmed'},{id:'new',status:'confirmed'},{id:'cancelled',status:'cancelled'}]};
assert.deepEqual(confirmationCandidates(before,after).map(b=>b.id),['option','new']);

const state={
  rooms:[
    {id:'s1',name:'Seminarraum Luther',type:'Seminarraum'},
    {id:'z1',name:'Gästezimmer 201',type:'Einzelzimmer'}
  ],
  guests:[{id:'g1',name:'Max Mustermann',email:'MAX@example.de'}],
  settings:{org:'Kirchliche Einrichtung',email:'info@einrichtung.de',phone:'0711 123456'}
};
const seminar={id:'b1',roomId:'s1',guest:'Max Mustermann',from:'2026-09-10',to:'2026-09-10',fromTime:'09:00',toTime:'12:30',purpose:'Workshop',participants:18,status:'confirmed'};
const room={id:'b2',roomId:'z1',guest:'Max Mustermann',from:'2026-09-10',to:'2026-09-12',fromTime:'09:00',toTime:'12:30',status:'confirmed'};
assert.equal(bookingRecipient(state,seminar),'max@example.de');
assert.equal(bookingPeriodText(state,seminar),'10.09.2026, 09:00–12:30 Uhr');
assert.equal(bookingPeriodText(state,room),'10.09.2026 – 12.09.2026');
const mail=buildBookingConfirmation({state:{...state,bookings:[seminar]},booking:seminar,organizationName:'Kirchliche Einrichtung'});
assert.match(mail.subject,/Seminarraum Luther/);
assert.match(mail.text,/09:00–12:30 Uhr/);
assert.match(mail.text,/Teilnehmerzahl: 18/);
assert.equal(mail.replyTo,'info@einrichtung.de');

let sentRequest=null;let logWrite=null;
const originalFetch=globalThis.fetch;
globalThis.fetch=async (url,options)=>{sentRequest={url,options};return {ok:true,status:200,json:async()=>({id:'mail_test_1'})}};
const env={
  RESEND_API_KEY:'re_test',
  TRANSACTIONAL_FROM_EMAIL:'buchung@example.de',
  DB:{prepare(sql){return {bind(...args){return {
    first:async()=>null,
    run:async()=>{logWrite={sql,args};return {meta:{changes:1}}}
  }}}}}
};
const sendState={...state,bookings:[seminar]};
const result=await sendBookingConfirmationOnce(env,{orgId:'org1',organizationName:'Kirchliche Einrichtung',state:sendState,bookingId:'b1'});
assert.equal(result.status,'sent');
assert.equal(sentRequest.url,'https://api.resend.com/emails');
assert.equal(sentRequest.options.headers.Authorization,'Bearer re_test');
assert.match(sentRequest.options.headers['Idempotency-Key'],/^booking-confirmation\/org1\/b1$/);
const payload=JSON.parse(sentRequest.options.body);
assert.deepEqual(payload.to,['max@example.de']);
assert.equal(payload.reply_to,'info@einrichtung.de');
assert.match(payload.from,/buchung@example\.de/);
assert.ok(logWrite?.sql.includes('INSERT INTO email_log'));
globalThis.fetch=originalFetch;

const schema=fs.readFileSync(new URL('../schema.sql',import.meta.url),'utf8');
const wrangler=fs.readFileSync(new URL('../wrangler.jsonc',import.meta.url),'utf8');
const entry=fs.readFileSync(new URL('../worker/email-entry.js',import.meta.url),'utf8');
assert.match(schema,/CREATE TABLE IF NOT EXISTS email_log/);
assert.match(wrangler,/worker\/email-entry\.js/);
assert.match(entry,/confirmationCandidates/);
assert.match(entry,/sendBookingConfirmationOnce/);

console.log('Automatic booking email smoke test passed');
