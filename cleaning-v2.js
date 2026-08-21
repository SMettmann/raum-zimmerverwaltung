/* RAUMWERK Reinigung V2 – planen, reinigen, sauber bestätigen */

function setupCleaningV2Ui(){
  const page=document.getElementById('page-cleaning');
  if(!page||document.getElementById('cleaningV2DueList'))return;
  page.innerHTML=`
    <div class="cards cleaning-v2-stats">
      <div class="card"><div class="label">Zu reinigen</div><div class="metric" id="cleanV2Due">0</div><div class="metric-sub">heute oder überfällig</div></div>
      <div class="card"><div class="label">Heute erledigt</div><div class="metric" id="cleanV2Done">0</div><div class="metric-sub">heute als sauber bestätigt</div></div>
      <div class="card"><div class="label">Demnächst</div><div class="metric" id="cleanV2Upcoming">0</div><div class="metric-sub">zukünftig eingeplant</div></div>
      <div class="card"><div class="label">Saubere Räume</div><div class="metric" id="cleanV2Clean">0</div><div class="metric-sub">aktuell kein Reinigungsbedarf</div></div>
    </div>

    <div class="panel cleaning-v2-main">
      <div class="panel-head">
        <div><h2>Zu reinigen</h2><div class="muted">Hier steht nur, was erledigt werden muss. Danach einmal als sauber bestätigen.</div></div>
        <button class="btn primary small" onclick="openCleaningPlanModal()">+ Reinigung planen</button>
      </div>
      <div id="cleaningV2DueList"></div>
    </div>

    <div class="grid-equal cleaning-v2-bottom" style="margin-top:18px">
      <div class="panel">
        <div class="panel-head"><div><h2>Kommende Reinigungen</h2><div class="muted">Automatisch aus Buchungen oder manuell geplant.</div></div></div>
        <div id="cleaningV2UpcomingList"></div>
      </div>
      <div class="panel">
        <div class="panel-head"><div><h2>Saubere Räume</h2><div class="muted">Aktuell kein Reinigungsbedarf.</div></div></div>
        <div id="cleaningV2CleanRooms"></div>
      </div>
    </div>`;

  if(!document.getElementById('cleaningV2Style')){
    const style=document.createElement('style');
    style.id='cleaningV2Style';
    style.textContent=`
      .clean-v2-row{display:grid;grid-template-columns:minmax(220px,1.3fr) minmax(190px,1fr) auto;gap:18px;align-items:center;padding:16px 0;border-top:1px solid var(--line)}
      .clean-v2-row:first-child{border-top:0}
      .clean-v2-title{font-weight:900;font-size:15px;margin-bottom:4px}
      .clean-v2-meta{font-size:12px;color:#78839a;line-height:1.45}
      .clean-v2-action{display:flex;align-items:center;gap:10px;justify-content:flex-end}
      .clean-v2-state{display:inline-flex;align-items:center;border-radius:999px;padding:6px 10px;font-size:12px;font-weight:900;white-space:nowrap}
      .clean-v2-state.due{background:#fff0e8;color:#a94b19}.clean-v2-state.overdue{background:#ffeded;color:#a12222}.clean-v2-state.done{background:#e8f8ef;color:#167247}
      .clean-v2-clean-grid{display:flex;flex-wrap:wrap;gap:8px}.clean-v2-clean-pill{padding:8px 11px;border-radius:10px;background:#eef9f3;color:#176a45;font-size:12px;font-weight:800;border:1px solid #d9f0e3}
      .clean-v2-upcoming-row{display:flex;justify-content:space-between;gap:12px;align-items:center;padding:13px 0;border-top:1px solid var(--line)}.clean-v2-upcoming-row:first-child{border-top:0}
      @media(max-width:850px){.clean-v2-row{grid-template-columns:1fr;gap:8px}.clean-v2-action{justify-content:flex-start}.clean-v2-bottom{grid-template-columns:1fr!important}}
    `;
    document.head.appendChild(style);
  }
}

function cleaningActiveBookings(){return bookings.filter(b=>b.status!=='cancelled')}
function cleaningJobDue(job){return job.status!=='done'&&job.date&&job.date<=todayIso()}
function cleaningJobUpcoming(job){return job.status!=='done'&&job.date>todayIso()}
function cleaningDoneToday(job){return job.status==='done'&&((job.completedAt||'').slice(0,10)===todayIso()||(!job.completedAt&&job.date===todayIso()))}

function reconcileCleaningData(){
  const today=todayIso();
  let changed=false;
  const activeBookings=cleaningActiveBookings();
  const activeBookingIds=new Set(activeBookings.map(b=>b.id));

  const filtered=cleaningPlans.filter(j=>!(j.auto&&j.bookingId&&j.status!=='done'&&!activeBookingIds.has(j.bookingId)));
  if(filtered.length!==cleaningPlans.length){cleaningPlans=filtered;changed=true}

  cleaningPlans.forEach(j=>{
    if(j.status==='doing'){
      j.status='planned';delete j.startedAt;changed=true;
    }
  });

  activeBookings.forEach(b=>{
    let job=cleaningPlans.find(j=>j.bookingId===b.id);
    if(!job){
      cleaningPlans.push({id:uid(),bookingId:b.id,roomId:b.roomId,date:b.to,time:'10:00',owner:'',note:'Automatisch nach Buchungsende',status:'planned',auto:true,source:'booking'});
      changed=true;
      return;
    }
    if(job.status!=='done'&&(job.roomId!==b.roomId||job.date!==b.to)){
      job.roomId=b.roomId;job.date=b.to;changed=true;
    }
  });

  rooms.forEach(r=>{
    if(r.cleaning==='doing'){r.cleaning='open';changed=true}
    if(r.cleaning==='done')return;
    const activeForRoom=cleaningPlans.find(j=>j.roomId===r.id&&j.status!=='done'&&j.date<=today);
    if(!activeForRoom){
      cleaningPlans.push({id:uid(),bookingId:'',roomId:r.id,date:today,time:'',owner:'',note:'Reinigungsbedarf manuell gesetzt',status:'planned',auto:false,source:'room-status'});
      changed=true;
    }
  });

  rooms=rooms.map(r=>{
    const due=cleaningPlans.some(j=>j.roomId===r.id&&j.status!=='done'&&j.date<=today);
    const next=due?'open':r.cleaning;
    if(next!==r.cleaning){changed=true;return {...r,cleaning:next}}
    return r;
  });

  if(changed)persist();
  return changed;
}

ensureCleaningPlans=function(){reconcileCleaningData()};

function cleaningV2State(job){
  if(job.date<todayIso())return {label:'Überfällig',cls:'overdue'};
  return {label:'Zu reinigen',cls:'due'};
}

function renderCleaningV2(){
  setupCleaningV2Ui();
  reconcileCleaningData();
  const due=cleaningPlans.filter(cleaningJobDue).sort(cleaningSort);
  const upcoming=cleaningPlans.filter(cleaningJobUpcoming).sort(cleaningSort);
  const doneToday=cleaningPlans.filter(cleaningDoneToday);
  const roomsWithCurrentNeed=new Set(due.map(j=>j.roomId));
  const cleanRooms=rooms.filter(r=>r.cleaning==='done'&&!roomsWithCurrentNeed.has(r.id));

  const dueMetric=document.getElementById('cleanV2Due'),doneMetric=document.getElementById('cleanV2Done'),upcomingMetric=document.getElementById('cleanV2Upcoming'),cleanMetric=document.getElementById('cleanV2Clean');
  if(dueMetric)dueMetric.textContent=due.length;
  if(doneMetric)doneMetric.textContent=doneToday.length;
  if(upcomingMetric)upcomingMetric.textContent=upcoming.length;
  if(cleanMetric)cleanMetric.textContent=cleanRooms.length;

  const activeWrap=document.getElementById('cleaningV2DueList');
  if(activeWrap)activeWrap.innerHTML=due.length?due.map(job=>{
    const state=cleaningV2State(job),booking=bookings.find(b=>b.id===job.bookingId);
    const reason=job.auto?(booking?`${booking.guest}${booking.purpose?' · '+booking.purpose:''}`:'Automatisch nach Buchung'):(job.note||'Manuell eingeplant');
    return `<div class="clean-v2-row"><div><div class="clean-v2-title">${esc(roomName(job.roomId))}</div><div class="clean-v2-meta">${esc(reason)}</div></div><div><span class="clean-v2-state ${state.cls}">${state.label}</span><div class="clean-v2-meta" style="margin-top:5px">${job.date<todayIso()?'Fällig seit ': 'Fällig '}${fmtDate(job.date)}${job.time?' · '+esc(job.time):''}${job.owner?' · '+esc(job.owner):''}</div></div><div class="clean-v2-action"><button class="btn primary" onclick="finishCleaningJob('${job.id}')">Sauber bestätigen ✓</button></div></div>`;
  }).join(''):`<div class="empty">Alles sauber – aktuell ist keine Reinigung offen.</div>`;

  const upcomingWrap=document.getElementById('cleaningV2UpcomingList');
  if(upcomingWrap)upcomingWrap.innerHTML=upcoming.length?upcoming.slice(0,20).map(job=>`<div class="clean-v2-upcoming-row"><div><b>${esc(roomName(job.roomId))}</b><div class="clean-v2-meta">${fmtDate(job.date)}${job.time?' · '+esc(job.time):''}${job.owner?' · '+esc(job.owner):''}<br>${job.auto?'Automatisch nach Buchungsende':esc(job.note||'Manuell geplant')}</div></div>${job.auto?'':`<button class="btn small danger" onclick="deleteCleaningV2Job('${job.id}')">Löschen</button>`}</div>`).join(''):`<div class="empty">Keine weiteren Reinigungen geplant.</div>`;

  const cleanWrap=document.getElementById('cleaningV2CleanRooms');
  if(cleanWrap)cleanWrap.innerHTML=cleanRooms.length?`<div class="clean-v2-clean-grid">${cleanRooms.map(r=>`<span class="clean-v2-clean-pill">✓ ${esc(r.name)}</span>`).join('')}</div>`:'<div class="empty">Aktuell ist noch kein Raum als sauber markiert.</div>';
}

function cleaningSort(a,b){return String(a.date||'9999').localeCompare(String(b.date||'9999'))||String(a.time||'').localeCompare(String(b.time||''))||roomName(a.roomId).localeCompare(roomName(b.roomId))}

function finishCleaningJob(id){
  const job=cleaningPlans.find(j=>j.id===id);if(!job)return;
  job.status='done';job.completedAt=new Date().toISOString();delete job.startedAt;
  const otherActive=cleaningPlans.some(j=>j.id!==id&&j.roomId===job.roomId&&j.status!=='done'&&j.date<=todayIso());
  rooms=rooms.map(r=>r.id===job.roomId?{...r,cleaning:otherActive?'open':'done'}:r);
  persist();renderAll();toast('Sauber bestätigt');
}

function startCleaningJob(id){
  const job=cleaningPlans.find(j=>j.id===id);if(!job)return;
  job.status='planned';delete job.startedAt;
  rooms=rooms.map(r=>r.id===job.roomId?{...r,cleaning:'open'}:r);
  persist();renderAll();
}

function deleteCleaningV2Job(id){
  const job=cleaningPlans.find(j=>j.id===id);if(!job||job.auto)return;
  cleaningPlans=cleaningPlans.filter(j=>j.id!==id);persist();renderAll();toast('Geplante Reinigung gelöscht');
}

setCleaningPlanStatus=function(id,status){
  if(status==='done')return finishCleaningJob(id);
  const job=cleaningPlans.find(j=>j.id===id);if(!job)return;
  job.status='planned';delete job.startedAt;delete job.completedAt;
  rooms=rooms.map(r=>r.id===job.roomId?{...r,cleaning:'open'}:r);persist();renderAll();
};

setCleaning=function(id,status){
  const today=todayIso();
  let job=cleaningPlans.find(j=>j.roomId===id&&j.status!=='done'&&j.date<=today);
  if(status==='done'){
    if(job)return finishCleaningJob(job.id);
    rooms=rooms.map(r=>r.id===id?{...r,cleaning:'done'}:r);persist();renderAll();return;
  }
  if(!job){job={id:uid(),bookingId:'',roomId:id,date:today,time:'',owner:'',note:'Reinigungsbedarf manuell gesetzt',status:'planned',auto:false,source:'room-status'};cleaningPlans.push(job)}
  job.status='planned';rooms=rooms.map(r=>r.id===id?{...r,cleaning:'open'}:r);persist();renderAll();
};

saveCleaningPlan=function(){
  const roomId=document.getElementById('cleanPlanRoom')?.value,date=document.getElementById('cleanPlanDate')?.value;
  if(!roomId||!date)return alert('Bitte Raum und Datum auswählen.');
  cleaningPlans.push({id:uid(),bookingId:'',roomId,date,time:document.getElementById('cleanPlanTime')?.value||'',owner:document.getElementById('cleanPlanOwner')?.value.trim()||'',note:document.getElementById('cleanPlanNote')?.value.trim()||'Manuell geplant',status:'planned',auto:false,source:'manual'});
  persist();closeModal('cleaningPlanModal');renderAll();toast('Reinigung geplant');
};

renderCleaning=function(){renderCleaningV2()};
renderCleaningPlans=function(){renderCleaningV2()};

setupCleaningV2Ui();
reconcileCleaningData();
renderCleaningV2();
