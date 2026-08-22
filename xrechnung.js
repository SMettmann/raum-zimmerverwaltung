(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.RaumwerkXRechnung=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  function xmlEsc(v){return String(v??'').replace(/[<>&'\"]/g,c=>({'<':'&lt;','>':'&gt;','&':'&amp;',"'":'&apos;','"':'&quot;'}[c]))}
  function requireFields(invoice,billing,settings){
    const fields=[
      ['Rechnungsnummer',invoice.number],['Rechnungsdatum',invoice.issueDate],['Fälligkeitsdatum',invoice.dueDate],
      ['Empfängername',invoice.buyer],['Empfängerstraße',invoice.buyerStreet],['Empfänger-PLZ',invoice.buyerZip],['Empfängerort',invoice.buyerCity],
      ['Empfänger-E-Mail',invoice.buyerEndpoint],['Buyer Reference / Leitweg-ID',invoice.buyerRef],
      ['Einrichtungsname',settings.org],['Verkäuferstraße',billing.street],['Verkäufer-PLZ',billing.zip],['Verkäuferort',billing.city],
      ['USt-IdNr.',billing.vatId],['IBAN',billing.iban],['Verkäufer-E-Mail',billing.sellerEndpoint||settings.email],
      ['Kontakt-E-Mail',settings.email],['Kontakt-Telefon',settings.phone]
    ];
    return fields.filter(([,v])=>!String(v??'').trim()).map(([k])=>k);
  }
  function create(invoice,billing,settings){
    const missing=requireFields(invoice,billing,settings);
    if(missing.length)throw new Error('Fehlende XRechnung-Angaben: '+missing.join(', '));
    const net=Number(invoice.net)||0,vat=Number(invoice.vat)||0,gross=Number(invoice.gross)||0,vatRate=Number(invoice.vatRate)||0;
    const taxCategory=vatRate===0?'Z':'S';
    const sellerEndpoint=String(billing.sellerEndpoint||settings.email).trim();
    const sellerContact=String(settings.org||'Rechnungsstelle').trim();
    const bic=String(billing.bic||'').trim();
    return `<?xml version="1.0" encoding="UTF-8"?>
<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2" xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2" xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">
  <cbc:UBLVersionID>2.1</cbc:UBLVersionID>
  <cbc:CustomizationID>urn:cen.eu:en16931:2017#compliant#urn:xeinkauf.de:kosit:xrechnung_3.0</cbc:CustomizationID>
  <cbc:ProfileID>urn:fdc:peppol.eu:2017:poacc:billing:01:1.0</cbc:ProfileID>
  <cbc:ID>${xmlEsc(invoice.number)}</cbc:ID>
  <cbc:IssueDate>${xmlEsc(invoice.issueDate)}</cbc:IssueDate>
  <cbc:DueDate>${xmlEsc(invoice.dueDate)}</cbc:DueDate>
  <cbc:InvoiceTypeCode>380</cbc:InvoiceTypeCode>
  <cbc:DocumentCurrencyCode>EUR</cbc:DocumentCurrencyCode>
  <cbc:BuyerReference>${xmlEsc(invoice.buyerRef)}</cbc:BuyerReference>
  <cac:AccountingSupplierParty>
    <cac:Party>
      <cbc:EndpointID schemeID="EM">${xmlEsc(sellerEndpoint)}</cbc:EndpointID>
      <cac:PartyName><cbc:Name>${xmlEsc(settings.org)}</cbc:Name></cac:PartyName>
      <cac:PostalAddress>
        <cbc:StreetName>${xmlEsc(billing.street)}</cbc:StreetName>
        <cbc:CityName>${xmlEsc(billing.city)}</cbc:CityName>
        <cbc:PostalZone>${xmlEsc(billing.zip)}</cbc:PostalZone>
        <cac:Country><cbc:IdentificationCode>${xmlEsc(billing.country||'DE')}</cbc:IdentificationCode></cac:Country>
      </cac:PostalAddress>
      <cac:PartyTaxScheme><cbc:CompanyID>${xmlEsc(billing.vatId)}</cbc:CompanyID><cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme></cac:PartyTaxScheme>
      <cac:PartyLegalEntity><cbc:RegistrationName>${xmlEsc(settings.org)}</cbc:RegistrationName></cac:PartyLegalEntity>
      <cac:Contact>
        <cbc:Name>${xmlEsc(sellerContact)}</cbc:Name>
        <cbc:Telephone>${xmlEsc(settings.phone)}</cbc:Telephone>
        <cbc:ElectronicMail>${xmlEsc(settings.email)}</cbc:ElectronicMail>
      </cac:Contact>
    </cac:Party>
  </cac:AccountingSupplierParty>
  <cac:AccountingCustomerParty>
    <cac:Party>
      <cbc:EndpointID schemeID="EM">${xmlEsc(invoice.buyerEndpoint)}</cbc:EndpointID>
      <cac:PartyName><cbc:Name>${xmlEsc(invoice.buyer)}</cbc:Name></cac:PartyName>
      <cac:PostalAddress>
        <cbc:StreetName>${xmlEsc(invoice.buyerStreet)}</cbc:StreetName>
        <cbc:CityName>${xmlEsc(invoice.buyerCity)}</cbc:CityName>
        <cbc:PostalZone>${xmlEsc(invoice.buyerZip)}</cbc:PostalZone>
        <cac:Country><cbc:IdentificationCode>DE</cbc:IdentificationCode></cac:Country>
      </cac:PostalAddress>
      <cac:PartyLegalEntity><cbc:RegistrationName>${xmlEsc(invoice.buyer)}</cbc:RegistrationName></cac:PartyLegalEntity>
    </cac:Party>
  </cac:AccountingCustomerParty>
  <cac:PaymentMeans>
    <cbc:PaymentMeansCode>58</cbc:PaymentMeansCode>
    <cac:PayeeFinancialAccount>
      <cbc:ID>${xmlEsc(billing.iban)}</cbc:ID>
      ${bic?`<cac:FinancialInstitutionBranch><cbc:ID>${xmlEsc(bic)}</cbc:ID></cac:FinancialInstitutionBranch>`:''}
    </cac:PayeeFinancialAccount>
  </cac:PaymentMeans>
  <cac:PaymentTerms><cbc:Note>Zahlbar bis ${xmlEsc(invoice.dueDate)}</cbc:Note></cac:PaymentTerms>
  <cac:TaxTotal>
    <cbc:TaxAmount currencyID="EUR">${vat.toFixed(2)}</cbc:TaxAmount>
    <cac:TaxSubtotal>
      <cbc:TaxableAmount currencyID="EUR">${net.toFixed(2)}</cbc:TaxableAmount>
      <cbc:TaxAmount currencyID="EUR">${vat.toFixed(2)}</cbc:TaxAmount>
      <cac:TaxCategory><cbc:ID>${taxCategory}</cbc:ID><cbc:Percent>${vatRate.toFixed(2)}</cbc:Percent><cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme></cac:TaxCategory>
    </cac:TaxSubtotal>
  </cac:TaxTotal>
  <cac:LegalMonetaryTotal>
    <cbc:LineExtensionAmount currencyID="EUR">${net.toFixed(2)}</cbc:LineExtensionAmount>
    <cbc:TaxExclusiveAmount currencyID="EUR">${net.toFixed(2)}</cbc:TaxExclusiveAmount>
    <cbc:TaxInclusiveAmount currencyID="EUR">${gross.toFixed(2)}</cbc:TaxInclusiveAmount>
    <cbc:PayableAmount currencyID="EUR">${gross.toFixed(2)}</cbc:PayableAmount>
  </cac:LegalMonetaryTotal>
  <cac:InvoiceLine>
    <cbc:ID>1</cbc:ID>
    <cbc:InvoicedQuantity unitCode="C62">1</cbc:InvoicedQuantity>
    <cbc:LineExtensionAmount currencyID="EUR">${net.toFixed(2)}</cbc:LineExtensionAmount>
    <cac:Item>
      <cbc:Name>${xmlEsc(invoice.description)}</cbc:Name>
      <cac:ClassifiedTaxCategory><cbc:ID>${taxCategory}</cbc:ID><cbc:Percent>${vatRate.toFixed(2)}</cbc:Percent><cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme></cac:ClassifiedTaxCategory>
    </cac:Item>
    <cac:Price><cbc:PriceAmount currencyID="EUR">${net.toFixed(2)}</cbc:PriceAmount></cac:Price>
  </cac:InvoiceLine>
</Invoice>`;
  }
  return {create,requireFields,xmlEsc};
});

if(typeof document!=='undefined'&&typeof RaumwerkXRechnung!=='undefined'){
  xrechnungXml=function(i){return RaumwerkXRechnung.create(i,billing,settings)};
  downloadXRechnung=function(id){
    const i=invoices.find(x=>x.id===id);if(!i)return;
    try{
      const xml=RaumwerkXRechnung.create(i,billing,settings);
      downloadFile(i.number+'-xrechnung.xml',xml,'application/xml;charset=utf-8');toast('XRechnung XML erstellt');
    }catch(e){alert(e.message)}
  };
}

if(typeof window!=='undefined'&&typeof document!=='undefined'){
  window.addEventListener('load',()=>{
    if(!document.querySelector('script[src$="cleaning-v2.js"]')){
      const cleaningScript=document.createElement('script');
      cleaningScript.src='cleaning-v2.js';
      cleaningScript.dataset.cleaningV2='1';
      document.body.appendChild(cleaningScript);
    }
    if(!document.querySelector('script[src$="availability-simple.js"]')){
      const availabilityScript=document.createElement('script');
      availabilityScript.src='availability-simple.js';
      availabilityScript.dataset.availabilitySimple='1';
      document.body.appendChild(availabilityScript);
    }
    if(!document.querySelector('script[src$="time-booking.js"]')){
      const timeScript=document.createElement('script');
      timeScript.src='time-booking.js';
      timeScript.dataset.timeBooking='1';
      document.body.appendChild(timeScript);
    }
  });
}