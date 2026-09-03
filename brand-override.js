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
      if(root.nodeValue){const next=swap(root.nodeValue);if(next!==root.nodeValue)root.nodeValue=next;}
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

  function applyBrand(){document.title=swap(document.title);replaceVisibleText(document.body);}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',applyBrand,{once:true});else applyBrand();

  const observer=new MutationObserver(records=>{
    for(const record of records){record.addedNodes.forEach(node=>replaceVisibleText(node));if(record.type==='characterData')replaceVisibleText(record.target);}
  });
  observer.observe(document.documentElement,{subtree:true,childList:true,characterData:true});

  if(typeof window.openPrintWindow==='function'){
    const original=window.openPrintWindow;window.openPrintWindow=function(title,body){return original(swap(title),swap(body));};
  }
  if(typeof window.downloadFile==='function'){
    const original=window.downloadFile;window.downloadFile=function(name,content,type){return original(String(name||'').replace(/^raumwerk-/i,'raumsuite-'),content,type);};
  }

  function loadScript(src,onload){
    const clean=src.split('?')[0];
    const existing=[...document.scripts].find(s=>String(s.src||'').includes(clean));
    if(existing){if(onload)setTimeout(onload,0);return existing;}
    const script=document.createElement('script');script.src=src;if(onload)script.addEventListener('load',onload,{once:true});document.head.appendChild(script);return script;
  }

  if(bookingPage)return;

  function currentBookingUrl(){
    const url=new URL('booking.html',location.href);
    const orgId=window.raumwerkCloud?.organization?.id||'';
    if(orgId)url.searchParams.set('org',orgId);
    return url;
  }

  document.addEventListener('click',event=>{
    const link=event.target.closest?.('a[href*="booking.html"]');
    if(!link)return;
    const url=currentBookingUrl();
    if(!url.searchParams.get('org'))return;
    event.preventDefault();
    window.open(url.href,link.target||'_self');
  },true);

  if(typeof window.copyBookingLink==='function'){
    window.copyBookingLink=function(){
      const url=currentBookingUrl();
      navigator.clipboard?.writeText(url.href);
      if(typeof toast==='function')toast('Buchungslink kopiert');
    };
  }

  window.addEventListener('load',()=>{
    const afterCatering=()=>{
      loadScript('manual-setup-clean.js?v=20260903-1',()=>{
        loadScript('online-booking-final.js?v=20260903-1',()=>{
          loadScript('locations.js?v=20260903-1',()=>{
            loadScript('catering-visual-final.js?v=20260903-1',()=>{
              loadScript('booking-table-final.js?v=20260903-1');
            });
          });
        });
      });
    };
    if(window.__raumsuiteCateringLoaded)afterCatering();
    else loadScript('catering-booking.js?v=20260903-1',afterCatering);
  },{once:true});
})();
