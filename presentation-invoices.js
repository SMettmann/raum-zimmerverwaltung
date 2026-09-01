(function(){
  function ensurePresentationInvoices(){
    if(typeof settings==='undefined'||settings?.org!=='Tagungs- & Gästehaus Beispiel')return;
    if(typeof invoices==='undefined'||!Array.isArray(invoices))return;

    const base=new Date();base.setHours(12,0,0,0);
    const p=n=>{const d=new Date(base);d.setDate(d.getDate()+n);return localIso(d)};
    const year=base.getFullYear();
    const extra=[
      {id:'i2',number:`RE-${year}-0002`,bookingId:'b2',buyer:'Anna Berger',description:'Übernachtung inkl. Frühstück',net:280,vatRate:7,vat:19.6,gross:299.6,issueDate:p(-10),dueDate:p(4),buyerStreet:'Musterweg 7',buyerZip:'18057',buyerCity:'Musterstadt',buyerEndpoint:'anna.berger@example.de',buyerRef:'PRIVAT-0002',status:'paid'},
      {id:'i3',number:`RE-${year}-0003`,bookingId:'b3',buyer:'Sozialwerk Musterstadt',description:'Tagungsraum für Teamseminar',net:560,vatRate:19,vat:106.4,gross:666.4,issueDate:p(-7),dueDate:p(7),buyerStreet:'Am Beispielpark 4',buyerZip:'18059',buyerCity:'Musterstadt',buyerEndpoint:'rechnung@sozialwerk-beispiel.de',buyerRef:'SOZ-2026-031',status:'open'},
      {id:'i4',number:`RE-${year}-0004`,bookingId:'b4',buyer:'Jugendgruppe Beispiel',description:'Bildungswochenende und Veranstaltungsleistungen',net:2100,vatRate:19,vat:399,gross:2499,issueDate:p(-4),dueDate:p(10),buyerStreet:'Jugendweg 18',buyerZip:'19053',buyerCity:'Beispielstadt',buyerEndpoint:'rechnung@jugendgruppe-beispiel.de',buyerRef:'JUG-2026-118',status:'open'},
      {id:'i5',number:`RE-${year}-0005`,bookingId:'b7',buyer:'Projektteam Nord',description:'Zimmerübernachtungen',net:420,vatRate:7,vat:29.4,gross:449.4,issueDate:p(-2),dueDate:p(12),buyerStreet:'Projektstraße 21',buyerZip:'18055',buyerCity:'Musterstadt',buyerEndpoint:'buchhaltung@projektteam-beispiel.de',buyerRef:'PRO-2026-205',status:'paid'},
      {id:'i6',number:`RE-${year}-0006`,bookingId:'b8',buyer:'Jugendbildungswerk Beispiel',description:'Workshop und Raumnutzung',net:630,vatRate:19,vat:119.7,gross:749.7,issueDate:p(-1),dueDate:p(13),buyerStreet:'Bildungsallee 6',buyerZip:'19061',buyerCity:'Beispielstadt',buyerEndpoint:'rechnung@bildungswerk-beispiel.de',buyerRef:'JBW-2026-088',status:'paid'}
    ];

    let changed=false;
    for(const item of extra){
      if(!invoices.some(inv=>inv.id===item.id)){invoices.push(item);changed=true;}
    }
    if(!changed)return;
    if(typeof persistLocal==='function')persistLocal();
    if(typeof renderAll==='function')renderAll();
  }

  const originalStart=window.startPresentation;
  if(typeof originalStart==='function'){
    window.startPresentation=function(...args){
      const result=originalStart.apply(this,args);
      ensurePresentationInvoices();
      return result;
    };
  }

  ensurePresentationInvoices();
})();
