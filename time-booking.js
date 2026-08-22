/* RAUMWERK: Uhrzeitbuchungen nur für Seminar-/Tagesräume, Übernachtungszimmer bleiben tagesweise. */
(function(){
  const TIMED_ROOM_TYPES=new Set(['Seminarraum','Besprechungsraum','Veranstaltungsraum']);
  const roomById=id=>rooms.find(r=>r.id===id);
  const isTimedRoom=roomId=>TIMED_ROOM_TYPES.has(roomById(roomId)?.type||'');
  window.isTimedBookableRoom=isTimedRoom;

  function validTime(v){return /^([01]\d|2[0-3]):[0-5]\d$/.test(String(v||''))}
  function timedStart(from,time){return `${from}T${validTime(time)?time:'00:00'}`}
  function timedEnd(to,time){return `${to}T${validTime(time)?time:'23:59'}${validTime(time)?'':':59'}`}
  function timedOverlap(a,b){return timedStart(a.from,a.fromTime)<timedEnd(b.to,b.toTime)&&timedEnd(a.to,a.toTime)>timedStart(b.from,b.fromTime)}
  function bookingPeriodText(b){
    if(isTimedRoom(b.roomId)&&b.fromTime&&b.toTime){
      if(b.from===b.to)return `${fmtDate(b.from)} · ${esc(b.fromTime)}–${esc(b.toTime)}`;
      return `${fmtDate(b.from)} ${esc(b.fromTime)} – ${fmtDate(b.to)} ${esc(b.toTime)}`;
    }
    return `${fmtDate(b.from)} – ${fmtDate(b.to)}`;
  }
  window.bookingPeriodText=bookingPeriodText;

  function setupTimeBookingUi(){
    const room=document.getElementById('bookingRoom'),from=document.getElementById('bookingFrom');
    if(!room||!from)return;
    if(!document.getElementById('bookingTimeRow')){
      from.closest('.two')?.insertAdjacentHTML('afterend',`<div class="two" id="bookingTimeRow"><div class="field"><label>Von Uhrzeit *</label><input id="bookingFromTime" type="time" value="09:00"></div><div class="field"><label>Bis Uhrzeit *</label><input id="bookingToTime" type="time" value="17:00"></div></div>`);
    }
    if(room.dataset.timeBookingBound!=='1'){
      room.dataset.timeBookingBound='1';
      room.addEventListener('change',syncTimeFields);
    }
    syncTimeFields();
  }

  function syncTimeFields(){
    const row=document.getElementById('bookingTimeRow'),roomId=document.getElementById('bookingRoom')?.value;
    if(!row)return;
    const timed=isTimedRoom(roomId);
    row.style.display=timed?'grid':'none';
    const fromTime=document.getElementById('bookingFromTime'),toTime=document.getElementById('bookingToTime');
    if(timed){if(!fromTime.value)fromTime.value='09:00';if(!toTime.value)toTime.value='17:00'}
    else {fromTime.value='';toTime.value=''}
  }
  window.syncBookingTimeFields=syncTimeFields;

  bookingConflict=function(roomId,from,to,ignoreId='',fromTime='',toTime=''){
    const timed=isTimedRoom(roomId);
    const candidate={from,to,fromTime,toTime};
    const booked=bookings.some(b=>{
      if(b.id===ignoreId||b.status==='cancelled'||b.roomId!==roomId)return false;
      return timed?timedOverlap(candidate,b):overlaps(from,to,b.from,b.to);
    });
    const blocked=typeof blocks!=='undefined'&&blocks.some(b=>b.roomId===roomId&&overlaps(from,to,b.from,b.to));
    return booked||blocked;
  };

  openBookingModal=function(id=null,date=null){
    setupTimeBookingUi();hideFormError('bookingError');
    document.getElementById('bookingId').value='';document.getElementById('bookingModalTitle').textContent='Neue Buchung';
    document.getElementById('bookingGuest').value='';document.getElementById('bookingPurpose').value='';document.getElementById('bookingParticipants').value='';document.getElementById('bookingNote').value='';document.getElementById('bookingStatus').value='confirmed';
    document.getElementById('bookingFrom').value=date||todayIso();document.getElementById('bookingTo').value=date||todayIso();
    fillSelectors();document.getElementById('bookingFromTime').value='09:00';document.getElementById('bookingToTime').value='17:00';syncTimeFields();
    if(id)editBooking(id,true);else showModal('bookingModal');
  };

  editBooking=function(id,alreadyOpen=false){
    setupTimeBookingUi();const b=bookings.find(x=>x.id===id);if(!b)return;hideFormError('bookingError');
    document.getElementById('bookingId').value=b.id;document.getElementById('bookingModalTitle').textContent='Buchung bearbeiten';document.getElementById('bookingGuest').value=b.guest;document.getElementById('bookingRoom').value=b.roomId;document.getElementById('bookingFrom').value=b.from;document.getElementById('bookingTo').value=b.to;document.getElementById('bookingPurpose').value=b.purpose||'';document.getElementById('bookingParticipants').value=b.participants||'';document.getElementById('bookingStatus').value=b.status||'confirmed';document.getElementById('bookingNote').value=b.note||'';
    document.getElementById('bookingFromTime').value=b.fromTime||'09:00';document.getElementById('bookingToTime').value=b.toTime||'17:00';syncTimeFields();
    if(!alreadyOpen)showModal('bookingModal');
  };

  saveBooking=function(){
    setupTimeBookingUi();hideFormError('bookingError');
    const id=document.getElementById('bookingId').value,roomId=document.getElementById('bookingRoom').value,guest=document.getElementById('bookingGuest').value.trim(),from=document.getElementById('bookingFrom').value,to=document.getElementById('bookingTo').value,status=document.getElementById('bookingStatus').value,timed=isTimedRoom(roomId);
    const fromTime=timed?document.getElementById('bookingFromTime').value:'',toTime=timed?document.getElementById('bookingToTime').value:'';
    if(!guest||!roomId||!from||!to)return showFormError('bookingError','Bitte Gast/Kunde, Raum und Zeitraum vollständig angeben.');
    if(to<from)return showFormError('bookingError','Das Bis-Datum darf nicht vor dem Von-Datum liegen.');
    if(timed&&(!validTime(fromTime)||!validTime(toTime)))return showFormError('bookingError','Bitte für diesen Raum eine Von- und Bis-Uhrzeit angeben.');
    if(timed&&timedStart(from,fromTime)>=timedStart(to,toTime))return showFormError('bookingError','Die Endzeit muss nach der Startzeit liegen.');
    if(status!=='cancelled'&&bookingConflict(roomId,from,to,id,fromTime,toTime))return showFormError('bookingError',`${roomName(roomId)} ist in diesem Zeitraum bereits belegt oder gesperrt.`);
    const old=id?bookings.find(b=>b.id===id):null;
    const data={id:id||uid(),roomId,guest,from,to,fromTime:timed?fromTime:'',toTime:timed?toTime:'',purpose:document.getElementById('bookingPurpose').value.trim(),participants:Number(document.getElementById('bookingParticipants').value)||null,status,note:document.getElementById('bookingNote').value.trim(),createdAt:old?.createdAt||new Date().toISOString(),...(old?.source?{source:old.source}:{})};
    if(id)bookings=bookings.map(b=>b.id===id?data:b);else bookings.push(data);
    ensureGuestFromBooking(guest);persist();closeModal('bookingModal');renderAll();toast(id?'Buchung geändert':'Buchung gespeichert');
  };

  openBookingModalForRoom=function(id){openBookingModal();document.getElementById('bookingRoom').value=id;syncTimeFields()};

  renderBookingTable=function(){
    const body=document.getElementById('bookingTable');if(!body)return;const q=(document.getElementById('bookingSearch')?.value||'').toLowerCase();
    const list=[...bookings].filter(b=>[b.guest,roomName(b.roomId),b.purpose,b.from,b.to,b.fromTime,b.toTime].join(' ').toLowerCase().includes(q)).sort((a,b)=>(b.from+(b.fromTime||'')).localeCompare(a.from+(a.fromTime||'')));
    body.innerHTML=list.length?list.map(b=>{const st=bookingState(b);return `<tr><td>${bookingPeriodText(b)}</td><td><strong>${esc(b.guest)}</strong></td><td>${esc(roomName(b.roomId))}</td><td>${esc(b.purpose||'–')}</td><td><span class="badge ${st[1]}">${st[0]}</span></td><td><div class="row-actions"><button class="btn small" onclick="editBooking('${b.id}')">Bearbeiten</button><button class="btn small danger" onclick="deleteBooking('${b.id}')">Löschen</button></div></td></tr>`}).join(''):'<tr><td colspan="6"><div class="empty">Keine Buchungen gefunden.</div></td></tr>';
  };

  renderCalendar=function(){
    const grid=document.getElementById('calendarGrid');if(!grid)return;const y=currentMonth.getFullYear(),m=currentMonth.getMonth();document.getElementById('calendarLabel').textContent=new Intl.DateTimeFormat('de-DE',{month:'long',year:'numeric'}).format(currentMonth);const weekdays=['Mo','Di','Mi','Do','Fr','Sa','So'];let html=weekdays.map(w=>`<div class="weekday">${w}</div>`).join('');const first=new Date(y,m,1),offset=(first.getDay()+6)%7,start=new Date(y,m,1-offset);
    for(let i=0;i<42;i++){const d=new Date(start);d.setDate(start.getDate()+i);const iso=localIso(d),other=d.getMonth()!==m,isToday=iso===todayIso();const all=bookings.filter(b=>b.status!=='cancelled'&&b.from<=iso&&b.to>=iso),ev=all.slice(0,3);html+=`<div class="day ${other?'other':''} ${isToday?'today':''}" ondblclick="openBookingModal(null,'${iso}')"><div class="day-num">${d.getDate()}</div>${ev.map(b=>{const prefix=isTimedRoom(b.roomId)&&b.from===iso&&b.fromTime?`${esc(b.fromTime)} · `:'';return `<div class="cal-event" title="${esc(b.guest)} – ${esc(roomName(b.roomId))}" onclick="editBooking('${b.id}');event.stopPropagation()">${prefix}${esc(roomName(b.roomId))} · ${esc(b.guest)}</div>`}).join('')}${all.length>3?`<div class="cal-more">+ ${all.length-3} weitere</div>`:''}</div>`}
    grid.innerHTML=html;
  };

  fillDocumentPicker=function(){const s=document.getElementById('documentBooking');if(!s)return;const list=[...bookings].filter(b=>b.status!=='cancelled').sort((a,b)=>(b.from+(b.fromTime||'')).localeCompare(a.from+(a.fromTime||'')));s.innerHTML=list.length?list.map(b=>`<option value="${b.id}">${bookingPeriodText(b).replace(/&[^;]+;/g,'')} · ${esc(b.guest)} · ${esc(roomName(b.roomId))}</option>`).join(''):'<option value="">Keine Buchung vorhanden</option>'};

  createConfirmation=function(){
    const id=document.getElementById('documentBooking').value,b=bookings.find(x=>x.id===id);if(!b)return alert('Bitte zuerst eine Buchung anlegen.');const r=rooms.find(x=>x.id===b.roomId),w=window.open('','_blank');
    w.document.write(`<!doctype html><html><head><title>Buchungsbestätigung</title><style>body{font-family:Arial;max-width:760px;margin:50px auto;color:#172033;line-height:1.5}h1{margin-bottom:4px}.box{border:1px solid #ddd;border-radius:12px;padding:20px;margin:24px 0}.row{display:grid;grid-template-columns:180px 1fr;padding:7px 0;border-bottom:1px solid #eee}.row:last-child{border:0}.muted{color:#666}@media print{button{display:none}}</style></head><body><h1>${esc(settings.org||'Raum- & Zimmerverwaltung')}</h1><div class="muted">Buchungsbestätigung</div><div class="box"><div class="row"><b>Gast / Kunde</b><span>${esc(b.guest)}</span></div><div class="row"><b>Raum / Zimmer</b><span>${esc(r?.name||'')}</span></div><div class="row"><b>Zeitraum</b><span>${bookingPeriodText(b)}</span></div><div class="row"><b>Zweck</b><span>${esc(b.purpose||'–')}</span></div><div class="row"><b>Teilnehmerzahl</b><span>${b.participants||'–'}</span></div><div class="row"><b>Notiz</b><span>${esc(b.note||'–')}</span></div></div><p>${esc(settings.address||'')}</p><p>${esc(settings.email||'')} ${settings.phone?'· '+esc(settings.phone):''}</p><button onclick="window.print()">Drucken / als PDF speichern</button></body></html>`);w.document.close();closeModal('documentModal');
  };

  exportBookingsCsv=function(){const rows=[['Von','Von Uhrzeit','Bis','Bis Uhrzeit','Gast/Kunde','Raum','Zweck','Teilnehmerzahl','Status'],...bookings.map(b=>[b.from,b.fromTime||'',b.to,b.toTime||'',b.guest,roomName(b.roomId),b.purpose||'',b.participants||'',b.status])];downloadFile('buchungen.csv','\ufeff'+rows.map(r=>r.map(csvCell).join(';')).join('\n'),'text/csv;charset=utf-8');toast('CSV exportiert')};

  renderOnlineRequests=function(){
    const w=document.getElementById('onlineRequestList');if(!w)return;const list=[...bookingRequests].sort((a,b)=>(b.createdAt||'').localeCompare(a.createdAt||''));
    w.innerHTML=list.length?list.map(r=>`<div class="req-row"><div><b>${esc(r.name)} · ${esc(roomName(r.roomId))}</b><div class="row-meta">${bookingPeriodText(r)} · ${esc(r.email)}${r.purpose?' · '+esc(r.purpose):''}</div></div><div class="req-actions"><span class="badge ${r.status==='accepted'?'green':r.status==='rejected'?'red':'yellow'}">${r.status==='accepted'?'Übernommen':r.status==='rejected'?'Abgelehnt':'Neu'}</span>${r.status==='new'?`<button class="btn small primary" onclick="acceptOnlineRequest('${r.id}')">Annehmen</button><button class="btn small danger" onclick="rejectOnlineRequest('${r.id}')">Ablehnen</button>`:''}</div></div>`).join(''):'<div class="empty">Keine offenen Online-Buchungsanfragen.</div>';
  };

  acceptOnlineRequest=function(id){
    const r=bookingRequests.find(x=>x.id===id);if(!r)return;const timed=isTimedRoom(r.roomId);
    if(timed&&(!validTime(r.fromTime)||!validTime(r.toTime)))return alert('Für diesen Seminar-/Veranstaltungsraum fehlen Uhrzeiten in der Anfrage.');
    if(bookingConflict(r.roomId,r.from,r.to,'',r.fromTime||'',r.toTime||''))return alert('Der gewünschte Zeitraum ist inzwischen belegt oder gesperrt.');
    bookings.push({id:uid(),roomId:r.roomId,guest:r.name,from:r.from,to:r.to,fromTime:timed?(r.fromTime||''):'',toTime:timed?(r.toTime||''):'',purpose:r.purpose||'Online-Buchung',participants:r.participants||null,status:'confirmed',note:`Online-Anfrage · ${r.email}${r.phone?' · '+r.phone:''}${r.note?' · '+r.note:''}`,createdAt:new Date().toISOString(),source:'public-request'});
    ensureGuestFromBooking(r.name);const g=guests.find(g=>g.name.toLowerCase()===r.name.toLowerCase());if(g){g.email=g.email||r.email;g.phone=g.phone||r.phone}bookingRequests=bookingRequests.map(x=>x.id===id?{...x,status:'accepted'}:x);persist();renderAll();toast('Online-Anfrage als Buchung übernommen');
  };

  function currentHm(){const d=new Date();return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`}
  cleaningJobDue=function(job){if(job.status==='done'||!job.date)return false;const today=todayIso();if(job.date<today)return true;if(job.date>today)return false;return !job.time||job.time<=currentHm()};
  cleaningJobUpcoming=function(job){return job.status!=='done'&&!!job.date&&!cleaningJobDue(job)};

  reconcileCleaningData=function(){
    const today=todayIso();let changed=false;const activeBookings=cleaningActiveBookings(),activeBookingIds=new Set(activeBookings.map(b=>b.id));
    const filtered=cleaningPlans.filter(j=>!(j.auto&&j.bookingId&&j.status!=='done'&&!activeBookingIds.has(j.bookingId)));if(filtered.length!==cleaningPlans.length){cleaningPlans=filtered;changed=true}
    cleaningPlans.forEach(j=>{if(j.status==='doing'){j.status='planned';delete j.startedAt;changed=true}});
    activeBookings.forEach(b=>{const targetTime=isTimedRoom(b.roomId)&&b.toTime?b.toTime:'10:00';let job=cleaningPlans.find(j=>j.bookingId===b.id);if(!job){cleaningPlans.push({id:uid(),bookingId:b.id,roomId:b.roomId,date:b.to,time:targetTime,owner:'',note:'Automatisch nach Buchungsende',status:'planned',auto:true,source:'booking'});changed=true;return}if(job.status!=='done'&&(job.roomId!==b.roomId||job.date!==b.to||job.time!==targetTime)){job.roomId=b.roomId;job.date=b.to;job.time=targetTime;changed=true}});
    rooms.forEach(r=>{if(r.cleaning==='doing'){r.cleaning='open';changed=true}if(r.cleaning==='done')return;const activeForRoom=cleaningPlans.find(j=>j.roomId===r.id&&cleaningJobDue(j));if(!activeForRoom){cleaningPlans.push({id:uid(),bookingId:'',roomId:r.id,date:today,time:'',owner:'',note:'Reinigungsbedarf manuell gesetzt',status:'planned',auto:false,source:'room-status'});changed=true}});
    rooms=rooms.map(r=>{const due=cleaningPlans.some(j=>j.roomId===r.id&&cleaningJobDue(j));const next=due?'open':(r.cleaning==='open'?'done':r.cleaning);if(next!==r.cleaning){changed=true;return {...r,cleaning:next}}return r});
    if(changed)persist();return changed;
  };
  ensureCleaningPlans=function(){reconcileCleaningData()};
  finishCleaningJob=function(id){const job=cleaningPlans.find(j=>j.id===id);if(!job)return;job.status='done';job.completedAt=new Date().toISOString();delete job.startedAt;const otherActive=cleaningPlans.some(j=>j.id!==id&&j.roomId===job.roomId&&cleaningJobDue(j));rooms=rooms.map(r=>r.id===job.roomId?{...r,cleaning:otherActive?'open':'done'}:r);persist();renderAll();toast('Sauber bestätigt')};
  setCleaning=function(id,status){let job=cleaningPlans.find(j=>j.roomId===id&&cleaningJobDue(j));if(status==='done'){if(job)return finishCleaningJob(job.id);rooms=rooms.map(r=>r.id===id?{...r,cleaning:'done'}:r);persist();renderAll();return}if(!job){job={id:uid(),bookingId:'',roomId:id,date:todayIso(),time:'',owner:'',note:'Reinigungsbedarf manuell gesetzt',status:'planned',auto:false,source:'room-status'};cleaningPlans.push(job)}job.status='planned';rooms=rooms.map(r=>r.id===id?{...r,cleaning:'open'}:r);persist();renderAll()};

  setupTimeBookingUi();reconcileCleaningData();renderAll();
})();
