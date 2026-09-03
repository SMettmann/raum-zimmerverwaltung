(function(){
  if(window.__raumsuiteBusinessClosureLoaded)return;
  window.__raumsuiteBusinessClosureLoaded=true;

  const ALL='__all__';
  const isWholeOperation=b=>b?.scope==='all'||b?.roomId===ALL;
  const overlapsDate=(aFrom,aTo,bFrom,bTo)=>aFrom<=bTo&&aTo>=bFrom;

  const previousBookingConflict=typeof bookingConflict==='function'?bookingConflict:null;
  bookingConflict=function(roomId,from,to,ignoreId=''){
    const base=previousBookingConflict?previousBookingConflict(roomId,from,to,ignoreId):false;
    if(base)return true;
    return (blocks||[]).some(b=>isWholeOperation(b)&&overlapsDate(from,to,b.from,b.to));
  };

  function visibleRooms(){
    const active=localStorage.getItem('raumsuite_active_location')||'all';
    if(active==='all')return rooms||[];
    return (rooms||[]).filter(r=>r.location===active);
  }

  function ensureBetriebsferienOption(){
    const type=document.getElementById('blockType');
    if(!type)return;
    if(![...type.options].some(o=>o.value==='Betriebsferien')){
      const option=document.createElement('option');
      option.value='Betriebsferien';option.textContent='Betriebsferien';
      type.insertBefore(option,type.firstChild);
    }
  }

  openBlockModal=function(){
    const select=document.getElementById('blockRoom');
    if(!select)return;
    const list=visibleRooms();
    select.innerHTML=`<option value="${ALL}">Gesamter Betrieb (Betriebsferien)</option>`+list.map(r=>`<option value="${r.id}">${esc(r.name)}${r.location?` · ${esc(r.location)}`:''}</option>`).join('');
    ensureBetriebsferienOption();
    document.getElementById('blockFrom').value=todayIso();
    document.getElementById('blockTo').value=todayIso();
    document.getElementById('blockNote').value='';
    select.onchange=function(){
      const type=document.getElementById('blockType');
      if(type&&this.value===ALL)type.value='Betriebsferien';
    };
    document.getElementById('blockType').value='Betriebsferien';
    showModal('blockModal');
  };

  saveBlock=function(){
    const roomId=document.getElementById('blockRoom').value;
    const from=document.getElementById('blockFrom').value;
    const to=document.getElementById('blockTo').value;
    if(!roomId||!from||!to)return alert('Bitte Bereich und Zeitraum auswählen.');
    if(to<from)return alert('Das Bis-Datum darf nicht vor dem Von-Datum liegen.');

    const whole=roomId===ALL;
    const conflict=(bookings||[]).some(b=>b.status!=='cancelled'&&(whole||b.roomId===roomId)&&overlapsDate(from,to,b.from,b.to));
    if(conflict){
      const text=whole
        ?'In diesem Zeitraum bestehen bereits Buchungen. Betriebsferien trotzdem für den gesamten Betrieb anlegen?'
        :'In diesem Zeitraum existiert bereits eine Buchung. Sperre trotzdem anlegen?';
      if(!confirm(text))return;
    }

    const type=whole?'Betriebsferien':document.getElementById('blockType').value;
    blocks.push({id:uid(),roomId,scope:whole?'all':'room',from,to,type,note:document.getElementById('blockNote').value.trim()});
    persist();closeModal('blockModal');renderAvailability();
    toast(whole?'Betriebsferien eingetragen':'Zeitraum gesperrt');
  };

  renderAvailability=function(){
    const w=document.getElementById('blockList');if(!w)return;
    const active=localStorage.getItem('raumsuite_active_location')||'all';
    const roomIds=new Set((rooms||[]).filter(r=>active==='all'||r.location===active).map(r=>r.id));
    const list=[...(blocks||[])].filter(b=>isWholeOperation(b)||active==='all'||roomIds.has(b.roomId)).sort((a,b)=>a.from.localeCompare(b.from));
    w.innerHTML=list.length?list.map(b=>{
      const whole=isWholeOperation(b);
      const name=whole?'Gesamter Betrieb':roomName(b.roomId);
      return `<div class="req-row"><div><b>${esc(name)}</b><div class="row-meta">${fmtDate(b.from)} – ${fmtDate(b.to)} · ${esc(whole?'Betriebsferien':b.type)}${b.note?' · '+esc(b.note):''}</div></div><div class="req-actions"><span class="badge red">${whole?'Betrieb geschlossen':'Nicht vermietbar'}</span><button class="btn small danger" onclick="deleteBlock('${b.id}')">Freigeben</button></div></div>`;
    }).join(''):'<div class="empty">Keine Sperrzeiten. Alle Räume sind nach Buchungslage vermietbar.</div>';
  };

  setTimeout(()=>{ensureBetriebsferienOption();if(typeof renderAvailability==='function')renderAvailability();},0);
})();
