(function(){
  if(window.__raumsuiteOccupancyBoardClarityLoaded)return;
  window.__raumsuiteOccupancyBoardClarityLoaded=true;

  const LOCATION_KEY='raumsuite_active_location';
  let scheduled=false;

  function escHtml(value){
    if(typeof esc==='function')return esc(value);
    return String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }
  function roomIsGuest(room){return /zimmer/i.test(String(room?.type||''))||/zimmer/i.test(String(room?.name||''));}
  function groupKey(b){return String(b?.groupId||b?.bookingGroupId||b?.id||'');}
  function groupMembers(b){const key=groupKey(b);return (bookings||[]).filter(x=>groupKey(x)===key);}
  function colorIndex(key){let h=0;for(const ch of String(key||''))h=((h<<5)-h)+ch.charCodeAt(0),h|=0;return Math.abs(h)%8;}
  function activeLocation(){return localStorage.getItem(LOCATION_KEY)||'all';}

  function injectStyles(){
    if(document.getElementById('rsOccupancyClarityStyles'))return;
    const style=document.createElement('style');
    style.id='rsOccupancyClarityStyles';
    style.textContent=`
      .rs-board-section-row{display:grid;grid-template-columns:220px auto;min-height:34px;background:#f4f6fa;border-bottom:1px solid #dfe5ee;border-top:1px solid #dfe5ee}
      .rs-board-section-label{position:sticky;left:0;z-index:6;display:flex;align-items:center;gap:8px;padding:7px 10px;background:#f4f6fa;border-right:1px solid #dfe5ee;font-size:11px;font-weight:900;letter-spacing:.02em;color:#3d4b61}
      .rs-board-section-label .rs-section-count{margin-left:auto;font-size:10px;font-weight:800;color:#7a8698;background:#fff;border:1px solid #dfe5ee;border-radius:999px;padding:2px 7px}
      .rs-board-section-fill{background:#f4f6fa}
      .rs-board-row.rs-room-guest .rs-board-room{border-left:3px solid #6b88c9;padding-left:8px}
      .rs-board-row.rs-room-function .rs-board-room{border-left:3px solid #8f79b6;padding-left:8px}
      .rs-board-room .rs-room-kind{display:inline-flex;width:max-content;margin-top:4px;border-radius:999px;padding:2px 6px;font-size:9px;font-weight:800;background:#f3f5f8;color:#68758a}
      .rs-board-event[data-group-id]{font-weight:900;box-shadow:0 1px 3px #21314f20}
      .rs-board-event.rs-group-color-0{background:#dce9ff;border-color:#a9c4f5;color:#183f82}
      .rs-board-event.rs-group-color-1{background:#e3f2e8;border-color:#afd4ba;color:#245d35}
      .rs-board-event.rs-group-color-2{background:#f2e7fb;border-color:#cfb6e5;color:#5c3777}
      .rs-board-event.rs-group-color-3{background:#fff0dc;border-color:#edc891;color:#795020}
      .rs-board-event.rs-group-color-4{background:#e0f2f3;border-color:#a9d5d8;color:#245c61}
      .rs-board-event.rs-group-color-5{background:#f7e5ea;border-color:#e1b3c0;color:#77384a}
      .rs-board-event.rs-group-color-6{background:#e8ebff;border-color:#bcc3ee;color:#3c477f}
      .rs-board-event.rs-group-color-7{background:#edf0d9;border-color:#cbd19c;color:#596321}
      .rs-picker-section{padding:7px 9px 5px;margin:4px 2px 2px;font-size:10px;font-weight:900;letter-spacing:.04em;text-transform:uppercase;color:#68758a;border-bottom:1px solid #e7ebf1}
      .rs-group-room-names{color:#657187}
      @media(max-width:700px){.rs-board-section-row{grid-template-columns:170px auto}.rs-board-section-label{padding:7px}}
    `;
    document.head.appendChild(style);
  }

  function findRoomForRow(row,currentLocation){
    const name=row.querySelector('.rs-board-room strong')?.textContent?.trim()||'';
    if(!name)return null;
    const loc=activeLocation();
    return (rooms||[]).find(r=>String(r.name||'').trim()===name&&(currentLocation?String(r.location||'')===currentLocation:loc==='all'||String(r.location||'')===loc))
      ||(rooms||[]).find(r=>String(r.name||'').trim()===name)
      ||null;
  }

  function countVisibleRooms(location,guest){
    const loc=activeLocation();
    return (rooms||[]).filter(r=>(loc==='all'?(String(r.location||'')===location):String(r.location||'')===loc)&&roomIsGuest(r)===guest).length;
  }

  function createSection(label,count){
    const row=document.createElement('div');
    row.className='rs-board-section-row';
    row.dataset.section=label;
    row.innerHTML=`<div class="rs-board-section-label"><span>${escHtml(label)}</span><span class="rs-section-count">${count}</span></div><div class="rs-board-section-fill"></div>`;
    return row;
  }

  function bookingForEvent(event,room){
    if(!room)return null;
    const title=String(event.getAttribute('title')||'');
    const guestFromTitle=title.split(' · ')[0].trim();
    const candidates=(bookings||[]).filter(b=>b.roomId===room.id&&String(b.guest||'')===guestFromTitle);
    if(candidates.length<=1)return candidates[0]||null;
    if(typeof window.bookingPeriodText==='function'){
      return candidates.find(b=>title.includes(String(window.bookingPeriodText(b))))||candidates[0];
    }
    return candidates[0];
  }

  function decorateEvent(event,room){
    if(event.classList.contains('block'))return;
    const booking=bookingForEvent(event,room);if(!booking)return;
    const members=groupMembers(booking);
    if(members.length<=1){event.removeAttribute('data-group-id');return;}
    const key=groupKey(booking),idx=colorIndex(key);
    for(let i=0;i<8;i++)event.classList.toggle(`rs-group-color-${i}`,i===idx);
    event.dataset.groupId=key;
    event.textContent=`${booking.guest} · Gruppe ${members.length}`;
    const names=members.map(m=>(rooms||[]).find(r=>r.id===m.roomId)?.name||'').filter(Boolean);
    const period=typeof window.bookingPeriodText==='function'?window.bookingPeriodText(booking):`${booking.from} – ${booking.to}`;
    event.title=`${booking.guest} · Gruppenbuchung mit ${members.length} Einheiten · ${period}\n${names.join(' · ')}`;
  }

  function decorateBoard(){
    const grid=document.getElementById('rsBoardGrid');if(!grid)return;
    const allRows=[...grid.querySelectorAll(':scope > .rs-board-row')];
    if(!allRows.length)return;

    let currentLocation=activeLocation()==='all'?'':activeLocation();
    const seen=new Set();
    for(const row of allRows){
      const track=row.querySelector('.rs-board-track');
      if(!track){
        const maybeLoc=row.querySelector('.rs-board-room strong')?.textContent?.trim();
        if(maybeLoc)currentLocation=maybeLoc;
        continue;
      }
      const room=findRoomForRow(row,currentLocation);if(!room)continue;
      const guest=roomIsGuest(room),section=guest?'Gästezimmer':'Tagungs- & Veranstaltungsräume';
      const scope=`${currentLocation||String(room.location||'')}|${section}`;
      if(!seen.has(scope)){
        const count=countVisibleRooms(currentLocation||String(room.location||''),guest);
        grid.insertBefore(createSection(section,count),row);
        seen.add(scope);
      }
      row.classList.toggle('rs-room-guest',guest);
      row.classList.toggle('rs-room-function',!guest);
      const roomBox=row.querySelector('.rs-board-room');
      if(roomBox&&!roomBox.querySelector('.rs-room-kind')){
        const kind=document.createElement('span');kind.className='rs-room-kind';kind.textContent=guest?'Übernachtung':'Tagung / Veranstaltung';roomBox.appendChild(kind);
      }
      row.querySelectorAll('.rs-board-event:not(.block)').forEach(event=>decorateEvent(event,room));
    }
  }

  function decoratePicker(){
    const list=document.getElementById('rsRoomList');if(!list)return;
    if(list.querySelector('.rs-picker-section'))return;
    const options=[...list.querySelectorAll('.rs-room-option')];if(!options.length)return;
    let guestAdded=false,functionAdded=false;
    for(const option of options){
      const id=option.querySelector('.rs-room-check')?.value||'';
      const room=(rooms||[]).find(r=>String(r.id)===String(id));if(!room)continue;
      const guest=roomIsGuest(room);
      if(guest&&!guestAdded){option.before(Object.assign(document.createElement('div'),{className:'rs-picker-section',textContent:'Gästezimmer'}));guestAdded=true;}
      if(!guest&&!functionAdded){option.before(Object.assign(document.createElement('div'),{className:'rs-picker-section',textContent:'Tagungs- & Veranstaltungsräume'}));functionAdded=true;}
    }
  }

  function decorate(){
    scheduled=false;injectStyles();decorateBoard();decoratePicker();
  }
  function schedule(){if(scheduled)return;scheduled=true;requestAnimationFrame(decorate);}

  injectStyles();
  const observer=new MutationObserver(schedule);
  observer.observe(document.documentElement,{subtree:true,childList:true});
  window.addEventListener('load',schedule,{once:true});
  document.addEventListener('click',event=>{
    if(event.target.closest?.('#rsBoardViewBtn,#siteSwitch,#page-calendar'))setTimeout(schedule,0);
  },true);
  setTimeout(schedule,0);
})();
