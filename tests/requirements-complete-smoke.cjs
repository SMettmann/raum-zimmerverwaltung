const fs=require('fs');
const completion=fs.readFileSync('completion.js','utf8');
const worker=fs.readFileSync('worker/entry.js','utf8');
const publicJs=fs.readFileSync('public-booking.js','utf8');
const bookingHtml=fs.readFileSync('booking.html','utf8');
const index=fs.readFileSync('index.html','utf8');

const must=(haystack,needle,label)=>{if(!haystack.includes(needle))throw new Error(`${label} fehlt: ${needle}`)};

must(completion,'Vermietungszeiträume','UI');
must(completion,'rentalPeriodAllows','Vermietungslogik');
must(completion,"onlineBookingMode==='direct'",'Online-Modus');
must(completion,'Direkte Buchung – sofort verbindlich','Online-UI');
must(worker,'rentalAllowed','Server-Vermietungslogik');
must(worker,"mode==='direct'",'Direkte Serverbuchung');
must(worker,'addDirectBooking','Direkte Buchung');
must(worker,'Die Buchung wurde verbindlich bestätigt.','Direkte Buchungsbestätigung');
must(publicJs,'Jetzt verbindlich buchen','Öffentliche Buchungsseite');
must(bookingHtml,'id="heroTitle"','Dynamische öffentliche Seite');
must(index,'<script src="cleaning-v2.js"></script>','Reinigung V2 Einbindung');
must(index,'<script src="completion.js"></script>','Pflichtabschluss Einbindung');

const managePos=index.indexOf('<script src="manage.js"></script>');
const cleaningPos=index.indexOf('<script src="cleaning-v2.js"></script>');
const completionPos=index.indexOf('<script src="completion.js"></script>');
if(!(managePos>=0&&cleaningPos>managePos&&completionPos>cleaningPos))throw new Error('Script-Reihenfolge ist falsch');

console.log('Final requirements smoke test OK');
