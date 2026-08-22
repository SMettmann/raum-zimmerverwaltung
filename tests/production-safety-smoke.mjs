import fs from 'node:fs';
import { canWriteExtendedState } from '../worker/state-permissions.mjs';

const base={
  rooms:[{id:'r1',name:'Zimmer 1',type:'Einzelzimmer',capacity:1,note:'',cleaning:'open'}],
  bookings:[],guests:[],tasks:[],settings:{org:'Test',onlineBookingMode:'request',rentalPeriods:[]},
  cleaningPlans:[],shifts:[],blocks:[],contracts:[],invoices:[],bookingRequests:[],billing:{}
};
const clone=v=>JSON.parse(JSON.stringify(v));
const expect=(value,msg)=>{if(!value)throw new Error(msg)};

let next=clone(base);next.bookings.push({id:'b1'});next.cleaningPlans.push({id:'c1'});next.rooms[0].cleaning='done';
expect(canWriteExtendedState('staff',base,next),'Mitarbeiter muss Buchungen/Reinigung ändern dürfen');
next=clone(base);next.invoices.push({id:'i1'});
expect(!canWriteExtendedState('staff',base,next),'Mitarbeiter darf Rechnungen nicht ändern');
next=clone(base);next.blocks.push({id:'x1'});
expect(!canWriteExtendedState('staff',base,next),'Mitarbeiter darf Sperrzeiten nicht ändern');
next=clone(base);next.settings.org='Manipuliert';
expect(!canWriteExtendedState('staff',base,next),'Mitarbeiter darf Einstellungen nicht ändern');
next=clone(base);next.rooms[0].name='Manipuliert';
expect(!canWriteExtendedState('staff',base,next),'Mitarbeiter darf Raumstruktur nicht ändern');

next=clone(base);next.cleaningPlans.push({id:'c1'});next.rooms[0].cleaning='done';
expect(canWriteExtendedState('cleaning',base,next),'Reinigung muss Reinigungsstatus ändern dürfen');
next=clone(base);next.bookings.push({id:'b1'});
expect(!canWriteExtendedState('cleaning',base,next),'Reinigung darf Buchungen nicht ändern');
next=clone(base);next.tasks.push({id:'t1'});
expect(!canWriteExtendedState('cleaning',base,next),'Reinigung darf Aufgaben nicht ändern');
expect(!canWriteExtendedState('viewer',base,base),'Nur-Lesen darf nie schreiben');
expect(canWriteExtendedState('manager',base,{...clone(base),invoices:[{id:'i1'}]}),'Leitung braucht Vollzugriff');
expect(canWriteExtendedState('admin',base,{...clone(base),contracts:[{id:'v1'}]}),'Admin braucht Vollzugriff');

const completion=fs.readFileSync('completion.js','utf8');
for(const text of ['Vollständige Datensicherung','Demo-Daten sind im gemeinsamen Onlinebetrieb','Ein Komplett-Reset ist im gemeinsamen Onlinebetrieb gesperrt','...stateSnapshot()']){
  expect(completion.includes(text),'Produktionsschutz fehlt: '+text);
}
const entry=fs.readFileSync('worker/entry.js','utf8');
expect(entry.includes('canWriteExtendedState'),'Serverseitige Zusatzrechte sind nicht eingebunden');
expect(entry.includes("url.pathname==='/api/state'&&request.method==='PUT'"),'State-Writes werden nicht vorgeprüft');
console.log('Production safety smoke test OK');
