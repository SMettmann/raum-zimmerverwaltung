const fs=require('fs');
const code=fs.readFileSync('cleaning-v2.js','utf8');
const required=[
  'Heute zu erledigen',
  'Kommende Reinigungen',
  'Saubere Räume',
  'Reinigung starten',
  'Fertig · Raum ist sauber',
  'Reinigungsbedarf manuell gesetzt',
  'Automatisch nach Buchungsende'
];
for(const text of required){if(!code.includes(text))throw new Error('Fehlt in Reinigung V2: '+text)}
if(!code.includes("rooms.forEach(r=>"))throw new Error('Raum-Synchronisierung fehlt');
if(!code.includes("cleaningPlans.find(j=>j.bookingId===b.id)"))throw new Error('Buchungs-Synchronisierung fehlt');
console.log('Cleaning V2 smoke test OK');
