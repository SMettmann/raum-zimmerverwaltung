(function(){
  if(window.__raumsuiteOnlineBookingFinal)return;
  window.__raumsuiteOnlineBookingFinal=true;

  function resolveRequestRoom(request){
    const list=Array.isArray(rooms)?rooms:[];
    let room=request?.roomId?list.find(r=>r.id===request.roomId):null;
    if(!room&&request?.roomName){
      room=list.find(r=>String(r.name||'')===String(request.roomName||'')&&(!request.roomLocation||String(r.location||'')===String(request.roomLocation||'')))
        ||list.find(r=>String(r.name||'')===String(request.roomName||''));
    }
    return room||null;
  }

  function requestRoomInfo(request){
    const room=resolveRequestRoom(request);
    return {
      id:room?.id||request?.roomId||'',
      name:room?.name||request?.roomName||'Raum nicht zugeordnet',
      type:room?.type||request?.roomType||'',
      location:room?.location||request?.roomLocation||''
    };
  }

  function visibleRequests(){
    const active=localStorage.getItem('raumsuite_active_location')||'all';
    const list=Array.isArray(bookingRequests)?bookingRequests:[];
    if(active==='all')return [...list];
    return list.filter(request=>requestRoomInfo(request).location===active);
  }

  window.renderOnlineRequests=function(){
    const wrap=document.getElementById('onlineRequestList');if(!wrap)return;
    const list=visibleRequests().sort((a,b)=>(b.createdAt||'').localeCompare(a.createdAt||''));
    wrap.innerHTML=list.length?list.map(request=>{
      const room=requestRoomInfo(request);
      const status=request.status==='accepted'?['Übernommen','green']:request.status==='rejected'?['Abgelehnt','red']:['Neu','yellow'];
      const time=(request.fromTime||request.toTime)?` · ${esc(request.fromTime||'–')}–${esc(request.toTime||'–')} Uhr`:'';
      const roomMeta=[room.location,room.type].filter(Boolean).map(esc).join(' · ');
      return `<div class="req-row"><div><b>${esc(request.name||'Unbekannt')}</b><div class="row-meta"><strong>Raum / Zimmer: ${esc(room.name)}</strong>${roomMeta?` · ${roomMeta}`:''}</div><div class="row-meta">${fmtDate(request.from)} – ${fmtDate(request.to)}${time} · ${esc(request.email||'')}${request.purpose?' · '+esc(request.purpose):''}${request.participants?` · ${esc(request.participants)} Pers.`:''}</div></div><div class="req-actions"><span class="badge ${status[1]}">${status[0]}</span>${request.status==='new'?`<button class="btn small primary" onclick="acceptOnlineRequest('${request.id}')">Annehmen</button><button class="btn small danger" onclick="rejectOnlineRequest('${request.id}')">Ablehnen</button>`:''}</div></div>`;
    }).join(''):'<div class="empty">Keine offenen Online-Buchungsanfragen.</div>';
  };

  window.acceptOnlineRequest=function(id){
    const request=(bookingRequests||[]).find(x=>x.id===id);if(!request)return;
    const room=resolveRequestRoom(request);
    if(!room)return alert('Der angefragte Raum ist nicht mehr vorhanden. Bitte die Anfrage manuell prüfen.');
    const roomId=room.id;
    if(bookingConflict(roomId,request.from,request.to))return alert('Der gewünschte Zeitraum ist inzwischen belegt oder gesperrt.');
    bookings.push({
      id:uid(),roomId,guest:request.name,from:request.from,to:request.to,
      fromTime:request.fromTime||'',toTime:request.toTime||'',
      purpose:request.purpose||'Online-Buchung',participants:request.participants||null,
      status:'confirmed',note:`Online-Anfrage · ${request.email||''}${request.phone?' · '+request.phone:''}${request.note?' · '+request.note:''}`,
      createdAt:new Date().toISOString(),source:'public-request'
    });
    ensureGuestFromBooking(request.name);
    const guest=(guests||[]).find(g=>String(g.name||'').toLowerCase()===String(request.name||'').toLowerCase());
    if(guest){guest.email=guest.email||request.email||'';guest.phone=guest.phone||request.phone||'';}
    bookingRequests=bookingRequests.map(x=>x.id===id?{...x,roomId,roomName:room.name,roomType:room.type||'',roomLocation:room.location||'',status:'accepted'}:x);
    persist();renderAll();toast('Online-Anfrage als Buchung übernommen');
  };

  window.rejectOnlineRequest=function(id){
    bookingRequests=bookingRequests.map(x=>x.id===id?{...x,status:'rejected'}:x);
    persist();renderOnlineRequests();
  };

  function enrichExistingRequests(){
    let changed=false;
    bookingRequests=(bookingRequests||[]).map(request=>{
      const room=resolveRequestRoom(request);if(!room)return request;
      const next={...request};
      if(!next.roomId){next.roomId=room.id;changed=true;}
      if(!next.roomName){next.roomName=room.name;changed=true;}
      if(!next.roomType){next.roomType=room.type||'';changed=true;}
      if(!next.roomLocation){next.roomLocation=room.location||'';changed=true;}
      return next;
    });
    if(changed&&typeof persist==='function')persist();
  }

  enrichExistingRequests();
  setTimeout(()=>{enrichExistingRequests();renderOnlineRequests();},0);
})();