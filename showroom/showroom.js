// Showroom XR (Mira SHOWROOM_SPEC v1). Static three.js r170, no build step. Old loft stays at ../ (also ?loft redirects there).
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { VRButton } from 'three/addons/webxr/VRButton.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { HALL, VEST, COVE, BUILDS_WALL as BW, GATHER, PIT, WINDOW, NOOK, PLINTHS, SPAWNS, GROUP_SPOTS, MAX_USERS, coveSegments, covePerimeter, DOOR, PASSAGE, CANTINA, toCantinaWorld, roomLabel } from './layout.js';
import { buildPassage, buildCantina, uOwlLift } from './cantina.js';
import { createGuestbook, LocalGuestbookStore } from './guestbook.js';
import { createRobotBatch, createBartender } from './bartender.js';
import { createDJBooth } from './dj.js';
import { loadRigged } from './rigged.js';
import { createDexSet, dexTargetsFromJoints, DEX_TARGETS } from './dex-set.js';
import { DJ_CONFIG } from './dj-config.js';
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
var walk = null; const IS_TOUCH_UI = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window; // touch/desktop walking (set up below the gyro code)
function setView(n) { const v = VIEWS[n]; if (!v) return; cullOverride = n === 'plan' ? 'all' : null; look.on && stopLook(); camera.position.set(...v.p); controls.target.set(...v.t); controls.update(); if (walk && walk.on) walk.syncFromCamera();
  if (ceilingGroup) ceilingGroup.visible = n !== 'plan'; }
function spawnRig(i = 0) { const s = SPAWNS[i % SPAWNS.length]; rig.position.set(s.x, 0, s.z); rig.rotation.y = Math.PI + s.yaw; } // XR camera looks -Z; spawn faces +Z
renderer.xr.addEventListener('sessionstart', () => { spawnRig(0); setLow(true); placePanel(); applyPreset(presetNow); });
renderer.xr.addEventListener('sessionend', () => { rig.position.set(0, 0, 0); rig.rotation.y = 0; setLow(low); applyPreset(presetNow); setView('hall'); setWalk(walk.on); resetXRLoco(); }); // N2/N3: the only exit handler (also clears vignette / teleport marker / aim): desktop spawn + walk/joystick restore

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
let coveHook = null; // DJ light show: tints the CoveScenes output (CoveScenes has no arbitrary-colour API; cove-scenes.js untouched)
function engineRender(t) { const s = store.get();
  if (s.scene === 'solid' && s.solid) { for (let i = 0; i < N; i++) { colors[i * 3] = s.solid[0]; colors[i * 3 + 1] = s.solid[1]; colors[i * 3 + 2] = s.solid[2]; } }
  else fx.render(t, colors, {});
  coveHook?.(colors, N);
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
const shelf = new THREE.Group(); hall.add(shelf); const buildHolders = []; // grab/inspect registry (one per shelf slot)
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
  [/containers_D/, [-3.4, 0, 5.4], 0], [/prop_lights/, [3.6, 0, 2.0], 0], // fallback only: showroom image of Clay (-3.6, 0, 2.0); manifest placement wins
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
  entries.forEach((e, i) => { const s = scenes[i]; if (!s) return; const P = CANT_PLACE.find(([re]) => re.test(e.file)); s.scale.setScalar(e.scale || 1);
    const spots = Array.isArray(e.instances) && e.instances.length ? e.instances : [null]; // lantern: 3 manifest instances, one model (z 1.8/3.0/4.2, rot 0/25/50)
    spots.forEach(spot => { const node = spots.length > 1 ? s.clone(true) : s; const w = new THREE.Group(); w.add(node);
      const mp = (spot && Array.isArray(spot.pos) ? spot : null) || (e.placement && Array.isArray(e.placement.pos) ? e.placement : null); // Clay's manifest placement wins (door origin, +Z in); mirror X so the bar is on the LEFT
      if (mp) { w.position.set(-mp.pos[0], mp.pos[1] || 0, mp.pos[2]); w.rotation.y = -THREE.MathUtils.degToRad(mp.rot_y_deg || 0); } // back bar / sign: front +Z -> rot -90 faces -X, into the room. Sign manifest (-3.25, 2.05, 4.3) rot 90
      else if (P) { w.position.set(...P[1]); w.rotation.y = P[2]; } else { const k = fallback++; w.position.set(k % 2 ? -3.3 : 3.3, 0, 1.2 + (k >> 1) * 0.8); w.rotation.y = k % 2 ? Math.PI / 2 : -Math.PI / 2; }
      w.userData.file = e.file; tmp.add(w); }); });
  tmp.updateMatrixWorld(true); const inv = new THREE.Matrix4().copy(tmp.matrixWorld).invert();
  const groups = new Map(); // material name -> { mat, geoms }
  const barLip = []; const barLipCol = new THREE.Color('#e8a04a'); // cantina_bar atlas lip -> existing amber batch (lod0 and lod1 both build here)
  tmp.traverse(m => { if (!m.isMesh) return; let file = ''; for (let p = m; p && p !== tmp; p = p.parent) if (p.userData.file) { file = p.userData.file; break; }
    for (const [gi, mat] of (Array.isArray(m.material) ? m.material : [m.material]).entries()) {
    // bar front edge only (node still named glow_teal; material cantina_glow_edge_*). Not the ent-center led_strip, not the hall.
    if (/^cantina_bar/.test(file) && /glow_teal|glow_edge/i.test((m.name || '') + ' ' + (mat.name || ''))) { mat.color?.set('#e8a04a'); mat.emissive?.set('#e8a04a'); mat.map = mat.emissiveMap = null; mat.vertexColors = false; mat.userData.flatVc = 1; if (!Array.isArray(m.material)) m.geometry.deleteAttribute('color'); }
    let g = m.geometry.clone(); if (Array.isArray(m.material)) { const gr = g.groups[gi]; g = g.index ? g.toNonIndexed() : g; const s = gr ? gr.start : 0, c = gr ? gr.count : g.attributes.position.count; const ng = new THREE.BufferGeometry(); for (const [k, a] of Object.entries(g.attributes)) ng.setAttribute(k, new THREE.BufferAttribute(a.array.slice(s * a.itemSize, (s + c) * a.itemSize), a.itemSize)); g = ng; }
    // Front lip is atlas texels, not a glow material: every UV u in [0.975, 1.0]. Split before the world matrix.
    if (/^cantina_bar/.test(file) && g.attributes.position && g.attributes.uv) {
      const src = g.index ? g.toNonIndexed() : g, pos = src.attributes.position, uv = src.attributes.uv, keepI = [], lipI = [];
      for (let i = 0; i + 2 < pos.count; i += 3) { let lip = true; for (let k = 0; k < 3 && lip; k++) { const u = uv.getX(i + k); if (!(u >= 0.975 && u <= 1.0)) lip = false; } (lip ? lipI : keepI).push(i, i + 1, i + 2); }
      if (lipI.length) { const pick = idx => { const ng = new THREE.BufferGeometry(); for (const [k, a] of Object.entries(src.attributes)) { const arr = new a.array.constructor(idx.length * a.itemSize); for (let j = 0; j < idx.length; j++) arr.set(a.array.subarray(idx[j] * a.itemSize, (idx[j] + 1) * a.itemSize), j * a.itemSize); ng.setAttribute(k, new THREE.BufferAttribute(arr, a.itemSize)); } return ng; };
        const lipG = pick(lipI); lipG.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, m.matrixWorld)); for (const k of Object.keys(lipG.attributes)) if (k !== 'position' && k !== 'normal') lipG.deleteAttribute(k); if (!lipG.attributes.normal) lipG.computeVertexNormals();
        const ncol = lipG.attributes.position.count, cc = new Float32Array(ncol * 3); for (let i = 0; i < ncol; i++) { cc[i * 3] = barLipCol.r; cc[i * 3 + 1] = barLipCol.g; cc[i * 3 + 2] = barLipCol.b; } lipG.setAttribute('color', new THREE.BufferAttribute(cc, 3)); barLip.push(lipG);
        if (!keepI.length) continue; g = pick(keepI); } }
    g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, m.matrixWorld)); if (g.index) g = g.toNonIndexed();
    const keepN = /owlcove_(neon|glow)_amber/.test(mat.name || ''); // amber stays a plain mesh (normals kept) so XR staticMerge can fold it
    for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'uv' && !(keepN && k === 'normal')) g.deleteAttribute(k);
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    const key = /led_strip/i.test(mat.name + ' ' + m.name) ? 'led_strip' : (mat.name || mat.uuid); if (!groups.has(key)) groups.set(key, { mat, geoms: [] }); groups.get(key).geoms.push(g); } });
  cantina.remove(tmp);
  const out = new THREE.Group(); out.name = useLod ? 'cantina-clay-lod1' : 'cantina-clay'; let tris = 0;
  // owlcove_neon_amber + owlcove_glow_amber: one unlit mesh (vertex colour), not the tone-mapped clay atlas. Sign + lantern atlas share owlcove_props_atlas and stay in groups so they pack into clay-atlas.
  const amberGeoms = [];
  for (const [key, G] of [...groups]) if (/owlcove_(neon|glow)_amber/.test(key)) {
    const src = (G.mat.emissive && G.mat.emissive.getHex()) ? G.mat.emissive : (G.mat.color || new THREE.Color(1, 0.52, 0.16));
    const col = src.clone().multiplyScalar(G.mat.emissiveIntensity > 0 ? G.mat.emissiveIntensity : 1);
    for (const g of G.geoms) { if (g.attributes.uv) g.deleteAttribute('uv'); if (!g.attributes.normal) g.computeVertexNormals(); const n = g.attributes.position.count, cc = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) { cc[i * 3] = col.r; cc[i * 3 + 1] = col.g; cc[i * 3 + 2] = col.b; } g.setAttribute('color', new THREE.BufferAttribute(cc, 3)); amberGeoms.push(g); }
    groups.delete(key); }
  if (barLip.length) amberGeoms.push(...barLip); // same unlit mesh, no extra draw
  // runtime atlas: every baked texture -> one 2048 canvas (4x4 grid of 512 cells, big maps get 2x2 blocks, one white cell for the untextured glows) => 1 draw (+ led_strip)
  for (const [, G] of groups) if (G.mat.map) { const t = G.mat.map; t.updateMatrix(); if (!t.matrix.equals(new THREE.Matrix3())) for (const g of G.geoms) { const uv = g.attributes.uv, v = new THREE.Vector2(); for (let i = 0; i < uv.count; i++) { v.fromBufferAttribute(uv, i).applyMatrix3(t.matrix); uv.setXY(i, v.x, v.y); } } } // bake KHR_texture_transform
  const inUnit = geoms => geoms.every(g => { const a = g.attributes.uv.array; for (let i = 0; i < a.length; i++) if (a[i] < -0.002 || a[i] > 1.002) return false; return true; });
  const texs = [], solo = [];
  for (const [key, G] of groups) { if (key === 'led_strip') { solo.push([key, G]); continue; } if (G.mat.map && !inUnit(G.geoms)) { if (/owlcove_props_atlas/.test(key)) { for (const g of G.geoms) { const a = g.attributes.uv; for (let i = 0; i < a.count; i++) a.setXY(i, Math.min(1, Math.max(0, a.getX(i))), Math.min(1, Math.max(0, a.getY(i)))); } } else { solo.push([key, G]); continue; } } if (G.mat.map && !texs.includes(G.mat.map)) texs.push(G.mat.map); }
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
  if (amberGeoms.length) { let mg = null; try { mg = amberGeoms.length > 1 ? mergeGeometries(amberGeoms) : amberGeoms[0]; } catch (e) { mg = null; }
    const addAmber = g => { const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: 0xffffff, vertexColors: true, toneMapped: false })); m.name = 'owlcove-amber'; out.add(m); return m; };
    if (mg) { tris += mg.attributes.position.count / 3; addAmber(mg); } else amberGeoms.forEach(g => { tris += g.attributes.position.count / 3; addAmber(g); }); } // no noMerge: XR staticMerge folds these into the cantina unlit batch
  out.userData.atlas = `${slot.size} maps packed, ${solo.length} solo`;
  out.userData.tris = tris; out.userData.draws = out.children.length; out.traverse(o => { if (o.name !== 'owlcove-amber') o.userData.noMerge = true; }); return out;
}
async function loadCantinaPieces(entries, base) {
  entries = entries.filter(e => e.file); if (!entries.length) return;
  const sig = JSON.stringify(entries.map(e => [e.file, e.lod1, e.date, e.bytes])); if (sig === cantSig) return; cantSig = sig;
  const [full, lod] = await Promise.all([buildCantSet(entries, base, false), buildCantSet(entries, base, true)]);
  for (const k of ['full', 'lod1']) if (cantSets[k]) cantina.remove(cantSets[k]);
  cantSets.full = full; cantSets.lod1 = lod; cantina.add(full, lod);
  ledStrip = null; hookLedStrip(full); hookLedStrip(lod); cant.hidePlaceholders?.(); applyCantSet(); placeOnBar?.();
  cantInfo = `clay ${entries.length} files · ${full.userData.draws}/${lod.userData.draws} draws · ${Math.round(full.userData.tris)}/${Math.round(lod.userData.tris)} tris`;
  window.LOFT && (window.LOFT.cantSets = cantSets); status(true); if (lowNow) scheduleMerge(0); // pieces land after the loader's onLoad timer; rebatch so the amber mesh joins the unlit draw
}
var riggedResolve = null; const riggedEntries = new Promise(r => { riggedResolve = r; }); var rigLod = null; // Clay's rigged cantina models (manifest rigged[], room cantina_rigged)
async function loadBuilds() {
  let list = [], base = ASSETS + 'builds/', cantExtra = [];
  for (const dir of [ASSETS + 'builds-opt/', ASSETS + 'builds/']) { try { const r = await fetch(dir + 'manifest.json', { cache: 'no-store' }); if (r.ok) { const j = await r.json(); list = Array.isArray(j) ? j : (j.builds || j.items || []); base = dir;
    if (!Array.isArray(j)) {
      const owl = Array.isArray(j.owlcove) ? j.owlcove : [];
      cantExtra = (j.skipped || []).filter(e => e.room === 'cantina' && e.file); // sign + lantern are ready: load them (owlcove[] and/or skipped[])
      const have = new Set(cantExtra.map(e => e.file));
      for (const e of owl) if (e.room === 'cantina' && e.file && /owlcove_neon_sign|owlcove_lantern/.test(e.file) && !have.has(e.file)) cantExtra.push(e);
      const owlBooth = owl.find(e => /owlcove_dj_booth/.test(e.file || ''));
      if (Array.isArray(j.rigged)) { let rig = j.rigged.filter(e => e.room === 'cantina_rigged' && !(owlBooth && /dj_booth/.test(e.file || ''))); if (owlBooth) rig = [owlBooth, ...rig]; riggedResolve({ list: rig, base: dir }); }
    }
    if (list.length) break; } } catch (e) {} }
  const isHope = e => /hope/i.test((e.file || '') + (e.name || '')); const isCant = e => e.room === 'cantina' || /entertain|ent[_-]?center|led[_-]?strip|cantina/i.test((e.file || '') + ' ' + (e.name || ''));
  loadCantinaPieces([...list.filter(isCant), ...cantExtra], base); list = list.filter(e => !isCant(e));
  const neonE = list.find(e => e.overlay_of || /neon/i.test(e.file || '')); list = list.filter(e => e !== neonE); const sign = list.find(isHope), items = list.filter(e => !isHope(e));
  const url = f => base + f.replace(/^assets\/builds(-opt)?\//, '');
  let loaded = 0;
  const fit = (o0, e, maxW, maxH, maxD) => { const o = mergeByMaterial(o0); o.scale.setScalar(e.scale || 1); const s = new THREE.Box3().setFromObject(o).getSize(new THREE.Vector3());
    const thin = s.y < 0.03, hgt = thin ? s.z : s.y, dep = thin ? s.y : s.z; o.scale.multiplyScalar(Math.min(2.5, maxW / Math.max(s.x, 1e-6), maxH / Math.max(hgt, 1e-6), maxD / Math.max(dep, 1e-6))); return standUp(o); };
  items.slice(0, slots.length).forEach((e, i) => { const holder = new THREE.Group(); holder.position.set(...slots[i]); holder.rotation.y = Math.PI; shelf.add(holder); holder.name = 'build:' + (e.file || i); buildHolders.push({ holder, e, slot: i });
    const file = e.file; if (!file) return; const lf = e.lod1 || null;
    loader.load(url(low && lf ? lf : file), g => {
      if (!low && lf) { const lod = new THREE.LOD(); lod.autoUpdate = !lowNow; lod.addLevel(fit(g.scene, e, 0.6, 0.42, 0.26), 0); holder.add(lod); lodObjs.push(lod);
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
// comfort settings (VR): persisted; defaults = previous behaviour (snap 30, vignette on, smooth move, right-handed)
const COMFORT_KEY = 'ff-comfort', COMFORT_OPTS = { turn: ['snap30', 'snap45', 'smooth'], vignette: [true, false], move: ['smooth', 'teleport'], lefty: [false, true] };
const comfort = (() => { let c = { turn: 'snap30', vignette: true, move: 'smooth', lefty: false }; try { Object.assign(c, JSON.parse(localStorage.getItem(COMFORT_KEY) || '{}')); } catch (e) {}
  for (const k of Object.keys(COMFORT_OPTS)) if (!COMFORT_OPTS[k].includes(c[k])) c[k] = COMFORT_OPTS[k][0]; if (Q.has('lefty')) c.lefty = true; return c; })();
const comfortApi = { get: () => ({ ...comfort }), set(k, v) { if (!COMFORT_OPTS[k]?.includes(v)) return; comfort[k] = v; try { localStorage.setItem(COMFORT_KEY, JSON.stringify(comfort)); } catch (e) {} syncComfortUI?.(); },
  cycle(k) { const o = COMFORT_OPTS[k]; this.set(k, o[(o.indexOf(comfort[k]) + 1) % o.length]); } };
var syncComfortUI = null;
const api = {
  comfort: comfortApi,
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
  const row = document.createElement('label'); row.innerHTML = `Go to <select id="go">${Object.keys(VIEWS).map(v => `<option value="${v}">${roomLabel(v)}</option>`).join('')}</select>`; const pb = el.querySelector('#panel-body'); pb.insertBefore(row, pb.firstChild); const help = document.createElement('small'); help.id = 'panel-help'; help.style.opacity = '.75'; help.textContent = IS_TOUCH_UI ? 'Stick: walk · drag: look · tap floor: walk there' : 'Drag: orbit · WASD / arrows: walk'; pb.append(help);
  { const d = document.createElement('details'); d.id = 'comfort'; d.innerHTML = `<summary><small>Comfort (VR)</small></summary>
    <label>Turn <select id="cf-turn"><option value="snap30">snap 30°</option><option value="snap45">snap 45°</option><option value="smooth">smooth</option></select></label>
    <label>Move <select id="cf-move"><option value="smooth">smooth</option><option value="teleport">teleport only</option></select></label>
    <label><input id="cf-vig" type="checkbox"> Vignette</label> <label><input id="cf-lefty" type="checkbox"> Swap hands</label>`;
    pb.insertBefore(d, help); const $ = id => d.querySelector('#' + id);
    $('cf-turn').onchange = e => comfortApi.set('turn', e.target.value); $('cf-move').onchange = e => comfortApi.set('move', e.target.value);
    $('cf-vig').onchange = e => comfortApi.set('vignette', e.target.checked); $('cf-lefty').onchange = e => comfortApi.set('lefty', e.target.checked);
    syncComfortUI = () => { $('cf-turn').value = comfort.turn; $('cf-move').value = comfort.move; $('cf-vig').checked = comfort.vignette; $('cf-lefty').checked = comfort.lefty; }; syncComfortUI(); }
  row.querySelector('select').onchange = e => setView(e.target.value); } // local camera only
const xrPanel = createXRPanel(THREE, renderer, scene, rig, api);
function placePanel() { // control panel lives in the pit, on the table edge, facing the host seat (back banquette)
  xrPanel.group.position.set(PIT.cx + 0.35, PIT_Y + 0.85, PIT.cz); xrPanel.group.lookAt(PIT.cx + 1.6, PIT_Y + 1.05, PIT.cz); }
placePanel(); xrPanel.onRecenter = () => { const xc = renderer.xr.getCamera(), p = new THREE.Vector3(), d = new THREE.Vector3(); xc.getWorldPosition(p); xc.getWorldDirection(d); d.y = 0; d.normalize();
  xrPanel.group.position.copy(p).addScaledVector(d, 0.8).setY(p.y - 0.25); xrPanel.group.lookAt(p.x, p.y - 0.25, p.z); };

// ---------- perf: low mode + static batching (B3 restorable) ----------
const mergeSlots = new Map(); let lowNow = low, merged = null; // merged = { originals: [], batches: [] }
function staticMerge() {
  if (merged) unmerge();
  const skip = new Set([pixels, ledRibbon, bracketGroup, xrPanel.group, rig]);
  const rootOf = o => { for (let x = o; x; x = x.parent) if (ROOMS.includes(x)) return x; return null; };
  const visible = o => { for (let x = o; x && !ROOMS.includes(x); x = x.parent) { if (!x.visible || skip.has(x) || x.userData.avatar) return false; } return !!rootOf(o); }; // per-room: ignore the room group's own (culling) visibility
  for (const l of lodObjs) l.levels.forEach((v, k) => v.object.visible = k === l.levels.length - 1);
  scene.updateMatrixWorld(true); const groups = new Map();
  scene.traverse(o => { if (!o.isMesh || o.isInstancedMesh || Array.isArray(o.material) || !visible(o)) return; const m = o.material;
    if (m.transparent || m.isShaderMaterial || o.renderOrder || o.userData.noMerge) return;
    const g = o.geometry;
    const plainB = m.isMeshBasicMaterial && !m.map && !m.alphaMap && !m.vertexAlphas; // unlit glow strips: one vertex-colour basic batch per room
    const plain = plainB || ((m.isMeshStandardMaterial || m.isMeshLambertMaterial) && !m.map && !m.normalMap && !m.alphaMap && !m.emissiveMap); /* low/XR merge drops roughnessMap (plaster grain): walls + vault share one batch */
    const attrs = Object.keys(g.attributes).filter(a => a !== 'color' && !(plain && a === 'uv')).sort().join(','); // plain batches drop uv, and mix indexed/non-indexed (see below) -> fewer batches
    const root = rootOf(o), side = plain && !plainB && m.side === THREE.FrontSide && (root === cantina || root === passage) ? THREE.DoubleSide : m.side; // cantina + passage: front-side and double-side plain batches share one DoubleSide draw (XR budget: -2 stereo draws per room)
    const key = root.uuid + '|' + (plainB ? 'vb' + m.side + (m.toneMapped ? 't' : 'n') : plain ? 'vc' + side : m.uuid) + '|' + attrs + '|' + (plain ? 'x' : g.index ? 1 : 0);
    if (!groups.has(key)) groups.set(key, { plain, plainB, mat: m, side, items: [], root }); groups.get(key).items.push(o); });
  const vcMats = [0, 1, 2].map(side => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, side }));
  const owlMats = []; // cantina root only: per-side vcMats clone + vColor*uOwlLift. hall/passage keep vcMats (no extra draws)
  const owlMat = side => owlMats[side] ||= Object.assign(vcMats[side].clone(), { customProgramCacheKey: () => 'owlLift', onBeforeCompile: sh => { sh.uniforms.uOwlLift = uOwlLift; sh.fragmentShader = 'uniform float uOwlLift;\n' + sh.fragmentShader.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += max(vColor.rgb, vec3(0.06, 0.045, 0.035)) * uOwlLift;'); } });
  merged = { originals: [], batches: [] };
  for (const G of groups.values()) { if (G.items.length < 2) continue;
    const inv = new THREE.Matrix4().copy(G.root.matrixWorld).invert(); const mixed = G.plain && new Set(G.items.map(o => !!o.geometry.index)).size > 1; const gs = G.items.map(o => { const g = mixed && o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone(); g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld)); for (const a of Object.keys(g.attributes)) if (!['position', 'normal', 'uv', 'color'].includes(a)) g.deleteAttribute(a);
      if (G.plain) { const c = o.material.color, n = g.attributes.position.count, pv = o.material.userData.flatVc ? null : g.attributes.color, arr = new Float32Array(n * 3); // flatVc: bar edge amber must not be multiplied by leftover teal vertex colour. Hall has no flatVc.
        for (let i = 0; i < n; i++) { arr[i * 3] = c.r * (pv ? pv.getX(i) : 1); arr[i * 3 + 1] = c.g * (pv ? pv.getY(i) : 1); arr[i * 3 + 2] = c.b * (pv ? pv.getZ(i) : 1); }
        g.setAttribute('color', new THREE.BufferAttribute(arr, 3)); if (g.attributes.uv) g.deleteAttribute('uv'); } else if (g.attributes.color) g.deleteAttribute('color');
      return g; });
    let mg; try { mg = mergeGeometries(gs); } catch (e) { mg = null; } if (!mg) continue;
    const mesh = new THREE.Mesh(mg, G.plainB ? new THREE.MeshBasicMaterial({ vertexColors: true, side: G.mat.side, toneMapped: G.mat.toneMapped }) : G.plain ? (G.root === cantina ? owlMat(G.side) : vcMats[G.side]) : G.mat); mesh.userData.batch = true; G.root.add(mesh); merged.batches.push(mesh);
    { let off = 0; G.items.forEach((o, j) => { const n = gs[j].attributes.position.count; mergeSlots.set(o, { batch: mesh, start: off, count: n }); off += n; }); } // per-original vertex range (grab hides one build's slot)
    G.items.forEach(o => { o.visible = false; merged.originals.push(o); }); } // hide, don't remove -> restorable
  console.info(`staticMerge: ${merged.originals.length} meshes -> ${merged.batches.length}`);
}
function unmerge() { if (!merged) return; mergeSlots.clear(); merged.batches.forEach(m => { m.removeFromParent(); m.geometry.dispose(); }); merged.originals.forEach(o => o.visible = true); merged = null;
  for (const l of lodObjs) l.levels.forEach(v => v.object.visible = true); } // B3
let mergeT = 0; const scheduleMerge = (ms = 1200) => { clearTimeout(mergeT); mergeT = setTimeout(() => { if (lowNow) { staticMerge(); status(true); } }, ms); };
THREE.DefaultLoadingManager.onLoad = () => scheduleMerge(); THREE.DefaultLoadingManager.onProgress = () => scheduleMerge();
const PIX = Q.has('pixels'); // F3: desktop uses the LED ribbon too (90k tris saved); ?pixels brings back the per-pixel strip
function setLow(on) { const was = lowNow; lowNow = on; for (const l of lodObjs) l.autoUpdate = !on; /* renderer auto-updates LODs: in low/XR that re-showed full builds over the merged lod1 batch near the wall */ washSet[120].visible = !on; washSet[48].visible = on; applyCantSet(); rigLod?.(); pixels.visible = !on && PIX; ledRibbon.visible = on || !PIX; bracketGroup.visible = !on;
  ringMesh.visible = store.get().labels || renderer.xr.isPresenting;
  applySignSet(); if (on && !was) scheduleMerge(0); if (!on && was) unmerge(); applyNeonMode(); statusFrames = 2; } // B6: refresh status right after the transition
setLow(low); if (low) scheduleMerge(0);

// ---------- phone fallback: Look around (B1 heading, B2 permissions) ----------
const look = { on: false, a: null, b: null, g: null, yawOff: 0, dragX: null, aligned: false };
const lookBtn = document.createElement('button'); lookBtn.textContent = 'Look around';
lookBtn.style.cssText = 'position:fixed;bottom:42px;right:10px;padding:7px 12px;border:1px solid #fff;border-radius:6px;background:rgba(0,0,0,.6);color:#fff;font:14px system-ui;z-index:999;display:none';
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
  if (!look.on) return; if (walk && walk.on) camera.position.set(walk.x, walk.eyeY, walk.z); else camera.position.set(...SPAWN_EYE());
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
// solid props: simple world-space boxes [x0, x1, z0, z1] (inflated by RAD when tested)
// Owl Cove bandshell, showroom cantina-local. ry +90: booth +Z (toward the crowd) lands on cantina +X.
const BOOTH = { x: -3.0, z: 1.2, ry: Math.PI / 2 };
const _boothM = new THREE.Matrix4();
function boothPoint(x, y, z, out = new THREE.Vector3()) { _boothM.makeRotationY(BOOTH.ry).setPosition(BOOTH.x, 0, BOOTH.z); return out.set(x, y, z).applyMatrix4(_boothM); }
// owlcove_dj_booth.glb position accessors (lod1 is the slightly larger box). Old booth box removed.
const BOOTH_LOCAL_AABB = { x0: -1.141, x1: 1.141, z0: -0.850, z1: 0.728 };
function boothSolid() { let lx0 = Infinity, lx1 = -Infinity, lz0 = Infinity, lz1 = -Infinity; const p = new THREE.Vector3();
  for (const x of [BOOTH_LOCAL_AABB.x0, BOOTH_LOCAL_AABB.x1]) for (const z of [BOOTH_LOCAL_AABB.z0, BOOTH_LOCAL_AABB.z1]) { boothPoint(x, 0, z, p); lx0 = Math.min(lx0, p.x); lx1 = Math.max(lx1, p.x); lz0 = Math.min(lz0, p.z); lz1 = Math.max(lz1, p.z); }
  return cw(lx0, lx1, lz0, lz1); }
const PR = PIT.size / 2 - 0.45, cw = (lx0, lx1, lz0, lz1) => { const C = CANTINA.origin; return [C[0] + lz0, C[0] + lz1, C[1] - lx1, C[1] - lx0]; }; // cantina-local box -> world
const SOLIDS = [
  ...PLINTHS.map(p => [p.x - p.w / 2, p.x + p.w / 2, p.z - p.d / 2, p.z + p.d / 2]),
  [PIT.cx + PR - 0.35, PIT.cx + PR + 0.5, PIT.cz + 0.5, PIT.cz + PR + 0.3], [PIT.cx + PR - 0.35, PIT.cx + PR + 0.5, PIT.cz - PR - 0.3, PIT.cz - 0.5], // banquette back run, split by the hall-side gap                 // banquette back run
  [PIT.cx - PR * 0.55, PIT.cx + PR, PIT.cz + PR - 0.35, PIT.cz + PR + 0.5],                      // banquette +Z run
  [PIT.cx - PR * 0.55, PIT.cx + PR, PIT.cz - PR - 0.5, PIT.cz - PR + 0.35],                      // banquette -Z run
  [PIT.cx - 0.65, PIT.cx + 0.45, PIT.cz - 0.55, PIT.cz + 0.55],                                  // pit table
  [NOOK.x0, NOOK.x0 + 0.5, NOOK.z0 + 0.35, NOOK.z1 - 0.35],                                     // hi-fi
  [NOOK.x1 - 0.75, NOOK.x1, NOOK.z0, NOOK.z0 + 0.85], [NOOK.x1 - 0.75, NOOK.x1, NOOK.z1 - 0.85, NOOK.z1], // lounge chairs
  [BW.x0, BW.x1, BW.z - BW.depth, BW.z],                                                         // builds shelves
  cw(1.5, 2.55, 1.19, 5.21), cw(3.48, 3.98, 2.65, 5.95), cw(-4, -0.8, 2.2, 5.4), cw(-2.05, 2.05, 6.02, 6.5), boothSolid(), // cantina bar, back bar, seating booth, ent center, DJ bandshell
];
const inSolid = (x, z) => SOLIDS.some(([x0, x1, z0, z1]) => x > x0 - RAD && x < x1 + RAD && z > z0 - RAD && z < z1 + RAD);
const walkable = (x, z) => WALK_RECTS.some(([x0, x1, z0, z1]) => x >= x0 && x <= x1 && z >= z0 && z <= z1) && !inSolid(x, z);
function nearestFree(x, z) { // escape: push out of a solid prop / wall to the nearest walkable point (rings of 16 probes, 5 cm steps, up to 3 m); else spawn
  if (walkable(x, z)) return [x, z];
  for (let d = 0.05; d <= 3; d += 0.05) for (let k = 0; k < 16; k++) { const a = k / 16 * Math.PI * 2, px = x + Math.cos(a) * d, pz = z + Math.sin(a) * d; if (walkable(px, pz)) return [px, pz]; }
  return [SPAWNS[0].x, SPAWNS[0].z]; }
const PH = PIT.size / 2, floorAt = (x, z) => (Math.abs(x - PIT.cx) < PH && Math.abs(z - PIT.cz) < PH ? PIT_Y : 0); // only the pit steps down
walk = { on: IS_TOUCH && !Q.has('orbit'), x: 0, z: 0, eyeY: EYE, yaw: 0, pitch: 0, joy: [0, 0], goal: null, keys: new Set(), last: performance.now(),
  syncFromCamera() { camera.updateMatrixWorld(); const f = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
    this.yaw = Math.atan2(-f.x, -f.z); this.pitch = Math.max(-1.2, Math.min(1.2, Math.asin(f.y))); this.goal = null;
    let [x, z] = nearestFree(camera.position.x, camera.position.z); this.x = x; this.z = z; this.eyeY = floorAt(x, z) + EYE; } };
const tryMove = (dx, dz) => { // slide along walls: full move, else per-axis
  if (walkable(walk.x + dx, walk.z + dz)) { walk.x += dx; walk.z += dz; return true; }
  let ok = false; if (dx && walkable(walk.x + dx, walk.z)) { walk.x += dx; ok = true; } if (dz && walkable(walk.x, walk.z + dz)) { walk.z += dz; ok = true; } return ok; };
const heading = () => { const f = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion); f.y = 0; if (f.lengthSq() < 1e-6) f.set(-Math.sin(walk.yaw), 0, -Math.cos(walk.yaw)); return f.normalize(); };
function walkUpdate() {
  const now = performance.now(), dtAll = Math.min(0.5, (now - walk.last) / 1000); walk.last = now; // substeps keep 1.4 m/s at low fps (only >0.5 s hitches are dropped)
  if (renderer.xr.isPresenting) return; const nSub = Math.max(1, Math.ceil(dtAll / (1 / 60))), dt = dtAll / nSub;
  for (let i = 0; i < nSub; i++) walkStep(dt);
  walk.eyeY += (floorAt(walk.x, walk.z) + EYE - walk.eyeY) * (1 - Math.exp(-dtAll * 6)); // smooth step down into / up out of the pit
  if (walk.on && !look.on) { camera.position.set(walk.x, walk.eyeY, walk.z); camera.quaternion.setFromEuler(_e.set(walk.pitch, walk.yaw, 0, 'YXZ')); }
  else if (walk.on && look.on) camera.position.set(walk.x, walk.eyeY, walk.z);
}
function walkStep(dt) {
  if (GRAB.held?.mode === 'inspect') { walk.goal = null; return; } // T1: joystick / WASD / tap-to-walk are blocked while a build is in inspect
  let mx = walk.joy[0], mz = walk.joy[1]; // joystick: x = strafe right, y = forward
  const k = walk.keys; if (k.has('KeyW') || k.has('ArrowUp')) mz += 1; if (k.has('KeyS') || k.has('ArrowDown')) mz -= 1; if (k.has('KeyD') || k.has('ArrowRight')) mx += 1; if (k.has('KeyA') || k.has('ArrowLeft')) mx -= 1;
  const len = Math.hypot(mx, mz);
  if (len > 0.01) { walk.goal = null; if (!walk.on) { walk.syncFromCamera(); } // desktop WASD: move the orbit pivot with the camera
    const f = heading(), r = new THREE.Vector3(-f.z, 0, f.x), sc = Math.min(1, len) / len * WALK_V * dt; const dx = (f.x * mz + r.x * mx) * sc, dz = (f.z * mz + r.z * mx) * sc;
    const ox = walk.x, oz = walk.z; tryMove(dx, dz);
    if (!walk.on && !look.on) { camera.position.x += walk.x - ox; camera.position.z += walk.z - oz; controls.target.x += walk.x - ox; controls.target.z += walk.z - oz; } }
  if (walk.goal) { const g = walk.goal; g.t += dt / g.dur; const u = Math.min(1, g.t), e = u * u * (3 - 2 * u); // eased tap-to-walk
    const tx = g.x0 + (g.x1 - g.x0) * e, tz = g.z0 + (g.z1 - g.z0) * e; if (!tryMove(tx - walk.x, tz - walk.z) || u >= 1) walk.goal = null; }
}
addEventListener('keydown', e => { if (e.target.closest?.('input,select,textarea')) return; if (/^(Key[WASD]|Arrow)/.test(e.code)) { walk.keys.add(e.code); e.preventDefault?.(); } });
addEventListener('keyup', e => walk.keys.delete(e.code)); addEventListener('blur', () => walk.keys.clear());
// touch: no pinch zoom / scroll on the canvas
renderer.domElement.style.touchAction = 'none'; document.body.style.overscrollBehavior = 'none';
// joystick (bottom-left; corner UI is top-left / bottom-right)
const joy = document.createElement('div'); joy.id = 'joystick'; const knob = document.createElement('div'); joy.append(knob);
joy.style.cssText = 'position:fixed;left:18px;bottom:18px;width:104px;height:104px;border-radius:50%;background:rgba(0,0,0,.28);border:1px solid rgba(255,255,255,.35);touch-action:none;z-index:6;display:none';
knob.style.cssText = 'position:absolute;left:29px;top:29px;width:46px;height:46px;border-radius:50%;background:rgba(255,255,255,.45);pointer-events:none';
document.body.append(joy); let joyId = null;
const joyMove = e => { const r = joy.getBoundingClientRect(), cx = r.left + 52, cy = r.top + 52; let dx = e.clientX - cx, dy = e.clientY - cy; const d = Math.hypot(dx, dy), m = 40; if (d > m) { dx *= m / d; dy *= m / d; }
  knob.style.transform = `translate(${dx}px,${dy}px)`; walk.joy = [dx / m, -dy / m]; };
joy.addEventListener('pointerdown', e => { joyId = e.pointerId; joy.setPointerCapture(e.pointerId); joyMove(e); e.preventDefault(); });
joy.addEventListener('pointermove', e => { if (e.pointerId === joyId) joyMove(e); });
const joyEnd = e => { if (e.pointerId !== joyId) return; joyId = null; walk.joy = [0, 0]; knob.style.transform = ''; }; joy.addEventListener('pointerup', joyEnd); joy.addEventListener('pointercancel', joyEnd);
// one-finger drag = look (adds to the gyro yaw when 'Look around' is on); short tap on the floor = walk there
const drag = { id: null, x: 0, y: 0, x0: 0, y0: 0, t0: 0 }, _ray = new THREE.Raycaster(), _floor = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), _hit = new THREE.Vector3();
const canvasTouches = new Set(); let multi = false;
const hintKey = 'ff-walk-hint'; let hint = null;
function hideHint() { if (!hint) return; hint.style.opacity = '0'; const h = hint; hint = null; setTimeout(() => h.remove(), 600); try { localStorage.setItem(hintKey, '1'); } catch (e) {} }
function showHint() { let seen = false; try { seen = !!localStorage.getItem(hintKey); } catch (e) {} if (seen || hint || !walk.on || !IS_TOUCH) return;
  hint = document.createElement('div'); hint.id = 'walk-hint'; hint.textContent = 'Drag to look, tap floor to walk';
  hint.style.cssText = 'position:fixed;left:50%;top:38%;transform:translateX(-50%);padding:8px 14px;border-radius:16px;background:rgba(0,0,0,.55);color:#fff;font:14px system-ui;pointer-events:none;z-index:7;transition:opacity .6s;opacity:1';
  document.body.append(hint); setTimeout(hideHint, 4500); }
addEventListener('pointerdown', hideHint, true);
let floorMeshes = null; const getFloors = () => floorMeshes ||= (() => { const out = [], mats = new Set([M.floor, M.rug, M.deck, M.cdeck]); scene.traverse(o => { if (o.isMesh && !o.userData.batch && mats.has(o.material)) out.push(o); }); return out; })();
renderer.domElement.addEventListener('pointerdown', e => { canvasTouches.add(e.pointerId); if (canvasTouches.size > 1) { multi = true; drag.id = null; return; } }, true); // 2+ fingers on the view: ignore (no pinch rotate)
addEventListener('pointerup', e => { canvasTouches.delete(e.pointerId); if (!canvasTouches.size) multi = false; }, true); addEventListener('pointercancel', e => { canvasTouches.delete(e.pointerId); if (!canvasTouches.size) multi = false; }, true);
renderer.domElement.addEventListener('pointerdown', e => { if (multi || !(walk.on || look.on) || drag.id != null) return; Object.assign(drag, { id: e.pointerId, x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY, t0: performance.now() }); });
addEventListener('pointermove', e => { if (e.pointerId !== drag.id || multi) return; if (GRAB.held?.mode === 'inspect') { drag.x = e.clientX; drag.y = e.clientY; return; } /* T1: the drag rotates the build, not the view */ const dx = e.clientX - drag.x, dy = e.clientY - drag.y; drag.x = e.clientX; drag.y = e.clientY;
  if (look.on) look.yawOff += dx * 0.005; else if (walk.on) { walk.yaw += dx * 0.005; walk.pitch = Math.max(-1.2, Math.min(1.2, walk.pitch + dy * 0.004)); } });
addEventListener('pointerup', e => { if (e.pointerId !== drag.id) return; drag.id = null; if (e.__ffConsumed) return; /* guestbook / DJ / build tap */
  if (!walk.on || Math.hypot(e.clientX - drag.x0, e.clientY - drag.y0) > 10 || performance.now() - drag.t0 > 600) return;
  _ray.setFromCamera(new THREE.Vector2(e.clientX / innerWidth * 2 - 1, -(e.clientY / innerHeight) * 2 + 1), camera);
  const hits = _ray.intersectObjects(getFloors(), false).filter(h => h.object.visible || h.object.parent?.visible); const fh = hits[0]; // the real floor meshes (hall, pit, passage, cantina)
  if (fh) _hit.copy(fh.point); else if (!_ray.ray.intersectPlane(_floor, _hit)) return; if (!walkable(_hit.x, _hit.z)) return; const d = Math.hypot(_hit.x - walk.x, _hit.z - walk.z); if (d < 0.2 || d > 15) return;
  walk.goal = { x0: walk.x, z0: walk.z, x1: _hit.x, z1: _hit.z, t: 0, dur: Math.max(0.5, d / WALK_V) }; });
addEventListener('pointercancel', e => { if (e.pointerId === drag.id) drag.id = null; });
// ---------- VR locomotion (WebXR gamepads; local input only: remote/state messages never move the rig) ----------
// Left stick: smooth move along head yaw (1.4 m/s, same collision/props/pit step as touch walking; rig y follows the floor).
// Right stick: 30 deg snap turn about the head (deadzone + re-arm). Trigger: hold to aim (straight ray from the controller; reuses the panel's ray line),
// release to teleport to a valid floor point or a group-spot ring. Draw budget: aiming marker (+1) hides the idle controller ray (-1); while moving,
// the vignette (+1) replaces both rays (-2), so the hall never exceeds the idle count.
const XRM = { armed: true, aim: null, moveAmt: 0, lastT: performance.now(), dead: 0.18, smoothRate: Math.PI / 2 };
const xrCtl = [0, 1].map(i => { const c = renderer.xr.getController(i); c.addEventListener('connected', e => { c.userData.src = e.data; }); c.addEventListener('disconnected', () => { c.userData.src = null; }); return c; });
const ctlRay = c => c.children.find(o => o.isLine);
const tpMarker = new THREE.Mesh(mergeGeometries([new THREE.RingGeometry(0.22, 0.27, 32), new THREE.CircleGeometry(0.06, 16)]).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x7ff0e2, transparent: true, opacity: 0.85, depthWrite: false, toneMapped: false }));
tpMarker.visible = false; tpMarker.renderOrder = 3; tpMarker.userData.noMerge = true; scene.add(tpMarker);
const vignette = (() => { const g = new THREE.RingGeometry(0.16, 0.9, 48, 2), n = g.attributes.position.count, c = new Float32Array(n * 4);
  for (let i = 0; i < n; i++) { const r = Math.hypot(g.attributes.position.getX(i), g.attributes.position.getY(i)); c[i * 4 + 3] = r < 0.2 ? 0 : 0.85; } g.setAttribute('color', new THREE.BufferAttribute(c, 4));
  const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: 0x000000, vertexColors: true, transparent: true, opacity: 0, depthTest: false, depthWrite: false, toneMapped: false }));
  m.position.z = -0.3; m.renderOrder = 999; m.frustumCulled = false; m.visible = false; m.userData.noMerge = true; camera.add(m); return m; })();
const _hp = new THREE.Vector3(), _hd = new THREE.Vector3(), _m4 = new THREE.Matrix4(), _rr = new THREE.Raycaster(), _hl = new THREE.Vector3();
function headWorld() { const xc = renderer.xr.getCamera(); /* matrixWorld as of the last render (includes the rig); don't recompute it */ _hp.setFromMatrixPosition(xc.matrixWorld); _hd.setFromMatrixColumn(xc.matrixWorld, 2).negate(); _hd.y = 0; if (_hd.lengthSq() < 1e-6) _hd.set(0, 0, -1); _hd.normalize(); return _hp; }
function rigMove(h, dx, dz) { const x0 = h.x, z0 = h.z; let x = x0, z = z0; // h = tracked head position (updated in place)
  if (!walkable(x0, z0)) { const [fx, fz] = nearestFree(x0, z0); rig.position.x += fx - x0; rig.position.z += fz - z0; h.x = fx; h.z = fz; return; } // escape: stick used while inside a prop/wall (room-scale step) -> push to the nearest free point
  if (walkable(x0 + dx, z0 + dz)) { x += dx; z += dz; } else { if (walkable(x0 + dx, z0)) x += dx; if (walkable(x, z0 + dz)) z += dz; }
  rig.position.x += x - x0; rig.position.z += z - z0; h.x = x; h.z = z; }
function rigTeleport(h, x, z) { [x, z] = nearestFree(x, z); rig.position.x += x - h.x; rig.position.z += z - h.z; rig.position.y = floorAt(x, z); h.x = x; h.z = z; }
function snapTurn(h, a) { rig.updateMatrixWorld(true); _hl.copy(h).applyMatrix4(_m4.copy(rig.matrixWorld).invert()); rig.rotation.y += a; rig.updateMatrixWorld(true); _hl.applyMatrix4(rig.matrixWorld); rig.position.x += h.x - _hl.x; rig.position.z += h.z - _hl.z; }
function aimTarget(c) { _m4.identity().extractRotation(c.matrixWorld); _rr.ray.origin.setFromMatrixPosition(c.matrixWorld); _rr.ray.direction.set(0, 0, -1).applyMatrix4(_m4); _rr.far = 12;
  const ph = xrPanel.group.visible ? _rr.intersectObject(xrPanel.group, true)[0] : null; const fh = _rr.intersectObjects(getFloors(), false).filter(h => h.face && h.face.normal.y > 0.5)[0];
  if (!fh || (ph && ph.distance < fh.distance)) return { ok: false, dist: ph ? ph.distance : 3, panel: !!ph };
  { const pb = pickBuild(_rr.ray, fh.distance), gh = cantina.visible ? _rr.intersectObjects([gb.mesh, ...dj.pickables], false)[0] : null; // no teleport while aiming at a build or the guestbook
    if (pb || (gh && gh.distance < fh.distance)) return { ok: false, dist: pb ? pb.d : gh.distance, panel: true }; }
  let x = fh.point.x, z = fh.point.z; const spot = GROUP_SPOTS.find(g => Math.hypot(g.x - x, g.z - z) < 0.45); if (spot) { x = spot.x; z = spot.z; } // snap to a group-spot ring
  return { ok: walkable(x, z), x, z, y: floorAt(x, z), dist: fh.distance }; }
function xrLocomotion() {
  const now = performance.now(), dt = Math.min(0.5, (now - XRM.lastT) / 1000); XRM.lastT = now; if (!renderer.xr.isPresenting) return;
  let mx = 0, my = 0, tx = 0, aiming = null, single = false; const pads = [];
  for (const c of xrCtl) { const src = c.userData.src, gp = src?.gamepad; if (!gp) continue; const ax = gp.axes, sx = ax.length >= 4 ? ax[2] : ax[0] || 0, sy = ax.length >= 4 ? ax[3] : ax[1] || 0;
    pads.push({ hand: src.handedness, sx, sy });
    if (gp.buttons[0]?.pressed && !c.userData.claim) aiming ||= c; } // claim: trigger is being used on a build / the guestbook
  const moveHand = comfort.lefty ? 'right' : 'left', turnHand = comfort.lefty ? 'left' : 'right';
  if (pads.length === 1) { const p0 = pads[0]; my = p0.sy; tx = Math.abs(p0.sx) > 0.8 ? p0.sx : 0; single = true; } // one controller: fwd/back moves, strong flick turns
  else for (const p0 of pads) { if (p0.hand === moveHand) { mx = p0.sx; my = p0.sy; } else if (p0.hand === turnHand) tx = p0.sx; }
  if (comfort.move === 'teleport') { mx = 0; my = 0; }
  const h = headWorld().clone(), fx = _hd.x, fz = _hd.z, rx = -fz, rz = fx; // head + yaw as of the last frame, tracked through this frame's rig changes
  // snap turn with re-arm (first, while rig.matrixWorld still matches h)
  let turning = false;
  if (comfort.turn === 'smooth') { if (Math.abs(tx) > XRM.dead) { snapTurn(h, -Math.sign(tx) * (Math.abs(tx) - XRM.dead) / (1 - XRM.dead) * XRM.smoothRate * dt); turning = true; } }
  else { const a = comfort.turn === 'snap45' ? Math.PI / 4 : Math.PI / 6;
    if (Math.abs(tx) > (single ? 0.8 : 0.6) && XRM.armed) { snapTurn(h, -Math.sign(tx) * a); XRM.armed = false; } else if (Math.abs(tx) < 0.3) XRM.armed = true; }
  // smooth move (substeps, same 1/60 s as touch walking)
  if (single) { mx = 0; if (Math.abs(my) <= XRM.dead) my = 0; } const mag = Math.hypot(mx, my), moving = mag > XRM.dead;
  if (moving) { const k = Math.min(1, (mag - XRM.dead) / (1 - XRM.dead)) / mag, n = Math.max(1, Math.ceil(dt * 60)), sd = dt / n;
    for (let i = 0; i < n; i++) rigMove(h, (fx * -my + rx * mx) * k * WALK_V * sd, (fz * -my + rz * mx) * k * WALK_V * sd); }
  // floor height (pit) follows the head
  rig.position.y += (floorAt(h.x, h.z) - rig.position.y) * (1 - Math.exp(-dt * 6));
  // teleport aim / release
  if (aiming) { const t = aimTarget(aiming); XRM.aim = { c: aiming, t }; const ln = ctlRay(aiming); if (ln) { ln.scale.z = t.dist; ln.material.color.set(t.ok ? 0x7ff0e2 : t.panel ? 0xffffff : 0xff5a4a); }
    tpMarker.visible = t.ok; if (t.ok) tpMarker.position.set(t.x, t.y + 0.01, t.z); }
  else if (XRM.aim) { const { c, t } = XRM.aim; XRM.aim = null; tpMarker.visible = false; const ln = ctlRay(c); if (ln) { ln.scale.z = 3; ln.material.color.set(0xffffff); } if (t.ok) rigTeleport(h, t.x, t.z); }
  // budget: marker hides the idle ray; vignette replaces both rays while moving
  XRM.moveAmt += (((moving || turning) && comfort.vignette ? 1 : 0) - XRM.moveAmt) * (1 - Math.exp(-dt * 10)); vignette.visible = XRM.moveAmt > 0.02; vignette.material.opacity = XRM.moveAmt * 0.75;
  for (const c of xrCtl) { const ln = ctlRay(c); if (ln) ln.visible = !vignette.visible && !GRAB.held && (!aiming || c === aiming) && (!GRAB.hl.visible || c === GRAB.hlCtl); } // budget: highlight box hides the other ray; holding hides both
}
function resetXRLoco() { XRM.aim = null; XRM.armed = true; XRM.moveAmt = 0; XRM.lastT = performance.now(); tpMarker.visible = false; vignette.visible = false; vignette.material.opacity = 0;
  for (const c of xrCtl) { const ln = ctlRay(c); if (ln) { ln.scale.z = 3; ln.material.color.set(0xffffff); ln.visible = true; } } }
renderer.xr.addEventListener('sessionstart', resetXRLoco);
// ---------- cantina: guestbook on the bar + robot bartender ----------
const SIGN_URL = location.origin + location.pathname + '?guestbook';
const gb = createGuestbook(THREE, { store: new LocalGuestbookStore(), signUrl: SIGN_URL });
gb.mesh.position.set(2.02, 1.052, 4.35); gb.mesh.rotation.y = -Math.PI / 2; cantina.add(gb.mesh); // bar top, page tops toward the bartender, readable from the room side
gb.readView.mesh.position.set(1.7, 1.55, 4.35); gb.readView.mesh.rotation.y = -Math.PI / 2; cantina.add(gb.readView.mesh); // XR read view floats above the book, facing the room
// one SkinnedMesh (1 draw, one shared material) holds the bartender, Dex and the DJ booth hardware (counter, decks, platters, mixer, crossfader). Placeholders until Clay's models (manifest names in bartender.js).
let bookRoot = null; const robots = createRobotBatch(THREE); robots.setWhiteUV(gb.WHITE_UV); const btBones = robots.robot('bartender', 'bartender'), dexBones = robots.robot('dex', 'dex', { headphones: true }), boothBones = robots.booth('booth');
const bookBones = robots.prop('book', gb.mesh.geometry, 0xd8ccb8, 0.3); // the guestbook rides in the robots draw (its canvas is the shared map)
const robotsMesh = robots.finalize({ map: gb.tex }); cantina.add(robotsMesh);
bookRoot = bookBones.root; bookRoot.position.copy(gb.mesh.position); bookRoot.rotation.copy(gb.mesh.rotation); gb.mesh.visible = false; /* gb.mesh stays as the invisible pick proxy */
// Tapper's station: z 3.7 (was 3.3). Quinn: at 7 m his head stacked under the back bar's orange porthole (z ~3.2) like a halo; 0.4 m toward the
// guestbook (bar top z 4.35) clears it and keeps the book in front of him.
const TAPPER = { x: 3.0, z: 3.7 };
const bot = createBartender(THREE, btBones, robotsMesh); bot.place(TAPPER.x, 0, TAPPER.z); bot.setHome(-Math.PI / 2); // in the bartender aisle (bar back x 2.55 .. back bar x 3.48), facing the room
// DJ booth: Owl Cove bandshell, cantina-local (-3.0, 0, 1.2), rot_y +90 (crowd / booth +Z -> cantina +X). Dex root is booth-local (0, 0.25, -0.45).
boothBones.booth.position.set(BOOTH.x, 0, BOOTH.z); boothBones.booth.rotation.y = BOOTH.ry;
{ const d0 = boothPoint(0, 0.25, -0.45); dexBones.root.position.set(d0.x, d0.y, d0.z); dexBones.root.rotation.y = BOOTH.ry; dexBones.root.userData.y0 = 0.25; }
const djRig = { dex: { root: dexBones.root, torso: dexBones.torso, head: dexBones.head, arm: dexBones.armR, forearm: dexBones.foreR, armL: dexBones.armL, forearmL: dexBones.foreL, antenna: dexBones.antenna },
    booth: { platters: [boothBones.platterA, boothBones.platterB], crossfader: boothBones.xfader }, pulse: robotsMesh.material.userData.uPulse, dexPuppet: null };
const dj = createDJBooth(THREE, { camera, signUrl: location.origin + location.pathname, rig: djRig });
dj.group.position.set(BOOTH.x, 0, BOOTH.z); dj.group.rotation.y = BOOTH.ry; cantina.add(dj.group);
// visualizer canvas: 512 wide in XR and on touch devices (perf budget), 1024 on desktop
const djRes = () => { dj.setResolution(renderer.xr.isPresenting ? 'xr' : IS_TOUCH_UI ? 'touch' : 'desktop'); cant.setXR?.(renderer.xr.isPresenting); }; djRes(); renderer.xr.addEventListener('sessionstart', djRes); renderer.xr.addEventListener('sessionend', djRes);
coveHook = (c, n) => dj.coveOverlay(c, n);
// Clay's rigged Tapper / Dex / booth: replace the placeholder batch completely once they load (placeholders stay if they fail).
// One SkinnedMesh per LOD (+ the booth screen) => same 2 cantina draws as the placeholders. lod1 in XR / ?low and on touch devices.
let rigged = null;
riggedEntries.then(async ({ list, base }) => { const R = await loadRigged(THREE, { loader, base, entries: list, gb });
  R.bones.booth.booth.position.set(BOOTH.x, 0, BOOTH.z); R.bones.booth.booth.rotation.y = BOOTH.ry; // deck A (platterA, -X booth-local) stays on the crowd's left
  const boothEnt = R.entries.booth, dexLocal = (boothEnt.dex && boothEnt.dex.pos_booth_local) || R.entries.dex.placement?.pos || [0, 0.25, -0.45];
  const dp = boothPoint(dexLocal[0], dexLocal[1], dexLocal[2]); // same frame as the booth bone (BOOTH.ry), not a second yaw
  R.bones.dex.root.position.set(dp.x, dp.y, dp.z); R.bones.dex.root.rotation.y = BOOTH.ry; R.bones.dex.root.userData.y0 = dexLocal[1];
  R.bones.book.root.position.copy(gb.mesh.position); R.bones.book.root.rotation.copy(gb.mesh.rotation);
  bot.rebind(R.bones.bartender, R.meshFull, R.puppets.bartender); bot.place(TAPPER.x, 0, TAPPER.z);
  Object.assign(djRig, { dex: R.bones.dex, booth: { platters: [R.bones.booth.platterA, R.bones.booth.platterB], crossfader: R.bones.booth.xfader }, pulse: R.uPulse, dexPuppet: R.puppets.dex });
  try { djRig.dexSet = createDexSet(THREE, { puppet: R.puppets.dex, bones: R.bones.dex, targets: Object.assign({}, DEX_TARGETS, dexTargetsFromJoints(boothEnt.joints, dexLocal)) }); } catch (e) { console.warn('dex-set: ' + e.message); } // hands on platterA/B + xfader from the booth manifest joints
  if (window.LOFT) window.LOFT.dexSet = djRig.dexSet || null; // QA handle
  if (djRig.dexSet && DJ_CONFIG.DEX_TARGETS_URL) fetch(DJ_CONFIG.DEX_TARGETS_URL, { cache: 'no-store' }).then(r => r.ok ? r.json() : null).then(j => { const t = j && (j.dex_targets || j.targets || j); if (!t) return; // Clay's booth positions -> re-bake Dex's reach
    const keep = Object.fromEntries(Object.entries(t).filter(([k]) => k in djRig.dexSet.targets)); if (Object.keys(keep).length) { djRig.dexSet.setTargets(keep); console.info('dex-set targets from', DJ_CONFIG.DEX_TARGETS_URL, Object.keys(keep).join(',')); } }).catch(e => console.info('dex-set targets not loaded:', e.message));
  dj.adoptScreen(R.screenGeo); bookRoot = R.bones.book.root;
  cantina.remove(robotsMesh); robotsMesh.geometry.dispose(); robotsMesh.material.dispose(); // placeholders gone (0 draws, no skinning cost)
  cantina.add(R.meshFull, R.meshLod); rigged = R; rigLod = () => { const lo = lowNow || IS_TOUCH_UI; R.meshFull.visible = !lo; R.meshLod.visible = lo; }; rigLod();
  window.LOFT && (window.LOFT.rigged = R, window.LOFT.robots = R.meshFull); console.info(R.info); status(true);
}).catch(e => console.info('rigged cantina models not loaded, placeholders kept:', e.message));
{ // panel: DJ booth (Dex) - set, play/stop, volume, light show (file / URL / live), credits
  const pb = document.getElementById('panel-body'), help = document.getElementById('panel-help'); if (pb) { const d = document.createElement('details'); d.id = 'dj-panel';
    d.innerHTML = `<summary><small>DJ booth (Dex)</small></summary>
    <label>Set <select id="dj-set"></select></label>
    <div style="display:flex;gap:6px;align-items:center"><button id="dj-play">▶ Play</button><button id="dj-stop">■ Stop</button><label style="flex:1">Vol <input id="dj-vol" type="range" min="0" max="1" step="0.05" value="0.8" style="width:90px"></label></div>
    <small>Light show (Dex .lights.json)</small>
    <div style="display:flex;gap:6px;flex-wrap:wrap"><input id="dj-show-file" type="file" accept=".json,application/json" style="max-width:190px"><input id="dj-show-url" placeholder="shows/demo.lights.json" style="width:150px"><button id="dj-show-load">Load show</button></div>
    <div style="display:flex;gap:6px"><button id="dj-show-play">▶ Show</button><button id="dj-show-stop">■ Show</button><button id="dj-live" title="LIGHTSHOW_WS (stub)">Live</button></div>
    <small id="dj-status" style="opacity:.8"></small><small id="dj-credit" style="opacity:.65;font-size:10px;line-height:1.25"></small>`;
    pb.insertBefore(d, help || null); const $ = id => d.querySelector('#' + id); let pending = null;
    for (const st of DJ_CONFIG.SETS) { const o = document.createElement('option'); o.value = st.id; o.textContent = st.label; $('dj-set').append(o); }
    const status = m => { $('dj-status').textContent = m; }; const credit = () => { $('dj-credit').textContent = dj.state.set ? dj.state.set.credit : ''; }; credit();
    $('dj-set').onchange = async e => { await dj.selectSet(e.target.value); credit(); status('Ready: ' + dj.state.set.label); };
    $('dj-play').onclick = async () => { await dj.play(); status(dj.audio.playing ? `Playing ${dj.state.set.label} (${dj.audio.kind}${dj.audio.offset ? ', -' + Math.round(dj.audio.offset * 1000) + ' ms MP3 offset' : ''}) · ${dj.state.showInfo || 'no lights'}` : 'Could not start audio'); credit(); };
    $('dj-stop').onclick = () => { dj.stop(); status('Stopped'); }; $('dj-vol').oninput = e => dj.audio.setVolume(+e.target.value);
    const loadJSON = async () => { const f = $('dj-show-file').files[0]; if (f) return { json: JSON.parse(await f.text()), name: f.name }; const u = $('dj-show-url').value.trim() || 'shows/demo.lights.json'; const r = await fetch(u); if (!r.ok) throw new Error(u + ' ' + r.status); return { json: await r.json(), name: u }; };
    $('dj-show-load').onclick = async () => { try { pending = await loadJSON(); if (!Array.isArray(pending.json.cues)) throw new Error('no cues[]'); status(`Loaded ${pending.name}: ${pending.json.cues.length} cues`); } catch (e) { pending = null; status('Show load failed: ' + e.message); } };
    $('dj-show-play').onclick = async () => { try { if (!pending) pending = await loadJSON(); dj.playShow(pending.json, pending.name); status(`Show ${pending.name} on ${dj.audio.playing ? 'the audio clock' : 'a free-running clock'}`); } catch (e) { status('Show: ' + e.message); } };
    $('dj-show-stop').onclick = () => { dj.stopShow(); status('Show stopped'); }; $('dj-live').onclick = () => status('Live input: ' + dj.playLive()); } }
// cantina additive glows in ONE draw: Clay's cove fan + the teleport ring + the booth's fake fixtures (wash cone, 2 deck spots). Per-vertex 'fix' picks a uniform colour.
const coveFan = cantina.getObjectByName('cantina-cove-glow'), _cm = [0, 0, 0], uCove = new THREE.Vector3(1, 1, 1);
if (coveFan) { const fg = coveFan.geometry.index ? coveFan.geometry.toNonIndexed() : coveFan.geometry.clone(); dj.group.updateMatrix();
  const cgeo = dj.fixtures.geometry.clone().applyMatrix4(dj.group.matrix), nF = fg.attributes.position.count, nC = cgeo.attributes.position.count;
  const pos = new Float32Array((nF + nC) * 3), col = new Float32Array((nF + nC) * 3), fix = new Float32Array(nF + nC);
  pos.set(fg.attributes.position.array, 0); pos.set(cgeo.attributes.position.array, nF * 3); col.set(fg.attributes.color.array, 0); fix.fill(3, 0, nF);
  for (let i = 0; i < nC; i++) { const f = cgeo.attributes.fade.array[i]; col.set([f, f, f], (nF + i) * 3); fix[nF + i] = cgeo.attributes.fix.array[i]; }
  const g2 = new THREE.BufferGeometry(); g2.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g2.setAttribute('color', new THREE.BufferAttribute(col, 3)); g2.setAttribute('fix', new THREE.BufferAttribute(fix, 1));
  const uCol = { value: [...dj.fixtures.material.uniforms.uCol.value, uCove] }; // the dj's 3 fixture colours (live references) + the cove tint
  const glow = new THREE.Mesh(g2, new THREE.ShaderMaterial({ uniforms: { uCol }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, forceSinglePass: true,
    vertexShader: 'attribute float fix; attribute vec3 color; uniform vec3 uCol[4]; varying vec3 vC; void main(){ int i=int(fix+0.5); vec3 c = i==0?uCol[0]:(i==1?uCol[1]:(i==2?uCol[2]:uCol[3])); vC = color*c; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }',
    fragmentShader: 'varying vec3 vC; void main(){ gl_FragColor = vec4(vC, 1.); }' }));
  glow.name = 'cantina-glow+fixtures'; glow.renderOrder = 2; glow.userData.noMerge = true; cantina.add(glow); coveFan.visible = false; coveFan.userData.noMerge = true; dj.fixtures.userData.merged = true; dj.fixtures.visible = false; }
function tintCantinaCove() { const m = dj.coveMean(_cm); if (!m) { uCove.set(1, 1, 1); return; } const mx = Math.max(1e-3, ...m); uCove.set(m[0] / mx, m[1] / mx, m[2] / mx).multiplyScalar(0.35 + 1.6 * mx); } // approximate: multiplies the fan's teal gradient
if (Q.has('guestbook') || Q.has('credits')) setTimeout(() => gb.openModal(Q.has('credits')), 600);
function placeOnBar() { // drop the book onto the real bar-top height once Clay's pieces are in (downward ray)
  if (!cantSets.full) return; const r = new THREE.Raycaster(cantina.localToWorld(new THREE.Vector3(2.02, 2, 4.35)), new THREE.Vector3(0, -1, 0)); r.far = 1.5;
  const h = r.intersectObject(cantSets.full, true)[0]; if (h) gb.mesh.position.y = cantina.worldToLocal(h.point.clone()).y + 0.002; bookRoot?.position.copy(gb.mesh.position); }
const _pw = new THREE.Vector3();
function playerWorld() { const c = renderer.xr.isPresenting ? renderer.xr.getCamera() : camera; return _pw.setFromMatrixPosition(c.matrixWorld); }
let botLast = performance.now();
function updateBartender() { const now = performance.now(); const dt = bot.fixedDt ?? Math.min(0.1, (now - botLast) / 1000); botLast = now; // always ticked (cheap maths) so it re-arms after the player leaves; it only renders when the cantina is visible
  bot.update(dt, roomNow.startsWith('cantina') ? playerWorld() : null); dj.update(dt); rigged?.syncBook(); tintCantinaCove(); dj.audio.setRoomGain(musicGain(playerWorld())); }
// D1: Dex's music is the cantina's. Walking distance from the cantina doorway (5.15, 12): passage leg B (+X), leg A (+Z), then the hall door (3.05, 10.5).
// gain = exp(-d / 0.9): ~0.19 at the passage turn (1.5 m), ~0.02 at the hall door (3.6 m), < 0.01 a metre into the hall.
function musicGain(p) { const [dx, dz] = CANTINA.origin, [tx, tz] = PASSAGE.turn; let d;
  if (p.x >= dx - 0.05) d = 0; else if (p.x >= tx + PASSAGE.w / 2 && Math.abs(p.z - tz) < PASSAGE.w) d = dx - p.x; else if (p.z > HALL.z1) d = (dx - tx) + Math.max(0, tz - p.z);
  else d = (dx - tx) + (tz - HALL.z1) + Math.hypot(p.x - DOOR.x, p.z - HALL.z1);
  return d <= 0 ? 1 : Math.max(0, Math.exp(-d / 0.9)); }

// ---------- builds: grab / force pull (VR), click-to-inspect (desktop/phone). Local only: never written to the shared state. ----------
const GRAB = { held: null, hl: null, hlCtl: null, boxes: new Map(), inspectRot: new THREE.Quaternion(), light: null };
GRAB.hl = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 1, 1)), new THREE.LineBasicMaterial({ color: 0x7ff0e2, transparent: true, opacity: 0.9, toneMapped: false }));
GRAB.hl.visible = false; GRAB.hl.userData.noMerge = true; scene.add(GRAB.hl);
if (!/OculusBrowser|Quest|Pico/i.test(navigator.userAgent)) { GRAB.light = new THREE.PointLight(0xfff0dc, 0, 2.5, 1.5); scene.add(GRAB.light); } // desktop/phone inspect key light (intensity 0 until used)
const _bb = new THREE.Box3(), _v = new THREE.Vector3(), _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _s = new THREE.Vector3(), _mm = new THREE.Matrix4(), _ray2 = new THREE.Raycaster();
function buildBox(b) { if (GRAB.held?.b === b) return null; let bx = GRAB.boxes.get(b); if (!bx) { b.holder.updateMatrixWorld(true); bx = new THREE.Box3().setFromObject(b.holder); if (bx.isEmpty()) return null; GRAB.boxes.set(b, bx); } return bx; }
function pickBuild(ray, far = 8) { let best = null, bd = far; if (!hall.visible) return null;
  for (const b of buildHolders) { const bx = buildBox(b); if (!bx) continue; const p = ray.intersectBox(bx, _v); if (p) { const d = p.distanceTo(ray.origin); if (d < bd) { bd = d; best = b; } } } return best ? { b: best, d: bd } : null; }
function nearBuild(p, r = 0.25) { let best = null, bd = r; for (const b of buildHolders) { const bx = buildBox(b); if (!bx) continue; const d = bx.distanceToPoint(p); if (d < bd) { bd = d; best = b; } } return best; }
function setSlotHidden(b, hide) { // merged (low/XR): hide that build's vertex range in its batch and show its own meshes; desktop: nothing merged
  b.holder.traverse(o => { const ms = mergeSlots.get(o); if (!ms) return; const pa = ms.batch.geometry.attributes.position, a = pa.array, i0 = ms.start * 3, i1 = (ms.start + ms.count) * 3;
    if (hide) { ms.saved ||= a.slice(i0, i1); a.fill(0, i0, i1); } else if (ms.saved) { a.set(ms.saved, i0); ms.saved = null; }
    pa.needsUpdate = true; });
  if (hide) { const px = heldCopy(b); if (px) px.visible = true; } else if (b.proxy) b.proxy.visible = false; }
function heldCopy(b) { // one-draw unmerged copy of a merged build (vertex colours like the batch), built on first grab
  if (b.proxy) return b.proxy; const h = b.holder; h.updateMatrixWorld(true); const inv = new THREE.Matrix4().copy(h.matrixWorld).invert(), gs = []; let side = 0;
  h.traverse(o => { if (!mergeSlots.has(o)) return; let g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone(); const c = new THREE.Color().copy(o.material.color || new THREE.Color(1, 1, 1)); side = Math.max(side, o.material.side);
    const keep = new THREE.BufferGeometry(); keep.setAttribute('position', g.attributes.position); if (g.attributes.normal) keep.setAttribute('normal', g.attributes.normal); else { keep.computeVertexNormals(); }
    const n = keep.attributes.position.count, col = new Float32Array(n * 3); for (let i = 0; i < n; i++) col.set([c.r, c.g, c.b], i * 3); keep.setAttribute('color', new THREE.BufferAttribute(col, 3));
    keep.applyMatrix4(_mm.multiplyMatrices(inv, o.matrixWorld)); gs.push(keep); });
  if (!gs.length) return null; const m = new THREE.Mesh(mergeGeometries(gs), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, metalness: 0.15, side }));
  m.userData.noMerge = true; m.visible = false; m.frustumCulled = false; h.add(m); return (b.proxy = m); }
function startHold(b, mode, ctl) { if (GRAB.held) { if (GRAB.held.phase === 'return') endHold(); else return; } const h = b.holder; b.home = { parent: h.parent, pos: h.position.clone(), quat: h.quaternion.clone(), scale: h.scale.clone() };
  setSlotHidden(b, true); scene.attach(h); GRAB.held = { b, mode, ctl, phase: 'pull', t: 0, from: { pos: h.position.clone(), quat: h.quaternion.clone() }, dur: mode === 'grip-near' ? 0.18 : 0.6, grabOff: null };
  GRAB.inspectRot.identity(); GRAB.hl.visible = false; if (ctl) ctl.userData.claim = true; if (mode === 'inspect') { GRAB.ctlWas = controls.enabled; controls.enabled = false; if (GRAB.light) GRAB.light.intensity = 2.2; } }
function releaseHold() { const H = GRAB.held; if (!H || H.phase === 'return') return; H.phase = 'return'; H.t = 0; H.from = { pos: H.b.holder.position.clone(), quat: H.b.holder.quaternion.clone() }; }
function endHold() { const H = GRAB.held; const b = H.b, h = b.holder; b.home.parent.add(h); h.position.copy(b.home.pos); h.quaternion.copy(b.home.quat); h.scale.copy(b.home.scale); // exact shelf slot
  setSlotHidden(b, false); if (H.ctl) H.ctl.userData.claim = false; if (H.mode === 'inspect') { controls.enabled = GRAB.ctlWas; if (GRAB.light) GRAB.light.intensity = 0; } GRAB.boxes.delete(b); GRAB.held = null; }
function holdTarget(H, outPos, outQuat) { // where the held build wants to be this frame
  if (H.mode === 'inspect') { camera.updateMatrixWorld(); const f = _v.set(0, 0, -1).applyQuaternion(camera.quaternion); outPos.copy(camera.position).addScaledVector(f, 0.75); outPos.y -= 0.05;
    outQuat.copy(camera.quaternion).multiply(_q2.setFromAxisAngle(_s.set(0, 1, 0), Math.PI)).multiply(GRAB.inspectRot); if (GRAB.light) GRAB.light.position.copy(camera.position).addScaledVector(f, 0.3).add(_s.set(0.25, 0.3, 0)); return; }
  const c = H.ctl; c.updateMatrixWorld(); if (H.mode === 'grip-near' && H.grabOff) { _mm.multiplyMatrices(c.matrixWorld, H.grabOff); _mm.decompose(outPos, outQuat, _s); if (H.phase === 'held') clampHeld(outPos); return; }
  outPos.set(0, 0, -0.14).applyMatrix4(c.matrixWorld); c.getWorldQuaternion(outQuat); clampHeld(outPos); }
// X2: a held build (VR) stays out of the walls and the tall builds shelf: its centre keeps >= 0.2 m from a wall / 0.15 m from the shelf.
// If the hand target is inside, the build stops at the last free point on the line from the head to the hand (binary search).
const HELD_TALL = [[BW.x0, BW.x1, BW.z - BW.depth, BW.z]], _hh = new THREE.Vector3();
const heldFree = (x, z) => WALK_RECTS.some(([x0, x1, z0, z1]) => x >= x0 - 0.05 && x <= x1 + 0.05 && z >= z0 - 0.05 && z <= z1 + 0.05) && !HELD_TALL.some(([x0, x1, z0, z1]) => x > x0 - 0.15 && x < x1 + 0.15 && z > z0 - 0.15 && z < z1 + 0.15);
function clampHeld(p) { if (heldFree(p.x, p.z)) return false; const xc = renderer.xr.isPresenting ? renderer.xr.getCamera() : camera; _hh.setFromMatrixPosition(xc.matrixWorld); if (!heldFree(_hh.x, _hh.z)) return false;
  let lo = 0, hi = 1; for (let i = 0; i < 12; i++) { const m = (lo + hi) / 2; if (heldFree(_hh.x + (p.x - _hh.x) * m, _hh.z + (p.z - _hh.z) * m)) lo = m; else hi = m; }
  p.x = _hh.x + (p.x - _hh.x) * lo; p.z = _hh.z + (p.z - _hh.z) * lo; return true; }
const _tp = new THREE.Vector3(), _tq = new THREE.Quaternion();
function updateHold(dt) { const H = GRAB.held; if (!H) return; const h = H.b.holder; H.t += dt;
  if (H.phase === 'pull') { holdTarget(H, _tp, _tq); const u = Math.min(1, H.t / H.dur), e = u * u * (3 - 2 * u);
    h.position.lerpVectors(H.from.pos, _tp, e); h.position.y += Math.sin(u * Math.PI) * (H.dur > 0.3 ? 0.08 : 0); // slight float
    h.quaternion.slerpQuaternions(H.from.quat, _tq, e); if (H.dur > 0.3) h.quaternion.multiply(_q.setFromAxisAngle(_s.set(0, 1, 0), (1 - e) * Math.PI * 2)); // spin in
    if (u >= 1) { H.phase = 'held'; if (H.mode === 'grip-near') { H.ctl.updateMatrixWorld(); H.grabOff = new THREE.Matrix4().copy(H.ctl.matrixWorld).invert().multiply(h.matrixWorld.clone().compose(h.position, h.quaternion, h.scale)); } } }
  else if (H.phase === 'held') { holdTarget(H, _tp, _tq); h.position.lerp(_tp, 1 - Math.exp(-dt * 20)); h.quaternion.slerp(_tq, 1 - Math.exp(-dt * 20)); }
  else if (H.phase === 'return') { const b = H.b, hp = b.home.parent; hp.updateMatrixWorld(); _mm.compose(b.home.pos, b.home.quat, b.home.scale).premultiply(hp.matrixWorld); _mm.decompose(_tp, _tq, _s);
    const u = Math.min(1, H.t / 0.8), e = u * u * (3 - 2 * u); h.position.lerpVectors(H.from.pos, _tp, e); h.position.y += Math.sin(u * Math.PI) * 0.06; h.quaternion.slerpQuaternions(H.from.quat, _tq, e); if (u >= 1) endHold(); } }
// VR: grip near = grab; point + trigger (or grip) = force pull; release = float back. Pointing highlights the build (1 line box, hides the other ray).
function xrGrab(dt) { if (!renderer.xr.isPresenting) { if (GRAB.held && GRAB.held.mode !== 'inspect') endHold(); GRAB.hl.visible = false; return; }
  let hlSet = false;
  for (const c of xrCtl) { const gp = c.userData.src?.gamepad; if (!gp) continue; const trig = !!gp.buttons[0]?.pressed, grip = !!gp.buttons[1]?.pressed, pt = c.userData.prevT, pg = c.userData.prevG; c.userData.prevT = trig; c.userData.prevG = grip;
    const H = GRAB.held;
    if (H && H.ctl === c) { const btn = H.btn === 'grip' ? grip : trig; if (!btn) { releaseHold(); c.userData.claim = trig; } continue; }
    if (!trig && c.userData.claim && !(H && H.ctl === c)) c.userData.claim = false; // trigger released after a guestbook/build click
    _m4.identity().extractRotation(c.matrixWorld); _ray2.ray.origin.setFromMatrixPosition(c.matrixWorld); _ray2.ray.direction.set(0, 0, -1).applyMatrix4(_m4);
    const pick = H ? null : pickBuild(_ray2.ray), near = H ? null : nearBuild(_ray2.ray.origin);
    if (pick && !hlSet) { const bx = buildBox(pick.b); bx.getCenter(GRAB.hl.position); bx.getSize(GRAB.hl.scale).multiplyScalar(1.06); GRAB.hlCtl = c; hlSet = true; const ln = ctlRay(c); if (ln) { ln.scale.z = pick.d; ln.material.color.set(0x7ff0e2); c.userData.tint = true; } }
    if ((pick || near) && trig && !pt) c.userData.claim = true; // trigger started on a build: not a teleport
    if (!pick && c.userData.tint) { c.userData.tint = false; const ln = ctlRay(c); if (ln && XRM.aim?.c !== c) { ln.scale.z = 3; ln.material.color.set(0xffffff); } }
    if (!H && grip && !pg && near) { startHold(near, 'grip-near', c); GRAB.held.btn = 'grip'; continue; }
    if (!H && ((trig && !pt) || (grip && !pg)) && pick) { startHold(pick.b, 'pull', c); GRAB.held.btn = trig && !pt ? 'trigger' : 'grip'; continue; } }
  GRAB.hl.visible = hlSet && !GRAB.held; if (!hlSet) GRAB.hlCtl = null; }
// XR select on the guestbook toggles its read view
for (const c of xrCtl) c.addEventListener('selectstart', () => { if (!renderer.xr.isPresenting || !cantina.visible) return; _m4.identity().extractRotation(c.matrixWorld); _ray2.ray.origin.setFromMatrixPosition(c.matrixWorld); _ray2.ray.direction.set(0, 0, -1).applyMatrix4(_m4);
  const hit = _ray2.intersectObjects([gb.mesh, gb.readView.mesh, ...dj.pickables], false)[0]; if (!hit) return; c.userData.claim = true; if (dj.onSelect(hit.object, true)) return; if (hit.distance > 3.5 && !gb.readView.mesh.visible) return; /* read view opens within 3.5 m of the book (keeps the door view in budget) */ if (gb.readView.next()) gb.refresh(); }); // closed -> notes -> music credits -> closed
// desktop / phone: tap the guestbook -> modal; tap a build -> inspect; drag rotates it; tap away / Esc returns it
const tapD = { id: null, x: 0, y: 0, t: 0, rot: false };
const inspecting = () => GRAB.held?.mode === 'inspect' && GRAB.held.phase !== 'return'; // a build flying back to its slot no longer eats taps
addEventListener('pointerdown', e => { if (e.target !== renderer.domElement || renderer.xr.isPresenting) return; Object.assign(tapD, { id: e.pointerId, x: e.clientX, y: e.clientY, t: performance.now(), lx: e.clientX, ly: e.clientY });
  if (inspecting()) { e.stopPropagation(); } }, true);
addEventListener('pointermove', e => { if (e.pointerId !== tapD.id || !inspecting()) return; const dx = e.clientX - tapD.lx, dy = e.clientY - tapD.ly; tapD.lx = e.clientX; tapD.ly = e.clientY;
  GRAB.inspectRot.premultiply(_q.setFromAxisAngle(_s.set(0, 1, 0), dx * 0.01)).premultiply(_q2.setFromAxisAngle(_s.set(1, 0, 0), dy * 0.01)); e.stopPropagation(); }, true);
/* pointerup is never stopped (OrbitControls must see it or it stays in 'rotate'); consumed taps are flagged for the walk handler instead */
addEventListener('pointerup', e => { if (e.pointerId !== tapD.id) return; tapD.id = null; const tap = Math.hypot(e.clientX - tapD.x, e.clientY - tapD.y) < 10 && performance.now() - tapD.t < 900;
  if (inspecting()) { e.__ffConsumed = true; if (tap) { _ray2.setFromCamera(new THREE.Vector2(e.clientX / innerWidth * 2 - 1, -(e.clientY / innerHeight) * 2 + 1), camera);
      const hb = GRAB.held.b.holder; if (!_ray2.intersectObject(hb, true).some(h => { for (let o = h.object; o && o !== hb.parent; o = o.parent) if (!o.visible) return false; return true; })) releaseHold(); } return; } // T1: tap off the build's meshes releases (the bbox covered most of a phone screen)
  if (!tap || gb.modalOpen || dj.requestOpen) return; _ray2.setFromCamera(new THREE.Vector2(e.clientX / innerWidth * 2 - 1, -(e.clientY / innerHeight) * 2 + 1), camera);
  if (cantina.visible) { const dh = _ray2.intersectObjects(dj.pickables, false)[0], bh = _ray2.intersectObject(gb.mesh, false)[0];
    if (dh && (!bh || dh.distance < bh.distance)) { e.__ffConsumed = true; dj.onSelect(dh.object, false); return; } if (bh) { e.__ffConsumed = true; gb.openModal(); return; } }
  const pk = pickBuild(_ray2.ray, 12); if (pk) { e.__ffConsumed = true; startHold(pk.b, 'inspect', null); } }, true);
addEventListener('keydown', e => { if (e.key === 'Escape' && GRAB.held?.mode === 'inspect') releaseHold(); });
function setWalk(on) { walk.on = on; joy.style.display = on && IS_TOUCH && !renderer.xr.isPresenting ? 'block' : 'none'; controls.enabled = !on && !look.on; if (on) { walk.syncFromCamera(); showHint(); } }
renderer.xr.addEventListener('sessionstart', () => { joy.style.display = 'none'; walk.joy = [0, 0]; walk.goal = null; });


// ---------- ?testroom: 4 dummy avatars at spawns 1-4 (tagged 'avatar', never merged) to measure headroom ----------
if (TESTROOM) { const g = mergeGeometries([new THREE.CapsuleGeometry(0.18, 0.9, 4, 10).translate(0, 0.9, 0), new THREE.SphereGeometry(0.13, 12, 8).translate(0, 1.62, 0)]);
  const am = new THREE.MeshStandardMaterial({ color: 0x8fb7c9, roughness: 0.4 });
  for (let i = 1; i < MAX_USERS; i++) { const s = SPAWNS[i], a = new THREE.Mesh(g, am); a.position.set(s.x, 0, s.z); a.userData.avatar = true; a.userData.peerId = 'test-' + i; scene.add(a); } }

// ---------- status ----------
function status(force) { if (force) statusFrames = 1; }
function writeStatus() { overlay.status(`N=${N} px · cove ${P.toFixed(2)} m · u window ${U.window[0].toFixed(3)}–${U.window[1].toFixed(3)} · u builds ${U.builds[0].toFixed(3)}–${U.builds[1].toFixed(3)} · brackets ${brackets.length} (${bracketStatus}) · builds ${buildsInfo} · props ${propTris} tris · room ${roomLabel(roomNow)} · Owl Cove ${cantInfo} · draws ${drawCalls}${lowNow ? ' · LOW' : ''}${TESTROOM ? ' · TESTROOM' : ''}`); }

window.LOFT = { scene, renderer, rig, camera, controls, setLow: on => setLow(on), get lodObjs() { return lodObjs; }, rooms: { hall, passage, cantina }, get room() { return roomNow; }, get ledStrip() { return ledStrip; }, N, perimeter: P, U, store, api, setView, spawns: SPAWNS, groupSpots: GROUP_SPOTS, MAX_USERS, net,
  get lowNow() { return lowNow; }, get reliefSize() { return reliefSize; }, get drawCalls() { return drawCalls; }, layout: { HALL, VEST, COVE, BW, GATHER, PIT, WINDOW, NOOK, PLINTHS } };
applyPreset('dusk'); setView('hall'); setWalk(walk.on); if (!walk.on) walk.syncFromCamera(); window.LOFT.walk = walk; window.LOFT.gb = gb; window.LOFT.bot = bot; window.LOFT.dj = dj; window.LOFT.raycasterCtor = THREE.Raycaster; window.LOFT.robots = robotsMesh; window.LOFT.grab = { GRAB, buildHolders, startHold, releaseHold, pickBuild, mergeSlots, clampHeld }; window.LOFT.musicGain = musicGain; window.LOFT.walkable = walkable; window.LOFT.xrm = { XRM, tpMarker, vignette, xrCtl, nearestFree, comfort: comfortApi };

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
  const t = clock.getElapsedTime(); walkUpdate(); { const nowG = performance.now(), dtG = Math.min(0.1, (nowG - (GRAB.last ?? nowG)) / 1000); GRAB.last = nowG; xrGrab(dtG); updateHold(dtG); } xrLocomotion(); updateBartender(); applyLook();
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
