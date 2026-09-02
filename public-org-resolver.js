(async function(){
  const url=new URL(location.href);

  function load(src){
    return new Promise((resolve,reject)=>{
      const s=document.createElement('script');
      s.src=src;
      s.onload=resolve;
      s.onerror=reject;
      document.body.appendChild(s);
    });
  }

  async function start(){
    await load('public-booking.js?v=20260902-11');
    await load('brand-override.js?v=20260902-11');
  }

  // Ein gültiger geteilter Buchungslink enthält immer die Organisation.
  if(url.searchParams.get('org')){
    await start();
    return;
  }

  // Wird die Seite direkt aus der angemeldeten RAUMSUITE geöffnet,
  // ermitteln wir zuerst die aktuelle Organisation und laden ERST DANACH die Räume.
  try{
    const res=await fetch('/api/me',{headers:{Accept:'application/json'},credentials:'same-origin',cache:'no-store'});
    if(res.ok){
      const data=await res.json();
      const orgId=String(data?.organization?.id||'').trim();
      if(orgId){
        url.searchParams.set('org',orgId);
        history.replaceState(null,'',url.href);
        await start();
        return;
      }
    }
  }catch{}

  // Ohne Organisationskennung niemals irgendeinen alten/anderen Datenbestand anzeigen.
  const note=document.getElementById('availabilityNote');
  if(note)note.textContent='Dieser Buchungslink ist nicht vollständig. Bitte verwenden Sie den aktuellen Buchungslink der Einrichtung.';
  const button=document.querySelector('button[onclick="checkAvailability()"]');
  if(button)button.disabled=true;
})();
