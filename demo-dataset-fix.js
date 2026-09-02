(function(){
  if(window.__raumsuitePermanentDatasetFix)return;
  window.__raumsuitePermanentDatasetFix=true;

  const VERSION=3;
  const NORTH='Standort Nord';
  const SOUTH='Standort Süd';
  const DEMO_NAMES=new Set([
    'Bildungsforum Beispiel e.V.','Anna Berger','Sozialwerk Musterstadt',
    'Jugendgruppe Beispiel','Projektteam Nord','Jugendbildungswerk Beispiel'
  ]);

  const clone=v=>JSON.parse(JSON.stringify(v));
  const key=(name,location)=>`${String(location||'').trim().toLowerCase()}|${String(name||'').trim().toLowerCase()}`;

  function isDemoDataset(){
    if(settings?.org==='Tagungs- & Gästehaus Beispiel')return true;
    const hits=(bookings||[]).filter(b=>DEMO_NAMES.has(String(b.guest||'').trim())).length;
    return hits>=3;
  }

  function makeRoom(id,name,type,capacity,note,location,cleaning='done'){
    return {id,name,type,capacity,note,cleaning,location};
  }

  function exactRooms(){
    const out=[];
    // Standort Nord: 32 Gästezimmer / 52 Betten
    for(let i=1;i<=32;i++){
      const num=String(i).padStart(3,'0');
      const cap=i<=12?1:2;
      out.push(makeRoom(`nz${num}`,`Gästezimmer ${num}`,cap===1?'Einzelzimmer':'Doppelzimmer',cap,`${cap} ${cap===1?'Bett':'Betten'} · Dusche/WC`,NORTH,i===2?'open':i===3?'doing':'done'));
    }
    [
      ['nt1','Forum',52,'Beamer · WLAN · flexible Bestuhlung'],
      ['nt2','Garten',36,'Display · Flipchart · WLAN'],
      ['nt3','Atrium',24,'Beamer · Tonanlage'],
      ['nt4','Bibliothek',18,'Whiteboard · Gruppenarbeit'],
      ['nt5','Studio',12,'Flexible Bestuhlung · WLAN']
    ].forEach(([id,name,cap,note])=>out.push(makeRoom(id,`Tagungsraum ${name}`,'Seminarraum',cap,note,NORTH)));

    // Standort Süd: 16 Gästezimmer / 60 Betten
    for(let i=1;i<=16;i++){
      const num=String(i).padStart(3,'0');
      const cap=i<=4?3:4;
      out.push(makeRoom(`sz${num}`,`Gästezimmer ${num}`,'Mehrbettzimmer',cap,`${cap} Betten · Dusche/WC`,SOUTH,i===3?'doing':'done'));
    }
    [
      ['st1','Panorama',60,'Beamer · WLAN · flexible Bestuhlung'],
      ['st2','Atelier',42,'Display · Flipchart · WLAN'],
      ['st3','Campus',30,'Beamer · Tonanlage'],
      ['st4','Werkstatt',20,'Whiteboard · Gruppenarbeit'],
      ['st5','Lounge',14,'Flexible Bestuhlung · WLAN']
    ].forEach(([id,name,cap,note])=>out.push(makeRoom(id,`Tagungsraum ${name}`,'Seminarraum',cap,note,SOUTH)));
    return out;
  }

  function apply(){
    if(typeof rooms==='undefined'||typeof bookings==='undefined'||typeof settings==='undefined')return false;
    if(!isDemoDataset())return true;
    if(Number(settings._permanentVideoInventoryVersion||0)>=VERSION && (rooms||[]).length===58)return true;

    const oldRooms=clone(rooms||[]);
    const desired=exactRooms();
    const oldById=new Map(oldRooms.map(r=>[r.id,r]));
    const desiredById=new Map(desired.map(r=>[r.id,r]));
    const desiredByKey=new Map(desired.map(r=>[key(r.name,r.location),r]));
    const desiredByName=new Map();
    for(const r of desired){
      const n=String(r.name||'').toLowerCase();
      if(!desiredByName.has(n))desiredByName.set(n,[]);
      desiredByName.get(n).push(r);
    }

    // Vorhandene Reinigungszustände übernehmen, wenn Name + Standort gleich sind.
    const oldByKey=new Map(oldRooms.map(r=>[key(r.name,r.location),r]));
    rooms=desired.map(r=>{
      const old=oldByKey.get(key(r.name,r.location));
      return old?{...r,cleaning:old.cleaning||r.cleaning}:r;
    });

    function mapRoomId(id,storedName='',storedLocation=''){
      if(desiredById.has(id))return id;
      const old=oldById.get(id);
      if(old){
        const same=desiredByKey.get(key(old.name,old.location));
        if(same)return same.id;
        const candidates=desiredByName.get(String(old.name||'').toLowerCase())||[];
        if(candidates.length===1)return candidates[0].id;
      }
      if(storedName){
        const exact=desiredByKey.get(key(storedName,storedLocation));
        if(exact)return exact.id;
        const candidates=desiredByName.get(String(storedName).toLowerCase())||[];
        if(candidates.length===1)return candidates[0].id;
      }
      return id;
    }

    const fixedAssignments={
      b1:'nt1', // Bildungsforum -> Tagungsraum Forum, Nord
      b2:'nz001', // Anna Berger -> Gästezimmer 001, Nord
      b3:'nt2', // Sozialwerk -> Tagungsraum Garten, Nord
      b4:'st1', // Jugendgruppe Veranstaltung -> Panorama, Süd
      b5:'sz001', // Jugendgruppe Übernachtung -> Gästezimmer 001, Süd
      b6:'sz002', // Jugendgruppe Übernachtung -> Gästezimmer 002, Süd
      b7:'nz013', // Projektteam Nord Übernachtung -> Gästezimmer 013, Nord
      b8:'st3' // Jugendbildungswerk -> Tagungsraum Campus, Süd
    };
    const catering={
      b1:['Vollverpflegung',46,'Vegetarische Optionen berücksichtigen'],
      b3:['Halbpension',28,'Abendessen am Anreisetag'],
      b4:['Vollverpflegung',54,'Vegetarisch und Allergien nach Teilnehmerliste'],
      b8:['Selbstversorgung',24,'Nutzung der vorhandenen Selbstversorgerküche']
    };

    bookings=(bookings||[]).map(b=>{
      const next={...b};
      if(fixedAssignments[next.id])next.roomId=fixedAssignments[next.id];
      else next.roomId=mapRoomId(next.roomId,next.roomName,next.location);
      const c=catering[next.id];
      if(c){
        next.catering=c[0];next.cateringParticipants=c[1];next.cateringNote=c[2];
      }
      return next;
    });

    if(typeof tasks!=='undefined')tasks=(tasks||[]).map(x=>x.roomId?{...x,roomId:mapRoomId(x.roomId,x.roomName,x.location)}:x);
    if(typeof cleaningPlans!=='undefined')cleaningPlans=(cleaningPlans||[]).map(x=>x.roomId?{...x,roomId:mapRoomId(x.roomId,x.roomName,x.location)}:x);
    if(typeof shifts!=='undefined')shifts=(shifts||[]).map(x=>x.roomId?{...x,roomId:mapRoomId(x.roomId,x.roomName,x.location)}:x);
    if(typeof blocks!=='undefined')blocks=(blocks||[]).map(x=>x.roomId?{...x,roomId:mapRoomId(x.roomId,x.roomName,x.location)}:x);
    if(typeof bookingRequests!=='undefined')bookingRequests=(bookingRequests||[]).map(x=>{
      const mapped=mapRoomId(x.roomId,x.roomName,x.location);
      const r=rooms.find(room=>room.id===mapped);
      return {...x,roomId:mapped,roomName:r?.name||x.roomName||'',roomType:r?.type||x.roomType||'',location:r?.location||x.location||''};
    });

    settings={...settings,locations:[NORTH,SOUTH],_permanentVideoInventoryVersion:VERSION};
    if(typeof persist==='function')persist();
    else if(typeof persistLocal==='function')persistLocal();
    if(typeof renderAll==='function')renderAll();
    if(typeof toast==='function')toast('58 Räume/Zimmer aus dem festen Datensatz wiederhergestellt');
    return true;
  }

  let tries=0;
  const timer=setInterval(()=>{
    tries++;
    const stateReady=typeof rooms!=='undefined'&&typeof bookings!=='undefined'&&typeof settings!=='undefined';
    const cloudReady=typeof cloud==='undefined'||cloud.mode==='online'||cloud.mode==='local';
    if(stateReady&&cloudReady&&apply())clearInterval(timer);
    if(tries>200)clearInterval(timer);
  },100);
})();
