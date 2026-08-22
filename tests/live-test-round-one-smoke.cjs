const fs=require('fs');

const fixes=fs.readFileSync('live-test-fixes.js','utf8');
const cleaning=fs.readFileSync('cleaning-history-expand.js','utf8');
const entry=fs.readFileSync('worker/password-entry.js','utf8');

for(const text of [
  'Aufgabenhistorie',
  "action:'completed'",
  "action:'reopened'",
  'completedAt',
  'completedBy',
  'Wieder öffnen',
  'availableInvoiceBookings',
  "invoices.some(i=>i.bookingId===bookingId)",
  'Keine noch nicht abgerechnete Buchung vorhanden',
  'sellerStreet',
  'sellerTaxNo',
  'sellerVatId',
  'serviceFrom',
  'Leistungszeitraum:',
  'Leitweg-ID / Buyer Reference (nur XRechnung)'
]){
  if(!fixes.includes(text))throw new Error('Live-Test-Fix fehlt: '+text);
}

for(const text of ['reopenCleaningJob','Rückgängig',"job.status='planned'",'delete job.completedAt']){
  if(!cleaning.includes(text))throw new Error('Reinigung rückgängig fehlt: '+text);
}

if(!entry.includes('live-test-fixes.js'))throw new Error('Live-Test-Fixes werden im Produktions-Worker nicht geladen');

console.log('Live test round one smoke test OK');
