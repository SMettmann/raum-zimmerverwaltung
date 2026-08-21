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

  setupAvailabilityUi();
  setupOnlineUi();
  renderAvailability();
  renderOnlineRequirementConfig();
})();
