(async function(){
  // Öffentliche Buchungsseite immer an die aktuell angemeldete Organisation binden,
  // wenn sie aus RAUMSUITE heraus ohne org-Parameter geöffnet wurde.
  const url=new URL(location.href);
  if(url.searchParams.get('org'))return;
  try{
    const res=await fetch('/api/me',{headers:{Accept:'application/json'},credentials:'same-origin',cache:'no-store'});
    if(!res.ok)return;
    const data=await res.json();
    const orgId=String(data?.organization?.id||'').trim();
    if(!orgId)return;
    url.searchParams.set('org',orgId);
    location.replace(url.href);
  }catch{}
})();
