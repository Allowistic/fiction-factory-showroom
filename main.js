import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { VRButton } from 'three/addons/webxr/VRButton.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { ROOM, LED, BRACKET, QUALITY } from './config.js';
import { walls, perimeter, wallU } from './room.js';
import { createEngine } from './scenes.js';
import { createXRPanel } from './panel-xr.js';
import { initOverlay } from './panel-html.js';
import { buildSeventies } from './seventies.js';

const low = QUALITY.low;
const renderer = new THREE.WebGLRenderer({ antialias: !low, powerPreference: 'high-performance', preserveDrawingBuffer: false });
renderer.setPixelRatio(Math.min(devicePixelRatio, low ? 1 : 2));
renderer.setSize(innerWidth, innerHeight);
renderer.xr.enabled = true;
renderer.xr.setFramebufferScaleFactor(0.8); // Quest fill-rate budget (Penny QA)
renderer.xr.setFoveation?.(1);
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;
renderer.shadowMap.enabled = !low; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);
const vrBtn = VRButton.createButton(renderer); document.body.appendChild(vrBtn);
// friendlier "no XR" text (VRButton writes 'WEBXR NOT AVAILABLE' / 'VR NOT SUPPORTED')
const fixVRText = () => { if (/NOT (AVAILABLE|SUPPORTED)/i.test(vrBtn.textContent)) { vrBtn.textContent = 'For VR, open this link in the Quest Browser'; vrBtn.style.width = '300px'; vrBtn.style.left = 'calc(50% - 150px)'; vrBtn.removeAttribute('href'); } };
new MutationObserver(fixVRText).observe(vrBtn, { childList: true, characterData: true, subtree: true }); fixVRText();

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0b0b0d);
const W = ROOM.width, D = ROOM.depth, H = ROOM.ceilingHeight;
const camera = new THREE.PerspectiveCamera(70, innerWidth / innerHeight, 0.02, 50);
const rig = new THREE.Group(); scene.add(rig); rig.add(camera);
const controls = new OrbitControls(camera, renderer.domElement);
// fixed named views (entry view = default + screenshot camera)
const VIEWS = {
  entry: { p: [0.35, 1.62, 0.55], t: [1.75, 1.25, 3.4] },
  make: { p: [3.5, 1.65, 2.6], t: [5.6, 1.3, 1.3] },
  dbg: { p: [1.0, 1.6, 1.4], t: [0, 2.6, 0.4] },
  desk: { p: [2.1, 1.55, 1.9], t: [1.1, 0.85, 0.35] },
};
function setView(n) { const v = VIEWS[n]; camera.position.set(...v.p); controls.target.set(...v.t); controls.update(); }
setView('entry');
// ---------- phone fallback: 'Look around' (device orientation at the entry, 1.6 m eye height) ----------
const look = { on: false, a: null, b: null, g: null, yawOff: 0, dragX: null };
const lookBtn = document.createElement('button'); lookBtn.textContent = 'Look around';
lookBtn.style.cssText = 'position:fixed;bottom:70px;left:50%;transform:translateX(-50%);padding:12px 20px;border:1px solid #fff;border-radius:6px;background:rgba(0,0,0,.6);color:#fff;font:14px system-ui;z-index:999;display:none';
document.body.appendChild(lookBtn);
(navigator.xr?.isSessionSupported?.('immersive-vr') ?? Promise.resolve(false)).catch(() => false).then(ok => { if (!ok) lookBtn.style.display = 'block'; });
const onOri = e => { if (e.alpha == null) return; look.a = e.alpha; look.b = e.beta; look.g = e.gamma; };
lookBtn.addEventListener('click', async () => {
  if (look.on) { look.on = false; controls.enabled = true; lookBtn.textContent = 'Look around'; setView('entry'); return; }
  try { if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') { // iOS: must be inside the tap
      if (await DeviceOrientationEvent.requestPermission() !== 'granted') { lookBtn.textContent = 'Motion access denied'; return; } } }
  catch (err) { console.warn('orientation permission', err); }
  addEventListener('deviceorientation', onOri);
  look.on = true; controls.enabled = false; look.yawOff = 0; lookBtn.textContent = 'Back to orbit';
  camera.position.set(0.6, 1.6, 0.6);
});
const _z = new THREE.Vector3(0, 0, 1), _e = new THREE.Euler(), _q0 = new THREE.Quaternion(), _q1 = new THREE.Quaternion(-Math.sqrt(0.5), 0, 0, Math.sqrt(0.5)), _qy = new THREE.Quaternion();
const ENTRY_YAW = Math.atan2(-0.55, -0.83); // face into the room
function applyLook() {
  if (!look.on) return;
  camera.position.set(0.6, 1.6, 0.6);
  if (look.a == null) { camera.quaternion.setFromEuler(_e.set(0, ENTRY_YAW + look.yawOff, 0)); return; }
  const D2R = Math.PI / 180, orient = (screen.orientation?.angle ?? window.orientation ?? 0) * D2R;
  _e.set(look.b * D2R, look.a * D2R, -look.g * D2R, 'YXZ');
  camera.quaternion.setFromEuler(_e).multiply(_q1).multiply(_q0.setFromAxisAngle(_z, -orient));
  camera.quaternion.premultiply(_qy.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, look.yawOff));
}
renderer.domElement.addEventListener('pointerdown', e => { if (look.on) look.dragX = e.clientX; });
addEventListener('pointermove', e => { if (look.on && look.dragX != null) { look.yawOff += (e.clientX - look.dragX) * 0.005; look.dragX = e.clientX; } });
addEventListener('pointerup', () => { look.dragX = null; });
// XR: stand at the entry, facing into the room (toward the display shelf / far wall)
const ENTRY = { x: 0.6, z: 0.6, fx: 0.55, fz: 0.83 };
renderer.xr.addEventListener('sessionstart', () => { setLow(true); rig.position.set(ENTRY.x, 0, ENTRY.z); rig.rotation.y = Math.atan2(-ENTRY.fx, -ENTRY.fz); placePanelFrames = 12; });
renderer.xr.addEventListener('sessionend', () => { setLow(low); rig.position.set(0, 0, 0); rig.rotation.y = 0; setView('entry'); });

// ---------- procedural textures (<=1024) ----------
function canvasTex(size, draw, repeat = 1, srgb = true) {
  const c = document.createElement('canvas'); c.width = c.height = size; draw(c.getContext('2d'), size);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat, repeat);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
const rnd = (() => { let s = 7; return () => ((s = (s * 16807) % 2147483647) / 2147483647); })();
const woodTex = canvasTex(low ? 512 : 1024, (g, s) => {
  g.fillStyle = '#7a5d42'; g.fillRect(0, 0, s, s);
  const planks = 8, pw = s / planks;
  for (let i = 0; i < planks; i++) {
    const l = 0.88 + rnd() * 0.22; g.fillStyle = `rgba(${122 * l | 0},${93 * l | 0},${66 * l | 0},1)`; g.fillRect(i * pw, 0, pw, s);
    for (let k = 0; k < 40; k++) { g.strokeStyle = `rgba(40,25,12,${0.04 + rnd() * 0.06})`; g.lineWidth = 0.5 + rnd() * 1.5;
      const x = i * pw + rnd() * pw; g.beginPath(); g.moveTo(x, 0); g.bezierCurveTo(x + 4 - rnd() * 8, s * 0.3, x + 4 - rnd() * 8, s * 0.7, x, s); g.stroke(); }
    g.fillStyle = 'rgba(20,12,6,0.5)'; g.fillRect(i * pw, 0, 1.5, s); g.fillRect(i * pw, (rnd() * s) | 0, pw, 1.5);
  }
}, 1);
woodTex.repeat.set(W / 2.4, D / 2.4);
const plasterTex = canvasTex(256, (g, s) => {
  const d = g.createImageData(s, s);
  for (let i = 0; i < s * s; i++) { const v = 200 + rnd() * 55; d.data[i * 4] = d.data[i * 4 + 1] = d.data[i * 4 + 2] = v; d.data[i * 4 + 3] = 255; }
  g.putImageData(d, 0, 0); g.filter = 'blur(1px)'; g.drawImage(g.canvas, 0, 0);
}, 4, false);
const aoTex = canvasTex(64, (g, s) => { g.fillStyle = '#000'; g.fillRect(0, 0, s, s); const gr = g.createLinearGradient(0, 0, 0, s); gr.addColorStop(0, '#fff'); gr.addColorStop(0.35, '#595959'); gr.addColorStop(1, '#000'); g.fillStyle = gr; g.fillRect(0, 0, s, s); });
aoTex.wrapS = aoTex.wrapT = THREE.ClampToEdgeWrapping;
const blobTex = canvasTex(64, (g, s) => { g.fillStyle = '#000'; g.fillRect(0, 0, s, s); const gr = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2); gr.addColorStop(0, '#e6e6e6'); gr.addColorStop(0.6, '#666'); gr.addColorStop(1, '#000'); g.fillStyle = gr; g.fillRect(0, 0, s, s); });
blobTex.wrapS = blobTex.wrapT = THREE.ClampToEdgeWrapping;
const glowTex = canvasTex(64, (g, s) => { g.fillStyle = '#000'; g.fillRect(0, 0, s, s); const gr = g.createLinearGradient(0, 0, 0, s); gr.addColorStop(0, '#fff'); gr.addColorStop(1, '#000'); g.fillStyle = gr; g.fillRect(0, 0, s, s); });
glowTex.wrapS = glowTex.wrapT = THREE.ClampToEdgeWrapping;
function skyTex(stops) { return canvasTex(128, (g, s) => { const gr = g.createLinearGradient(0, 0, 0, s); stops.forEach(([o, c]) => gr.addColorStop(o, c)); g.fillStyle = gr; g.fillRect(0, 0, s, s); }); }

// ---------- materials ----------
const wallMat = new THREE.MeshStandardMaterial({ color: 0xeadfc6, roughness: 0.92, roughnessMap: plasterTex, bumpMap: plasterTex, bumpScale: 0.6, shadowSide: THREE.DoubleSide });
const ceilMat = new THREE.MeshStandardMaterial({ color: 0xefebe3, roughness: 0.95 });
const floorMat = new THREE.MeshStandardMaterial({ map: woodTex, roughness: 0.4, metalness: 0 });
const oakMat = new THREE.MeshStandardMaterial({ color: 0xa8743f, roughness: 0.5 }); // warm teak tiers
// 70s: walnut vertical-groove paneling (wall C + desk wall A), 1 texture, UVs scaled per piece
const panelTex = canvasTex(512, (g, s) => { g.fillStyle = '#5a3a22'; g.fillRect(0, 0, s, s);
  const n = 4, pw = s / n; for (let i = 0; i < n; i++) { const l = 0.85 + rnd() * 0.3; g.fillStyle = `rgb(${92 * l | 0},${60 * l | 0},${36 * l | 0})`; g.fillRect(i * pw, 0, pw, s);
    for (let k = 0; k < 30; k++) { g.strokeStyle = `rgba(30,16,8,${0.08 + rnd() * 0.1})`; g.lineWidth = 0.6 + rnd() * 1.6; const x = i * pw + rnd() * pw; g.beginPath(); g.moveTo(x, 0); g.bezierCurveTo(x + 6 - rnd() * 12, s * .3, x + 6 - rnd() * 12, s * .7, x, s); g.stroke(); }
    g.fillStyle = 'rgba(15,8,3,.85)'; g.fillRect(i * pw, 0, 3, s); } });
const panelMat = new THREE.MeshStandardMaterial({ map: panelTex, roughness: 0.5, shadowSide: THREE.DoubleSide });
const PANEL_WALLS = ['A', 'C'], PANEL_W = 0.6; // texture tile = 0.6 m (4 grooves @ 150 mm)

// ---------- labels (hidden by default; shown on hover/gaze or "labels" toggle) ----------
const hoverables = []; // { root, labels: [] }
let showLabels = false;
function label(text, x, y, scale = 1) {
  const c = document.createElement('canvas'); c.width = 512; c.height = 64;
  const g = c.getContext('2d'); g.fillStyle = 'rgba(0,0,0,0.6)'; g.fillRect(0, 0, 512, 64);
  g.fillStyle = '#fff'; g.font = '28px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, 256, 32);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Mesh(new THREE.PlaneGeometry(0.8 * scale, 0.1 * scale), new THREE.MeshBasicMaterial({ map: t, transparent: true, depthTest: false, toneMapped: false }));
  s.position.set(x, y, 0.01); s.renderOrder = 10; s.visible = false; s.raycast = () => {}; return s;
}
function hoverable(root, ...labels) { hoverables.push({ root, labels }); }
function setLabelsVisible(hoverRoot) { for (const h of hoverables) { const v = showLabels || h === hoverRoot; for (const l of h.labels) l.visible = v; } }

// ---------- room shell ----------
const floor = new THREE.Mesh(new THREE.PlaneGeometry(W, D), floorMat);
floor.rotation.x = -Math.PI / 2; floor.position.set(W / 2, 0, D / 2); floor.receiveShadow = true; scene.add(floor);
const ceil = new THREE.Mesh(new THREE.PlaneGeometry(W, D), ceilMat);
ceil.rotation.x = Math.PI / 2; ceil.position.set(W / 2, H, D / 2); scene.add(ceil);
const windowPanes = [];
for (const w of walls()) {
  const dx = (w.b[0] - w.a[0]) / w.len, dz = (w.b[1] - w.a[1]) / w.len;
  const ry = Math.atan2(w.n[0], w.n[1]);
  const at = (s, y, off = 0) => new THREE.Vector3(w.a[0] + dx * s + w.n[0] * off, y, w.a[1] + dz * s + w.n[1] * off);
  // wall split into rectangles around windows (so the sun only enters through the glass)
  const wins = ROOM.openings.filter(o => o.wall === w.id && o.type === 'window').sort((a, b) => a.offset - b.offset);
  const rects = []; let s0 = 0;
  for (const o of wins) {
    rects.push([s0, o.offset, 0, H], [o.offset, o.offset + o.width, 0, o.sill], [o.offset, o.offset + o.width, o.sill + o.height, H]);
    s0 = o.offset + o.width;
  }
  rects.push([s0, w.len, 0, H]);
  const wallGroup = new THREE.Group(); scene.add(wallGroup);
  for (const [a, b, y0, y1] of rects) {
    if (b - a < 1e-3 || y1 - y0 < 1e-3) continue;
    const pg = new THREE.PlaneGeometry(b - a, y1 - y0), panel = PANEL_WALLS.includes(w.id);
    if (panel) { const uv = pg.attributes.uv; for (let k = 0; k < uv.count; k++) uv.setXY(k, (a + uv.getX(k) * (b - a)) / PANEL_W, (y0 + uv.getY(k) * (y1 - y0)) / 2.7); }
    const m = new THREE.Mesh(pg, panel ? panelMat : wallMat);
    m.position.copy(at((a + b) / 2, (y0 + y1) / 2)); m.rotation.y = ry;
    m.receiveShadow = true; m.castShadow = w.id === ROOM.windowWall && y0 === 0 && y1 === H; wallGroup.add(m); // only the sunlit window wall casts (shadow budget ≤5)
  }
  for (const o of ROOM.openings.filter(o => o.wall === w.id)) {
    const c = o.offset + o.width / 2;
    if (o.type === 'window') {
      const pane = new THREE.Mesh(new THREE.PlaneGeometry(o.width, o.height), new THREE.MeshBasicMaterial({ toneMapped: false }));
      pane.position.copy(at(c, o.sill + o.height / 2, -0.04)); pane.rotation.y = ry; scene.add(pane); windowPanes.push(pane);
      const frameMat = new THREE.MeshStandardMaterial({ color: 0xf2f0ea, roughness: 0.6 });
      const sill = new THREE.Mesh(new THREE.BoxGeometry(o.width + 0.08, 0.025, 0.12), frameMat);
      sill.position.copy(at(c, o.sill - 0.012, 0.04)); sill.rotation.y = ry; sill.castShadow = sill.receiveShadow = true; scene.add(sill);
      const mull = new THREE.Mesh(new THREE.BoxGeometry(0.03, o.height, 0.04), frameMat);
      mull.position.copy(at(c, o.sill + o.height / 2, -0.02)); mull.rotation.y = ry; mull.castShadow = false; scene.add(mull);
      const lb = label('WINDOW (placeholder)', 0, o.height / 2 + 0.12); pane.add(lb); lb.position.z = 0.05; hoverable(pane, lb);
    } else {
      const door = new THREE.Mesh(new THREE.PlaneGeometry(o.width, o.height), new THREE.MeshStandardMaterial({ color: 0x3a2f27, roughness: 0.7 }));
      door.position.copy(at(c, o.sill + o.height / 2, 0.004)); door.rotation.y = ry; scene.add(door);
      const lb = label(o.type.toUpperCase() + ' (placeholder)', 0, o.height / 2 + 0.12); door.add(lb); hoverable(door, lb);
    }
  }
  const um = wallU(w.id);
  const tag = w.id === ROOM.windowWall ? ' · WINDOW WALL' : w.id === ROOM.makeWall ? ' · MAKE WALL' : '';
  const lb = label(`Wall ${w.id}${tag}  u ${um[0].toFixed(2)}–${um[1].toFixed(2)}`, 0, 0);
  lb.position.copy(at(w.len / 2, 2.25, 0.02)); lb.rotation.y = ry; scene.add(lb); hoverable(wallGroup, lb);
}

// ---------- fake AO: one merged mesh of gradient strips (floor/wall seams + vertical corners) ----------
{
  const geos = [], ao = 0.28;
  for (const w of walls()) {
    const dx = (w.b[0] - w.a[0]) / w.len, dz = (w.b[1] - w.a[1]) / w.len, ry = Math.atan2(w.n[0], w.n[1]);
    const mid = [(w.a[0] + w.b[0]) / 2, (w.a[1] + w.b[1]) / 2];
    let g = new THREE.PlaneGeometry(w.len, ao); g.rotateX(-Math.PI / 2); g.rotateY(ry); // floor strip, dark edge at wall
    g.translate(mid[0] + w.n[0] * ao / 2, 0.002, mid[1] + w.n[1] * ao / 2); geos.push(g);
    g = new THREE.PlaneGeometry(w.len, ao * 0.8); g.rotateZ(Math.PI); g.rotateY(ry); // wall strip, dark at floor
    g.translate(mid[0] + w.n[0] * 0.003, ao * 0.4, mid[1] + w.n[1] * 0.003); geos.push(g);
    for (const end of [0, 1]) { // vertical corner shading on this wall near each end
      g = new THREE.PlaneGeometry(H, 0.22); g.rotateZ(end ? -Math.PI / 2 : Math.PI / 2); g.rotateY(ry);
      const s = end ? w.len - 0.11 : 0.11; g.translate(w.a[0] + dx * s + w.n[0] * 0.004, H / 2, w.a[1] + dz * s + w.n[1] * 0.004); geos.push(g);
    }
  }
  const aoMesh = new THREE.Mesh(mergeGeometries(geos), new THREE.MeshBasicMaterial({ map: aoTex, transparent: true, opacity: 0.45, depthWrite: false, color: 0x000000, alphaMap: aoTex }));
  aoMesh.material.map = null; aoMesh.renderOrder = 1; scene.add(aoMesh);
}
const blobGeos = [];
function aoBlob(x, z, w, d, rotY = 0) { const g = new THREE.PlaneGeometry(w * 1.35, d * 1.35); g.rotateX(-Math.PI / 2); g.rotateY(rotY); g.translate(x, 0.003, z); blobGeos.push(g); }
function flushBlobs() {
  if (!blobGeos.length) return;
  const m = new THREE.Mesh(mergeGeometries(blobGeos.splice(0)), new THREE.MeshBasicMaterial({ color: 0x000000, alphaMap: blobTex, transparent: true, opacity: 0.55, depthWrite: false }));
  m.renderOrder = 1; scene.add(m);
}

// ---------- LED strip ----------
const P = perimeter();
const N = Math.round(P * LED.pixelsPerMeter);
const inset = LED.insetFromCorner_m;
const colors = new Float32Array(N * 3);
const tex = new THREE.DataTexture(new Uint8Array(N * 4), N, 1, THREE.RGBAFormat);
tex.magFilter = THREE.LinearFilter; tex.minFilter = THREE.LinearFilter; tex.needsUpdate = true;
const engine = createEngine(N);
engine.setScene('ambient', 0);

function pointAt(u) {
  let s = u * P;
  for (const w of walls()) {
    if (s <= w.len + 1e-9) { const t = s / w.len; return { x: w.a[0] + (w.b[0] - w.a[0]) * t + w.n[0] * inset, z: w.a[1] + (w.b[1] - w.a[1]) * t + w.n[1] * inset, w }; }
    s -= w.len;
  }
}
const pxLen = 1 / LED.pixelsPerMeter;
const pixels = new THREE.InstancedMesh(new THREE.BoxGeometry(pxLen, LED.channelSlotH_m * 0.5, LED.pcbWidth_m), new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false }), N);
// low/XR: one textured ribbon sampling the per-pixel DataTexture instead of N instances (1 draw, 8 tris)
const ribbon = (() => { const pos = [], uv = [], idx = []; let s0 = 0; const P0 = perimeter(), hh = LED.channelSlotH_m * 0.25;
  for (const w of walls()) { const ax = w.a[0] + w.n[0] * inset, az = w.a[1] + w.n[1] * inset, bx = w.b[0] + w.n[0] * inset, bz = w.b[1] + w.n[1] * inset, k = pos.length / 3;
    pos.push(ax, H - inset - hh, az, bx, H - inset - hh, bz, bx, H - inset + hh, bz, ax, H - inset + hh, az);
    const u0 = s0 / P0, u1 = (s0 + w.len) / P0; uv.push(u0, .5, u1, .5, u1, .5, u0, .5); idx.push(k, k + 1, k + 2, k, k + 2, k + 3); s0 += w.len; }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx);
  return g; })();
const chanMat = new THREE.MeshLambertMaterial({ color: 0xf4f4f2 });
const dummy = new THREE.Object3D(), tmpC = new THREE.Color();
const yStrip = H - inset;
for (let i = 0; i < N; i++) {
  const p = pointAt((i + 0.5) / N);
  dummy.position.set(p.x, yStrip, p.z);
  dummy.rotation.set(0, Math.atan2(-(p.w.b[1] - p.w.a[1]), p.w.b[0] - p.w.a[0]), 0);
  dummy.rotateX(Math.PI / 4); dummy.updateMatrix(); pixels.setMatrixAt(i, dummy.matrix);
  pixels.setColorAt(i, tmpC.setRGB(0, 0, 0));
}
scene.add(pixels);
{ // channel extrusions (merged, 1 draw call)
  const gs = walls().map(w => { const g = new THREE.BoxGeometry(w.len - 2 * inset, LED.channelOuterH_m, LED.channelOuterW_m); g.rotateX(Math.PI / 4);
    g.rotateY(Math.atan2(-(w.b[1] - w.a[1]), w.b[0] - w.a[0])); g.translate((w.a[0] + w.b[0]) / 2 + w.n[0] * (inset + 0.008), yStrip - 0.006, (w.a[1] + w.b[1]) / 2 + w.n[1] * (inset + 0.008)); return g; });
  scene.add(new THREE.Mesh(mergeGeometries(gs), chanMat));
}
// fascia / valance: 125 mm board, bottom 100 mm (~4 in) below the strip, 150 mm off the wall; open 30 mm at the ceiling so only the wash shows
const FASCIA = { off: 0.15, h: 0.125, bottom: yStrip - 0.10, t: 0.018 };
{
  const gs = walls().map(w => { const g = new THREE.BoxGeometry(w.len - 2 * FASCIA.off + FASCIA.t, FASCIA.h, FASCIA.t);
    g.rotateY(Math.atan2(w.n[0], w.n[1])); g.translate((w.a[0] + w.b[0]) / 2 + w.n[0] * FASCIA.off, FASCIA.bottom + FASCIA.h / 2, (w.a[1] + w.b[1]) / 2 + w.n[1] * FASCIA.off); return g; });
  const f = new THREE.Mesh(mergeGeometries(gs), new THREE.MeshStandardMaterial({ color: 0xece8e0, roughness: 0.85 }));
  f.receiveShadow = true; scene.add(f);
}
// cove wash: smooth emissive gradient on the ceiling (0.9 m) + short band on the wall above the fascia, driven by the pixel buffer
const washMat = new THREE.ShaderMaterial({
  uniforms: { strip: { value: tex }, gain: { value: 1.0 } },
  vertexShader: `attribute float u; attribute float v; varying float vu; varying float vv;
    void main(){ vu=u; vv=v; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
  fragmentShader: `uniform sampler2D strip; uniform float gain; varying float vu; varying float vv;
    void main(){
      // average neighbouring pixels (light diffuses before it lands) -> no beads, no hot spots
      vec3 c=vec3(0.); for(int k=-3;k<=3;k++) c+=texture2D(strip,vec2(vu+float(k)*0.0012,.5)).rgb; c/=7.;
      float f=pow(1.-vv,2.4)*smoothstep(0.,.06,vv+.02);
      vec3 o=pow(c,vec3(1./2.2))*f*gain; o=o/(1.+o); // soft clip, never blows out to white
      gl_FragColor=vec4(o,1.); }`,
  transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
});
const washSeg = low ? 64 : 160;
{
  let su = 0; const gs = [];
  for (const w of walls()) {
    const u0 = su / P, u1 = (su + w.len) / P; su += w.len;
    for (const [surf, depth] of [['ceil', 0.9], ['wall', 0.12]]) {
      const pos = [], uu = [], vv = [], idx = [];
      for (let i = 0; i <= washSeg; i++) {
        const t = i / washSeg, x = w.a[0] + (w.b[0] - w.a[0]) * t, z = w.a[1] + (w.b[1] - w.a[1]) * t;
        for (let j = 0; j <= 1; j++) {
          const d = j * depth;
          if (surf === 'ceil') pos.push(x + w.n[0] * d, H - 0.002, z + w.n[1] * d); else pos.push(x + w.n[0] * 0.003, H - d, z + w.n[1] * 0.003);
          uu.push(u0 + (u1 - u0) * t); vv.push(surf === 'ceil' ? j : j * 0.6);
        }
        if (i < washSeg) { const k = i * 2; idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); }
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.setAttribute('u', new THREE.Float32BufferAttribute(uu, 1)); g.setAttribute('v', new THREE.Float32BufferAttribute(vv, 1));
      g.setIndex(idx); gs.push(g);
    }
  }
  const m = new THREE.Mesh(mergeGeometries(gs), washMat); m.renderOrder = 2; scene.add(m);
}
// cove contributes a soft, even fill (no point lights): ambient tinted by the average strip colour
const coveFill = new THREE.AmbientLight(0xffffff, 0); scene.add(coveFill);

// ---------- daylight: sky ambient + low directional sun through the window ----------
const hemi = new THREE.HemisphereLight(0x8a96aa, 0x2a2420, 0.35); scene.add(hemi);
const sun = new THREE.DirectionalLight(0xffa860, 3); sun.castShadow = !low;
const ledRibbon = new THREE.Mesh(ribbon, new THREE.MeshBasicMaterial({ map: tex, color: new THREE.Color(3, 3, 3), toneMapped: false, side: THREE.DoubleSide })); ledRibbon.visible = false; scene.add(ledRibbon);
let lowNow = low;
// ---- static batch (low / XR): merge every static opaque mesh per material; untextured standard mats collapse into one vertex-coloured mat ----
let vcMat = null, merges = 0;
function staticMerge() {
  const skip = new Set([pixels, ledRibbon, bracketGroup, xrPanel?.group].filter(Boolean)), groups = new Map(), take = [];
  scene.updateMatrixWorld(true);
  scene.traverse(o => {
    if (o.isLOD) { o.levels.forEach((l, k) => { l.object.visible = k === o.levels.length - 1; }); o.autoUpdate = false; }
  });
  const visible = o => { for (let x = o; x; x = x.parent) { if (!x.visible || skip.has(x)) return false; } return true; };
  scene.traverse(o => {
    if (!o.isMesh || o.isInstancedMesh || o.isSkinnedMesh || Array.isArray(o.material) || !visible(o)) return;
    const m = o.material; if (m.transparent || m.isShaderMaterial || o.renderOrder || o.userData.noMerge) return;
    const g = o.geometry, attrs = Object.keys(g.attributes).filter(a => a !== 'color').sort().join(',');
    const plain = (m.isMeshStandardMaterial || m.isMeshLambertMaterial) && !m.map && !m.normalMap && !m.roughnessMap && !m.emissiveMap && !m.alphaMap && !m.metalnessMap && !m.aoMap;
    const key = (plain ? 'vc' + m.side : m.uuid) + '|' + attrs + '|' + (g.index ? 1 : 0) + '|' + o.castShadow;
    if (!groups.has(key)) groups.set(key, { plain, mat: m, items: [] }); groups.get(key).items.push(o); take.push(o);
  });
  if (!vcMat) vcMat = [0, 1, 2].map(side => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, side }));
  let before = 0, after = 0;
  for (const [key, G] of groups) {
    if (G.items.length < 2 && !G.plain) continue;
    const gs = G.items.map(o => { const g = o.geometry.clone(); g.applyMatrix4(o.matrixWorld);
      for (const a of Object.keys(g.attributes)) if (!['position', 'normal', 'uv', 'color'].includes(a)) g.deleteAttribute(a);
      if (G.plain) { const c = o.material.color, n = g.attributes.position.count, prev = g.attributes.color, arr = new Float32Array(n * 3);
        for (let i = 0; i < n; i++) { arr[i * 3] = c.r * (prev ? prev.getX(i) : 1); arr[i * 3 + 1] = c.g * (prev ? prev.getY(i) : 1); arr[i * 3 + 2] = c.b * (prev ? prev.getZ(i) : 1); }
        g.setAttribute('color', new THREE.BufferAttribute(arr, 3)); if (g.attributes.uv) g.deleteAttribute('uv'); }
      else if (g.attributes.color) g.deleteAttribute('color');
      return g; });
    let merged; try { merged = mergeGeometries(gs); } catch (e) { merged = null; } if (!merged) continue;
    const mesh = new THREE.Mesh(merged, G.plain ? vcMat[G.mat.side] : G.mat); mesh.castShadow = G.items[0].castShadow; mesh.receiveShadow = true; mesh.userData.merged = true;
    G.items.forEach(o => o.removeFromParent()); scene.add(mesh); before += G.items.length; after++;
  }
  merges++; console.info(`staticMerge #${merges}: ${before} meshes -> ${after}`);
}
let mergeT = 0; const scheduleMerge = (ms = 1200) => { clearTimeout(mergeT); mergeT = setTimeout(() => { if (lowNow) staticMerge(); }, ms); };
THREE.DefaultLoadingManager.onLoad = () => scheduleMerge(); THREE.DefaultLoadingManager.onProgress = () => scheduleMerge(); // re-batch after every late GLB
function setLow(on) { if (on && !lowNow) scheduleMerge(0); lowNow = on; pixels.visible = !on; ledRibbon.visible = on; sun.castShadow = !on; bracketGroup.visible = !on; if (on) showLabels = false; } // brackets sit behind the valance: skip them in low/XR (66 x 1.9k tris)
sun.shadow.mapSize.set(1024, 1024); sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.02; sun.shadow.radius = 3;
Object.assign(sun.shadow.camera, { left: -5, right: 5, top: 5, bottom: -5, near: 0.5, far: 20 });
const sunTarget = new THREE.Object3D(); sunTarget.position.set(W * 0.45, 0, D * 0.6); scene.add(sunTarget); sun.target = sunTarget; scene.add(sun);
const PRESETS = {
  sunset: { sun: 0xff9a4a, sunI: 3.4, sunDir: [-0.3, 0.36, -1], sky: 0x8a97b0, ground: 0x3a3430, hemiI: 1.0, kelvin: 2700, cove: 0.45, task: false,
    window: [[0, '#f6a35b'], [0.45, '#ef8a7a'], [1, '#c76d93']], bg: 0x120d10, exposure: 1.0 },
  day: { sun: 0xfff1dc, sunI: 3.0, sunDir: [0.4, 0.75, -1], sky: 0xdfe7f2, ground: 0xb8a690, hemiI: 1.4, kelvin: 3000, cove: 0.25, task: false,
    window: [[0, '#8fbbe8'], [1, '#d8e8f6']], bg: 0x1a1d22, exposure: 1.0 },
  night: { sun: 0x000000, sunI: 0, sunDir: [0, 1, -1], sky: 0x1c2436, ground: 0x0a0a0c, hemiI: 0.25, kelvin: 2700, cove: 1.0, task: true,
    window: [[0, '#0b1424'], [1, '#18233a']], bg: 0x050507, exposure: 1.1 },
};
const windowTex = {}; for (const k in PRESETS) windowTex[k] = skyTex(PRESETS[k].window);
let preset = 'sunset';
function applyPreset(k) {
  const p = PRESETS[preset = k];
  sun.color.set(p.sun); sun.intensity = p.sunI; sun.visible = p.sunI > 0;
  const d = new THREE.Vector3(...p.sunDir).normalize(); sun.position.copy(sunTarget.position).addScaledVector(d, 9);
  hemi.color.set(p.sky); hemi.groundColor.set(p.ground); hemi.intensity = p.hemiI;
  for (const pane of windowPanes) { pane.material.map = windowTex[k]; pane.material.needsUpdate = true; }
  scene.background.set(p.bg); renderer.toneMappingExposure = p.exposure;
  engine.fx.params.ambient.kelvin = p.kelvin; engine.state.brightness = p.cove;
  engine.setScene('ambient', clock.getElapsedTime()); setTask(p.task);
}

// ---------- brackets (hidden behind the fascia) ----------
const brackets = [];
for (const w of walls()) { const n = Math.floor((w.len - 2 * inset) / BRACKET.spacing_m) + 1; for (let k = 0; k < n; k++) brackets.push({ w, s: inset + k * BRACKET.spacing_m }); }
const bracketGroup = new THREE.Group(); scene.add(bracketGroup);
function placeBrackets(proto) {
  bracketGroup.clear();
  for (const b of brackets) {
    const t = b.s / b.w.len, o = proto.clone();
    o.position.set(b.w.a[0] + (b.w.b[0] - b.w.a[0]) * t + b.w.n[0] * inset, yStrip, b.w.a[1] + (b.w.b[1] - b.w.a[1]) * t + b.w.n[1] * inset);
    o.rotation.y = Math.atan2(-(b.w.b[1] - b.w.a[1]), b.w.b[0] - b.w.a[0]); o.scale.setScalar(BRACKET.scale); bracketGroup.add(o);
  }
}
const draco = new DRACOLoader().setDecoderPath('https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/libs/draco/gltf/');
const loader = new GLTFLoader().setDRACOLoader(draco);
let bracketStatus = 'loading';
// Clay's GLBs: +Z out of the mount face, origin = mount-face centre -> rotate local +Z onto the wall's inward normal.
function instanceGLB(file, placements, onFail) {
  loader.load(file, g => {
    g.scene.updateMatrixWorld(true);
    g.scene.traverse(m => { if (!m.isMesh) return;
      const im = new THREE.InstancedMesh(m.geometry, m.material, placements.length);
      placements.forEach((pl, i) => { dummy.position.set(...pl.p); dummy.rotation.set(0, pl.ry, 0); dummy.updateMatrix();
        dummy.matrix.multiply(m.matrixWorld); im.setMatrixAt(i, dummy.matrix); });
      im.frustumCulled = false; bracketGroup.add(im); });
    bracketStatus = 'glb'; status();
  }, undefined, onFail);
}
const nRy = w => Math.atan2(w.n[0], w.n[1]);
instanceGLB('assets/bracket/crest-bracket.glb', brackets.map(b => { const t = b.s / b.w.len;
  return { p: [b.w.a[0] + (b.w.b[0] - b.w.a[0]) * t, yStrip, b.w.a[1] + (b.w.b[1] - b.w.a[1]) * t], ry: nRy(b.w) }; }),
  () => { // fallback placeholder boxes
    const g = new THREE.BoxGeometry(0.02, 0.035, 0.035); g.rotateX(Math.PI / 4);
    const im = new THREE.InstancedMesh(g, new THREE.MeshLambertMaterial({ color: 0xbbbbbb }), brackets.length);
    brackets.forEach((b, i) => { const t = b.s / b.w.len;
      dummy.position.set(b.w.a[0] + (b.w.b[0] - b.w.a[0]) * t + b.w.n[0] * inset, yStrip, b.w.a[1] + (b.w.b[1] - b.w.a[1]) * t + b.w.n[1] * inset);
      dummy.rotation.set(0, nRy(b.w), 0); dummy.updateMatrix(); im.setMatrixAt(i, dummy.matrix); });
    bracketGroup.add(im); bracketStatus = 'placeholder'; status(); });
// inside corners at every wall start (rectangular room = 4 inside corners); bisect the two wall normals
{ const ws = walls(); const pl = ws.map((w, i) => { const pv = ws[(i + ws.length - 1) % ws.length];
    return { p: [w.a[0], yStrip, w.a[1]], ry: Math.atan2(w.n[0] + pv.n[0], w.n[1] + pv.n[1]) }; });
  instanceGLB('assets/bracket/inside_corner.glb', pl, () => {}); }

// ---------- display shelf: wall C, nearest the entry corner (first thing you see walking in) ----------
const SHELF = { x: 1.1, len: 1.5, depth: 0.28, tiers: [1.0, 1.4, 1.8, 2.2] }; // top tier ~0.36 m under the fascia
const shelf = new THREE.Group(); scene.add(shelf);
shelf.position.set(SHELF.x, 0, D); shelf.rotation.y = Math.PI; // local +Z = into room
const shelfLbl = label('DISPLAY SHELF · Clay builds', 0, SHELF.tiers[3] + 0.3); shelf.add(shelfLbl);
{
  const boards = [], strips = [], glows = [];
  for (const y of SHELF.tiers) {
    let g = new THREE.BoxGeometry(SHELF.len, 0.035, SHELF.depth); g.translate(0, y - 0.0175, SHELF.depth / 2); boards.push(g);
    g = new THREE.BoxGeometry(SHELF.len - 0.06, 0.006, 0.012); g.translate(0, y - 0.038, SHELF.depth - 0.04); strips.push(g); // LED strip under front edge
    g = new THREE.PlaneGeometry(SHELF.len - 0.04, 0.34); g.translate(0, y - 0.035 - 0.17, 0.004); glows.push(g); // wash grazing the wall below
  }
  const b = new THREE.Mesh(mergeGeometries(boards), oakMat); b.receiveShadow = true; shelf.add(b);
  shelf.add(new THREE.Mesh(mergeGeometries(strips), new THREE.MeshBasicMaterial({ color: 0xffc98a, toneMapped: false })));
  const gm = new THREE.Mesh(mergeGeometries(glows), new THREE.MeshBasicMaterial({ color: 0xffb066, alphaMap: glowTex, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false }));
  gm.renderOrder = 3; shelf.add(gm);
  hoverable(b, shelfLbl);
}
// under-shelf wash on the builds: one warm light for the whole stack (1 light instead of 4 keeps Quest fragment cost down)
const shelfLight = new THREE.PointLight(0xffb36b, low ? 0 : 1.6, 2.2, 1.6); shelfLight.position.set(0, 1.6, 0.45); shelf.add(shelfLight);
const slots = []; for (const y of SHELF.tiers) for (let i = 0; i < 3; i++) slots.push([(-1 + i) * SHELF.len / 3, y, SHELF.depth * 0.5]);
// HOPE sign hangs on wall D between the door and the far corner
const hope = new THREE.Group(); hope.position.set(0.012, 1.55, 2.65); hope.rotation.y = Math.PI / 2; scene.add(hope);
let buildsInfo = 'none'; const lodObjs = [];
function mergeByMaterial(root) { // collapse a static build to one mesh per material (fewer draws)
  root.updateMatrixWorld(true); const inv = new THREE.Matrix4().copy(root.matrixWorld).invert(), groups = new Map();
  root.traverse(m => { if (m.isMesh && !m.isSkinnedMesh && !Array.isArray(m.material)) { const k = m.material.uuid; if (!groups.has(k)) groups.set(k, []); groups.get(k).push(m); } });
  const out = new THREE.Group();
  for (const ms of groups.values()) {
    const gs = ms.map(m => { const g = m.geometry.clone().applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, m.matrixWorld)); return g; });
    let merged = null; try { merged = gs.length > 1 ? mergeGeometries(gs) : gs[0]; } catch (e) { merged = null; }
    if (!merged) return root; out.add(new THREE.Mesh(merged, ms[0].material));
  }
  return out;
}
function standUp(o) { // fit + stand thin plaques upright facing +Z, recentre on bbox bottom
  let box = new THREE.Box3().setFromObject(o), sz = box.getSize(new THREE.Vector3());
  if (sz.y < 0.03 && Math.max(sz.x, sz.z) > 0.04) { o.rotation.x = Math.PI / 2; o.updateMatrixWorld(true); box = new THREE.Box3().setFromObject(o); }
  const c = box.getCenter(new THREE.Vector3()); o.position.set(-c.x, -box.min.y, -c.z);
  const w = new THREE.Group(); w.add(o); w.traverse(m => { if (m.isMesh) { m.castShadow = false; m.receiveShadow = true; } }); return w;
}
async function loadBuilds() {
  let list = [], base = 'assets/builds/';
  for (const dir of ['assets/builds-opt/', 'assets/builds/']) {
    try { const r = await fetch(dir + 'manifest.json', { cache: 'no-store' }); if (r.ok) { const j = await r.json(); list = Array.isArray(j) ? j : (j.builds || j.items || j.models || []); base = dir; if (list.length) break; } }
    catch (e) { console.info('builds manifest missing/partial:', dir, e.message); }
  }
  const isHope = e => /hope/i.test(e.file || '') || /hope/i.test(e.name || '');
  const sign = list.find(isHope), shelfList = list.filter(e => !isHope(e));
  let loaded = 0, failed = 0;
  buildsInfo = list.length ? `${shelfList.length} on shelf${sign ? ' + HOPE on wall' : ''}` : 'no manifest yet';
  const url = f => /^(https?:|\/)/.test(f) ? f : base + f.replace(/^assets\/builds(-opt)?\//, '');
  const lodFile = e => e.lod1 ? (typeof e.lod1 === 'string' ? e.lod1 : (e.file || '').replace(/\.glb$/i, '_lod1.glb')) : null;
  shelfList.slice(0, slots.length).forEach((e, i) => {
    const name = e.name || e.file || `Build ${i + 1}`, file = e.file || e.path || e.url || e.glb;
    const holder = new THREE.Group(); holder.position.set(...slots[i]); shelf.add(holder);
    const lb = label(name, 0, -0.06, 0.45); lb.position.z = SHELF.depth * 0.5 + 0.01; holder.add(lb); hoverable(holder, lb);
    if (!file) return;
    const lf = lodFile(e), primary = (low && lf) ? lf : file;
    const fitObj = o0 => { const o = mergeByMaterial(o0); o.scale.setScalar(e.scale || 1);
      const s = new THREE.Box3().setFromObject(o).getSize(new THREE.Vector3());
      const thin = s.y < 0.03, hgt = thin ? s.z : s.y, dep = thin ? s.y : s.z;
      o.scale.multiplyScalar(Math.min(1, 0.42 / Math.max(s.x, 1e-6), 0.34 / Math.max(hgt, 1e-6), 0.26 / Math.max(dep, 1e-6))); return standUp(o); };
    loader.load(url(primary), g => {
      if (!low && lf) { // near = full, far = lod1
        const lod = new THREE.LOD(); lod.addLevel(fitObj(g.scene), 0); holder.add(lod); lodObjs.push(lod);
        loader.load(url(lf), g2 => lod.addLevel(fitObj(g2.scene), 2.0), undefined, () => {});
        loaded++; buildsInfo = `${loaded}/${shelfList.length} on shelf (${base.includes('opt') ? 'opt+LOD' : 'src'})`; status(); return;
      }
      const o = mergeByMaterial(g.scene); o.scale.setScalar(e.scale || 1);
      const s = new THREE.Box3().setFromObject(o).getSize(new THREE.Vector3());
      const thin = s.y < 0.03, hgt = thin ? s.z : s.y, dep = thin ? s.y : s.z;
      const fit = Math.min(1, 0.42 / Math.max(s.x, 1e-6), 0.34 / Math.max(hgt, 1e-6), 0.26 / Math.max(dep, 1e-6)); // stay inside slot + tier gap
      o.scale.multiplyScalar(fit); holder.add(standUp(o)); loaded++; buildsInfo = `${loaded}/${shelfList.length} on shelf${sign ? ' + HOPE on wall' : ''}`; status();
    }, undefined, () => { failed++; console.info('build not ready:', file); });
  });
  if (sign) {
    const lb = label(sign.name || 'HOPE', 0, 0.55, 0.6); lb.position.z = 0.05; hope.add(lb);
    loader.load(url(sign.file), g => { const o = standUp(g.scene); o.position.y = -0.42; hope.add(o); hoverable(o, lb); status(); }, undefined, () => console.info('HOPE not ready'));
  }
  status();
}
loadBuilds();

// ---------- equipment ----------
let equipInfo = '';
const PROPS = 'assets/props/';
const butcherMat = new THREE.MeshStandardMaterial({ roughness: 0.6, map: canvasTex(256, (g, s) => { for (let i = 0; i < 16; i++) { const l = 0.8 + rnd() * 0.35; g.fillStyle = `rgb(${200 * l | 0},${150 * l | 0},${95 * l | 0})`; g.fillRect(i * s / 16, 0, s / 16, s); g.fillStyle = 'rgba(60,30,10,.35)'; g.fillRect(i * s / 16, 0, 1, s); } }) });
// load a prop GLB, fit it to w x h x d (m) with bottom at elevation; hide the box version only on success
function fitProp(g, file, w, h, d, el, hideList, tint) { const big = !low && w * d > 0.5; // only big furniture casts
  loader.load(PROPS + file, gl => {
    const o = gl.scene; const bb = new THREE.Box3().setFromObject(o), sz = bb.getSize(new THREE.Vector3()), c = bb.getCenter(new THREE.Vector3());
    const sx = w / sz.x, sy = h / sz.y, sz2 = d / sz.z; o.scale.set(sx, sy, sz2); o.position.set(-c.x * sx, el - bb.min.y * sy, -c.z * sz2);
    o.traverse(m => { if (m.isMesh) { m.castShadow = big; m.receiveShadow = true; if (tint) { m.material = m.material.clone(); m.material.color.lerp(new THREE.Color(tint), 0.85); } } });
    hideList.forEach(m => m.visible = false); g.add(o);
  }, undefined, () => console.info('prop fallback (box):', file));
}
const box = (w, h, d, x, y, z) => { const g = new THREE.BoxGeometry(w, h, d); g.translate(x, y, z); return g; };
fetch('equipment.json', { cache: 'no-store' }).then(r => r.json()).then(j => {
  const items = j.items || [];
  equipInfo = `${items.length}${j.placeholder ? ' (placeholder)' : ''}`;
  for (const it of items) {
    const g = new THREE.Group(), el = it.elevation || 0, ry = THREE.MathUtils.degToRad(it.rotationY || 0);
    const mat = new THREE.MeshStandardMaterial({ color: it.color || 0x7a7f88, roughness: 0.6 });
    let top = el + (it.h || 0), mesh;
    if (it.kind === 'table') { // top + 4 legs, open underneath
      const t = 0.035, l = 0.04, i = 0.05, gs = [box(it.w, t, it.d, 0, it.h - t / 2, 0)];
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) gs.push(box(l, it.h - t, l, sx * (it.w / 2 - i), (it.h - t) / 2, sz * (it.d / 2 - i)));
      if (it.top === 'butcher') { const top = new THREE.Mesh(gs.shift(), butcherMat); top.receiveShadow = true; g.add(top); mat.color.set(0x4a2c1a); }
      mesh = new THREE.Mesh(mergeGeometries(gs), mat); aoBlob(it.position[0], it.position[1], it.w, it.d, ry);
    } else if (it.kind === 'block') {
      let y = el; const gs = [];
      const pm = (it.parts || [{ h: it.h, color: it.color }]).map(p => { const m = new THREE.Mesh(box(it.w, p.h, it.d, 0, y + p.h / 2, 0), new THREE.MeshStandardMaterial({ color: p.color || 0x333333, roughness: 0.45 })); y += p.h; return m; });
      pm.forEach(m => { m.receiveShadow = true; g.add(m); }); top = y;
      const door = new THREE.Mesh(new THREE.PlaneGeometry(it.w * 0.8, (it.parts?.[0]?.h || 0.3) * 0.75), new THREE.MeshStandardMaterial({ color: 0x0c0e10, roughness: 0.1, metalness: 0.2 }));
      door.position.set(0, el + (it.parts?.[0]?.h || 0.3) * 0.5, it.d / 2 + 0.001); g.add(door);
    } else if (it.kind === 'enclosure') {
      const inn = it.inner || { w: it.w * 0.7, d: it.d * 0.7, h: it.h * 0.6 };
      const im = new THREE.Mesh(box(inn.w, inn.h, inn.d, 0, el + inn.h / 2, 0), new THREE.MeshStandardMaterial({ color: inn.color || 0x222222, roughness: 0.5 })); im.castShadow = true; g.add(im);
      const shell = new THREE.Mesh(box(it.w, it.h, it.d, 0, el + it.h / 2, 0), new THREE.MeshStandardMaterial({ color: 0xcfe3ea, roughness: 0.05, transparent: true, opacity: 0.18, depthWrite: false }));
      g.add(shell); const e = new THREE.LineSegments(new THREE.EdgesGeometry(shell.geometry), new THREE.LineBasicMaterial({ color: 0x2a2a2a })); g.add(e);
    } else if (it.kind === 'wallshelf') {
      const gs = it.levels.map(y => box(it.w, 0.03, it.d, 0, y - 0.015, 0));
      mesh = new THREE.Mesh(mergeGeometries(gs), mat); top = Math.max(...it.levels);
      if (it.spools) { // filament spools + bit boxes, instanced
        const n = 10, sp = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.1, 0.1, 0.07, 20).rotateX(Math.PI / 2), new THREE.MeshStandardMaterial({ roughness: 0.5 }), n);
        const pal = [0xd0553f, 0xe8e2d4, 0x2f3a46, 0x3f8f6a, 0xe0a63a, 0x5b6fd0];
        for (let k = 0; k < n; k++) { const lvl = k < 6 ? it.levels[0] : it.levels[1], zi = k < 6 ? k : k - 6, cnt = k < 6 ? 6 : 4;
          dummy.position.set(0, lvl + 0.1, -it.d / 2 + 0.2 + zi * (it.d - 0.4) / (cnt - 1)); dummy.rotation.set(0, Math.PI / 2, 0); dummy.updateMatrix();
          sp.setMatrixAt(k, dummy.matrix); sp.setColorAt(k, tmpC.set(pal[k % pal.length])); }
        g.add(sp);
      }
    } else { mesh = new THREE.Mesh(box(it.w, it.h, it.d, 0, el + it.h / 2, 0), mat); }
    if (mesh) { mesh.castShadow = it.kind === 'table' && it.w * it.d >= 0.5; mesh.receiveShadow = true; g.add(mesh); }
    if (it.model) { const before = g.children.slice(); const m = it.model;
      fitProp(g, m.file, m.w ?? it.w, m.h ?? (top - el), m.d ?? it.d, m.elevation ?? el, (m.keep ? before.filter((_, k) => !m.keep.includes(k)) : before).filter(x => !x.isInstancedMesh), m.tint);
      (it.extras || []).forEach(x => { const xg = new THREE.Group(); xg.position.set(x.offset?.[0] || 0, 0, x.offset?.[1] || 0); xg.rotation.y = THREE.MathUtils.degToRad(x.rotationY || 0); g.add(xg); fitProp(xg, x.file, x.w, x.h, x.d, x.elevation || 0, []); }); }
    const lb = label(it.name, 0, top + 0.12, 0.8); lb.userData.billboard = true; g.add(lb); hoverable(g, lb);
    g.position.set(it.position[0], 0, it.position[1]); g.rotation.y = ry; scene.add(g);
  }
  flushBlobs(); status();
}).catch(e => console.warn('equipment.json', e));

// ---------- task lights (bench + machines), toggle ----------
const taskLights = []; 
function taskLight(x, z, tx, tz, y = H - 0.45) {
  const s = new THREE.SpotLight(0xfff0dc, 6, 3, 0.62, 0.5, 1.6); s.position.set(x, y, z); s.target.position.set(tx, 0.9, tz);
  scene.add(s, s.target);
  const fx = new THREE.Group(); fx.position.set(x, y, z);
  const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.003, 0.003, H - y), new THREE.MeshBasicMaterial({ color: 0x222222 })); cord.position.y = (H - y) / 2; fx.add(cord);
  const shade = new THREE.Mesh(new THREE.SphereGeometry(0.13, 16, 6, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0xc4561f, roughness: 0.3, side: THREE.DoubleSide })); shade.position.y = -0.07; fx.add(shade); // orange enamel dome
  const bulb = new THREE.Mesh(new THREE.CircleGeometry(0.085, 20).rotateX(Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xfff0dc, toneMapped: false, side: THREE.DoubleSide })); bulb.position.y = -0.055; fx.add(bulb);
  scene.add(fx); taskLights.push({ s, bulb });
}
taskLight(3.0, 2.0, 3.0, 2.0);           // assembly bench
taskLight(5.45, 1.35, 5.6, 1.4);           // X1C + 3018 machines
let taskOn = false;
function setTask(on) { taskOn = on; for (const t of taskLights) { t.s.visible = on; t.bulb.material.color.set(on ? 0xfff0dc : 0x444444); } }

// ---------- controls / panels ----------
const clock = new THREE.Clock();
const CHIPS = ['#d9a066', '#e7dccb', '#b5655a', '#6f9a7d', '#6b7fa8', '#8c76a6']; // muted
const st = { chip: -1 };
const api = {
  scenes: engine.scenes, presets: Object.keys(PRESETS), chips: CHIPS,
  setScene: id => { engine.setScene(id, clock.getElapsedTime()); if (id !== 'solid') st.chip = -1; },
  setBrightness: b => (engine.state.brightness = b),
  setSolidSRGB: (r, g, b, chip = -1) => { st.chip = chip; engine.setSolid([r, g, b].map(v => Math.pow(v / 255, 2.2)), clock.getElapsedTime()); },
  setPreset: k => applyPreset(k), setTask: on => setTask(on), setLabels: on => (showLabels = on),
  get state() { return { ...engine.state, preset, task: taskOn, labels: showLabels, chip: st.chip }; },
};
const overlay = initOverlay(api, { N, P });
const xrPanel = createXRPanel(THREE, renderer, scene, rig, api);
xrPanel.group.position.set(ENTRY.x + ENTRY.fx * 0.9, 1.35, ENTRY.z + ENTRY.fz * 0.9);
xrPanel.group.lookAt(ENTRY.x, 1.6, ENTRY.z);
let placePanelFrames = 0;
const _p = new THREE.Vector3(), _d = new THREE.Vector3();
function placePanel() { // 0.9 m ahead, ~15° below eye level, facing the user
  const xc = renderer.xr.getCamera(); xc.getWorldPosition(_p); xc.getWorldDirection(_d); _d.y = 0; if (_d.lengthSq() < 1e-6) return; _d.normalize();
  xrPanel.group.position.set(_p.x + _d.x * 0.9, _p.y - 0.9 * Math.tan(THREE.MathUtils.degToRad(15)), _p.z + _d.z * 0.9);
  xrPanel.group.lookAt(_p.x, _p.y, _p.z);
}
xrPanel.onRecenter = placePanel;
let drawCalls = 0;
function status() { overlay.status(`N=${N} px · perimeter ${P.toFixed(2)} m · brackets ${brackets.length} (${bracketStatus}) · builds: ${buildsInfo} · equipment ${equipInfo} · draw calls ${drawCalls}${low ? ' · LOW' : ''}`); }
applyPreset('sunset');
setLow(low);
const seventies = buildSeventies(THREE, scene, mergeGeometries, { shelf, low, D, H }); console.info('70s props tris', seventies.tris);
status();

// hover (desktop pointer) / gaze (XR head) -> show that object's label
const ray = new THREE.Raycaster(), mouse = new THREE.Vector2(0, 0); let hasMouse = false;
renderer.domElement.addEventListener('pointermove', e => { hasMouse = true; mouse.set(e.clientX / innerWidth * 2 - 1, -(e.clientY / innerHeight) * 2 + 1); });
let frame = 0, hovered = null;
function updateHover() {
  if (renderer.xr.isPresenting) { const xc = renderer.xr.getCamera(); xc.getWorldPosition(_p); xc.getWorldDirection(_d); ray.set(_p, _d); }
  else ray.setFromCamera(hasMouse ? mouse : new THREE.Vector2(0, 0), camera);
  const roots = hoverables.map(h => h.root), hit = ray.intersectObjects(roots, true)[0];
  hovered = null;
  if (hit) for (let o = hit.object; o && !hovered; o = o.parent) hovered = hoverables.find(h => h.root === o) || null;
  setLabelsVisible(hasMouse || renderer.xr.isPresenting ? hovered : null);
}

// ---------- loop ----------
const avg = new Float32Array(3);
window.LOFT = { scene, N, perimeter: P, engine, wallU, setView, api, renderer, get drawCalls() { return drawCalls; } };
renderer.setAnimationLoop(() => {
  applyLook();
  for (const l of lodObjs) { if (lowNow && l.levels.length > 1) { l.levels.forEach((v, k) => v.object.visible = k === l.levels.length - 1); } else l.update(camera); }
  const t = clock.getElapsedTime();
  engine.render(t, colors, {});
  const d = tex.image.data; avg.fill(0);
  for (let i = 0; i < N; i++) {
    const r = colors[i * 3], g = colors[i * 3 + 1], b = colors[i * 3 + 2];
    d[i * 4] = Math.min(255, r * 255); d[i * 4 + 1] = Math.min(255, g * 255); d[i * 4 + 2] = Math.min(255, b * 255); d[i * 4 + 3] = 255;
    pixels.instanceColor.setXYZ(i, Math.min(1, r * 3), Math.min(1, g * 3), Math.min(1, b * 3));
    if ((i & 7) === 0) { avg[0] += r; avg[1] += g; avg[2] += b; }
  }
  tex.needsUpdate = true; pixels.instanceColor.needsUpdate = true;
  const n = Math.max(1, N / 8), lum = (avg[0] + avg[1] + avg[2]) / n / 3 + 1e-6;
  coveFill.color.setRGB(avg[0] / n / lum / 3 * 3, avg[1] / n / lum / 3 * 3, avg[2] / n / lum / 3 * 3); coveFill.intensity = Math.min(0.7, lum * 1.1);
  if (renderer.xr.isPresenting && placePanelFrames > 0 && --placePanelFrames === 0) placePanel();
  if ((frame++ % 6) === 0) updateHover();
  xrPanel.group.visible = renderer.xr.isPresenting || window.LOFT.showPanel === true;
  xrPanel.update();
  if (!renderer.xr.isPresenting && !look.on) controls.update();
  renderer.render(scene, camera);
  drawCalls = renderer.info.render.calls;
  if (frame % 60 === 0) status();
});
addEventListener('resize', () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); });
