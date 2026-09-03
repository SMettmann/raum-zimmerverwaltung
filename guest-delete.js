(function(){
  if(window.__raumsuiteGuestDeleteLoaded)return;
  window.__raumsuiteGuestDeleteLoaded=true;

  function guestByName(name){
    const key=String(name||'').trim().toLowerCase();
    return (guests||[]).find(g=>String(g.name||'').trim().toLowerCase()===key);
  }

  function decorateGuestRows(){
    const body=document.getElementById('guestTable');
    if(!body)return;
    body.querySelectorAll('tr').forEach(row=>{
      if(row.querySelector('.guest-delete-btn'))return;
      const name=row.querySelector('td:first-child strong')?.textContent?.trim()||'';
      if(!name)return;
      const guest=guestByName(name);
      if(!guest)return;
      const actions=row.querySelector('.row-actions');
      if(!actions)return;
      const button=document.createElement('button');
      button.className='btn small danger guest-delete-btn';
      button.textContent='Löschen';
      button.onclick=()=>window.deleteGuestContact(guest.id);
      actions.appendChild(button);
    });
  }

  window.deleteGuestContact=function(id){
    const guest=(guests||[]).find(g=>g.id===id);
    if(!guest)return;
    const count=(bookings||[]).filter(b=>String(b.guest||'').trim().toLowerCase()===String(guest.name||'').trim().toLowerCase()).length;
    const message=count
      ?`${guest.name} wirklich aus „Gäste & Kunden“ löschen?\n\n${count} vorhandene Buchung${count===1?' bleibt':'en bleiben'} erhalten.`
      :`${guest.name} wirklich aus „Gäste & Kunden“ löschen?`;
    if(!confirm(message))return;

    guests=guests.filter(g=>g.id!==id);
    if(typeof persist==='function')persist();
    if(typeof renderGuestsPage==='function')renderGuestsPage();
    if(typeof fillSelectors==='function')fillSelectors();
    if(typeof toast==='function')toast('Gast / Kunde gelöscht');
  };

  if(typeof renderGuestsPage==='function'){
    const previousRenderGuestsPage=renderGuestsPage;
    renderGuestsPage=function(...args){
      const result=previousRenderGuestsPage.apply(this,args);
      decorateGuestRows();
      return result;
    };
  }

  decorateGuestRows();
})();
