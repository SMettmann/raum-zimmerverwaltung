const fs=require('fs');
const path=require('path');
const X=require('../xrechnung.js');
const invoice={number:'RE-2026-0001',issueDate:'2026-08-21',dueDate:'2026-09-04',buyer:'Musterkommune',buyerStreet:'Rathausplatz 1',buyerZip:'89522',buyerCity:'Heidenheim',buyerEndpoint:'rechnung@example.de',buyerRef:'991-12345-67',description:'Raumvermietung Seminarraum',net:100,vatRate:19,vat:19,gross:119};
const billing={street:'Musterstraße 10',zip:'89522',city:'Heidenheim',country:'DE',vatId:'DE123456789',iban:'DE02120300000000202051',bic:'BYLADEM1001',sellerEndpoint:'rechnung@raumwerk.example'};
const settings={org:'RAUMWERK Musterbetrieb',email:'rechnung@raumwerk.example',phone:'+49 7321 123456'};
const out=path.join(__dirname,'out');fs.mkdirSync(out,{recursive:true});
fs.writeFileSync(path.join(out,'xrechnung-sample.xml'),X.create(invoice,billing,settings),'utf8');
console.log('XRechnung sample generated');
