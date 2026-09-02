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

  function updateSelectionBar(){
    const select=document.getElementById('bookingCatering');
    if(!select)return;
    let bar=document.getElementById('bookingCateringSelectedBar');
    if(!bar){
      bar=document.createElement('div');
      bar.id='bookingCateringSelectedBar';
      bar.className='catering-selection-bar';
      const note=document.getElementById('bookingCateringNoteField');
      (note||select.closest('.field'))?.insertAdjacentElement('beforebegin',bar);
    }
    const value=select.value||'';
    const nextText=value?`Verpflegung: ${value}`:'';
    const nextDisplay=value?'inline-flex':'none';
    if(bar.textContent!==nextText)bar.textContent=nextText;
    if(bar.style.display!==nextDisplay)bar.style.display=nextDisplay;
    if(!select.dataset.cateringBarBound){
      select.dataset.cateringBarBound='1';
      select.addEventListener('change',updateSelectionBar);
    }
  }

  function decorateDashboard(){
    document.querySelectorAll('#dashboardBookings .row-meta').forEach(meta=>{
      const spans=[...meta.querySelectorAll('span')];
      const target=spans.find(s=>(s.textContent||'').trim().startsWith('Verpflegung:'));
      if(target&&!target.classList.contains('catering-dashboard-badge'))target.classList.add('catering-dashboard-badge');
    });
  }

  function refresh(){
    addStyles();
    updateSelectionBar();
    decorateDashboard();
  }

  addStyles();
  refresh();

  // Nur auf echte Nutzeraktionen reagieren. Der frühere globale MutationObserver
  // hat sich durch eigene DOM-Aenderungen selbst erneut ausgeloest und konnte
  // beim Oeffnen von "Buchung bearbeiten" den Browser blockieren.
  document.addEventListener('click',()=>setTimeout(refresh,0),true);
  document.addEventListener('change',event=>{
    if(event.target?.id==='bookingCatering')updateSelectionBar();
  },true);

  // Wenn das Buchungsfenster durch andere Module aufgebaut wird, einmal kurz
  // nachziehen, ohne den gesamten DOM dauerhaft zu beobachten.
  const bookingModal=document.getElementById('bookingModal');
  if(bookingModal){
    const modalObserver=new MutationObserver(()=>{
      setTimeout(refresh,0);
    });
    modalObserver.observe(bookingModal,{attributes:true,attributeFilter:['class']});
  }
})();
