(function(){
  const OLD='RAUMWERK';
  const NEW='RAUMSUITE';
  const bookingPage=/\/booking\.html$/i.test(location.pathname);

  function swap(value){
    if(typeof value!=='string')return value;
    return value.replaceAll(OLD,NEW).replace(/\bOption\b/g,'Vorgemerkt');
  }

  function replaceVisibleText(root){
    if(!root)return;
    if(root.nodeType===Node.TEXT_NODE){
      if(root.nodeValue){
        const next=swap(root.nodeValue);
        if(next!==root.nodeValue)root.nodeValue=next;
      }
      return;
    }
    if(root.nodeType!==Node.ELEMENT_NODE&&root.nodeType!==Node.DOCUMENT_FRAGMENT_NODE)return;
    const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT,{acceptNode(node){
      const p=node.parentElement;
      if(!p||['SCRIPT','STYLE','NOSCRIPT'].includes(p.tagName))return NodeFilter.FILTER_REJECT;
      return swap(node.nodeValue)!==node.nodeValue?NodeFilter.FILTER_ACCEPT:NodeFilter.FILTER_REJECT;
    }});
    const nodes=[];while(walker.nextNode())nodes.push(walker.currentNode);
    nodes.forEach(node=>{node.nodeValue=swap(node.nodeValue)});
  }

  function applyBrand(){
    document.title=swap(document.title);
    replaceVisibleText(document.body);
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',applyBrand,{once:true});
  else applyBrand();

  const observer=new MutationObserver(records=>{
    for(const record of records){
      record.addedNodes.forEach(node=>replaceVisibleText(node));
      if(record.type==='characterData')replaceVisibleText(record.target);
    }
  });
  observer.observe(document.documentElement,{subtree:true,childList:true,characterData:true});

  if(typeof window.openPrintWindow==='function'){
    const originalOpenPrintWindow=window.openPrintWindow;
    window.openPrintWindow=function(title,body){return originalOpenPrintWindow(swap(title),swap(body))};
  }

  if(typeof window.downloadFile==='function'){
    const originalDownloadFile=window.downloadFile;
    window.downloadFile=function(name,content,type){
      const brandedName=String(name||'').replace(/^raumwerk-/i,'raumsuite-');
      return originalDownloadFile(brandedName,content,type);
    };
  }

  function loadScript(src,onload){
    const clean=src.split('?')[0];
    const existing=[...document.scripts].find(s=>String(s.src||'').includes(clean));
    if(existing){
      if(onload)setTimeout(onload,0);
      return existing;
    }
    const script=document.createElement('script');
    script.src=src;
    if(onload)script.addEventListener('load',onload,{once:true});
    document.head.appendChild(script);
    return script;
  }

  if(!bookingPage){
    const presentationActive=()=>Boolean(sessionStorage.getItem('raumsuite_presentation_backup'));
    document.addEventListener('click',event=>{
      const link=event.target.closest?.('a[href*="booking.html"]');
      if(!link||!presentationActive())return;
      event.preventDefault();
      const url=new URL(link.getAttribute('href'),location.href);
      url.searchParams.set('demo','1');
      window.open(url.href,link.target||'_self');
    },true);

    if(typeof window.copyBookingLink==='function'){
      const originalCopyBookingLink=window.copyBookingLink;
      window.copyBookingLink=function(){
        if(!presentationActive())return originalCopyBookingLink();
        const url=new URL('booking.html',location.href);url.searchParams.set('demo','1');
        navigator.clipboard?.writeText(url.href);if(typeof toast==='function')toast('Präsentations-Buchungslink kopiert');
      };
    }

    loadScript('location-demo.js?v=20260902-4',()=>{
      loadScript('presentation-invoices.js?v=20260902-4');
    });

    window.addEventListener('load',()=>{
      const afterCatering=()=>{
        loadScript('location-filter-final.js?v=20260902-4',()=>{
          loadScript('catering-visual-final.js?v=20260902-4');
        });
      };
      if(window.__raumsuiteCateringLoaded)afterCatering();
      else loadScript('catering-booking.js?v=20260902-4',afterCatering);
    },{once:true});
  }
})();
