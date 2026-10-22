// Cantina teleporter to Land Yacht Hangar (Vincent, 2026-10-19). Edit PORTAL below; nothing else needs to change.
// Cantina-local frame (see layout.js CANTINA): origin = cantina door, +Z into the room, facing +Z the viewer's LEFT is +X.
// The arch sits on the entry wall LEFT of the door (bar side), in the pocket between the door and the bar end, facing the room.
// Costs: the brass frame + pink seal lights ride in the cantina's merged solid/glow draws (0 draws); the window, the sign and the floor pad
// are ONE ShaderMaterial mesh (+1 draw, cantina only, never merged). An invisible box is the pick proxy (arch + sign).
import { PAL } from './props.js';
import { BEAM, beamSettings, createBeam, createBeamSound } from './beam.js'; // transporter beam-out (beam.js): +1 draw only while it is lit

export const PORTAL = {
  url: '../hangar/', // Land Yacht Hangar, hosted in this repo under /hangar/
  label: 'LAND YACHT HANGAR', sub: 'step on the pad or tap the arch',
  x: 1.95, w: 0.9, h: 2.0,        // arch on the entry wall (z = 0): centre x, opening width / height
  pad: [1.95, 0.6], r: 0.42,      // floor pad centre (cantina-local x, z) and trigger radius
  dwell: 1.5,                     // seconds standing on the pad before the jump
  rearm: 0.3,                     // must step this far beyond r before the pad re-arms (back button / bfcache)
};
const SEAL = 0xff7fb6; // Land Yacht pink (moons), vs the teal airlock seals

// brass arch + jambs + pink seal light, built into the cantina's vertex-colour builder (no draws of its own)
export function portalFrame(THREE, B) {
  const { x, w, h } = PORTAL, r = w / 2, spring = h - r, z = 0.07;
  B.put(B.solid, new THREE.TorusGeometry(r + 0.04, 0.05, 6, 20, Math.PI), PAL.brass, x, spring, z);
  for (const sx of [-1, 1]) { B.box(0.1, spring, 0.14, PAL.brass, x + sx * (r + 0.04), spring / 2, z); B.box(0.03, spring - 0.1, 0.02, SEAL, x + sx * (r - 0.02), spring / 2, z + 0.06, 0, B.glow); }
  B.put(B.glow, new THREE.TorusGeometry(r - 0.02, 0.012, 4, 20, Math.PI), SEAL, x, spring, z + 0.06);
  B.box(w + 0.28, 0.02, 0.2, PAL.brass, x, 0.01, z + 0.03); // threshold plate
  B.box(1.02, 0.24, 0.04, PAL.brass, x, h + 0.33, 0.02);   // sign backing
}

function signTex(THREE) {
  const c = document.createElement('canvas'); c.width = 1024; c.height = 224; const g = c.getContext('2d');
  g.fillStyle = '#1c1024'; g.fillRect(0, 0, 1024, 224); g.strokeStyle = '#ff7fb6'; g.lineWidth = 6; g.strokeRect(10, 10, 1004, 204);
  g.textAlign = 'center'; g.fillStyle = '#ffd1e6'; g.font = 'bold 92px system-ui, sans-serif'; g.fillText(PORTAL.label, 512, 118);
  g.fillStyle = '#8ff5cf'; g.font = '44px system-ui, sans-serif'; g.fillText('teleporter \u2192 ' + PORTAL.sub, 512, 186);
  const t = new THREE.CanvasTexture(c); t.anisotropy = 4; return t; // no colour-space decode: the shader writes display values straight out (toneMapped: false), so the canvas colours land as painted
}

const VERT = `attribute float kind; varying vec2 vUv; varying float vKind; void main() { vUv = uv; vKind = kind; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const FRAG = `uniform float uTime, uCharge; uniform sampler2D uMap; varying vec2 vUv; varying float vKind;
float dune(float x, float base, float amp, float f, float off) { return base + amp * (0.6 * sin(x * f + off) + 0.4 * sin(x * f * 2.3 + off * 1.7)); }
void main() {
  vec3 col; float a = 1.0;
  if (vKind < 0.5) { // window onto the hangar's dunes: pink dusk, two moons, three dune layers sliding at different speeds (parallax)
    vec2 p = vUv; float hz = 0.36;
    col = mix(vec3(1.0, 0.62, 0.70), vec3(0.20, 0.10, 0.30), smoothstep(hz, 1.0, p.y));
    col += vec3(1.0, 0.8, 0.85) * smoothstep(0.075, 0.06, length((p - vec2(0.30, 0.80)) * vec2(1.0, 2.2))) * 0.9;
    col += vec3(1.0, 0.75, 0.82) * smoothstep(0.05, 0.038, length((p - vec2(0.72, 0.68)) * vec2(1.0, 2.2))) * 0.8;
    float t = uTime;
    if (p.y < dune(p.x, 0.40, 0.025, 7.0, t * 0.05)) col = vec3(0.62, 0.40, 0.58);
    if (p.y < dune(p.x, 0.32, 0.035, 5.0, t * 0.15 + 2.0)) col = vec3(0.45, 0.25, 0.42);
    if (p.y < dune(p.x, 0.20, 0.045, 3.4, t * 0.40 + 4.0)) col = vec3(0.24, 0.12, 0.24);
    vec2 e = min(p, 1.0 - p); float rim = smoothstep(0.08, 0.0, min(e.x, e.y * 0.45));
    col = mix(col, vec3(0.56, 0.96, 0.81), rim * (0.55 + 0.45 * sin(t * 3.0 + p.y * 20.0)));
    col = mix(col, vec3(1.0, 0.92, 0.96), uCharge * uCharge * 0.85);
  } else if (vKind < 1.5) { vec4 s = texture2D(uMap, vUv); col = s.rgb; a = s.a; }
  else { // floor pad: soft disc + ring; the ring fills clockwise while you stand on it
    vec2 q = vUv * 2.0 - 1.0; float r = length(q); float ang = atan(q.x, -q.y) / 6.2831853 + 0.5;
    float ring = smoothstep(0.80, 0.86, r) * smoothstep(1.0, 0.94, r);
    float fill = step(ang, uCharge) * smoothstep(0.60, 0.66, r) * smoothstep(0.80, 0.76, r);
    float disc = smoothstep(1.0, 0.0, r) * (0.18 + 0.08 * sin(uTime * 2.5));
    col = vec3(1.0, 0.50, 0.71) * ring + vec3(0.56, 0.96, 0.81) * fill + vec3(1.0, 0.50, 0.71) * disc;
    a = clamp(ring + fill + disc, 0.0, 1.0); if (r > 1.0) a = 0.0;
  }
  gl_FragColor = vec4(col, a);
}`;

function withKind(THREE, g, k) { g = g.index ? g.toNonIndexed() : g; const n = g.attributes.position.count; g.setAttribute('kind', new THREE.BufferAttribute(new Float32Array(n).fill(k), 1)); if (g.attributes.normal) g.deleteAttribute('normal'); return g; }

// the live part: window + sign + pad (1 draw), pick proxy, dwell logic, transporter beam (beam.js).
// `go(url, wait)` is called once when the jump starts; leave after `wait` seconds (the beam-out; 0 when the beam is off). isXR() picks the VR timing.
export function createPortal(THREE, merge, { go, isXR = () => false }) {
  const { x, w, h, pad, r } = PORTAL, rr = w / 2, spring = h - rr;
  const sh = new THREE.Shape(); sh.moveTo(-rr, 0); sh.lineTo(rr, 0); sh.lineTo(rr, spring); sh.absarc(0, spring, rr, 0, Math.PI, false); sh.lineTo(-rr, 0);
  const win = new THREE.ShapeGeometry(sh, 16); { const p = win.attributes.position, uv = win.attributes.uv; for (let i = 0; i < p.count; i++) uv.setXY(i, (p.getX(i) + rr) / w, p.getY(i) / h); }
  win.translate(x, 0.02, 0.03);
  const sign = new THREE.PlaneGeometry(0.96, 0.21).translate(x, h + 0.33, 0.045);
  const padG = new THREE.PlaneGeometry(2 * r, 2 * r).rotateX(-Math.PI / 2).translate(pad[0], 0.012, pad[1]);
  const mat = new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, transparent: true, depthWrite: false, toneMapped: false,
    uniforms: { uTime: { value: 0 }, uCharge: { value: 0 }, uMap: { value: signTex(THREE) } } });
  const mesh = new THREE.Mesh(merge([withKind(THREE, win, 0), withKind(THREE, sign, 1), withKind(THREE, padG, 2)]), mat);
  mesh.name = 'portal-land-yacht'; mesh.renderOrder = 2; mesh.userData.noMerge = true;
  const pick = new THREE.Mesh(new THREE.BoxGeometry(w + 0.3, h + 0.55, 0.3).translate(x, (h + 0.55) / 2, 0.15), new THREE.MeshBasicMaterial());
  pick.visible = false; pick.name = 'portal-pick'; pick.userData.noMerge = true;
  const beam = createBeam(THREE), sound = createBeamSound(); beam.setAt(pad[0], pad[1]);
  const st = { charge: 0, armed: true, leaving: false, leaveT: 0, energize: 0, from: 0, fading: false };
  function jump() { if (st.leaving) return; st.leaving = true; st.armed = false; st.charge = 1; mat.uniforms.uCharge.value = 1;
    st.leaveT = 0; st.t0 = performance.now(); st.from = beam.level; st.energize = beam.on ? (isXR() ? BEAM.xrEnergize : BEAM.energize) : 0; st.fading = !beam.on;
    const k = beamSettings().k, arrive = beam.on && BEAM.arrive;
    const beamQ = arrive && k !== 1 ? (PORTAL.url.includes('?') ? '&' : '?') + 'beam=' + k.toFixed(2).replace(/\.?0+$/, '') : '';
    go(PORTAL.url + beamQ + (arrive ? '#beamin' : ''), st.energize); }
  // p = player position in cantina-local metres (x, z) or null when not in the cantina; dt in seconds. Returns charge 0..1.
  // Beam: shimmers up to BEAM.charge on the pad while the ring fills; on the jump it centres on the player (a tap from across the room
  // beams you from where you stand), rises to full over most of the beam-out, and the screen whites out for the last BEAM.fade seconds.
  function update(dt, t, p) {
    mat.uniforms.uTime.value = t; beam.tick(t);
    if (st.leaving) { st.leaveT = (performance.now() - st.t0) / 1000; if (p) beam.setAt(p.x, p.z);
      const e = st.energize, u = e > 0 ? Math.min(1, st.leaveT / (e * 0.7)) : 1; sound.set(beam.set(st.from + (1 - st.from) * u * u * (3 - 2 * u)));
      st.fading = st.leaveT >= e - (isXR() ? 0 : BEAM.fade); return 1; }
    const d = p ? Math.hypot(p.x - pad[0], p.z - pad[1]) : Infinity;
    if (!st.armed) { if (d > r + PORTAL.rearm) st.armed = true; st.charge = 0; }
    else if (d < r) { st.charge = Math.min(1, st.charge + dt / PORTAL.dwell); if (st.charge >= 1) jump(); }
    else st.charge = Math.max(0, st.charge - dt * 2);
    mat.uniforms.uCharge.value = st.charge; if (!st.leaving) { beam.setAt(pad[0], pad[1]); sound.set(beam.set(st.charge * BEAM.charge)); } return st.charge;
  }
  function reset() { st.leaving = false; st.armed = false; st.charge = 0; st.leaveT = 0; st.fading = false; mat.uniforms.uCharge.value = 0; beam.set(0); sound.set(0); } // back button / bfcache: wait until the player steps off
  return { mesh, pick, beam, sound, unlock: sound.unlock, update, jump, reset, state: st, url: PORTAL.url };
}
