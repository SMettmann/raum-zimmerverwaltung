(function(){
  if(window.__raumsuiteCateringVisualFinal)return;
  window.__raumsuiteCateringVisualFinal=true;

  function addStyles(){
    if(document.getElementById('raumsuiteCateringVisualFinalStyles'))return;
    const style=document.createElement('style');
    style.id='raumsuiteCateringVisualFinalStyles';
    style.textContent=`
      .booking-catering-cell>strong,.cal-catering,.catering-selection-bar{
        display:inline-flex;align-items:center;gap:6px;padding:5px 9px;border-radius:999px;
        background:#eaf0ff;border:1px solid #cbd8ff;color:#244a9b;font-weight:800;
        line-height:1.15;max-width:100%;box-sizing:border-box
      }
      .cal-catering{font-size:9px;margin-top:3px;padding:3px 6px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .booking-catering-cell .row-meta{margin-top:4px}
      .catering-selection-bar{display:none;margin:-2px 0 12px 0;width:max-content;font-size:12px}
      #dashboardBookings .row-meta .catering-dashboard-badge{display:inline-flex;margin-top:4px;padding:3px 7px;border-radius:999px;background:#eaf0ff;border:1px solid #cbd8ff;color:#244a9b;font-weight:800}
    `;
    document.head.appendChild(style);
  }

  function ensureBar(){
    const select=document.getElementById('bookingCatering');
    if(!select)return null;
    let bar=document.getElementById('bookingCateringSelectedBar');
    if(!bar){
      bar=document.createElement('div');
      bar.id='bookingCateringSelectedBar';
      bar.className='catering-selection-bar';
      const note=document.getElementById('bookingCateringNoteField');
      if(note)note.parentNode.insertBefore(bar,note);
      else select.closest('.field')?.insertAdjacentElement('afterend',bar);
    }
    return bar;
  }

  function syncBar(){
    const select=document.getElementById('bookingCatering');
    const bar=ensureBar();
    if(!select||!bar)return;
    const value=select.value||'';
    if(!value){bar.style.display='none';bar.textContent='';return;}
    bar.textContent=`Verpflegung: ${value}`;
    bar.style.display='inline-flex';
  }

  function decorateDashboard(){
    document.querySelectorAll('#dashboardBookings .row-meta span').forEach(span=>{
      if((span.textContent||'').trim().startsWith('Verpflegung:'))span.classList.add('catering-dashboard-badge');
    });
  }

  function afterBookingOpen(){
    // Nur gezielt den kleinen Verpflegungs-Balken aktualisieren.
    // Keine DOM-Beobachter, keine globalen Klick-Handler und kein renderAll.
    setTimeout(syncBar,0);
  }

  addStyles();
  syncBar();
  decorateDashboard();

  // Genau ein sehr kleiner Handler nur für das Verpflegungsfeld.
  document.addEventListener('change',event=>{
    if(event.target&&event.target.id==='bookingCatering')syncBar();
  });

  // Beim Öffnen/Bearbeiten einmal synchronisieren, ohne die Ansicht neu zu rendern.
  if(typeof editBooking==='function'&&!editBooking._cateringVisualSafe){
    const originalEditBooking=editBooking;
    const wrappedEditBooking=function(...args){
      const result=originalEditBooking.apply(this,args);
      afterBookingOpen();
      return result;
    };
    wrappedEditBooking._cateringVisualSafe=true;
    editBooking=wrappedEditBooking;
  }

  if(typeof openBookingModal==='function'&&!openBookingModal._cateringVisualSafe){
    const originalOpenBookingModal=openBookingModal;
    const wrappedOpenBookingModal=function(...args){
      const result=originalOpenBookingModal.apply(this,args);
      afterBookingOpen();
      return result;
    };
    wrappedOpenBookingModal._cateringVisualSafe=true;
    openBookingModal=wrappedOpenBookingModal;
  }
})();
