/* RAUMWERK Reinigungshistorie – kompakt starten, vollständig aufklappbar */
(function(){
  let expanded=false;

  function historyRows(){
    return cleaningPlans
      .filter(job=>job.status==='done')
      .sort((a,b)=>String(b.completedAt||b.date||'').localeCompare(String(a.completedAt||a.date||'')));
  }

  function renderExpandedCleaningHistory(){
    const wrap=document.getElementById('cleaningV2HistoryList');
    if(!wrap)return;

    const all=historyRows();
    const visible=expanded?all:all.slice(0,20);
    const panel=wrap.closest('.cleaning-v2-history');
    const head=panel?.querySelector('.panel-head');
    let button=document.getElementById('cleaningV2HistoryAllButton');

    if(all.length>20){
      if(!button&&head){
        button=document.createElement('button');
        button.id='cleaningV2HistoryAllButton';
        button.className='btn small';
        button.addEventListener('click',()=>{expanded=!expanded;renderExpandedCleaningHistory()});
        head.appendChild(button);
      }
      if(button){
        button.style.display='';
        button.textContent=expanded?'Weniger anzeigen':`Alle anzeigen (${all.length})`;
      }
    }else if(button){
      button.style.display='none';
    }

    wrap.innerHTML=visible.length?visible.map(job=>{
      const stamp=cleaningHistoryStamp(job);
      return `<div class="clean-v2-history-row"><div class="clean-v2-history-date">${esc(stamp.date)}${stamp.time?' · '+esc(stamp.time):''}</div><div class="clean-v2-history-room">✓ ${esc(roomName(job.roomId))}</div><div class="clean-v2-history-user">gereinigt von <strong>${esc(cleaningCompletedBy(job))}</strong></div></div>`;
    }).join(''):'<div class="empty">Noch keine abgeschlossene Reinigung vorhanden.</div>';
  }

  if(typeof renderCleaningV2==='function'){
    const baseRenderCleaningV2=renderCleaningV2;
    renderCleaningV2=function(){
      baseRenderCleaningV2();
      renderExpandedCleaningHistory();
    };
  }

  renderExpandedCleaningHistory();
})();
