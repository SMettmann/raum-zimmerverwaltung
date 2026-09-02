(function(){
  const LOCATION_KEY='raumsuite_active_location';

  function activeLocation(){return localStorage.getItem(LOCATION_KEY)||'all'}
  function roomIdsForLocation(location){
    if(location==='all')return null;
    return new Set((rooms||[]).filter(r=>r.location===location).map(r=>r.id));
  }

  function withLocationFilter(fn,args,ctx){
    const location=activeLocation();
    if(location==='all'||typeof fn!=='function')return fn?.apply(ctx,args);
    const ids=roomIdsForLocation(location);
    const originalRooms=rooms,originalBookings=bookings;
    rooms=originalRooms.filter(r=>ids.has(r.id));
    bookings=originalBookings.filter(b=>ids.has(b.roomId));
    try{return fn.apply(ctx,args)}finally{rooms=originalRooms;bookings=originalBookings}
  }

  function wrap(name){
    try{
      const original=eval(name);
      if(typeof original!=='function'||original._locationFinal)return;
      const wrapped=function(...args){return withLocationFilter(original,args,this)};
      wrapped._locationFinal=true;
      eval(`${name}=wrapped`);
    }catch(e){console.warn('Standortfilter konnte nicht gesetzt werden:',name,e)}
  }

  ['renderDashboard','renderCalendar','renderBookingTable','fillDocumentPicker','renderAvailability'].forEach(wrap);

  // Sicherheit: Eine Buchungsbestätigung darf bei aktivem Standort niemals
  // aus einer Buchung eines anderen Standortes erzeugt werden.
  if(typeof createConfirmation==='function'&&!createConfirmation._locationFinal){
    const originalCreateConfirmation=createConfirmation;
    const wrappedConfirmation=function(...args){
      const location=activeLocation();
      if(location!=='all'){
        const id=document.getElementById('documentBooking')?.value||'';
        const booking=(bookings||[]).find(b=>b.id===id);
        const room=booking&&(rooms||[]).find(r=>r.id===booking.roomId);
        if(booking&&room?.location!==location){
          if(typeof fillDocumentPicker==='function')fillDocumentPicker();
          alert('Für den gewählten Standort werden nur die zugehörigen Buchungen angezeigt.');
          return;
        }
      }
      return originalCreateConfirmation.apply(this,args);
    };
    wrappedConfirmation._locationFinal=true;
    createConfirmation=wrappedConfirmation;
  }

  // Beim Standortwechsel alle belegungs- und dokumentbezogenen Ansichten
  // sofort auf den ausgewählten Standort aktualisieren.
  if(typeof window.setSite==='function'&&!window.setSite._locationFinal){
    const originalSetSite=window.setSite;
    const wrappedSetSite=function(value){
      const result=originalSetSite.call(this,value);
      try{if(typeof renderCalendar==='function')renderCalendar()}catch{}
      try{if(typeof renderBookingTable==='function')renderBookingTable()}catch{}
      try{if(typeof fillDocumentPicker==='function')fillDocumentPicker()}catch{}
      try{if(typeof renderAvailability==='function')renderAvailability()}catch{}
      return result;
    };
    wrappedSetSite._locationFinal=true;
    window.setSite=wrappedSetSite;
  }
})();
