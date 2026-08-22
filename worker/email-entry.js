import app from './time-entry.js';
import { confirmationCandidates, sendBookingConfirmationOnce } from './booking-email.mjs';

export default {
  async fetch(request,env,ctx){
    const url=new URL(request.url);
    const watchState=request.method==='PUT'&&url.pathname==='/api/state';
    const watchPublic=request.method==='POST'&&url.pathname==='/api/public/request';
    if(!watchState&&!watchPublic)return app.fetch(request,env,ctx);

    let before=null;
    try{before=await loadOrgState(env)}catch(e){console.error('booking_email_before_state_error',e)}
    const response=await app.fetch(request,env,ctx);
    if(!response.ok||!before)return response;

    try{
      const after=await loadOrgState(env);
      if(!after)return response;
      const candidates=confirmationCandidates(before.state,after.state);
      for(const booking of candidates){
        ctx.waitUntil(sendBookingConfirmationOnce(env,{orgId:after.org_id,organizationName:after.org_name,state:after.state,bookingId:booking.id}));
      }
    }catch(e){console.error('booking_email_after_state_error',e)}
    return response;
  }
};

async function loadOrgState(env){
  const row=await env.DB.prepare(`SELECT o.id AS org_id,o.name AS org_name,s.version,s.data FROM organizations o JOIN app_state s ON s.org_id=o.id ORDER BY o.created_at LIMIT 1`).first();
  if(!row)return null;
  let state;try{state=JSON.parse(row.data)}catch{return null}
  return {...row,state};
}
