(function(){
  const KEY='raumsuite_demo_booking_requests';
  const BACKUP_KEY='raumsuite_presentation_backup';
  const bookingPage=/\/booking\.html$/i.test(location.pathname);
  const demoPage=bookingPage&&new URLSearchParams(location.search).get('demo')==='1';

  function readShared(){
    try{const value=JSON.parse(localStorage.getItem(KEY)||'[]');return Array.isArray(value)?value:[]}catch{return []}
  }
  function writeShared(list){localStorage.setItem(KEY,JSON.stringify(Array.isArray(list)?list:[]))}
  function requestId(){return window.crypto?.randomUUID?.()||`demo-${Date.now()}-${Math.random().toString(36).slice(2)}`}

  if(demoPage){
    if(typeof sendRequest!=='function')return;
    const originalSendRequest=sendRequest;
    sendRequest=async function(...args){
      const snapshot={
        id:requestId(),
        name:document.getElementById('name')?.value.trim()||'',
        email:document.getElementById('email')?.value.trim()||'',
        phone:document.getElementById('phone')?.value.trim()||'',
        purpose:document.getElementById('purpose')?.value.trim()||'',
        participants:Number(document.getElementById('participants')?.value)||1,
        note:document.getElementById('note')?.value.trim()||'',
        roomId:typeof selectedRoom==='string'?selectedRoom:'',
        from:document.getElementById('from')?.value||'',
        to:document.getElementById('to')?.value||'',
        fromTime:document.getElementById('fromTime')?.value||'',
        toTime:document.getElementById('toTime')?.value||'',
        status:'new',
        createdAt:new Date().toISOString()
      };
      const result=await originalSendRequest.apply(this,args);
      const success=document.getElementById('success');
      const succeeded=Boolean(snapshot.roomId&&snapshot.name&&snapshot.email&&success&&success.style.display==='block'&&(success.textContent||'').includes('Präsentationsmodus'));
      if(succeeded){
        const list=readShared();
        list.unshift(snapshot);
        writeShared(list.slice(0,50));
        success.textContent='Präsentationsmodus: Die Buchungsanfrage wurde an die Demo-Verwaltung übergeben.';
      }
      return result;
    };
    window.sendRequest=sendRequest;
    return;
  }

  function presentationActive(){return Boolean(sessionStorage.getItem(BACKUP_KEY))}
  function syncSharedIntoApp(){
    if(!presentationActive()||typeof bookingRequests==='undefined'||!Array.isArray(bookingRequests))return false;
    const shared=readShared();
    if(!shared.length)return false;
    let changed=false;
    const currentById=new Map(bookingRequests.map(r=>[r.id,r]));
    for(const request of shared){
      const current=currentById.get(request.id);
      if(!current){bookingRequests.push({...request});currentById.set(request.id,request);changed=true;continue}
      if(current.status&&current.status!=='new'&&request.status!==current.status){request.status=current.status;changed=true}
    }
    if(changed)writeShared(shared);
    return changed;
  }
  function syncStatusBack(id){
    if(!presentationActive()||typeof bookingRequests==='undefined')return;
    const current=bookingRequests.find(r=>r.id===id);if(!current)return;
    const shared=readShared();const item=shared.find(r=>r.id===id);if(!item)return;
    item.status=current.status||item.status;writeShared(shared);
  }

  if(typeof renderOnlineRequests==='function'){
    const originalRenderOnlineRequests=renderOnlineRequests;
    renderOnlineRequests=function(...args){syncSharedIntoApp();return originalRenderOnlineRequests.apply(this,args)};
    window.renderOnlineRequests=renderOnlineRequests;
  }

  if(typeof acceptOnlineRequest==='function'){
    const originalAcceptOnlineRequest=acceptOnlineRequest;
    acceptOnlineRequest=function(id,...rest){const result=originalAcceptOnlineRequest.call(this,id,...rest);syncStatusBack(id);return result};
    window.acceptOnlineRequest=acceptOnlineRequest;
  }
  if(typeof rejectOnlineRequest==='function'){
    const originalRejectOnlineRequest=rejectOnlineRequest;
    rejectOnlineRequest=function(id,...rest){const result=originalRejectOnlineRequest.call(this,id,...rest);syncStatusBack(id);return result};
    window.rejectOnlineRequest=rejectOnlineRequest;
  }

  if(typeof window.startPresentation==='function'){
    const originalStartPresentation=window.startPresentation;
    window.startPresentation=function(...args){localStorage.removeItem(KEY);const result=originalStartPresentation.apply(this,args);syncSharedIntoApp();return result};
  }
  if(typeof window.stopPresentation==='function'){
    const originalStopPresentation=window.stopPresentation;
    window.stopPresentation=async function(...args){const result=await originalStopPresentation.apply(this,args);localStorage.removeItem(KEY);return result};
  }

  window.addEventListener('storage',event=>{
    if(event.key!==KEY||!presentationActive())return;
    syncSharedIntoApp();
    try{if(typeof renderOnlineRequests==='function')renderOnlineRequests()}catch{}
  });

  syncSharedIntoApp();
})();