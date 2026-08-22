import fs from 'node:fs';
const code=fs.readFileSync('completion.js','utf8');
const expect=(value,msg)=>{if(!value)throw new Error(msg)};
for(const text of [
  'cloudUserModal',
  'saveCloudUserModal',
  'changeCloudUserRole',
  'toggleCloudUserActive',
  'Änderungsprotokoll',
  "fetch('/api/audit')",
  'loadAuditLog',
  'Öffentliche Buchungsseite'
])expect(code.includes(text),'Admin-/Audit-UI fehlt: '+text);
expect(code.includes("openCloudUserDialog=function()"),'Prompt-basierte Benutzeranlage wird nicht überschrieben');
expect(!code.includes("prompt('Name des neuen Benutzers"),'completion.js darf keine Browser-Prompt-Benutzeranlage enthalten');
console.log('Admin + audit UI smoke test OK');
