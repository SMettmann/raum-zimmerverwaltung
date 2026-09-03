(function(){
  if(window.__raumsuiteOwnerAccountProtectionLoaded)return;
  window.__raumsuiteOwnerAccountProtectionLoaded=true;

  function ensureStyle(){
    if(document.getElementById('ownerProtectionStyle'))return;
    const style=document.createElement('style');
    style.id='ownerProtectionStyle';
    style.textContent=`.owner-protected-label{display:inline-flex;align-items:center;gap:5px;margin-left:8px;padding:3px 8px;border-radius:999px;background:#eef3ff;color:#3158d7;font-size:11px;font-weight:800}.owner-protected-action{display:inline-flex;align-items:center;justify-content:center;min-height:34px;padding:6px 10px;border-radius:9px;background:#f3f5f8;color:#6b7484;font-size:12px;font-weight:800;white-space:nowrap}`;
    document.head.appendChild(style);
  }

  async function applyOwnerProtection(){
    const wrap=document.getElementById('cloudUserList');
    if(!wrap)return;
    let data;
    try{
      const res=await fetch('/api/users',{headers:{Accept:'application/json'},cache:'no-store'});
      if(!res.ok)return;
      data=await res.json();
    }catch{return}
    const users=Array.isArray(data?.users)?data.users:[];
    const rows=[...wrap.querySelectorAll('.cloud-admin-row')];
    users.forEach((user,index)=>{
      if(!user?.protected)return;
      const row=rows[index];if(!row)return;
      row.dataset.ownerProtected='true';
      const name=row.querySelector('b');
      if(name&&!name.parentElement.querySelector('.owner-protected-label'))name.insertAdjacentHTML('afterend','<span class="owner-protected-label">🔒 Hauptadministrator</span>');
      const select=row.querySelector('select');if(select)select.disabled=true;
      [...row.querySelectorAll('button')].forEach(button=>{
        const label=button.textContent.trim();
        if(label==='Deaktivieren'||label==='Aktivieren'){
          const span=document.createElement('span');span.className='owner-protected-action';span.textContent='🔒 Geschützt';button.replaceWith(span);return;
        }
        if(label==='Löschen'){
          const span=document.createElement('span');span.className='owner-protected-action';span.textContent='Nicht löschbar';button.replaceWith(span);return;
        }
        if(label==='Passwort setzen'){
          const span=document.createElement('span');span.className='owner-protected-action';span.textContent='Nur Besitzer';button.replaceWith(span);
        }
      });
    });
  }

  ensureStyle();
  const original=window.loadCloudUsers;
  if(typeof original==='function'){
    window.loadCloudUsers=async function(...args){
      const result=await original.apply(this,args);
      await applyOwnerProtection();
      return result;
    };
  }

  const observer=new MutationObserver(()=>{
    if(document.getElementById('cloudUserList'))setTimeout(applyOwnerProtection,0);
  });
  observer.observe(document.documentElement,{subtree:true,childList:true});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(applyOwnerProtection,0),{once:true});
  else setTimeout(applyOwnerProtection,0);
})();
