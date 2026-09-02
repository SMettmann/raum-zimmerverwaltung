(function(){
  if(window.__raumsuiteLocationsLoaded)return;
  window.__raumsuiteLocationsLoaded=true;

  sessionStorage.removeItem('raumsuite_presentation_backup');
  sessionStorage.removeItem('raumsuite_presentation_request');

  const KEY='raumsuite_active_location';
  let active=localStorage.getItem(KEY)||'all';
  let refreshing=false;

  function locationList(){
    let list=Array.isArray(settings?.locations)?settings.locations.map(v=>String(v).trim()).filter(Boolean):[];
    const inferred=[...new Set((rooms||[]).map(r=>String(r.location||'').trim()).filter(Boolean))];
    if(!list.length)list=inferred;
    if(!list.length)list=['Haupthaus'];
    settings.locations=[...new Set(list)];
    return settings.locations;
  }

  function inferSeedLocation(room){
    const id=String(room?.id||'');
    if(/^n[zt]/i.test(id))return 'Standort Nord';
    if(/^s[zt]/i.test(id))return 'Standort Süd';
    return '';
  }

  function ensureLocations(){
    let changed=false;
    const hasNorth=(rooms||[]).some(r=>/^n[zt]/i.test(String(r.id||''))||r.location==='Standort Nord');
    const hasSouth=(rooms||[]).some(r=>/^s[zt]/i.test(String(r.id||''))||r.location==='Standort Süd');
    if(hasNorth&&hasSouth){
      const current=Array.isArray(settings.locations)?settings.locations:[];
      if(!current.length||current.every(x=>x==='Haupthaus')){
        settings.locations=['Standort Nord','Standort Süd'];
        changed=true;
      }
    }
    const list=locationList();
    rooms=(rooms||[]).map(room=>{
      if(room.location)return room;
      const location=inferSeedLocation(room)||list[0];
      changed=true;
      return {...room,location};
    });
    if(active!=='all'&&!locationList().includes(active)){
      active='all';localStorage.setItem(KEY,'all');
    }
    return changed;
  }

  function migrateSeedAssignments(){
    if(Number(settings?._seedAssignmentVersion||0)>=1)return false;
    const roomIds=new Set((rooms||[]).map(r=>r.id));
    const assignment={b1:'nt1',b2:'nz001',b3:'nt2',b4:'st1',b5:'st2',b6:'st4',b7:'nt3',b8:'st3'};
    const catering={
      b1:['Vollverpflegung',46,'Vegetarische Optionen berücksichtigen'],
      b3:['Halbpension',28,'Abendessen am Anreisetag'],
      b4:['Vollverpflegung',54,'Vegetarisch und Allergien nach Teilnehmerliste'],
      b8:['Selbstversorgung',24,'Nutzung der vorhandenen Selbstversorgerküche']
    };
    let changed=false,foundSeed=false;
    bookings=(bookings||[]).map(b=>{
      if(!Object.prototype.hasOwnProperty.call(assignment,b.id))return b;
      foundSeed=true;
      const next={...b};
      const target=assignment[b.id];
      if(roomIds.has(target)&&next.roomId!==target){next.roomId=target;changed=true;}
      const c=catering[b.id];
      if(c){
        if(!next.catering){next.catering=c[0];changed=true;}
        if(!next.cateringParticipants){next.cateringParticipants=c[1];changed=true;}
        if(!next.cateringNote){next.cateringNote=c[2];changed=true;}
      }
      return next;
    });
    if(foundSeed){settings._seedAssignmentVersion=1;changed=true;}
    return changed;
  }

  function isGuestRoom(r){return /zimmer/i.test(String(r?.type||''))||/zimmer/i.test(String(r?.name||''));}
  function stats(location='all'){
    const list=location==='all'?(rooms||[]):(rooms||[]).filter(r=>r.location===location);
    const guest=list.filter(isGuestRoom);
    return {zimmer:guest.length,raeume:list.length-guest.length,betten:guest.reduce((sum,r)=>sum+(Number(r.capacity)||0),0)};
  }
  function updateSummary(){
    const el=document.getElementById('siteSummary');if(!el)return;
    const s=stats(active);el.textContent=`${s.zimmer} Zimmer · ${s.raeume} Räume · ${s.betten} Betten`;
  }
  function injectSwitch(){
    ensureLocations();
    const top=document.querySelector('.top-actions');if(!top)return;
    let box=document.getElementById('siteSwitch');
    if(!box){
      box=document.createElement('div');box.id='siteSwitch';
      box.style.cssText='display:flex;align-items:center;gap:7px;padding:6px 9px;border:1px solid #e1e6ee;border-radius:10px;background:#fff;font-size:12px;flex-wrap:wrap';
      box.innerHTML='<b style="font-size:11px;color:#758097">Standort</b><select id="siteSelect" onchange="setSite(this.value)" style="border:0;background:transparent;font:inherit;font-weight:800;outline:none"></select><span id="siteSummary" style="color:#758097;font-size:11px;white-space:nowrap"></span>';
      top.prepend(box);
    }
    const select=document.getElementById('siteSelect');
    select.innerHTML='<option value="all">Alle Standorte</option>'+locationList().map(x=>`<option value="${esc(x)}">${esc(x)}</option>`).join('');
    select.value=active;updateSummary();
  }

  window.setSite=function(value){active=value;localStorage.setItem(KEY,value);renderAll();injectSwitch();};

  function filtered(fn,args,ctx){
    if(active==='all'||typeof fn!=='function')return fn?.apply(ctx,args);
    ensureLocations();
    const allRooms=rooms,allBookings=bookings,allGuests=guests,allTasks=tasks;
    const ids=new Set(allRooms.filter(r=>r.location===active).map(r=>r.id));
    const visibleBookings=allBookings.filter(b=>ids.has(b.roomId));
    const guestNames=new Set(visibleBookings.map(b=>String(b.guest||'').toLowerCase()));
    const restore={};
    rooms=allRooms.filter(r=>ids.has(r.id));
    bookings=visibleBookings;
    guests=allGuests.filter(g=>guestNames.has(String(g.name||'').toLowerCase()));
    tasks=allTasks.filter(t=>!t.roomId||ids.has(t.roomId));
    if(typeof cleaningPlans!=='undefined'){restore.cleaning=cleaningPlans;cleaningPlans=cleaningPlans.filter(x=>!x.roomId||ids.has(x.roomId));}
    if(typeof shifts!=='undefined'){restore.shifts=shifts;shifts=shifts.filter(x=>!x.roomId||ids.has(x.roomId));}
    if(typeof blocks!=='undefined'){restore.blocks=blocks;blocks=blocks.filter(x=>ids.has(x.roomId));}
    if(typeof contracts!=='undefined'){restore.contracts=contracts;contracts=contracts.filter(x=>visibleBookings.some(b=>b.id===x.bookingId)||ids.has(x.roomId));}
    if(typeof invoices!=='undefined'){restore.invoices=invoices;invoices=invoices.filter(x=>visibleBookings.some(b=>b.id===x.bookingId));}
    if(typeof bookingRequests!=='undefined'){restore.requests=bookingRequests;bookingRequests=bookingRequests.filter(x=>!x.roomId||ids.has(x.roomId));}
    try{return fn.apply(ctx,args)}finally{
      rooms=allRooms;bookings=allBookings;guests=allGuests;tasks=allTasks;
      if(Object.prototype.hasOwnProperty.call(restore,'cleaning'))cleaningPlans=restore.cleaning;
      if(Object.prototype.hasOwnProperty.call(restore,'shifts'))shifts=restore.shifts;
      if(Object.prototype.hasOwnProperty.call(restore,'blocks'))blocks=restore.blocks;
      if(Object.prototype.hasOwnProperty.call(restore,'contracts'))contracts=restore.contracts;
      if(Object.prototype.hasOwnProperty.call(restore,'invoices'))invoices=restore.invoices;
      if(Object.prototype.hasOwnProperty.call(restore,'requests'))bookingRequests=restore.requests;
    }
  }

  function wrap(name){
    try{
      const original=eval(name);if(typeof original!=='function'||original._raumsuiteLocation)return;
      const wrapped=function(...args){return filtered(original,args,this)};
      wrapped._raumsuiteLocation=true;eval(`${name}=wrapped`);
    }catch{}
  }
  ['renderDashboard','renderCalendar','renderBookingTable','renderRoomsPage','renderGuestsPage','renderCleaning','renderTasks','fillSelectors','fillDocumentPicker','renderCleaningPlans','renderAvailability','renderStaffing','renderContracts','renderInvoices','renderOnlineRequests'].forEach(wrap);

  function ensureRoomLocationField(){
    if(document.getElementById('roomLocation'))return;
    const note=document.getElementById('roomNote')?.closest('.field');
    note?.insertAdjacentHTML('beforebegin','<div class="field"><label>Standort</label><select id="roomLocation"></select></div>');
  }
  function fillRoomLocation(value){
    ensureRoomLocationField();const select=document.getElementById('roomLocation');if(!select)return;
    select.innerHTML=locationList().map(x=>`<option value="${esc(x)}">${esc(x)}</option>`).join('');
    select.value=locationList().includes(value)?value:locationList()[0];
  }
  if(typeof openRoomModal==='function'){
    const original=openRoomModal;openRoomModal=function(...args){const result=original.apply(this,args);fillRoomLocation(active==='all'?locationList()[0]:active);return result;};
  }
  if(typeof editRoom==='function'){
    const original=editRoom;editRoom=function(id,...rest){const room=(rooms||[]).find(r=>r.id===id);const result=original.call(this,id,...rest);fillRoomLocation(room?.location||locationList()[0]);return result;};
  }
  if(typeof saveRoom==='function'){
    saveRoom=function(){
      hideFormError('roomError');
      const id=document.getElementById('roomId').value,name=document.getElementById('roomName').value.trim();
      if(!name)return showFormError('roomError','Bitte einen Namen eingeben.');
      const data={id:id||uid(),name,type:document.getElementById('roomType').value,capacity:Number(document.getElementById('roomCapacity').value)||1,note:document.getElementById('roomNote').value.trim(),cleaning:id?((rooms||[]).find(r=>r.id===id)?.cleaning||'done'):'done',location:document.getElementById('roomLocation')?.value||locationList()[0]};
      rooms=id?rooms.map(r=>r.id===id?data:r):[...rooms,data];persist();closeModal('roomModal');renderAll();injectSwitch();toast(id?'Raum geändert':'Raum angelegt');
    };
  }

  function settingsPanel(){
    const grid=document.querySelector('#page-settings .settings-grid');if(!grid)return;
    if(!document.getElementById('sitePanel'))grid.insertAdjacentHTML('beforeend','<div class="panel" id="sitePanel"><h2>Standorte</h2><p class="muted">Mehrere Häuser gemeinsam verwalten und oben gezielt filtern.</p><div class="field"><label>Standorte (mit Komma trennen)</label><input id="siteNames"></div><button class="btn primary" onclick="saveSites()">Standorte speichern</button></div>');
    const input=document.getElementById('siteNames');if(input)input.value=locationList().join(', ');
  }
  window.saveSites=function(){
    const list=[...new Set(String(document.getElementById('siteNames')?.value||'').split(',').map(x=>x.trim()).filter(Boolean))];
    if(!list.length)return alert('Bitte mindestens einen Standort angeben.');
    settings.locations=list;rooms=rooms.map(r=>({...r,location:list.includes(r.location)?r.location:list[0]}));active='all';localStorage.setItem(KEY,'all');persist();injectSwitch();renderAll();toast('Standorte gespeichert');
  };

  async function afterStateLoad(){
    const locationChanged=ensureLocations();
    const seedChanged=migrateSeedAssignments();
    injectSwitch();settingsPanel();
    if((locationChanged||seedChanged)&&typeof persist==='function')persist();
  }
  if(typeof loadCloudState==='function'){
    const original=loadCloudState;
    loadCloudState=async function(...args){const result=await original.apply(this,args);await afterStateLoad();return result;};
  }
  if(typeof renderSettings==='function'){
    const original=renderSettings;renderSettings=function(...args){const result=original.apply(this,args);settingsPanel();return result;};
  }

  async function refreshOnlineRequests(){
    if(refreshing||cloud?.mode!=='online')return;
    refreshing=true;
    try{await loadCloudState();if(typeof renderOnlineRequests==='function')renderOnlineRequests();}
    finally{refreshing=false;}
  }
  window.addEventListener('focus',()=>{if(document.querySelector('#page-online.active'))refreshOnlineRequests();});
  document.addEventListener('click',event=>{
    const button=event.target.closest?.('#nav button[data-page="online"]');
    if(button)setTimeout(refreshOnlineRequests,0);
  },true);

  setTimeout(afterStateLoad,0);
})();