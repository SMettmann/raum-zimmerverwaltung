const fs=require('fs');
const code=fs.readFileSync('cleaning-v2.js','utf8');
const required=[
  'Zu reinigen',
  'Kommende Reinigungen',
  'Saubere Räume',
  'Sauber bestätigen ✓',
  'Reinigungsbedarf manuell gesetzt',
  'Automatisch nach Buchungsende'
];
for(const text of required){if(!code.includes(text))throw new Error('Fehlt in Reinigung V2: '+text)}
if(code.includes('Reinigung starten'))throw new Error('Zwischenaktion „Reinigung starten“ darf nicht mehr im UI vorkommen');
if(code.includes('Reinigung läuft'))throw new Error('Zwischenstatus „Reinigung läuft“ darf nicht mehr im UI vorkommen');
if(!code.includes("rooms.forEach(r=>"))throw new Error('Raum-Synchronisierung fehlt');
if(!code.includes("cleaningPlans.find(j=>j.bookingId===b.id)"))throw new Error('Buchungs-Synchronisierung fehlt');
if(!code.includes("if(j.status==='doing')"))throw new Error('Migration alter In-Reinigung-Zustände fehlt');
console.log('Cleaning confirm-only smoke test OK');
