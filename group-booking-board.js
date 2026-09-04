(function(){
  if(window.__raumsuiteGroupBookingBoardLoaded)return;
  window.__raumsuiteGroupBookingBoardLoaded=true;

  const BOARD_DAYS=28;
  const ACTIVE_LOCATION_KEY='raumsuite_active_location';
  let boardStart=startOfWeek(new Date());
  let calendarView='board';
  let pickerSelection=new Set();

  function escHtml(value){
    if(typeof esc==='function')return esc(value);
    return String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }
  function iso(date){
    if(typeof localIso==='function')return localIso(date);
    return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
  }
  function parseIso(value){const d=new Date(`${value}T12:00:00`);return Number.isNaN(d.getTime())?new Date():d;}
  function addDays(date,days){const d=new Date(date);d.setDate(d.getDate()+days);return d;}
  function startOfWeek(date){const d=new Date(date);d.setHours(12,0,0,0);const day=(d.getDay()+6)%7;d.setDate(d.getDate()-day);return d;}
  function diffDays(a,b){return Math.round((parseIso(b)-parseIso(a))/86400000);}
  function activeLocation(){return localStorage.getItem(ACTIVE_LOCATION_KEY)||'all';}
  function roomFor(id){return (rooms||[]).find(r=>r.id===id);}
  function roomIsGuest(room){return /zimmer/i.test(String(room?.type||''))||/zimmer/i.test(String(room?.name||''));}
  function isTimedRoom(roomId){
    if(typeof window.isTimedBookableRoom==='function')return window.isTimedBookableRoom(roomId);
    return ['Seminarraum','Besprechungsraum','Veranstaltungsraum'].includes(roomFor(roomId)?.type||'');
  }
  function visibleRooms(){
    const location=activeLocation();
    return [...(rooms||[])]
      .filter(r=>location==='all'||r.location===location)
      .sort((a,b)=>String(a.location||'').localeCompare(String(b.location||''),'de')||Number(!roomIsGuest(a))-Number(!roomIsGuest(b))||String(a.name||'').localeCompare(String(b.name||''),'de',{numeric:true}));
  }
  function groupKey(b){return String(b?.groupId||b?.bookingGroupId||b?.id||'');}
  function groupMembers(b){
    if(!b)return [];
    const key=groupKey(b);
    return (bookings||[]).filter(x=>groupKey(x)===key);
  }
  function representative(members){return members?.[0]||null;}
  function periodText(b){
    if(typeof window.bookingPeriodText==='function')return window.bookingPeriodText(b);
    return `${typeof fmtDate==='function'?fmtDate(b.from):b.from} – ${typeof fmtDate==='function'?fmtDate(b.to):b.to}`;
  }
  function statusHtml(b){
    const st=typeof bookingState==='function'?bookingState(b):['Bestätigt','blue'];
    return `<span class="badge ${st[1]}">${escHtml(st[0])}</span>`;
  }
  function groupRoomLabel(members){
    const names=members.map(m=>roomFor(m.roomId)?.name||'Unbekannter Raum');
    if(names.length===1)return escHtml(names[0]);
    return `<strong>${names.length} Zimmer / Räume</strong><div class="row-meta rs-group-room-names">${names.map(escHtml).join(' · ')}</div>`;
  }

  function injectStyles(){
    if(document.getElementById('rsGroupBookingBoardStyles'))return;
    const style=document.createElement('style');style.id='rsGroupBookingBoardStyles';
    style.textContent=`
      .rs-hidden-legacy-room{display:none!important}
      .rs-room-picker{border:1px solid var(--line);border-radius:12px;background:#fbfcfe;overflow:hidden}
      .rs-room-picker-head{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:10px 12px;border-bottom:1px solid var(--line);flex-wrap:wrap}
      .rs-room-picker-tools{display:flex;gap:6px;flex-wrap:wrap}
      .rs-room-picker-search{padding:9px 11px;border:1px solid var(--line);border-radius:9px;min-width:190px;font:inherit;background:#fff}
      .rs-room-list{max-height:260px;overflow:auto;padding:7px}
      .rs-room-option{display:grid;grid-template-columns:22px 1fr auto;gap:9px;align-items:center;padding:9px;border-radius:9px;cursor:pointer;border:1px solid transparent}
      .rs-room-option:hover{background:#f1f5fb}.rs-room-option.selected{background:#edf3ff;border-color:#c9d7ff}.rs-room-option.conflict{opacity:.5;cursor:not-allowed;background:#f7f7f7}
      .rs-room-option input{width:16px;height:16px}.rs-room-main{min-width:0}.rs-room-name{font-weight:800}.rs-room-meta{font-size:11px;color:#758097;margin-top:2px}.rs-room-cap{font-size:11px;color:#758097;white-space:nowrap}
      .rs-room-picker-summary{padding:8px 12px;border-top:1px solid var(--line);font-size:12px;color:#526077;background:#fff}
      .rs-booking-help{font-size:12px;color:#66758b;margin:6px 0 0}
      .rs-calendar-board{margin-top:0}.rs-board-head{display:flex;justify-content:space-between;gap:12px;align-items:center;margin-bottom:12px;flex-wrap:wrap}.rs-board-nav{display:flex;gap:6px;align-items:center;flex-wrap:wrap}
      .rs-board-scroll{overflow:auto;border:1px solid var(--line);border-radius:12px;background:#fff;max-height:68vh}
      .rs-board-grid{min-width:max-content}.rs-board-header,.rs-board-row{display:grid;grid-template-columns:220px auto;min-height:46px}.rs-board-header{position:sticky;top:0;z-index:8;background:#f7f9fc;border-bottom:1px solid var(--line)}
      .rs-board-room-head,.rs-board-room{position:sticky;left:0;z-index:5;background:#fff;border-right:1px solid var(--line);padding:8px 10px}.rs-board-room-head{z-index:10;background:#f7f9fc;font-weight:800;display:flex;align-items:center}.rs-board-room{border-bottom:1px solid #edf0f4;display:flex;flex-direction:column;justify-content:center}
      .rs-board-room strong{font-size:12px}.rs-board-room small{font-size:10px;color:#778296;margin-top:2px}
      .rs-board-days{display:grid;grid-template-columns:repeat(${BOARD_DAYS},42px);position:relative}.rs-board-day-head{height:46px;border-right:1px solid #e9edf3;display:flex;flex-direction:column;align-items:center;justify-content:center;font-size:10px;color:#657187}.rs-board-day-head b{font-size:12px;color:#283447}.rs-board-day-head.today{background:#eef3ff}
      .rs-board-track{display:grid;grid-template-columns:repeat(${BOARD_DAYS},42px);position:relative;border-bottom:1px solid #edf0f4;min-height:46px}.rs-board-cell{grid-row:1;border-right:1px solid #eef1f5;min-height:45px}.rs-board-cell.weekend{background:#fafbfc}.rs-board-cell.today{background:#f3f6ff}.rs-board-cell:hover{background:#eef4ff;cursor:pointer}
      .rs-board-event{grid-row:1;z-index:3;align-self:center;height:28px;margin:0 2px;border-radius:7px;background:#dfe9ff;border:1px solid #b8ccff;color:#173e8e;font-size:10px;font-weight:800;display:flex;align-items:center;padding:0 6px;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;cursor:pointer;box-shadow:0 1px 2px #1f3b6d12}.rs-board-event.option{background:#fff4cf;border-color:#f0d781;color:#71570b}.rs-board-event.cancelled{background:#f2f2f2;border-color:#ddd;color:#777}.rs-board-event.block{background:#eceff3;border-color:#cfd5de;color:#596474}.rs-board-event:hover{filter:brightness(.98)}
      .rs-board-empty{padding:25px;text-align:center;color:#758097}.rs-group-room-names{max-width:360px;white-space:normal;line-height:1.35}
      #bookingModal .modal-box{max-width:720px}
      @media(max-width:700px){.rs-board-header,.rs-board-row{grid-template-columns:170px auto}.rs-board-room-head,.rs-board-room{padding:7px}.rs-room-picker-head{align-items:stretch}.rs-room-picker-search{width:100%}}
    `;
    document.head.appendChild(style);
  }

  function injectRoomPicker(){
    const legacy=document.getElementById('bookingRoom');if(!legacy)return false;
    const legacyField=legacy.closest('.field');if(!legacyField)return false;
    legacyField.classList.add('rs-hidden-legacy-room');
    if(document.getElementById('rsBookingRoomPicker'))return true;
    legacyField.insertAdjacentHTML('afterend',`
      <div class="field" id="rsBookingRoomPickerField">
        <label>Zimmer / Räume *</label>
        <div class="rs-room-picker" id="rsBookingRoomPicker">
          <div class="rs-room-picker-head">
            <input class="rs-room-picker-search" id="rsRoomSearch" placeholder="Zimmer oder Raum suchen…" autocomplete="off">
            <div class="rs-room-picker-tools"><button type="button" class="btn small" id="rsSelectGuestRooms">Freie Gästezimmer</button><button type="button" class="btn small" id="rsClearRooms">Auswahl löschen</button></div>
          </div>
          <div class="rs-room-list" id="rsRoomList"></div>
          <div class="rs-room-picker-summary" id="rsRoomSummary">Noch kein Zimmer oder Raum ausgewählt.</div>
        </div>
        <div class="rs-booking-help">Mehrere Zimmer oder Räume können in einer Buchung gemeinsam ausgewählt werden.</div>
      </div>`);
    document.getElementById('rsRoomSearch')?.addEventListener('input',renderRoomPicker);
    document.getElementById('rsClearRooms')?.addEventListener('click',()=>{setSelectedRooms([]);renderRoomPicker();});
    document.getElementById('rsSelectGuestRooms')?.addEventListener('click',()=>{
      const ids=visibleRooms().filter(r=>roomIsGuest(r)&&!roomHasConflict(r.id)).map(r=>r.id);setSelectedRooms(ids);renderRoomPicker();
    });
    ['bookingFrom','bookingTo','bookingFromTime','bookingToTime','bookingStatus'].forEach(id=>document.getElementById(id)?.addEventListener('change',renderRoomPicker));
    return true;
  }

  function selectedRoomIds(){return [...pickerSelection];}
  function setSelectedRooms(ids){
    pickerSelection=new Set((ids||[]).map(String));
    document.querySelectorAll('#rsRoomList .rs-room-check').forEach(el=>{el.checked=pickerSelection.has(String(el.value));el.closest('.rs-room-option')?.classList.toggle('selected',el.checked);});
    syncLegacyRoom();updateRoomSummary();
  }
  function currentEditMemberIds(){
    const id=document.getElementById('bookingId')?.value||'';if(!id)return new Set();
    const b=(bookings||[]).find(x=>x.id===id);return new Set(groupMembers(b).map(x=>x.id));
  }
  function validTime(value){return /^([01]\d|2[0-3]):[0-5]\d$/.test(String(value||''));}
  function timedOverlap(a,b){
    const aStart=`${a.from}T${validTime(a.fromTime)?a.fromTime:'00:00'}`,aEnd=`${a.to}T${validTime(a.toTime)?a.toTime:'23:59'}`;
    const bStart=`${b.from}T${validTime(b.fromTime)?b.fromTime:'00:00'}`,bEnd=`${b.to}T${validTime(b.toTime)?b.toTime:'23:59'}`;
    return aStart<bEnd&&aEnd>bStart;
  }
  function roomHasConflict(roomId){
    const from=document.getElementById('bookingFrom')?.value||'',to=document.getElementById('bookingTo')?.value||'';if(!from||!to)return false;
    const status=document.getElementById('bookingStatus')?.value||'confirmed';if(status==='cancelled')return false;
    const ignored=currentEditMemberIds();
    const timed=isTimedRoom(roomId),candidate={from,to,fromTime:document.getElementById('bookingFromTime')?.value||'',toTime:document.getElementById('bookingToTime')?.value||''};
    const booked=(bookings||[]).some(b=>{
      if(ignored.has(b.id)||b.status==='cancelled'||b.roomId!==roomId)return false;
      return timed?timedOverlap(candidate,b):(from<=b.to&&to>=b.from);
    });
    const blocked=typeof blocks!=='undefined'&&(blocks||[]).some(b=>b.roomId===roomId&&from<=b.to&&to>=b.from);
    return booked||blocked;
  }
  function renderRoomPicker(){
    if(!injectRoomPicker())return;
    const list=document.getElementById('rsRoomList');if(!list)return;
    const current=new Set(pickerSelection);
    const q=(document.getElementById('rsRoomSearch')?.value||'').trim().toLowerCase();
    const roomList=visibleRooms().filter(r=>[r.name,r.type,r.location].join(' ').toLowerCase().includes(q));
    list.innerHTML=roomList.length?roomList.map(r=>{
      const conflict=roomHasConflict(r.id),checked=current.has(r.id),disabled=conflict&&!checked;
      return `<label class="rs-room-option ${checked?'selected':''} ${disabled?'conflict':''}"><input class="rs-room-check" type="checkbox" value="${escHtml(r.id)}" ${checked?'checked':''} ${disabled?'disabled':''}><span class="rs-room-main"><span class="rs-room-name">${escHtml(r.name)}</span><span class="rs-room-meta">${escHtml(r.type||'Raum')}${r.location?` · ${escHtml(r.location)}`:''}${conflict?` · bereits belegt/gesperrt`:''}</span></span><span class="rs-room-cap">${Number(r.capacity)||1} Plätze</span></label>`;
    }).join(''):'<div class="empty">Keine passenden Zimmer oder Räume.</div>';
    list.querySelectorAll('.rs-room-check').forEach(el=>el.addEventListener('change',()=>{if(el.checked)pickerSelection.add(String(el.value));else pickerSelection.delete(String(el.value));el.closest('.rs-room-option')?.classList.toggle('selected',el.checked);syncLegacyRoom();updateRoomSummary();}));
    syncLegacyRoom();updateRoomSummary();
  }
  function syncLegacyRoom(){
    const ids=selectedRoomIds();const legacy=document.getElementById('bookingRoom');if(legacy&&ids.length){legacy.value=ids[0];legacy.dispatchEvent(new Event('change',{bubbles:true}));}
    const anyTimed=ids.some(isTimedRoom),row=document.getElementById('bookingTimeRow');if(row)row.style.display=anyTimed?'grid':'none';
  }
  function updateRoomSummary(){
    const el=document.getElementById('rsRoomSummary');if(!el)return;
    const ids=selectedRoomIds(),capacity=ids.reduce((sum,id)=>sum+(Number(roomFor(id)?.capacity)||0),0);
    el.textContent=ids.length?`${ids.length} Zimmer / Räume ausgewählt · Kapazität zusammen ${capacity}`:'Noch kein Zimmer oder Raum ausgewählt.';
  }

  function injectBoardUi(){
    const page=document.getElementById('page-calendar');if(!page)return false;
    const toolbar=page.querySelector('.toolbar'),pillbar=toolbar?.querySelector('.pillbar');
    if(pillbar&&!document.getElementById('rsBoardViewBtn')){
      const month=document.getElementById('viewMonthBtn');
      if(month){month.textContent='Monatskalender';month.classList.remove('active');month.onclick=()=>showCalendarView('month');}
      const btn=document.createElement('button');btn.id='rsBoardViewBtn';btn.textContent='Belegungsplan';btn.onclick=()=>showCalendarView('board');pillbar.prepend(btn);
      const listBtn=[...pillbar.querySelectorAll('button')].find(b=>/Buchungsliste/i.test(b.textContent||''));if(listBtn)listBtn.onclick=()=>showCalendarView('list');
    }
    if(!document.getElementById('rsCalendarBoard')){
      const calendar=page.querySelector('.calendar');
      calendar?.insertAdjacentHTML('beforebegin',`<div class="panel rs-calendar-board" id="rsCalendarBoard"><div class="rs-board-head"><div><h2 style="margin:0">Zimmer- & Raumbelegung</h2><div class="muted">Alle Einheiten untereinander, Belegung direkt im Zeitraum sichtbar.</div></div><div class="rs-board-nav"><button class="btn small" type="button" onclick="rsMoveBoard(-7)">‹ 7 Tage</button><button class="btn small" type="button" onclick="rsBoardToday()">Heute</button><button class="btn small" type="button" onclick="rsMoveBoard(7)">7 Tage ›</button><strong id="rsBoardRange"></strong></div></div><div class="rs-board-scroll"><div class="rs-board-grid" id="rsBoardGrid"></div></div></div>`);
    }
    showCalendarView(calendarView,false);return true;
  }
  function showCalendarView(view,scroll=true){
    calendarView=view;const board=document.getElementById('rsCalendarBoard'),month=document.querySelector('#page-calendar .calendar'),list=document.getElementById('bookingListPanel');
    if(board)board.style.display=view==='board'?'block':'none';if(month)month.style.display=view==='month'?'block':'none';if(list)list.style.display=view==='list'?'block':'none';
    const pill=document.querySelector('#page-calendar .pillbar');pill?.querySelectorAll('button').forEach(b=>b.classList.remove('active'));
    if(view==='board')document.getElementById('rsBoardViewBtn')?.classList.add('active');
    else if(view==='month')document.getElementById('viewMonthBtn')?.classList.add('active');
    else [...(pill?.querySelectorAll('button')||[])].find(b=>/Buchungsliste/i.test(b.textContent||''))?.classList.add('active');
    if(view==='board')renderBoard();if(scroll)document.getElementById(view==='list'?'bookingListPanel':view==='board'?'rsCalendarBoard':'calendarGrid')?.scrollIntoView({behavior:'smooth',block:'start'});
  }
  window.rsMoveBoard=function(days){boardStart=addDays(boardStart,days);renderBoard();};
  window.rsBoardToday=function(){boardStart=startOfWeek(new Date());renderBoard();};
  window.rsOpenBookingForRoom=function(roomId,date){openBookingModal(null,date);setTimeout(()=>{renderRoomPicker();setSelectedRooms([roomId]);},0);};

  function renderBoard(){
    const grid=document.getElementById('rsBoardGrid');if(!grid)return;
    const roomList=visibleRooms(),days=Array.from({length:BOARD_DAYS},(_,i)=>addDays(boardStart,i)),from=iso(days[0]),to=iso(days[days.length-1]);
    const range=document.getElementById('rsBoardRange');if(range)range.textContent=`${typeof fmtDate==='function'?fmtDate(from):from} – ${typeof fmtDate==='function'?fmtDate(to):to}`;
    const head=`<div class="rs-board-header"><div class="rs-board-room-head">Zimmer / Raum</div><div class="rs-board-days">${days.map(d=>{const day=iso(d),today=day===(typeof todayIso==='function'?todayIso():iso(new Date())),weekend=[0,6].includes(d.getDay());return `<div class="rs-board-day-head ${today?'today':''} ${weekend?'weekend':''}"><span>${['So','Mo','Di','Mi','Do','Fr','Sa'][d.getDay()]}</span><b>${String(d.getDate()).padStart(2,'0')}.${String(d.getMonth()+1).padStart(2,'0')}.</b></div>`;}).join('')}</div></div>`;
    if(!roomList.length){grid.innerHTML=head+'<div class="rs-board-empty">Noch keine Zimmer oder Räume angelegt.</div>';return;}
    let lastLocation='__none__';let rows='';
    roomList.forEach(r=>{
      const events=(bookings||[]).filter(b=>b.roomId===r.id&&b.status!=='cancelled'&&b.from<=to&&b.to>=from);
      const roomBlocks=typeof blocks!=='undefined'?(blocks||[]).filter(b=>b.roomId===r.id&&b.from<=to&&b.to>=from):[];
      const cells=days.map((d,i)=>{const day=iso(d),weekend=[0,6].includes(d.getDay()),today=day===(typeof todayIso==='function'?todayIso():iso(new Date()));return `<div class="rs-board-cell ${weekend?'weekend':''} ${today?'today':''}" style="grid-column:${i+1}" ondblclick="rsOpenBookingForRoom('${String(r.id).replace(/'/g,"\\'")}','${day}')" title="Doppelklick: Buchung für ${escHtml(r.name)} am ${day}"></div>`;}).join('');
      const bars=events.map(b=>{
        const start=Math.max(0,diffDays(from,b.from)),end=Math.min(BOARD_DAYS-1,diffDays(from,b.to)),span=Math.max(1,end-start+1),label=`${b.guest}${groupMembers(b).length>1?` · Gruppe (${groupMembers(b).length})`:''}`;
        const cls=b.status==='option'?'option':b.status==='cancelled'?'cancelled':'';
        return `<div class="rs-board-event ${cls}" style="grid-column:${start+1}/span ${span}" onclick="editBooking('${String(b.id).replace(/'/g,"\\'")}')" title="${escHtml(b.guest)} · ${escHtml(r.name)} · ${escHtml(periodText(b))}">${escHtml(label)}</div>`;
      }).join('');
      const blockBars=roomBlocks.map(b=>{const start=Math.max(0,diffDays(from,b.from)),end=Math.min(BOARD_DAYS-1,diffDays(from,b.to)),span=Math.max(1,end-start+1);return `<div class="rs-board-event block" style="grid-column:${start+1}/span ${span}" title="${escHtml(b.type||'Gesperrt')}">${escHtml(b.type||'Gesperrt')}</div>`;}).join('');
      const loc=r.location||'';if(activeLocation()==='all'&&loc&&loc!==lastLocation){rows+=`<div class="rs-board-row" style="min-height:32px"><div class="rs-board-room" style="background:#f7f9fc"><strong>${escHtml(loc)}</strong></div><div style="background:#f7f9fc;border-bottom:1px solid var(--line)"></div></div>`;lastLocation=loc;}
      rows+=`<div class="rs-board-row"><div class="rs-board-room"><strong>${escHtml(r.name)}</strong><small>${escHtml(r.type||'Raum')} · Kapazität ${Number(r.capacity)||1}</small></div><div class="rs-board-track">${cells}${bars}${blockBars}</div></div>`;
    });
    grid.innerHTML=head+rows;
  }

  function groupedVisibleBookings(){
    const loc=activeLocation(),q=(document.getElementById('bookingSearch')?.value||'').toLowerCase(),map=new Map();
    for(const b of (bookings||[])){
      const r=roomFor(b.roomId);if(loc!=='all'&&r?.location!==loc)continue;
      const key=groupKey(b);if(!map.has(key))map.set(key,[]);map.get(key).push(b);
    }
    return [...map.values()].filter(members=>{
      const rep=representative(members),roomText=members.map(m=>roomFor(m.roomId)?.name||'').join(' ');
      return [rep?.guest,roomText,rep?.purpose,rep?.from,rep?.to,rep?.catering,rep?.cateringNote].join(' ').toLowerCase().includes(q);
    }).sort((a,b)=>String(representative(b)?.from||'').localeCompare(String(representative(a)?.from||'')));
  }
  function cateringHtml(b){
    if(!b?.catering)return '<span class="muted">–</span>';
    return `<strong>${escHtml(b.catering)}</strong>${b.cateringParticipants?`<div class="row-meta">${escHtml(b.cateringParticipants)} Personen</div>`:''}${b.cateringNote?`<div class="row-meta">${escHtml(b.cateringNote)}</div>`:''}`;
  }
  function renderGroupedBookingTable(){
    const body=document.getElementById('bookingTable');if(!body)return;
    const head=document.querySelector('#bookingListPanel table thead tr');if(head)head.innerHTML='<th>Zeitraum</th><th>Gast/Kunde</th><th>Zimmer / Räume</th><th>Zweck</th><th>Verpflegung</th><th>Status</th><th></th>';
    const groups=groupedVisibleBookings();
    body.innerHTML=groups.length?groups.map(members=>{const b=representative(members);return `<tr><td>${periodText(b)}</td><td><strong>${escHtml(b.guest)}</strong>${members.length>1?`<div class="row-meta">Gruppenbuchung</div>`:''}</td><td>${groupRoomLabel(members)}</td><td>${escHtml(b.purpose||'–')}</td><td class="booking-catering-cell">${cateringHtml(b)}</td><td>${statusHtml(b)}</td><td><div class="row-actions"><button class="btn small" onclick="editBooking('${b.id}')">Bearbeiten</button><button class="btn small danger" onclick="deleteBooking('${b.id}')">Löschen</button></div></td></tr>`;}).join(''):'<tr><td colspan="7"><div class="empty">Keine Buchungen gefunden.</div></td></tr>';
  }

  function decorateDashboardGroups(){
    const target=document.getElementById('dashboardBookings');if(!target)return;
    const t=typeof todayIso==='function'?todayIso():iso(new Date()),loc=activeLocation(),groups=new Map();
    for(const b of (bookings||[]).filter(b=>b.status!=='cancelled'&&b.to>=t)){
      const r=roomFor(b.roomId);if(loc!=='all'&&r?.location!==loc)continue;const key=groupKey(b);if(!groups.has(key))groups.set(key,[]);groups.get(key).push(b);
    }
    const list=[...groups.values()].sort((a,b)=>String(a[0].from||'').localeCompare(String(b[0].from||''))).slice(0,6);
    target.innerHTML=list.length?list.map(m=>{const b=m[0],names=m.map(x=>roomFor(x.roomId)?.name||'').filter(Boolean);const roomLine=m.length>1?`${m.length} Zimmer / Räume`:names[0]||'Unbekannter Raum';return `<div class="row"><div class="row-main"><div class="row-title">${escHtml(b.guest)}</div><div class="row-meta">${escHtml(roomLine)} · ${escHtml(periodText(b))}${b.purpose?' · '+escHtml(b.purpose):''}${m.length>1?`<br><span>${names.map(escHtml).join(' · ')}</span>`:''}${b.catering?`<br><span>Verpflegung: ${escHtml(b.catering)}${b.cateringParticipants?` · ${escHtml(b.cateringParticipants)} Pers.`:''}</span>`:''}</div></div>${statusHtml(b)}</div>`;}).join(''):'<div class="empty">Keine kommenden Buchungen. Über „Neue Buchung“ geht es sofort los.</div>';
    const arrivals=[...groups.values()].filter(m=>m[0]?.from===t).length;const stat=document.getElementById('statArrivals');if(stat)stat.textContent=arrivals;
  }

  function fillGroupedDocumentPicker(){
    const s=document.getElementById('documentBooking');if(!s)return;const groups=groupedVisibleBookings().filter(m=>m[0]?.status!=='cancelled');
    s.innerHTML=groups.length?groups.map(m=>{const b=m[0],label=m.length>1?`${m.length} Zimmer / Räume`:roomFor(b.roomId)?.name||'';return `<option value="${escHtml(b.id)}">${String(periodText(b)).replace(/<[^>]+>/g,'')} · ${escHtml(b.guest)} · ${escHtml(label)}</option>`;}).join(''):'<option value="">Keine Buchung vorhanden</option>';
  }

  function createGroupConfirmation(){
    const id=document.getElementById('documentBooking')?.value||'',b=(bookings||[]).find(x=>x.id===id);if(!b)return alert('Bitte zuerst eine Buchung anlegen.');
    const members=groupMembers(b),names=members.map(m=>roomFor(m.roomId)?.name||'Unbekannter Raum'),w=window.open('','_blank');
    const catering=b.catering?`<div class="row"><b>Verpflegung</b><span>${escHtml(b.catering)}${b.cateringParticipants?` · ${escHtml(b.cateringParticipants)} Personen`:''}</span></div>${b.cateringNote?`<div class="row"><b>Verpflegungshinweis</b><span>${escHtml(b.cateringNote)}</span></div>`:''}`:'';
    w.document.write(`<!doctype html><html><head><title>Buchungsbestätigung</title><style>body{font-family:Arial;max-width:760px;margin:50px auto;color:#172033;line-height:1.5}h1{margin-bottom:4px}.box{border:1px solid #ddd;border-radius:12px;padding:20px;margin:24px 0}.row{display:grid;grid-template-columns:180px 1fr;padding:7px 0;border-bottom:1px solid #eee}.row:last-child{border:0}.muted{color:#666}@media print{button{display:none}}</style></head><body><h1>${escHtml(settings.org||'Raum- & Zimmerverwaltung')}</h1><div class="muted">Buchungsbestätigung</div><div class="box"><div class="row"><b>Gast / Kunde</b><span>${escHtml(b.guest)}</span></div><div class="row"><b>Zimmer / Räume</b><span>${names.map(escHtml).join('<br>')}</span></div><div class="row"><b>Zeitraum</b><span>${periodText(b)}</span></div><div class="row"><b>Zweck</b><span>${escHtml(b.purpose||'–')}</span></div><div class="row"><b>Teilnehmerzahl</b><span>${b.participants||'–'}</span></div>${catering}<div class="row"><b>Notiz</b><span>${escHtml(b.note||'–')}</span></div></div><p>${escHtml(settings.address||'')}</p><p>${escHtml(settings.email||'')} ${settings.phone?'· '+escHtml(settings.phone):''}</p><button onclick="window.print()">Drucken / als PDF speichern</button></body></html>`);w.document.close();closeModal('documentModal');
  }

  function saveGroupBooking(){
    injectRoomPicker();hideFormError('bookingError');
    const id=document.getElementById('bookingId')?.value||'',old=(bookings||[]).find(b=>b.id===id),oldMembers=old?groupMembers(old):[],oldIds=new Set(oldMembers.map(b=>b.id));
    const roomIds=selectedRoomIds(),guest=document.getElementById('bookingGuest')?.value.trim()||'',from=document.getElementById('bookingFrom')?.value||'',to=document.getElementById('bookingTo')?.value||'',status=document.getElementById('bookingStatus')?.value||'confirmed';
    if(!guest||!roomIds.length||!from||!to)return showFormError('bookingError','Bitte Gast/Kunde, mindestens ein Zimmer oder einen Raum und den Zeitraum vollständig angeben.');
    if(to<from)return showFormError('bookingError','Das Bis-Datum darf nicht vor dem Von-Datum liegen.');
    const anyTimed=roomIds.some(isTimedRoom),fromTime=anyTimed?(document.getElementById('bookingFromTime')?.value||''):'',toTime=anyTimed?(document.getElementById('bookingToTime')?.value||''):'';
    if(anyTimed&&(!validTime(fromTime)||!validTime(toTime)))return showFormError('bookingError','Bitte für Seminar- und Veranstaltungsräume eine Von- und Bis-Uhrzeit angeben.');
    if(anyTimed&&`${from}T${fromTime}`>=`${to}T${toTime}`)return showFormError('bookingError','Die Endzeit muss nach der Startzeit liegen.');
    const conflicts=[];
    for(const roomId of roomIds){
      const timed=isTimedRoom(roomId),candidate={from,to,fromTime:timed?fromTime:'',toTime:timed?toTime:''};
      const booked=status!=='cancelled'&&(bookings||[]).some(b=>{if(oldIds.has(b.id)||b.status==='cancelled'||b.roomId!==roomId)return false;return timed?timedOverlap(candidate,b):(from<=b.to&&to>=b.from);});
      const blocked=status!=='cancelled'&&typeof blocks!=='undefined'&&(blocks||[]).some(b=>b.roomId===roomId&&from<=b.to&&to>=b.from);
      if(booked||blocked)conflicts.push(roomFor(roomId)?.name||roomId);
    }
    if(conflicts.length)return showFormError('bookingError',`Bereits belegt oder gesperrt: ${conflicts.join(', ')}.`);
    const groupId=old?.groupId||old?.bookingGroupId||(roomIds.length>1?uid():'');
    const purpose=document.getElementById('bookingPurpose')?.value.trim()||'',participants=Number(document.getElementById('bookingParticipants')?.value)||null,note=document.getElementById('bookingNote')?.value.trim()||'';
    const catering=document.getElementById('bookingCatering')?.value||'',cateringParticipants=Number(document.getElementById('bookingCateringParticipants')?.value)||null,cateringNote=document.getElementById('bookingCateringNote')?.value.trim()||'';
    const byRoom=new Map(oldMembers.map(b=>[b.roomId,b])),now=new Date().toISOString();
    const nextMembers=roomIds.map((roomId,index)=>{
      const prior=byRoom.get(roomId)||(index===0&&old?old:null),timed=isTimedRoom(roomId);
      const data={...(prior||{}),id:prior?.id||uid(),roomId,guest,from,to,fromTime:timed?fromTime:'',toTime:timed?toTime:'',purpose,participants,status,note,catering,cateringParticipants,cateringNote,createdAt:prior?.createdAt||old?.createdAt||now};
      if(groupId){data.groupId=groupId;data.groupOrder=index+1;}else{delete data.groupId;delete data.bookingGroupId;delete data.groupOrder;}
      return data;
    });
    bookings=(bookings||[]).filter(b=>!oldIds.has(b.id));bookings.push(...nextMembers);
    ensureGuestFromBooking(guest);persist();closeModal('bookingModal');renderAll();toast(old?'Buchung geändert':roomIds.length>1?`${roomIds.length} Zimmer / Räume gemeinsam gebucht`:'Buchung gespeichert');
  }

  function deleteGroupBooking(id){
    const b=(bookings||[]).find(x=>x.id===id);if(!b)return;const members=groupMembers(b),count=members.length;
    if(!confirm(count>1?`Gruppenbuchung von ${b.guest} mit ${count} Zimmern / Räumen wirklich löschen?`:`Buchung von ${b.guest} wirklich löschen?`))return;
    const ids=new Set(members.map(x=>x.id));bookings=bookings.filter(x=>!ids.has(x.id));persist();renderAll();toast(count>1?'Gruppenbuchung gelöscht':'Buchung gelöscht');
  }

  function install(){
    if(window.__raumsuiteGroupBookingBoardInstalled)return true;
    if(typeof bookings==='undefined'||typeof rooms==='undefined'||typeof renderAll!=='function'||typeof saveBooking!=='function')return false;
    if(!document.getElementById('bookingModal'))return false;
    window.__raumsuiteGroupBookingBoardInstalled=true;injectStyles();injectRoomPicker();injectBoardUi();

    const previousOpen=openBookingModal;
    openBookingModal=function(id=null,date=null){const result=previousOpen.call(this,id,date);injectRoomPicker();renderRoomPicker();if(!id)setSelectedRooms([]);return result;};
    const previousEdit=editBooking;
    editBooking=function(id,...rest){const b=(bookings||[]).find(x=>x.id===id),members=groupMembers(b);const result=previousEdit.call(this,id,...rest);injectRoomPicker();renderRoomPicker();setSelectedRooms(members.map(m=>m.roomId));if(members.length>1){const title=document.getElementById('bookingModalTitle');if(title)title.textContent='Gruppenbuchung bearbeiten';}return result;};
    saveBooking=saveGroupBooking;deleteBooking=deleteGroupBooking;

    renderBookingTable=renderGroupedBookingTable;
    const previousDashboard=renderDashboard;
    renderDashboard=function(...args){const result=previousDashboard.apply(this,args);decorateDashboardGroups();return result;};
    fillDocumentPicker=fillGroupedDocumentPicker;createConfirmation=createGroupConfirmation;

    const previousRenderAll=renderAll;
    renderAll=function(...args){const result=previousRenderAll.apply(this,args);injectBoardUi();renderBoard();renderRoomPicker();renderGroupedBookingTable();decorateDashboardGroups();return result;};
    const previousRenderPage=renderPage;
    renderPage=function(page,...args){const result=previousRenderPage.call(this,page,...args);if(page==='calendar'){injectBoardUi();renderBoard();showCalendarView(calendarView,false);}return result;};

    ['bookingFrom','bookingTo','bookingFromTime','bookingToTime'].forEach(id=>document.getElementById(id)?.addEventListener('input',renderRoomPicker));
    renderAll();showCalendarView('board',false);return true;
  }

  let tries=0;const timer=setInterval(()=>{
    tries++;
    const cateringReady=window.__raumsuiteCateringPersistenceInstalled||tries>35;
    const locationsReady=window.__raumsuiteLocationsLoaded||tries>35;
    if(cateringReady&&locationsReady&&install())clearInterval(timer);
    if(tries>120)clearInterval(timer);
  },100);
})();