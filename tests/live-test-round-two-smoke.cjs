const fs=require('fs');

const fixes=fs.readFileSync('live-test-fixes-round-two.js','utf8');
const entry=fs.readFileSync('worker/password-entry.js','utf8');
const taskUndo=fs.readFileSync('task-history-undo.js','utf8');

for(const text of [
  'Als offen markieren',
  'paymentHistory',
  "action:'paid'",
  "action:'reopened'",
  'paidAt',
  'to.min=from.value',
  'to.value=from.value',
  'cloudLogin=async function',
  "document.documentElement.dataset.role=''",
  'liveRoundTwoRoleStyle',
  'html[data-role="cleaning"] .top-actions{display:flex!important}',
  'html[data-role="cleaning"] .top-actions>button{display:none!important}',
  'html[data-role="staff"] #page-invoices .toolbar .btn.primary',
  'html[data-role="staff"] #page-invoices .req-actions button:not(.view-only)',
  'billingSettingsPanel',
  'finishCleaningJob=function',
  'job.completedBy=who.name',
  "['cloudAccount','cloudUsersPanel','cloudAuditPanel','ownPasswordPanel']"
]){
  if(!fixes.includes(text))throw new Error('Live-Test-Runde-2-Fix fehlt: '+text);
}

if(!taskUndo.includes('Rückgängig'))throw new Error('Aufgaben-Rückgängig fehlt weiterhin');
if(!entry.includes('task-history-undo.js'))throw new Error('Aufgaben-Rückgängig wird im Produktions-Worker nicht geladen');
if(!entry.includes('live-test-fixes-round-two.js'))throw new Error('Live-Test-Runde-2-Fixes werden im Produktions-Worker nicht geladen');
if(entry.indexOf('live-test-fixes-round-two.js')<entry.indexOf('task-history-undo.js'))throw new Error('Runde-2-Fixes müssen nach den bisherigen Live-Fixes geladen werden');

console.log('Live test round two smoke test OK');
