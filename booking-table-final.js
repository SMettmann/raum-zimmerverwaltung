(function(){
  if(window.__raumsuiteBookingTableFinal)return;
  window.__raumsuiteBookingTableFinal=true;

  function ensureHeader(){
    const row=document.querySelector('#bookingListPanel table thead tr');
    if(!row)return;
    row.innerHTML='<th>Zeitraum</th><th>Gast/Kunde</th><th>Raum</th><th>Zweck</th><th>Verpflegung</th><th>Status</th><th></th>';
  }

  function activeLocation(){return localStorage.getItem('raumsuite_active_location')||'all';}
  function roomFor(id){return (rooms||[]).find(r=>r.id===id);}
  function visibleBookings(){
    const location=activeLocation();
    const q=(document.getElementById('bookingSearch')?.value||'').toLowerCase();
    return [...(bookings||[])]
      .filter(b=>{
        const room=roomFor(b.roomId);
        if(location!=='all'&&room?.location!==location)return false;
        return [b.guest,room?.name,b.purpose,b.from,b.to,b.catering,b.cateringNote,b.cateringParticipants].join(' ').toLowerCase().includes(q);
      })
      .sort((a,b)=>String(b.from||'').localeCompare(String(a.from||'')));
  }

  function cateringHtml(b){
    if(!b.catering)return '<span class="muted">–</span>';
    const count=b.cateringParticipants?`<div class="row-meta">${esc(b.cateringParticipants)} Personen</div>`:'';
    const note=b.cateringNote?`<div class="row-meta">${esc(b.cateringNote)}</div>`:'';
    return `<strong>${esc(b.catering)}</strong>${count}${note}`;
  }

  renderBookingTable=function(){
    const body=document.getElementById('bookingTable');if(!body)return;
    ensureHeader();
    const list=visibleBookings();
    body.innerHTML=list.length?list.map(b=>{
      const st=bookingState(b);
      return `<tr>`+
        `<td>${fmtDate(b.from)} – ${fmtDate(b.to)}</td>`+
        `<td><strong>${esc(b.guest)}</strong></td>`+
        `<td>${esc(roomName(b.roomId))}</td>`+
        `<td>${esc(b.purpose||'–')}</td>`+
        `<td class="booking-catering-cell">${cateringHtml(b)}</td>`+
        `<td><span class="badge ${st[1]}">${st[0]}</span></td>`+
        `<td><div class="row-actions"><button class="btn small" onclick="editBooking('${b.id}')">Bearbeiten</button><button class="btn small danger" onclick="deleteBooking('${b.id}')">Löschen</button></div></td>`+
      `</tr>`;
    }).join(''):'<tr><td colspan="7"><div class="empty">Keine Buchungen gefunden.</div></td></tr>';
  };

  ensureHeader();
  renderBookingTable();
})();