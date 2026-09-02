let publicRooms=[];let selectedRoom='';let currentAvailable=[];let bookingMode='request';
const WORKER_ORIGIN='https://raumsuite.mettmannsven8.workers.dev';
const staticGithubHost=location.hostname.endsWith('github.io');
const today=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`};
const timedType=type=>['Seminarraum','Besprechungsraum','Veranstaltungsraum'].includes(String(type||''));
const roomIsTimed=room=>room?.timed===true||timedType(room?.type);
if(staticGithubHost){location.replace(`${WORKER_ORIGIN}/booking.html${location.search}${location.hash}`)}else{
  document.getElementById('from').value=today();document.getElementById('to').value=today();
  document.getElementById('participants')?.addEventListener('input',()=>renderAvailableRooms());
  boot();
}

async function responseJson(r){const text=await r.text();try{return text?JSON.parse(text):{}}catch{throw new Error('Die Buchungsseite konnte keine gültige Antwort vom RAUMSUITE-Backend laden.')}}
async function boot(){
  try{
    const r=await fetch('/api/public/config',{headers:{Accept:'application/json'}}),d=await responseJson(r);
    if(!r.ok)throw new Error(d.error||'Online-Buchung ist noch nicht aktiv.');
    document.getElementById('orgName').textContent=d.organization||'Online-Buchung';
    publicRooms=Array.isArray(d.rooms)?d.rooms:[];bookingMode=d.mode==='direct'?'direct':'request';applyBookingMode();renderAvailableRooms();
  }catch(e){showError(e.message);document.getElementById('availabilityNote').textContent='Die Online-Buchung konnte nicht geladen werden.';}
}
function applyBookingMode(){
  const direct=bookingMode==='direct',title=document.getElementById('heroTitle'),text=document.getElementById('heroText'),button=document.getElementById('submitBooking');
  if(title)title.textContent=direct?'Raum oder Zimmer direkt buchen':'Raum oder Zimmer anfragen';
  if(text)text.textContent=direct?'Zeitraum auswählen. Anschließend werden ausschließlich aktuell freie Räume und Zimmer angezeigt.':'Zeitraum auswählen. Anschließend werden ausschließlich aktuell freie Räume und Zimmer angezeigt und können angefragt werden.';
  if(button)button.textContent=direct?'Jetzt verbindlich buchen':'Buchungsanfrage senden';
}
function validPeriod(from,to,fromTime,toTime){if(!from||!to||to<from)return false;if(from===to&&fromTime&&toTime&&fromTime>=toTime)return false;return true}
function suitableAvailable(){
  const ids=new Set(currentAvailable),people=Math.max(1,Number(v('participants'))||1);
  return publicRooms.filter(r=>ids.has(r.id)&&Number(r.capacity||1)>=people).sort((a,b)=>String(a.location||'').localeCompare(String(b.location||''))||String(a.name||'').localeCompare(String(b.name||'')));
}
function renderAvailableRooms(){
  const wrap=document.getElementById('rooms');if(!wrap)return;
  const list=suitableAvailable();
  if(!currentAvailable.length){wrap.innerHTML='';return;}
  wrap.innerHTML=list.map(r=>`<div class="room ${selectedRoom===r.id?'active':''}" onclick="selectRoom('${safe(r.id)}')"><h3>${safe(r.name)}</h3>${r.location?`<div class="muted"><b>${safe(r.location)}</b></div>`:''}<div class="muted">${safe(r.type)} · bis ${Number(r.capacity)||1} Pers.</div><div class="muted" style="margin-top:4px">${roomIsTimed(r)?'Buchbar mit Uhrzeit':'Tagesweise Buchung'}</div>${r.note?`<div class="muted" style="margin-top:6px">${safe(r.note)}</div>`:''}</div>`).join('');
  const note=document.getElementById('availabilityNote');
  if(note&&currentAvailable.length)note.textContent=list.length?`${list.length} passende freie Räume/Zimmer verfügbar. Bitte auswählen.`:'Für die angegebene Teilnehmerzahl ist aktuell kein passender freier Raum verfügbar.';
}
async function checkAvailability(){
  hideMessages();const from=v('from'),to=v('to'),fromTime=v('fromTime'),toTime=v('toTime');
  if(!validPeriod(from,to,fromTime,toTime))return showError('Bitte einen gültigen Zeitraum und passende Uhrzeiten auswählen.');
  try{
    const r=await fetch('/api/public/availability',{method:'POST',headers:{'Content-Type':'application/json',Accept:'application/json'},body:JSON.stringify({from,to,fromTime,toTime})}),d=await responseJson(r);
    if(!r.ok)throw new Error(d.error||'Verfügbarkeit konnte nicht geprüft werden.');
    selectedRoom='';currentAvailable=Array.isArray(d.rooms)?d.rooms:[];renderAvailableRooms();
    if(!currentAvailable.length)document.getElementById('availabilityNote').textContent='In diesem Zeitraum ist aktuell kein Raum oder Zimmer verfügbar.';
  }catch(e){showError(e.message);}
}
function selectRoom(id){
  if(!currentAvailable.includes(id))return;selectedRoom=id;renderAvailableRooms();
  const room=publicRooms.find(r=>r.id===id);
  document.getElementById('availabilityNote').textContent=roomIsTimed(room)?`Ausgewählt: ${room?.name||''}${room?.location?' · '+room.location:''} · ${v('fromTime')}–${v('toTime')} Uhr`:`Ausgewählt: ${room?.name||''}${room?.location?' · '+room.location:''} · tagesweise`;
}
async function sendRequest(){
  hideMessages();
  const payload={name:v('name'),email:v('email'),phone:v('phone'),purpose:v('purpose'),participants:Number(v('participants'))||1,note:v('note'),website:v('website'),roomId:selectedRoom,from:v('from'),to:v('to'),fromTime:v('fromTime'),toTime:v('toTime')};
  if(!payload.roomId)return showError('Bitte zuerst die Verfügbarkeit prüfen und einen freien Raum oder ein Zimmer auswählen.');
  if(!payload.name||!payload.email)return showError('Bitte Name und E-Mail ausfüllen.');
  const room=publicRooms.find(r=>r.id===payload.roomId);
  if(roomIsTimed(room)&&!validPeriod(payload.from,payload.to,payload.fromTime,payload.toTime))return showError('Bitte gültige Uhrzeiten für diesen Raum angeben.');
  if(room&&payload.participants>Number(room.capacity||1))return showError(`Dieser Raum ist für maximal ${Number(room.capacity)||1} Personen ausgelegt.`);
  try{
    const r=await fetch('/api/public/request',{method:'POST',headers:{'Content-Type':'application/json',Accept:'application/json'},body:JSON.stringify(payload)}),d=await responseJson(r);
    if(!r.ok)throw new Error(d.error||(bookingMode==='direct'?'Buchung konnte nicht abgeschlossen werden.':'Anfrage konnte nicht gesendet werden.'));
    document.getElementById('success').style.display='block';
    document.getElementById('success').textContent=d.message||(d.mode==='direct'?'Die Buchung wurde verbindlich bestätigt.':'Danke! Die Buchungsanfrage wurde an die Einrichtung übermittelt.');
    ['name','email','phone','purpose','note'].forEach(id=>document.getElementById(id).value='');selectedRoom='';await checkAvailability();
  }catch(e){showError(e.message);}
}
function v(id){return document.getElementById(id)?.value?.trim?.()||'';}
function showError(msg){const e=document.getElementById('error');e.textContent=msg;e.style.display='block';}
function hideMessages(){document.getElementById('error').style.display='none';document.getElementById('success').style.display='none';}
function safe(s){return String(s??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));}