import fs from 'node:fs';
import assert from 'node:assert/strict';
import { isTimedRoomType, bookingOverlaps, roomAvailable, validTimedRange } from '../worker/time-booking.mjs';

const seminar={id:'s1',type:'Seminarraum'};
const meeting={id:'m1',type:'Besprechungsraum'};
const event={id:'e1',type:'Veranstaltungsraum'};
const single={id:'z1',type:'Einzelzimmer'};
const double={id:'z2',type:'Doppelzimmer'};

assert.equal(isTimedRoomType(seminar.type),true);
assert.equal(isTimedRoomType(meeting.type),true);
assert.equal(isTimedRoomType(event.type),true);
assert.equal(isTimedRoomType(single.type),false);
assert.equal(isTimedRoomType(double.type),false);

const morning={from:'2026-08-24',to:'2026-08-24',fromTime:'09:00',toTime:'12:00'};
const noon={from:'2026-08-24',to:'2026-08-24',fromTime:'12:00',toTime:'14:00'};
const overlap={from:'2026-08-24',to:'2026-08-24',fromTime:'11:30',toTime:'13:00'};
assert.equal(validTimedRange(seminar,morning),true);
assert.equal(bookingOverlaps(seminar,morning,noon),false,'Direkt anschließende Seminare dürfen gebucht werden.');
assert.equal(bookingOverlaps(seminar,morning,overlap),true,'Zeitliche Überschneidung muss blockieren.');
assert.equal(bookingOverlaps(single,morning,noon),true,'Übernachtungszimmer bleiben am selben Tag tagesweise blockiert.');

const state={bookings:[{id:'b1',roomId:'s1',status:'confirmed',...morning}],blocks:[]};
assert.equal(roomAvailable(state,seminar,noon),true);
assert.equal(roomAvailable(state,seminar,overlap),false);
assert.equal(roomAvailable({...state,blocks:[{roomId:'s1',from:'2026-08-24',to:'2026-08-24'}]},seminar,noon),false,'Sperrzeiten blockieren weiterhin den ganzen Tag.');

const browser=fs.readFileSync('time-booking.js','utf8');
const publicHtml=fs.readFileSync('booking.html','utf8');
const publicJs=fs.readFileSync('public-booking.js','utf8');
const worker=fs.readFileSync('worker/time-entry.js','utf8');
const emailEntry=fs.readFileSync('worker/email-entry.js','utf8');
const passwordEntry=fs.readFileSync('worker/password-entry.js','utf8');
const wrangler=fs.readFileSync('wrangler.jsonc','utf8');
const xrechnung=fs.readFileSync('xrechnung.js','utf8');
for(const token of ['bookingFromTime','bookingToTime','Teilnehmerzahl','Seminarraum','Besprechungsraum','Veranstaltungsraum'])assert.ok(browser.includes(token),`Browser-Zeitlogik fehlt: ${token}`);
assert.ok(publicHtml.includes('Gästezimmer werden weiterhin tagesweise gebucht.'));
assert.ok(publicHtml.includes('id="fromTime"')&&publicHtml.includes('id="toTime"'));
assert.ok(publicJs.includes('fromTime')&&publicJs.includes('toTime'));
assert.ok(worker.includes('roomAvailable')&&worker.includes('validTimedRange'));
assert.ok(wrangler.includes('"main": "./worker/password-entry.js"'));
assert.ok(passwordEntry.includes("import app from './email-entry.js'"),'Der Passwort-Wrapper muss die E-Mail-Schicht weiterverwenden.');
assert.ok(emailEntry.includes("import app from './time-entry.js'"),'Der E-Mail-Wrapper muss die Zeitbuchungs-API weiterverwenden.');
assert.ok(xrechnung.includes("'&':'&amp;'"),'XRechnung XML-Escaping muss unverändert korrekt bleiben.');
console.log('Timed seminar booking smoke test passed.');
