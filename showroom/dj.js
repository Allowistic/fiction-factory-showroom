// Dex's DJ booth: audio (positional, after a user gesture), cue-grid sync (Dex's *.cues.json), light show (Dex's *.lights.json),
// the booth screen (DEX / now playing / BPM / bar N of M / waveform with transition zones / credit footer), fake fixtures, requests placeholder.
// Draws: screen 1 + fixture cones 1 (hidden while dark). Dex, the counter, platters and crossfader live in the shared robots SkinnedMesh (bartender.js).
import { DJ_CONFIG } from './dj-config.js';
import { cleanText, GuestbookStore } from './guestbook.js';

const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x)), frac = x => x - Math.floor(x);

// ---------- beat grid: Dex's README snippet (binary search; first beat > t) ----------
export class CueGrid {
  constructor(c) { this.c = c; this.beats = c.beats || []; this.down = c.downbeats || []; this.tracks = c.tracks || []; this.events = (c.events || []).slice().sort((a, b) => a.t - b.t); this.duration = c.duration_s || 0;
    this.zones = []; let open = null; for (const e of this.events) { if (e.type === 'transition_start') open = e.t; else if (e.type === 'transition_end' && open != null) { this.zones.push([open, e.t]); open = null; } else if (e.type === 'breakdown') this.zones.push([e.t, e.t + 0.001, 'breakdown']); } }
  static synthetic(bpm = 120, dur = 3600) { const s = 60 / bpm, beats = [], down = []; for (let i = 0; i * s < dur; i++) { beats.push(+(i * s).toFixed(3)); if (i % 4 === 0) down.push(+(i * s).toFixed(3)); }
    return new CueGrid({ beats, downbeats: down, tracks: [], events: [], duration_s: dur, synthetic: true }); }
  static after(arr, t) { let lo = 0, hi = arr.length; while (lo < hi) { const mid = (lo + hi) >> 1; if (arr[mid] <= t) lo = mid + 1; else hi = mid; } return lo; } // README beatIndexAt
  pos(arr, t) { const i = CueGrid.after(arr, t) - 1; if (arr.length < 2) return 0; if (i < 0) return (t - arr[0]) / (arr[1] - arr[0]); const j = Math.min(i, arr.length - 2); return j + (t - arr[j]) / (arr[j + 1] - arr[j]); } // fractional index
  beatPos(t) { return this.pos(this.beats, t); } barPos(t) { return this.pos(this.down, t); }
  bpm(t) { const b = this.beats, i = clamp(CueGrid.after(b, t) - 1, 0, Math.max(0, b.length - 9)); return b.length > 9 ? 8 * 60 / (b[i + 8] - b[i]) : 0; } // local tempo over 8 beats
  trackAt(t) { const i = this.tracks.findIndex(k => t >= k.start_s && t < k.end_s); return i < 0 ? null : { i, ...this.tracks[i] }; }
  bar(t) { const k = this.trackAt(t); if (!k) return null; const a = CueGrid.after(this.down, k.start_s - 1e-3), b = CueGrid.after(this.down, k.end_s - 1e-3), n = CueGrid.after(this.down, t);
    return { n: clamp(n - a, 1, Math.max(1, b - a)), m: Math.max(1, b - a) }; }
  nextEvent(t) { return this.events[CueGrid.after(this.events.map(e => e.t), t)] || null; }
}

// ---------- palette: ONE swappable place (Nova supplies the real colours via DJ_CONFIG.PALETTE) ----------
export function makePalette(fromShow = {}) { return { ...fromShow, ...(DJ_CONFIG.PALETTE || {}) }; }
const _rgb = {}; function rgb(name, pal) { const hex = (name && name[0] === '#') ? name : pal[name] || '#ffffff'; const k = hex; if (_rgb[k]) return _rgb[k];
  const n = parseInt(hex.slice(1), 16), s = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(v => { v /= 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }); return (_rgb[k] = s); } // sRGB -> linear

// ---------- show inputs (one interface): file + audio clock, or a live message stream (LIGHTSHOW_WS) ----------
export class ShowInput { constructor() { this.cues = []; this.palette = {}; this.name = ''; } clock() { return 0; } close() {} }
export class FileShowInput extends ShowInput { // json = Dex *.lights.json; clock = () => mix time (audio.currentTime - offset) or a free-running clock
  constructor(json, clock, name = 'file') { super(); this.name = name; this.palette = json.palette || {}; this.safety = json.safety || {}; this.clock = clock;
    // Dex lights v1 + v2 (LIGHTS_SPEC v0.4): v2 adds per-fixture move cues (fixture/move) and a top-level projector_cues array.
    // Move cues are counted and skipped (moving heads come next pass); only the group/effect cues play. Projector cues are parsed as data (no surface yet).
    this.version = json.version || 1; this.spec = typeof json.spec === 'string' ? json.spec : null; const all = Array.isArray(json.cues) ? json.cues : [];
    const keep = all.filter(c => c && typeof c.t === 'number' && c.group && c.fx && !c.move && !c.fixture);
    this.counts = { total: all.length, group: keep.length, move: all.filter(c => c && (c.move || c.fixture)).length };
    this.ignored = { move: all.length - keep.length, projector: Array.isArray(json.projector_cues) ? json.projector_cues.length : 0 };
    this.cues = keep.map((c, k) => ({ ...c, k })).sort((a, b) => a.t - b.t || a.k - b.k); this.bpm = json.bpm || null;
    // LIGHTS_SPEC v0.4 sec. 6.8: projector entries come from the top-level projector_cues[] and carry `content` (not cues[] group:'projector' / media).
    // Optional mask {below_m, intensity} (face-height rule: image below below_m dimmed to intensity, <= 0.4) is kept, normalised, on each cue for the future surface.
    this.projector = (Array.isArray(json.projector_cues) ? json.projector_cues : []).filter(c => c && typeof c.t === 'number' && c.content)
      .map((c, k) => ({ ...c, k, mask: normMask(c.mask) })).sort((a, b) => a.t - b.t || a.k - b.k);
    // LIGHTS_SPEC sec. 6.0: spec frame -> scene frame per room (positions, targets, no-go, occluders), read from the file's rooms.<room>.to_scene. Data only this pass.
    this.frames = roomFrames(json); this.scene = specToScene(json, this.frames); }
  // one-line source summary for the panel / booth status
  get frameSource() { const fr = Object.entries(this.frames), file = fr.filter(([, f]) => f.fromFile).map(([r]) => r), fb = fr.filter(([, f]) => !f.fromFile).map(([r]) => r);
    return !fb.length ? 'to_scene from file' : !file.length ? 'to_scene MISSING in file: sec. 6.0 fallback' : `to_scene from file (${file.join(', ')}); sec. 6.0 fallback for ${fb.join(', ')}`; }
  get summary() { const m = this.projector.filter(c => c.mask).length;
    return `lights v${this.version}${this.spec ? ' · ' + this.spec.replace(/\s*\(.*$/, '') : ''}: ${this.counts.total} cues = ${this.counts.group} group/effect played + ${this.counts.move} move skipped; ${this.projector.length} projector_cues parsed (${m} masked), no surface yet; ${this.frameSource}`; } }
// projector mask (LIGHTS_SPEC v0.4 sec. 6.8): {below_m, intensity}; intensity is clamped to the face-height cap 0.4. Invalid / absent -> null.
export function normMask(m) { if (!m || typeof m.below_m !== 'number') return null; return { below_m: m.below_m, intensity: Math.min(0.4, clamp(typeof m.intensity === 'number' ? m.intensity : 0.4)) }; }

// rooms.<room>.to_scene: {translate:[dx,dy,dz]} (scene = spec + translate) and/or {mirror_x:true} (x_scene = -x_spec, pan negated).
// The file's to_scene is authoritative (Dex's v0.4 files carry it). DEFAULT_TO_SCENE (sec. 6.0 values) is only a guard for a file or room missing the key,
// and is flagged fromFile:false so the status line says so. Hall coords are hall world coords, cantina coords are cantina-local.
export const DEFAULT_TO_SCENE = { hall: { translate: [-2, 0, 1.5] }, cantina: { mirror_x: true } };
export function roomFrames(json) { const out = {}, rooms = json?.rooms || {};
  for (const r of new Set([...Object.keys(DEFAULT_TO_SCENE), ...Object.keys(rooms)])) { const ts = rooms[r]?.to_scene, ok = ts && typeof ts === 'object';
    out[r] = { ...(ok ? ts : DEFAULT_TO_SCENE[r] || {}), fromFile: !!ok }; }
  return out; }
export function toScene(frames, room, p) { if (!Array.isArray(p)) return p; const f = frames[room] || {}, t = f.translate || [0, 0, 0];
  return [(f.mirror_x ? -p[0] : p[0]) + t[0], p[1] + t[1], (f.mirror_z ? -p[2] : p[2]) + t[2]]; }
export const panToScene = (frames, room, pan) => (frames[room]?.mirror_x ? -pan : pan);
function boxToScene(frames, b) { if (!b.min || !b.max) return { ...b, center: toScene(frames, b.room, b.center) }; const a = toScene(frames, b.room, b.min), c = toScene(frames, b.room, b.max);
  return { ...b, min: a.map((v, i) => Math.min(v, c[i])), max: a.map((v, i) => Math.max(v, c[i])) }; }
export function specToScene(json, frames) {
  const fixtures = (json.fixtures || []).map(f => ({ ...f, mount: f.mount ? { ...f.mount, pos: toScene(frames, f.room, f.mount.pos) } : f.mount,
    pan: f.pan && frames[f.room]?.mirror_x ? { ...f.pan, home: f.pan.home != null ? -f.pan.home : f.pan.home } : f.pan }));
  const targets = {}; for (const [k, v] of Object.entries(json.targets || {})) targets[k] = { ...v, pos: toScene(frames, v.room, v.pos) };
  return { fixtures, targets, nogo: (json.nogo || []).map(b => boxToScene(frames, b)), occluders: (json.occluders || []).map(b => boxToScene(frames, b)) }; }
export class LiveShowInput extends ShowInput { // STUB for a future OSC bridge: each message = one cue in the .lights.json shape, {cues:[...]}, {palette:{...}} or {type:'clock', t}
  constructor(url, name = 'live') { super(); this.name = name; this.t0 = performance.now() / 1000; this.offset = 0; this.status = 'off';
    if (!url) return; try { this.ws = new WebSocket(url); this.status = 'connecting'; this.ws.onopen = () => { this.status = 'live'; }; this.ws.onclose = () => { this.status = 'closed'; };
      this.ws.onmessage = e => { let m; try { m = JSON.parse(e.data); } catch { return; } this.accept(m); }; } catch (e) { this.status = 'error: ' + e.message; } }
  accept(m) { if (m.type === 'clock' && typeof m.t === 'number') { this.offset = m.t - (performance.now() / 1000 - this.t0); return; } if (m.palette) Object.assign(this.palette, m.palette);
    for (const c of (m.cues || (m.fx ? [m] : []))) { if (!c.fx || !c.group) continue; this.cues.push({ ...c, t: typeof c.t === 'number' ? c.t : this.clock(), k: this.cues.length }); }
    this.cues.sort((a, b) => a.t - b.t || a.k - b.k); if (this.cues.length > 500) this.cues.splice(0, this.cues.length - 500); }
  clock() { return performance.now() / 1000 - this.t0 + this.offset; } close() { this.ws?.close(); } }

// ---------- light-show engine: Dex's fx (color, pulse, chase, sweep, fade, blackout_soft) for groups cove / wash / spot / all ----------
// rate -> timing from the beats array: beat = 1 beat, half = half a bar (2 beats), bar = downbeat grid, 2bar = every other downbeat.
const RATE = { beat: 1, half: 2, bar: 4, '2bar': 8 };
// Extensibility (Hugo's specs later): group 'mover' (moving heads) keeps pan / tilt / speed / beam from its cues; they are ignored until a
// fixture registers with show.register('mover', fn). Projector entries come from top-level projector_cues[] ({projector, surface, content:{kind,color,pattern,src,tint}, intensity}) and go to registered ProjectorSurfaces.
// 'all' only fans out to cove / wash / spot. No movers or projectors exist yet.
export const BASE_GROUPS = ['cove', 'wash', 'spot'];
export class ProjectorSurface { // wraps a mesh; media = video URL (VideoTexture), an HTMLCanvasElement / 'canvas:<id>' (CanvasTexture), or null (off)
  constructor(THREE, mesh, name) { this.THREE = THREE; this.mesh = mesh; this.name = name; this.src = null; this.video = null; }
  setMedia(media) { if (media === this.src) return; this.src = media; const T = this.THREE, m = this.mesh.material; this.video?.pause(); this.video = null; m.map?.dispose?.(); m.map = null;
    if (typeof media === 'string' && media.startsWith('canvas:')) media = document.getElementById(media.slice(7));
    if (media instanceof HTMLCanvasElement) m.map = new T.CanvasTexture(media);
    else if (typeof media === 'string') { const v = document.createElement('video'); v.src = media; v.loop = true; v.muted = true; v.playsInline = true; v.crossOrigin = 'anonymous'; v.play().catch(() => {}); this.video = v; m.map = new T.VideoTexture(v); }
    if (m.map) m.map.colorSpace = T.SRGBColorSpace; m.needsUpdate = true; }
  /* content = {kind: color|pattern|video, color?, pattern?, src?, tint?}: video -> setMedia(src); color/pattern -> flat tint (patterns are drawn next pass) */
  setContent(cue, pal) { const m = this.mesh.material, c = cue?.content; if (!c) { this.setMedia(null); m.color?.setRGB(0, 0, 0); return; }
    this.setMedia(c.kind === 'video' ? c.src : null); this.pattern = c.kind === 'pattern' ? c.pattern : null;
    const col = rgb(c.tint || c.color || '#ffffff', pal || {}), k = Math.max(0, Math.min(1, cue.intensity ?? 1)) * (cue.mask ? Math.min(1, cue.mask.intensity ?? 1) : 1);
    m.color?.setRGB(col[0] * k, col[1] * k, col[2] * k); } }
export class LightShow {
  constructor() { this.input = null; this.grid = null; this.on = false; this.maxHz = DJ_CONFIG.SAFETY.maxFlashHz; this.targets = new Map(); this.surfaces = new Map(); }
  register(group, fn) { this.targets.set(group, fn); } // future fixtures: fn(groupState, t) each frame while a show runs
  addSurface(surface) { this.surfaces.set(surface.name, surface); }
  tickExtras(t) { for (const [G, fn] of this.targets) fn(this.group(G, t), t); if (!this.surfaces.size) return;
    /* projector_cues (LIGHTS_SPEC v0.4 sec. 6.8): the latest started cue per projector+surface wins; dur_s omitted = until the next cue there */
    const last = {}; for (const c of this.input?.projector || []) { if (c.t > t) break; const key = c.projector ? c.projector + ':' + c.surface : c.surface;
      last[key] = (c.dur_s == null || t < c.t + c.dur_s) ? c : null; }
    for (const [n, sf] of this.surfaces) { const key = n in last ? n : Object.keys(last).find(k => k.endsWith(':' + n)); if (key) sf.setContent(last[key], this.pal); } }
  play(input, grid) { this.input?.close?.(); this.input = input; this.grid = grid || CueGrid.synthetic(input.bpm || 120); this.pal = makePalette(input.palette); this.maxHz = Math.min(DJ_CONFIG.SAFETY.maxFlashHz, input.safety?.max_strobe_hz || 3); this.on = true; }
  stop() { this.on = false; this.input?.close?.(); this.input = null; }
  get t() { return this.input ? this.input.clock() : 0; }
  phase(rate, t) { // 0..1 within one period of `rate`, plus the period in seconds, slowed down (x2) until the flash rate is <= maxHz
    const g = this.grid, beats = RATE[rate] || 4; let mult = 1, per = beats * 60 / (g.bpm(t) || 120); while (1 / (per * mult) > this.maxHz) mult *= 2;
    const p = beats >= 4 ? g.barPos(t) / (beats / 4) / mult : g.beatPos(t) / beats / mult; return { ph: frac(p), per: per * mult }; }
  // state for one group at time t: { base, dim, layers: [{fx, col, k, ph|pos, dir}] }
  group(G, t) { const cues = this.input?.cues || [], pal = this.pal; let base = [0, 0, 0], dim = 1, mover = null; const layers = [];
    for (const c of cues) { if (c.t > t) break; if (c.group !== G && !(c.group === 'all' && BASE_GROUPS.includes(G))) continue; if (c.pan != null || c.tilt != null || c.speed != null || c.beam != null) mover = { pan: c.pan, tilt: c.tilt, speed: c.speed, beam: c.beam }; /* mover fields: kept, unused */ const dur = c.dur_s ?? 1e9, end = c.t + dur, col = rgb(c.color, pal), I = clamp(c.intensity ?? 1), lc = col.map(v => v * I);
      if (c.fx === 'color') base = lc;
      else if (c.fx === 'fade') { const u = clamp((t - c.t) / Math.max(0.05, dur)); base = base.map((v, i) => v + (lc[i] - v) * u); }
      else if (c.fx === 'blackout_soft') { if (t < end) { const u = Math.min(clamp((t - c.t) / 2), clamp((end - t) / 2)); dim = Math.min(dim, 1 - u * (1 - (c.intensity ?? 0))); } } // soft: 2 s ramps; intensity = residual level
      else if (t < end) { if (c.fx === 'sweep') layers.push({ fx: 'sweep', col: lc, pos: clamp((t - c.t) / Math.max(0.05, dur)), dir: c.dir || 'lr' });
        else { const { ph, per } = this.phase(c.rate || (c.fx === 'chase' ? '2bar' : 'bar'), t); layers.push({ fx: c.fx, col: lc, ph, per, dir: c.dir || 'lr' }); } } }
    return { base, dim, layers, mover }; }
  // colour at position u (0..1 along a strip / across fixtures) for a group state
  static at(S, u, out) { out[0] = S.base[0] * S.dim; out[1] = S.base[1] * S.dim; out[2] = S.base[2] * S.dim;
    for (const L of S.layers) { let k = 0; const uu = L.dir === 'rl' ? 1 - u : L.dir === 'center' ? Math.abs(u - 0.5) * 2 : u;
      if (L.fx === 'pulse') k = Math.exp(-L.ph * L.per * 7); // flash on the grid tick, ~140 ms decay
      else if (L.fx === 'chase') { const d = frac(uu * 3 - L.ph); k = Math.pow(Math.max(0, 1 - Math.abs(d - 0.5) * 2), 3); } // 3 bands travel one slot per period
      else if (L.fx === 'sweep') k = Math.exp(-Math.pow((uu - L.pos) / 0.07, 2));
      out[0] += L.col[0] * k * S.dim; out[1] += L.col[1] * k * S.dim; out[2] += L.col[2] * k * S.dim; }
    return out; }
}

// ---------- requests: placeholder store (same pluggable pattern as the guestbook). Sends nowhere, stores nothing. ----------
export class PlaceholderRequestStore extends GuestbookStore {
  get label() { return DJ_CONFIG.REQUESTS.note + ' — nothing is sent or saved yet.'; } get canWrite() { return false; }
  async list() { return []; } async add() { throw new Error(DJ_CONFIG.REQUESTS.note); } }

// ---------- audio: one <audio> element -> PositionalAudio at the booth (WebAudio graph built on the first user gesture) ----------
class DJAudio {
  constructor(THREE, camera, anchor) { this.THREE = THREE; this.camera = camera; this.anchor = anchor; this.el = new Audio(); this.el.preload = 'none'; this.el.crossOrigin = 'anonymous'; this.vol = 0.8; this.room = 1; this.offset = 0; this.set = null; this.analyser = null; }
  ensureGraph() { if (this.pa) { this.pa.context.state === 'suspended' && this.pa.context.resume(); return; } const T = this.THREE; this.listener = new T.AudioListener(); this.camera.add(this.listener);
    this.pa = new T.PositionalAudio(this.listener); this.pa.setMediaElementSource(this.el); this.pa.setDistanceModel('linear'); this.pa.setRefDistance(1.5); this.pa.setMaxDistance(18); this.pa.setRolloffFactor(1); this.pa.setVolume(this.vol * this.room);
    this.pa.position.set(0, 1.4, 0.3); this.anchor.add(this.pa); this.analyser = new T.AudioAnalyser(this.pa, 512); this.listener.context.resume(); }
  load(set) { this.set = set; if (DJ_CONFIG.AUDIO_URL) { this.el.src = DJ_CONFIG.AUDIO_URL; this.offset = 0; this.kind = 'stream'; return; }
    const ogg = set.ogg && this.el.canPlayType('audio/ogg; codecs="vorbis"'); this.el.src = ogg ? set.ogg : set.mp3; this.offset = ogg ? 0 : (set.mp3Offset || 0); this.kind = ogg ? 'ogg' : 'mp3'; }
  async play() { this.ensureGraph(); await this.el.play(); }
  stop() { this.el.pause(); }
  get playing() { return !this.el.paused && !this.el.ended; }
  get t() { return Math.max(0, this.el.currentTime - this.offset); } // mix-timeline time (MP3: -25 ms encoder delay)
  setVolume(v) { this.vol = v; this.applyGain(); }
  // room gain (0..1) from showroom.js: 1 inside the cantina, falls off fast past the doorway (D1: the hall stays quiet). Smoothed ~80 ms, no zipper noise.
  setRoomGain(k) { if (Math.abs(k - this.room) < 0.002) return; this.room = k; this.applyGain(); }
  applyGain() { const g = this.pa?.gain?.gain, c = this.pa?.context; if (!g) return; g.setTargetAtTime(this.vol * this.room, c.currentTime, 0.08); }
  energy() { if (!this.analyser) return 0; const d = this.analyser.getFrequencyData(); let s = 0; for (let i = 1; i < 24; i++) s += d[i]; return s / (23 * 255); } // low-band level 0..1
}

// ---------- the booth ----------
// rig = { dex: pivots, booth: pivots } from the robots batch (or Clay's GLB via the manifest names)
export function createDJBooth(THREE, { camera, rig, signUrl = '' }) {
  const group = new THREE.Group(); group.name = 'dj-booth'; // booth-local: counter faces +Z, Dex behind at -Z
  // screen (1 draw): canvas 1024x512, wide, behind Dex
  const cv = document.createElement('canvas'); cv.width = 1024; cv.height = 512; const g = cv.getContext('2d'); const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.7), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false })); screen.position.set(0, 2.08, -0.66); screen.rotation.x = 0.06; /* above Dex, clear of the wall ribs, tipped slightly toward visitors */ screen.name = 'dj-screen'; screen.userData.noMerge = true; group.add(screen);
  // fixtures (1 draw): wash cone down the wall behind the booth + two downlight spots onto the decks. Fixed aim: never at visitors / the camera.
  const cones = []; const cone = (fix, top, bottom, rTop, rBot) => { const h = top.distanceTo(bottom), geo = new THREE.CylinderGeometry(rTop, rBot, h, 24, 1, true).toNonIndexed(); const n = geo.attributes.position.count, f = new Float32Array(n), a = new Float32Array(n);
      for (let i = 0; i < n; i++) { f[i] = fix; a[i] = geo.attributes.position.getY(i) > 0 ? 0.55 : 0.0; } geo.setAttribute('fix', new THREE.BufferAttribute(f, 1)); geo.setAttribute('fade', new THREE.BufferAttribute(a, 1));
      const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), top.clone().sub(bottom).normalize()); geo.applyQuaternion(q); geo.translate((top.x + bottom.x) / 2, (top.y + bottom.y) / 2, (top.z + bottom.z) / 2); cones.push(geo); };
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  cone(0, V(0, 2.95, -0.4), V(0, 1.15, -0.62), 0.06, 0.85);           // wash: from the ceiling down the back wall (behind Dex)
  cone(1, V(-0.48, 2.95, -0.05), V(-0.48, 1.08, 0.02), 0.03, 0.2);  // spot A: straight down onto deck A
  cone(2, V(0.48, 2.95, -0.05), V(0.48, 1.08, 0.02), 0.03, 0.2);    // spot B: straight down onto deck B
  const cg = new THREE.BufferGeometry(); for (const k of ['position', 'fix', 'fade']) { const arrs = cones.map(c => c.attributes[k].array), out = new Float32Array(arrs.reduce((s, a) => s + a.length, 0)); let o = 0; for (const a of arrs) { out.set(a, o); o += a.length; } cg.setAttribute(k, new THREE.BufferAttribute(out, cones[0].attributes[k].itemSize)); }
  const uCol = { value: [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()] };
  const coneMat = new THREE.ShaderMaterial({ uniforms: { uCol }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, forceSinglePass: true,
    vertexShader: 'attribute float fix; attribute float fade; uniform vec3 uCol[3]; varying vec3 vC; void main(){ int i=int(fix+0.5); vec3 c = i==0?uCol[0]:(i==1?uCol[1]:uCol[2]); vC = c*fade; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }',
    fragmentShader: 'varying vec3 vC; void main(){ gl_FragColor = vec4(vC, 1.); }' });
  const fixtures = new THREE.Mesh(cg, coneMat); fixtures.name = 'dj-fixtures'; fixtures.userData.noMerge = true; fixtures.visible = false; fixtures.renderOrder = 3; group.add(fixtures);
  const washLight = new THREE.PointLight(0xffffff, 0, 5, 1.6); washLight.position.set(0, 2.3, 0.6); group.add(washLight); // the one real light (booth wash); 0 when dark
  // pick proxies (invisible, raycast only)
  const proxy = (name, w, h, d, x, y, z) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshBasicMaterial()); m.visible = false; m.name = name; m.position.set(x, y, z); m.userData.noMerge = true; group.add(m); return m; };
  const pickDecks = proxy('dj-decks', 1.5, 0.2, 0.5, 0, 1.06, 0.02), pickReq = proxy('dj-request', 0.3, 0.2, 0.08, 0.55, 0.62, 0.3), pickScreen = screen;

  const audio = new DJAudio(THREE, camera, group), show = new LightShow();
  const st = { set: null, grid: null, peaks: null, lightsJson: null, msg: null, msgUntil: 0, beatI: 0, lastT: -1, beatEnv: 0, down: false, clock: 0, showFree: null, onset: { last: 0, per: 0.5, avg: 0, prevE: 0 }, status: 'offline', drift: [] };
  const sets = DJ_CONFIG.SETS;
  async function fetchJSON(u) { const r = await fetch(u); if (!r.ok) throw new Error(u + ' ' + r.status); return r.json(); }
  async function selectSet(id) { const s = sets.find(x => x.id === id) || sets[0]; if (!s) { st.status = 'offline'; return; } stop(); st.set = s; audio.load(s); st.status = 'ready';
    try { const [c, l, p] = await Promise.all([fetchJSON(s.cues), fetchJSON(s.lights), s.peaks ? fetchJSON(s.peaks) : null]); st.grid = new CueGrid(c); st.lightsJson = l; st.peaks = p; st.cuesJson = c; } catch (e) { st.grid = null; st.msg = 'cue sidecar missing: ' + e.message; st.msgUntil = st.clock + 8; } draw(true); }
  async function play() { if (!st.set) await selectSet(sets[0]?.id); if (!st.set) return; try { await audio.play(); st.status = 'live'; st.beatI = st.grid ? CueGrid.after(st.grid.beats, audio.t) : 0;
      if (st.lightsJson) { const inp = new FileShowInput(st.lightsJson, () => audio.t, st.set.id + '.lights.json'); st.showInfo = inp.summary; show.play(inp, st.grid); } } catch (e) { st.msg = 'Tap again to start audio (' + e.name + ')'; st.msgUntil = st.clock + 6; } draw(true); }
  function stop() { audio.stop(); if (show.input && show.input instanceof FileShowInput && !st.showFree) show.stop(); st.status = st.set ? 'ready' : 'offline'; draw(true); }
  function toggle() { audio.playing ? stop() : play(); }
  // seeking: hold beat firing while the element seeks (currentTime already reads the target, so the skipped beats would fire late, up to ~0.5 s on MP3),
  // then re-run the binary search on 'seeked' (Dex README). st.seeks counts re-syncs (QA).
  audio.el.addEventListener('seeking', () => { st.seeking = true; });
  audio.el.addEventListener('seeked', () => { st.seeking = false; st.seeks = (st.seeks || 0) + 1; if (st.grid) st.beatI = CueGrid.after(st.grid.beats, audio.t); st.lastT = audio.t; });
  audio.el.addEventListener('ended', () => { st.status = 'ready'; show.stop(); });
  // custom show (panel 'Load show'): Dex's .lights.json format; follows the audio clock while a set plays, else a free-running clock (synthetic grid at json.bpm || 120)
  function playShow(json, name = 'custom') { const t0 = performance.now() / 1000; if (audio.playing && st.grid) { st.showFree = null; show.play(new FileShowInput(json, () => audio.t, name), st.grid); }
    else { st.showFree = t0; show.play(new FileShowInput(json, () => performance.now() / 1000 - t0, name), null); } }
  function stopShow() { st.showFree = null; show.stop(); }
  function playLive(url = DJ_CONFIG.LIGHTSHOW_WS) { if (!url) return 'LIGHTSHOW_WS not set'; const inp = new LiveShowInput(url); show.play(inp, st.grid && audio.playing ? st.grid : null); return inp.status; }

  // ---- screen ----
  let lastDraw = -1; const COLW = 1024;
  function wrapText(text, w) { const out = []; let line = ''; for (const word of String(text).split(/\s+/)) { const t = line ? line + ' ' + word : word; if (g.measureText(t).width > w && line) { out.push(line); line = word; } else line = t; } if (line) out.push(line); return out; }
  function fmt(s) { s = Math.max(0, Math.floor(s)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); }
  function draw(force = false) { if (!force && st.clock - lastDraw < 0.2) return; lastDraw = st.clock; const t = audio.t, G = st.grid;
    g.fillStyle = '#0d0c11'; g.fillRect(0, 0, 1024, 512); g.strokeStyle = '#3a3346'; g.lineWidth = 4; g.strokeRect(2, 2, 1020, 508); g.textBaseline = 'top';
    g.fillStyle = '#9a7bff'; g.font = 'bold 92px ui-monospace, Menlo, monospace'; g.fillText('DEX', 30, 20); g.fillStyle = '#8f8a99'; g.font = '22px system-ui, sans-serif'; g.fillText('DJ · Fiction Factory Cantina', 34, 116);
    const live = audio.playing; g.font = 'bold 26px system-ui'; g.fillStyle = live ? '#2fd6c4' : st.status === 'ready' ? '#c49a6c' : '#7a6f80'; const tag = live ? '● LIVE · ' + (audio.kind || '') : st.status === 'ready' ? 'READY' : 'OFFLINE'; g.fillText(tag, 994 - g.measureText(tag).width, 30);
    if (!st.set) { g.fillStyle = '#d9cdb6'; g.font = 'italic 54px Georgia, serif'; g.fillText('Dex is offline', 30, 200); g.font = '24px system-ui'; g.fillStyle = '#8f8a99'; g.fillText('No set configured (DJ_CONFIG.SETS / AUDIO_URL).', 32, 280); }
    else { const k = G?.trackAt(t), bar = G?.bar(t), bpm = G?.bpm(t);
      g.fillStyle = '#efe4cf'; g.font = 'bold 40px system-ui'; g.fillText((k ? k.title : st.set.label).slice(0, 40), 30, 156); g.fillStyle = '#c49a6c'; g.font = '28px system-ui'; g.fillText(k ? k.artist : (live ? '' : 'Tap the decks (or ▶ in the panel) to play'), 30, 204);
      g.fillStyle = '#d9cdb6'; g.font = '26px ui-monospace, Menlo, monospace'; const info = [bpm ? `BPM ${bpm.toFixed(1)}` : '', bar ? `bar ${bar.n} of ${bar.m}` : '', k ? `track ${k.i + 1}/${G.tracks.length}` : '', `${fmt(t)} / ${fmt(G?.duration || audio.el.duration || 0)}`].filter(Boolean).join('  ·  '); g.fillText(info, 30, 246);
      // waveform overview (RMS peaks) with transition zones shaded and track boundaries
      const x0 = 30, x1 = 994, y0 = 292, h = 92, D = G?.duration || st.peaks?.duration_s || 1, X = s => x0 + (x1 - x0) * clamp(s / D);
      if (G) for (const [a, b, kind] of G.zones) { g.fillStyle = kind === 'breakdown' ? 'rgba(122,94,168,0.35)' : 'rgba(47,214,196,0.22)'; g.fillRect(X(a), y0, Math.max(3, X(b) - X(a)), h); }
      if (st.peaks) { const r = st.peaks.rms, n = r.length, px = X(t); for (let i = 0; i < n; i++) { const x = x0 + (x1 - x0) * i / n, v = r[i] * h * 0.48; g.fillStyle = x < px ? '#9a7bff' : '#4a4458'; g.fillRect(x, y0 + h / 2 - v, Math.max(1, (x1 - x0) / n - 0.3), v * 2); } }
      if (G) { g.fillStyle = '#c49a6c'; for (const k2 of G.tracks) g.fillRect(X(k2.start_s), y0 - 6, 2, 6); }
      g.fillStyle = '#ffffff'; g.fillRect(X(t) - 1, y0 - 8, 3, h + 16);
      const ne = G?.nextEvent(t); g.fillStyle = '#8f8a99'; g.font = '20px system-ui'; if (ne && live) g.fillText(`next: ${ne.type.replace(/_/g, ' ')} in ${fmt(ne.t - t)}`, 30, 392);
      // credit footer (exact README text)
      g.fillStyle = '#b6ab9a'; g.font = '15px system-ui'; wrapText(st.set.credit, 964).slice(0, 4).forEach((l, i) => g.fillText(l, 30, 420 + i * 19)); }
    if (st.msg && st.clock < st.msgUntil) { g.fillStyle = 'rgba(20,18,26,0.94)'; g.fillRect(150, 150, 724, 200); g.strokeStyle = '#2fd6c4'; g.strokeRect(150, 150, 724, 200); g.fillStyle = '#efe4cf'; g.font = 'bold 36px system-ui'; const ls = wrapText(st.msg, 680); ls.slice(0, 4).forEach((l, i) => g.fillText(l, 172, 172 + i * 44)); }
    tex.needsUpdate = true; }

  // ---- requests: placeholder modal (sends nowhere, stores nothing) / VR screen notice ----
  const reqStore = new PlaceholderRequestStore(); let modal = null;
  function requestNotice() { st.msg = 'Request a song: ' + DJ_CONFIG.REQUESTS.note + (signUrl ? ' (phone: ' + signUrl.replace(/^https?:\/\//, '') + ')' : ''); st.msgUntil = st.clock + 7; draw(true); }
  function openRequest() { if (modal) return; modal = document.createElement('div'); modal.id = 'dj-req-modal'; modal.style.cssText = 'position:fixed;inset:0;z-index:50;background:rgba(5,4,6,.62);display:flex;align-items:center;justify-content:center;padding:12px';
    const box = document.createElement('div'); box.setAttribute('role', 'dialog'); box.setAttribute('aria-label', 'Request a song'); box.style.cssText = 'background:#16141b;color:#efe4cf;max-width:440px;width:100%;border-radius:12px;padding:18px;font:15px system-ui;box-shadow:0 10px 40px rgba(0,0,0,.5);border:1px solid #3a3346';
    const h = document.createElement('div'); h.textContent = 'Request a song'; h.style.cssText = 'font:bold 24px system-ui;color:#9a7bff';
    const note = document.createElement('div'); note.textContent = reqStore.label; note.style.cssText = 'font-size:13px;color:#c49a6c;margin:4px 0 12px';
    const f = document.createElement('form'); f.style.cssText = 'display:flex;flex-direction:column;gap:8px';
    const nm = document.createElement('input'); nm.placeholder = 'Your name'; nm.maxLength = 40; nm.id = 'dj-req-name'; const song = document.createElement('input'); song.placeholder = 'Song / artist'; song.maxLength = 120; song.id = 'dj-req-song';
    for (const el of [nm, song]) el.style.cssText = 'font:16px system-ui;padding:8px;border:1px solid #4a4458;border-radius:6px;background:#0d0c11;color:#efe4cf';
    const out = document.createElement('div'); out.style.cssText = 'font-size:13px;color:#2fd6c4;min-height:18px'; const row = document.createElement('div'); row.style.cssText = 'display:flex;gap:8px;justify-content:flex-end';
    const close = document.createElement('button'); close.type = 'button'; close.textContent = 'Close'; const sub = document.createElement('button'); sub.type = 'submit'; sub.textContent = 'Send request';
    for (const b of [close, sub]) b.style.cssText = 'border:0;border-radius:6px;padding:8px 14px;font:15px system-ui;cursor:pointer;background:' + (b === sub ? '#6b54c8;color:#fff' : '#2a2732;color:#efe4cf');
    close.onclick = closeRequest; f.onsubmit = async e => { e.preventDefault(); cleanText(nm.value, 40); cleanText(song.value, 120); try { await reqStore.add({}); } catch (ex) { out.textContent = ex.message + ' — nothing was sent or saved.'; } }; // placeholder: values are discarded
    row.append(close, sub); f.append(nm, song, out, row); box.append(h, note, f); modal.append(box); modal.addEventListener('pointerdown', e => { if (e.target === modal) closeRequest(); }); document.body.append(modal); addEventListener('keydown', onKey); setTimeout(() => nm.focus(), 0); }
  function onKey(e) { if (e.key === 'Escape') closeRequest(); e.stopPropagation(); }
  function closeRequest() { modal?.remove(); modal = null; removeEventListener('keydown', onKey); }

  // ---- per frame ----
  const _c = [0, 0, 0], fixCol = [[0, 0, 0], [0, 0, 0], [0, 0, 0]]; let coveState = null;
  // rig is read every frame: showroom.js swaps the placeholder pivots for Clay's rig (rig.dex / rig.booth / rig.dexPuppet / rig.pulse) once it loads.
  function update(dt) { st.clock += dt; const live = audio.playing, t = audio.t, G = st.grid, D = rig.dex, Bo = rig.booth, P = rig.dexPuppet;
    // beats (README tick loop) -> pulse envelopes; downbeats stronger
    let fired = 0; if (live && G && (st.seeking || audio.el.seeking)) { /* seeking: fire nothing; 'seeked' re-syncs */ }
    else if (live && G) { if (Math.abs(t - st.lastT) > 1.0) st.beatI = CueGrid.after(G.beats, t); /* backstop for a jump without seek events */ while (st.beatI < G.beats.length && G.beats[st.beatI] <= t) { const bt = G.beats[st.beatI]; st.drift.push(t - bt); if (st.drift.length > 64) st.drift.shift(); /* QA: beat firing lag (frame-quantised) */ fired = G.down.length && Math.abs(G.down[clamp(CueGrid.after(G.down, bt + 1e-3) - 1, 0, G.down.length - 1)] - bt) < 0.02 ? 2 : Math.max(fired, 1); st.beatI++; } }
    else if (live && audio.analyser) { const e = audio.energy(), o = st.onset; o.avg += (e - o.avg) * 0.05; if (e > o.avg * 1.35 && e - o.prevE > 0.02 && st.clock - o.last > 0.3) { const iv = st.clock - o.last; if (iv < 1.2) o.per += (iv - o.per) * 0.2; o.last = st.clock; fired = 1; } o.prevE = e; } // stream: onset estimate
    st.lastT = t; if (fired) st.beatEnv = fired === 2 ? 1 : Math.max(st.beatEnv, 0.55); st.beatEnv *= Math.exp(-dt * 6);
    // Dex: head nod on the beat (amplitude from the analyser level), hands on the decks, platters spin, crossfader follows the transitions
    if (D && P) { // Clay's Dex: clips only (deck poses solved by Clay's IK). Live: idle_nod (4 nods per clip) phase-locked to the beat grid, scratch_R
      // through the transition zones; idle: slow idle_nod; the request button: one wave. The antenna (no clip track) still flicks on the beat.
      const zone = live && G && G.zones.some(([a, b, kind]) => !kind && t >= a && t < b), want = st.clock < (st.waveUntil || 0) ? 'wave' : zone ? 'scratch_R' : 'idle_nod';
      const a = P.play(want, { loop: want !== 'wave', fade: 0.3 }); if (a) { const lockBeat = live && G && want !== 'wave'; a.timeScale = lockBeat ? 0 : live || want === 'wave' ? 1 : 0.35;
        if (lockBeat) a.time = frac(G.beatPos(t) / 4) * a.getClip().duration; }
      P.update(dt); D.root.position.y = D.root.userData.y0 ?? 0.25; if (D.antenna) D.antenna.rotation.z = Math.sin(st.clock * 3.1) * 0.12 + st.beatEnv * 0.2; }
    else if (D) { const bp = live ? (G ? G.beatPos(t) : (st.clock - st.onset.last) / st.onset.per) : st.clock * 0.4, ph = frac(bp), en = live ? audio.energy() : 0, amp = live ? 0.1 + 0.16 * en : 0.03;
      D.head.rotation.set(amp * Math.pow(Math.sin(ph * Math.PI), 2) + (live ? 0 : 0.12), Math.sin(st.clock * 0.35) * 0.15, 0); D.torso.rotation.set(live ? 0.04 + 0.03 * Math.sin(ph * Math.PI * 2) : 0.02, Math.sin(st.clock * 0.3) * 0.05, 0);
      D.root.position.y = (D.root.userData.y0 ?? 0) + (live ? Math.abs(Math.sin(ph * Math.PI)) * 0.012 : Math.sin(st.clock * 1.6) * 0.008);
      const cue = live ? Math.max(0, Math.sin(frac(G ? G.barPos(t) : bp / 4) * Math.PI * 2)) * 0.08 : 0;
      D.arm.rotation.set(-0.95, 0.1, 0.25); D.forearm.rotation.set(-0.55 - cue, 0, 0); D.armL.rotation.set(-0.95, -0.1, -0.25); D.forearmL.rotation.set(-0.55 - (live ? 0.08 - cue : 0), 0, 0);
      if (D.antenna) D.antenna.rotation.z = Math.sin(st.clock * 3.1) * 0.15 + st.beatEnv * 0.2; }
    if (Bo) { if (live) for (const p of Bo.platters) p.rotation.y -= dt * 3.49; // 33 1/3 rpm
      let xf = -1; if (G) { const k = G.trackAt(t); if (k) { const side = i => (i % 2 ? 1 : -1); xf = side(k.i); // deck A (left) plays even tracks, deck B odd
        const z = G.zones.find(([a, b, kind]) => !kind && t >= a && t < b); if (z && k.i > 0) { const u = clamp((t - z[0]) / (z[1] - z[0])); xf = side(k.i - 1) + (side(k.i) - side(k.i - 1)) * u; } } } // slide across the transition
      Bo.crossfader.position.x += ((xf * 0.06) - Bo.crossfader.position.x) * (1 - Math.exp(-dt * 4)); }
    // lights
    const on = show.on && show.input; if (on) { const T = show.t, w = show.group('wash', T), s = show.group('spot', T); coveState = show.group('cove', T);
      LightShow.at(w, 0.5, fixCol[0]); LightShow.at(s, 0.25, fixCol[1]); LightShow.at(s, 0.75, fixCol[2]); show.tickExtras(T); } else { coveState = null; for (const c of fixCol) c.fill(0); if (live && st.beatEnv > 0.01) { fixCol[0][0] = 0.25 * st.beatEnv; fixCol[0][1] = 0.2 * st.beatEnv; fixCol[0][2] = 0.5 * st.beatEnv; } }
    let any = 0; for (let i = 0; i < 3; i++) { const c = fixCol[i], bo = 1 + st.beatEnv * (i ? 0.25 : 0.4); uCol.value[i].set(c[0] * bo, c[1] * bo, c[2] * bo); any = Math.max(any, c[0], c[1], c[2]); }
    st.fixOn = any > 0.004; if (!fixtures.userData.merged) fixtures.visible = st.fixOn; washLight.color.setRGB(fixCol[0][0] + 1e-4, fixCol[0][1] + 1e-4, fixCol[0][2] + 1e-4).multiplyScalar(1 / Math.max(1e-3, Math.max(...fixCol[0]))); washLight.intensity = st.fixOn ? 3.0 * Math.max(...fixCol[0]) * (1 + st.beatEnv * 0.3) : 0; if (!st.fixOn) { washLight.color.setRGB(1, 0.72, 0.45); washLight.intensity = 0.9; } // idle: dim warm work light so the booth reads
    screen.material.color.setScalar(live ? 0.82 + 0.18 * st.beatEnv : 0.85); // screen pulses on beats, stronger on downbeats
    if (rig.pulse) rig.pulse.value = live ? 0.55 + 0.9 * st.beatEnv : 0.6; // booth emissive trims pulse (shared robots material uniform)
    draw(); }
  // cove overlay: called by the showroom after CoveScenes.render() fills the strip (CoveScenes has no arbitrary-colour API, so the show tints its output)
  function coveOverlay(colors, N) { if (!coveState) return false; for (let i = 0; i < N; i++) { LightShow.at(coveState, i / N, _c); colors[i * 3] = _c[0]; colors[i * 3 + 1] = _c[1]; colors[i * 3 + 2] = _c[2]; } return true; }
  function coveMean(out) { if (!coveState) return null; out[0] = out[1] = out[2] = 0; for (let i = 0; i < 8; i++) { LightShow.at(coveState, (i + 0.5) / 8, _c); out[0] += _c[0] / 8; out[1] += _c[1] / 8; out[2] += _c[2] / 8; } return out; }
  // select from a ray hit (XR trigger, desktop click, phone tap). xr = true -> no HTML modal.
  function onSelect(obj, xr) { if (obj === pickReq) { if (rig.dexPuppet) st.waveUntil = st.clock + (rig.dexPuppet.duration('wave') || 4); /* Dex waves at a request */ xr ? requestNotice() : (requestNotice(), openRequest()); return true; } if (obj === pickDecks || obj === pickScreen) { toggle(); return true; } return false; }
  // Clay's booth screen (`dj-screen`, booth-local geometry, 2:1 UV 0..1 as seen by visitors) replaces the placeholder plane: same mesh, material, pick.
  function adoptScreen(geo) { if (!geo) return false; const uv = geo.attributes.uv; if (uv) for (let i = 0; i < uv.count; i++) uv.setY(i, 1 - uv.getY(i)); /* glTF UV v runs top-down; the canvas texture is flipY */ screen.geometry.dispose(); screen.geometry = geo; screen.position.set(0, 0, 0); screen.rotation.set(0, 0, 0); screen.updateMatrix(); return true; }
  if (sets.length) selectSet(sets[0].id); else draw(true);
  return { group, screen, adoptScreen, fixtures, washLight, audio, show, state: st, update, draw, coveOverlay, coveMean, onSelect, pickables: [pickDecks, pickReq, pickScreen], selectSet, play, stop, toggle, playShow, stopShow, playLive, openRequest, closeRequest, get requestOpen() { return !!modal; } };
}
