// Adapter around Motion God's lighting/cove-scenes.js (loaded as classic script -> globalThis.CoveScenes). Do not edit that file.
// Adds a 'solid' override (sampled color) on top of his six scenes.
import { wallU, perimeter } from './room.js';
import { ROOM } from './config.js';
export function createEngine(N){
  const CS = globalThis.CoveScenes;
  const fx = CS.create(N);
  // aim scene params at our placeholder layout (params object is mutable by design)
  const win = ROOM.openings.find(o => o.type === 'window' && o.wall === ROOM.windowWall);
  const wu = wallU(ROOM.windowWall);
  fx.params.sunset.window = win ? wu[0] + (win.offset + win.width / 2) / perimeter() : wu[2];
  const mk = wallU(ROOM.makeWall); fx.params.beat.origin = mk[2]; fx.params.focus.bench = [mk[0], mk[1]];
  const st = { scene:'ambient', solid:null, brightness:1 };
  return {
    scenes: [...fx.scenes, 'solid'], state: st, fx,
    setScene(id,t){ st.scene=id; if(id!=='solid') fx.setScene(id,t); },
    setSolid(rgbLinear,t){ st.solid=rgbLinear; st.scene='solid'; },
    render(t,out,ctx){
      if(st.scene==='solid' && st.solid){ for(let i=0;i<N;i++){out[i*3]=st.solid[0];out[i*3+1]=st.solid[1];out[i*3+2]=st.solid[2];} }
      else fx.render(t,out,ctx);
      if(st.brightness!==1) for(let i=0;i<out.length;i++) out[i]*=st.brightness;
      return out;
    },
  };
}
