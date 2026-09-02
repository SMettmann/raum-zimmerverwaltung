(function(){
  if(window.__raumsuiteCateringLoaded)return;
  window.__raumsuiteCateringLoaded=true;

  function injectStyles(){
    if(document.getElementById('raumsuiteCateringStyles'))return;
    const style=document.createElement('style');
    style.id='raumsuiteCateringStyles';
    style.textContent=`
      .cal-catering{display:block;font-size:10px;line-height:1.2;opacity:.82;margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
      .booking-catering-cell{min-width:145px}
      .booking-catering-cell .row-meta{margin-top:2px}
    `;
    document.head.appendChild(style);
  }

  function injectFields(){
    if(document.getElementById('bookingCatering'))return;
    const noteField=document.getElementById('bookingNote')?.closest('.field');
    if(!noteField)return;
    noteField.insertAdjacentHTML('beforebegin',`
      <div class="two" id="bookingCateringRow">
        <div class="field">
          <label>Verpflegung</label>
          <select id="bookingCatering">
            <option value="">Nicht angegeben</option>
            <option>Keine</option>
            <option>Frühstück</option>
            <option>Halbpension</option>
            <option>Vollverpflegung</option>
            <option>Selbstversorgung</option>
            <option>Individuell</option>
          </select>
        </div>
        <div class="field">
          <label>Personen Verpflegung</label>
          <input id="bookingCateringParticipants" type="number" min="1" placeholder="z. B. 25">
        </div>
      </div>
      <div class="field" id="bookingCateringNoteField">
        <label>Hinweise zur Verpflegung</label>
        <input id="bookingCateringNote" placeholder="z. B. vegetarisch, Allergien, spätes Abendessen">
      </div>`);
    const participants=document.getElementById('bookingParticipants');
    participants?.addEventListener('input',()=>{
      const target=document.getElementById('bookingCateringParticipants');
      if(target&&!target.value)target.value=participants.value;
    });
  }

  function resetCatering(){
    injectFields();
    const type=document.getElementById('bookingCatering');
    const count=document.getElementById('bookingCateringParticipants');
    const note=document.getElementById('bookingCateringNote');
    if(type)type.value='';
    if(count)count.value='';
    if(note)note.value='';
  }

  function fillCatering(b){
    injectFields();
    const type=document.getElementById('bookingCatering');
    const count=document.getElementById('bookingCateringParticipants');
    const note=document.getElementById('bookingCateringNote');
    if(type)type.value=b?.catering||'';
    if(count)count.value=b?.cateringParticipants||'';
    if(note)note.value=b?.cateringNote||'';
  }

  function cateringSummary(b,prefix=true){
    if(!b?.catering)return '';
    const people=b.cateringParticipants?` · ${b.cateringParticipants} Pers.`:'';
    return `${prefix?'Verpflegung: ':''}${b.catering}${people}`;
  }

  function ensureBookingTableHeader(){
    const row=document.querySelector('#bookingListPanel table thead tr');
    if(!row||row.querySelector('[data-catering-head]'))return;
    const status=[...row.children].find(th=>th.textContent.trim()==='Status');
    const th=document.createElement('th');
    th.dataset.cateringHead='1';
    th.textContent='Verpflegung';
    row.insertBefore(th,status||row.lastElementChild);
  }

  function renderCateringBookingTable(){
    const body=document.getElementById('bookingTable');
    if(!body)return;
    ensureBookingTableHeader();
    const q=(document.getElementById('bookingSearch')?.value||'').toLowerCase();
    const list=[...bookings]
      .filter(b=>[b.guest,roomName(b.roomId),b.purpose,b.from,b.to,b.catering,b.cateringNote,b.cateringParticipants].join(' ').toLowerCase().includes(q))
      .sort((a,b)=>b.from.localeCompare(a.from));
    body.innerHTML=list.length?list.map(b=>{
      const st=bookingState(b);
      const catering=b.catering
        ?`<strong>${esc(b.catering)}</strong>${b.cateringParticipants?`<div class="row-meta">${esc(b.cateringParticipants)} Personen</div>`:''}${b.cateringNote?`<div class="row-meta">${esc(b.cateringNote)}</div>`:''}`
        :'–';
      return `<tr><td>${fmtDate(b.from)} – ${fmtDate(b.to)}</td><td><strong>${esc(b.guest)}</strong></td><td>${esc(roomName(b.roomId))}</td><td>${esc(b.purpose||'–')}</td><td class="booking-catering-cell">${catering}</td><td><span class="badge ${st[1]}">${st[0]}</span></td><td><div class="row-actions"><button class="btn small" onclick="editBooking('${b.id}')">Bearbeiten</button><button class="btn small danger" onclick="deleteBooking('${b.id}')">Löschen</button></div></td></tr>`;
    }).join(''):'<tr><td colspan="7"><div class="empty">Keine Buchungen gefunden.</div></td></tr>';
  }

  function decorateCalendarCatering(){
    document.querySelectorAll('#calendarGrid .cal-event').forEach(event=>{
      event.querySelector('.cal-catering')?.remove();
      const onclick=event.getAttribute('onclick')||'';
      const id=onclick.match(/editBooking\(['\"]([^'\"]+)['\"]\)/)?.[1];
      const b=id?bookings.find(x=>x.id===id):null;
      if(!b?.catering)return;
      const line=document.createElement('span');
      line.className='cal-catering';
      line.textContent=cateringSummary(b,false);
      event.appendChild(line);
      event.title=`${b.guest} – ${roomName(b.roomId)} – ${cateringSummary(b)}`;
    });
  }

  function decorateDashboardCatering(){
    const rows=[...document.querySelectorAll('#dashboardBookings > .row')];
    if(!rows.length)return;
    const t=todayIso();
    const upcoming=[...bookings].filter(b=>b.status!=='cancelled'&&b.to>=t).sort((a,b)=>a.from.localeCompare(b.from)).slice(0,6);
    rows.forEach((row,i)=>{
      const b=upcoming[i];
      const meta=row.querySelector('.row-meta');
      if(!b?.catering||!meta||meta.dataset.cateringAdded)return;
      meta.dataset.cateringAdded='1';
      meta.insertAdjacentHTML('beforeend',`<br><span>${esc(cateringSummary(b))}</span>`);
    });
  }

  function applyDemoCatering(){
    if(typeof bookings==='undefined'||!Array.isArray(bookings))return;
    const isDemo=settings?.org==='Tagungs- & Gästehaus Beispiel'||bookings.some(b=>b.id==='b1'&&b.guest==='Bildungsforum Beispiel e.V.');
    if(!isDemo)return;
    const examples={
      b1:['Vollverpflegung',46,'Vegetarische Optionen berücksichtigen'],
      b3:['Halbpension',28,'Abendessen am Anreisetag'],
      b4:['Vollverpflegung',54,'Vegetarisch und Allergien nach Teilnehmerliste'],
      b8:['Selbstversorgung',24,'Nutzung der vorhandenen Selbstversorgerküche']
    };
    let changed=false;
    for(const [id,[catering,count,note]] of Object.entries(examples)){
      const b=bookings.find(x=>x.id===id);
      if(b&&(!b.catering||!b.cateringParticipants)){
        Object.assign(b,{catering,cateringParticipants:count,cateringNote:b.cateringNote||note});
        changed=true;
      }
    }
    if(changed&&typeof persistLocal==='function')persistLocal();
  }

  injectStyles();
  injectFields();
  applyDemoCatering();

  if(typeof openBookingModal==='function'){
    const original=openBookingModal;
    openBookingModal=function(...args){
      const result=original.apply(this,args);
      if(!args[0])resetCatering();
      return result;
    };
  }

  if(typeof editBooking==='function'){
    const original=editBooking;
    editBooking=function(id,...rest){
      const result=original.call(this,id,...rest);
      fillCatering(bookings.find(b=>b.id===id));
      return result;
    };
  }

  if(typeof saveBooking==='function'){
    const original=saveBooking;
    saveBooking=function(...args){
      injectFields();
      const editId=document.getElementById('bookingId')?.value||'';
      const beforeLength=bookings.length;
      const extra={
        catering:document.getElementById('bookingCatering')?.value||'',
        cateringParticipants:Number(document.getElementById('bookingCateringParticipants')?.value)||null,
        cateringNote:document.getElementById('bookingCateringNote')?.value.trim()||''
      };
      const result=original.apply(this,args);
      const modalOpen=document.getElementById('bookingModal')?.classList.contains('show');
      let saved=null;
      if(editId&&!modalOpen)saved=bookings.find(b=>b.id===editId);
      if(!editId&&bookings.length>beforeLength)saved=bookings[bookings.length-1];
      if(saved){
        Object.assign(saved,extra);
        persist();
        renderAll();
      }
      return result;
    };
  }

  if(typeof renderBookingTable==='function'){
    const original=renderBookingTable;
    renderBookingTable=function(...args){
      const result=original.apply(this,args);
      renderCateringBookingTable();
      return result;
    };
  }

  if(typeof renderCalendar==='function'){
    const original=renderCalendar;
    renderCalendar=function(...args){
      const result=original.apply(this,args);
      decorateCalendarCatering();
      return result;
    };
  }

  if(typeof renderDashboard==='function'){
    const original=renderDashboard;
    renderDashboard=function(...args){
      const result=original.apply(this,args);
      decorateDashboardCatering();
      return result;
    };
  }

  if(typeof createConfirmation==='function'){
    createConfirmation=function(){
      const id=document.getElementById('documentBooking').value,b=bookings.find(x=>x.id===id);
      if(!b)return alert('Bitte zuerst eine Buchung anlegen.');
      const r=rooms.find(x=>x.id===b.roomId),w=window.open('','_blank');
      const catering=b.catering?`<div class="row"><b>Verpflegung</b><span>${esc(b.catering)}${b.cateringParticipants?` · ${b.cateringParticipants} Personen`:''}</span></div><div class="row"><b>Verpflegungshinweis</b><span>${esc(b.cateringNote||'–')}</span></div>`:'';
      w.document.write(`<!doctype html><html><head><title>Buchungsbestätigung</title><style>body{font-family:Arial;max-width:760px;margin:50px auto;color:#172033;line-height:1.5}h1{margin-bottom:4px}.box{border:1px solid #ddd;border-radius:12px;padding:20px;margin:24px 0}.row{display:grid;grid-template-columns:180px 1fr;padding:7px 0;border-bottom:1px solid #eee}.row:last-child{border:0}.muted{color:#666}@media print{button{display:none}}</style></head><body><h1>${esc(settings.org||'Raum- & Zimmerverwaltung')}</h1><div class="muted">Buchungsbestätigung</div><div class="box"><div class="row"><b>Gast / Kunde</b><span>${esc(b.guest)}</span></div><div class="row"><b>Raum / Zimmer</b><span>${esc(r?.name||'')}</span></div><div class="row"><b>Zeitraum</b><span>${fmtDate(b.from)} – ${fmtDate(b.to)}</span></div><div class="row"><b>Zweck</b><span>${esc(b.purpose||'–')}</span></div><div class="row"><b>Teilnehmer</b><span>${b.participants||'–'}</span></div>${catering}<div class="row"><b>Notiz</b><span>${esc(b.note||'–')}</span></div></div><p>${esc(settings.address||'')}</p><p>${esc(settings.email||'')} ${settings.phone?'· '+esc(settings.phone):''}</p><button onclick="window.print()">Drucken / als PDF speichern</button></body></html>`);
      w.document.close();
      closeModal('documentModal');
    };
  }

  if(typeof exportBookingsCsv==='function'){
    exportBookingsCsv=function(){
      const rows=[['Von','Bis','Gast/Kunde','Raum','Zweck','Teilnehmer','Verpflegung','Personen Verpflegung','Verpflegungshinweis','Status'],...bookings.map(b=>[b.from,b.to,b.guest,roomName(b.roomId),b.purpose||'',b.participants||'',b.catering||'',b.cateringParticipants||'',b.cateringNote||'',b.status])];
      downloadFile('buchungen.csv','\ufeff'+rows.map(r=>r.map(csvCell).join(';')).join('\n'),'text/csv;charset=utf-8');
      toast('CSV exportiert');
    };
  }

  let attempts=0;
  const timer=setInterval(()=>{
    attempts++;
    if(typeof window.startPresentation==='function'&&!window.startPresentation._catering){
      const original=window.startPresentation;
      const wrapped=function(...args){
        const result=original.apply(this,args);
        applyDemoCatering();
        renderAll();
        return result;
      };
      wrapped._catering=true;
      window.startPresentation=wrapped;
      clearInterval(timer);
    }
    if(attempts>100)clearInterval(timer);
  },100);

  setTimeout(()=>{
    applyDemoCatering();
    injectFields();
    if(typeof renderAll==='function')renderAll();
  },0);
})();
