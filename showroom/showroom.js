// Showroom XR (Mira SHOWROOM_SPEC v1). Static three.js r170, no build step. Old loft stays at ../ (also ?loft redirects there).
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { VRButton } from 'three/addons/webxr/VRButton.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { HALL, VEST, COVE, BUILDS_WALL as BW, GATHER, PIT, WINDOW, NOOK, PLINTHS, SPAWNS, GROUP_SPOTS, MAX_USERS, coveSegments, covePerimeter, DOOR, PASSAGE, CANTINA, toCantinaWorld } from './layout.js';
import { buildPassage, buildCantina } from './cantina.js';
import { createState } from './state.js';
import { PAL, vcBuilder, hifi, loungeChair, sunburst, macrame, lavaLamp, x1c, prints, banquette } from './props.js';
import { createXRPanel } from '../panel-xr.js';
import { initOverlay } from '../panel-html.js';

const Q = new URLSearchParams(location.search);
const low = Q.has('low'), TESTROOM = Q.has('testroom'), FULL_BRACKETS = Q.get('brackets') === 'full';
const ASSETS = '../assets/';

// ---------- renderer / camera ----------
const renderer = new THREE.WebGLRenderer({ antialias: !low, powerPreference: 'high-performance', preserveDrawingBuffer: false });
renderer.setPixelRatio(Math.min(devicePixelRatio, low ? 1 : 2)); renderer.setSize(innerWidth, innerHeight);
renderer.xr.enabled = true; renderer.xr.setFoveation?.(1); renderer.xr.setFramebufferScaleFactor(0.8);
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;
renderer.shadowMap.enabled = false; // B5: no shadow pass at all (0 shadow draws); contact darkening is baked as AO blobs
document.body.appendChild(renderer.domElement);
const vrBtn = VRButton.createButton(renderer); document.body.appendChild(vrBtn);
const fixVRText = () => { if (/NOT (AVAILABLE|SUPPORTED)/i.test(vrBtn.textContent)) { vrBtn.textContent = 'VR: open in Quest Browser'; vrBtn.title = 'For VR, open this link in the Quest Browser'; vrBtn.removeAttribute('href');
  Object.assign(vrBtn.style, { left: 'auto', right: '10px', bottom: '10px', width: 'auto', padding: '5px 10px', font: '11px system-ui', opacity: '.75', borderRadius: '12px' }); } }; // P0-3: small corner chip (Enter VR on Quest keeps its normal size) // P0-3: small corner chip
new MutationObserver(fixVRText).observe(vrBtn, { childList: true, characterData: true, subtree: true }); fixVRText();

const scene = new THREE.Scene(); scene.background = new THREE.Color(0x07060a);
const camera = new THREE.PerspectiveCamera(68, innerWidth / innerHeight, 0.03, 80);
const rig = new THREE.Group(); scene.add(rig); rig.add(camera);
const hall = new THREE.Group(); hall.name = 'hall'; scene.add(hall); // room culling: hall / passage / cantina are separate groups
const controls = new OrbitControls(camera, renderer.domElement); controls.enableDamping = false;
addEventListener('resize', () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); });

// ---------- single shared state (no pose inside; see state.js) ----------
const store = createState({});
let statusFrames = 0, drawCalls = 0;
const net = { peers: null, rtt: null, poseHz: null }; // stats hook for future multi-user (no networking yet)

// ---------- local-only camera control (never called from store/net) ----------
const H = HALL.H, PIT_Y = -PIT.depth;
const VIEWS = {
  vestibule: { p: [0, 1.6, -1.2], t: [0.5, 1.7, 10.5] },
  hall: { p: [-1.2, 1.6, 2.4], t: [0.8, 1.4, 9.5] }, // P2: desktop spawn, already inside the lit hall
  builds: { p: [0.2, 1.65, 6.0], t: [0.2, 2.0, 10.5] },
  passage: { p: [2.75, 1.6, 9.6], t: [4.4, 1.2, 12.2] }, // from the hall side: hall arch + the dogleg turn beyond
  cantina: { p: [toCantinaWorld(0, 0.05)[0], 1.6, toCantinaWorld(0, 0.05)[1]], t: [toCantinaWorld(0, 6.3)[0], 1.0, toCantinaWorld(0, 6.3)[1]] }, // passage exit, ent center ~6 m ahead
  pit: { p: [-3.75, PIT_Y + 1.15, 6.9], t: [-8, 1.7, 7.3] },
  exhibit: { p: [1.0, 1.6, 1.9], t: [3.3, 1.0, 6.8] },
  plan: { p: [1.8, 33, 8.0], t: [1.8, 0, 8.01] },
};
let ceilingGroup = null;
var walk = null; // touch/desktop walking (set up below the gyro code)
function setView(n) { const v = VIEWS[n]; if (!v) return; cullOverride = n === 'plan' ? 'all' : null; look.on && stopLook(); camera.position.set(...v.p); controls.target.set(...v.t); controls.update(); if (walk && walk.on) walk.syncFromCamera();
  if (ceilingGroup) ceilingGroup.visible = n !== 'plan'; }
function spawnRig(i = 0) { const s = SPAWNS[i % SPAWNS.length]; rig.position.set(s.x, 0, s.z); rig.rotation.y = Math.PI + s.yaw; } // XR camera looks -Z; spawn faces +Z
renderer.xr.addEventListener('sessionstart', () => { spawnRig(0); setLow(true); placePanel(); applyPreset(presetNow); });
renderer.xr.addEventListener('sessionend', () => { rig.position.set(0, 0, 0); rig.rotation.y = 0; setLow(low); applyPreset(presetNow); setView('hall'); }); // N2/N3: one exit handler, back to the desktop spawn

// ---------- textures ----------
const rnd = (() => { let s = 11; return () => ((s = (s * 16807) % 2147483647) / 2147483647); })();
function canvasTex(w, h, draw, srgb = true) { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; }
const woodTex = canvasTex(512, 512, (g, s) => { g.fillStyle = '#3a271a'; g.fillRect(0, 0, s, s); const n = 6, pw = s / n;
  for (let i = 0; i < n; i++) { const l = 0.8 + rnd() * 0.35; g.fillStyle = `rgb(${66 * l | 0},${44 * l | 0},${29 * l | 0})`; g.fillRect(i * pw, 0, pw, s);
    for (let k = 0; k < 30; k++) { g.strokeStyle = `rgba(15,8,3,${0.08 + rnd() * 0.1})`; g.lineWidth = 0.5 + rnd() * 1.5; const x = i * pw + rnd() * pw; g.beginPath(); g.moveTo(x, 0); g.bezierCurveTo(x + 5 - rnd() * 10, s * .3, x + 5 - rnd() * 10, s * .7, x, s); g.stroke(); }
    g.fillStyle = 'rgba(8,4,2,.7)'; g.fillRect(i * pw, 0, 2, s); g.fillRect(i * pw, (rnd() * s) | 0, pw, 2); } });
const panelTex = canvasTex(512, 512, (g, s) => { g.fillStyle = '#4a2f1c'; g.fillRect(0, 0, s, s); const n = 8, pw = s / n;
  for (let i = 0; i < n; i++) { const l = 0.85 + rnd() * 0.3; g.fillStyle = `rgb(${84 * l | 0},${54 * l | 0},${32 * l | 0})`; g.fillRect(i * pw + 4, 0, pw - 4, s);
    for (let k = 0; k < 14; k++) { g.strokeStyle = `rgba(25,12,5,${0.1 + rnd() * 0.1})`; g.lineWidth = 0.6 + rnd(); const x = i * pw + 4 + rnd() * (pw - 4); g.beginPath(); g.moveTo(x, 0); g.lineTo(x + 3 - rnd() * 6, s); g.stroke(); }
    g.fillStyle = '#120a05'; g.fillRect(i * pw, 0, 4, s); } }); // walnut slats, 8 per 0.8 m
const rugTex = canvasTex(512, 512, (g, s) => { g.fillStyle = '#4a2c1a'; g.fillRect(0, 0, s, s); const cs = ['#c4561f', '#d9a227', '#eadfc6', '#7a8a3a', '#9a3a1c'];
  for (let r = 0; r < 9; r++) { g.strokeStyle = cs[r % cs.length]; g.lineWidth = 16; g.strokeRect(20 + r * 26, 20 + r * 26, s - 40 - r * 52, s - 40 - r * 52); }
  for (let i = 0; i < 9000; i++) { g.fillStyle = `rgba(0,0,0,${rnd() * 0.18})`; g.fillRect(rnd() * s, rnd() * s, 2, 2); } }); // shag speckle
const plasterTex = canvasTex(256, 256, (g, s) => { const d = g.createImageData(s, s); for (let i = 0; i < d.data.length; i += 4) { const v = 200 + rnd() * 55; d.data[i] = d.data[i + 1] = d.data[i + 2] = v; d.data[i + 3] = 255; } g.putImageData(d, 0, 0); }, false);

const M = {
  floor: new THREE.MeshStandardMaterial({ map: woodTex, roughness: 0.42 }),
  terracotta: new THREE.MeshStandardMaterial({ color: 0xb5583a, roughness: 0.95, roughnessMap: plasterTex }),
  choc: new THREE.MeshStandardMaterial({ color: 0x5d3725, roughness: 0.95, roughnessMap: plasterTex }),
  panel: new THREE.MeshStandardMaterial({ map: panelTex, roughness: 0.55 }),
  ceil: new THREE.MeshStandardMaterial({ color: 0x241a14, roughness: 1, side: THREE.BackSide }),
  rug: new THREE.MeshStandardMaterial({ map: rugTex, roughness: 1 }),
  alcove: new THREE.MeshStandardMaterial({ color: 0x0c0907, roughness: 1 }),
  walnut: new THREE.MeshStandardMaterial({ color: 0x6a4428, roughness: 0.5, side: THREE.DoubleSide }),
  cream: new THREE.MeshStandardMaterial({ color: 0xe6dcc6, roughness: 0.35 }),
  fascia: new THREE.MeshStandardMaterial({ color: 0x2c2019, roughness: 0.8 }),
  black: new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.6 }),
  deck: new THREE.MeshStandardMaterial({ roughness: 0.45, metalness: 0.35, map: canvasTex(256, 256, (g, s) => { g.fillStyle = '#2a2622'; g.fillRect(0, 0, s, s); // dark metal plates + wood strips
    for (let i = 0; i < 4; i++) { g.fillStyle = i % 2 ? '#3d2a1c' : '#2f2c29'; g.fillRect(0, i * s / 4 + 2, s, s / 4 - 4); } g.fillStyle = '#6a5a40'; for (let i = 0; i < 16; i++) g.fillRect(8 + (i % 4) * s / 4, 6 + (i >> 2) * s / 4, 3, 3); }) }),
  pwall: new THREE.MeshStandardMaterial({ color: 0x3a2a24, roughness: 0.8, side: THREE.DoubleSide }),
  cwall: new THREE.MeshStandardMaterial({ color: 0x4a2a1e, roughness: 0.85, roughnessMap: plasterTex, side: THREE.DoubleSide }),
  chull: new THREE.MeshStandardMaterial({ color: 0x1c1a1a, roughness: 0.7, metalness: 0.3, side: THREE.DoubleSide }),
};
woodTex.repeat.set(0.35, 0.35); // world-UV floors below use metres -> 1 tile ≈ 2.9 m
const ceilingG = new THREE.Group(); hall.add(ceilingG); ceilingGroup = ceilingG;

// ---------- floor / ceiling (L shape), pit hole ----------
function lShape(withPit) { // shape in (x, -z) for rotateX(-PI/2)
  const s = new THREE.Shape(); const n = HALL.notch;
  s.moveTo(HALL.x1, -HALL.z0); s.lineTo(HALL.x1, -HALL.z1); s.lineTo(HALL.x0, -HALL.z1); s.lineTo(HALL.x0, -n.z1); s.lineTo(n.x1, -n.z1); s.lineTo(n.x1, -HALL.z0); s.closePath();
  if (withPit) { const h = PIT.size / 2, p = new THREE.Path(); p.moveTo(PIT.cx - h, -(PIT.cz - h)); p.lineTo(PIT.cx + h, -(PIT.cz - h)); p.lineTo(PIT.cx + h, -(PIT.cz + h)); p.lineTo(PIT.cx - h, -(PIT.cz + h)); p.closePath(); s.holes.push(p); }
  return s;
}
function worldUV(g) { const p = g.attributes.position, uv = g.attributes.uv; for (let i = 0; i < p.count; i++) uv.setXY(i, p.getX(i), p.getZ(i)); return g; }
{
  const f = worldUV(new THREE.ShapeGeometry(lShape(true)).rotateX(-Math.PI / 2));
  const vf = worldUV(new THREE.PlaneGeometry(VEST.x1 - VEST.x0, VEST.z1 - VEST.z0).rotateX(-Math.PI / 2).translate(0, 0, 0));
  hall.add(new THREE.Mesh(mergeGeometries([f, vf]), M.floor));
  const pf = new THREE.PlaneGeometry(PIT.size, PIT.size).rotateX(-Math.PI / 2).translate(PIT.cx, PIT_Y, PIT.cz);
  hall.add(new THREE.Mesh(pf, M.rug));
  const c = new THREE.ShapeGeometry(lShape(false)).rotateX(-Math.PI / 2).translate(0, H, 0);
  const vc = new THREE.PlaneGeometry(VEST.x1 - VEST.x0, VEST.z1 - VEST.z0).rotateX(-Math.PI / 2).translate(0, VEST.H, 0);
  ceilingG.add(new THREE.Mesh(c, M.ceil), new THREE.Mesh(vc, M.ceil));
}
// ---------- walls ----------
const segs = coveSegments(), P = covePerimeter();
const N = Math.round(P * 180); // Motion God: N = round(cove perimeter x 180/m)
const wallGeos = new Map(); const addWall = (mat, g) => { if (!wallGeos.has(mat)) wallGeos.set(mat, []); wallGeos.get(mat).push(g); };
function wallRect(seg, s0, s1, y0, y1, mat, off = 0) {
  const g = new THREE.PlaneGeometry(s1 - s0, y1 - y0); const uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, (s0 + uv.getX(i) * (s1 - s0)) / 0.8, (y0 + uv.getY(i) * (y1 - y0)) / 0.8);
  const sm = (s0 + s1) / 2, x = seg.a[0] + seg.dx * sm + seg.n[0] * off, z = seg.a[1] + seg.dz * sm + seg.n[1] * off;
  g.rotateY(Math.atan2(seg.n[0], seg.n[1])); g.translate(x, (y0 + y1) / 2, z); addWall(mat, g); return g;
}
// seg order: 0 left wall (x=4), 1 builds wall (z=10.5), 2 window wall (x=-8), 3 notch z=4, 4 notch x=-4, 5 front wall z=1.5
wallRect(segs[0], 0, segs[0].len, 0, H, M.terracotta);
{ const s = segs[1], a = 4 - BW.x1, b = 4 - BW.x0; // builds wall: walnut slat section + plaster either side
  const d0 = 4 - (DOOR.x + DOOR.w / 2), d1 = 4 - (DOOR.x - DOOR.w / 2); // airlock door to the cantina passage, between the left wall and the slats
  wallRect(s, 0, d0, 0, H, M.choc); wallRect(s, d0, d1, DOOR.h, H, M.choc); wallRect(s, d1, a, 0, H, M.choc); wallRect(s, b, s.len, 0, H, M.choc); wallRect(s, a, b, 0, H, M.panel); }
{ const s = segs[2], a = HALL.z1 - WINDOW.z1, b = HALL.z1 - WINDOW.z0; // window wall with the scene screen
  wallRect(s, 0, a, 0, H, M.choc); wallRect(s, b, s.len, 0, H, M.choc); wallRect(s, a, b, 0, WINDOW.y0, M.choc); wallRect(s, a, b, WINDOW.y1, H, M.choc); }
wallRect(segs[3], 0, segs[3].len, 0, H, M.terracotta); wallRect(segs[4], 0, segs[4].len, 0, H, M.terracotta);
{ const s = segs[5], o0 = VEST.opening.x0 - s.a[0], o1 = VEST.opening.x1 - s.a[0]; // front wall with the vestibule opening
  wallRect(s, 0, o0, 0, H, M.choc); wallRect(s, o1, s.len, 0, H, M.choc); wallRect(s, o0, o1, VEST.opening.h, H, M.choc); }
{ // vestibule (3x3, 2.6 m, walnut) -- its front is the hall front wall
  const vs = [{ a: [VEST.x1, VEST.z1], b: [VEST.x1, VEST.z0] }, { a: [VEST.x1, VEST.z0], b: [VEST.x0, VEST.z0] }, { a: [VEST.x0, VEST.z0], b: [VEST.x0, VEST.z1] }]
    .map(w => { const len = Math.hypot(w.b[0] - w.a[0], w.b[1] - w.a[1]), dx = (w.b[0] - w.a[0]) / len, dz = (w.b[1] - w.a[1]) / len; return { ...w, len, dx, dz, n: [dz, -dx] }; });
  for (const w of vs) wallRect(w, 0, w.len, 0, VEST.H, M.panel);
  // inner face of the opening (reveal) so the frame reads as thick
  const fs = segs[5]; const rev = (x) => { const g = new THREE.PlaneGeometry(0.3, VEST.opening.h); g.rotateY(Math.PI / 2); g.translate(x, VEST.opening.h / 2, HALL.z0 - 0.15); addWall(M.walnut, g); };
  rev(VEST.opening.x0); rev(VEST.opening.x1); const top = new THREE.PlaneGeometry(VEST.opening.x1 - VEST.opening.x0, 0.3).rotateX(Math.PI / 2).translate(0, VEST.opening.h, HALL.z0 - 0.15); addWall(M.walnut, top);
}
{ // pit sides + walnut coping
  const h = PIT.size / 2, d = PIT.depth;
  for (const [x, z, ry, len] of [[PIT.cx, PIT.cz - h, 0, PIT.size], [PIT.cx, PIT.cz + h, Math.PI, PIT.size], [PIT.cx - h, PIT.cz, Math.PI / 2, PIT.size], [PIT.cx + h, PIT.cz, -Math.PI / 2, PIT.size]]) {
    const g = new THREE.PlaneGeometry(len, d); g.rotateY(ry); g.translate(x, -d / 2, z); addWall(M.walnut, g);
    const c = new THREE.BoxGeometry(len + 0.08, 0.03, 0.08); c.rotateY(ry); c.translate(x, 0.015, z); addWall(M.walnut, c); }
}
for (const [mat, gs] of wallGeos) hall.add(new THREE.Mesh(mergeGeometries(gs), mat));

// ---------- cove: fascia, strip, wash ----------
const inset = 0.05, yStrip = H - inset;
const TW = Math.min(N, 2048); // wash/ribbon texture width (Quest-safe); per-pixel data lives in `colors` + instanced pixels
const tex = new THREE.DataTexture(new Uint8Array(TW * 4), TW, 1, THREE.RGBAFormat); tex.magFilter = THREE.LinearFilter; tex.minFilter = THREE.LinearFilter; tex.wrapS = THREE.RepeatWrapping; tex.needsUpdate = true;
const colors = new Float32Array(N * 3);
function pointAt(u) { let s = ((u % 1) + 1) % 1 * P; for (const g of segs) { if (s <= g.len + 1e-9) return { x: g.a[0] + g.dx * s + g.n[0] * inset, z: g.a[1] + g.dz * s + g.n[1] * inset, g }; s -= g.len; } }
const dummy = new THREE.Object3D(), tmpC = new THREE.Color();
const pixels = new THREE.InstancedMesh(new THREE.BoxGeometry(1 / 180, 0.003, 0.01), new THREE.MeshBasicMaterial({ toneMapped: false }), N);
for (let i = 0; i < N; i++) { const p = pointAt((i + 0.5) / N); dummy.position.set(p.x, yStrip, p.z); dummy.rotation.set(0, Math.atan2(-p.g.dz, p.g.dx), 0); dummy.updateMatrix(); pixels.setMatrixAt(i, dummy.matrix); pixels.setColorAt(i, tmpC.setRGB(0, 0, 0)); }
pixels.frustumCulled = false; hall.add(pixels);
const ribbon = (() => { const pos = [], uv = [], idx = []; const hh = 0.0025;
  for (const g of segs) { const ax = g.a[0] + g.n[0] * inset, az = g.a[1] + g.n[1] * inset, bx = g.b[0] + g.n[0] * inset, bz = g.b[1] + g.n[1] * inset, k = pos.length / 3, u0 = g.s0 / P, u1 = (g.s0 + g.len) / P;
    pos.push(ax, yStrip - hh, az, bx, yStrip - hh, bz, bx, yStrip + hh, bz, ax, yStrip + hh, az); uv.push(u0, .5, u1, .5, u1, .5, u0, .5); idx.push(k, k + 1, k + 2, k, k + 2, k + 3); }
  const bg = new THREE.BufferGeometry(); bg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); bg.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); bg.setIndex(idx); return bg; })();
const ledRibbon = new THREE.Mesh(ribbon, new THREE.MeshBasicMaterial({ map: tex, color: new THREE.Color(3, 3, 3), toneMapped: false, side: THREE.DoubleSide })); ledRibbon.visible = false; hall.add(ledRibbon);
{ const F = { off: 0.15, h: 0.14, bottom: yStrip - 0.11, t: 0.02 };
  const gs = segs.map(g => { const b = new THREE.BoxGeometry(g.len + 0.3, F.h, F.t); b.rotateY(Math.atan2(g.n[0], g.n[1])); b.translate((g.a[0] + g.b[0]) / 2 + g.n[0] * F.off, F.bottom + F.h / 2, (g.a[1] + g.b[1]) / 2 + g.n[1] * F.off); return b; });
  hall.add(new THREE.Mesh(mergeGeometries(gs), M.fascia)); }
const washMat = new THREE.ShaderMaterial({
  uniforms: { strip: { value: tex }, gain: { value: 2.2 } },
  vertexShader: `attribute float u; attribute float v; varying float vu; varying float vv; void main(){ vu=u; vv=v; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
  fragmentShader: `uniform sampler2D strip; uniform float gain; varying float vu; varying float vv;
    void main(){ vec3 c=vec3(0.); for(int k=-3;k<=3;k++) c+=texture2D(strip,vec2(vu+float(k)*0.0008,.5)).rgb; c/=7.;
      float f=pow(1.-vv,2.4)*smoothstep(0.,.06,vv+.02); vec3 o=pow(c,vec3(1./2.2))*f*gain; o=o/(1.+o); gl_FragColor=vec4(o,1.); }`,
  transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
});
const washSet = {}; // F5: full (120 seg) for desktop, lod (48 seg) for ?low/XR; setLow() swaps
for (const seg of [120, 48]) { const gs = [];
  for (const g of segs) { const u0 = g.s0 / P, u1 = (g.s0 + g.len) / P;
    for (const [surf, depth] of [['ceil', 1.3], ['wall', 0.18]]) { const pos = [], uu = [], vv = [], idx = [];
      for (let i = 0; i <= seg; i++) { const t = i / seg, x = g.a[0] + (g.b[0] - g.a[0]) * t, z = g.a[1] + (g.b[1] - g.a[1]) * t;
        for (let j = 0; j <= 1; j++) { const d = j * depth; if (surf === 'ceil') pos.push(x + g.n[0] * d, H - 0.003, z + g.n[1] * d); else pos.push(x + g.n[0] * 0.004, H - d, z + g.n[1] * 0.004);
          uu.push(u0 + (u1 - u0) * t); vv.push(surf === 'ceil' ? j : j * 0.6); }
        if (i < seg) { const k = i * 2; idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); } }
      const b = new THREE.BufferGeometry(); b.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); b.setAttribute('u', new THREE.Float32BufferAttribute(uu, 1)); b.setAttribute('v', new THREE.Float32BufferAttribute(vv, 1)); b.setIndex(idx); gs.push(b); } }
  const m = new THREE.Mesh(mergeGeometries(gs), washMat); m.renderOrder = 2; m.frustumCulled = false; m.visible = (seg === 48) === low; washSet[seg] = m; ceilingG.add(m); }

// ---------- passage + cantina (separate groups for room culling) ----------
const passage = buildPassage(THREE, mergeGeometries, M); scene.add(passage);
const cant = buildCantina(THREE, mergeGeometries, M); const cantina = cant.group; scene.add(cantina);
const ROOMS = [hall, passage, cantina];
let roomNow = 'hall', cullOverride = null; // 'all' for plan view
const _cp = new THREE.Vector3(), _cd = new THREE.Vector3();
function cull() {
  if (cullOverride === 'all') { hall.visible = passage.visible = cantina.visible = true; return; }
  const c = renderer.xr.isPresenting ? renderer.xr.getCamera() : camera; _cp.setFromMatrixPosition(c.matrixWorld); _cd.setFromMatrixColumn(c.matrixWorld, 2).negate().normalize(); // read matrixWorld directly: getWorld*() on the XR camera recomputes it without the rig parent
  const inHall = _cp.z < HALL.z1 && _cp.x < HALL.x1 + 0.01, inCant = _cp.x > PASSAGE.exit[0];
  let room;
  if (inHall) room = 'hall'; else if (inCant) room = 'cantina';
  else { // in the dogleg: show the passage + the room you're facing; ties break at the passage midpoint (the turn)
    const toH = Math.hypot(DOOR.x - _cp.x, HALL.z1 - _cp.z), toC = Math.hypot(PASSAGE.exit[0] - _cp.x, PASSAGE.exit[1] - _cp.z);
    const fh = (_cd.x * (DOOR.x - _cp.x) + _cd.z * (HALL.z1 - _cp.z)) / (toH || 1), fc = (_cd.x * (PASSAGE.exit[0] - _cp.x) + _cd.z * (PASSAGE.exit[1] - _cp.z)) / (toC || 1);
    room = Math.abs(fh - fc) < 0.05 ? (toH < toC ? 'hall-p' : 'cantina-p') : (fh > fc ? 'hall-p' : 'cantina-p'); }
  hall.visible = room.startsWith('hall'); cantina.visible = room.startsWith('cantina'); passage.visible = room !== 'cantina' || _cp.x < PASSAGE.exit[0] + 3.5; // passage only near its doors
  if (room === 'hall' && !(_cp.z > HALL.z1 - 4 && _cp.x > 1)) passage.visible = false; // far side of the hall: passage can't be seen
  if (room !== roomNow) { roomNow = room; status(true); }
}
// ---------- light engine (Motion God's cove-scenes.js, unmodified) ----------
const uOf = (segIdx, s) => (segs[segIdx].s0 + s) / P;
const U = {
  window: [uOf(2, HALL.z1 - WINDOW.z1), uOf(2, HALL.z1 - WINDOW.z0)],
  builds: [uOf(1, 4 - BW.x1), uOf(1, 4 - BW.x0)],
};
U.windowMid = (U.window[0] + U.window[1]) / 2; U.buildsMid = (U.builds[0] + U.builds[1]) / 2;
const fx = globalThis.CoveScenes.create(N);
fx.params.sunset.window = U.windowMid; fx.params.beat.origin = U.buildsMid; fx.params.focus.bench = [U.builds[0], U.builds[1]];
fx.params.ambient.kelvin = 2700;
const clock = new THREE.Clock();
function engineRender(t) { const s = store.get();
  if (s.scene === 'solid' && s.solid) { for (let i = 0; i < N; i++) { colors[i * 3] = s.solid[0]; colors[i * 3 + 1] = s.solid[1]; colors[i * 3 + 2] = s.solid[2]; } }
  else fx.render(t, colors, {});
  const b = s.brightness; if (b !== 1) for (let i = 0; i < colors.length; i++) colors[i] *= b; }
store.subscribe(p => { if ('scene' in p && p.scene !== 'solid') fx.setScene(p.scene, clock.getElapsedTime()); });
fx.setScene('ambient', 0);

// ---------- scene window (Motion God wall): samples the strip across the window u-range ----------
const winMat = new THREE.ShaderMaterial({
  uniforms: { strip: { value: tex }, u0: { value: U.window[0] }, u1: { value: U.window[1] }, time: { value: 0 } },
  vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
  fragmentShader: `uniform sampler2D strip; uniform float u0,u1,time; varying vec2 vUv;
    vec3 S(float u){ return texture2D(strip,vec2(u,.5)).rgb; }
    void main(){ float u=mix(u0,u1,vUv.x); vec3 c=vec3(0.); for(int k=-6;k<=6;k++) c+=S(u+float(k)*0.004); c/=13.;
      c=pow(c,vec3(1./2.2)); vec3 hi=c*1.7+vec3(.02,.015,.04); vec3 lo=c*.35+vec3(.01,.008,.02);
      float y=vUv.y; vec3 col=mix(lo,hi,smoothstep(.0,.75,y)); col+=c*.8*exp(-pow((y-.32)*7.,2.)); // horizon band
      col*=0.92+0.08*sin(vUv.x*40.+time*.3); gl_FragColor=vec4(col,1.); }`,
  toneMapped: false,
});
{ const w = WINDOW.z1 - WINDOW.z0, h = WINDOW.y1 - WINDOW.y0;
  const g = new THREE.PlaneGeometry(w, h); g.rotateY(Math.PI / 2); g.translate(WINDOW.x + 0.02, (WINDOW.y0 + WINDOW.y1) / 2, (WINDOW.z0 + WINDOW.z1) / 2);
  // uv.x must run along the strip direction (z decreasing) -> flip
  const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setX(i, 1 - uv.getX(i));
  hall.add(new THREE.Mesh(g, winMat));
  const fr = []; for (const z of [WINDOW.z0, WINDOW.z0 + w / 3, WINDOW.z0 + 2 * w / 3, WINDOW.z1]) fr.push(new THREE.BoxGeometry(0.08, h + 0.08, 0.06).translate(WINDOW.x + 0.05, (WINDOW.y0 + WINDOW.y1) / 2, z));
  for (const y of [WINDOW.y0, WINDOW.y1]) fr.push(new THREE.BoxGeometry(0.08, 0.08, w + 0.08).translate(WINDOW.x + 0.05, y, (WINDOW.z0 + WINDOW.z1) / 2));
  hall.add(new THREE.Mesh(mergeGeometries(fr), M.black)); }
const winLight = new THREE.PointLight(0xff9a50, 6, 12, 1.2); winLight.position.set(WINDOW.x + 1.2, 2.2, (WINDOW.z0 + WINDOW.z1) / 2); hall.add(winLight);

// ---------- ambient + pins ----------
const hemi = new THREE.HemisphereLight(0x6a5070, 0x3a2414, 0.6); hall.add(hemi);
const pins = [];
function pin(x, y, z, tx, ty, tz, I = 14, ang = 0.22, col = 0xffd6a0) { const s = new THREE.SpotLight(col, I, 7, ang, 0.45, 1.5); s.position.set(x, y, z); s.target.position.set(tx, ty, tz); hall.add(s, s.target); pins.push({ s, I }); return s; }
// exhibits (2 real spots on the occupied plinths), builds wall wash, pit globe
for (const p of PLINTHS.slice(0, 2)) pin(p.x - 0.9, H - 0.3, p.z, p.x, p.h, p.z);
pin(0.2, H - 0.25, 7.6, 0.2, 1.7, 10.5, 16, 0.5); // builds wall wash, aimed lower so it no longer under-lights the relief
const globeLight = new THREE.PointLight(0xffc27a, 3.0, 5, 1.6); globeLight.position.set(PIT.cx, 2.7, PIT.cz); hall.add(globeLight);
const nookLight = new THREE.PointLight(0xffb066, 1.2, 3, 1.8); nookLight.position.set((NOOK.x0 + NOOK.x1) / 2, 1.6, (NOOK.z0 + NOOK.z1) / 2); hall.add(nookLight);

// ---------- procedural props + plinths + fake light pools ----------
const B = vcBuilder(THREE);
const pools = []; // additive floor/plinth pools + soft beams (1 draw)
function pool(x, y, z, r, c = 0xffc890) { const g = new THREE.CircleGeometry(r, 24).rotateX(-Math.PI / 2).translate(x, y + 0.004, z); tmpC.set(c);
  const n = g.attributes.position.count, col = new Float32Array(n * 3); for (let i = 0; i < n; i++) { const a = i === 0 ? 1 : 0; col[i * 3] = tmpC.r * a; col[i * 3 + 1] = tmpC.g * a; col[i * 3 + 2] = tmpC.b * a; }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.deleteAttribute('uv'); pools.push(g); }
function beam(x0, y0, z0, x1, y1, z1, r1) { const len = Math.hypot(x1 - x0, y1 - y0, z1 - z0); const g = new THREE.CylinderGeometry(0.03, r1, len, 16, 1, true);
  const n = g.attributes.position.count, col = new Float32Array(n * 3), p = g.attributes.position; for (let i = 0; i < n; i++) { const a = p.getY(i) > 0 ? 0.10 : 0.0; col[i * 3] = a; col[i * 3 + 1] = a * 0.8; col[i * 3 + 2] = a * 0.6; }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.deleteAttribute('uv');
  const dir = new THREE.Vector3(x0 - x1, y0 - y1, z0 - z1).normalize(); g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir)); g.translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2); pools.push(g); }
const ao = []; function aoBlob(x, y, z, w, d) { ao.push(new THREE.PlaneGeometry(w * 1.5, d * 1.5).rotateX(-Math.PI / 2).translate(x, y + 0.002, z)); }
// plinths
const plinthGeo = { walnut: [], cream: [] };
PLINTHS.forEach((p, i) => { (i % 2 ? plinthGeo.cream : plinthGeo.walnut).push(new THREE.BoxGeometry(p.w, p.h, p.d).translate(p.x, p.h / 2, p.z)); aoBlob(p.x, 0, p.z, p.w, p.d);
  pool(p.x, p.h, p.z, 0.42); pool(p.x - 0.4, 0, p.z, 0.7, 0x8a6040); beam(p.x - 0.9, H - 0.3, p.z, p.x, p.h, p.z, 0.4);
  B.box(0.03, 0.06, 0.4, PAL.brass, p.x - p.w / 2 - 0.02, 0.85, p.z); }); // brass label rail on the aisle side
hall.add(new THREE.Mesh(mergeGeometries(plinthGeo.walnut), M.walnut), new THREE.Mesh(mergeGeometries(plinthGeo.cream), M.cream));
// exhibits
x1c(THREE, B, PLINTHS[0].x, PLINTHS[0].h, PLINTHS[0].z, -Math.PI / 2); prints(THREE, B, PLINTHS[0].x - 0.05, PLINTHS[0].h, PLINTHS[0].z - 0.05);
const cncP = PLINTHS[1]; B.box(0.22, 0.04, 0.14, PAL.walnut, cncP.x - 0.2, cncP.h + 0.02, cncP.z + 0.25); // carved piece beside it
// pit, nook, period touches
banquette(THREE, B, PIT.cx, PIT.cz, PIT.size, PIT_Y);
B.cyl(0.004, 0.004, H - 3.25, PAL.brass, PIT.cx, (H + 3.25) / 2, PIT.cz, 4); B.sph(0.28, 0xfff0d0, PIT.cx, 3.0, PIT.cz, B.glow, 18); // globe pendant
hifi(THREE, B, NOOK.x0 + 0.25, (NOOK.z0 + NOOK.z1) / 2, Math.PI / 2); // against the notch wall x=-4, facing +X
loungeChair(THREE, B, NOOK.x1 - 0.35, NOOK.z0 + 0.45, -Math.PI / 2 - 0.5); loungeChair(THREE, B, NOOK.x1 - 0.35, NOOK.z1 - 0.45, -Math.PI / 2 + 0.5);
sunburst(THREE, B, VEST.x1 - 0.02, 1.75, 0, -Math.PI / 2);
macrame(THREE, B, WINDOW.x + 0.5, WINDOW.z0 - 0.3, H - 0.3);
lavaLamp(THREE, B, BW.x1 - 0.25, BW.tiers[1], BW.z - 0.16);
// group-spot nav targets (teleport rings, shown with Labels / in XR)
const rings = []; for (const g of GROUP_SPOTS) { const y = g.id === 'pit' ? PIT_Y : 0; rings.push(new THREE.RingGeometry(0.32, 0.36, 32).rotateX(-Math.PI / 2).translate(g.x, y + 0.006, g.z)); }
const ringMesh = new THREE.Mesh(mergeGeometries(rings), new THREE.MeshBasicMaterial({ color: 0xd9a227, transparent: true, opacity: 0.5, depthWrite: false })); ringMesh.visible = false; hall.add(ringMesh);
// flush batches
const propMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55 });
hall.add(new THREE.Mesh(mergeGeometries(B.solid), propMat));
hall.add(new THREE.Mesh(mergeGeometries(B.glow), new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false })));
{ const pm = new THREE.Mesh(mergeGeometries(pools), new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false })); pm.renderOrder = 3; hall.add(pm); }
{ const am = new THREE.Mesh(mergeGeometries(ao), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.45, depthWrite: false, alphaMap: canvasTex(64, 64, (g, s) => { const r = g.createRadialGradient(s / 2, s / 2, 2, s / 2, s / 2, s / 2); r.addColorStop(0, '#fff'); r.addColorStop(1, '#000'); g.fillStyle = r; g.fillRect(0, 0, s, s); }, false) })); am.renderOrder = 1; hall.add(am); }
const propTris = Math.round(B.tris());

// label rails text: one atlas texture, one draw
{ const W = 1024, Hh = 64 * PLINTHS.length;
  const t = canvasTex(W, Hh, (g) => { PLINTHS.forEach((p, i) => { g.fillStyle = '#2a1d12'; g.fillRect(0, i * 64, W, 64); g.fillStyle = '#e8c77a'; g.font = '30px Georgia, serif'; g.fillText(`${p.name}  ·  ${p.crew}  ·  ${p.year}`, 16, i * 64 + 42); }); });
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  const gs = PLINTHS.map((p, i) => { const g = new THREE.PlaneGeometry(0.6, 0.0375); const uv = g.attributes.uv; for (let k = 0; k < uv.count; k++) uv.setY(k, 1 - (i + 1 - uv.getY(k)) / PLINTHS.length);
    g.rotateY(-Math.PI / 2); g.rotateZ(0); g.translate(p.x - p.w / 2 - 0.04, 0.86, p.z); return g; });
  hall.add(new THREE.Mesh(mergeGeometries(gs), new THREE.MeshBasicMaterial({ map: t }))); }

// ---------- loaders: CNC exhibit (CC-BY prop), vitrine, brackets ----------
const draco = new DRACOLoader().setDecoderPath('https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/libs/draco/gltf/');
const loader = new GLTFLoader().setDRACOLoader(draco);
{ const p = cncP, vit = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.45, 0.5).translate(p.x + 0.05, p.h + 0.225, p.z - 0.05), new THREE.MeshStandardMaterial({ color: 0xcfe3ea, roughness: 0.05, transparent: true, opacity: 0.14, depthWrite: false }));
  hall.add(vit);
  const fb = new THREE.Mesh(new THREE.BoxGeometry(0.33, 0.25, 0.4).translate(p.x + 0.05, p.h + 0.125, p.z - 0.05), new THREE.MeshStandardMaterial({ color: 0x1d1f22 })); hall.add(fb);
  loader.load(ASSETS + 'props/cnc.glb', g => { const o = g.scene, bb = new THREE.Box3().setFromObject(o), sz = bb.getSize(new THREE.Vector3()), c = bb.getCenter(new THREE.Vector3());
    const k = Math.min(0.42 / sz.x, 0.3 / sz.y, 0.4 / sz.z); o.scale.setScalar(k); o.position.set(p.x + 0.05 - c.x * k, p.h - bb.min.y * k, p.z - 0.05 - c.z * k); fb.visible = false; hall.add(o); }, undefined, () => console.info('cnc.glb fallback box')); }
// brackets: hidden behind the fascia. B4: desktop uses a 12-tri proxy (instanced); Clay's GLB only with ?brackets=full; hidden in low/XR.
const bracketGroup = new THREE.Group(); hall.add(bracketGroup);
const brackets = []; for (const g of segs) { const n = Math.floor((g.len - 0.1) / 0.3048) + 1; for (let k = 0; k < n; k++) { const s = 0.05 + k * 0.3048; brackets.push({ x: g.a[0] + g.dx * s, z: g.a[1] + g.dz * s, ry: Math.atan2(g.n[0], g.n[1]) }); } }
function instanceInto(geoMeshes, list) { for (const m of geoMeshes) { const im = new THREE.InstancedMesh(m.geometry, m.material, list.length);
  list.forEach((b, i) => { dummy.position.set(b.x, yStrip, b.z); dummy.rotation.set(0, b.ry, 0); dummy.updateMatrix(); dummy.matrix.multiply(m.matrixWorld); im.setMatrixAt(i, dummy.matrix); }); im.frustumCulled = false; bracketGroup.add(im); } }
let bracketStatus = 'proxy';
if (FULL_BRACKETS) loader.load(ASSETS + 'bracket/crest-bracket.glb', g => { g.scene.updateMatrixWorld(true); const ms = []; g.scene.traverse(m => m.isMesh && ms.push(m)); instanceInto(ms, brackets); bracketStatus = 'glb'; status(true); }, undefined, () => {});
else { const m = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.03, 0.03).translate(0, 0, 0.015), new THREE.MeshLambertMaterial({ color: 0xbbbbbb })); m.updateMatrixWorld(); instanceInto([m], brackets); }

// ---------- builds wall: walnut slats, dark alcove, floating tiers, under-shelf wash, Clay's builds-opt ----------
const shelf = new THREE.Group(); hall.add(shelf);
const BWW = BW.x1 - BW.x0, BCX = (BW.x0 + BW.x1) / 2;
{ const al = new THREE.PlaneGeometry(BWW - 0.6, BW.relief.bottom + BW.relief.h + 0.15 - BW.tiers[0] + 0.25).translate(BCX, (BW.tiers[0] - 0.25 + BW.relief.bottom + BW.relief.h + 0.15) / 2, BW.z - 0.003); al.rotateY(0);
  const alc = new THREE.Mesh(al, M.alcove); alc.rotation.y = Math.PI; alc.position.set(2 * BCX, 0, 2 * BW.z - 0.006); hall.add(alc);
  const boards = [], glows = [], strips = [];
  for (const y of BW.tiers) { boards.push(new THREE.BoxGeometry(BWW - 0.4, 0.04, BW.depth).translate(BCX, y - 0.02, BW.z - BW.depth / 2));
    strips.push(new THREE.BoxGeometry(BWW - 0.5, 0.006, 0.012).translate(BCX, y - 0.043, BW.z - BW.depth + 0.03));
    const g = new THREE.PlaneGeometry(BWW - 0.45, 0.45).translate(BCX, y - 0.04 - 0.225, BW.z - 0.008); g.rotateY(0); glows.push(g); }
  const bm = new THREE.Mesh(mergeGeometries(boards), new THREE.MeshStandardMaterial({ color: 0xa8743f, roughness: 0.45 })); hall.add(bm);
  hall.add(new THREE.Mesh(mergeGeometries(strips), new THREE.MeshBasicMaterial({ color: 0xffc98a, toneMapped: false })));
  const gt = canvasTex(64, 64, (g, s) => { const r = g.createLinearGradient(0, 0, 0, s); r.addColorStop(0, '#fff'); r.addColorStop(1, '#000'); g.fillStyle = r; g.fillRect(0, 0, s, s); }, false);
  const gm = new THREE.Mesh(mergeGeometries(glows), new THREE.MeshBasicMaterial({ color: 0xffa860, alphaMap: gt, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  gm.rotation.y = Math.PI; gm.position.set(2 * BCX, 0, 2 * BW.z - 0.016); gm.renderOrder = 3; hall.add(gm);
  pool(BCX, 0, BW.z - 1.6, 2.2, 0x6a4a30); }
const slots = []; for (let t = 0; t < BW.tiers.length; t++) for (let i = 0; i < 3; i++) slots.push([BCX + (-1 + i) * (BWW - 0.6) / 3, BW.tiers[t], BW.z - BW.depth / 2]);
const signSet = { full: null, lo: null }; function applySignSet() { if (signSet.full && signSet.lo) { signSet.lo.visible = lowNow; signSet.full.visible = !lowNow; } }
const lodObjs = []; let buildsInfo = 'loading', reliefSize = null;
function mergeByMaterial(root) { root.updateMatrixWorld(true); const inv = new THREE.Matrix4().copy(root.matrixWorld).invert(), groups = new Map();
  root.traverse(m => { if (m.isMesh && !Array.isArray(m.material)) { const k = m.material.uuid; if (!groups.has(k)) groups.set(k, []); groups.get(k).push(m); } });
  const out = new THREE.Group();
  for (const ms of groups.values()) { const gs = ms.map(m => m.geometry.clone().applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, m.matrixWorld)));
    let mg = null; try { mg = gs.length > 1 ? mergeGeometries(gs) : gs[0]; } catch (e) { mg = null; } if (!mg) return root; out.add(new THREE.Mesh(mg, ms[0].material)); }
  return out; }
function standUp(o) { let box = new THREE.Box3().setFromObject(o), sz = box.getSize(new THREE.Vector3());
  if (sz.y < 0.03 && Math.max(sz.x, sz.z) > 0.04) { o.rotation.x = -Math.PI / 2; o.updateMatrixWorld(true); box = new THREE.Box3().setFromObject(o); }
  const c = box.getCenter(new THREE.Vector3()); o.position.set(-c.x, -box.min.y, -c.z); const w = new THREE.Group(); w.add(o); return w; }
// ---------- Antlers of HOPE neon (overlay of the relief, same frame) ----------
const neon = { full: null, low: null, halos: [], lights: [], panel: null, tris: 0 };
const haloTex = canvasTex(128, 128, (g, s) => { const r = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2); r.addColorStop(0, '#fff'); r.addColorStop(0.45, '#555'); r.addColorStop(1, '#000'); g.fillStyle = r; g.fillRect(0, 0, s, s); }, false);
function buildNeon(root, reliefObj, mount, size) {
  const n = mergeByMaterial(root); n.scale.copy(reliefObj.scale); n.rotation.copy(reliefObj.rotation); n.position.copy(reliefObj.position); // identical transform to the relief
  const holder = reliefObj.parent; holder.add(n); n.updateMatrixWorld(true);
  const lowParts = [], shell = [[], []], centers = {};
  n.traverse(m => { if (!m.isMesh) return; m.userData.noMerge = true; m.castShadow = false;
    const mat = m.material, c = (mat.emissive && mat.emissive.getHex()) ? mat.emissive.clone() : mat.color.clone();
    m.material = new THREE.MeshBasicMaterial({ color: c.clone().multiplyScalar(1.6), toneMapped: false }); // emissive tube, unlit
    const g = m.geometry.clone(); g.applyMatrix4(new THREE.Matrix4().copy(mount.matrixWorld).invert().multiply(m.matrixWorld)); if (!g.attributes.normal) g.computeVertexNormals();
    for (const a of Object.keys(g.attributes)) if (!['position', 'normal'].includes(a)) g.deleteAttribute(a);
    const cnt = g.attributes.position.count, col = new Float32Array(cnt * 3); for (let i = 0; i < cnt; i++) { col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3)); lowParts.push(g);
    [0.006, 0.016].forEach((off, k) => { const sg = g.clone(), p = sg.attributes.position, nn = sg.attributes.normal; for (let i = 0; i < p.count; i++) p.setXYZ(i, p.getX(i) + nn.getX(i) * off, p.getY(i) + nn.getY(i) * off, p.getZ(i) + nn.getZ(i) * off); shell[k].push(sg); });
    const bb = new THREE.Box3().setFromBufferAttribute(g.attributes.position); const key = c.r > 0.9 && c.g < 0.3 ? 'red' : c.b > 0.9 && c.r < 0.8 ? 'purple' : 'white'; centers[key] = bb.getCenter(new THREE.Vector3());
    neon.tris += (g.index ? g.index.count : g.attributes.position.count) / 3; });
  neon.full = n;
  const lm = new THREE.Mesh(mergeGeometries(lowParts), new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false })); lm.userData.noMerge = true; mount.add(lm); neon.low = lm; // 1-draw tubes for low/XR
  lm.material.color.setScalar(1.6);
  const haloMat = op => new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: op, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
  neon.halos = shell.map((gs, k) => { const m = new THREE.Mesh(mergeGeometries(gs), haloMat(k ? 0.16 : 0.32)); m.renderOrder = 4; m.userData.noMerge = true; mount.add(m); return m; });
  // soft sprite-free wall glow: one additive plane with a radial falloff behind the tubes (part of the outer halo draw budget? no: own draw, full mode only)
  const wg = new THREE.Mesh(new THREE.PlaneGeometry(size.x * 1.6, size.y * 1.5), new THREE.MeshBasicMaterial({ color: 0x8a2a8a, alphaMap: haloTex, transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
  wg.position.set(0, size.y / 2, -0.004); mount.add(wg); wg.renderOrder = 3; neon.halos.push(wg);
  // clear acrylic panel just in front of the wood, sized to the sign
  const pn = new THREE.Mesh(new THREE.PlaneGeometry(size.x + 0.04, size.y + 0.04), new THREE.MeshBasicMaterial({ color: 0x07080a, transparent: true, opacity: 1, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }) /* additive sheen: can only brighten, so no dark square */);
  pn.position.set(0, size.y / 2, Math.max(size.z, 0.019) + 0.012); pn.castShadow = pn.receiveShadow = false; mount.add(pn); neon.panel = pn;
  // cheap coloured wash on the wall: red + purple point lights in front of their tube groups
  mount.updateMatrixWorld(true);
  for (const [k, hex] of [['red', 0xff2020], ['purple', 0xa633ff]]) { const c = (centers[k] || new THREE.Vector3(0, size.y / 2, 0)).clone(); const L = new THREE.PointLight(hex, 1.6, 1.6, 1.8); L.position.set(c.x, c.y, 0.25); mount.add(L); neon.lights.push(L); }
  applyNeonMode(); status(true);
}
function applyNeonMode() { if (!neon.full) return; const lo = lowNow;
  neon.full.visible = !lo; neon.low.visible = lo; neon.halos.forEach((m, i) => m.visible = !lo || i === 0); neon.panel.visible = false; } // panel off: any acrylic plane edge read as a square around the sign
// ---------- Clay's cantina pieces (entertainment center + led_strip), loaded when they appear in the manifest ----------
let ledStrip = null, cantInfo = 'placeholders';
const ledAvg = new THREE.Color();
function ledStripUpdate() { if (!ledStrip) return; let r = 0, g = 0, b = 0; const st = Math.max(1, (N / 64) | 0); let n = 0; for (let i = 0; i < N; i += st) { r += colors[i * 3]; g += colors[i * 3 + 1]; b += colors[i * 3 + 2]; n++; }
  const k = 2.5 / n; ledAvg.setRGB(Math.min(1.5, r * k), Math.min(1.5, g * k), Math.min(1.5, b * k)); ledStrip.forEach(m => m.material.color.copy(ledAvg)); } // Motion God's current scene colour
function hookLedStrip(root) { root.traverse(m => { if (m.isMesh && /led_strip/i.test(m.name + ' ' + (m.parent?.name || '') + ' ' + (m.material?.name || ''))) { m.material = new THREE.MeshBasicMaterial({ toneMapped: false }); m.userData.noMerge = true; (ledStrip ||= []).push(m); } }); }
// Clay's cantina pieces: everything with room:"cantina" in the builds-opt manifest (builds[] or skipped[]), loaded per manifest (no hard-coded files),
// placed in cantina-local space (mirrored layout: bar on the LEFT as you enter, booth on the right), then merged by material -> ~13 draws.
// Two sets: full (desktop) and lod1 (?low + XR); setLow() swaps them.
const CANT_PLACE = [ // [regex on file, [x, y, z] cantina-local, ry]; first match wins; unknown pieces fall back to the side walls
  [/^ent_center/, [0, 0, 6.3], Math.PI], // 4.10 W x 0.48 D x 2.55 H, facing the entry (-Z)
  [/^cantina_back_bar/, [3.62, 0, 3.0], -Math.PI / 2],
  [/^cantina_bar/, [2.25, 0, 3.0], -Math.PI / 2],
  [/^cantina_stools/, [2.25 - 0.81, 0, 3.0], -Math.PI / 2], // Clay: bar transform + local z +0.81
  [/^cantina_booth/, [-2.45, 0, 3.0], Math.atan2(2.45, 3.3)], // opening (+Z) turned toward the ent center
  [/cargo_A_stacked/, [-3.35, 0, 1.0], 0.3], [/cargo_A/, [3.3, 0, 0.75], -0.2], [/containers_B/, [3.45, 0, 5.55], -Math.PI / 2],
  [/containers_D/, [-3.4, 0, 5.4], 0], [/prop_lights/, [-3.55, 0, 1.9], 0],
  [/jar_A/, [2.3, 1.05, 2.0], 0], [/jar_C/, [2.3, 1.05, 3.9], 0], [/pot_large/, [2.3, 1.05, 4.4], -Math.PI / 2], [/menu/, [2.3, 1.05, 2.5], -Math.PI / 2], [/food/, [2.3, 1.05, 3.3], 0],
];
const cantSets = { full: null, lod1: null }; let cantSig = '';
function applyCantSet() { const lo = lowNow; if (cantSets.full) cantSets.full.visible = !lo || !cantSets.lod1; if (cantSets.lod1) cantSets.lod1.visible = lo || !cantSets.full; }
function loadGLB(u) { return new Promise(res => loader.load(u, g => res(g.scene), undefined, () => { console.info('cantina piece missing', u); res(null); })); }
// ---------- entertainment-center TV = web browser (bombshelldiscovery.com) ----------
// .com 302s to .org; the .com redirect sends X-Frame-Options: sameorigin, .org sends no XFO/CSP, so the iframe loads .org directly.
// Desktop: live iframe warped over the screen rect (updateTV). XR (no DOM in WebXR) + fallback: snapshot tv-bombshell.jpg baked into Clay's atlas (0 extra draws).
const TV = { url: 'https://bombshelldiscovery.org/', pos: [0.51, 1.09, 6.47], w: 1.56, h: 0.88, img: 'tv-bombshell.jpg' };
const tvImg = new Promise(res => { const im = new Image(); im.onload = () => res(im); im.onerror = () => res(null); im.src = TV.img; });
async function buildCantSet(entries, base, useLod) {
  const scenes = await Promise.all(entries.map(e => loadGLB(base + ((useLod && e.lod1) || e.file) + '?v=' + encodeURIComponent(e.date || e.bytes || ''))));
  const tmp = new THREE.Group(); cantina.add(tmp); tmp.updateMatrixWorld(true); let fallback = 0;
  entries.forEach((e, i) => { const s = scenes[i]; if (!s) return; const P = CANT_PLACE.find(([re]) => re.test(e.file)); const w = new THREE.Group(); s.scale.setScalar(e.scale || 1); w.add(s);
    const mp = e.placement && Array.isArray(e.placement.pos) ? e.placement : null; // Clay's manifest placement wins (door origin, +Z in); mirror X so the bar is on the LEFT
    if (mp) { w.position.set(-mp.pos[0], mp.pos[1] || 0, mp.pos[2]); w.rotation.y = -THREE.MathUtils.degToRad(mp.rot_y_deg || 0); } // back bar: front +Z -> rot -90 faces -X, into the room
    else if (P) { w.position.set(...P[1]); w.rotation.y = P[2]; } else { const k = fallback++; w.position.set(k % 2 ? -3.3 : 3.3, 0, 1.2 + (k >> 1) * 0.8); w.rotation.y = k % 2 ? Math.PI / 2 : -Math.PI / 2; }
    w.userData.file = e.file; tmp.add(w); });
  tmp.updateMatrixWorld(true); const inv = new THREE.Matrix4().copy(tmp.matrixWorld).invert();
  const groups = new Map(); // material name -> { mat, geoms }
  tmp.traverse(m => { if (!m.isMesh) return; for (const [gi, mat] of (Array.isArray(m.material) ? m.material : [m.material]).entries()) {
    let g = m.geometry.clone(); if (Array.isArray(m.material)) { const gr = g.groups[gi]; g = g.index ? g.toNonIndexed() : g; const s = gr ? gr.start : 0, c = gr ? gr.count : g.attributes.position.count; const ng = new THREE.BufferGeometry(); for (const [k, a] of Object.entries(g.attributes)) ng.setAttribute(k, new THREE.BufferAttribute(a.array.slice(s * a.itemSize, (s + c) * a.itemSize), a.itemSize)); g = ng; }
    g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, m.matrixWorld)); if (g.index) g = g.toNonIndexed();
    for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'uv') g.deleteAttribute(k);
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    const key = /led_strip/i.test(mat.name + ' ' + m.name) ? 'led_strip' : (mat.name || mat.uuid); if (!groups.has(key)) groups.set(key, { mat, geoms: [] }); groups.get(key).geoms.push(g); } });
  cantina.remove(tmp);
  const out = new THREE.Group(); out.name = useLod ? 'cantina-clay-lod1' : 'cantina-clay'; let tris = 0;
  // runtime atlas: every baked texture -> one 2048 canvas (4x4 grid of 512 cells, big maps get 2x2 blocks, one white cell for the untextured glows) => 1 draw (+ led_strip)
  for (const [, G] of groups) if (G.mat.map) { const t = G.mat.map; t.updateMatrix(); if (!t.matrix.equals(new THREE.Matrix3())) for (const g of G.geoms) { const uv = g.attributes.uv, v = new THREE.Vector2(); for (let i = 0; i < uv.count; i++) { v.fromBufferAttribute(uv, i).applyMatrix3(t.matrix); uv.setXY(i, v.x, v.y); } } } // bake KHR_texture_transform
  const inUnit = geoms => geoms.every(g => { const a = g.attributes.uv.array; for (let i = 0; i < a.length; i++) if (a[i] < -0.002 || a[i] > 1.002) return false; return true; });
  const texs = [], solo = [];
  for (const [key, G] of groups) { if (key === 'led_strip') { solo.push([key, G]); continue; } if (G.mat.map && !inUnit(G.geoms)) { solo.push([key, G]); continue; } if (G.mat.map && !texs.includes(G.mat.map)) texs.push(G.mat.map); }
  const A = 2048, C = 512, free = Array(16).fill(true); free[15] = false; const slot = new Map(); // tex -> [x, y, w]
  texs.sort((p, q) => (q.image?.width || 0) - (p.image?.width || 0));
  texs.forEach((t, i) => { const left = texs.length - i - 1, nfree = free.filter(Boolean).length; let placed = false;
    if ((t.image?.width || 0) >= 1024 && nfree - 4 >= left) for (let c = 0; c < 16 && !placed; c++) { const cx = c % 4, cy = c >> 2; if (cx > 2 || cy > 2) continue; const cs = [c, c + 1, c + 4, c + 5]; if (cs.every(k => free[k])) { cs.forEach(k => free[k] = false); slot.set(t, [cx * C, cy * C, 2 * C]); placed = true; } }
    if (!placed) { const c = free.indexOf(true); if (c >= 0) { free[c] = false; slot.set(t, [(c % 4) * C, (c >> 2) * C, C]); } } });
  const cv = document.createElement('canvas'); cv.width = cv.height = A; const cx2 = cv.getContext('2d'); cx2.fillStyle = '#fff'; cx2.fillRect(3 * C, 3 * C, C, C);
  const tvI = await tvImg; if (tvI) cx2.drawImage(tvI, 3 * C, 3 * C, C, 288); // TV snapshot in the top of the white cell; glows sample the white below
  for (const [t, [x, y, w]] of slot) { try { cx2.drawImage(t.image, x, y, w, w); } catch (e) { slot.delete(t); } }
  const at = new THREE.CanvasTexture(cv); at.flipY = false; at.colorSpace = THREE.SRGBColorSpace; at.anisotropy = 4;
  const packed = [];
  for (const [key, G] of groups) { if (solo.some(([k]) => k === key)) continue; const sl = G.mat.map ? slot.get(G.mat.map) : [3 * C + C / 2 - 1, 3 * C + 430, 2];
    if (!sl) { solo.push([key, G]); continue; } const [x, y, w] = sl, pad = G.mat.map ? 2 : 0;
    const col = G.mat.map ? new THREE.Color(1, 1, 1) : (G.mat.emissive && G.mat.emissive.getHex() ? G.mat.emissive.clone() : G.mat.color ? G.mat.color.clone() : new THREE.Color(1, 1, 1));
    for (const g of G.geoms) { const uv = g.attributes.uv, n = uv.count, cc = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) { const u = G.mat.map ? uv.getX(i) : 0.5, v = G.mat.map ? uv.getY(i) : 0.5; uv.setXY(i, (x + pad + u * (w - 2 * pad)) / A, (y + pad + v * (w - 2 * pad)) / A); cc[i * 3] = col.r; cc[i * 3 + 1] = col.g; cc[i * 3 + 2] = col.b; }
      g.setAttribute('color', new THREE.BufferAttribute(cc, 3)); packed.push(g); } }
  if (tvI) { const g = new THREE.PlaneGeometry(TV.w, TV.h).rotateY(Math.PI).translate(...TV.pos).toNonIndexed(); g.deleteAttribute('normal'); const uv = g.attributes.uv, n = uv.count;
    for (let i = 0; i < n; i++) uv.setXY(i, (3 * C + uv.getX(i) * C) / A, (3 * C + (1 - uv.getY(i)) * 288) / A); g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(n * 3).fill(1), 3)); packed.push(g); }
  if (packed.length) { const mg = mergeGeometries(packed); tris += mg.attributes.position.count / 3; const mesh = new THREE.Mesh(mg, new THREE.MeshBasicMaterial({ map: at, vertexColors: true })); mesh.name = 'clay-atlas'; out.add(mesh); }
  for (const [key, { mat, geoms }] of solo) { const mg = geoms.length > 1 ? mergeGeometries(geoms) : geoms[0]; if (!mg) continue; tris += mg.attributes.position.count / 3;
    const col = mat.map ? new THREE.Color(1, 1, 1) : (mat.emissive && mat.emissive.getHex() ? mat.emissive.clone() : mat.color ? mat.color.clone() : new THREE.Color(1, 1, 1));
    const mesh = new THREE.Mesh(mg, new THREE.MeshBasicMaterial({ map: mat.map || null, color: col, side: mat.side })); mesh.name = key; out.add(mesh); }
  out.userData.atlas = `${slot.size} maps packed, ${solo.length} solo`;
  out.userData.tris = tris; out.userData.draws = out.children.length; out.traverse(o => o.userData.noMerge = true); return out;
}
async function loadCantinaPieces(entries, base) {
  entries = entries.filter(e => e.file); if (!entries.length) return;
  const sig = JSON.stringify(entries.map(e => [e.file, e.lod1, e.date, e.bytes])); if (sig === cantSig) return; cantSig = sig;
  const [full, lod] = await Promise.all([buildCantSet(entries, base, false), buildCantSet(entries, base, true)]);
  for (const k of ['full', 'lod1']) if (cantSets[k]) cantina.remove(cantSets[k]);
  cantSets.full = full; cantSets.lod1 = lod; cantina.add(full, lod);
  ledStrip = null; hookLedStrip(full); hookLedStrip(lod); cant.hidePlaceholders?.(); applyCantSet();
  cantInfo = `clay ${entries.length} files · ${full.userData.draws}/${lod.userData.draws} draws · ${Math.round(full.userData.tris)}/${Math.round(lod.userData.tris)} tris`;
  window.LOFT && (window.LOFT.cantSets = cantSets); status(true);
}
async function loadBuilds() {
  let list = [], base = ASSETS + 'builds/', cantExtra = [];
  for (const dir of [ASSETS + 'builds-opt/', ASSETS + 'builds/']) { try { const r = await fetch(dir + 'manifest.json', { cache: 'no-store' }); if (r.ok) { const j = await r.json(); list = Array.isArray(j) ? j : (j.builds || j.items || []); base = dir; cantExtra = Array.isArray(j) ? [] : (j.skipped || []).filter(e => e.room === 'cantina'); if (list.length) break; } } catch (e) {} }
  const isHope = e => /hope/i.test((e.file || '') + (e.name || '')); const isCant = e => e.room === 'cantina' || /entertain|ent[_-]?center|led[_-]?strip|cantina/i.test((e.file || '') + ' ' + (e.name || ''));
  loadCantinaPieces([...list.filter(isCant), ...cantExtra], base); list = list.filter(e => !isCant(e));
  const neonE = list.find(e => e.overlay_of || /neon/i.test(e.file || '')); list = list.filter(e => e !== neonE); const sign = list.find(isHope), items = list.filter(e => !isHope(e));
  const url = f => base + f.replace(/^assets\/builds(-opt)?\//, '');
  let loaded = 0;
  const fit = (o0, e, maxW, maxH, maxD) => { const o = mergeByMaterial(o0); o.scale.setScalar(e.scale || 1); const s = new THREE.Box3().setFromObject(o).getSize(new THREE.Vector3());
    const thin = s.y < 0.03, hgt = thin ? s.z : s.y, dep = thin ? s.y : s.z; o.scale.multiplyScalar(Math.min(2.5, maxW / Math.max(s.x, 1e-6), maxH / Math.max(hgt, 1e-6), maxD / Math.max(dep, 1e-6))); return standUp(o); };
  items.slice(0, slots.length).forEach((e, i) => { const holder = new THREE.Group(); holder.position.set(...slots[i]); holder.rotation.y = Math.PI; shelf.add(holder);
    const file = e.file; if (!file) return; const lf = e.lod1 || null;
    loader.load(url(low && lf ? lf : file), g => {
      if (!low && lf) { const lod = new THREE.LOD(); lod.addLevel(fit(g.scene, e, 0.6, 0.42, 0.26), 0); holder.add(lod); lodObjs.push(lod);
        loader.load(url(lf), g2 => lod.addLevel(fit(g2.scene, e, 0.6, 0.42, 0.26), 3.5), undefined, () => {}); }
      else holder.add(fit(g.scene, e, 0.6, 0.42, 0.26));
      loaded++; buildsInfo = `${loaded}/${items.length}${base.includes('opt') ? ' opt' : ''}`; status(true); }, undefined, () => console.info('build missing', file)); });
  if (sign) { // warm front key on the relief (~2700K), from above and in front, no shadows
    const cy = BW.relief.bottom + BW.relief.h / 2, key = pin(BCX + 0.3, H - 0.1, BW.z - 2.6, BCX, cy, BW.z - 0.05, 5, 0.12, 0xffb46b); key.penumbra = 0.35; /* narrowed cone (0.2 -> 0.12 rad) */ key.distance = 5; } // key dimmed (9 -> 5) so the neon reads
  if (sign) loader.load(url(low && sign.lod1 ? sign.lod1 : sign.file), g => { const h = new THREE.Group(); h.position.set(BCX, BW.relief.bottom, BW.z - 0.02); h.rotation.y = Math.PI; // real size (manifest metres, scale 1): no fit-to-slot
    const o = mergeByMaterial(g.scene); o.scale.setScalar(sign.scale || 1); o.traverse(m => { if (m.isMesh) m.material = new THREE.MeshStandardMaterial({ color: 0x120d0a, roughness: 1, metalness: 0 }); }); /* dark matte board near the alcove colour: the neon overlay carries the image */ const w = standUp(o); h.add(w); signSet.full = w; if (!low && sign.lod1) loader.load(url(sign.lod1), g1 => { const o1 = mergeByMaterial(g1.scene); o1.scale.setScalar(sign.scale || 1); o1.traverse(m => { if (m.isMesh) m.material = o.children[0]?.material || new THREE.MeshStandardMaterial({ color: 0x120d0a, roughness: 1 }); }); const w1 = standUp(o1); h.add(w1); signSet.lo = w1; applySignSet(); if (lowNow) scheduleMerge(0); }, undefined, () => {}); /* F5: lod1 board for VR */ hall.add(h);
    const sz = new THREE.Box3().setFromObject(w).getSize(new THREE.Vector3()); reliefSize = [sz.x, sz.y, sz.z].map(v => +v.toFixed(3)); console.info('HOPE relief size', reliefSize);
    if (neonE) loader.load(url(neonE.file), gn => buildNeon(gn.scene, o, h, sz), undefined, () => console.info('neon missing')); }, undefined, () => {});
}
loadBuilds();

// ---------- presets (mood) ----------
const PRESETS = {
  dusk: { hemi: 0.6, cove: 0.35, win: 2.5, pins: 1, exposure: 1.0 },
  night: { hemi: 0.25, cove: 0.22, win: 1.6, pins: 1, exposure: 1.05 },
  gallery: { hemi: 1.2, cove: 0.7, win: 3.0, pins: 0.8, exposure: 1.0 },
};
const DESK_EXP = 1.45, DESK_HEMI = 1.5; let presetNow = 'dusk'; // P2: brighter desktop default; XR keeps the preset as designed
function applyPreset(k) { const p = PRESETS[k]; if (!p) return; presetNow = k; const xr = renderer.xr.isPresenting; hemi.intensity = p.hemi * (xr ? 1 : DESK_HEMI); renderer.toneMappingExposure = p.exposure * (xr ? 1 : DESK_EXP); store.apply({ preset: k, brightness: p.cove }); }
store.subscribe(p => { if ('pins' in p || 'preset' in p) { const s = store.get(), f = (PRESETS[s.preset]?.pins ?? 1) * (s.pins ? 1 : 0); pins.forEach(o => o.s.intensity = o.I * f); }
  if ('labels' in p) ringMesh.visible = store.get().labels || renderer.xr.isPresenting; });

// ---------- panels (both reuse ../panel-*.js via an adapter over the single state) ----------
const CHIPS = ['#d9a066', '#e7dccb', '#b5655a', '#6f9a7d', '#6b7fa8', '#8c76a6'];
const api = {
  scenes: [...fx.scenes, 'solid'], presets: Object.keys(PRESETS), chips: CHIPS,
  setScene: id => store.apply({ scene: id, ...(id !== 'solid' ? { chip: -1 } : {}) }),
  setBrightness: b => store.apply({ brightness: b }),
  setSolidSRGB: (r, g, b, chip = -1) => store.apply({ scene: 'solid', chip, solid: [r, g, b].map(v => Math.pow(v / 255, 2.2)) }),
  setPreset: k => applyPreset(k), setTask: on => store.apply({ pins: on }), setLabels: on => store.apply({ labels: on }),
  get state() { const s = store.get(); return { scene: s.scene, brightness: s.brightness, preset: s.preset, task: s.pins, labels: s.labels, chip: s.chip }; },
};
const overlay = initOverlay(api, { N, P });
{ const el = document.getElementById('panel'); const b = el.querySelector('b'); if (b) b.textContent = 'Showroom'; const sm = el.querySelector('small'); if (sm) sm.textContent = '(design sizes)';
  const tl = [...el.querySelectorAll('label')].find(l => /Task lights/.test(l.textContent)); if (tl) tl.lastChild.textContent = ' Pin spots';
  const tl2 = [...el.querySelectorAll('label')].find(l => /Labels/.test(l.textContent)); if (tl2) tl2.lastChild.textContent = ' Floor rings'; // P1: it toggles the floor spot rings
  { const adv = document.createElement('details'); adv.innerHTML = '<summary><small>Advanced</small></summary>'; const r = el.querySelector('#cam')?.closest('.row'), pk = el.querySelector('#pick'); // P1: Camera/Photo pick under Advanced
    if (r) { el.insertBefore(adv, r); adv.append(r); if (pk) adv.append(pk); } }
  { const body = document.createElement('div'); body.id = 'panel-body'; body.style.cssText = 'display:none;flex-direction:column;gap:6px'; const head = el.querySelector('b'), sm0 = el.querySelector('small'); // P0-1: collapsible, starts collapsed
    [...el.childNodes].filter(n => n !== head && n !== sm0).forEach(n => body.append(n)); el.append(body); sm0?.remove();
    const tg = document.createElement('button'); tg.id = 'panel-toggle'; tg.textContent = '☰'; tg.title = 'Show controls'; tg.setAttribute('aria-expanded', 'false'); tg.style.cssText = 'padding:2px 8px;margin-left:8px';
    const hd = document.createElement('div'); hd.style.cssText = 'display:flex;align-items:center;justify-content:space-between'; el.prepend(hd); hd.append(head, tg);
    tg.onclick = () => { const open = body.style.display === 'none'; body.style.display = open ? 'flex' : 'none'; tg.textContent = open ? '✕' : '☰'; tg.title = open ? 'Hide controls' : 'Show controls'; tg.setAttribute('aria-expanded', String(open)); }; }
  const row = document.createElement('label'); row.innerHTML = `Go to <select id="go">${Object.keys(VIEWS).map(v => `<option>${v}</option>`).join('')}</select>`; const pb = el.querySelector('#panel-body'); pb.insertBefore(row, pb.firstChild);
  row.querySelector('select').onchange = e => setView(e.target.value); } // local camera only
const xrPanel = createXRPanel(THREE, renderer, scene, rig, api);
function placePanel() { // control panel lives in the pit, on the table edge, facing the host seat (back banquette)
  xrPanel.group.position.set(PIT.cx + 0.35, PIT_Y + 0.85, PIT.cz); xrPanel.group.lookAt(PIT.cx + 1.6, PIT_Y + 1.05, PIT.cz); }
placePanel(); xrPanel.onRecenter = () => { const xc = renderer.xr.getCamera(), p = new THREE.Vector3(), d = new THREE.Vector3(); xc.getWorldPosition(p); xc.getWorldDirection(d); d.y = 0; d.normalize();
  xrPanel.group.position.copy(p).addScaledVector(d, 0.8).setY(p.y - 0.25); xrPanel.group.lookAt(p.x, p.y - 0.25, p.z); };

// ---------- perf: low mode + static batching (B3 restorable) ----------
let lowNow = low, merged = null; // merged = { originals: [], batches: [] }
function staticMerge() {
  if (merged) unmerge();
  const skip = new Set([pixels, ledRibbon, bracketGroup, xrPanel.group, rig]);
  const rootOf = o => { for (let x = o; x; x = x.parent) if (ROOMS.includes(x)) return x; return null; };
  const visible = o => { for (let x = o; x && !ROOMS.includes(x); x = x.parent) { if (!x.visible || skip.has(x) || x.userData.avatar) return false; } return !!rootOf(o); }; // per-room: ignore the room group's own (culling) visibility
  for (const l of lodObjs) l.levels.forEach((v, k) => v.object.visible = k === l.levels.length - 1);
  scene.updateMatrixWorld(true); const groups = new Map();
  scene.traverse(o => { if (!o.isMesh || o.isInstancedMesh || Array.isArray(o.material) || !visible(o)) return; const m = o.material;
    if (m.transparent || m.isShaderMaterial || o.renderOrder || o.userData.noMerge) return;
    const g = o.geometry, attrs = Object.keys(g.attributes).filter(a => a !== 'color').sort().join(',');
    const plain = (m.isMeshStandardMaterial || m.isMeshLambertMaterial) && !m.map && !m.normalMap && !m.roughnessMap && !m.alphaMap && !m.emissiveMap;
    const root = rootOf(o), key = root.uuid + '|' + (plain ? 'vc' + m.side : m.uuid) + '|' + attrs + '|' + (g.index ? 1 : 0);
    if (!groups.has(key)) groups.set(key, { plain, mat: m, items: [], root }); groups.get(key).items.push(o); });
  const vcMats = [0, 1, 2].map(side => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, side }));
  merged = { originals: [], batches: [] };
  for (const G of groups.values()) { if (G.items.length < 2) continue;
    const inv = new THREE.Matrix4().copy(G.root.matrixWorld).invert(); const gs = G.items.map(o => { const g = o.geometry.clone(); g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld)); for (const a of Object.keys(g.attributes)) if (!['position', 'normal', 'uv', 'color'].includes(a)) g.deleteAttribute(a);
      if (G.plain) { const c = o.material.color, n = g.attributes.position.count, pv = g.attributes.color, arr = new Float32Array(n * 3);
        for (let i = 0; i < n; i++) { arr[i * 3] = c.r * (pv ? pv.getX(i) : 1); arr[i * 3 + 1] = c.g * (pv ? pv.getY(i) : 1); arr[i * 3 + 2] = c.b * (pv ? pv.getZ(i) : 1); }
        g.setAttribute('color', new THREE.BufferAttribute(arr, 3)); if (g.attributes.uv) g.deleteAttribute('uv'); } else if (g.attributes.color) g.deleteAttribute('color');
      return g; });
    let mg; try { mg = mergeGeometries(gs); } catch (e) { mg = null; } if (!mg) continue;
    const mesh = new THREE.Mesh(mg, G.plain ? vcMats[G.mat.side] : G.mat); mesh.userData.batch = true; G.root.add(mesh); merged.batches.push(mesh);
    G.items.forEach(o => { o.visible = false; merged.originals.push(o); }); } // hide, don't remove -> restorable
  console.info(`staticMerge: ${merged.originals.length} meshes -> ${merged.batches.length}`);
}
function unmerge() { if (!merged) return; merged.batches.forEach(m => { m.removeFromParent(); m.geometry.dispose(); }); merged.originals.forEach(o => o.visible = true); merged = null;
  for (const l of lodObjs) l.levels.forEach(v => v.object.visible = true); } // B3
let mergeT = 0; const scheduleMerge = (ms = 1200) => { clearTimeout(mergeT); mergeT = setTimeout(() => { if (lowNow) { staticMerge(); status(true); } }, ms); };
THREE.DefaultLoadingManager.onLoad = () => scheduleMerge(); THREE.DefaultLoadingManager.onProgress = () => scheduleMerge();
const PIX = Q.has('pixels'); // F3: desktop uses the LED ribbon too (90k tris saved); ?pixels brings back the per-pixel strip
function setLow(on) { const was = lowNow; lowNow = on; washSet[120].visible = !on; washSet[48].visible = on; applyCantSet(); pixels.visible = !on && PIX; ledRibbon.visible = on || !PIX; bracketGroup.visible = !on;
  ringMesh.visible = store.get().labels || renderer.xr.isPresenting;
  applySignSet(); if (on && !was) scheduleMerge(0); if (!on && was) unmerge(); applyNeonMode(); statusFrames = 2; } // B6: refresh status right after the transition
setLow(low); if (low) scheduleMerge(0);

// ---------- phone fallback: Look around (B1 heading, B2 permissions) ----------
const look = { on: false, a: null, b: null, g: null, yawOff: 0, dragX: null, aligned: false };
const lookBtn = document.createElement('button'); lookBtn.textContent = 'Look around';
lookBtn.style.cssText = 'position:fixed;bottom:44px;right:10px;padding:12px 20px;border:1px solid #fff;border-radius:6px;background:rgba(0,0,0,.6);color:#fff;font:14px system-ui;z-index:999;display:none';
document.body.appendChild(lookBtn);
(navigator.xr?.isSessionSupported?.('immersive-vr') ?? Promise.resolve(false)).catch(() => false).then(ok => { const touch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window; if (!ok && touch) lookBtn.style.display = 'block'; }); // P0-2: phones/tablets only
const onOri = e => { if (e.alpha == null) return; look.a = e.alpha; look.b = e.beta; look.g = e.gamma; };
function stopLook() { look.on = false; controls.enabled = !(walk && walk.on); lookBtn.textContent = 'Look around'; }
const SPAWN_EYE = () => { const s = SPAWNS[0]; return [s.x, 1.6, s.z]; };
lookBtn.addEventListener('click', async () => {
  if (look.on) { stopLook(); if (walk.on) walk.syncFromCamera(); else setView('vestibule'); return; }
  let res = 'granted';
  try { if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') res = await DeviceOrientationEvent.requestPermission(); } // iOS: inside the tap
  catch (err) { console.warn('orientation permission', err); res = 'error'; }
  if (res === 'denied') { lookBtn.textContent = 'Motion access denied'; return; } // B2: only an explicit 'denied' stops us; 'prompt'/'default'/errors still listen
  addEventListener('deviceorientation', onOri);
  look.on = true; look.aligned = false; look.a = null; controls.enabled = false; look.yawOff = 0; lookBtn.textContent = walk.on ? 'Stop gyro' : 'Back to orbit';
  if (!walk.on) camera.position.set(...SPAWN_EYE());
});
const _z = new THREE.Vector3(0, 0, 1), _e = new THREE.Euler(), _q0 = new THREE.Quaternion(), _q1 = new THREE.Quaternion(-Math.sqrt(0.5), 0, 0, Math.sqrt(0.5)), _qy = new THREE.Quaternion(), _f = new THREE.Vector3();
const SPAWN_YAW = Math.PI + SPAWNS[0].yaw; // camera yaw that faces +Z (into the room)
function applyLook() {
  if (!look.on) return; if (walk && walk.on) camera.position.set(walk.x, EYE, walk.z); else camera.position.set(...SPAWN_EYE());
  if (look.a == null) { camera.quaternion.setFromEuler(_e.set(0, SPAWN_YAW + look.yawOff, 0, 'YXZ')); return; }
  const D2R = Math.PI / 180, orient = (screen.orientation?.angle ?? window.orientation ?? 0) * D2R;
  _e.set(look.b * D2R, look.a * D2R, -look.g * D2R, 'YXZ');
  camera.quaternion.setFromEuler(_e).multiply(_q1).multiply(_q0.setFromAxisAngle(_z, -orient));
  if (!look.aligned) { // B1: first event -> offset so the current heading == spawn heading
    _f.set(0, 0, -1).applyQuaternion(camera.quaternion); const yawNow = Math.atan2(-_f.x, -_f.z); look.yawOff = SPAWN_YAW - yawNow; look.aligned = true; }
  camera.quaternion.premultiply(_qy.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, look.yawOff));
}

// ---------- walking: touch joystick + drag-look + tap-to-walk (touch devices); WASD on desktop. Local camera only. ----------
// Walkable area = union of rects already inset by the body radius (0.25 m), from layout.js; door connectors join rooms. No VR cost (DOM + math only).
const EYE = 1.6, WALK_V = 1.4, RAD = 0.25, IS_TOUCH = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
const WALK_RECTS = (() => { const r = RAD, w2 = PASSAGE.w / 2, [tx, tz] = PASSAGE.turn, ex = PASSAGE.exit[0], C = CANTINA, cx0 = C.origin[0], cz = C.origin[1];
  return [
    [VEST.x0 + r, VEST.x1 - r, VEST.z0 + r, VEST.z1 - r],                                      // vestibule
    [VEST.opening.x0 + r, VEST.opening.x1 - r, VEST.z1 - 0.5, HALL.z0 + 0.5],                  // vestibule -> hall opening
    [HALL.notch.x1 + r, HALL.x1 - r, HALL.z0 + r, HALL.z1 - r],                                // hall, front part (right of the notch)
    [HALL.x0 + r, HALL.x1 - r, HALL.notch.z1 + r, HALL.z1 - r],                                // hall, back part (full width)
    [tx - w2 + r, tx + w2 - r, HALL.z1 - 0.5, tz + w2 - r],                                    // hall door + passage leg A
    [tx - w2 + r, ex + 0.5, tz - w2 + r, tz + w2 - r],                                         // passage leg B -> cantina door
    [cx0 + r, cx0 + C.D - r, cz - C.W / 2 + r, cz + C.W / 2 - r],                              // cantina
  ]; })();
const walkable = (x, z) => WALK_RECTS.some(([x0, x1, z0, z1]) => x >= x0 && x <= x1 && z >= z0 && z <= z1);
walk = { on: IS_TOUCH && !Q.has('orbit'), x: 0, z: 0, yaw: 0, pitch: 0, joy: [0, 0], goal: null, keys: new Set(), last: performance.now(),
  syncFromCamera() { camera.updateMatrixWorld(); const f = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
    this.yaw = Math.atan2(-f.x, -f.z); this.pitch = Math.max(-1.2, Math.min(1.2, Math.asin(f.y))); this.goal = null;
    let x = camera.position.x, z = camera.position.z; if (!walkable(x, z)) { const s = SPAWNS[0]; x = s.x; z = s.z; } this.x = x; this.z = z; } };
const tryMove = (dx, dz) => { // slide along walls: full move, else per-axis
  if (walkable(walk.x + dx, walk.z + dz)) { walk.x += dx; walk.z += dz; return true; }
  let ok = false; if (dx && walkable(walk.x + dx, walk.z)) { walk.x += dx; ok = true; } if (dz && walkable(walk.x, walk.z + dz)) { walk.z += dz; ok = true; } return ok; };
const heading = () => { const f = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion); f.y = 0; if (f.lengthSq() < 1e-6) f.set(-Math.sin(walk.yaw), 0, -Math.cos(walk.yaw)); return f.normalize(); };
function walkUpdate() {
  const now = performance.now(), dt = Math.min(0.1, (now - walk.last) / 1000); walk.last = now;
  if (renderer.xr.isPresenting) return;
  let mx = walk.joy[0], mz = walk.joy[1]; // joystick: x = strafe right, y = forward
  const k = walk.keys; if (k.has('KeyW') || k.has('ArrowUp')) mz += 1; if (k.has('KeyS') || k.has('ArrowDown')) mz -= 1; if (k.has('KeyD') || k.has('ArrowRight')) mx += 1; if (k.has('KeyA') || k.has('ArrowLeft')) mx -= 1;
  const len = Math.hypot(mx, mz);
  if (len > 0.01) { walk.goal = null; if (!walk.on) { walk.syncFromCamera(); } // desktop WASD: move the orbit pivot with the camera
    const f = heading(), r = new THREE.Vector3(-f.z, 0, f.x), sc = Math.min(1, len) / len * WALK_V * dt; const dx = (f.x * mz + r.x * mx) * sc, dz = (f.z * mz + r.z * mx) * sc;
    const ox = walk.x, oz = walk.z; tryMove(dx, dz);
    if (!walk.on && !look.on) { camera.position.x += walk.x - ox; camera.position.z += walk.z - oz; controls.target.x += walk.x - ox; controls.target.z += walk.z - oz; } }
  if (walk.goal) { const g = walk.goal; g.t += dt / g.dur; const u = Math.min(1, g.t), e = u * u * (3 - 2 * u); // eased tap-to-walk
    const tx = g.x0 + (g.x1 - g.x0) * e, tz = g.z0 + (g.z1 - g.z0) * e; if (!tryMove(tx - walk.x, tz - walk.z) || u >= 1) walk.goal = null; }
  if (walk.on && !look.on) { camera.position.set(walk.x, EYE, walk.z); camera.quaternion.setFromEuler(_e.set(walk.pitch, walk.yaw, 0, 'YXZ')); }
  else if (walk.on && look.on) camera.position.set(walk.x, EYE, walk.z);
}
addEventListener('keydown', e => { if (e.target.closest?.('input,select,textarea')) return; if (/^(Key[WASD]|Arrow)/.test(e.code)) { walk.keys.add(e.code); e.preventDefault?.(); } });
addEventListener('keyup', e => walk.keys.delete(e.code)); addEventListener('blur', () => walk.keys.clear());
// touch: no pinch zoom / scroll on the canvas
renderer.domElement.style.touchAction = 'none'; document.body.style.overscrollBehavior = 'none';
// joystick (bottom-left; corner UI is top-left / bottom-right)
const joy = document.createElement('div'); joy.id = 'joystick'; const knob = document.createElement('div'); joy.append(knob);
joy.style.cssText = 'position:fixed;left:18px;bottom:18px;width:120px;height:120px;border-radius:50%;background:rgba(0,0,0,.28);border:1px solid rgba(255,255,255,.35);touch-action:none;z-index:6;display:none';
knob.style.cssText = 'position:absolute;left:35px;top:35px;width:50px;height:50px;border-radius:50%;background:rgba(255,255,255,.45);pointer-events:none';
document.body.append(joy); let joyId = null;
const joyMove = e => { const r = joy.getBoundingClientRect(), cx = r.left + 60, cy = r.top + 60; let dx = e.clientX - cx, dy = e.clientY - cy; const d = Math.hypot(dx, dy), m = 45; if (d > m) { dx *= m / d; dy *= m / d; }
  knob.style.transform = `translate(${dx}px,${dy}px)`; walk.joy = [dx / m, -dy / m]; };
joy.addEventListener('pointerdown', e => { joyId = e.pointerId; joy.setPointerCapture(e.pointerId); joyMove(e); e.preventDefault(); });
joy.addEventListener('pointermove', e => { if (e.pointerId === joyId) joyMove(e); });
const joyEnd = e => { if (e.pointerId !== joyId) return; joyId = null; walk.joy = [0, 0]; knob.style.transform = ''; }; joy.addEventListener('pointerup', joyEnd); joy.addEventListener('pointercancel', joyEnd);
// one-finger drag = look (adds to the gyro yaw when 'Look around' is on); short tap on the floor = walk there
const drag = { id: null, x: 0, y: 0, x0: 0, y0: 0, t0: 0 }, _ray = new THREE.Raycaster(), _floor = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), _hit = new THREE.Vector3();
renderer.domElement.addEventListener('pointerdown', e => { if (!(walk.on || look.on) || drag.id != null) return; Object.assign(drag, { id: e.pointerId, x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY, t0: performance.now() }); });
addEventListener('pointermove', e => { if (e.pointerId !== drag.id) return; const dx = e.clientX - drag.x, dy = e.clientY - drag.y; drag.x = e.clientX; drag.y = e.clientY;
  if (look.on) look.yawOff += dx * 0.005; else if (walk.on) { walk.yaw += dx * 0.005; walk.pitch = Math.max(-1.2, Math.min(1.2, walk.pitch + dy * 0.004)); } });
addEventListener('pointerup', e => { if (e.pointerId !== drag.id) return; drag.id = null;
  if (!walk.on || Math.hypot(e.clientX - drag.x0, e.clientY - drag.y0) > 10 || performance.now() - drag.t0 > 600) return;
  _ray.setFromCamera(new THREE.Vector2(e.clientX / innerWidth * 2 - 1, -(e.clientY / innerHeight) * 2 + 1), camera);
  if (!_ray.ray.intersectPlane(_floor, _hit) || !walkable(_hit.x, _hit.z)) return; const d = Math.hypot(_hit.x - walk.x, _hit.z - walk.z); if (d < 0.2 || d > 15) return;
  walk.goal = { x0: walk.x, z0: walk.z, x1: _hit.x, z1: _hit.z, t: 0, dur: Math.max(0.5, d / WALK_V) }; });
addEventListener('pointercancel', e => { if (e.pointerId === drag.id) drag.id = null; });
function setWalk(on) { walk.on = on; joy.style.display = on && IS_TOUCH ? 'block' : 'none'; controls.enabled = !on && !look.on; if (on) walk.syncFromCamera(); }
renderer.xr.addEventListener('sessionstart', () => { joy.style.display = 'none'; walk.joy = [0, 0]; walk.goal = null; });
renderer.xr.addEventListener('sessionend', () => setWalk(walk.on));


// ---------- ?testroom: 4 dummy avatars at spawns 1-4 (tagged 'avatar', never merged) to measure headroom ----------
if (TESTROOM) { const g = mergeGeometries([new THREE.CapsuleGeometry(0.18, 0.9, 4, 10).translate(0, 0.9, 0), new THREE.SphereGeometry(0.13, 12, 8).translate(0, 1.62, 0)]);
  const am = new THREE.MeshStandardMaterial({ color: 0x8fb7c9, roughness: 0.4 });
  for (let i = 1; i < MAX_USERS; i++) { const s = SPAWNS[i], a = new THREE.Mesh(g, am); a.position.set(s.x, 0, s.z); a.userData.avatar = true; a.userData.peerId = 'test-' + i; scene.add(a); } }

// ---------- status ----------
function status(force) { if (force) statusFrames = 1; }
function writeStatus() { overlay.status(`N=${N} px · cove ${P.toFixed(2)} m · u window ${U.window[0].toFixed(3)}–${U.window[1].toFixed(3)} · u builds ${U.builds[0].toFixed(3)}–${U.builds[1].toFixed(3)} · brackets ${brackets.length} (${bracketStatus}) · builds ${buildsInfo} · props ${propTris} tris · room ${roomNow} · cantina ${cantInfo} · draws ${drawCalls}${lowNow ? ' · LOW' : ''}${TESTROOM ? ' · TESTROOM' : ''}`); }

window.LOFT = { scene, renderer, rig, camera, controls, setLow: on => setLow(on), get lodObjs() { return lodObjs; }, rooms: { hall, passage, cantina }, get room() { return roomNow; }, get ledStrip() { return ledStrip; }, N, perimeter: P, U, store, api, setView, spawns: SPAWNS, groupSpots: GROUP_SPOTS, MAX_USERS, net,
  get lowNow() { return lowNow; }, get reliefSize() { return reliefSize; }, get drawCalls() { return drawCalls; }, layout: { HALL, VEST, COVE, BW, GATHER, PIT, WINDOW, NOOK, PLINTHS } };
applyPreset('dusk'); setView('hall'); setWalk(walk.on); if (!walk.on) walk.syncFromCamera(); window.LOFT.walk = walk; window.LOFT.walkable = walkable;

// P2: the TV iframe is a plain fixed-position element warped onto the screen's projected corners (matrix3d homography), so it sits above the canvas
// only over the screen rect and receives clicks (CSS3DRenderer's perspective tree did not hit-test). Hidden in XR (no DOM) -> atlas snapshot shows.
let tvCss = null; const tvCorners = [[-1, 1], [1, 1], [1, -1], [-1, -1]].map(([sx, sy]) => new THREE.Vector3(-sx * TV.w / 2, sy * TV.h / 2, 0)); // TL, TR, BR, BL as seen from the room (screen faces -Z local)
if (!Q.has('notv')) { const f = document.createElement('iframe'); f.dataset.src = TV.url; f.title = 'Bombshell Discovery'; f.id = 'tv-frame';
  Object.assign(f.style, { position: 'fixed', left: '0', top: '0', width: '1280px', height: '720px', border: '0', background: '#000', transformOrigin: '0 0', zIndex: '2', display: 'none' });
  f.setAttribute('referrerpolicy', 'no-referrer'); f.setAttribute('sandbox', 'allow-scripts allow-popups allow-forms'); document.body.appendChild(f);
  const anchor = new THREE.Object3D(); anchor.position.set(...TV.pos); cantina.add(anchor); tvCss = { element: f, anchor }; }
const _tv = new THREE.Vector3();
function homography(src, dst) { // 4-point projective map -> CSS matrix3d (column-major)
  const A = [], b = []; for (let i = 0; i < 4; i++) { const [x, y] = src[i], [u, v] = dst[i]; A.push([x, y, 1, 0, 0, 0, -u * x, -u * y]); b.push(u); A.push([0, 0, 0, x, y, 1, -v * x, -v * y]); b.push(v); }
  for (let c = 0; c < 8; c++) { let piv = c; for (let r = c + 1; r < 8; r++) if (Math.abs(A[r][c]) > Math.abs(A[piv][c])) piv = r; [A[c], A[piv]] = [A[piv], A[c]]; [b[c], b[piv]] = [b[piv], b[c]];
    for (let r = 0; r < 8; r++) if (r !== c) { const k = A[r][c] / A[c][c]; for (let q = c; q < 8; q++) A[r][q] -= k * A[c][q]; b[r] -= k * b[c]; } }
  const h = b.map((v, i) => v / A[i][i]); return [h[0], h[3], 0, h[6], h[1], h[4], 0, h[7], 0, 0, 1, 0, h[2], h[5], 0, 1]; }
function updateTV() { if (!tvCss) return; const f = tvCss.element, on = !renderer.xr.isPresenting && cantina.visible;
  if (!on) { f.style.display = 'none'; return; } tvCss.anchor.updateMatrixWorld(); const pts = [];
  for (const c of tvCorners) { _tv.copy(c).applyMatrix4(tvCss.anchor.matrixWorld); const vz = _tv.clone().applyMatrix4(camera.matrixWorldInverse).z; if (vz > -0.05) { f.style.display = 'none'; return; }
    _tv.project(camera); pts.push([(_tv.x + 1) / 2 * innerWidth, (1 - _tv.y) / 2 * innerHeight]); }
  if (!f.src) f.src = f.dataset.src; f.style.display = 'block'; f.style.transform = `matrix3d(${homography([[0, 0], [1280, 0], [1280, 720], [0, 720]], pts).join(',')})`; }
window.LOFT.tv = { url: TV.url, get frame() { return tvCss?.element; } };
// ---------- loop ----------
const avg = new Float32Array(3); let frame = 0;
renderer.setAnimationLoop(() => {
  const t = clock.getElapsedTime(); walkUpdate(); applyLook();
  if (!renderer.xr.isPresenting && !look.on && !walk.on) controls.update();
  engineRender(t);
  const d = tex.image.data, step = N / TW; avg.fill(0); let wn = 0; const i0 = Math.floor(U.window[0] * N), i1 = Math.floor(U.window[1] * N);
  for (let x = 0; x < TW; x++) { const i = Math.floor(x * step) * 3; d[x * 4] = Math.min(255, colors[i] * 255); d[x * 4 + 1] = Math.min(255, colors[i + 1] * 255); d[x * 4 + 2] = Math.min(255, colors[i + 2] * 255); d[x * 4 + 3] = 255; }
  for (let i = i0; i < i1; i += 8) { avg[0] += colors[i * 3]; avg[1] += colors[i * 3 + 1]; avg[2] += colors[i * 3 + 2]; wn++; }
  tex.needsUpdate = true; winMat.uniforms.time.value = t;
  if (pixels.visible) { for (let i = 0; i < N; i++) pixels.instanceColor.setXYZ(i, Math.min(1, colors[i * 3] * 3), Math.min(1, colors[i * 3 + 1] * 3), Math.min(1, colors[i * 3 + 2] * 3)); pixels.instanceColor.needsUpdate = true; }
  if (wn) { const s = 1 / wn; winLight.color.setRGB(Math.min(1, avg[0] * s * 2.2), Math.min(1, avg[1] * s * 2.2), Math.min(1, avg[2] * s * 2.2)); } // window lights the room in its own colours
  for (const l of lodObjs) if (!lowNow) l.update(camera);
  cull(); xrPanel.group.visible = (renderer.xr.isPresenting || window.LOFT.showPanel === true) && hall.visible; xrPanel.update();
  ledStripUpdate();
  renderer.render(scene, camera);
  updateTV();
  drawCalls = renderer.info.render.calls;
  if (statusFrames > 0 && --statusFrames === 0) writeStatus(); else if (++frame % 60 === 0) writeStatus();
});
console.info('showroom', { N, perimeter: P, U });
