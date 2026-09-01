(function(){
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

  function cateringSummary(b){
    if(!b?.catering)return '';
    const people=b.cateringParticipants?` · ${b.cateringParticipants} Pers.`:'';
    return `Verpflegung: ${b.catering}${people}`;
  }

  injectFields();

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
      const body=document.getElementById('bookingTable');
      if(!body)return result;
      const q=(document.getElementById('bookingSearch')?.value||'').toLowerCase();
      const list=[...bookings].filter(b=>[b.guest,roomName(b.roomId),b.purpose,b.from,b.to,b.catering,b.cateringNote].join(' ').toLowerCase().includes(q)).sort((a,b)=>b.from.localeCompare(a.from));
      [...body.querySelectorAll('tr')].forEach((tr,i)=>{
        const b=list[i];
        const cell=tr.children?.[3];
        if(!b||!cell||!b.catering)return;
        const line=document.createElement('div');
        line.className='row-meta';
        line.textContent=cateringSummary(b)+(b.cateringNote?` · ${b.cateringNote}`:'');
        cell.appendChild(line);
      });
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
        const examples={
          b1:['Vollverpflegung',46,'Vegetarische Optionen berücksichtigen'],
          b3:['Halbpension',28,'Abendessen am Anreisetag'],
          b4:['Vollverpflegung',54,'Vegetarisch und Allergien nach Teilnehmerliste'],
          b8:['Selbstversorgung',24,'Nutzung der vorhandenen Selbstversorgerküche']
        };
        for(const [id,[catering,count,note]] of Object.entries(examples)){
          const b=bookings.find(x=>x.id===id);
          if(b)Object.assign(b,{catering,cateringParticipants:count,cateringNote:note});
        }
        if(typeof persistLocal==='function')persistLocal();
        renderAll();
        return result;
      };
      wrapped._catering=true;
      window.startPresentation=wrapped;
      clearInterval(timer);
    }
    if(attempts>100)clearInterval(timer);
  },100);
})();
