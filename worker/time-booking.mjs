const TIMED_ROOM_TYPES=new Set(['Seminarraum','Besprechungsraum','Veranstaltungsraum']);

export function isTimedRoomType(type){return TIMED_ROOM_TYPES.has(String(type||''))}
export function validTime(value){return /^([01]\d|2[0-3]):[0-5]\d$/.test(String(value||''))}
export function dateOverlap(aFrom,aTo,bFrom,bTo){return aFrom<=bTo&&aTo>=bFrom}

function startKey(from,time){return `${from}T${validTime(time)?time:'00:00'}`}
function endKey(to,time){return `${to}T${validTime(time)?time:'23:59'}${validTime(time)?'':':59'}`}

export function validTimedRange(room,range){
  if(!isTimedRoomType(room?.type))return true;
  if(!validTime(range?.fromTime)||!validTime(range?.toTime))return false;
  return startKey(range.from,range.fromTime)<startKey(range.to,range.toTime);
}

export function bookingOverlaps(room,candidate,existing){
  if(!isTimedRoomType(room?.type))return dateOverlap(candidate.from,candidate.to,existing.from,existing.to);
  const aStart=startKey(candidate.from,candidate.fromTime),aEnd=endKey(candidate.to,candidate.toTime),bStart=startKey(existing.from,existing.fromTime),bEnd=endKey(existing.to,existing.toTime);
  return aStart<bEnd&&aEnd>bStart;
}

export function roomAvailable(state,room,range){
  if(!room||!range?.from||!range?.to||range.to<range.from)return false;
  if(isTimedRoomType(room.type)&&!validTimedRange(room,range))return false;
  const booked=(state.bookings||[]).some(b=>b.roomId===room.id&&b.status!=='cancelled'&&bookingOverlaps(room,range,b));
  const blocked=(state.blocks||[]).some(b=>b.roomId===room.id&&dateOverlap(range.from,range.to,b.from,b.to));
  return !booked&&!blocked;
}
