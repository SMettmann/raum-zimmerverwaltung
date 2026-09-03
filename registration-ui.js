(function(){
  function loginMarkup(){
    return `<div class="cloud-logo">RAUMSUITE<span>Raum- & Zimmerverwaltung</span></div>
      <h2>Anmelden</h2>
      <p>Einloggen und mit dem eigenen Datenbestand weiterarbeiten.</p>
      <div class="cloud-error" id="cloudAuthError"></div>
      <form onsubmit="cloudLogin(event)">
        <div class="cloud-field"><label>E-Mail</label><input id="cloudEmail" type="email" autocomplete="username" required></div>
        <div class="cloud-field"><label>Passwort</label><input id="cloudPassword" type="password" autocomplete="current-password" required></div>
        <button class="cloud-submit">Anmelden</button>
      </form>
      <button type="button" class="cloud-submit" style="margin-top:10px;background:#fff;color:#335cff;border:1px solid #dbe1ea" onclick="showCloudRegister()">Neu registrieren</button>`;
  }

  window.showCloudLogin=function(){
    const gate=document.getElementById('cloudGate');
    if(!gate)return;
    gate.classList.remove('hidden');
    const box=document.getElementById('cloudGateBox');
    if(box)box.innerHTML=loginMarkup();
  };

  window.showCloudRegister=function(){
    const gate=document.getElementById('cloudGate');
    if(!gate)return;
    gate.classList.remove('hidden');
    const box=document.getElementById('cloudGateBox');
    if(!box)return;
    box.innerHTML=`<div class="cloud-logo">RAUMSUITE<span>Neue Einrichtung anlegen</span></div>
      <h2>Registrieren</h2>
      <p>Du erhältst einen eigenen, leeren Datenbestand. Räume, Standorte und Buchungen legst du anschließend selbst an.</p>
      <div class="cloud-error" id="cloudAuthError"></div>
      <form onsubmit="cloudRegister(event)">
        <div class="cloud-field"><label>Name der Einrichtung</label><input id="registerOrg" required></div>
        <div class="cloud-field"><label>Dein Name</label><input id="registerName" required></div>
        <div class="cloud-field"><label>E-Mail</label><input id="registerEmail" type="email" autocomplete="username" required></div>
        <div class="cloud-field"><label>Passwort (mind. 10 Zeichen)</label><input id="registerPassword" type="password" minlength="10" autocomplete="new-password" required></div>
        <div class="cloud-field"><label>Passwort wiederholen</label><input id="registerPassword2" type="password" minlength="10" autocomplete="new-password" required></div>
        <button class="cloud-submit">Konto erstellen</button>
      </form>
      <button type="button" class="cloud-submit" style="margin-top:10px;background:#fff;color:#335cff;border:1px solid #dbe1ea" onclick="showCloudLogin()">Zurück zur Anmeldung</button>`;
  };

  window.cloudRegister=async function(event){
    event.preventDefault();
    cloudAuthError('');
    const password=document.getElementById('registerPassword').value;
    const password2=document.getElementById('registerPassword2').value;
    if(password!==password2)return cloudAuthError('Die beiden Passwörter stimmen nicht überein.');
    const payload={
      organization:document.getElementById('registerOrg').value,
      name:document.getElementById('registerName').value,
      email:document.getElementById('registerEmail').value,
      password
    };
    const button=event.submitter;
    if(button){button.disabled=true;button.textContent='Konto wird erstellt …';}
    try{
      const res=await fetch('/api/register',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
      const data=await res.json();
      if(!res.ok)return cloudAuthError(data.error||'Registrierung fehlgeschlagen.');
      cloud.user=data.user;
      cloud.organization=data.organization;
      await loadCloudState();
    }catch{
      cloudAuthError('Registrierung konnte nicht abgeschlossen werden.');
    }finally{
      if(button){button.disabled=false;button.textContent='Konto erstellen';}
    }
  };
})();