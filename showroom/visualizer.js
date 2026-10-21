// Owl Cove booth screen visualizer (Nova's 2026-10-17 direction): a 70s hi-fi LED meter.
// Segmented spectrum (~32 bars, amber -> coral toward the top) with slow-falling peak caps, a faint moon-white oscilloscope
// drifting across the upper third, on a dark-indigo ground with scanlines + glass vignette. Hand-rolled Canvas2D, no third-party code.
// Draws into ONE canvas that dj.js shows as the existing `dj-screen` CanvasTexture: no new meshes, no new draw calls.
// Layout is in canvas units relative to the canvas height, so any ASPECT (2:1 flat placeholder, ~2.67:1 curved screen) lays out without stretching.
// Flash safety: only the bars and the scope move. Bar release is a 650 ms time constant and the mean bar level may rise at most
// MAX_MEAN_RISE per second, so the overall screen luminance cannot swing faster than ~2.5 Hz (measured in qa/owl-cove/flash.json).
import { DJ_CONFIG } from './dj-config.js';

const C = () => DJ_CONFIG.VISUALIZER;
const hex = h => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const mix = (a, b, u) => { const A = hex(a), B = hex(b); return `rgb(${A.map((v, i) => Math.round(v + (B[i] - v) * u)).join(',')})`; };

export class LedVisualizer {
  constructor() { this.levels = new Float32Array(64); this.peaks = new Float32Array(64); this.peakHold = new Float32Array(64); this.meanPrev = 0; this.W = 0; this.H = 0; this.idleT = 0; this.info = null; }
  // (re)size the target canvas and rebuild the cached layers (ground + unlit segments, lit segment strip, scanline glass)
  layout(canvas, width) { const cfg = C(), W = Math.round(width), H = Math.round(width / cfg.ASPECT); this.canvas = canvas; canvas.width = W; canvas.height = H; this.W = W; this.H = H; this.ctx = canvas.getContext('2d');
    const u = H / 256; this.u = u; const pad = Math.round(10 * u); // canvas units: 1 u = 1 px of a 256-px-tall canvas
    const L = this.L = { pad, headH: Math.round(22 * u), footY: Math.round(H - 14 * u), barTop: Math.round(28 * u) }; L.barBot = L.footY - Math.round(2 * u); // v2: slim header, no credit strip (bars get the height)
    const nB = cfg.BARS, nS = cfg.SEGMENTS, gapX = Math.max(1, Math.round(3 * u)), bw = Math.floor((W - 2 * pad - gapX * (nB - 1)) / nB), x0 = Math.round((W - (bw * nB + gapX * (nB - 1))) / 2);
    const pitch = (L.barBot - L.barTop) / nS, segH = Math.max(1, Math.round(pitch * 0.72)); Object.assign(L, { nB, nS, gapX, bw, x0, pitch, segH });
    const mk = () => { const c = document.createElement('canvas'); c.width = W; c.height = H; return c; }, col = C().COLORS;
    const segCol = s => mix(col.low, col.high, Math.pow(s / Math.max(1, nS - 1), 1.6)); this.segCol = Array.from({ length: nS }, (_, s) => segCol(s));
    this.peakCol = col.peak ? `rgb(${hex(col.peak).map(v => Math.min(255, Math.round(v * (col.peakBoost || 1)))).join(',')})` : null; // coral caps, a touch brighter than the bars
    // ground: indigo, never black, + unlit segments
    const bg = this.bg = mk(), b = bg.getContext('2d'); b.fillStyle = col.ground; b.fillRect(0, 0, W, H);
    const gl = b.createRadialGradient(W / 2, H * 0.45, H * 0.1, W / 2, H * 0.5, W * 0.62); gl.addColorStop(0, 'rgba(120,140,220,0.07)'); gl.addColorStop(1, 'rgba(0,0,0,0)'); b.fillStyle = gl; b.fillRect(0, 0, W, H); // phosphor glow centre
    b.globalAlpha = col.unlitAlpha; for (let i = 0; i < nB; i++) for (let s = 0; s < nS; s++) { b.fillStyle = this.segCol[s]; b.fillRect(x0 + i * (bw + gapX), Math.round(L.barBot - (s + 1) * pitch), bw, segH); } b.globalAlpha = 1;
    // lit strip: one fully lit bar column, blitted per bar (32 drawImage calls a frame)
    const lit = this.lit = document.createElement('canvas'); lit.width = bw; lit.height = H; const l = lit.getContext('2d'); for (let s = 0; s < nS; s++) { l.fillStyle = this.segCol[s]; l.fillRect(0, Math.round(L.barBot - (s + 1) * pitch), bw, segH); }
    // glass: scanlines + edge vignette, drawn last over everything
    const gs = this.glass = mk(), q = gs.getContext('2d'); q.fillStyle = `rgba(0,0,0,${col.scanlineAlpha})`; const sp = Math.max(2, Math.round(2 * u)); for (let y = 0; y < H; y += sp) q.fillRect(0, y, W, Math.max(1, Math.round(sp / 2)));
    const vg = q.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.45, W / 2, H / 2, Math.hypot(W, H) * 0.56); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(5,7,18,0.42)'); q.fillStyle = vg; q.fillRect(0, 0, W, H);
    this.info = null; this.infoCv = mk(); }
  // band edges (log spaced) for the analyser's bin count
  bands(analyser) { const cfg = C(), n = analyser.frequencyBinCount, ny = analyser.context.sampleRate / 2, key = n + ':' + cfg.BARS; if (this._bk === key) return this._b; this._bk = key;
    const e = []; for (let i = 0; i <= cfg.BARS; i++) e.push(Math.round(cfg.F_MIN * Math.pow(cfg.F_MAX / cfg.F_MIN, i / cfg.BARS) / ny * n));
    this._b = Array.from({ length: cfg.BARS }, (_, i) => [Math.min(n - 1, e[i]), Math.min(n, Math.max(e[i] + 1, e[i + 1]))]); this.fd = new Uint8Array(n); this.td = new Uint8Array(analyser.fftSize); return this._b; }
  // advance the meter ballistics by dt seconds. analyser = AnalyserNode or null (paused -> calm idle: everything settles to rest)
  step(dt, analyser, live) { const cfg = C(), nB = cfg.BARS, lv = this.levels, pk = this.peaks, ph = this.peakHold; const tgt = this._t || (this._t = new Float32Array(64));
    if (live && analyser) { const B = this.bands(analyser); analyser.getByteFrequencyData(this.fd); analyser.getByteTimeDomainData(this.td);
      for (let i = 0; i < nB; i++) { let m = 0; for (let k = B[i][0]; k < B[i][1]; k++) m = Math.max(m, this.fd[k]); tgt[i] = Math.min(1, Math.max(0, m / 255 + cfg.TILT * i / (nB - 1) - 0.04)); } }
    else tgt.fill(0);
    const ka = 1 - Math.exp(-dt / (cfg.ATTACK_MS / 1000)), kr = 1 - Math.exp(-dt / (cfg.RELEASE_MS / 1000)); let m0 = 0, m1 = 0; const nx = this._n || (this._n = new Float32Array(64));
    for (let i = 0; i < nB; i++) { m0 += lv[i]; nx[i] = lv[i] + (tgt[i] - lv[i]) * (tgt[i] > lv[i] ? ka : kr); m1 += nx[i]; }
    m0 /= nB; m1 /= nB; const rise = m1 - m0, cap = cfg.MAX_MEAN_RISE * dt; // global limiter: the whole meter can't brighten faster than MAX_MEAN_RISE / s
    const s = rise > cap ? cap / rise : 1; for (let i = 0; i < nB; i++) { lv[i] = nx[i] > lv[i] ? lv[i] + (nx[i] - lv[i]) * s : nx[i];
      if (lv[i] >= pk[i]) { pk[i] = lv[i]; ph[i] = cfg.PEAK_HOLD_MS / 1000; } else if ((ph[i] -= dt) <= 0) pk[i] = Math.max(lv[i], pk[i] - cfg.PEAK_FALL * dt); }
    this.limited = s < 1; this.live = live && !!analyser; this.idleT += dt; }
  // render one frame. info = { left, title, right, credit, progress 0..1|null, msg } (re-rendered only when it changes)
  render(info) { const ctx = this.ctx, cfg = C(), col = cfg.COLORS, L = this.L, W = this.W, H = this.H, u = this.u;
    ctx.globalAlpha = 1; ctx.drawImage(this.bg, 0, 0);
    // bars: whole segments only (LED look), peak cap = one segment
    for (let i = 0; i < L.nB; i++) { const n = Math.round(this.levels[i] * L.nS), x = L.x0 + i * (L.bw + L.gapX);
      if (n > 0) { const y = Math.round(L.barBot - n * L.pitch); ctx.drawImage(this.lit, 0, y, L.bw, L.barBot - y, x, y, L.bw, L.barBot - y); }
      const p = Math.min(L.nS - 1, Math.round(this.peaks[i] * L.nS) - 1); if (p >= 0 && p >= n - 1 && this.peaks[i] > 0.02) { ctx.fillStyle = this.peakCol || this.segCol[p]; ctx.fillRect(x, Math.round(L.barBot - (p + 1) * L.pitch), L.bw, L.segH); } }
    // scope: un-triggered, so it drifts; upper third, low opacity
    const y0 = H * 0.30, amp = H * 0.13 * cfg.SCOPE_GAIN; ctx.globalAlpha = col.scopeAlpha; ctx.strokeStyle = col.scope; ctx.lineWidth = Math.max(1, cfg.SCOPE_PX_XR * W / 512); ctx.beginPath(); const N = 160;
    if (this.live && this.td) { const td = this.td, step = Math.floor(td.length / N); for (let k = 0; k <= N; k++) { const v = Math.max(-1, Math.min(1, (td[Math.min(td.length - 1, k * step)] - 128) / 128 * 1)), x = L.pad + (W - 2 * L.pad) * k / N, y = Math.min(H * 0.44, Math.max(H * 0.13, y0 - v * amp)); k ? ctx.lineTo(x, y) : ctx.moveTo(x, y); } }
    else { const t = this.idleT; for (let k = 0; k <= N; k++) { const x = L.pad + (W - 2 * L.pad) * k / N, v = 0.06 / cfg.SCOPE_GAIN * Math.sin(k / N * Math.PI * 3 + t * 0.6) * (0.6 + 0.4 * Math.sin(t * 0.4)); k ? ctx.lineTo(x, y0 - v * amp) : ctx.moveTo(x, y0 - v * amp); } } // idle: a slow, calm breathing line
    ctx.stroke(); ctx.globalAlpha = 1;
    this.drawInfo(info); ctx.drawImage(this.infoCv, 0, 0); ctx.drawImage(this.glass, 0, 0); }
  // info = { dex, status, live, track, bottom, bottomStrong, msg }; re-rendered only when it changes
  drawInfo(info) { const key = JSON.stringify(info); if (key === this.info) return; this.info = key; const W = this.W, H = this.H, u = this.u, L = this.L, col = C().COLORS, g = this.infoCv.getContext('2d');
    g.clearRect(0, 0, W, H); g.textBaseline = 'alphabetic'; const base = Math.round(16 * u);
    g.globalAlpha = col.dexAlpha; g.fillStyle = col.dex; g.font = `bold ${Math.round(13 * u)}px ui-monospace, Menlo, Consolas, monospace`; g.fillText('DEX', L.pad, base); const dw = g.measureText('DEX').width;
    g.globalAlpha = 1; g.fillStyle = col.live; g.font = `bold ${Math.round(9 * u)}px system-ui, sans-serif`; const rw = g.measureText(info.status).width; g.fillText(info.status, W - L.pad - rw, base);
    if (info.track) { g.globalAlpha = col.trackAlpha; g.fillStyle = col.track; g.font = `${Math.round(10 * u)}px system-ui, sans-serif`; const room = W - 2 * L.pad - dw - rw - 24 * u; let ti = info.track;
      while (ti.length > 1 && g.measureText(ti).width > room) ti = ti.slice(0, -2); if (ti !== info.track) ti += '…'; g.fillText(ti, L.pad + dw + 10 * u, base); }
    if (info.bottom) { g.globalAlpha = info.bottomStrong ? col.trackAlpha : col.hintAlpha; g.fillStyle = col.hint; g.font = `${Math.max(7, Math.round(8 * u))}px system-ui, sans-serif`; let bt = info.bottom; while (bt.length > 1 && g.measureText(bt).width > W - 2 * L.pad) bt = bt.slice(0, -2);
      g.fillText(bt, L.pad, H - Math.round(4 * u)); }
    g.globalAlpha = 1;
    if (info.msg) { const bx = W * 0.15, by = H * 0.3, bw = W * 0.7, bh = H * 0.36; g.fillStyle = 'rgba(16,20,40,0.94)'; g.fillRect(bx, by, bw, bh); g.strokeStyle = col.dex; g.lineWidth = Math.max(1, 1.5 * u); g.strokeRect(bx, by, bw, bh);
      g.fillStyle = col.track; const f2 = Math.round(16 * u); g.font = `bold ${f2}px system-ui, sans-serif`; wrap(g, info.msg, bw - 24 * u).slice(0, 4).forEach((l, i) => g.fillText(l, bx + 12 * u, by + 10 * u + f2 * (i + 1) * 1.2)); } }
}
function wrap(g, text, w) { const out = []; let line = ''; for (const word of String(text).split(/\s+/)) { const t = line ? line + ' ' + word : word; if (g.measureText(t).width > w && line) { out.push(line); line = word; } else line = t; } if (line) out.push(line); return out; }
