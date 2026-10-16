import { ROOM } from './config.js';
const W=()=>ROOM.width, D=()=>ROOM.depth;
// wall start/end in XZ, following cove run order
export function walls(){
  const w=W(), d=D();
  return [
    { id:'A', a:[0,0], b:[w,0], n:[0,1] },
    { id:'B', a:[w,0], b:[w,d], n:[-1,0] },
    { id:'C', a:[w,d], b:[0,d], n:[0,-1] },
    { id:'D', a:[0,d], b:[0,0], n:[1,0] },
  ].map(x=>({...x, len:Math.hypot(x.b[0]-x.a[0], x.b[1]-x.a[1])}));
}
export const perimeter=()=>walls().reduce((s,w)=>s+w.len,0);
// u range of a wall along the run
export function wallU(id){ let s=0; const P=perimeter(); for(const w of walls()){ if(w.id===id) return [s/P,(s+w.len)/P,(s+w.len/2)/P]; s+=w.len; } }
