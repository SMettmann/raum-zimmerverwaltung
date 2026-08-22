/* RAUMWERK Live-Test Runde 2 – Rollen-UX, Rechnungsstatus, Datumslogik, Reinigung */
(function(){
  function actor(){
    const u=window.raumwerkCloud?.user||((typeof cloud!=='undefined'&&cloud.user)?cloud.user:null);
    const domName=document.querySelector('#cloudAccount b')?.textContent?.trim()||'';
    return {name:u?.name||domName||'Nicht angegeben',id:u?.id||''};
  }

  function stamp(iso){
    if(!iso)return '';
    const d=new Date(iso);if(Number.isNaN(d.getTime()))return '';
    return new Intl.DateTimeFormat('de-DE',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}).format(d);
  }

  // Rollen-UX: keine Admin-Bereiche kurz anzeigen und Abmelden für Reinigung immer erreichbar halten.
  if(!document.getElementById('liveRoundTwoRoleStyle')){
    const style=document.createElement('style');style.id='liveRoundTwoRoleStyle';style.textContent=`
      html[data-role="cleaning"] .top-actions{display:flex!important}
      html[data-role="cleaning"] .top-actions>button{display:none!important}
      html[data-role="staff"] #page-settings .settings-grid>.panel:nth-child(1),
      html[data-role="staff"] #page-settings .settings-grid>.panel:nth-child(2),
      html[data-role="staff"] #billingSettingsPanel,
      html[data-role="staff"] #cloudAuditPanel,
      html[data-role="viewer"] #page-settings .settings-grid>.panel:nth-child(1),
      html[data-role="viewer"] #page-settings .settings-grid>.panel:nth-child(2),
      html[data-role="viewer"] #billingSettingsPanel,
      html[data-role="viewer"] #cloudAuditPanel{display:none!important}
    `;document.head.appendChild(style);
  }

  const baseApplyRoleUi=applyRoleUi;
  applyRoleUi=function(){
    document.documentElement.dataset.role=window.raumwerkCloud?.user?.role||((typeof cloud!=='undefined'&&cloud.user)?cloud.user.role:'')||'';
    return baseApplyRoleUi();
  };

  cloudLogin=async function(e){
    e.preventDefault();cloudAuthError('');
    const res=await fetch('/api/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:document.getElementById('cloudEmail').value,password:document.getElementById('cloudPassword').value})});
    const data=await res.json();if(!res.ok)return cloudAuthError(data.error||'Anmeldung fehlgeschlagen.');
    cloud.user=data.user;cloud.organization=data.organization;applyRoleUi();await loadCloudState();
  };

  cloudLogout=async function(){
    await fetch('/api/logout',{method:'POST'});
    cloud.mode='checking';cloud.user=null;cloud.organization=null;document.documentElement.dataset.role='';
    ['cloudAccount','cloudUsersPanel','cloudAuditPanel','ownPasswordPanel'].forEach(id=>document.getElementById(id)?.remove());
    showCloudLogin();
  };

  // Buchungsdatum: Abreise darf nicht hinter der gewählten Ankunft zurückbleiben.
  function syncBookingDates(){
    const from=document.getElementById('bookingFrom'),to=document.getElementById('bookingTo');if(!from||!to)return;
    to.min=from.value||'';
    if(from.value&&(!to.value||to.value<from.value))to.value=from.value;
  }
  function bindBookingDates(){
    const from=document.getElementById('bookingFrom');if(!from||from.dataset.roundTwoDateBound==='1')return;
    from.dataset.roundTwoDateBound='1';from.addEventListener('change',syncBookingDates);syncBookingDates();
  }
  const baseOpenBookingModal=openBookingModal;
  openBookingModal=function(...args){const result=baseOpenBookingModal(...args);bindBookingDates();syncBookingDates();return result};
  const baseEditBooking=editBooking;
  editBooking=function(...args){const result=baseEditBooking(...args);bindBookingDates();syncBookingDates();return result};
  bindBookingDates();

  // Reinigung: immer den tatsächlich eingeloggten Benutzer in der Historie speichern.
  finishCleaningJob=function(id){
    const job=cleaningPlans.find(j=>j.id===id);if(!job)return;
    const who=actor();job.status='done';job.completedAt=new Date().toISOString();job.completedBy=who.name;job.completedByUserId=who.id;delete job.startedAt;
    const otherActive=cleaningPlans.some(j=>j.id!==id&&j.roomId===job.roomId&&j.status!=='done'&&j.date<=todayIso());
    rooms=rooms.map(r=>r.id===job.roomId?{...r,cleaning:otherActive?'open':'done'}:r);
    persist();renderAll();toast('Sauber bestätigt');
  };

  // Rechnungsstatus: bezahlt kann wieder auf offen gesetzt werden; Änderungen bleiben nachvollziehbar.
  setInvoiceStatus=function(id,status){
    if(!['open','paid'].includes(status))return;
    const who=actor(),now=new Date().toISOString();
    invoices=invoices.map(i=>{
      if(i.id!==id||i.status===status)return i;
      const paymentHistory=Array.isArray(i.paymentHistory)?[...i.paymentHistory]:[];
      if(status==='paid'){
        paymentHistory.push({action:'paid',at:now,by:who.name,userId:who.id});
        return {...i,status:'paid',paidAt:now,paidBy:who.name,paidByUserId:who.id,paymentHistory};
      }
      paymentHistory.push({action:'reopened',at:now,by:who.name,userId:who.id});
      return {...i,status:'open',paidAt:'',paidBy:'',paidByUserId:'',paymentHistory};
    });
    persist();renderInvoices();toast(status==='paid'?'Rechnung als bezahlt markiert':'Rechnung wieder geöffnet');
  };

  renderInvoices=function(){
    const w=document.getElementById('invoiceList');if(!w)return;
    const open=invoices.filter(i=>i.status==='open');
    document.getElementById('invoiceOpen').textContent=open.length;
    document.getElementById('invoicePaid').textContent=invoices.filter(i=>i.status==='paid').length;
    document.getElementById('invoiceOutstanding').textContent=money(open.reduce((a,i)=>a+i.gross,0));
    document.getElementById('invoiceCount').textContent=invoices.length;
    w.innerHTML=invoices.length?[...invoices].sort((a,b)=>String(b.issueDate||'').localeCompare(String(a.issueDate||''))).map(i=>{
      const history=Array.isArray(i.paymentHistory)?i.paymentHistory:[];
      const last=history[history.length-1];
      let activity='';
      if(i.status==='paid'&&(i.paidAt||last?.action==='paid'))activity=`<div class="row-meta">Bezahlt${stamp(i.paidAt||last?.at)?' am '+esc(stamp(i.paidAt||last?.at)):''}${i.paidBy||last?.by?' · von '+esc(i.paidBy||last.by):''}</div>`;
      else if(i.status==='open'&&last?.action==='reopened')activity=`<div class="row-meta">Wieder geöffnet${stamp(last.at)?' am '+esc(stamp(last.at)):''}${last.by?' · von '+esc(last.by):''}</div>`;
      const action=i.status==='paid'?`<button class="btn small" onclick="setInvoiceStatus('${i.id}','open')">Als offen markieren</button>`:`<button class="btn small" onclick="setInvoiceStatus('${i.id}','paid')">Bezahlt ✓</button>`;
      return `<div class="req-row"><div><b>${esc(i.number)} · ${esc(i.buyer)}</b><div class="row-meta">${fmtDate(i.issueDate)} · fällig ${fmtDate(i.dueDate)} · ${esc(i.description)}</div>${activity}</div><div class="req-actions"><span class="req-money">${money(i.gross)}</span><span class="badge ${i.status==='paid'?'green':'red'}">${i.status==='paid'?'Bezahlt':'Offen'}</span><button class="btn small view-only" onclick="printInvoice('${i.id}')">PDF / Drucken</button><button class="btn small view-only" onclick="downloadXRechnung('${i.id}')">XRechnung XML</button>${action}<button class="btn small danger" onclick="deleteInvoice('${i.id}')">Löschen</button></div></div>`;
    }).join(''):'<div class="empty">Noch keine Rechnungen.</div>';
  };

  // Falls die Erweiterung in einer bereits geöffneten Sitzung nachgeladen wird.
  if(window.raumwerkCloud?.user)applyRoleUi();
  syncBookingDates();
})();
