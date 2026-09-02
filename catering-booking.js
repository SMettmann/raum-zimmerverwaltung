(function(){
  if(window.__raumsuiteCateringLoaded)return;
  window.__raumsuiteCateringLoaded=true;

  function injectStyles(){
    if(document.getElementById('raumsuiteCateringStyles'))return;
    const style=document.createElement('style');style.id='raumsuiteCateringStyles';
    style.textContent='.cal-catering{display:block;font-size:10px;line-height:1.2;opacity:.82;margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.booking-catering-cell{min-width:145px}.booking-catering-cell .row-meta{margin-top:2px}';
    document.head.appendChild(style);
  }

  function injectFields(){
    if(document.getElementById('bookingCatering'))return;
    const noteField=document.getElementById('bookingNote')?.closest('.field');if(!noteField)return;
    noteField.insertAdjacentHTML('beforebegin',`<div class="two" id="bookingCateringRow"><div class="field"><label>Verpflegung</label><select id="bookingCatering"><option value="">Nicht angegeben</option><option>Keine</option><option>Frühstück</option><option>Halbpension</option><option>Vollverpflegung</option><option>Selbstversorgung</option><option>Individuell</option></select></div><div class="field"><label>Personen Verpflegung</label><input id="bookingCateringParticipants" type="number" min="1" placeholder="z. B. 25"></div></div><div class="field" id="bookingCateringNoteField"><label>Hinweise zur Verpflegung</label><input id="bookingCateringNote" placeholder="z. B. vegetarisch, Allergien, spätes Abendessen"></div>`);
    const participants=document.getElementById('bookingParticipants');
    participants?.addEventListener('input',()=>{const target=document.getElementById('bookingCateringParticipants');if(target&&!target.value)target.value=participants.value;});
  }
  function resetCatering(){injectFields();document.getElementById('bookingCatering').value='';document.getElementById('bookingCateringParticipants').value='';document.getElementById('bookingCateringNote').value='';}
  function fillCatering(b){injectFields();document.getElementById('bookingCatering').value=b?.catering||'';document.getElementById('bookingCateringParticipants').value=b?.cateringParticipants||'';document.getElementById('bookingCateringNote').value=b?.cateringNote||'';}
  function cateringSummary(b,prefix=true){if(!b?.catering)return '';const people=b.cateringParticipants?` · ${b.cateringParticipants} Pers.`:'';return `${prefix?'Verpflegung: ':''}${b.catering}${people}`;}

  injectStyles();injectFields();

  if(typeof openBookingModal==='function'){
    const original=openBookingModal;
    openBookingModal=function(id=null,date=null){const result=original.call(this,id,date);if(!id)resetCatering();return result;};
  }
  if(typeof editBooking==='function'){
    const original=editBooking;
    editBooking=function(id,...rest){const result=original.call(this,id,...rest);fillCatering(bookings.find(b=>b.id===id));return result;};
  }

  saveBooking=function(){
    injectFields();hideFormError('bookingError');
    const id=document.getElementById('bookingId').value,roomId=document.getElementById('bookingRoom').value,guest=document.getElementById('bookingGuest').value.trim(),from=document.getElementById('bookingFrom').value,to=document.getElementById('bookingTo').value,status=document.getElementById('bookingStatus').value;
    if(!guest||!roomId||!from||!to)return showFormError('bookingError','Bitte Gast/Kunde, Raum und Zeitraum vollständig angeben.');
    if(to<from)return showFormError('bookingError','Das Bis-Datum darf nicht vor dem Von-Datum liegen.');
    if(status!=='cancelled'&&bookingConflict(roomId,from,to,id))return showFormError('bookingError',`${roomName(roomId)} ist in diesem Zeitraum bereits belegt.`);
    const previous=id?bookings.find(b=>b.id===id):null;
    const data={id:id||uid(),roomId,guest,from,to,purpose:document.getElementById('bookingPurpose').value.trim(),participants:Number(document.getElementById('bookingParticipants').value)||null,status,note:document.getElementById('bookingNote').value.trim(),catering:document.getElementById('bookingCatering').value||'',cateringParticipants:Number(document.getElementById('bookingCateringParticipants').value)||null,cateringNote:document.getElementById('bookingCateringNote').value.trim(),createdAt:previous?.createdAt||new Date().toISOString()};
    if(id)bookings=bookings.map(b=>b.id===id?data:b);else bookings.push(data);
    ensureGuestFromBooking(guest);persist();closeModal('bookingModal');renderAll();toast(id?'Buchung geändert':'Buchung gespeichert');
  };

  function ensureBookingTableHeader(){
    const row=document.querySelector('#bookingListPanel table thead tr');if(!row||row.querySelector('[data-catering-head]'))return;
    const status=[...row.children].find(th=>th.textContent.trim()==='Status'),th=document.createElement('th');th.dataset.cateringHead='1';th.textContent='Verpflegung';row.insertBefore(th,status||row.lastElementChild);
  }
  function renderCateringBookingTable(){
    const body=document.getElementById('bookingTable');if(!body)return;ensureBookingTableHeader();
    const q=(document.getElementById('bookingSearch')?.value||'').toLowerCase();
    const list=[...bookings].filter(b=>[b.guest,roomName(b.roomId),b.purpose,b.from,b.to,b.catering,b.cateringNote,b.cateringParticipants].join(' ').toLowerCase().includes(q)).sort((a,b)=>b.from.localeCompare(a.from));
    body.innerHTML=list.length?list.map(b=>{const st=bookingState(b),catering=b.catering?`<strong>${esc(b.catering)}</strong>${b.cateringParticipants?`<div class="row-meta">${esc(b.cateringParticipants)} Personen</div>`:''}${b.cateringNote?`<div class="row-meta">${esc(b.cateringNote)}</div>`:''}`:'–';return `<tr><td>${fmtDate(b.from)} – ${fmtDate(b.to)}</td><td><strong>${esc(b.guest)}</strong></td><td>${esc(roomName(b.roomId))}</td><td>${esc(b.purpose||'–')}</td><td class="booking-catering-cell">${catering}</td><td><span class="badge ${st[1]}">${st[0]}</span></td><td><div class="row-actions"><button class="btn small" onclick="editBooking('${b.id}')">Bearbeiten</button><button class="btn small danger" onclick="deleteBooking('${b.id}')">Löschen</button></div></td></tr>`;}).join(''):'<tr><td colspan="7"><div class="empty">Keine Buchungen gefunden.</div></td></tr>';
  }
  if(typeof renderBookingTable==='function'){
    const original=renderBookingTable;renderBookingTable=function(...args){const result=original.apply(this,args);renderCateringBookingTable();return result;};
  }

  function decorateCalendar(){
    document.querySelectorAll('#calendarGrid .cal-event').forEach(event=>{
      event.querySelector('.cal-catering')?.remove();const onclick=event.getAttribute('onclick')||'',id=onclick.match(/editBooking\(['\"]([^'\"]+)['\"]\)/)?.[1],b=id?bookings.find(x=>x.id===id):null;if(!b?.catering)return;
      const line=document.createElement('span');line.className='cal-catering';line.textContent=cateringSummary(b,false);event.appendChild(line);event.title=`${b.guest} – ${roomName(b.roomId)} – ${cateringSummary(b)}`;
    });
  }
  if(typeof renderCalendar==='function'){
    const original=renderCalendar;renderCalendar=function(...args){const result=original.apply(this,args);decorateCalendar();return result;};
  }

  function decorateDashboard(){
    const rows=[...document.querySelectorAll('#dashboardBookings > .row')];if(!rows.length)return;
    const t=todayIso(),upcoming=[...bookings].filter(b=>b.status!=='cancelled'&&b.to>=t).sort((a,b)=>a.from.localeCompare(b.from)).slice(0,6);
    rows.forEach((row,i)=>{const b=upcoming[i],meta=row.querySelector('.row-meta');if(!b?.catering||!meta||meta.dataset.cateringAdded)return;meta.dataset.cateringAdded='1';meta.insertAdjacentHTML('beforeend',`<br><span>Verpflegung: ${esc(b.catering)}${b.cateringParticipants?` · ${esc(b.cateringParticipants)} Pers.`:''}</span>`);});
  }
  if(typeof renderDashboard==='function'){
    const original=renderDashboard;renderDashboard=function(...args){const result=original.apply(this,args);decorateDashboard();return result;};
  }

  if(typeof createConfirmation==='function'){
    createConfirmation=function(){
      const id=document.getElementById('documentBooking').value,b=bookings.find(x=>x.id===id);if(!b)return alert('Bitte zuerst eine Buchung anlegen.');
      const r=rooms.find(x=>x.id===b.roomId),w=window.open('','_blank'),catering=b.catering?`<div class="row"><b>Verpflegung</b><span>${esc(b.catering)}${b.cateringParticipants?` · ${b.cateringParticipants} Personen`:''}</span></div><div class="row"><b>Verpflegungshinweis</b><span>${esc(b.cateringNote||'–')}</span></div>`:'';
      w.document.write(`<!doctype html><html><head><title>Buchungsbestätigung</title><style>body{font-family:Arial;max-width:760px;margin:50px auto;color:#172033;line-height:1.5}h1{margin-bottom:4px}.box{border:1px solid #ddd;border-radius:12px;padding:20px;margin:24px 0}.row{display:grid;grid-template-columns:180px 1fr;padding:7px 0;border-bottom:1px solid #eee}.row:last-child{border:0}.muted{color:#666}@media print{button{display:none}}</style></head><body><h1>${esc(settings.org||'Raum- & Zimmerverwaltung')}</h1><div class="muted">Buchungsbestätigung</div><div class="box"><div class="row"><b>Gast / Kunde</b><span>${esc(b.guest)}</span></div><div class="row"><b>Raum / Zimmer</b><span>${esc(r?.name||'')}</span></div><div class="row"><b>Zeitraum</b><span>${fmtDate(b.from)} – ${fmtDate(b.to)}</span></div><div class="row"><b>Zweck</b><span>${esc(b.purpose||'–')}</span></div><div class="row"><b>Teilnehmer</b><span>${b.participants||'–'}</span></div>${catering}<div class="row"><b>Notiz</b><span>${esc(b.note||'–')}</span></div></div><p>${esc(settings.address||'')}</p><p>${esc(settings.email||'')} ${settings.phone?'· '+esc(settings.phone):''}</p><button onclick="window.print()">Drucken / als PDF speichern</button></body></html>`);w.document.close();closeModal('documentModal');
    };
  }

  if(typeof exportBookingsCsv==='function'){
    exportBookingsCsv=function(){const rows=[['Von','Bis','Gast/Kunde','Raum','Zweck','Teilnehmer','Verpflegung','Personen Verpflegung','Verpflegungshinweis','Status'],...bookings.map(b=>[b.from,b.to,b.guest,roomName(b.roomId),b.purpose||'',b.participants||'',b.catering||'',b.cateringParticipants||'',b.cateringNote||'',b.status])];downloadFile('buchungen.csv','\ufeff'+rows.map(r=>r.map(csvCell).join(';')).join('\n'),'text/csv;charset=utf-8');toast('CSV exportiert');};
  }

  setTimeout(()=>{injectFields();if(typeof renderAll==='function')renderAll();},0);
})();