/* RAUMWERK Passwortverwaltung */
(function(){
  let passwordUsersById={};
  function setupPasswordUi(){
    if(!document.getElementById('passwordManagementStyle')){
      const style=document.createElement('style');style.id='passwordManagementStyle';style.textContent=`.cloud-admin-row.password-enabled{grid-template-columns:minmax(180px,1fr) 160px 110px 135px 90px}.password-note{font-size:12px;color:#7b8698;margin-top:7px}@media(max-width:760px){.cloud-admin-row.password-enabled{grid-template-columns:1fr}}`;document.head.appendChild(style);
    }
    if(!document.getElementById('changePasswordModal'))document.body.insertAdjacentHTML('beforeend',`
      <div class="modal" id="changePasswordModal"><div class="modal-box"><div class="modal-head"><h2>Passwort ändern</h2><button class="icon-btn" onclick="closeModal('changePasswordModal')">✕</button></div><div class="form-error" id="changePasswordError"></div><div class="field"><label>Aktuelles Passwort *</label><input id="currentPassword" type="password" autocomplete="current-password"></div><div class="field"><label>Neues Passwort *</label><input id="newPassword" type="password" minlength="10" autocomplete="new-password" placeholder="Mindestens 10 Zeichen"></div><div class="field"><label>Neues Passwort wiederholen *</label><input id="repeatPassword" type="password" minlength="10" autocomplete="new-password"></div><div class="password-note">Nach der Änderung werden andere offene Sitzungen dieses Zugangs automatisch beendet.</div><div class="modal-actions"><button class="btn" onclick="closeModal('changePasswordModal')">Abbrechen</button><button class="btn primary" onclick="saveOwnPassword()">Passwort ändern</button></div></div></div>`);
    if(!document.getElementById('adminPasswordModal'))document.body.insertAdjacentHTML('beforeend',`
      <div class="modal" id="adminPasswordModal"><div class="modal-box"><div class="modal-head"><h2>Passwort neu setzen</h2><button class="icon-btn" onclick="closeModal('adminPasswordModal')">✕</button></div><div class="form-error" id="adminPasswordError"></div><input type="hidden" id="adminPasswordUserId"><p class="muted" id="adminPasswordUserName"></p><div class="field"><label>Neues Startpasswort *</label><input id="adminNewPassword" type="password" minlength="10" autocomplete="new-password" placeholder="Mindestens 10 Zeichen"></div><div class="field"><label>Passwort wiederholen *</label><input id="adminRepeatPassword" type="password" minlength="10" autocomplete="new-password"></div><div class="notice">Nach dem Speichern werden alle bisherigen Sitzungen dieses Benutzers beendet. Das neue Passwort muss anschließend bei der Anmeldung verwendet werden.</div><div class="modal-actions"><button class="btn" onclick="closeModal('adminPasswordModal')">Abbrechen</button><button class="btn primary" onclick="saveAdminPassword()">Neues Passwort setzen</button></div></div></div>`);
    const grid=document.querySelector('#page-settings .settings-grid');
    if(cloud.mode==='online'&&cloud.user&&grid&&!document.getElementById('ownPasswordPanel'))grid.insertAdjacentHTML('beforeend',`<div class="panel" id="ownPasswordPanel"><div class="panel-head"><div><h2>Passwort & Sicherheit</h2><div class="muted">Passwort des eigenen Zugangs verwalten.</div></div></div><p>Angemeldet als <strong>${esc(cloud.user.name)}</strong><br><span class="muted">${esc(cloud.user.email||'')}</span></p><button class="btn" onclick="openOwnPasswordDialog()">Passwort ändern</button></div>`);
  }

  window.openOwnPasswordDialog=function(){setupPasswordUi();hideFormError('changePasswordError');['currentPassword','newPassword','repeatPassword'].forEach(id=>document.getElementById(id).value='');showModal('changePasswordModal')};
  window.saveOwnPassword=async function(){
    hideFormError('changePasswordError');const currentPassword=document.getElementById('currentPassword').value,newPassword=document.getElementById('newPassword').value,repeat=document.getElementById('repeatPassword').value;
    if(!currentPassword||newPassword.length<10)return showFormError('changePasswordError','Bitte aktuelles Passwort und ein neues Passwort mit mindestens 10 Zeichen angeben.');
    if(newPassword!==repeat)return showFormError('changePasswordError','Die beiden neuen Passwörter stimmen nicht überein.');
    const res=await fetch('/api/password/change',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({currentPassword,newPassword})});const data=await res.json();
    if(!res.ok)return showFormError('changePasswordError',data.error||'Passwort konnte nicht geändert werden.');
    closeModal('changePasswordModal');toast('Passwort geändert');if(typeof loadAuditLog==='function'&&['admin','manager'].includes(cloud.user?.role))loadAuditLog();
  };

  window.openAdminPasswordDialog=function(id){
    if(cloud.user?.role!=='admin')return alert('Nur Administratoren dürfen Passwörter neu setzen.');
    if(id===cloud.user?.id)return openOwnPasswordDialog();
    const user=passwordUsersById[id];setupPasswordUi();hideFormError('adminPasswordError');document.getElementById('adminPasswordUserId').value=id;document.getElementById('adminPasswordUserName').textContent=`Neues Passwort für ${user?.name||'Benutzer'}`;document.getElementById('adminNewPassword').value='';document.getElementById('adminRepeatPassword').value='';showModal('adminPasswordModal');
  };
  window.saveAdminPassword=async function(){
    hideFormError('adminPasswordError');const id=document.getElementById('adminPasswordUserId').value,newPassword=document.getElementById('adminNewPassword').value,repeat=document.getElementById('adminRepeatPassword').value;
    if(!id||newPassword.length<10)return showFormError('adminPasswordError','Bitte ein Passwort mit mindestens 10 Zeichen angeben.');
    if(newPassword!==repeat)return showFormError('adminPasswordError','Die beiden Passwörter stimmen nicht überein.');
    const res=await fetch('/api/users/'+encodeURIComponent(id)+'/password',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({newPassword})});const data=await res.json();
    if(!res.ok)return showFormError('adminPasswordError',data.error||'Passwort konnte nicht neu gesetzt werden.');
    closeModal('adminPasswordModal');toast('Neues Passwort gesetzt');if(typeof loadCloudUsers==='function')await loadCloudUsers();if(typeof loadAuditLog==='function')await loadAuditLog();
  };

  window.deleteCloudUser=async function(id){
    if(cloud.user?.role!=='admin')return alert('Nur Administratoren dürfen Benutzer löschen.');
    if(id===cloud.user?.id)return alert('Den eigenen Administratorzugang kannst du nicht löschen.');
    const user=passwordUsersById[id];
    if(!user)return alert('Benutzer nicht gefunden.');
    if(!confirm(`Benutzer „${user.name}“ wirklich endgültig löschen?\n\nDer Zugang und alle aktiven Sitzungen werden gelöscht. Dieser Vorgang kann nicht rückgängig gemacht werden.`))return;
    const res=await fetch('/api/users/'+encodeURIComponent(id),{method:'DELETE',headers:{Accept:'application/json'}});let data={};try{data=await res.json()}catch{}
    if(!res.ok)return alert(data.error||'Benutzer konnte nicht gelöscht werden.');
    toast('Benutzer gelöscht');if(typeof loadCloudUsers==='function')await loadCloudUsers();if(typeof loadAuditLog==='function')await loadAuditLog();
  };

  loadCloudUsers=async function(){
    const res=await fetch('/api/users');if(!res.ok)return;const data=await res.json();const wrap=document.getElementById('cloudUserList');if(!wrap)return;const users=data.users||[],isAdmin=cloud.user?.role==='admin';passwordUsersById=Object.fromEntries(users.map(u=>[u.id,u]));
    wrap.innerHTML=users.map(u=>{const self=u.id===cloud.user?.id;const roleOptions=['admin','manager','staff','cleaning','viewer'].map(r=>`<option value="${r}" ${u.role===r?'selected':''}>${esc(roleLabel[r]||r)}</option>`).join('');return `<div class="cloud-admin-row password-enabled"><div><b>${esc(u.name)}</b><div class="muted">${esc(u.email)}${self?' · Du':''}</div></div><div>${isAdmin?`<select ${self?'disabled':''} onchange="changeCloudUserRole('${esc(u.id)}',this.value)">${roleOptions}</select>`:`<span class="badge">${esc(roleLabel[u.role]||u.role)}</span>`}</div><div>${isAdmin?`<button class="btn small ${u.active?'danger':''}" ${self?'disabled':''} onclick="toggleCloudUserActive('${esc(u.id)}',${u.active?'false':'true'})">${u.active?'Deaktivieren':'Aktivieren'}</button>`:`<span class="badge ${u.active?'green':'red'}">${u.active?'Aktiv':'Inaktiv'}</span>`}</div><div>${isAdmin?`<button class="btn small" onclick="openAdminPasswordDialog('${esc(u.id)}')">${self?'Eigenes ändern':'Passwort setzen'}</button>`:''}</div><div>${isAdmin?`<button class="btn small danger" ${self?'disabled':''} onclick="deleteCloudUser('${esc(u.id)}')">Löschen</button>`:''}</div></div>`}).join('')||'<div class="empty">Keine Benutzer vorhanden.</div>';
  };

  const previousRenderPage=renderPage;renderPage=function(page){previousRenderPage(page);if(page==='settings'){setupPasswordUi();if(cloud.mode==='online'&&['admin','manager'].includes(cloud.user?.role))loadCloudUsers()}};
  const previousLoadCloudState=loadCloudState;loadCloudState=async function(){const result=await previousLoadCloudState();setupPasswordUi();if(cloud.mode==='online'&&['admin','manager'].includes(cloud.user?.role))loadCloudUsers();return result};
  setupPasswordUi();
})();
