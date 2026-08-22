/* RAUMWERK: einfache Sperrzeiten statt doppelter Freigabe-/Sperrlogik */
(function(){
  function canPersistMigration(){
    return cloud.mode!=='online'||['admin','manager'].includes(cloud.user?.role);
  }

  function disableRentalPeriods(){
    const hadPeriods=Array.isArray(settings.rentalPeriods)&&settings.rentalPeriods.length>0;
    settings.rentalPeriods=[];
    if(hadPeriods&&canPersistMigration())persist();
  }

  function updateAvailabilityNav(){
    pageMeta.availability=['Sperrzeiten','Zeiträume blockieren, in denen keine Vermietung möglich ist'];
    const nav=document.querySelector('#nav button[data-page="availability"]');
    if(nav)nav.textContent='⊘ Sperrzeiten';
  }

  function renderBlocksOnly(){
    const page=document.getElementById('page-availability');if(!page)return;
    page.innerHTML=`
      <div class="toolbar"><div><b>Sperrzeiten</b><div class="muted">Räume sind grundsätzlich immer vermietbar. Nur Ausnahmen werden hier für einen bestimmten Zeitraum gesperrt.</div></div><button class="btn primary" onclick="openBlockModal()">+ Zeitraum sperren</button></div>
      <div class="panel"><div class="panel-head"><h2>Gesperrte Zeiträume</h2><span class="muted">Während einer Sperre verhindert RAUMWERK automatisch neue Buchungen.</span></div><div id="blockList"></div></div>`;
    const list=[...blocks].sort((a,b)=>a.from.localeCompare(b.from));
    const wrap=document.getElementById('blockList');
    wrap.innerHTML=list.length?list.map(b=>`<div class="req-row"><div><b>${esc(roomName(b.roomId))}</b><div class="row-meta">${fmtDate(b.from)} – ${fmtDate(b.to)} · ${esc(b.type)}${b.note?' · '+esc(b.note):''}</div></div><div class="req-actions"><span class="badge red">Gesperrt</span><button class="btn small danger" onclick="deleteBlock('${b.id}')">Sperre aufheben</button></div></div>`).join(''):'<div class="empty">Keine Sperrzeiten vorhanden. Alle Räume sind buchbar, sofern sie nicht bereits belegt sind.</div>';
  }

  disableRentalPeriods();
  document.getElementById('rentalPeriodModal')?.remove();
  window.openRentalPeriodModal=()=>{};
  window.saveRentalPeriod=()=>{};
  window.deleteRentalPeriod=()=>{};
  window.rentalPeriodAllows=()=>true;

  renderAvailability=function(){disableRentalPeriods();updateAvailabilityNav();renderBlocksOnly()};

  const previousLoadCloudState=loadCloudState;
  loadCloudState=async function(){
    const result=await previousLoadCloudState();
    disableRentalPeriods();updateAvailabilityNav();renderBlocksOnly();
    return result;
  };

  updateAvailabilityNav();
  renderBlocksOnly();
})();
