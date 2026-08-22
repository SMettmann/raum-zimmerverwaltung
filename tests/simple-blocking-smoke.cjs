const fs=require('fs');
const expect=(value,msg)=>{if(!value)throw new Error(msg)};
const simple=fs.readFileSync('availability-simple.js','utf8');
const loader=fs.readFileSync('xrechnung.js','utf8');
for(const text of ['Sperrzeiten','Räume sind grundsätzlich immer vermietbar','+ Zeitraum sperren','Gesperrte Zeiträume','Sperre aufheben','settings.rentalPeriods=[]']){
  expect(simple.includes(text),'Einfache Sperrlogik fehlt: '+text);
}
for(const forbidden of ['Freigegebene Zeiträume','+ Vermietungszeitraum','Vermietungszeitraum freigeben']){
  expect(!simple.includes(forbidden),'Freigabe-UI darf nicht zurückkehren: '+forbidden);
}
expect(loader.includes("availabilityScript.src='availability-simple.js'"),'availability-simple.js wird nicht geladen');
expect(loader.includes('script[src$="cleaning-v2.js"]'),'Cleaning-V2-Doppelladen ist nicht abgesichert');
console.log('Simple blocking smoke test OK');
