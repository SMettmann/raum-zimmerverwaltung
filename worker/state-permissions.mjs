const ARRAY_FIELDS=['cleaningPlans','shifts','blocks','contracts','invoices','bookingRequests'];

export function canWriteExtendedState(role,before={},after={}){
  if(role==='admin'||role==='manager')return true;
  if(role==='viewer')return false;
  if(!after||typeof after!=='object')return false;

  const sameSettings=same(before.settings||{},after.settings||{});
  const sameRooms=roomStructure(before.rooms)===roomStructure(after.rooms);
  if(!sameSettings||!sameRooms)return false;

  if(role==='staff'){
    return unchanged(before,after,['shifts','blocks','contracts','invoices','bookingRequests','billing']);
  }

  if(role==='cleaning'){
    return unchanged(before,after,['bookings','guests','tasks','shifts','blocks','contracts','invoices','bookingRequests','billing']);
  }

  return false;
}

function unchanged(before,after,fields){
  return fields.every(field=>same(normalizeField(before,field),normalizeField(after,field)));
}

function normalizeField(state,field){
  if(ARRAY_FIELDS.includes(field))return Array.isArray(state?.[field])?state[field]:[];
  if(field==='billing')return state?.billing&&typeof state.billing==='object'?state.billing:{};
  return state?.[field];
}

function roomStructure(list){
  return stable((Array.isArray(list)?list:[]).map(r=>({
    id:r.id,name:r.name,type:r.type,capacity:r.capacity,note:r.note
  })).sort((a,b)=>String(a.id).localeCompare(String(b.id))));
}

function same(a,b){return stable(a)===stable(b)}
function stable(value){
  if(Array.isArray(value))return '['+value.map(stable).join(',')+']';
  if(value&&typeof value==='object')return '{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+stable(value[k])).join(',')+'}';
  return JSON.stringify(value);
}
