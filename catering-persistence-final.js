(function(){
  if(window.__raumsuiteCateringPersistenceFinal)return;
  window.__raumsuiteCateringPersistenceFinal=true;

  function escHtml(value){
    if(typeof esc==='function')return esc(value);
    return String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }

  function addStyles(){
    if(document.getElementById('cateringPersistenceFinalStyles'))return;
    const style=document.createElement('style');
    style.id='cateringPersistenceFinalStyles';
    style.textContent=`
      #dashboardBookings .dashboard-catering-detail{margin-top:5px;display:flex;flex-direction:column;gap:3px}
      #dashboardBookings .dashboard-catering-main{display:inline-flex;width:max-content;max-width:100%;align-items:center;padding:3px 7px;border-radius:999px;background:#eaf0ff;border:1px solid #cbd8ff;color:#244a9b;font-weight:800;font-size:11px}
      #dashboardBookings .dashboard-catering-note,#dashboardBookings .dashboard-booking-note{font-size:11px;color:#68758a;line-height:1.35}
    `;
    document.head.appendChild(style);
  }

  function activeLocation(){return localStorage.getItem('raumsuite_active_location')||'all';}
  function roomFor(id){return (rooms||[]).find(r=>r.id===id);}
  function upcomingBookings(){
    const t=typeof todayIso==='function'?todayIso():new Date().toISOString().slice(0,10);
    const loc=activeLocation();
    return [...(bookings||[])]
      .filter(b=>b.status!=='cancelled'&&String(b.to||'')>=t)
      .filter(b=>loc==='all'||roomFor(b.roomId)?.location===loc)
      .sort((a,b)=>String(a.from||'').localeCompare(String(b.from||'')))
      .slice(0,6);
  }

  function decorateDashboard(){
    addStyles();
    const rows=[...document.querySelectorAll('#dashboardBookings > .row')];
    if(!rows.length)return;
    const upcoming=upcomingBookings();
    rows.forEach((row,i)=>{
      row.querySelectorAll('.dashboard-catering-detail').forEach(el=>el.remove());
      const meta=row.querySelector('.row-meta');
      if(!meta)return;
      [...meta.querySelectorAll('span')].forEach(span=>{if((span.textContent||'').trim().startsWith('Verpflegung:'))span.remove();});
      const b=upcoming[i];
      if(!b)return;
      const hasCatering=Boolean(b.catering);
      const hasCateringNote=Boolean(String(b.cateringNote||'').trim());
      const hasBookingNote=Boolean(String(b.note||'').trim());
      if(!hasCatering&&!hasCateringNote&&!hasBookingNote)return;
      const detail=document.createElement('div');
      detail.className='dashboard-catering-detail';
      let html='';
      if(hasCatering){
        html+=`<span class="dashboard-catering-main">${escHtml(b.catering)}${b.cateringParticipants?` · ${escHtml(b.cateringParticipants)} Personen`:''}</span>`;
      }
      if(hasCateringNote)html+=`<span class="dashboard-catering-note"><b>Verpflegungshinweis:</b> ${escHtml(b.cateringNote)}</span>`;
      if(hasBookingNote)html+=`<span class="dashboard-booking-note"><b>Buchungshinweis:</b> ${escHtml(b.note)}</span>`;
      detail.innerHTML=html;
      meta.appendChild(detail);
    });
  }

  function install(){
    if(window.__raumsuiteCateringPersistenceInstalled)return true;
    if(typeof saveBooking!=='function'||typeof renderDashboard!=='function'||typeof bookings==='undefined')return false;
    if(!document.getElementById('bookingCatering'))return false;

    window.__raumsuiteCateringPersistenceInstalled=true;
    addStyles();

    const previousSave=saveBooking;
    saveBooking=function(...args){
      const modal=document.getElementById('bookingModal');
      const idBefore=document.getElementById('bookingId')?.value||'';
      const beforeIds=new Set((bookings||[]).map(b=>b.id));
      const snapshot={
        catering:document.getElementById('bookingCatering')?.value||'',
        cateringParticipants:Number(document.getElementById('bookingCateringParticipants')?.value)||null,
        cateringNote:document.getElementById('bookingCateringNote')?.value?.trim()||'',
        guest:document.getElementById('bookingGuest')?.value?.trim()||'',
        roomId:document.getElementById('bookingRoom')?.value||'',
        from:document.getElementById('bookingFrom')?.value||'',
        to:document.getElementById('bookingTo')?.value||''
      };
      const result=previousSave.apply(this,args);
      if(modal?.classList.contains('show'))return result;

      let target=idBefore?(bookings||[]).find(b=>b.id===idBefore):null;
      if(!target)target=(bookings||[]).find(b=>!beforeIds.has(b.id));
      if(!target){
        target=[...(bookings||[])].reverse().find(b=>b.guest===snapshot.guest&&b.roomId===snapshot.roomId&&b.from===snapshot.from&&b.to===snapshot.to);
      }
      if(target){
        target.catering=snapshot.catering;
        target.cateringParticipants=snapshot.cateringParticipants;
        target.cateringNote=snapshot.cateringNote;
        if(typeof persist==='function')persist();
        if(typeof renderBookingTable==='function')renderBookingTable();
        if(typeof renderDashboard==='function')renderDashboard();
        if(typeof renderCalendar==='function')renderCalendar();
      }
      return result;
    };

    const previousDashboard=renderDashboard;
    renderDashboard=function(...args){
      const result=previousDashboard.apply(this,args);
      decorateDashboard();
      return result;
    };

    decorateDashboard();
    return true;
  }

  let tries=0;
  const timer=setInterval(()=>{
    tries++;
    const tableReady=window.__raumsuiteBookingTableFinal||tries>30;
    if(tableReady&&install())clearInterval(timer);
    if(tries>100)clearInterval(timer);
  },100);
})();
