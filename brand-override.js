(function(){
  const OLD='RAUMWERK';
  const NEW='RAUMSUITE';

  function swap(value){return typeof value==='string'?value.replaceAll(OLD,NEW):value}

  function replaceVisibleText(root){
    if(!root)return;
    if(root.nodeType===Node.TEXT_NODE){
      if(root.nodeValue&&root.nodeValue.includes(OLD))root.nodeValue=swap(root.nodeValue);
      return;
    }
    if(root.nodeType!==Node.ELEMENT_NODE&&root.nodeType!==Node.DOCUMENT_FRAGMENT_NODE)return;
    const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT,{acceptNode(node){
      const p=node.parentElement;
      if(!p||['SCRIPT','STYLE','NOSCRIPT'].includes(p.tagName))return NodeFilter.FILTER_REJECT;
      return node.nodeValue?.includes(OLD)?NodeFilter.FILTER_ACCEPT:NodeFilter.FILTER_REJECT;
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

  const featureScript=document.createElement('script');
  featureScript.src='location-demo.js';
  featureScript.onload=()=>{
    const invoiceScript=document.createElement('script');
    invoiceScript.src='presentation-invoices.js';
    document.head.appendChild(invoiceScript);
  };
  document.head.appendChild(featureScript);
})();
