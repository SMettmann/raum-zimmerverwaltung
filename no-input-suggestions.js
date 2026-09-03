(function(){
  if(window.__raumsuiteNoInputSuggestionsLoaded)return;
  window.__raumsuiteNoInputSuggestionsLoaded=true;

  function shouldSkip(el){
    if(!el||el.closest?.('#cloudGate'))return true;
    const type=String(el.type||'').toLowerCase();
    return type==='password'||type==='hidden'||type==='date'||type==='number'||type==='checkbox'||type==='radio'||type==='file';
  }

  function cleanField(el){
    if(!(el instanceof HTMLInputElement||el instanceof HTMLTextAreaElement))return;
    if(shouldSkip(el))return;
    el.setAttribute('autocomplete','off');
    el.setAttribute('autocapitalize','off');
    el.setAttribute('data-form-type','other');
    el.setAttribute('data-lpignore','true');
  }

  function apply(root=document){
    const bookingGuest=(root===document?document:root).querySelector?.('#bookingGuest');
    if(bookingGuest){
      bookingGuest.removeAttribute('list');
      bookingGuest.setAttribute('autocomplete','off');
      bookingGuest.setAttribute('data-form-type','other');
      bookingGuest.setAttribute('data-lpignore','true');
    }
    (root===document?document:root).querySelectorAll?.('input,textarea').forEach(cleanField);
  }

  apply();
  const observer=new MutationObserver(records=>{
    records.forEach(record=>record.addedNodes.forEach(node=>{
      if(node.nodeType!==1)return;
      if(node.matches?.('input,textarea'))cleanField(node);
      apply(node);
    }));
  });
  observer.observe(document.body,{childList:true,subtree:true});

  // Das Datalist bleibt technisch für ältere Funktionen vorhanden, wird aber nicht mehr
  // mit dem Buchungsfeld verbunden. Dadurch erscheinen dort keine früheren Kundennamen.
  const guestField=document.getElementById('bookingGuest');
  if(guestField)guestField.removeAttribute('list');
})();
