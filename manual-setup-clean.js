(function(){
  if(window.__raumsuiteManualSetupCleanLoaded)return;
  window.__raumsuiteManualSetupCleanLoaded=true;

  const VERSION=1;
  const OLD_ROOM_NAMES=new Set([
    'Seminarraum Luther','Seminarraum Melanchthon','Besprechungsraum 1',
    'Gästezimmer 201','Gästezimmer 202','Gästezimmer 203','Gästezimmer 204','Gruppenraum'
  ]);
  const DEMO_GUESTS=new Set([
    'Bildungsforum Beispiel e.V.','Anna Berger','Sozialwerk Musterstadt',
    'Jugendgruppe Beispiel','Projektteam Nord','Jugendbildungswerk Beispiel',
    'Jugendwerk Beispiel','Maria Schneider','Kirchengemeinderat'
  ]);

  function seedDataDetected(){
    if(typeof rooms==='undefined'||typeof bookings==='undefined'||typeof settings==='undefined')return false;
    if(Number(settings?._manualEntrySetupVersion||0)>=VERSION)return false;
    const roomList=Array.isArray(rooms)?rooms:[];
    const bookingList=Array.isArray(bookings)?bookings:[];
    const oldRoomHits=roomList.filter(r=>OLD_ROOM_NAMES.has(String(r?.name||''))).length;
    const demoGuestHits=bookingList.filter(b=>DEMO_GUESTS.has(String(b?.guest||''))).length;
    const exactDemoIds=roomList.filter(r=>/^(?:nz\d{3}|sz\d{3}|nt[1-5]|st[1-5])$/.test(String(r?.id||''))).length;
    return oldRoomHits>=3 || demoGuestHits>=3 || exactDemoIds>=20 || settings?.org==='Tagungs- & Gästehaus Beispiel';
  }

  function clearKnownTestState(){
    if(typeof rooms==='undefined'||typeof bookings==='undefined'||typeof settings==='undefined')return false;
    if(!seedDataDetected())return false;

    rooms=[];
    bookings=[];
    if(typeof guests!=='undefined')guests=[];
    if(typeof tasks!=='undefined')tasks=[];
    if(typeof cleaningPlans!=='undefined')cleaningPlans=[];
    if(typeof shifts!=='undefined')shifts=[];
    if(typeof blocks!=='undefined')blocks=[];
    if(typeof contracts!=='undefined')contracts=[];
    if(typeof invoices!=='undefined')invoices=[];
    if(typeof bookingRequests!=='undefined')bookingRequests=[];

    const orgName=window.raumwerkCloud?.organization?.name||'';
    settings={
      ...settings,
      org:orgName||((settings?.org==='Tagungs- & Gästehaus Beispiel'||settings?.org==='Evangelische Einrichtung')?'':settings?.org||''),
      locations:[],
      _manualEntrySetupVersion:VERSION
    };

    if(typeof persistLocal==='function')persistLocal();
    if(typeof renderAll==='function')renderAll();
    return true;
  }

  async function clearAndSaveIfNeeded(){
    if(!clearKnownTestState())return false;
    if(typeof cloud!=='undefined'&&cloud.mode==='online'){
      if(typeof persist==='function')persist();
      if(typeof saveCloudState==='function'){
        clearTimeout(cloud.saveTimer);
        await saveCloudState();
      }
    }
    if(typeof toast==='function')toast('Testdaten entfernt – bereit für deine eigenen Räume');
    return true;
  }

  // Keine Demo-Daten mehr versehentlich nachladen.
  window.loadDemoData=function(){
    if(typeof toast==='function')toast('Demo-Daten sind deaktiviert. Bitte eigene Daten anlegen.');
  };

  function removeDemoUi(){
    document.querySelectorAll('button').forEach(btn=>{
      if(/demo-daten laden/i.test(btn.textContent||''))btn.remove();
    });
    document.querySelectorAll('#page-settings .panel').forEach(panel=>{
      const heading=panel.querySelector('h2');
      if(heading&&/daten\s*&\s*demo/i.test(heading.textContent||''))heading.textContent='Daten & Sicherung';
      panel.querySelectorAll('p').forEach(p=>{
        if(/beispieldaten|für tests/i.test(p.textContent||''))p.textContent='Eigene Daten können gesichert und bei Bedarf wieder eingelesen werden.';
      });
    });
  }

  // Nach jedem Login/Cloud-Laden einmal prüfen. So wird der bisherige Testbestand
  // genau einmal entfernt, echte spätere Eingaben bleiben unangetastet.
  if(typeof loadCloudState==='function'){
    const originalLoadCloudState=loadCloudState;
    loadCloudState=async function(...args){
      const result=await originalLoadCloudState.apply(this,args);
      await clearAndSaveIfNeeded();
      removeDemoUi();
      return result;
    };
  }

  // Für eine noch nicht eingerichtete Installation die alten lokalen Standardräume
  // schon vor dem Bootstrap entfernen, damit der erste Account wirklich leer startet.
  clearKnownTestState();
  removeDemoUi();

  let tries=0;
  const timer=setInterval(async()=>{
    tries++;
    removeDemoUi();
    if(typeof cloud!=='undefined'&&cloud.mode==='online'){
      await clearAndSaveIfNeeded();
      clearInterval(timer);
    }
    if(tries>300)clearInterval(timer);
  },100);
})();
