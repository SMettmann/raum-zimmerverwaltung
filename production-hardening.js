/* RAUMWERK production safeguards: protect shared cloud data from demo/import/reset accidents. */
(function(){
  const isCloud=()=>window.raumwerkCloud?.mode==='online';
  const role=()=>window.raumwerkCloud?.user?.role||'';

  function hardeningPanel(){return document.querySelector('#page-settings .settings-grid .panel:nth-child(2)')}
  function applyProductionSafeguards(){
    const panel=hardeningPanel();if(!panel)return;
    const demo=[...panel.querySelectorAll('button')].find(b=>b.textContent.includes('Demo-Daten'));
    const importLabel=[...panel.querySelectorAll('label')].find(l=>l.textContent.includes('Sicherung einlesen'));
    const reset=[...panel.querySelectorAll('button')].find(b=>b.textContent.includes('Daten löschen')||b.textContent.includes('Daten zurücksetzen'));
    if(isCloud()){
      if(demo)demo.style.display='none';
      if(importLabel)importLabel.style.display=role()==='admin'?'inline-flex':'none';
      if(reset){reset.style.display=role()==='admin'?'inline-flex':'none';reset.textContent='Gemeinsame Daten zurücksetzen';}
      let note=document.getElementById('cloudDataSafetyNote');
      if(!note){note=document.createElement('div');note.id='cloudDataSafetyNote';note.className='notice';panel.insertBefore(note,panel.children[1]||null)}
      note.textContent=role()==='admin'?'Cloud-Betrieb: Demo-Daten sind deaktiviert. Sicherung einlesen und gemeinsames Zurücksetzen sind nur für Administratoren möglich.':'Cloud-Betrieb: Gemeinsame Daten sind geschützt. Import, Demo-Daten und Zurücksetzen sind für diesen Zugang deaktiviert.';
    }else{
      if(demo)demo.style.display='';
      if(importLabel)importLabel.style.display='inline-flex';
      if(reset){reset.style.display='';reset.textContent='Alle lokalen Daten löschen';}
      document.getElementById('cloudDataSafetyNote')?.remove();
    }
  }

  const originalDemo=window.loadDemoData;
  window.loadDemoData=function(){if(isCloud())return alert('Demo-Daten sind im gemeinsamen Cloud-Betrieb deaktiviert.');return originalDemo?.()};

  const originalImport=window.importData;
  window.importData=function(e){
    if(!isCloud())return originalImport?.(e);
    if(role()!=='admin'){if(e?.target)e.target.value='';return alert('Nur Administratoren dürfen eine Sicherung in den gemeinsamen Datenstand einlesen.');}
    if(!confirm('ACHTUNG: Diese Sicherung ersetzt den gemeinsamen Datenstand der Einrichtung. Fortfahren?')){if(e?.target)e.target.value='';return;}
    return originalImport?.(e);
  };

  const originalReset=window.resetAllData;
  window.resetAllData=function(){
    if(!isCloud())return originalReset?.();
    if(role()!=='admin')return alert('Nur Administratoren dürfen gemeinsame Daten zurücksetzen.');
    const phrase=prompt('Zum Schutz vor Fehlbedienung bitte exakt GEMEINSAM ZURÜCKSETZEN eingeben:');
    if(phrase!=='GEMEINSAM ZURÜCKSETZEN')return alert('Zurücksetzen abgebrochen.');
    rooms=[];bookings=[];guests=[];tasks=[];cleaningPlans=[];shifts=[];blocks=[];contracts=[];invoices=[];bookingRequests=[];
    settings={...settings,rentalPeriods:[]};
    persist();renderAll();toast('Gemeinsame Verwaltungsdaten zurückgesetzt');
  };

  const baseRenderSettings=window.renderSettings;
  window.renderSettings=function(){baseRenderSettings?.();applyProductionSafeguards()};
  const baseRenderAll=window.renderAll;
  window.renderAll=function(){baseRenderAll?.();applyProductionSafeguards()};

  document.addEventListener('DOMContentLoaded',applyProductionSafeguards);
  setTimeout(applyProductionSafeguards,0);
})();
