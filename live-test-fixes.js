/* RAUMWERK Live-Test Runde 1 – Aufgabenhistorie und Rechnungs-UX */
(function(){
  const actor=()=>({
    name:window.raumwerkCloud?.user?.name||'Nicht angegeben',
    id:window.raumwerkCloud?.user?.id||''
  });

  function activityStamp(iso){
    if(!iso)return 'Zeitpunkt nicht erfasst';
    const d=new Date(iso);
    if(Number.isNaN(d.getTime()))return 'Zeitpunkt nicht erfasst';
    return new Intl.DateTimeFormat('de-DE',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}).format(d);
  }

  // Aufgaben: Erledigungen und Wiederöffnungen nachvollziehbar machen.
  let taskHistoryExpanded=false;
  function ensureTaskHistoryPanel(){
    const page=document.getElementById('page-tasks');
    if(!page||document.getElementById('taskHistoryPanel'))return;
    const panel=page.querySelector('.panel');
    panel?.insertAdjacentHTML('afterend',`<div class="panel" id="taskHistoryPanel" style="margin-top:18px"><div class="panel-head"><div><h2>Aufgabenhistorie</h2><div class="muted">Wer hat eine Aufgabe wann erledigt oder wieder geöffnet?</div></div><button class="btn small" id="taskHistoryToggle" style="display:none" onclick="toggleTaskHistoryAll()"></button></div><div id="taskHistoryList"></div></div>`);
  }

  function taskEvents(){
    const events=[];
    tasks.forEach(t=>{
      if(Array.isArray(t.history)&&t.history.length){
        t.history.forEach(e=>events.push({...e,taskId:t.id,title:t.title,roomId:t.roomId}));
      }else if(t.done){
        events.push({action:'completed',at:t.completedAt||'',by:t.completedBy||t.owner||'Nicht angegeben',taskId:t.id,title:t.title,roomId:t.roomId,legacy:true});
      }
    });
    return events.sort((a,b)=>String(b.at||'').localeCompare(String(a.at||'')));
  }

  function renderTaskHistory(){
    ensureTaskHistoryPanel();
    const wrap=document.getElementById('taskHistoryList'),toggle=document.getElementById('taskHistoryToggle');
    if(!wrap)return;
    const all=taskEvents(),visible=taskHistoryExpanded?all:all.slice(0,20);
    if(toggle){
      toggle.style.display=all.length>20?'':'none';
      toggle.textContent=taskHistoryExpanded?'Weniger anzeigen':`Alle anzeigen (${all.length})`;
    }
    wrap.innerHTML=visible.length?visible.map(e=>{
      const label=e.action==='reopened'?'Wieder geöffnet':'Erledigt';
      const symbol=e.action==='reopened'?'↶':'✓';
      const when=e.legacy&&!e.at?'Früher erledigt · Zeitpunkt nicht erfasst':activityStamp(e.at);
      return `<div class="req-row"><div><b>${symbol} ${esc(e.title)}</b><div class="row-meta">${esc(when)}${e.roomId?' · '+esc(roomName(e.roomId)):''}</div></div><div class="row-meta"><b>${label}</b> von ${esc(e.by||'Nicht angegeben')}</div></div>`;
    }).join(''):'<div class="empty">Noch keine erledigte oder wieder geöffnete Aufgabe vorhanden.</div>';
  }

  window.toggleTaskHistoryAll=function(){taskHistoryExpanded=!taskHistoryExpanded;renderTaskHistory()};

  renderTasks=function(){
    const wrap=document.getElementById('taskList');if(!wrap)return;
    let list=[...tasks];
    if(taskFilter==='open')list=list.filter(t=>!t.done);
    if(taskFilter==='done')list=list.filter(t=>t.done);
    list.sort((a,b)=>(a.done-b.done)||((a.due||'9999').localeCompare(b.due||'9999')));
    wrap.innerHTML=list.length?list.map(t=>{
      const completion=t.done?`<div class="row-meta">✓ Erledigt ${t.completedAt?'am '+esc(activityStamp(t.completedAt)):'· Zeitpunkt nicht erfasst'} · von ${esc(t.completedBy||t.owner||'Nicht angegeben')}</div>`:'';
      return `<div class="task-card"><div><div class="row-title" style="${t.done?'text-decoration:line-through;color:#8a93a4':''}">${esc(t.title)}</div><div class="row-meta">${t.due?'Fällig '+fmtDate(t.due):'Ohne Termin'}${t.owner?' · '+esc(t.owner):''}${t.roomId?' · '+esc(roomName(t.roomId)):''}</div>${completion}</div><div class="row-actions"><button class="btn small" onclick="toggleTask('${t.id}')">${t.done?'Wieder öffnen':'Erledigt ✓'}</button><button class="btn small danger" onclick="deleteTask('${t.id}')">Löschen</button></div></div>`;
    }).join(''):'<div class="empty">Hier ist alles erledigt.</div>';
    renderTaskHistory();
  };

  saveTask=function(){
    hideFormError('taskError');
    const title=document.getElementById('taskTitle').value.trim();
    if(!title)return showFormError('taskError','Bitte eine Aufgabe eingeben.');
    const who=actor();
    tasks.push({id:uid(),title,due:document.getElementById('taskDue').value,owner:document.getElementById('taskOwner').value.trim(),roomId:document.getElementById('taskRoom').value,done:false,createdAt:new Date().toISOString(),createdBy:who.name,createdByUserId:who.id,history:[]});
    persist();closeModal('taskModal');renderAll();toast('Aufgabe angelegt');
  };

  toggleTask=function(id){
    const who=actor(),now=new Date().toISOString();
    tasks=tasks.map(t=>{
      if(t.id!==id)return t;
      const history=Array.isArray(t.history)?[...t.history]:[];
      if(t.done){
        history.push({action:'reopened',at:now,by:who.name,userId:who.id});
        return {...t,done:false,completedAt:'',completedBy:'',completedByUserId:'',history};
      }
      history.push({action:'completed',at:now,by:who.name,userId:who.id});
      return {...t,done:true,completedAt:now,completedBy:who.name,completedByUserId:who.id,history};
    });
    persist();renderTasks();renderDashboard();
  };

  const baseDeleteTask=deleteTask;
  deleteTask=function(id){baseDeleteTask(id);renderTaskHistory()};

  // Rechnungen: nur noch nicht fakturierte Buchungen anbieten.
  function availableInvoiceBookings(){
    const billed=new Set(invoices.map(i=>i.bookingId).filter(Boolean));
    return bookings.filter(b=>b.status!=='cancelled'&&!billed.has(b.id)).sort((a,b)=>(b.from+(b.fromTime||'')).localeCompare(a.from+(a.fromTime||'')));
  }

  function invoicePeriodTextRaw(invoice,booking){
    const from=invoice.serviceFrom||booking?.from||'',to=invoice.serviceTo||booking?.to||'';
    const fromTime=invoice.serviceFromTime||booking?.fromTime||'',toTime=invoice.serviceToTime||booking?.toTime||'';
    if(!from)return '–';
    if(fromTime&&toTime){
      if(from===to)return `${fmtDate(from)} · ${fromTime}–${toTime}`;
      return `${fmtDate(from)} ${fromTime} – ${fmtDate(to)} ${toTime}`;
    }
    return `${fmtDate(from)} – ${fmtDate(to||from)}`;
  }

  function fillInvoiceBookingSelect(){
    const s=document.getElementById('invoiceBooking');if(!s)return;
    const list=availableInvoiceBookings();
    s.innerHTML=list.length?list.map(b=>{
      const period=window.bookingPeriodText?window.bookingPeriodText(b):`${fmtDate(b.from)} – ${fmtDate(b.to)}`;
      return `<option value="${b.id}">${period} · ${esc(b.guest)} · ${esc(roomName(b.roomId))}</option>`;
    }).join(''):'<option value="">Keine noch nicht abgerechnete Buchung vorhanden</option>';
  }

  openInvoiceModal=function(){
    hideFormError('invoiceError');fillInvoiceBookingSelect();
    document.getElementById('invoiceIssue').value=todayIso();
    const d=new Date();d.setDate(d.getDate()+14);document.getElementById('invoiceDue').value=localIso(d);
    document.getElementById('invoiceNet').value='';document.getElementById('invoiceBuyerRef').value='';
    ['invoiceBuyer','invoiceBuyerStreet','invoiceBuyerZip','invoiceBuyerCity','invoiceBuyerEndpoint'].forEach(id=>{const el=document.getElementById(id);if(el)el.value=''});
    prefillInvoiceBuyer();showModal('invoiceModal');
  };

  prefillInvoiceBuyer=function(){
    const b=bookings.find(x=>x.id===document.getElementById('invoiceBooking')?.value);
    if(!b){['invoiceBuyer','invoiceBuyerStreet','invoiceBuyerZip','invoiceBuyerCity','invoiceBuyerEndpoint'].forEach(id=>{const el=document.getElementById(id);if(el)el.value=''});return}
    const g=guests.find(g=>g.name.toLowerCase()===b.guest.toLowerCase());
    document.getElementById('invoiceBuyer').value=b.guest;
    document.getElementById('invoiceBuyerEndpoint').value=g?.email||'';
  };

  saveInvoice=function(){
    hideFormError('invoiceError');
    const bookingId=document.getElementById('invoiceBooking').value,b=bookings.find(x=>x.id===bookingId);
    const net=Number(document.getElementById('invoiceNet').value),buyer=document.getElementById('invoiceBuyer').value.trim();
    if(!b||!buyer||!net)return showFormError('invoiceError','Bitte eine noch nicht abgerechnete Buchung, Empfänger und Nettobetrag angeben.');
    if(invoices.some(i=>i.bookingId===bookingId))return showFormError('invoiceError','Für diese Buchung wurde bereits eine Rechnung erstellt.');
    const vatRate=Number(document.getElementById('invoiceVat').value),vat=round2(net*vatRate/100),gross=round2(net+vat);
    invoices.push({
      id:uid(),number:nextNumber('RE',invoices),bookingId,buyer,
      description:document.getElementById('invoiceDescription').value.trim()||'Raum-/Zimmervermietung',
      net,vatRate,vat,gross,issueDate:document.getElementById('invoiceIssue').value,dueDate:document.getElementById('invoiceDue').value,
      buyerStreet:document.getElementById('invoiceBuyerStreet').value.trim(),buyerZip:document.getElementById('invoiceBuyerZip').value.trim(),buyerCity:document.getElementById('invoiceBuyerCity').value.trim(),buyerEndpoint:document.getElementById('invoiceBuyerEndpoint').value.trim(),buyerRef:document.getElementById('invoiceBuyerRef').value.trim(),
      sellerName:settings.org||'RAUMWERK',sellerStreet:billing.street||'',sellerZip:billing.zip||'',sellerCity:billing.city||'',sellerAddressFallback:settings.address||'',sellerEmail:settings.email||'',sellerPhone:settings.phone||'',sellerVatId:billing.vatId||'',sellerTaxNo:billing.taxNo||'',sellerIban:billing.iban||'',sellerBic:billing.bic||'',
      serviceFrom:b.from,serviceTo:b.to,serviceFromTime:b.fromTime||'',serviceToTime:b.toTime||'',serviceRoom:roomName(b.roomId),
      status:'open',createdAt:new Date().toISOString()
    });
    persist();closeModal('invoiceModal');renderInvoices();toast('Rechnung erstellt');
  };

  function sellerData(i){
    return {
      name:i.sellerName||settings.org||'RAUMWERK',street:i.sellerStreet||billing.street||'',zip:i.sellerZip||billing.zip||'',city:i.sellerCity||billing.city||'',fallback:i.sellerAddressFallback||settings.address||'',
      email:i.sellerEmail||settings.email||'',phone:i.sellerPhone||settings.phone||'',vatId:i.sellerVatId||billing.vatId||'',taxNo:i.sellerTaxNo||billing.taxNo||'',iban:i.sellerIban||billing.iban||'',bic:i.sellerBic||billing.bic||''
    };
  }

  function htmlLines(lines){return lines.filter(Boolean).map(v=>esc(v)).join('<br>')}

  printInvoice=function(id){
    const i=invoices.find(x=>x.id===id);if(!i)return;
    const b=bookings.find(x=>x.id===i.bookingId),seller=sellerData(i),period=invoicePeriodTextRaw(i,b);
    const structuredAddress=htmlLines([seller.street,[seller.zip,seller.city].filter(Boolean).join(' ')]);
    const fallbackAddress=!structuredAddress&&seller.fallback?esc(seller.fallback).replace(/\n/g,'<br>'):'';
    const contact=[seller.email,seller.phone].filter(Boolean).map(esc).join(' · ');
    const tax=[seller.taxNo?`Steuernummer: ${esc(seller.taxNo)}`:'',seller.vatId?`USt-IdNr.: ${esc(seller.vatId)}`:''].filter(Boolean).join(' · ');
    const bank=[seller.iban?`IBAN ${esc(seller.iban)}`:'',seller.bic?`BIC ${esc(seller.bic)}`:''].filter(Boolean).join(' · ');
    openPrintWindow(`Rechnung ${i.number}`,`<h1>${esc(seller.name)}</h1><p>${structuredAddress||fallbackAddress}${contact?`<br>${contact}`:''}${tax?`<br>${tax}`:''}</p><h2>Rechnung ${esc(i.number)}</h2><p><b>Rechnungsdatum:</b> ${fmtDate(i.issueDate)}<br><b>Leistungszeitraum:</b> ${esc(period)}<br><b>Fällig:</b> ${fmtDate(i.dueDate)}</p><div class="box"><p><b>Empfänger:</b> ${esc(i.buyer)}<br>${esc(i.buyerStreet||'')}<br>${esc(i.buyerZip||'')} ${esc(i.buyerCity||'')}</p></div><table><tr><th>Leistung</th><th>Netto</th><th>USt.</th><th>Brutto</th></tr><tr><td>${esc(i.description)}${i.serviceRoom||b?`<div style="font-size:12px;color:#667085">${esc(i.serviceRoom||roomName(b.roomId))} · ${esc(period)}</div>`:''}</td><td>${money(i.net)}</td><td>${i.vatRate}% · ${money(i.vat)}</td><td><b>${money(i.gross)}</b></td></tr></table><p><b>Zahlbar bis ${fmtDate(i.dueDate)}</b>${bank?` · ${bank}`:''}.</p>`);
  };

  function clarifyBuyerReference(){
    const input=document.getElementById('invoiceBuyerRef');if(!input)return;
    input.placeholder='Nur bei XRechnung, z. B. Leitweg-ID des Auftraggebers';
    const label=input.closest('.field')?.querySelector('label');
    if(label)label.textContent='Leitweg-ID / Buyer Reference (nur XRechnung)';
  }

  ensureTaskHistoryPanel();renderTaskHistory();clarifyBuyerReference();
})();
