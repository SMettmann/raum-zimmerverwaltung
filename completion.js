/* RAUMWERK Abschluss der Pflichtanforderungen: echte Vermietungszeiträume + konfigurierbare Online-Buchung */
(function(){
  settings.rentalPeriods=Array.isArray(settings.rentalPeriods)?settings.rentalPeriods:[];
  settings.onlineBookingMode=settings.onlineBookingMode==='direct'?'direct':'request';

  pageMeta.availability=['Vermietung & Sperrzeiten','Freigabezeiträume und Sperren zentral steuern'];
  pageMeta.online=['Online-Buchung','Wahlweise Buchungsanfrage oder direkte verbindliche Buchung'];

  function rentalPeriods(){return Array.isArray(settings.rentalPeriods)?settings.rentalPeriods:[]}
  function rentalPeriodAllows(roomId,from,to){
    const scoped=rentalPeriods().filter(p=>p.roomId==='*'||p.roomId===roomId);
    return !scoped.length||scoped.some(p=>p.from<=from&&p.to>=to);
  }
  window.rentalPeriodAllows=rentalPeriodAllows;

  const completionBookingConflict=bookingConflict;
  bookingConflict=function(roomId,from,to,ignoreId=''){
    return completionBookingConflict(roomId,from,to,ignoreId)||!rentalPeriodAllows(roomId,from,to);
  };

  saveSettings=function(){
    settings={...settings,
      org:document.getElementById('settingOrg').value.trim(),
      email:document.getElementById('settingEmail').value.trim(),
      phone:document.getElementById('settingPhone').value.trim(),
      address:document.getElementById('settingAddress').value.trim()
    };
    persist();toast('Einstellungen gespeichert');
  };

  function setupAvailabilityUi(){
    const page=document.getElementById('page-availability');
    if(!page||document.getElementById('rentalPeriodList'))return;
    page.innerHTML=`
      <div class="toolbar"><div><b>Vermietungszeiträume</b><div class="muted">Optional festlegen, wann Räume grundsätzlich vermietet werden dürfen. Ohne Eintrag bleibt ein Raum ganzjährig vermietbar.</div></div><button class="btn primary" onclick="openRentalPeriodModal()">+ Vermietungszeitraum</button></div>
      <div class="panel"><div class="panel-head"><h2>Freigegebene Zeiträume</h2><span class="muted">Außerhalb hinterlegter Zeiträume werden neue Buchungen automatisch verhindert.</span></div><div id="rentalPeriodList"></div></div>
      <div class="toolbar" style="margin-top:22px"><div><b>Sperrzeiten</b><div class="muted">Für Wartung, interne Nutzung, Schließzeiten oder andere Ausnahmen.</div></div><button class="btn" onclick="openBlockModal()">+ Zeitraum sperren</button></div>
      <div class="panel"><div id="blockList"></div></div>`;
    if(!document.getElementById('rentalPeriodModal'))document.body.insertAdjacentHTML('beforeend',`
      <div class="modal" id="rentalPeriodModal"><div class="modal-box"><div class="modal-head"><h2>Vermietungszeitraum freigeben</h2><button class="icon-btn" onclick="closeModal('rentalPeriodModal')">✕</button></div>
      <div class="field"><label>Raum / Zimmer</label><select id="rentalPeriodRoom"></select></div>
      <div class="req-form-grid"><div class="field"><label>Von</label><input id="rentalPeriodFrom" type="date"></div><div class="field"><label>Bis</label><input id="rentalPeriodTo" type="date"></div></div>
      <div class="field"><label>Bezeichnung</label><input id="rentalPeriodLabel" placeholder="z. B. Herbstsaison, Seminarbetrieb 2026"></div>
      <div class="field"><label>Notiz</label><input id="rentalPeriodNote" placeholder="Optional"></div>
      <div class="notice">Sobald für einen Raum mindestens ein Vermietungszeitraum hinterlegt ist, sind neue Buchungen nur innerhalb dieser Freigaben möglich. Sperrzeiten gelten weiterhin zusätzlich.</div>
      <div class="modal-actions"><button class="btn" onclick="closeModal('rentalPeriodModal')">Abbrechen</button><button class="btn primary" onclick="saveRentalPeriod()">Freigeben</button></div></div></div>`);
  }

  window.openRentalPeriodModal=function(){
    setupAvailabilityUi();
    const select=document.getElementById('rentalPeriodRoom');
    select.innerHTML='<option value="*">Alle Räume & Zimmer</option>'+rooms.map(r=>`<option value="${esc(r.id)}">${esc(r.name)}</option>`).join('');
    document.getElementById('rentalPeriodFrom').value=todayIso();
    document.getElementById('rentalPeriodTo').value=todayIso();
    document.getElementById('rentalPeriodLabel').value='';
    document.getElementById('rentalPeriodNote').value='';
    showModal('rentalPeriodModal');
  };

  window.saveRentalPeriod=function(){
    const roomId=document.getElementById('rentalPeriodRoom').value;
    const from=document.getElementById('rentalPeriodFrom').value;
    const to=document.getElementById('rentalPeriodTo').value;
    if(!roomId||!from||!to)return alert('Bitte Raum und Zeitraum auswählen.');
    if(to<from)return alert('Das Bis-Datum darf nicht vor dem Von-Datum liegen.');
    settings.rentalPeriods=[...rentalPeriods(),{id:uid(),roomId,from,to,label:document.getElementById('rentalPeriodLabel').value.trim(),note:document.getElementById('rentalPeriodNote').value.trim()}];
    persist();closeModal('rentalPeriodModal');renderAvailability();toast('Vermietungszeitraum freigegeben');
  };

  window.deleteRentalPeriod=function(id){
    settings.rentalPeriods=rentalPeriods().filter(p=>p.id!==id);persist();renderAvailability();toast('Vermietungszeitraum entfernt');
  };

  function renderRentalPeriods(){
    const wrap=document.getElementById('rentalPeriodList');if(!wrap)return;
    const list=[...rentalPeriods()].sort((a,b)=>a.from.localeCompare(b.from));
    wrap.innerHTML=list.length?list.map(p=>`<div class="req-row"><div><b>${p.roomId==='*'?'Alle Räume & Zimmer':esc(roomName(p.roomId))}</b><div class="row-meta">${fmtDate(p.from)} – ${fmtDate(p.to)}${p.label?' · '+esc(p.label):''}${p.note?' · '+esc(p.note):''}</div></div><div class="req-actions"><span class="badge green">Vermietbar</span><button class="btn small danger" onclick="deleteRentalPeriod('${p.id}')">Entfernen</button></div></div>`).join(''):'<div class="empty">Keine festen Vermietungszeiträume hinterlegt. Alle Räume sind ganzjährig vermietbar, sofern keine Buchung oder Sperre entgegensteht.</div>';
  }

  function renderBlocksOnly(){
    const w=document.getElementById('blockList');if(!w)return;
    const list=[...blocks].sort((a,b)=>a.from.localeCompare(b.from));
    w.innerHTML=list.length?list.map(b=>`<div class="req-row"><div><b>${esc(roomName(b.roomId))}</b><div class="row-meta">${fmtDate(b.from)} – ${fmtDate(b.to)} · ${esc(b.type)}${b.note?' · '+esc(b.note):''}</div></div><div class="req-actions"><span class="badge red">Nicht vermietbar</span><button class="btn small danger" onclick="deleteBlock('${b.id}')">Freigeben</button></div></div>`).join(''):'<div class="empty">Keine Sperrzeiten vorhanden.</div>';
  }

  renderAvailability=function(){setupAvailabilityUi();renderRentalPeriods();renderBlocksOnly()};

  function setupOnlineUi(){
    const page=document.getElementById('page-online');if(!page||document.getElementById('onlineBookingModePanel'))return;
    page.insertAdjacentHTML('afterbegin',`<div class="panel" id="onlineBookingModePanel" style="margin-bottom:18px"><div class="panel-head"><div><h2>Online-Buchungsmodus</h2><div class="muted">Die Einrichtung entscheidet selbst, wie externe Buchungen behandelt werden.</div></div><span class="badge green">Online-Buchung aktiv</span></div><div class="req-form-grid"><div class="field"><label>Modus</label><select id="onlineBookingMode"><option value="request">Buchungsanfrage – intern bestätigen</option><option value="direct">Direkte Buchung – sofort verbindlich</option></select></div><div class="field"><label>&nbsp;</label><button class="btn primary" onclick="saveOnlineBookingMode()">Modus speichern</button></div></div><div class="notice" id="onlineBookingModeNote"></div></div>`);
  }

  window.saveOnlineBookingMode=function(){
    settings.onlineBookingMode=document.getElementById('onlineBookingMode').value==='direct'?'direct':'request';persist();renderOnlineRequirementConfig();toast('Online-Buchungsmodus gespeichert');
  };

  window.renderOnlineRequirementConfig=function(){
    setupOnlineUi();
    const mode=settings.onlineBookingMode==='direct'?'direct':'request';
    const select=document.getElementById('onlineBookingMode');if(select)select.value=mode;
    const note=document.getElementById('onlineBookingModeNote');if(note)note.textContent=mode==='direct'?'Freie Räume werden nach erneuter Serverprüfung sofort verbindlich gebucht.':'Externe Gäste senden eine Anfrage. Erst die interne Bestätigung erzeugt die verbindliche Buchung.';
    const publicBox=document.querySelector('#page-online .req-public-box p');if(publicBox)publicBox.textContent=mode==='direct'?'Gäste prüfen die Verfügbarkeit und können einen freien Raum direkt verbindlich buchen.':'Gäste prüfen die Verfügbarkeit und senden anschließend eine Buchungsanfrage.';
  };

  const completionRenderOnlineRequests=renderOnlineRequests;
  renderOnlineRequests=function(){setupOnlineUi();completionRenderOnlineRequests();renderOnlineRequirementConfig()};

  // Produktionsschutz: vollständige Backups, keine gefährlichen lokalen Werkzeuge im gemeinsamen Cloudbetrieb.
  exportData=function(){
    const snapshot={version:2,exportedAt:new Date().toISOString(),...stateSnapshot()};
    downloadFile('raumwerk-sicherung-'+todayIso()+'.json',JSON.stringify(snapshot,null,2),'application/json');
    toast('Vollständige Datensicherung erstellt');
  };

  const localDemoData=loadDemoData;
  loadDemoData=function(){
    if(cloud.mode==='online')return alert('Demo-Daten sind im gemeinsamen Onlinebetrieb aus Sicherheitsgründen deaktiviert.');
    return localDemoData();
  };
  const localImportData=importData;
  importData=function(event){
    if(cloud.mode==='online'){
      if(event?.target)event.target.value='';
      return alert('Das Einlesen einer lokalen Sicherung ist im gemeinsamen Onlinebetrieb deaktiviert. So kann der zentrale Datenstand nicht versehentlich überschrieben werden.');
    }
    return localImportData(event);
  };
  const localResetAllData=resetAllData;
  resetAllData=function(){
    if(cloud.mode==='online')return alert('Ein Komplett-Reset ist im gemeinsamen Onlinebetrieb gesperrt.');
    return localResetAllData();
  };

  function applyProductionSafetyUi(){
    const panels=[...document.querySelectorAll('#page-settings .panel')];
    const panel=panels.find(p=>(p.querySelector('h2')?.textContent||'').includes('Daten'));
    if(!panel||cloud.mode!=='online'||panel.dataset.productionSafe==='1')return;
    panel.dataset.productionSafe='1';
    panel.innerHTML=`<h2 style="margin-bottom:12px">Daten & Sicherung</h2><p class="muted">RAUMWERK arbeitet hier mit dem gemeinsamen zentralen Datenstand. Demo-Daten, lokaler Import und Komplett-Reset sind im Onlinebetrieb bewusst deaktiviert.</p><div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:14px"><button class="btn" onclick="exportData()">Vollständige Datensicherung</button></div><div class="notice" style="margin-top:16px">Damit kann kein Benutzer versehentlich die gemeinsamen Produktivdaten durch Test- oder lokale Daten ersetzen.</div>`;
  }

  // Benutzerverwaltung ohne Browser-Prompts + sichtbares Änderungsprotokoll.
  function setupAdminTools(){
    if(!document.getElementById('cloudAdminToolsStyle')){
      const style=document.createElement('style');style.id='cloudAdminToolsStyle';style.textContent=`.cloud-admin-row{display:grid;grid-template-columns:minmax(180px,1fr) 170px 110px;gap:10px;align-items:center;padding:12px 0;border-top:1px solid var(--line)}.cloud-admin-row:first-child{border-top:0}.cloud-admin-row select{width:100%;padding:8px;border:1px solid var(--line);border-radius:9px;background:#fff}.audit-row{display:grid;grid-template-columns:150px minmax(180px,1fr) minmax(180px,1.3fr);gap:12px;padding:11px 0;border-top:1px solid var(--line);font-size:13px}.audit-row:first-child{border-top:0}.audit-time{color:#7b8698}.audit-action{font-weight:800}@media(max-width:760px){.cloud-admin-row,.audit-row{grid-template-columns:1fr}.cloud-admin-row{gap:7px}.audit-row{gap:4px}}`;document.head.appendChild(style);
    }
    if(!document.getElementById('cloudUserModal'))document.body.insertAdjacentHTML('beforeend',`<div class="modal" id="cloudUserModal"><div class="modal-box"><div class="modal-head"><h2>Benutzer anlegen</h2><button class="icon-btn" onclick="closeModal('cloudUserModal')">✕</button></div><div class="form-error" id="cloudUserModalError"></div><div class="field"><label>Name *</label><input id="cloudNewUserName"></div><div class="field"><label>E-Mail *</label><input id="cloudNewUserEmail" type="email"></div><div class="field"><label>Startpasswort *</label><input id="cloudNewUserPassword" type="password" minlength="10" placeholder="Mindestens 10 Zeichen"></div><div class="field"><label>Rolle</label><select id="cloudNewUserRole"><option value="staff">Mitarbeiter</option><option value="manager">Leitung</option><option value="cleaning">Reinigung</option><option value="viewer">Nur lesen</option><option value="admin">Administrator</option></select></div><div class="modal-actions"><button class="btn" onclick="closeModal('cloudUserModal')">Abbrechen</button><button class="btn primary" onclick="saveCloudUserModal()">Benutzer anlegen</button></div></div></div>`);
    const grid=document.querySelector('#page-settings .settings-grid');
    if(cloud.mode==='online'&&['admin','manager'].includes(cloud.user?.role)&&grid&&!document.getElementById('cloudAuditPanel')){
      grid.insertAdjacentHTML('beforeend',`<div class="panel" id="cloudAuditPanel"><div class="panel-head"><div><h2>Änderungsprotokoll</h2><div class="muted">Die letzten 100 sicherheitsrelevanten Vorgänge.</div></div><button class="btn small" onclick="loadAuditLog()">Aktualisieren</button></div><div id="cloudAuditList"><div class="empty">Protokoll wird geladen …</div></div></div>`);
    }
  }

  openCloudUserDialog=function(){
    if(cloud.user?.role!=='admin')return alert('Nur Administratoren dürfen Benutzer anlegen.');
    setupAdminTools();
    ['cloudNewUserName','cloudNewUserEmail','cloudNewUserPassword'].forEach(id=>document.getElementById(id).value='');
    document.getElementById('cloudNewUserRole').value='staff';
    hideFormError('cloudUserModalError');showModal('cloudUserModal');
  };

  window.saveCloudUserModal=async function(){
    hideFormError('cloudUserModalError');
    const payload={name:document.getElementById('cloudNewUserName').value.trim(),email:document.getElementById('cloudNewUserEmail').value.trim(),password:document.getElementById('cloudNewUserPassword').value,role:document.getElementById('cloudNewUserRole').value};
    if(!payload.name||!payload.email||payload.password.length<10)return showFormError('cloudUserModalError','Bitte Name, E-Mail und ein Passwort mit mindestens 10 Zeichen angeben.');
    const res=await fetch('/api/users',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});const data=await res.json();
    if(!res.ok)return showFormError('cloudUserModalError',data.error||'Benutzer konnte nicht angelegt werden.');
    closeModal('cloudUserModal');toast('Benutzer angelegt');await loadCloudUsers();await loadAuditLog();
  };

  loadCloudUsers=async function(){
    const res=await fetch('/api/users');if(!res.ok)return;const data=await res.json();const wrap=document.getElementById('cloudUserList');if(!wrap)return;
    const isAdmin=cloud.user?.role==='admin';
    wrap.innerHTML=(data.users||[]).map(u=>{
      const self=u.id===cloud.user?.id;
      const roleOptions=['admin','manager','staff','cleaning','viewer'].map(r=>`<option value="${r}" ${u.role===r?'selected':''}>${esc(roleLabel[r]||r)}</option>`).join('');
      return `<div class="cloud-admin-row"><div><b>${esc(u.name)}</b><div class="muted">${esc(u.email)}${self?' · Du':''}</div></div><div>${isAdmin?`<select ${self?'disabled':''} onchange="changeCloudUserRole('${esc(u.id)}',this.value)">${roleOptions}</select>`:`<span class="badge">${esc(roleLabel[u.role]||u.role)}</span>`}</div><div>${isAdmin?`<button class="btn small ${u.active?'danger':''}" ${self?'disabled':''} onclick="toggleCloudUserActive('${esc(u.id)}',${u.active?'false':'true'})">${u.active?'Deaktivieren':'Aktivieren'}</button>`:`<span class="badge ${u.active?'green':'red'}">${u.active?'Aktiv':'Inaktiv'}</span>`}</div></div>`;
    }).join('')||'<div class="empty">Keine Benutzer vorhanden.</div>';
  };

  window.changeCloudUserRole=async function(id,role){
    const res=await fetch('/api/users/'+encodeURIComponent(id),{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({role})});const data=await res.json();
    if(!res.ok){alert(data.error||'Rolle konnte nicht geändert werden.');return loadCloudUsers()}
    toast('Rolle geändert');await loadCloudUsers();await loadAuditLog();
  };
  window.toggleCloudUserActive=async function(id,active){
    const res=await fetch('/api/users/'+encodeURIComponent(id),{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({active})});const data=await res.json();
    if(!res.ok){alert(data.error||'Benutzerstatus konnte nicht geändert werden.');return loadCloudUsers()}
    toast(active?'Benutzer aktiviert':'Benutzer deaktiviert');await loadCloudUsers();await loadAuditLog();
  };

  const auditActionLabel={login_success:'Anmeldung',state_update:'Daten geändert',user_created:'Benutzer angelegt',user_updated:'Benutzer geändert',public_booking_direct:'Direkte Online-Buchung',public_booking_request:'Online-Buchungsanfrage'};
  const auditFieldLabel={rooms:'Räume & Zimmer',bookings:'Buchungen',guests:'Gäste & Kunden',tasks:'Aufgaben',settings:'Einstellungen',cleaningPlans:'Reinigung',shifts:'Einsatzplanung',blocks:'Sperrzeiten',contracts:'Verträge',invoices:'Rechnungen',bookingRequests:'Online-Anfragen',billing:'Rechnungsdaten'};
  window.loadAuditLog=async function(){
    setupAdminTools();const wrap=document.getElementById('cloudAuditList');if(!wrap||!['admin','manager'].includes(cloud.user?.role))return;
    const res=await fetch('/api/audit');const data=await res.json();if(!res.ok){wrap.innerHTML=`<div class="empty">${esc(data.error||'Protokoll konnte nicht geladen werden.')}</div>`;return}
    wrap.innerHTML=(data.entries||[]).map(entry=>{
      const date=new Date(entry.created_at);const time=Number.isNaN(date.getTime())?entry.created_at:new Intl.DateTimeFormat('de-DE',{dateStyle:'short',timeStyle:'short'}).format(date);
      const fields=Array.isArray(entry.details?.fields)?entry.details.fields.map(f=>auditFieldLabel[f]||f).join(', '):'';
      const detail=fields||((entry.action==='public_booking_direct'||entry.action==='public_booking_request')&&entry.details?.from?`${fmtDate(entry.details.from)} – ${fmtDate(entry.details.to)}`:'');
      return `<div class="audit-row"><div class="audit-time">${esc(time)}</div><div><div class="audit-action">${esc(auditActionLabel[entry.action]||entry.action)}</div><div class="muted">${esc(entry.user_name||'Öffentliche Buchungsseite')}</div></div><div class="muted">${esc(detail||'–')}</div></div>`;
    }).join('')||'<div class="empty">Noch keine protokollierten Vorgänge.</div>';
  };

  const safetyRenderPage=renderPage;
  renderPage=function(page){
    safetyRenderPage(page);
    if(page==='settings'){
      applyProductionSafetyUi();setupAdminTools();
      if(cloud.mode==='online'&&['admin','manager'].includes(cloud.user?.role)){loadCloudUsers();loadAuditLog()}
    }
  };
  const safetyLoadCloudState=loadCloudState;
  loadCloudState=async function(){
    const result=await safetyLoadCloudState();applyProductionSafetyUi();setupAdminTools();
    if(cloud.mode==='online'&&['admin','manager'].includes(cloud.user?.role))loadAuditLog();
    return result;
  };

  setupAvailabilityUi();
  setupOnlineUi();
  renderAvailability();
  renderOnlineRequirementConfig();
  applyProductionSafetyUi();
  setupAdminTools();
})();
